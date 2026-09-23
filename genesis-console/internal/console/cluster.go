package console

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
)

var releasePackages = map[string]string{
	"istio-crds": "istioCRDs", "istiod": "istiod", "public-ingressgateway": "istioGateway",
	"passthrough-ingressgateway": "istioGateway", "kiali": "kiali", "kyverno": "kyverno",
	"kyverno-policies": "kyvernoPolicies", "kyverno-reporter": "kyvernoReporter", "alloy": "alloy",
	"loki": "loki", "tempo": "tempo", "prometheus-operator-crds": "prometheusOperatorCRDs",
	"monitoring": "monitoring", "grafana": "grafana", "neuvector": "neuvector", "cert-manager": "certManager",
}

type object = map[string]any

func at(value any, path ...string) any {
	for _, key := range path {
		m, ok := value.(map[string]any)
		if !ok {
			return nil
		}
		value = m[key]
	}
	return value
}
func str(value any) string { s, _ := value.(string); return s }
func obj(value any) object { m, _ := value.(map[string]any); return m }
func list(value any) []any { a, _ := value.([]any); return a }
func flag(value any) bool  { b, _ := value.(bool); return b }
func identity(o object) string {
	return str(at(o, "metadata", "namespace")) + "/" + str(at(o, "metadata", "name"))
}

// activeKubeconfig holds the decrypted saved connection's file path, if any.
var activeKubeconfig atomic.Pointer[string]

func kubeconfig() string {
	if saved := activeKubeconfig.Load(); saved != nil {
		return *saved
	}
	if env := os.Getenv("KUBECONFIG"); env != "" {
		return env
	}
	local := filepath.Join(os.Getenv("HOME"), ".kube", "genesis-k3d.yaml")
	if st, err := os.Stat(local); err == nil && !st.IsDir() {
		return local
	}
	return "" // kubectl/helm use their normal kubeconfig discovery.
}
func clusterCommand(ctx context.Context, binary string, args ...string) ([]byte, error) {
	return clusterCommandWith(ctx, kubeconfig(), binary, args...)
}
func clusterCommandWith(ctx context.Context, config, binary string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, binary, args...)
	if config != "" {
		cmd.Env = append(os.Environ(), "KUBECONFIG="+config)
	}
	cmd.WaitDelay = time.Second
	return cmd.Output()
}
func kubectl(ctx context.Context, args ...string) ([]byte, error) {
	return clusterCommand(ctx, "kubectl", args...)
}
func clusterNamespace() string {
	if n := os.Getenv("GENESIS_NAMESPACE"); n != "" {
		return n
	}
	return "bigbang"
}
func clusterRelease() string {
	if n := os.Getenv("GENESIS_RELEASE"); n != "" {
		return n
	}
	return "bigbang"
}

type clusterSnapshot struct {
	context, namespace, release, observed string
	metadata, values                      object
	objects                               map[string][]object
	refs                                  map[string]object
	checks                                []*consolev1.ObservationCheck
}

func (s *clusterSnapshot) checked(name string) bool {
	for _, c := range s.checks {
		if c.Name == name {
			return c.Checked
		}
	}
	return false
}
func (s *clusterSnapshot) check(name string, err error) {
	c := &consolev1.ObservationCheck{Name: name, Checked: err == nil}
	if err != nil {
		c.Message = "Unavailable; check connectivity, permissions, and installed APIs."
	}
	s.checks = append(s.checks, c)
}
func decodeObjects(raw []byte) ([]object, error) {
	var doc object
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	if entries, ok := doc["items"].([]any); ok {
		out := make([]object, 0, len(entries))
		for _, entry := range entries {
			if obj(entry) == nil {
				return nil, fmt.Errorf("invalid list item")
			}
			out = append(out, obj(entry))
		}
		return out, nil
	}
	if str(doc["kind"]) != "" && obj(doc["metadata"]) != nil {
		return []object{doc}, nil
	}
	return nil, fmt.Errorf("expected a Kubernetes resource list")
}

func readCluster(ctx context.Context) *clusterSnapshot {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	s := &clusterSnapshot{namespace: clusterNamespace(), release: clusterRelease(), objects: map[string][]object{}, refs: map[string]object{}}
	jobs := []struct {
		name, binary string
		args         []string
		raw          []byte
		err          error
	}{
		{name: "Context", binary: "kubectl", args: []string{"config", "view", "--minify", "-o", "jsonpath={.current-context}"}},
		{name: "Helm metadata", binary: "helm", args: []string{"get", "metadata", s.release, "-n", s.namespace, "-o", "json"}},
		{name: "Helm releases", binary: "kubectl", args: []string{"get", "helmreleases.helm.toolkit.fluxcd.io", "-n", s.namespace, "-o", "json"}},
		{name: "Git sources", binary: "kubectl", args: []string{"get", "gitrepositories.source.toolkit.fluxcd.io", "-n", s.namespace, "-o", "json"}},
		{name: "Pods", binary: "kubectl", args: []string{"get", "pods", "-A", "-o", "json"}},
		{name: "Ingress routes", binary: "kubectl", args: []string{"get", "ingresses.networking.k8s.io", "-A", "-o", "json"}},
		{name: "Istio routes", binary: "kubectl", args: []string{"get", "virtualservices.networking.istio.io", "-A", "-o", "json"}},
		{name: "Istio gateways", binary: "kubectl", args: []string{"get", "gateways.networking.istio.io", "-A", "-o", "json"}},
	}
	var wg sync.WaitGroup
	for i := range jobs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			jobs[i].raw, jobs[i].err = clusterCommand(ctx, jobs[i].binary, jobs[i].args...)
		}()
	}
	wg.Wait()
	for _, job := range jobs {
		err := job.err
		if err == nil {
			switch job.name {
			case "Context":
				s.context = strings.TrimSpace(string(job.raw))
			case "Helm metadata":
				err = json.Unmarshal(job.raw, &s.metadata)
				if err == nil && (str(s.metadata["chart"]) == "" || str(s.metadata["status"]) == "") {
					err = fmt.Errorf("invalid Helm metadata")
					s.metadata = nil
				}
			default:
				s.objects[job.name], err = decodeObjects(job.raw)
			}
		}
		if job.name == "Context" && (err != nil || s.context == "") && os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
			s.context = "In-cluster service account"
			err = nil
		}
		s.check(job.name, err)
	}
	// Read only the Secrets/ConfigMaps referenced by these HelmReleases. Raw values never leave the server.
	groups := map[string][]string{}
	for _, hr := range s.objects["Helm releases"] {
		for _, r := range list(at(hr, "spec", "valuesFrom")) {
			kind, name := str(at(r, "kind")), str(at(r, "name"))
			if kind != "Secret" && kind != "ConfigMap" || name == "" {
				continue
			}
			key := kind + "/" + str(at(hr, "metadata", "namespace"))
			groups[key] = append(groups[key], name)
		}
	}
	type refResult struct {
		key  string
		docs []object
		err  error
	}
	results := make(chan refResult, len(groups)+1)
	for key, names := range groups {
		wg.Add(1)
		go func() {
			defer wg.Done()
			parts := strings.SplitN(key, "/", 2)
			args := append([]string{"get", parts[0]}, unique(names)...)
			args = append(args, "-n", parts[1], "--ignore-not-found", "-o", "json")
			raw, err := kubectl(ctx, args...)
			var docs []object
			if err == nil {
				docs, err = decodeObjects(raw)
			}
			results <- refResult{key: key, docs: docs, err: err}
		}()
	}
	if s.checked("Helm metadata") {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// Pin values to the observed revision rather than racing an upgrade.
			args := []string{"get", "values", s.release, "-n", s.namespace, "--all", "-o", "json", "--revision", fmt.Sprint(s.metadata["revision"])}
			raw, err := clusterCommand(ctx, "helm", args...)
			var values object
			if err == nil {
				err = json.Unmarshal(raw, &values)
			}
			if err == nil && values == nil {
				err = fmt.Errorf("empty Helm values")
			}
			results <- refResult{key: "Installed values", docs: []object{values}, err: err}
		}()
	}
	wg.Wait()
	close(results)
	for result := range results {
		s.check(result.key, result.err)
		if result.err != nil {
			for _, name := range groups[result.key] {
				s.refs[result.key+"/"+name] = nil // Unreadable is different from an optional reference that does not exist.
			}
			continue
		}
		if result.key == "Installed values" {
			s.values = result.docs[0]
			continue
		}
		for _, doc := range result.docs {
			s.refs[str(doc["kind"])+"/"+identity(doc)] = doc
		}
	}
	if s.checked("Helm metadata") || s.checked("Helm releases") || s.checked("Pods") {
		s.observed = time.Now().UTC().Format(time.RFC3339)
	}
	sort.Slice(s.checks, func(i, j int) bool { return s.checks[i].Name < s.checks[j].Name })
	return s
}

func unique(items []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, item := range items {
		if item != "" && !seen[item] {
			seen[item] = true
			out = append(out, item)
		}
	}
	sort.Strings(out)
	return out
}
func packageKey(hr object) string {
	path := str(at(hr, "spec", "chart", "spec", "chart"))
	parts := strings.Split(strings.Trim(path, "/"), "/")
	for i, p := range parts {
		if p == "packages" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	name := str(at(hr, "metadata", "name"))
	if key := releasePackages[name]; key != "" {
		return key
	}
	return canonicalPackage(name)
}
func condition(hr object, name string) object {
	for _, item := range list(at(hr, "status", "conditions")) {
		if str(at(item, "type")) == name {
			return obj(item)
		}
	}
	return nil
}
func currentGeneration(hr object) bool {
	generation := at(hr, "metadata", "generation")
	observed := at(hr, "status", "observedGeneration")
	if value := condition(hr, "Ready")["observedGeneration"]; value != nil {
		observed = value
	}
	return generation != nil && observed != nil && fmt.Sprint(generation) == fmt.Sprint(observed)
}
func releaseStatus(hr object) *consolev1.HelmReleaseStatus {
	ready := condition(hr, "Ready")
	state := "Unknown"
	switch {
	case flag(at(hr, "spec", "suspend")):
		state = "Suspended"
	case str(condition(hr, "Reconciling")["status"]) == "True":
		state = "Reconciling"
	case !currentGeneration(hr):
		if at(hr, "metadata", "generation") != nil && (ready["observedGeneration"] != nil || at(hr, "status", "observedGeneration") != nil) {
			state = "Reconciling"
		}
	case str(ready["status"]) == "True":
		state = "Ready"
	case str(ready["status"]) == "False":
		state = "Not ready"
	}
	drift, note := "Not checked", "Flux has not reported a current drift result."
	mode := str(at(hr, "spec", "driftDetection", "mode"))
	d := condition(hr, "Drifted")
	if (mode == "warn" || mode == "enabled") && currentGeneration(hr) && d["observedGeneration"] != nil && fmt.Sprint(d["observedGeneration"]) == fmt.Sprint(at(hr, "metadata", "generation")) && state != "Reconciling" && state != "Suspended" {
		switch str(d["status"]) {
		case "True":
			drift = "Drifted"
		case "False":
			drift = "In sync"
		}
		if drift != "Not checked" {
			note = "Flux drift result; configured exclusions still apply."
		}
	}
	if mode != "warn" && mode != "enabled" {
		note = "Flux drift detection is not enabled."
	}
	deployed := ""
	for _, item := range list(at(hr, "status", "history")) {
		if str(at(item, "status")) == "deployed" {
			deployed = str(at(item, "chartVersion"))
			break
		}
	}
	namespace := str(at(hr, "spec", "targetNamespace"))
	if namespace == "" {
		namespace = str(at(hr, "metadata", "namespace"))
	}
	return &consolev1.HelmReleaseStatus{Name: str(at(hr, "metadata", "name")), PackageKey: packageKey(hr), Ready: state == "Ready", Reason: str(ready["reason"]), Namespace: str(at(hr, "metadata", "namespace")), TargetNamespace: namespace, ConfiguredVersion: str(at(hr, "spec", "chart", "spec", "version")), DeployedVersion: deployed, Health: state, Drift: drift, DriftNote: note}
}

func (s *Service) snapshot(ctx context.Context) *clusterSnapshot {
	s.clusterMu.Lock()
	defer s.clusterMu.Unlock()
	// ponytail: one cluster per process; use per-cluster caches if multi-cluster support is added.
	if s.clusterCache == nil || time.Since(s.clusterRead) > 30*time.Second {
		fresh := readCluster(ctx)
		if ctx.Err() == nil && fresh.observed != "" {
			s.clusterCache = fresh
			s.clusterRead = time.Now()
		}
		return fresh
	}
	return s.clusterCache
}
