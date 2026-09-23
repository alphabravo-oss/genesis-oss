package console

import (
	"bytes"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func testKey(fill byte) []byte { return bytes.Repeat([]byte{fill}, 32) }

func TestSealOpen(t *testing.T) {
	sealed, err := seal(testKey(1), []byte("secret"), []byte("cluster_connection/1/prod"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("secret")) {
		t.Fatal("plaintext visible in ciphertext")
	}
	plain, err := open(testKey(1), sealed, []byte("cluster_connection/1/prod"))
	if err != nil || string(plain) != "secret" {
		t.Fatalf("round trip failed: %q %v", plain, err)
	}
	if _, err := open(testKey(2), sealed, []byte("cluster_connection/1/prod")); err == nil {
		t.Fatal("wrong key accepted")
	}
	if _, err := open(testKey(1), sealed, []byte("cluster_connection/1/other")); err == nil {
		t.Fatal("ciphertext moved to another name was accepted")
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := open(testKey(1), sealed, []byte("cluster_connection/1/prod")); err == nil {
		t.Fatal("tampered ciphertext accepted")
	}
	if _, err := open(testKey(1), []byte("short"), nil); err == nil {
		t.Fatal("truncated ciphertext accepted")
	}
}

func TestLoadConnectionKey(t *testing.T) {
	t.Setenv("GENESIS_CONNECTION_KEY_FILE", "")
	t.Setenv("GENESIS_CONNECTION_KEY", "")
	if key, err := LoadConnectionKey(); key != nil || err != nil {
		t.Fatalf("unset key must disable saving: %v %v", key, err)
	}
	t.Setenv("GENESIS_CONNECTION_KEY", base64.StdEncoding.EncodeToString(testKey(3)))
	if key, err := LoadConnectionKey(); err != nil || !bytes.Equal(key, testKey(3)) {
		t.Fatalf("env key: %v %v", key, err)
	}
	file := filepath.Join(t.TempDir(), "key")
	os.WriteFile(file, []byte(base64.StdEncoding.EncodeToString(testKey(4))+"\n"), 0o600)
	t.Setenv("GENESIS_CONNECTION_KEY_FILE", file)
	if key, err := LoadConnectionKey(); err != nil || !bytes.Equal(key, testKey(4)) {
		t.Fatalf("file key must win: %v %v", key, err)
	}
	t.Setenv("GENESIS_CONNECTION_KEY_FILE", "")
	t.Setenv("GENESIS_CONNECTION_KEY", base64.StdEncoding.EncodeToString([]byte("too short")))
	if _, err := LoadConnectionKey(); err == nil {
		t.Fatal("short key accepted")
	}
}

func TestLoadConnectionKeyHidesItFromChildProcesses(t *testing.T) {
	t.Setenv("GENESIS_CONNECTION_KEY_FILE", "")
	t.Setenv("GENESIS_CONNECTION_KEY", base64.StdEncoding.EncodeToString(testKey(5)))
	if key, err := LoadConnectionKey(); err != nil || !bytes.Equal(key, testKey(5)) {
		t.Fatalf("key not loaded: %v", err)
	}
	if _, set := os.LookupEnv("GENESIS_CONNECTION_KEY"); set {
		t.Fatal("kubectl, helm, and trivy inherit the environment; the key must be removed after loading")
	}
}
