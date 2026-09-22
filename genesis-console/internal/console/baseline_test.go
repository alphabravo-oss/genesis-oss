package console

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRecordedBaselines(t *testing.T) {
	directory := os.Getenv("CONSOLE_TEST_BASELINES")
	if directory == "" {
		t.Skip("set CONSOLE_TEST_BASELINES to check archived releases")
	}
	t.Setenv("GENESIS_BASELINE_DIR", directory)
	var manifest baselineManifest
	root := baselineRoot("3.33.0", "")
	raw, err := os.ReadFile(filepath.Join(root, "baseline.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	profile := "argocd"
	snapshot := &clusterSnapshot{metadata: object{"version": "3.33.0", "status": "deployed"}, values: object{"genesisProvenance": object{"schemaVersion": 1, "tag": "3.33.0", "baselineSha256": manifest.SHA256, "profiles": []any{profile}, "profileSha256": object{profile: manifest.Files["profiles/"+profile+".yaml"]}}}}
	service := &Service{}
	b, profiles, provenance := service.inspectionBaseline(context.Background(), snapshot, "3.33.0", nil, true)
	if b.err != "" || provenance.Status != "Verified" || len(profiles) != 1 || !b.flags["argocd"] {
		t.Fatalf("recorded profile not selected: %s %v %v", b.err, profiles, provenance)
	}
	_, profiles, _ = service.inspectionBaseline(context.Background(), snapshot, "3.33.0", nil, false)
	if len(profiles) != 0 {
		t.Fatal("manual standard profile selection overwritten")
	}
	for _, tag := range []string{"3.28.0", "3.29.0", "3.30.0", "3.31.0", "3.31.1", "3.32.0"} {
		b := service.baseline(context.Background(), tag, nil)
		if b.err != "" || b.manifest == nil || b.manifest.Tag != tag || len(b.releases) == 0 {
			t.Fatalf("historical baseline %s failed: %s", tag, b.err)
		}
	}
	obj(at(snapshot.values, "genesisProvenance", "profileSha256"))[profile] = "wrong"
	b, _, provenance = service.inspectionBaseline(context.Background(), snapshot, "3.33.0", nil, true)
	if b.err == "" || provenance.Status != "Mismatch" {
		t.Fatal("profile checksum mismatch accepted")
	}
}

func TestBaselineIntegrity(t *testing.T) {
	source := os.Getenv("CONSOLE_TEST_BASELINES")
	if source == "" {
		t.Skip("set CONSOLE_TEST_BASELINES for integrity checks")
	}
	t.Setenv("GENESIS_BASELINE_DIR", source)
	root := baselineRoot("3.33.0", "")
	manifest, err := verifyBaseline(root, "3.33.0")
	if err != nil || manifest == nil {
		t.Fatal(err)
	}
	dest := t.TempDir()
	for name := range manifest.Files {
		raw, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatal(err)
		}
		target := filepath.Join(dest, name)
		if err = os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(target, raw, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	raw, _ := json.Marshal(manifest)
	os.WriteFile(filepath.Join(dest, "baseline.json"), raw, 0o644)
	if _, err := verifyBaseline(dest, "3.33.0"); err != nil {
		t.Fatal(err)
	}
	extra := filepath.Join(dest, "umbrella/templates/unrecorded.yaml")
	if err := os.WriteFile(extra, []byte("kind: ConfigMap"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyBaseline(dest, "3.33.0"); err == nil {
		t.Fatal("extra template accepted")
	}
	if err := os.Remove(extra); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(dest, "profiles/argocd.yaml"), []byte("changed"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyBaseline(dest, "3.33.0"); err == nil {
		t.Fatal("modified baseline accepted")
	}
}

func TestLiveInspection(t *testing.T) {
	if os.Getenv("CONSOLE_TEST_LIVE") != "1" {
		t.Skip("opt-in read-only live cluster check")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	svc := &Service{}
	out := svc.Inspect(ctx, "3.33.0", nil, true)
	if !out.Connected || out.Tag == "" || len(out.Releases) == 0 || len(out.Images) == 0 {
		t.Fatalf("live observation failed: connected=%t tag=%s releases=%d images=%d error=%s", out.Connected, out.Tag, len(out.Releases), len(out.Images), out.Error)
	}
	t.Logf("installed=%s context=%s releases=%d containers=%d services=%d provenance=%s", out.Tag, out.Context, len(out.Releases), len(out.Images), len(out.Services), out.Provenance.Status)
	for _, check := range out.Checks {
		t.Logf("%s: %t", check.Name, check.Checked)
	}
}
