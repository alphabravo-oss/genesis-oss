package console

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

type loadedImage struct {
	ID        string
	Package   string
	Name      string
	Ref       string
	Registry  string
	Digest    string
	When      string
	Signature string
	Critical  *int32
	High      *int32
	Ironbank  string
	Scanned   bool
}

type loadedPackage struct {
	Key     string
	Enabled bool
	Images  int32
}

type loadedRelease struct {
	Tag          string
	ChartVersion string
	Domain       string
	Packages     []loadedPackage
	Images       []loadedImage
}

var registries = map[string]string{
	"docker.io":           "Docker Hub",
	"quay.io":             "Quay",
	"ghcr.io":             "GitHub Container Registry",
	"registry.k8s.io":     "Kubernetes",
	"registry.gitlab.com": "GitLab",
}

func registryOf(ref string) string {
	if ref == "" || !strings.Contains(ref, "/") {
		return ""
	}
	return strings.SplitN(ref, "/", 2)[0]
}

func registryLabel(host string) string {
	if host == "" {
		return "No public source"
	}
	if label, ok := registries[host]; ok {
		return label
	}
	return host
}

func canonicalPackage(key string) string {
	switch key {
	case "cert-manager":
		return "certManager"
	case "istio-gateway":
		return "istioGateway"
	case "istio":
		return "istiod"
	case "kyverno-policies":
		return "kyvernoPolicies"
	case "policy-reporter":
		return "kyvernoReporter"
	default:
		return key
	}
}

func roots() (engine, upstream string) {
	if root := os.Getenv("GENESIS_DATA_DIR"); root != "" {
		return root, filepath.Join(root, "upstream")
	}
	// Dev and `go run` both start from the module directory or the repo.
	candidates := []string{
		filepath.Join(".."),
		".",
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append([]string{wd, filepath.Dir(wd)}, candidates...)
	}
	for _, base := range candidates {
		engine := filepath.Join(base, "genesis-engine")
		if st, err := os.Stat(filepath.Join(engine, "catalogs")); err == nil && st.IsDir() {
			return engine, filepath.Join(base, "upstream")
		}
		if st, err := os.Stat(filepath.Join(base, "catalogs")); err == nil && st.IsDir() && strings.HasSuffix(base, "genesis-engine") {
			return base, filepath.Join(filepath.Dir(base), "upstream")
		}
	}
	wd, _ := os.Getwd()
	if strings.HasSuffix(wd, "genesis-console") {
		return filepath.Join(wd, "..", "genesis-engine"), filepath.Join(wd, "..", "upstream")
	}
	return filepath.Join(wd, "genesis-engine"), filepath.Join(wd, "upstream")
}

func loadYAML(path string, dest any) error {
	buf, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return yaml.Unmarshal(buf, dest)
}

func chartVersion(upstream, tag string) string {
	path := filepath.Join(upstream, "bigbang", "chart", "Chart.yaml")
	if tag != "3.33.0" {
		path = filepath.Join(upstream, "tags", tag, "bigbang", "chart", "Chart.yaml")
	}
	var doc struct {
		Version string `yaml:"version"`
	}
	if err := loadYAML(path, &doc); err != nil || doc.Version == "" {
		return tag
	}
	return doc.Version
}

func packageFlags(upstream, tag string) map[string]bool {
	path := filepath.Join(upstream, "bigbang", "chart", "values.yaml")
	if tag != "3.33.0" {
		path = filepath.Join(upstream, "tags", tag, "bigbang", "chart", "values.yaml")
	}
	var values map[string]any
	if err := loadYAML(path, &values); err != nil {
		return nil
	}
	return flagsFromValues(values)
}

func flagsFromValues(values map[string]any) map[string]bool {
	values = comparisonValues(values)
	found := map[string]bool{}
	take := func(scope map[string]any) {
		for key, raw := range scope {
			val, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			enabled, has := val["enabled"]
			if !has {
				continue
			}
			if key == "networkPolicies" {
				on, _ := enabled.(bool)
				found[key] = on
				continue
			}
			if _, git := val["git"]; !git {
				if _, helm := val["helmRepo"]; !helm {
					if _, source := val["sourceType"]; !source {
						if _, valuesKey := val["values"]; !valuesKey {
							continue
						}
					}
				}
			}
			on, _ := enabled.(bool)
			found[key] = on
		}
	}
	take(values)
	if addons, ok := values["addons"].(map[string]any); ok {
		take(addons)
	}
	for key, value := range obj(values["packages"]) {
		if _, builtIn := found[key]; builtIn {
			continue
		}
		if pkg := obj(value); pkg != nil {
			enabled, specified := pkg["enabled"]
			found[key] = !specified || flag(enabled)
		}
	}
	return found
}

func parseAudit(engine, tag string) map[string]loadedImage {
	path := filepath.Join(engine, "catalogs", tag, "security-audit.md")
	buf, err := os.ReadFile(path)
	found := map[string]loadedImage{}
	if err != nil {
		return found
	}
	critRe := regexp.MustCompile(`(\d+) critical`)
	highRe := regexp.MustCompile(`(\d+) high`)
	for _, line := range strings.Split(string(buf), "\n") {
		if !strings.HasPrefix(line, "| `") {
			continue
		}
		parts := splitRow(line)
		if len(parts) < 4 {
			continue
		}
		item := loadedImage{Digest: parts[1], Signature: parts[2], Scanned: true}
		if m := critRe.FindStringSubmatch(parts[3]); m != nil {
			item.Critical = atoi32(m[1])
		}
		if m := highRe.FindStringSubmatch(parts[3]); m != nil {
			item.High = atoi32(m[1])
		}
		found[parts[0]] = item
	}
	return found
}

func atoi32(s string) *int32 {
	var n int32
	for _, c := range s {
		n = n*10 + int32(c-'0')
	}
	return &n
}

func splitRow(line string) []string {
	line = strings.Trim(line, "|")
	raw := strings.Split(line, "|")
	out := make([]string, 0, len(raw))
	for _, part := range raw {
		out = append(out, strings.Trim(strings.TrimSpace(part), "`"))
	}
	return out
}

func parsePublic(engine, tag string) []loadedImage {
	buf, err := os.ReadFile(filepath.Join(engine, "catalogs", tag, "public.md"))
	if err != nil {
		return nil
	}
	var rows []loadedImage
	for _, line := range strings.Split(string(buf), "\n") {
		if !strings.HasPrefix(line, "|") || strings.HasPrefix(line, "| Image") || strings.HasPrefix(line, "|---") {
			continue
		}
		parts := splitRow(line)
		if len(parts) < 3 {
			continue
		}
		ref := parts[1]
		rows = append(rows, loadedImage{
			ID: parts[0], Package: canonicalPackage(strings.Split(parts[0], "/")[0]), Name: parts[0],
			Ref: ref, Registry: registryOf(ref), When: parts[2],
		})
	}
	return rows
}

func catalogImages(engine, tag string) []loadedImage {
	path := filepath.Join(engine, "catalogs", tag, "images.yaml")
	var doc struct {
		Images []struct {
			ID      string `yaml:"id"`
			Package string `yaml:"package"`
			Public  struct {
				Ref    string `yaml:"ref"`
				Digest string `yaml:"digest"`
			} `yaml:"public"`
			Ironbank struct {
				Ref string `yaml:"ref"`
			} `yaml:"ironbank"`
		} `yaml:"images"`
	}
	audit := parseAudit(engine, tag)
	if err := loadYAML(path, &doc); err != nil || len(doc.Images) == 0 {
		rows := parsePublic(engine, tag)
		for i := range rows {
			if scanned, ok := audit[rows[i].Name]; ok {
				rows[i].Digest = scanned.Digest
				rows[i].Signature = scanned.Signature
				rows[i].Critical = scanned.Critical
				rows[i].High = scanned.High
				rows[i].Scanned = true
			}
		}
		return rows
	}
	var rows []loadedImage
	have := map[string]bool{}
	for _, img := range doc.Images {
		ref := strings.TrimSpace(img.Public.Ref)
		digest := strings.TrimPrefix(img.Public.Digest, "sha256:")
		if len(digest) > 12 {
			digest = digest[:12]
		}
		row := loadedImage{
			ID: img.ID, Package: canonicalPackage(img.Package), Name: img.ID, Ref: ref,
			Registry: registryOf(ref), Digest: digest, When: "default-on", Ironbank: img.Ironbank.Ref,
		}
		if scanned, ok := audit[img.ID]; ok {
			if scanned.Digest != "" {
				row.Digest = scanned.Digest
			}
			row.Signature = scanned.Signature
			row.Critical = scanned.Critical
			row.High = scanned.High
			row.Scanned = true
		}
		rows = append(rows, row)
		have[row.Name] = true
	}
	if tag == "3.33.0" {
		for _, row := range parsePublic(engine, tag) {
			if have[row.Name] {
				continue
			}
			if scanned, ok := audit[row.Name]; ok {
				if scanned.Digest != "" {
					row.Digest = scanned.Digest
				}
				row.Signature = scanned.Signature
				row.Critical = scanned.Critical
				row.High = scanned.High
				row.Scanned = true
			}
			rows = append(rows, row)
		}
	}
	return rows
}

func loadRelease(engine, upstream, tag string) loadedRelease {
	images := catalogImages(engine, tag)
	counts := map[string]int32{}
	for _, img := range images {
		counts[img.Package]++
	}
	flags := packageFlags(upstream, tag)
	root := baselineRoot(tag, "")
	var standard, overlay object
	if loadYAML(filepath.Join(root, "umbrella", "values.yaml"), &standard) == nil && loadYAML(filepath.Join(root, "umbrella", "values-genesis.yaml"), &overlay) == nil {
		var chart object
		if loadYAML(filepath.Join(root, "umbrella", "Chart.yaml"), &chart) == nil && str(chart["version"]) == tag {
			flags = flagsFromValues(mergeValues(standard, overlay))
		}
	}
	var packages []loadedPackage
	if len(flags) == 0 {
		seen := map[string]bool{}
		for _, img := range images {
			if seen[img.Package] {
				continue
			}
			seen[img.Package] = true
			packages = append(packages, loadedPackage{Key: img.Package, Enabled: true, Images: counts[img.Package]})
		}
	} else {
		for key, enabled := range flags {
			packages = append(packages, loadedPackage{Key: key, Enabled: enabled, Images: counts[key]})
		}
	}
	return loadedRelease{
		Tag: tag, ChartVersion: chartVersion(upstream, tag), Domain: "dev.genesis.local",
		Packages: packages, Images: images,
	}
}

func loadAll() []loadedRelease {
	engine, upstream := roots()
	entries, err := os.ReadDir(filepath.Join(engine, "catalogs"))
	if err != nil {
		return nil
	}
	var out []loadedRelease
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		tag := entry.Name()
		if _, err := os.Stat(filepath.Join(engine, "catalogs", tag, "images.yaml")); err != nil {
			continue
		}
		out = append(out, loadRelease(engine, upstream, tag))
	}
	return out
}
