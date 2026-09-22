package httpserver

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/alphabravo/genesis-console/internal/console"
	"github.com/alphabravo/genesis-console/internal/server/database/db"
)

func TestPackagedServer(t *testing.T) {
	pool := testDatabase(t)
	assets := fstest.MapFS{"index.html": {Data: []byte("<html>Genesis</html>")}, "assets/app.js": {Data: []byte("ok")}}
	down := false
	scanner := console.NewScanner(nil, "")
	h := Handler("/console.v1.ConsoleService/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := io.ReadAll(r.Body); err != nil {
			http.Error(w, "too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.Write([]byte("rpc"))
	}), assets, func(context.Context) error {
		if down {
			return errors.New("database error with credentials")
		}
		return nil
	}, "admin", "secret", db.New(pool), scanner.Changes)
	login := httptest.NewRequest("POST", "/auth/login", strings.NewReader(`{"username":"admin","password":"secret"}`))
	login.Header.Set("Content-Type", "application/json")
	loggedIn := httptest.NewRecorder()
	h.ServeHTTP(loggedIn, login)
	if loggedIn.Code != 204 || len(loggedIn.Result().Cookies()) != 1 {
		t.Fatal("login failed")
	}
	cookie := loggedIn.Result().Cookies()[0]
	request := func(method, path, body string, authenticated bool, origin string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Accept", "text/html")
		if authenticated {
			r.AddCookie(cookie)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := request("GET", "/", "", false, ""); w.Code != 302 || !strings.HasPrefix(w.Header().Get("Location"), "/login?") || w.Header().Get("WWW-Authenticate") != "" {
		t.Fatal("browser was not sent to the login page")
	}
	if w := request("GET", "/login", "", false, ""); w.Code != 200 {
		t.Fatal("login page is not public")
	}
	if w := request("GET", "/packages?pkg=grafana", "", true, ""); w.Code != 200 || !strings.Contains(w.Body.String(), "Genesis") || w.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("SPA route failed: %v", w)
	}
	if w := request("GET", "/assets/missing.js", "", true, ""); w.Code != 404 {
		t.Fatal("missing JS served HTML")
	}
	if w := request("GET", "/assets/app.js", "", true, ""); w.Code != 200 || !strings.Contains(w.Header().Get("Cache-Control"), "immutable") {
		t.Fatal("asset caching failed")
	}
	if w := request("POST", "/console.v1.ConsoleService/GetCluster", "{}", false, ""); w.Code != 401 {
		t.Fatal("RPC not protected")
	}
	if w := request("GET", "/events/scans", "", false, ""); w.Code != 302 {
		t.Fatal("event stream not protected")
	}
	q := db.New(pool)
	cyclonedx, spdx := `{"bomFormat":"CycloneDX"}`, `{"spdxVersion":"SPDX-2.3"}`
	if err := q.InsertFinding(context.Background(), db.InsertFindingParams{
		Digest: "sha256:abc", Ref: "example:latest", Cves: "[]",
		SbomCyclonedx: []byte(cyclonedx), SbomSpdx: []byte(spdx),
	}); err != nil {
		t.Fatal(err)
	}
	saved, err := q.LatestFindings(context.Background())
	if err != nil || len(saved) != 1 || !saved[0].SbomAvailable {
		t.Fatalf("SBOM metadata not saved: %v %v", saved, err)
	}
	id := strconv.FormatInt(saved[0].ID, 10)
	for _, format := range []struct{ name, body, mime, suffix string }{
		{"cyclonedx", cyclonedx, "application/vnd.cyclonedx+json", "cdx.json"},
		{"spdx-json", spdx, "application/spdx+json", "spdx.json"},
	} {
		url := "/sbom/" + id + "/" + format.name
		if w := request("GET", url, "", false, ""); w.Code != 302 {
			t.Fatal("SBOM download not protected")
		}
		w := request("GET", url, "", true, "")
		if w.Code != 200 || w.Body.String() != format.body || w.Header().Get("Content-Type") != format.mime || w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Content-Disposition") != `attachment; filename="genesis-scan-`+id+`.`+format.suffix+`"` {
			t.Fatalf("invalid SBOM download: %v", w)
		}
	}
	if err := q.InsertFinding(context.Background(), db.InsertFindingParams{Digest: "sha256:legacy", Cves: "[]"}); err != nil {
		t.Fatal(err)
	}
	for _, url := range []string{"/sbom/0/cyclonedx", "/sbom/-1/cyclonedx", "/sbom/invalid/cyclonedx", "/sbom/9223372036854775808/cyclonedx", "/sbom/999999/cyclonedx", "/sbom/" + id + "/html", "/sbom/2/cyclonedx"} {
		if w := request("GET", url, "", true, ""); w.Code != 404 {
			t.Fatalf("invalid/missing SBOM should be 404: %s %d", url, w.Code)
		}
	}
	if w := request("POST", "/console.v1.ConsoleService/GetCluster", "{}", true, "https://foreign.test"); w.Code != 403 {
		t.Fatal("cross-origin mutation allowed")
	}
	if w := request("POST", "/console.v1.ConsoleService/GetCluster", strings.Repeat("x", (1<<20)+1), true, ""); w.Code != 413 {
		t.Fatalf("body limit missing: %d", w.Code)
	}
	if w := request("GET", "/readyz", "", false, ""); w.Code != 200 {
		t.Fatal("readiness inaccessible")
	}
	down = true
	if w := request("GET", "/readyz", "", false, ""); w.Code != 503 || strings.Contains(w.Body.String(), "credentials") {
		t.Fatal("readiness did not fail safely")
	}
	if w := request("GET", "/healthz", "", false, ""); w.Code != 200 {
		t.Fatal("liveness depends on DB")
	}
	server := httptest.NewServer(h)
	defer server.Close()
	streamRequest, _ := http.NewRequest("GET", server.URL+"/events/scans", nil)
	streamRequest.AddCookie(cookie)
	stream, err := (&http.Client{Timeout: 3 * time.Second}).Do(streamRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Body.Close()
	reader := bufio.NewReader(stream.Body)
	if !strings.Contains(readEvent(t, reader), "event: scans") {
		t.Fatal("missing initial event")
	}
	if w := request("POST", "/auth/logout", "", true, ""); w.Code != 204 {
		t.Fatal("logout failed")
	}
	scanner.Wake()
	if _, err := reader.ReadByte(); err != io.EOF {
		t.Fatal("revoked session retained its event stream", err)
	}
	pool.Close()
	if w := request("POST", "/console.v1.ConsoleService/GetCluster", "{}", true, ""); w.Code != 503 || len(w.Result().Cookies()) != 0 {
		t.Fatal("session storage outage should preserve the cookie and return unavailable")
	}
	if w := request("POST", "/auth/logout", "", true, ""); w.Code != 503 || len(w.Result().Cookies()) != 0 {
		t.Fatal("logout claimed success without revoking the stored session")
	}
}
