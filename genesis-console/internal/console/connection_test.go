package console

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type memoryConnections struct{ row *db.GetClusterConnectionRow }

func (m *memoryConnections) GetClusterConnection(context.Context) (db.GetClusterConnectionRow, error) {
	if m.row == nil {
		return db.GetClusterConnectionRow{}, pgx.ErrNoRows
	}
	return *m.row, nil
}
func (m *memoryConnections) SaveClusterConnection(_ context.Context, p db.SaveClusterConnectionParams) error {
	m.row = &db.GetClusterConnectionRow{Name: p.Name, Context: p.Context, Server: p.Server, Kubeconfig: p.Kubeconfig, UpdatedAt: pgtype.Timestamptz{Valid: true}}
	return nil
}
func (m *memoryConnections) DeleteClusterConnection(context.Context) error { m.row = nil; return nil }

func newTestConnections(t *testing.T, key []byte) (*Connections, *memoryConnections, *int) {
	t.Helper()
	t.Cleanup(func() { activeKubeconfig.Store(nil) })
	store, resets := &memoryConnections{}, 0
	c := NewConnections(store, key, t.TempDir(), func() { resets++ })
	c.probe = func(context.Context, string) ConnectionTest {
		return ConnectionTest{KubernetesVersion: "v1.34.0", GenesisVersion: "3.33.0"}
	}
	return c, store, &resets
}

func TestSaveActivatesAndResets(t *testing.T) {
	c, store, resets := newTestConnections(t, testKey(1))
	info, err := c.Save(context.Background(), ConnectionInput{Name: "prod-east", Kubeconfig: sampleKubeconfig, RewriteLoopback: true})
	if err != nil {
		t.Fatal(err)
	}
	if info.Name != "prod-east" || info.Source != "saved" || *resets != 1 {
		t.Fatalf("unexpected info %+v resets=%d", info, *resets)
	}
	if strings.Contains(string(store.row.Kubeconfig), "client-key-data") {
		t.Fatal("kubeconfig stored in plaintext")
	}
	path := kubeconfig()
	stat, err := os.Stat(path)
	if err != nil || stat.Mode().Perm() != 0o600 {
		t.Fatalf("active kubeconfig must be a 0600 file: %v %v", stat, err)
	}
	raw, _ := os.ReadFile(path)
	if !strings.Contains(string(raw), "host.docker.internal") {
		t.Fatal("rewrite not applied to the active file")
	}
	if _, err := c.Delete(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) || kubeconfig() == path || *resets != 2 {
		t.Fatal("disconnect must remove the file, fall back, and reset the snapshot")
	}
}

func TestSaveRequiresKeyAndValidName(t *testing.T) {
	c, _, _ := newTestConnections(t, nil)
	if _, err := c.Save(context.Background(), ConnectionInput{Name: "prod", Kubeconfig: sampleKubeconfig}); !errors.Is(err, errNoConnectionKey) {
		t.Fatalf("want errNoConnectionKey, got %v", err)
	}
	c, _, _ = newTestConnections(t, testKey(1))
	for _, name := range []string{"", "-lead", "has space", strings.Repeat("a", 64)} {
		var user kubeconfigError
		if _, err := c.Save(context.Background(), ConnectionInput{Name: name, Kubeconfig: sampleKubeconfig}); !errors.As(err, &user) {
			t.Fatalf("name %q accepted: %v", name, err)
		}
	}
}

func TestSaveRefusesFailedTest(t *testing.T) {
	c, store, _ := newTestConnections(t, testKey(1))
	c.probe = func(context.Context, string) ConnectionTest {
		return ConnectionTest{Error: "The API server is not reachable from the console."}
	}
	if _, err := c.Save(context.Background(), ConnectionInput{Name: "prod", Kubeconfig: sampleKubeconfig}); err == nil || store.row != nil {
		t.Fatal("a failing connection must not be saved")
	}
}

func TestLoadWithWrongKey(t *testing.T) {
	c, store, _ := newTestConnections(t, testKey(1))
	if _, err := c.Save(context.Background(), ConnectionInput{Name: "prod", Kubeconfig: sampleKubeconfig}); err != nil {
		t.Fatal(err)
	}
	c.Close()
	activeKubeconfig.Store(nil)
	for _, key := range [][]byte{testKey(2), nil} {
		restarted := NewConnections(store, key, t.TempDir(), func() {})
		restarted.Load(context.Background())
		info := restarted.Info()
		if info.Error == "" || info.Source == "saved" || activeKubeconfig.Load() != nil {
			t.Fatalf("key %v: must report and fall back, got %+v", key, info)
		}
	}
	restarted := NewConnections(store, testKey(1), t.TempDir(), func() {})
	restarted.Load(context.Background())
	if info := restarted.Info(); info.Source != "saved" || info.Name != "prod" {
		t.Fatalf("correct key must restore the connection: %+v", info)
	}
	restarted.Close()
}

func TestConnectionSourcePrecedence(t *testing.T) {
	t.Setenv("KUBECONFIG", "")
	t.Setenv("KUBERNETES_SERVICE_HOST", "")
	t.Setenv("HOME", t.TempDir())
	if got := environmentSource(); got != "none" {
		t.Fatalf("want none, got %s", got)
	}
	os.MkdirAll(filepath.Join(os.Getenv("HOME"), ".kube"), 0o700)
	os.WriteFile(filepath.Join(os.Getenv("HOME"), ".kube", "config"), []byte("x"), 0o600)
	if got := environmentSource(); got != "default" {
		t.Fatalf("want default, got %s", got)
	}
	t.Setenv("KUBERNETES_SERVICE_HOST", "10.0.0.1")
	if got := environmentSource(); got != "in-cluster" {
		t.Fatalf("want in-cluster, got %s", got)
	}
	t.Setenv("KUBECONFIG", "/run/kube/config")
	if got := environmentSource(); got != "environment" {
		t.Fatalf("want environment, got %s", got)
	}
}

func TestClusterFailureMessages(t *testing.T) {
	for stderr, want := range map[string]string{
		"error: You must be logged in to the server (Unauthorized)":                                        "rejected these credentials",
		`Error from server (Forbidden): users "x" is forbidden`:                                            "cannot read",
		"tls: failed to verify certificate: x509: certificate signed by unknown authority":                 "TLS verification failed",
		"dial tcp 127.0.0.1:6443: connect: connection refused":                                             "not reachable",
		"The connection to the server 0.0.0.0:58174 was refused - did you specify the right host or port?": "not reachable",
		"something else": "could not connect",
	} {
		if got := clusterFailure(stderr); !strings.Contains(got, want) {
			t.Fatalf("%q: want %q, got %q", stderr, want, got)
		}
	}
}

func TestConnectionDirIsPrivate(t *testing.T) {
	base := t.TempDir()
	t.Setenv("GENESIS_CONNECTION_DIR", base)
	first, err := ConnectionDir()
	if err != nil {
		t.Fatal(err)
	}
	second, _ := ConnectionDir()
	stat, err := os.Stat(first)
	if err != nil || filepath.Dir(first) != base || stat.Mode().Perm() != 0o700 || first == second {
		t.Fatalf("want a new 0700 directory under %s per process, got %s (%v) and %s", base, first, stat, second)
	}
}

func TestLoadKeepsInsecureWarning(t *testing.T) {
	c, store, _ := newTestConnections(t, testKey(1))
	insecure := strings.Replace(sampleKubeconfig, "certificate-authority-data: Q0E=", "insecure-skip-tls-verify: true", 1)
	if _, err := c.Save(context.Background(), ConnectionInput{Name: "prod", Kubeconfig: insecure}); err != nil {
		t.Fatal(err)
	}
	c.Close()
	restarted := NewConnections(store, testKey(1), t.TempDir(), func() {})
	restarted.Load(context.Background())
	defer restarted.Close()
	if info := restarted.Info(); len(info.Warnings) != 1 || !strings.Contains(info.Warnings[0], "TLS verification is off") {
		t.Fatalf("the insecure-TLS warning must survive a restart: %+v", info)
	}
}
