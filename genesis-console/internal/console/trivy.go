package console

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	Digest   string
	Critical int32
	High     int32
	CVEs     []string
	Findings []finding
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
		"--severity", "HIGH,CRITICAL",
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
	return report, nil
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
	seenID := map[string]bool{}
	seenRow := map[string]bool{}
	var cves []string
	var findings []finding
	var critical, high int32
	for _, result := range doc.Results {
		for _, vuln := range result.Vulnerabilities {
			if vuln.VulnerabilityID == "" {
				continue
			}
			if vuln.Severity != "CRITICAL" && vuln.Severity != "HIGH" {
				continue
			}
			key := vuln.VulnerabilityID + "\x00" + vuln.PkgName + "\x00" + vuln.InstalledVersion
			if seenRow[key] {
				continue
			}
			seenRow[key] = true
			if !seenID[vuln.VulnerabilityID] {
				seenID[vuln.VulnerabilityID] = true
				if vuln.Severity == "CRITICAL" {
					critical++
				} else {
					high++
				}
				cves = append(cves, vuln.VulnerabilityID)
			}
			findings = append(findings, finding{
				ID: vuln.VulnerabilityID, Severity: vuln.Severity, Pkg: vuln.PkgName,
				Installed: vuln.InstalledVersion, Fixed: vuln.FixedVersion, Title: vuln.Title,
				URL: advisoryURL(vuln.VulnerabilityID, vuln.PrimaryURL),
			})
		}
	}
	sort.Strings(cves)
	sort.Slice(findings, func(i, j int) bool {
		if findings[i].Severity != findings[j].Severity {
			return findings[i].Severity == "CRITICAL"
		}
		if findings[i].ID != findings[j].ID {
			return findings[i].ID < findings[j].ID
		}
		return findings[i].Pkg < findings[j].Pkg
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

func decodeFindings(raw string) []finding {
	var rich []finding
	if json.Unmarshal([]byte(raw), &rich) == nil && (len(rich) == 0 || rich[0].ID != "") {
		return rich
	}
	var ids []string
	if json.Unmarshal([]byte(raw), &ids) != nil {
		return nil
	}
	out := make([]finding, 0, len(ids))
	for _, id := range ids {
		out = append(out, finding{ID: id, URL: advisoryURL(id, "")})
	}
	return out
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
