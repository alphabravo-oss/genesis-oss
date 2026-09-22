package console

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"gopkg.in/yaml.v3"
)

var releaseTag = regexp.MustCompile(`^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.+-]+)?$`)
var profileName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)

type comparisonBaseline struct {
	manifest *baselineManifest
	values   object
	releases map[string]object
	refs     map[string]object
	versions map[string]string
	flags    map[string]bool
	profiles []string
	err      string
}

func mergeValues(base, overlay object) object {
	out := object{}
	for k, v := range base {
		if m := obj(v); m != nil {
			out[k] = mergeValues(m, nil)
		} else {
			out[k] = v
		}
	}
	for k, v := range overlay {
		if v == nil {
			delete(out, k)
			continue
		}
		if m := obj(v); m != nil {
			out[k] = mergeValues(obj(out[k]), m)
		} else {
			out[k] = v
		}
	}
	return out
}

// Big Bang's v1 package aliases override the legacy package paths. Compare the
// effective values so changing only the spelling of a path is not a customization.
func comparisonValues(values object) object {
	if values == nil || str(at(values, "packageConfiguration", "version")) != "v1" {
		return values
	}
	out := mergeValues(values, nil)
	for key, overlay := range obj(out["packages"]) {
		for _, scope := range []object{out, obj(out["addons"])} {
			legacy := obj(scope[key])
			if _, exists := legacy["enabled"]; exists {
				scope[key] = mergeValues(legacy, obj(overlay))
				delete(obj(out["packages"]), key)
				break
			}
		}
	}
	return out
}

func availableProfiles(root string) []string {
	files, _ := os.ReadDir(filepath.Join(root, "profiles"))
	out := []string{}
	for _, file := range files {
		name := strings.TrimSuffix(file.Name(), ".yaml")
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".yaml") || name == "k3d" || !profileName.MatchString(name) {
			continue
		}
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}
func validateComparison(tag string, profiles []string) error {
	if tag != "" && !releaseTag.MatchString(tag) {
		return fmt.Errorf("select a valid catalog release")
	}
	if len(profiles) > 16 {
		return fmt.Errorf("too many profiles")
	}
	seen := map[string]bool{}
	for _, p := range profiles {
		if !profileName.MatchString(p) || seen[p] {
			return fmt.Errorf("invalid or repeated profile")
		}
		seen[p] = true
	}
	return nil
}
func (s *Service) baseline(ctx context.Context, tag string, profiles []string, checksums ...string) *comparisonBaseline {
	checksum := ""
	if len(checksums) > 0 {
		checksum = checksums[0]
	}
	root := baselineRoot(tag, checksum)
	var stamp strings.Builder
	// Invalidate on generated templates, values, profiles, and package chart metadata.
	for _, dir := range []string{"umbrella", "profiles"} {
		_ = filepath.WalkDir(filepath.Join(root, dir), func(path string, entry fs.DirEntry, err error) error {
			if err == nil && !entry.IsDir() {
				if info, err := entry.Info(); err == nil {
					fmt.Fprintf(&stamp, "%s:%d:%d;", path, info.ModTime().UnixNano(), info.Size())
				}
			}
			return nil
		})
	}
	charts, _ := filepath.Glob(filepath.Join(root, "packages", "*", "chart", "Chart.yaml"))
	for _, path := range charts {
		if info, err := os.Stat(path); err == nil {
			fmt.Fprintf(&stamp, "%s:%d:%d;", path, info.ModTime().UnixNano(), info.Size())
		}
	}
	if info, err := os.Stat(filepath.Join(root, "baseline.json")); err == nil {
		fmt.Fprintf(&stamp, "manifest:%d", info.ModTime().UnixNano())
	}
	key := root + "/" + tag + "/" + strings.Join(profiles, ",") + "/" + stamp.String()
	s.baselineMu.Lock()
	defer s.baselineMu.Unlock()
	if s.baselineCache != nil && s.baselineKey == key {
		return s.baselineCache
	}
	baseline := loadBaseline(ctx, root, tag, profiles)
	// Failed reads can recover on the next inspection without restarting the server.
	if baseline.err == "" {
		s.baselineKey = key
		s.baselineCache = baseline
	}
	return baseline
}
func loadBaseline(ctx context.Context, root, tag string, profiles []string) *comparisonBaseline {
	b := &comparisonBaseline{releases: map[string]object{}, refs: map[string]object{}, versions: map[string]string{}, flags: map[string]bool{}, profiles: availableProfiles(root)}
	if tag == "" {
		b.err = "No catalog baseline is selected; deployment observations are still available."
		return b
	}
	manifest, err := verifyBaseline(root, tag)
	if err != nil {
		b.err = "Baseline integrity check failed; configuration comparison is unavailable."
		return b
	}
	b.manifest = manifest
	var chart object
	if loadYAML(filepath.Join(root, "umbrella", "Chart.yaml"), &chart) != nil || str(chart["version"]) != tag {
		b.err = "The generated Genesis chart for " + tag + " is not available locally. Configuration comparison is unknown."
		return b
	}
	var defaults, overlay object
	if loadYAML(filepath.Join(root, "umbrella", "values.yaml"), &defaults) != nil || loadYAML(filepath.Join(root, "umbrella", "values-genesis.yaml"), &overlay) != nil {
		b.err = "The generated Genesis baseline values could not be read."
		return b
	}
	b.values = mergeValues(defaults, overlay)
	for _, name := range profiles {
		found := false
		for _, candidate := range b.profiles {
			if name == candidate {
				found = true
			}
		}
		var profile object
		if !found || loadYAML(filepath.Join(root, "profiles", name+".yaml"), &profile) != nil {
			b.err = "Baseline profile is unavailable: " + name
			b.values = nil
			return b
		}
		b.values = mergeValues(b.values, profile)
	}
	b.flags = flagsFromValues(b.values)
	for key := range b.flags {
		var metadata object
		if loadYAML(filepath.Join(root, "packages", key, "chart", "Chart.yaml"), &metadata) == nil {
			b.versions[key] = str(metadata["version"])
		}
	}
	raw, err := yaml.Marshal(b.values)
	if err != nil {
		b.err = "Baseline values could not be encoded."
		return b
	}
	file, err := os.CreateTemp("", "genesis-baseline-*.yaml")
	if err != nil {
		b.err = "Baseline could not be rendered."
		return b
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(raw); err != nil {
		file.Close()
		b.err = "Baseline could not be rendered."
		return b
	}
	file.Close()
	renderCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	kubeVersion := os.Getenv("GENESIS_KUBE_VERSION")
	if kubeVersion == "" {
		kubeVersion = "1.36.0"
	}
	raw, err = clusterCommand(renderCtx, "helm", "template", clusterRelease(), filepath.Join(root, "umbrella"), "--namespace", clusterNamespace(), "--kube-version", kubeVersion, "--api-versions", "metrics.k8s.io/v1beta1", "-f", file.Name())
	if err != nil {
		b.err = "Package baseline could not be rendered; check the generated chart and selected profiles."
		return b
	}
	decoder := yaml.NewDecoder(strings.NewReader(string(raw)))
	for {
		var doc object
		if err = decoder.Decode(&doc); err == io.EOF {
			break
		} else if err != nil {
			b.err = "Rendered package baseline is invalid."
			break
		}
		switch str(doc["kind"]) {
		case "HelmRelease":
			b.releases[identity(doc)] = doc
		case "Secret", "ConfigMap":
			b.refs[str(doc["kind"])+"/"+identity(doc)] = doc
		}
	}
	return b
}

func resolveValues(hr object, refs map[string]object) (object, error) {
	values := object{}
	type target struct{ path, value string }
	targets := []target{}
	for _, ref := range list(at(hr, "spec", "valuesFrom")) {
		kind, name := str(at(ref, "kind")), str(at(ref, "name"))
		namespace := str(at(hr, "metadata", "namespace"))
		doc, exists := refs[kind+"/"+namespace+"/"+name]
		if !exists {
			if flag(at(ref, "optional")) {
				continue
			}
			return nil, fmt.Errorf("referenced values are unavailable")
		}
		if doc == nil {
			return nil, fmt.Errorf("referenced values could not be read")
		}
		key := str(at(ref, "valuesKey"))
		if key == "" {
			key = "values.yaml"
		}
		raw, ok := at(doc, "data", key).(string)
		if text, yes := at(doc, "stringData", key).(string); yes {
			raw = text
			ok = true
		} else if kind == "Secret" && ok {
			decoded, err := base64.StdEncoding.DecodeString(raw)
			if err != nil {
				return nil, fmt.Errorf("referenced values are invalid")
			}
			raw = string(decoded)
		}
		if !ok {
			return nil, fmt.Errorf("referenced values key is unavailable")
		}
		if path := str(at(ref, "targetPath")); path != "" {
			targets = append(targets, target{path, raw})
			continue
		}
		var next object
		if yaml.Unmarshal([]byte(raw), &next) != nil {
			return nil, fmt.Errorf("referenced values are invalid")
		}
		values = mergeValues(values, next)
	}
	values = mergeValues(values, obj(at(hr, "spec", "values")))
	for _, target := range targets {
		// Helm's escaped/list targetPath syntax needs its parser; never guess its result.
		if strings.ContainsAny(target.path, "[]\\\"'") || strings.ContainsAny(target.value, ",{}\\") {
			return nil, fmt.Errorf("complex valuesFrom targetPath cannot be compared")
		}
		parts := strings.Split(target.path, ".")
		if parts[len(parts)-1] == "" {
			return nil, fmt.Errorf("invalid targetPath")
		}
		dest := values
		for _, part := range parts[:len(parts)-1] {
			if part == "" {
				return nil, fmt.Errorf("invalid targetPath")
			}
			if obj(dest[part]) == nil {
				dest[part] = object{}
			}
			dest = obj(dest[part])
		}
		var value any = target.value
		switch strings.ToLower(target.value) {
		case "true":
			value = true
		case "false":
			value = false
		case "null":
			value = nil
		default:
			if target.value == "0" || !strings.HasPrefix(target.value, "0") {
				if n, err := strconv.ParseInt(target.value, 10, 64); err == nil {
					value = n
				}
			}
		}
		dest[parts[len(parts)-1]] = value
	}
	return values, nil
}

func category(path string) string {
	parts := strings.Split(strings.ToLower(path), ".")
	for _, part := range parts {
		if strings.Contains(part, "password") || strings.Contains(part, "passwd") || strings.Contains(part, "secret") || strings.Contains(part, "token") || strings.Contains(part, "credential") || strings.Contains(part, "private") || strings.Contains(part, "certificate") || part == "env" || part == "data" || part == "stringdata" || part == "annotations" || part == "cacert" || part == "key" {
			return ""
		}
	}
	for _, part := range parts {
		if part == "git" || part == "sourceref" || part == "helmrepo" || part == "chart" {
			return "Source"
		}
	}
	for _, part := range parts {
		switch part {
		case "resources", "requests", "limits":
			return "Resources"
		case "replicas", "replicacount", "minreplicas", "maxreplicas":
			return "Replicas"
		case "persistence", "storage", "storageclass", "storageclassname", "volumeclaimtemplates":
			return "Storage"
		case "ingress", "domain", "host", "hosts", "hostname", "gateways", "servers":
			return "Ingress"
		case "image", "images", "repository", "registry", "tag", "hub", "repo", "image_name":
			return "Images"
		}
	}
	if len(parts) > 0 && parts[len(parts)-1] == "enabled" {
		return "Enabled"
	}
	return ""
}
func flatValues(prefix string, value any, out map[string]string) {
	if m := obj(value); m != nil {
		for key, v := range m {
			path := key
			if prefix != "" {
				path = prefix + "." + key
			}
			flatValues(path, v, out)
		}
		return
	}
	if items := list(value); items != nil {
		for i, v := range items {
			flatValues(fmt.Sprintf("%s.%d", prefix, i), v, out)
		}
		return
	}
	if category(prefix) == "" {
		return
	}
	if text, ok := value.(string); ok {
		if u, err := url.Parse(text); err == nil && u.Scheme != "" && u.Host != "" {
			u.User = nil
			u.RawQuery = ""
			u.Fragment = ""
			value = u.String()
		}
	}
	raw, _ := json.Marshal(value)
	out[prefix] = string(raw)
}
func valueText(values map[string]string, key string, known bool) string {
	if !known {
		return "Not checked"
	}
	if v, ok := values[key]; ok {
		return v
	}
	return "Not set"
}
func compareValues(standard, configured, deployed object, source string) []*consolev1.ConfigurationChange {
	a, b, c := map[string]string{}, map[string]string{}, map[string]string{}
	flatValues("", standard, a)
	flatValues("", configured, b)
	flatValues("", deployed, c)
	keys := []string{}
	for k := range a {
		keys = append(keys, k)
	}
	for k := range b {
		keys = append(keys, k)
	}
	out := []*consolev1.ConfigurationChange{}
	for _, key := range unique(keys) {
		expected, wanted, actual := valueText(a, key, standard != nil), valueText(b, key, configured != nil), valueText(c, key, deployed != nil)
		if expected == wanted && (deployed == nil || actual == wanted) {
			continue
		}
		state := "Customized"
		if standard == nil || configured == nil {
			state = "Unknown"
		} else if deployed != nil && actual != wanted {
			state = "Not applied"
		}
		out = append(out, &consolev1.ConfigurationChange{Path: key, Category: category(key), Standard: expected, Configured: wanted, Deployed: actual, Status: state, Source: source})
	}
	return out
}
