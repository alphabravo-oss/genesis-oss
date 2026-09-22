package httpserver

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/alphabravo/genesis-console/internal/server/database"
	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func testDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("CONSOLE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set CONSOLE_TEST_DATABASE_URL to test persistent sessions against PostgreSQL")
	}
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.ConnectTimeout = 5 * time.Second
	schema := pgx.Identifier{"auth_test_" + strings.ToLower(rand.Text())}.Sanitize()
	admin, err := pgxpool.NewWithConfig(ctx, config.Copy())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	return pool
}

func TestSessions(t *testing.T) {
	pool := testDatabase(t)
	a := newAuthentication("admin", "secret", db.New(pool))
	mux := http.NewServeMux()
	a.register(mux)
	request := func(path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "https://console.test"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Header().Get("WWW-Authenticate") != "" {
			t.Fatal("browser authentication prompt returned")
		}
		return w
	}
	valid := func(cookie *http.Cookie) bool {
		r := httptest.NewRequest("GET", "/", nil)
		r.AddCookie(cookie)
		ok, err := a.authenticated(r)
		if err != nil {
			t.Fatal(err)
		}
		return ok
	}
	if w := request("/auth/login", `{"username":"admin","password":"wrong"}`, nil); w.Code != 401 || len(w.Result().Cookies()) != 0 {
		t.Fatal("invalid credentials accepted")
	}
	w := request("/auth/login", `{"username":"admin","password":"secret"}`, nil)
	if w.Code != 204 || len(w.Result().Cookies()) != 1 {
		t.Fatal("valid login failed")
	}
	cookie := w.Result().Cookies()[0]
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteStrictMode || cookie.MaxAge != 43200 || !valid(cookie) {
		t.Fatal("invalid session cookie")
	}
	// A new backend instance shares only the database, not process memory.
	a = newAuthentication("admin", "secret", db.New(pool))
	mux = http.NewServeMux()
	a.register(mux)
	if !valid(cookie) {
		t.Fatal("restart lost the session")
	}
	for _, credentials := range [][2]string{{"admin", "changed"}, {"changed", "secret"}} {
		r := httptest.NewRequest("GET", "/", nil)
		r.AddCookie(cookie)
		if ok, err := newAuthentication(credentials[0], credentials[1], db.New(pool)).authenticated(r); err != nil || ok {
			t.Fatal("credential change did not revoke access", err)
		}
	}
	tampered := *cookie
	tampered.Value = strings.Repeat("x", 43)
	if valid(&tampered) {
		t.Fatal("forged session accepted")
	}
	w = request("/auth/logout", "", cookie)
	if w.Code != 204 || w.Result().Cookies()[0].MaxAge != -1 || valid(cookie) {
		t.Fatal("logout did not revoke the session")
	}
	a = newAuthentication("admin", "secret", db.New(pool))
	if valid(cookie) {
		t.Fatal("restart resurrected a revoked session")
	}
	w = request("/auth/login", `{"username":"admin","password":"secret"}`, cookie)
	cookie = w.Result().Cookies()[0]
	w = request("/auth/login", `{"username":"admin","password":"secret"}`, cookie)
	if valid(cookie) {
		t.Fatal("login did not rotate the previous session")
	}
	cookie = w.Result().Cookies()[0]
	if _, err := pool.Exec(context.Background(), "UPDATE auth_sessions SET expires_at = now() - interval '1 second'"); err != nil {
		t.Fatal(err)
	}
	if valid(cookie) {
		t.Fatal("expired session accepted")
	}
	for i := 0; i < 10; i++ {
		w = request("/auth/login", `{"username":"admin","password":"wrong"}`, nil)
	}
	if w.Code != 429 || w.Header().Get("Retry-After") == "" {
		t.Fatal("login attempts were not limited")
	}
}
