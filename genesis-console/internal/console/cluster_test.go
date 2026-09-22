package console

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"
)

func inspectionObject(t *testing.T, data string) object {
	t.Helper()
	var out object
	if err := yaml.Unmarshal([]byte(data), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestInspectionEvidence(t *testing.T) {
	hr := inspectionObject(t, `metadata: {name: grafana, namespace: bigbang, generation: 2}
spec:
  targetNamespace: monitoring
  driftDetection: {mode: warn}
  values: {replicas: 2}
status:
  observedGeneration: 2
  conditions:
    - {type: Ready, status: 'True', observedGeneration: 2}
    - {type: Drifted, status: 'False', observedGeneration: 1}
  history:
    - {name: grafana, namespace: monitoring, version: 4, chartVersion: 10.0.0, status: deployed}
`)
	standard := inspectionObject(t, `grafana: {enabled: false, values: {}}
networkPolicies: {enabled: true}`)
	s := &clusterSnapshot{namespace: "bigbang", release: "bigbang", observed: "2026-09-22T12:00:00Z", metadata: object{"chart": "bigbang", "version": "3.32.0", "status": "deployed", "revision": 7}, values: mergeValues(standard, nil), objects: map[string][]object{"Helm releases": {hr}, "Git sources": {inspectionObject(t, `metadata: {name: bigbang}
status: {artifact: {revision: '3.33.0@sha1:abc'}}`)}}, refs: map[string]object{}}
	s.check("Helm releases", nil)
	s.check("Installed values", nil)
	b := &comparisonBaseline{values: standard, flags: flagsFromValues(standard), versions: map[string]string{"grafana": "9.0.0"}, releases: map[string]object{}}
	got := inspectSnapshot(s, b, "3.33.0", nil)
	if got.Tag != "3.32.0" || got.SourceTag != "3.33.0" {
		t.Fatalf("fetched revision confused with installed: %v", got)
	}
	for _, p := range got.Packages {
		switch p.Key {
		case "grafana":
			if p.Health != "Ready" || p.ConfiguredEnabled || p.Drift != "Not checked" || p.Comparison != "Customized" || !strings.Contains(p.Note, "still exists") {
				t.Fatalf("disabled package hid a live release: %v", p)
			}
		case "networkPolicies":
			if p.Health != "Included" {
				t.Fatalf("umbrella policy misreported: %v", p)
			}
		}
	}
	s.metadata["status"] = "failed"
	if got := inspectSnapshot(s, b, "3.33.0", nil); got.Tag != "" {
		t.Fatal("failed revision presented as deployed")
	}
	condition(hr, "Drifted")["observedGeneration"] = 2
	if got := releaseStatus(hr); got.Drift != "In sync" {
		t.Fatalf("current drift result lost: %v", got)
	}
	obj(hr["metadata"])["generation"] = 3
	if got := releaseStatus(hr); got.Health != "Reconciling" || got.Drift != "Not checked" {
		t.Fatalf("stale ready status trusted: %v", got)
	}
	if got := releaseStatus(object{}); got.Health != "Unknown" {
		t.Fatal("missing observation is not reconciling")
	}
	s.values = nil
	s.checks = nil
	for _, p := range inspectSnapshot(s, b, "3.33.0", nil).Packages {
		if p.ValuesChecked || p.Comparison == "Standard" {
			t.Fatal("unreadable values reported standard")
		}
	}
}

func TestComparedValues(t *testing.T) {
	hr := inspectionObject(t, `metadata: {namespace: bigbang}
spec:
  valuesFrom:
    - {kind: Secret, name: settings}
    - {kind: ConfigMap, name: optional, optional: true}
    - {kind: ConfigMap, name: count, valuesKey: count, targetPath: replicas}
  values: {replicas: 3, resources: {requests: {cpu: 200m}}}
`)
	refs := map[string]object{
		"Secret/bigbang/settings": {"data": object{"values.yaml": base64.StdEncoding.EncodeToString([]byte("replicas: 1\nresources: {limits: {memory: 1Gi}}\npassword: do-not-return"))}},
		"ConfigMap/bigbang/count": {"data": object{"count": "0"}},
	}
	values, err := resolveValues(hr, refs)
	if err != nil || at(values, "replicas") != int64(0) || at(values, "resources", "requests", "cpu") != "200m" || at(values, "resources", "limits", "memory") != "1Gi" {
		t.Fatalf("values precedence failed: %v %v", values, err)
	}
	refs["ConfigMap/bigbang/optional"] = nil
	if _, err := resolveValues(hr, refs); err == nil {
		t.Fatal("permission failure mistaken for missing optional ref")
	}
	delete(refs, "ConfigMap/bigbang/optional")
	obj(refs["ConfigMap/bigbang/count"]["data"])["count"] = "{1,2}"
	if _, err := resolveValues(hr, refs); err == nil {
		t.Fatal("complex target syntax guessed")
	}
	standard := inspectionObject(t, `replicas: 1
image: {tag: old}
resources: {requests: {cpu: 100m}}
ingress: {password: old, host: example.test}
git: {repo: 'https://user:password@example.test/repo?token=secret'}
env: [{name: TOKEN, value: secret}]
`)
	wanted := mergeValues(standard, inspectionObject(t, `replicas: 2
image: {tag: new}
ingress: {password: new}
git: {repo: 'https://another:credential@example.test/repo?token=other'}
`))
	changes := compareValues(standard, wanted, standard, "test")
	if len(changes) != 2 || changes[0].Status != "Not applied" || changes[1].Status != "Not applied" {
		t.Fatalf("unexpected safe comparison: %v", changes)
	}
	raw, _ := json.Marshal(changes)
	if strings.Contains(string(raw), "password") || strings.Contains(string(raw), "credential") {
		t.Fatal("sensitive data returned")
	}
	if got := compareValues(nil, wanted, nil, "test"); len(got) == 0 || got[0].Status != "Unknown" {
		t.Fatal("missing baseline should be unknown")
	}
	if validateComparison("../../bad", nil) == nil || validateComparison("3.33.0", []string{"../bad"}) == nil || validateComparison("3.33.0", []string{"dev", "dev"}) == nil {
		t.Fatal("untrusted baseline input accepted")
	}
	if validateComparison("", nil) != nil {
		t.Fatal("deployment observation must work without a catalog")
	}
	merged := mergeValues(object{"nested": object{"keep": true, "remove": 1}}, object{"nested": object{"remove": nil}})
	if at(merged, "nested", "keep") != true || at(merged, "nested", "remove") != nil {
		t.Fatal("profile overlay merge failed")
	}
	aliases := inspectionObject(t, `grafana: {enabled: true, values: {replicas: 1}}
packageConfiguration: {version: v1}
packages:
  grafana: {enabled: false}
  custom: {values: {replicas: 2}}`)
	if flags := flagsFromValues(aliases); flags["grafana"] || !flags["custom"] {
		t.Fatalf("canonical overrides or custom enablement lost: %v", flags)
	}
	if at(aliases, "grafana", "enabled") != true {
		t.Fatal("comparison mutated installed values")
	}
	obj(obj(aliases["packages"])["grafana"])["enabled"] = true
	if changes := compareValues(object{"grafana": aliases["grafana"]}, comparisonValues(aliases), nil, "test"); len(changes) != 1 || changes[0].Path != "packages.custom.values.replicas" {
		t.Fatalf("equivalent canonical alias reported customized: %v", changes)
	}
}

func TestRuntimeInventory(t *testing.T) {
	digest := strings.Repeat("a", 64)
	pod := inspectionObject(t, `metadata: {name: custom-pod, namespace: custom}
spec:
  containers: [{name: app, image: 'registry.test/custom:v2'}]
  initContainers: [{name: init, image: 'busybox:latest'}]
status:
  phase: Running
  conditions: [{type: Ready, status: 'False'}]
  containerStatuses: [{name: app, ready: false}]
`)
	obj(list(at(pod, "status", "containerStatuses"))[0])["imageID"] = "registry.test/custom@sha256:" + digest
	s := &clusterSnapshot{objects: map[string][]object{"Pods": {pod}, "Ingress routes": {inspectionObject(t, `metadata: {name: app, namespace: custom}
spec:
  tls: [{hosts: [custom.example.test]}]
  rules:
    - host: custom.example.test
      http: {paths: [{path: /dashboard}]}
    - host: '*.example.test'
      http: {paths: [{path: /}]}
`)}, "Istio routes": {inspectionObject(t, `metadata: {name: app, namespace: custom}
spec:
  hosts: [istio.example.test]
  gateways: [public/gateway]
  http: [{match: [{uri: {prefix: /custom-path}}]}]
`)}, "Istio gateways": {inspectionObject(t, `metadata: {name: gateway, namespace: public}
spec:
  servers:
    - {port: {number: 8443, protocol: HTTPS}, hosts: ['custom/*.example.test']}
    - {port: {number: 443, protocol: HTTPS}, hosts: ['other/*.example.test']}
`)}}}
	images, counts := runtimeImages(s, "0.0.0")
	if len(images) != 2 || images[0].Digest != "sha256:"+digest || images[0].PackageKey != "Unassigned" || images[0].Comparison != "Not checked" || counts[0].Running != 0 || counts[0].Other != 1 {
		t.Fatalf("actual pod state lost: %v %v", images, counts)
	}
	urls := serviceEndpoints(s)
	if len(urls) != 2 || urls[0].Url != "https://custom.example.test/dashboard" || urls[1].Url != "https://istio.example.test:8443/custom-path" {
		t.Fatalf("routes not discovered correctly: %v", urls)
	}
}

func TestClusterReads(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("KUBECONFIG", filepath.Join(dir, "config"))
	t.Setenv("TEST_CLUSTER_DIR", dir)
	t.Setenv("GENESIS_NAMESPACE", "custom")
	t.Setenv("GENESIS_RELEASE", "genesis")
	write := func(name, data string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	write("helm", `#!/bin/sh
touch "$TEST_CLUSTER_DIR/helm-$2"
case "$2" in
metadata)
  while [ ! -f "$TEST_CLUSTER_DIR/kubectl-pods" ] || [ ! -f "$TEST_CLUSTER_DIR/kubectl-helmreleases.helm.toolkit.fluxcd.io" ]; do sleep 0.01; done
  printf '%s' '{"chart":"bigbang","version":"3.33.0","status":"deployed","revision":4}' ;;
values) printf '%s' "$*" > "$TEST_CLUSTER_DIR/values-args"; printf '%s' '{"grafana":{"enabled":true}}' ;;
esac
`)
	write("kubectl", `#!/bin/sh
touch "$TEST_CLUSTER_DIR/kubectl-$2"
case "$2" in
view) printf '%s' test-context ;;
helmreleases.helm.toolkit.fluxcd.io|pods)
  while [ ! -f "$TEST_CLUSTER_DIR/helm-metadata" ]; do sleep 0.01; done
  printf '%s' '{"items":[]}' ;;
virtualservices.networking.istio.io) exit 1 ;;
*) printf '%s' '{"items":[]}' ;;
esac
`)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	svc := &Service{}
	s := svc.snapshot(ctx)
	if s.observed == "" || s.context != "test-context" || s.namespace != "custom" || !s.checked("Installed values") || s.checked("Istio routes") {
		t.Fatalf("partial read discarded: %+v", s)
	}
	args, _ := os.ReadFile(filepath.Join(dir, "values-args"))
	if !strings.Contains(string(args), "get values genesis -n custom") || !strings.Contains(string(args), "--revision 4") {
		t.Fatalf("values not pinned: %s", args)
	}
	if svc.snapshot(ctx) != s {
		t.Fatal("snapshot was not cached")
	}
	write("helm", "#!/bin/sh\nprintf '%s' 'invalid json'\n")
	write("kubectl", "#!/bin/sh\nprintf '%s' 'invalid json'\n")
	if got := readCluster(ctx); got.observed != "" {
		t.Fatal("invalid JSON treated as an observation")
	}
	canceled, stop := context.WithCancel(context.Background())
	stop()
	empty := &Service{}
	if got := empty.snapshot(canceled); got.observed != "" || empty.clusterCache != nil {
		t.Fatal("canceled read cached")
	}
}

func TestGeneratedBaseline(t *testing.T) {
	root := os.Getenv("CONSOLE_TEST_BASELINE")
	if root == "" {
		t.Skip("set CONSOLE_TEST_BASELINE to check a generated chart with Helm")
	}
	if _, err := verifyBaseline(root, "3.33.0"); err != nil {
		t.Fatal(err)
	}
	profilesToCheck := [][]string{nil}
	for _, profile := range availableProfiles(root) {
		profilesToCheck = append(profilesToCheck, []string{profile})
	}
	for _, profiles := range profilesToCheck {
		b := loadBaseline(context.Background(), root, "3.33.0", profiles)
		if b.err != "" || len(b.releases) == 0 {
			t.Fatalf("baseline unavailable: %s", b.err)
		}
		for _, hr := range b.releases {
			if _, err := resolveValues(hr, b.refs); err != nil {
				t.Fatalf("%s: %v", identity(hr), err)
			}
		}
	}
}

func TestInstalledPackageComparison(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	for _, path := range []string{"genesis-engine/catalogs", "genesis-oss/umbrella", "bin"} {
		if err := os.MkdirAll(filepath.Join(dir, path), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	write := func(path, data string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, path), []byte(data), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	write("genesis-oss/umbrella/Chart.yaml", "name: bigbang\nversion: 3.33.0\n")
	write("genesis-oss/umbrella/values.yaml", "grafana: {enabled: true, values: {replicas: 2}}\n")
	write("genesis-oss/umbrella/values-genesis.yaml", "{}\n")
	hr := `kind: HelmRelease
metadata: {name: grafana, namespace: bigbang, generation: 1}
spec: {values: {replicas: 2}}
status:
  observedGeneration: 1
  conditions: [{type: Ready, status: 'True', observedGeneration: 1}]
  history: [{name: deployed-grafana, namespace: monitoring, version: 5, chartVersion: 10.0.0, status: deployed}]
`
	write("standard.yaml", hr)
	write("bin/helm", `#!/bin/sh
if [ "$1" = template ]; then cat "$TEST_CLUSTER_DIR/standard.yaml"; else
  printf '%s' "$*" > "$TEST_CLUSTER_DIR/installed-args"
  printf '%s' '{"replicas":1,"password":"never-return-this"}'
fi
`)
	t.Setenv("PATH", filepath.Join(dir, "bin")+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("TEST_CLUSTER_DIR", dir)
	live := inspectionObject(t, hr)
	obj(at(live, "spec", "values"))["replicas"] = 3
	snapshot := &clusterSnapshot{namespace: "bigbang", release: "bigbang", observed: "now", values: inspectionObject(t, "grafana: {enabled: true, values: {replicas: 3}}"), objects: map[string][]object{"Helm releases": {live}}, refs: map[string]object{}}
	snapshot.check("Installed values", nil)
	snapshot.check("Helm releases", nil)
	svc := &Service{clusterCache: snapshot, clusterRead: time.Now()}
	out, err := svc.PackageComparison(context.Background(), "3.33.0", nil, "grafana")
	if err != nil || !out.ValuesChecked {
		t.Fatalf("comparison failed: %v %v", out, err)
	}
	found := false
	for _, change := range out.Changes {
		if change.Source == "grafana values" && change.Path == "replicas" {
			found = change.Standard == "2" && change.Configured == "3" && change.Deployed == "1" && change.Status == "Not applied"
		}
	}
	if !found {
		t.Fatalf("three-way values comparison lost: %v", out)
	}
	args, _ := os.ReadFile(filepath.Join(dir, "installed-args"))
	if string(args) != "get values deployed-grafana -n monitoring --all -o json --revision 5" {
		t.Fatalf("wrong installed release queried: %s", args)
	}
	raw, _ := json.Marshal(out)
	if strings.Contains(string(raw), "never-return-this") {
		t.Fatal("installed secret escaped")
	}
}
