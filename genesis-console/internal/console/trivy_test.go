package console

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"github.com/alphabravo/genesis-console/internal/server/database/db"
)

func TestContainerScan(t *testing.T) {
	dir := t.TempDir()
	script := `#!/bin/sh
set -eu
case "$*" in *--skip-db-update*) exit 1 ;; esac
case "$*" in *'--image-src remote'*) ;; *) exit 2 ;; esac
case "$*" in *'--severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL'*) ;; *) exit 3 ;; esac
test -d "$TMPDIR"
touch "$TMPDIR/layer"
printf '%s' '{"Metadata":{"RepoDigests":["example@sha256:abcdef"]}}'
`
	if err := os.WriteFile(filepath.Join(dir, "trivy"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	if _, err := scanRef(context.Background(), dir, "example:latest"); err != nil {
		t.Fatal(err)
	}
	leftovers, err := filepath.Glob(filepath.Join(dir, "scan-*"))
	if err != nil || len(leftovers) != 0 {
		t.Fatal("scan scratch directory was not cleaned")
	}
}

func TestParseReport(t *testing.T) {
	raw := []byte(`{
	  "Metadata": {"RepoDigests": ["docker.io/library/busybox@sha256:abcdef1234567890"], "ImageID": "sha256:ffff"},
	  "Results": [{
	    "Vulnerabilities": [
	      {"VulnerabilityID": "CVE-2", "Severity": "HIGH", "PkgName": "busybox", "InstalledVersion": "1.28", "FixedVersion": "1.36", "Title": "overflow", "PrimaryURL": "https://nvd.nist.gov/vuln/detail/CVE-2"},
	      {"VulnerabilityID": "CVE-1", "Severity": "MEDIUM", "PkgName": "libc", "InstalledVersion": "1"},
	      {"VulnerabilityID": "CVE-1", "Severity": "CRITICAL", "PkgName": "libc", "InstalledVersion": "1", "Title": "crash"},
	      {"VulnerabilityID": "CVE-2", "Severity": "HIGH", "PkgName": "ssl", "InstalledVersion": "2", "FixedVersion": "3", "Title": "overflow"},
	      {"VulnerabilityID": "CVE-2", "Severity": "HIGH", "PkgName": "ssl", "InstalledVersion": "2"},
	      {"VulnerabilityID": "CVE-9", "Severity": "LOW"},
	      {"VulnerabilityID": "CVE-8", "Severity": "MEDIUM"},
	      {"VulnerabilityID": "CVE-0", "Severity": "UNKNOWN"},
	      {"VulnerabilityID": "CVE-10"},
	      {"Severity": "LOW"}
	    ]
	  }]
	}`)
	report, err := parseReport(raw)
	if err != nil {
		t.Fatal(err)
	}
	if report.Digest != "docker.io/library/busybox@sha256:abcdef1234567890" {
		t.Fatalf("digest %s", report.Digest)
	}
	if report.Critical != 1 || report.High != 1 {
		t.Fatalf("counts %d %d", report.Critical, report.High)
	}
	if !reflect.DeepEqual(report.CVEs, []string{"CVE-0", "CVE-1", "CVE-10", "CVE-2", "CVE-8", "CVE-9"}) {
		t.Fatalf("cves %#v", report.CVEs)
	}
	if len(report.Findings) != 7 {
		t.Fatalf("findings %#v", report.Findings)
	}
	if report.Findings[0].ID != "CVE-1" || report.Findings[0].URL != "https://nvd.nist.gov/vuln/detail/CVE-1" {
		t.Fatalf("first finding %#v", report.Findings[0])
	}
	if report.Findings[1].Pkg != "busybox" || report.Findings[1].Fixed != "1.36" {
		t.Fatalf("package finding %#v", report.Findings[1])
	}
	var severities []string
	for _, item := range report.Findings {
		severities = append(severities, item.Severity)
	}
	if !reflect.DeepEqual(severities, []string{"CRITICAL", "HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN", "UNKNOWN"}) {
		t.Fatalf("severity order %v", severities)
	}
}

func TestSavedSeverityCoverage(t *testing.T) {
	for _, findings := range [][]finding{{}, {{ID: "CVE-low", Severity: "LOW"}}} {
		payload, err := json.Marshal(savedFindings{AllSeverities: true, Findings: findings})
		if err != nil {
			t.Fatal(err)
		}
		image := &consolev1.ImageRow{}
		applyFinding(image, db.LatestFindingsRow{Cves: string(payload)})
		if !image.AllSeverities || !image.Scanned || len(image.Vulnerabilities) != len(findings) {
			t.Fatalf("coverage or findings lost: %v", image)
		}
	}
	for _, raw := range []string{`[{"id":"CVE-old","severity":"HIGH"}]`, `["CVE-old"]`, `[]`} {
		findings, all := decodeFindings(raw)
		if all || (raw != `[]` && (len(findings) != 1 || findings[0].ID != "CVE-old")) {
			t.Fatalf("legacy scan coverage: %v %v", findings, all)
		}
	}
}

func TestParseReportCleanImage(t *testing.T) {
	report, err := parseReport([]byte(`{"Metadata":{"ImageID":"sha256:abc123"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if report.Critical != 0 || report.High != 0 || len(report.CVEs) != 0 {
		t.Fatalf("%#v", report)
	}
}

func TestDigestHit(t *testing.T) {
	full := "docker.io/library/busybox@sha256:abcdef1234567890"
	if !digestHit("abcdef123456", full) {
		t.Fatal("short catalog digest should match the repo digest")
	}
	if digestHit("ffffff123456", full) {
		t.Fatal("different digest matched")
	}
}
