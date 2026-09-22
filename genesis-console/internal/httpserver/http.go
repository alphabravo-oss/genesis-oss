// Package httpserver serves the packaged console and its same-origin API.
package httpserver

import (
	"context"
	"io/fs"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/alphabravo/genesis-console/internal/server/database/db"
)

func Handler(apiPath string, api http.Handler, assets fs.FS, ping func(context.Context) error, user, password string, sessions *db.Queries, scanChanges func() <-chan struct{}) http.Handler {
	mux := http.NewServeMux()
	auth := newAuthentication(user, password, sessions)
	auth.register(mux)
	mux.HandleFunc("GET /events/scans", auth.scanEvents(scanChanges))
	mux.Handle("GET /sbom/{id}/{format}", sbomDownload(sessions))
	mux.Handle(apiPath, http.TimeoutHandler(api, 30*time.Second, "request timed out"))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok\n")) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := ping(ctx); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte("ready\n"))
	})
	files := http.FileServer(http.FS(assets))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if info, err := fs.Stat(assets, name); err != nil || info.IsDir() {
			if path.Ext(name) != "" || strings.HasPrefix(name, "assets/") || !strings.Contains(r.Header.Get("Accept"), "text/html") {
				http.NotFound(w, r)
				return
			}
			// Browser history routes get the shell; missing assets and RPCs stay 404.
			name = "index.html"
		}
		if name == "index.html" {
			w.Header().Set("Cache-Control", "no-cache")
			body, err := fs.ReadFile(assets, name)
			if err != nil {
				http.Error(w, "UI is not built", http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(body)
			return
		}
		if strings.HasPrefix(name, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Genesis-Console", "1")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				http.Error(w, "cross-origin request denied", http.StatusForbidden)
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" {
				parsed, err := url.Parse(origin)
				if err != nil || parsed.Host != r.Host || (parsed.Scheme != "http" && parsed.Scheme != "https") {
					http.Error(w, "cross-origin request denied", http.StatusForbidden)
					return
				}
			}
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		}
		public := r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/login" || strings.HasPrefix(r.URL.Path, "/auth/") || strings.HasPrefix(r.URL.Path, "/assets/") || strings.HasPrefix(r.URL.Path, "/fonts/") || r.URL.Path == "/logo.svg" || r.URL.Path == "/favicon.svg"
		if !public {
			authenticated, err := auth.authenticated(r)
			if err != nil {
				w.Header().Set("Cache-Control", "no-store")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"code":"unavailable","message":"Session check is unavailable. Try again."}`))
				return
			}
			if !authenticated {
				w.Header().Set("Cache-Control", "no-store")
				if (r.Method == http.MethodGet || r.Method == http.MethodHead) && strings.Contains(r.Header.Get("Accept"), "text/html") && !strings.HasPrefix(r.URL.Path, apiPath) {
					http.Redirect(w, r, "/login?returnTo="+url.QueryEscape(r.URL.RequestURI()), http.StatusFound)
				} else {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnauthorized)
					w.Write([]byte(`{"code":"unauthenticated","message":"Sign in to continue."}`))
				}
				return
			}
		}
		if strings.HasPrefix(r.URL.Path, apiPath) {
			w.Header().Set("Cache-Control", "no-store")
		}
		mux.ServeHTTP(w, r)
	})
}
