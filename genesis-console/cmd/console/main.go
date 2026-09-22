package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	consolev1connect "github.com/alphabravo/genesis-console/gen/console/v1/consolev1connect"
	"github.com/alphabravo/genesis-console/internal/console"
	"github.com/alphabravo/genesis-console/internal/httpserver"
	"github.com/alphabravo/genesis-console/internal/server/database"
	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		client := &http.Client{Timeout: 3 * time.Second}
		response, err := client.Get("http://127.0.0.1:" + env("PORT", "8080") + "/readyz")
		if err != nil {
			os.Exit(1)
		}
		defer response.Body.Close()
		io.Copy(io.Discard, response.Body)
		if response.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	dsn := strings.TrimSpace(env("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:54329/genesis_console?sslmode=disable"))
	if file := os.Getenv("DATABASE_URL_FILE"); file != "" {
		raw, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("read database URL: %w", err)
		}
		dsn = strings.TrimSpace(string(raw))
	}
	addr := env("ADDR", "127.0.0.1:"+env("PORT", "8080"))
	password := strings.TrimSpace(os.Getenv("GENESIS_AUTH_PASSWORD"))
	if file := os.Getenv("GENESIS_AUTH_PASSWORD_FILE"); file != "" {
		raw, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("read console password: %w", err)
		}
		password = strings.TrimSpace(string(raw))
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return err
	}
	if password == "" && host != "localhost" && (net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback()) {
		return fmt.Errorf("non-loopback ADDR requires GENESIS_AUTH_PASSWORD_FILE or GENESIS_AUTH_PASSWORD")
	}
	uiRoot := env("GENESIS_WEB_DIR", "web/dist")
	if _, err := os.Stat(filepath.Join(uiRoot, "index.html")); err != nil {
		return fmt.Errorf("build the UI first (pnpm --dir web build): %w", err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		return err
	}

	store := console.NewStore(pool)
	cacheDir := env("GENESIS_TRIVY_CACHE", defaultCacheDir())
	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return err
	}
	scanner := console.NewScanner(store, cacheDir)
	if err := scanner.Interrupt(ctx); err != nil {
		return err
	}
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); scanner.Loop(ctx) }()
	defer func() { stop(); <-workerDone }()
	svc := console.NewService(store, scanner)
	loaded, err := svc.Reload(ctx)
	if err != nil {
		return err
	}
	log.Printf("loaded %d catalog releases", loaded)

	path, handler := consolev1connect.NewConsoleServiceHandler(console.NewHandler(svc))
	mux := httpserver.Handler(path, handler, os.DirFS(uiRoot), pool.Ping, env("GENESIS_AUTH_USERNAME", "admin"), password, db.New(pool), scanner.Changes)

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		BaseContext:       func(net.Listener) context.Context { return ctx },
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			server.Close()
		}
	}()
	log.Printf("genesis console listening on %s", addr)
	return server.ListenAndServe()
}

func defaultCacheDir() string {
	base, err := os.UserCacheDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "genesis-console", "trivy")
	}
	return filepath.Join(base, "genesis-console", "trivy")
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
