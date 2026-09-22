package httpserver

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5/pgtype"
)

const sessionCookie = "genesis_session"
const sessionLifetime = 12 * time.Hour

type loginAttempts struct {
	count int
	until time.Time
}

type authentication struct {
	required       bool
	user, password [32]byte
	mu             sync.Mutex
	sessions       *db.Queries
	attempts       map[string]loginAttempts
}

func newAuthentication(user, password string, sessions *db.Queries) *authentication {
	return &authentication{required: password != "", user: sha256.Sum256([]byte(user)), password: sha256.Sum256([]byte(password)), sessions: sessions, attempts: make(map[string]loginAttempts)}
}

// Bind opaque tokens to the configured credentials; changing either revokes access.
// Neither the bearer token nor a reusable password hash is stored in the database.
func (a *authentication) sessionHash(token string) []byte {
	mac := hmac.New(sha256.New, a.password[:])
	mac.Write(a.user[:])
	mac.Write([]byte(token))
	return mac.Sum(nil)
}

func (a *authentication) authenticated(r *http.Request) (bool, error) {
	if !a.required {
		return true, nil
	}
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || len(cookie.Value) != 43 {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	return a.sessions.ValidAuthSession(ctx, a.sessionHash(cookie.Value))
}

func (a *authentication) allowLogin(r *http.Request) bool {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	// Use the actual peer, not a client-supplied forwarding header.
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	for key, attempt := range a.attempts {
		if !now.Before(attempt.until) {
			delete(a.attempts, key)
		}
	}
	current, found := a.attempts[ip]
	if !found {
		if len(a.attempts) >= 1024 {
			return false
		}
		current.until = now.Add(time.Minute)
	}
	if current.count >= 10 {
		return false
	}
	current.count++
	a.attempts[ip] = current
	return true
}

func writeSessionCookie(w http.ResponseWriter, r *http.Request, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: value, Path: "/", HttpOnly: true, Secure: r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https", SameSite: http.SameSiteStrictMode, MaxAge: maxAge})
}

func (a *authentication) register(mux *http.ServeMux) {
	mux.HandleFunc("GET /auth/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		authenticated, err := a.authenticated(r)
		if err != nil {
			http.Error(w, "Session check is unavailable. Try again.", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"required": a.required, "authenticated": authenticated})
	})
	mux.HandleFunc("POST /auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if !a.allowLogin(r) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "Too many attempts. Wait a minute, then try again.", http.StatusTooManyRequests)
			return
		}
		var credentials struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 8192)
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") || json.NewDecoder(r.Body).Decode(&credentials) != nil {
			http.Error(w, "Enter your username and password.", http.StatusBadRequest)
			return
		}
		u, p := sha256.Sum256([]byte(credentials.Username)), sha256.Sum256([]byte(credentials.Password))
		if a.required && subtle.ConstantTimeCompare(u[:], a.user[:])&subtle.ConstantTimeCompare(p[:], a.password[:]) != 1 {
			http.Error(w, "Username or password is incorrect. Try again.", http.StatusUnauthorized)
			return
		}
		raw := make([]byte, 32)
		if _, err := rand.Read(raw); err != nil {
			http.Error(w, "Sign-in is unavailable. Try again.", http.StatusInternalServerError)
			return
		}
		token := base64.RawURLEncoding.EncodeToString(raw)
		var oldHash []byte
		if old, err := r.Cookie(sessionCookie); err == nil && len(old.Value) == 43 {
			oldHash = a.sessionHash(old.Value)
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := a.sessions.CreateAuthSession(ctx, db.CreateAuthSessionParams{
			TokenHash: a.sessionHash(token), OldHash: oldHash,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(sessionLifetime), Valid: true},
		}); err != nil {
			http.Error(w, "Sign-in is unavailable. Try again.", http.StatusServiceUnavailable)
			return
		}
		writeSessionCookie(w, r, token, int(sessionLifetime.Seconds()))
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("POST /auth/logout", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if cookie, err := r.Cookie(sessionCookie); err == nil && len(cookie.Value) == 43 {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := a.sessions.DeleteAuthSession(ctx, a.sessionHash(cookie.Value)); err != nil {
				http.Error(w, "Sign-out is unavailable. Try again.", http.StatusServiceUnavailable)
				return
			}
		}
		writeSessionCookie(w, r, "", -1)
		w.WriteHeader(http.StatusNoContent)
	})
}
