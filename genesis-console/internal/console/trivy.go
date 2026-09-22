package console

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type finding struct {
	ID        string `json:"id"`
	Severity  string `json:"severity"`
	Pkg       string `json:"pkg"`
	Installed string `json:"installed"`
	Fixed     string `json:"fixed"`
	Title     string `json:"title"`
	URL       string `json:"url"`
}

type scanReport struct {
	Digest    string
	Critical  int32
	High      int32
	CVEs      []string
	Findings  []finding
	CycloneDX []byte
	SPDX      []byte
	SBOMError string
}

type savedFindings struct {
	AllSeverities bool      `json:"allSeverities"`
	Findings      []finding `json:"findings"`
}

func trivyPath() (string, error) {
	path, err := exec.LookPath("trivy")
	if err != nil {
		return "", errors.New("trivy is not installed")
	}
	return path, nil
}

func scanRef(ctx context.Context, cacheDir, ref string) (scanReport, error) {
	bin, err := trivyPath()
	if err != nil {
		return scanReport{}, err
	}
	args := []string{
		"--quiet",
		"--cache-dir", cacheDir,
		"--timeout", "10m",
		"image",
		"--image-src", "remote",
		"--scanners", "vuln",
		"--list-all-pkgs",
		"--severity", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL",
		"--format", "json",
	}
	// Large image layers need disk-backed scratch space, not the container's small /tmp.
	tmp, err := os.MkdirTemp(cacheDir, "scan-")
	if err != nil {
		return scanReport{}, err
	}
	defer os.RemoveAll(tmp)
	tmp, err = filepath.Abs(tmp)
	if err != nil {
		return scanReport{}, err
	}
	args = append(args, ref)
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Env = append(os.Environ(), "TMPDIR="+tmp)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		detail := strings.TrimSpace(stderr.String())
		if len(detail) > 400 {
			detail = detail[len(detail)-400:]
		}
		if detail == "" {
			detail = err.Error()
		}
		return scanReport{}, fmt.Errorf("trivy: %s", detail)
	}
	report, err := parseReport(stdout.Bytes())
	if err != nil {
		return scanReport{}, err
	}
	// Convert the same complete inventory; do not pull or scan the image again.
	report.CycloneDX, report.SPDX, err = convertSBOM(ctx, bin, cacheDir, tmp, stdout.Bytes())
	if err != nil {
		log.Printf("scan SBOM %s: %v", ref, err)
		report.SBOMError = "SBOM generation failed. Rescan this image to retry. Vulnerability results are saved."
	}
	return report, nil
}

func convertSBOM(ctx context.Context, bin, cacheDir, tmp string, report []byte) ([]byte, []byte, error) {
	file := filepath.Join(tmp, "report.json")
	if err := os.WriteFile(file, report, 0o600); err != nil {
		return nil, nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	documents := make([][]byte, 0, 2)
	for _, format := range []string{"cyclonedx", "spdx-json"} {
		cmd := exec.CommandContext(ctx, bin, "--quiet", "--cache-dir", cacheDir, "convert", "--format", format, file)
		cmd.Env = append(os.Environ(), "TMPDIR="+tmp)
		out, err := cmd.Output()
		if err != nil {
			return nil, nil, fmt.Errorf("trivy convert %s: %w", format, err)
		}
		var doc struct {
			BOMFormat   string `json:"bomFormat"`
			SPDXVersion string `json:"spdxVersion"`
		}
		if json.Unmarshal(out, &doc) != nil || (format == "cyclonedx" && doc.BOMFormat != "CycloneDX") || (format == "spdx-json" && !strings.HasPrefix(doc.SPDXVersion, "SPDX-")) {
			return nil, nil, fmt.Errorf("trivy convert %s: invalid SBOM", format)
		}
		documents = append(documents, out)
	}
	return documents[0], documents[1], nil
}

func parseReport(buf []byte) (scanReport, error) {
	var doc struct {
		Metadata struct {
			ImageID     string   `json:"ImageID"`
			RepoDigests []string `json:"RepoDigests"`
		} `json:"Metadata"`
		Results []struct {
			Vulnerabilities []struct {
				VulnerabilityID  string `json:"VulnerabilityID"`
				PkgName          string `json:"PkgName"`
				InstalledVersion string `json:"InstalledVersion"`
				FixedVersion     string `json:"FixedVersion"`
				Severity         string `json:"Severity"`
				Title            string `json:"Title"`
				PrimaryURL       string `json:"PrimaryURL"`
			} `json:"Vulnerabilities"`
		} `json:"Results"`
	}
	if err := json.Unmarshal(buf, &doc); err != nil {
		return scanReport{}, fmt.Errorf("trivy report: %w", err)
	}
	digest := ""
	if len(doc.Metadata.RepoDigests) > 0 {
		digest = doc.Metadata.RepoDigests[0]
	}
	if digest == "" {
		digest = doc.Metadata.ImageID
	}
	if hexDigest(digest) == "" {
		return scanReport{}, errors.New("trivy did not report an image digest")
	}
	rank := map[string]int{"UNKNOWN": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
	seenID := map[string]string{}
	seenRow := map[string]int{}
	var cves []string
	var findings []finding
	var critical, high int32
	for _, result := range doc.Results {
		for _, vuln := range result.Vulnerabilities {
			if vuln.VulnerabilityID == "" {
				continue
			}
			vuln.Severity = strings.ToUpper(strings.TrimSpace(vuln.Severity))
			if _, known := rank[vuln.Severity]; !known {
				vuln.Severity = "UNKNOWN"
			}
			if previous, exists := seenID[vuln.VulnerabilityID]; !exists || rank[vuln.Severity] > rank[previous] {
				seenID[vuln.VulnerabilityID] = vuln.Severity
			}
			item := finding{
				ID: vuln.VulnerabilityID, Severity: vuln.Severity, Pkg: vuln.PkgName,
				Installed: vuln.InstalledVersion, Fixed: vuln.FixedVersion, Title: vuln.Title,
				URL: advisoryURL(vuln.VulnerabilityID, vuln.PrimaryURL),
			}
			key := vuln.VulnerabilityID + "\x00" + vuln.PkgName + "\x00" + vuln.InstalledVersion
			if index, exists := seenRow[key]; exists {
				if rank[item.Severity] > rank[findings[index].Severity] {
					findings[index] = item
				}
				continue
			}
			seenRow[key] = len(findings)
			findings = append(findings, item)
		}
	}
	for id, severity := range seenID {
		cves = append(cves, id)
		switch severity {
		case "CRITICAL":
			critical++
		case "HIGH":
			high++
		}
	}
	sort.Strings(cves)
	sort.Slice(findings, func(i, j int) bool {
		if findings[i].Severity != findings[j].Severity {
			return rank[findings[i].Severity] > rank[findings[j].Severity]
		}
		if findings[i].ID != findings[j].ID {
			return findings[i].ID < findings[j].ID
		}
		if findings[i].Pkg != findings[j].Pkg {
			return findings[i].Pkg < findings[j].Pkg
		}
		return findings[i].Installed < findings[j].Installed
	})
	return scanReport{Digest: digest, Critical: critical, High: high, CVEs: cves, Findings: findings}, nil
}

func advisoryURL(id, primary string) string {
	switch {
	case strings.HasPrefix(id, "CVE-"):
		return "https://nvd.nist.gov/vuln/detail/" + id
	case strings.HasPrefix(id, "GHSA-"):
		return "https://github.com/advisories/" + id
	case primary != "":
		return primary
	default:
		return ""
	}
}

func decodeFindings(raw string) ([]finding, bool) {
	var saved savedFindings
	if json.Unmarshal([]byte(raw), &saved) == nil && saved.Findings != nil {
		return saved.Findings, saved.AllSeverities
	}
	var rich []finding
	if json.Unmarshal([]byte(raw), &rich) == nil && (len(rich) == 0 || rich[0].ID != "") {
		return rich, false
	}
	var ids []string
	if json.Unmarshal([]byte(raw), &ids) != nil {
		return nil, false
	}
	out := make([]finding, 0, len(ids))
	for _, id := range ids {
		out = append(out, finding{ID: id, URL: advisoryURL(id, "")})
	}
	return out, false
}

func trivyDBVersion(ctx context.Context, cacheDir string) string {
	bin, err := trivyPath()
	if err != nil {
		return "unknown"
	}
	cmd := exec.CommandContext(ctx, bin, "--cache-dir", cacheDir, "version", "--format", "json")
	out, err := cmd.Output()
	if err != nil {
		return "unknown"
	}
	var doc struct {
		VulnerabilityDB struct {
			Version   int       `json:"Version"`
			UpdatedAt time.Time `json:"UpdatedAt"`
		} `json:"VulnerabilityDB"`
	}
	if json.Unmarshal(out, &doc) != nil {
		return "unknown"
	}
	if doc.VulnerabilityDB.UpdatedAt.IsZero() {
		return "unknown"
	}
	return doc.VulnerabilityDB.UpdatedAt.UTC().Format(time.RFC3339)
}

func cleanScanCache(ctx context.Context, cacheDir string) error {
	bin, err := trivyPath()
	if err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, bin, "--cache-dir", cacheDir, "clean", "--scan-cache")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		detail := strings.TrimSpace(stderr.String())
		if detail == "" {
			detail = err.Error()
		}
		return fmt.Errorf("cleanup: %s", detail)
	}
	return nil
}

func hexDigest(value string) string {
	if i := strings.LastIndex(value, "sha256:"); i >= 0 {
		value = value[i+len("sha256:"):]
	}
	value = strings.TrimSpace(value)
	for _, c := range value {
		switch {
		case c >= '0' && c <= '9', c >= 'a' && c <= 'f', c >= 'A' && c <= 'F':
		default:
			return ""
		}
	}
	return strings.ToLower(value)
}
