package console

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5"
)

// One saved cluster connection (OSS). It is stored encrypted and, while
// active, decrypted to a private file that every kubectl/helm call uses.

var connectionName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`)

var errNoConnectionKey = errors.New("Saving connections needs a connection key. Set GENESIS_CONNECTION_KEY_FILE (Docker Compose generates one) or add connection-key to the chart's credentials Secret, then restart.")

type connectionStore interface {
	GetClusterConnection(context.Context) (db.GetClusterConnectionRow, error)
	SaveClusterConnection(context.Context, db.SaveClusterConnectionParams) error
	DeleteClusterConnection(context.Context) error
}

type ConnectionInput struct {
	Name, Kubeconfig, Context string
	RewriteLoopback           bool
}

type ConnectionInfo struct {
	Name, Source, Server, Context string
	SavedAt                       time.Time
	SavingEnabled                 bool
	Warnings                      []string
	Error                         string
}

type ConnectionTest struct {
	Contexts                                   []string
	Context, Server                            string
	Loopback                                   bool
	KubernetesVersion, Release, GenesisVersion string
	Warnings                                   []string
	Error                                      string
}

type Connections struct {
	mu       sync.Mutex
	store    connectionStore
	key      []byte
	dir      string
	onChange func()
	saved    *ConnectionInfo
	loadErr  string
	// probe checks a candidate kubeconfig file; tests replace it.
	probe func(ctx context.Context, path string) ConnectionTest
}

func NewConnections(store connectionStore, key []byte, dir string, onChange func()) *Connections {
	return &Connections{store: store, key: key, dir: dir, onChange: onChange, probe: probeCluster}
}

// ConnectionDir makes a private (0700) per-process directory for the decrypted
// kubeconfig, under GENESIS_CONNECTION_DIR (memory-backed in the chart) or the temp directory.
func ConnectionDir() (string, error) {
	base := os.Getenv("GENESIS_CONNECTION_DIR")
	if base == "" {
		base = os.TempDir()
	}
	return os.MkdirTemp(base, "genesis-connection-")
}

func associated(name string) []byte { return []byte("cluster_connection/1/" + name) }
func (c *Connections) activePath() string {
	return filepath.Join(c.dir, "genesis-connection.kubeconfig")
}

// Load restores the saved connection at startup. Failures are reported through
// Info and the console falls back to the next source; startup continues.
func (c *Connections) Load(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
	row, err := c.store.GetClusterConnection(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return
	}
	if err != nil {
		c.loadErr = "The saved connection could not be read from the database."
		return
	}
	if c.key == nil {
		c.loadErr = fmt.Sprintf("A saved connection (%s) exists, but no connection key is configured. Restore the key or reconnect.", row.Name)
		return
	}
	plain, err := open(c.key, row.Kubeconfig, associated(row.Name))
	if err != nil {
		c.loadErr = fmt.Sprintf("The saved connection (%s) could not be decrypted with the configured key. Reconnect to replace it.", row.Name)
		return
	}
	if err := c.activate(plain); err != nil {
		c.loadErr = "The saved connection could not be activated: " + err.Error()
		return
	}
	c.saved = &ConnectionInfo{Name: row.Name, Context: row.Context, Server: row.Server, SavedAt: row.UpdatedAt.Time}
	// Warnings are derived, not stored: re-read them from the saved kubeconfig.
	if prepared, err := prepareKubeconfig(plain, row.Context, false); err == nil {
		c.saved.Warnings = prepared.Warnings
	}
}

// activate writes the kubeconfig atomically with mode 0600 and switches to it.
func (c *Connections) activate(kubeconfig []byte) error {
	staged, err := c.stage(kubeconfig)
	if err != nil {
		return err
	}
	return c.commit(staged)
}

// stage writes a 0600 file next to the active one; commit renames it into place.
// Splitting them lets Save write the database only once the file exists.
func (c *Connections) stage(kubeconfig []byte) (string, error) {
	file, err := os.CreateTemp(c.dir, "kubeconfig-*")
	if err != nil {
		return "", err
	}
	if _, err := file.Write(kubeconfig); err != nil {
		file.Close()
		os.Remove(file.Name())
		return "", err
	}
	if err := file.Close(); err != nil {
		os.Remove(file.Name())
		return "", err
	}
	return file.Name(), nil
}

func (c *Connections) commit(staged string) error {
	path := c.activePath()
	if err := os.Rename(staged, path); err != nil {
		os.Remove(staged)
		return err
	}
	activeKubeconfig.Store(&path)
	c.onChange()
	return nil
}

func (c *Connections) Info() ConnectionInfo {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.saved != nil {
		info := *c.saved
		info.Source, info.SavingEnabled = "saved", c.key != nil
		return info
	}
	return ConnectionInfo{Source: environmentSource(), SavingEnabled: c.key != nil, Error: c.loadErr}
}

// environmentSource names where kubectl finds a cluster when nothing is saved.
func environmentSource() string {
	if os.Getenv("KUBECONFIG") != "" {
		return "environment"
	}
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return "in-cluster"
	}
	for _, name := range []string{"genesis-k3d.yaml", "config"} {
		if _, err := os.Stat(filepath.Join(os.Getenv("HOME"), ".kube", name)); err == nil {
			return "default"
		}
	}
	return "none"
}

func (c *Connections) Test(ctx context.Context, in ConnectionInput) (ConnectionTest, error) {
	prepared, err := prepareKubeconfig([]byte(in.Kubeconfig), in.Context, in.RewriteLoopback)
	if err != nil {
		return ConnectionTest{}, err
	}
	file, err := os.CreateTemp(c.dir, "kubeconfig-test-*")
	if err != nil {
		return ConnectionTest{}, err
	}
	defer os.Remove(file.Name())
	_, err = file.Write(prepared.Rendered)
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return ConnectionTest{}, err
	}
	result := c.probe(ctx, file.Name())
	result.Contexts, result.Context, result.Server, result.Loopback = prepared.Contexts, prepared.Context, prepared.Server, prepared.Loopback
	result.Warnings = append(prepared.Warnings, result.Warnings...)
	return result, nil
}

func (c *Connections) Save(ctx context.Context, in ConnectionInput) (ConnectionInfo, error) {
	if c.key == nil {
		return ConnectionInfo{}, errNoConnectionKey
	}
	in.Name = strings.TrimSpace(in.Name)
	if !connectionName.MatchString(in.Name) {
		return ConnectionInfo{}, kubeconfigError("Name the connection with 1–63 letters, digits, dots, dashes, or underscores, starting with a letter or digit.")
	}
	test, err := c.Test(ctx, in)
	if err != nil {
		return ConnectionInfo{}, err
	}
	if test.Error != "" {
		return ConnectionInfo{}, kubeconfigError(test.Error)
	}
	prepared, err := prepareKubeconfig([]byte(in.Kubeconfig), in.Context, in.RewriteLoopback)
	if err != nil {
		return ConnectionInfo{}, err
	}
	sealed, err := seal(c.key, prepared.Rendered, associated(in.Name))
	if err != nil {
		return ConnectionInfo{}, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	staged, err := c.stage(prepared.Rendered)
	if err != nil {
		return ConnectionInfo{}, err
	}
	if err := c.store.SaveClusterConnection(ctx, db.SaveClusterConnectionParams{Name: in.Name, Context: prepared.Context, Server: prepared.Server, Kubeconfig: sealed}); err != nil {
		os.Remove(staged)
		return ConnectionInfo{}, err
	}
	if err := c.commit(staged); err != nil {
		return ConnectionInfo{}, err
	}
	c.saved, c.loadErr = &ConnectionInfo{Name: in.Name, Context: prepared.Context, Server: prepared.Server, SavedAt: time.Now(), Warnings: prepared.Warnings}, ""
	info := *c.saved
	info.Source, info.SavingEnabled = "saved", true
	return info, nil
}

func (c *Connections) Delete(ctx context.Context) (ConnectionInfo, error) {
	c.mu.Lock()
	if err := c.store.DeleteClusterConnection(ctx); err != nil {
		c.mu.Unlock()
		return ConnectionInfo{}, err
	}
	c.saved, c.loadErr = nil, ""
	c.removeActive()
	c.mu.Unlock()
	c.onChange()
	return c.Info(), nil
}

func (c *Connections) removeActive() {
	activeKubeconfig.Store(nil)
	os.Remove(c.activePath())
}

// Close removes the decrypted file on shutdown.
func (c *Connections) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.saved != nil {
		c.removeActive()
	}
}

// probeCluster confirms the API server answers and looks for the Genesis release.
func probeCluster(ctx context.Context, path string) ConnectionTest {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	out := ConnectionTest{Release: clusterNamespace() + "/" + clusterRelease()}
	raw, err := clusterCommandWith(ctx, path, "kubectl", "version", "-o", "json")
	var version struct {
		Server struct {
			GitVersion string `json:"gitVersion"`
		} `json:"serverVersion"`
	}
	if err != nil || json.Unmarshal(raw, &version) != nil || version.Server.GitVersion == "" {
		var exit *exec.ExitError
		stderr := ""
		if errors.As(err, &exit) {
			stderr = string(exit.Stderr)
		} else if ctx.Err() != nil {
			stderr = "i/o timeout"
		}
		out.Error = clusterFailure(stderr)
		return out
	}
	out.KubernetesVersion = version.Server.GitVersion
	raw, err = clusterCommandWith(ctx, path, "helm", "get", "metadata", clusterRelease(), "-n", clusterNamespace(), "-o", "json")
	var metadata object
	if err == nil && json.Unmarshal(raw, &metadata) == nil {
		out.GenesisVersion = str(metadata["version"])
	}
	if out.GenesisVersion == "" {
		out.Warnings = append(out.Warnings, fmt.Sprintf("Connected, but no Genesis release %s was found (or it cannot be read). The console will show it once Genesis is installed.", out.Release))
	}
	return out
}

func clusterFailure(stderr string) string {
	text := strings.ToLower(stderr)
	switch {
	case strings.Contains(text, "unauthorized") || strings.Contains(text, "must be logged in"):
		return "The cluster rejected these credentials. Check that the token or certificate is current."
	case strings.Contains(text, "forbidden"):
		return "Connected, but this account cannot read the cluster version. Use an account with the console's read-only role."
	case strings.Contains(text, "x509") || strings.Contains(text, "certificate"):
		return "TLS verification failed. Check the cluster's certificate authority, or the server name if the address was rewritten."
	case strings.Contains(text, "refused") || strings.Contains(text, "no such host") || strings.Contains(text, "i/o timeout") || strings.Contains(text, "dial tcp") || strings.Contains(text, "network is unreachable"):
		return "The API server is not reachable from the console. Check the address, firewall, and VPN; for a cluster on this machine, use the host.docker.internal option."
	default:
		return "The console could not connect to the API server."
	}
}
