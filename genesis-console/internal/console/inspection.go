package console

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
)

func (s *Service) Inspect(ctx context.Context, tag string, profiles []string, recorded ...bool) *consolev1.ClusterStatus {
	snapshot := s.snapshot(ctx)
	baseline, profiles, provenance := s.inspectionBaseline(ctx, snapshot, tag, profiles, len(recorded) > 0 && recorded[0])
	out := inspectSnapshot(snapshot, baseline, tag, profiles)
	out.Provenance = provenance
	if baseline.manifest != nil {
		out.BaselineSha256 = baseline.manifest.SHA256
	}
	if s.store != nil {
		rows, err := s.store.q.LatestFindings(ctx)
		check := &consolev1.ObservationCheck{Name: "Saved image findings", Checked: err == nil}
		if err != nil {
			check.Message = "Saved findings could not be read; scan coverage is unknown."
		}
		out.Checks = append(out.Checks, check)
		if err == nil {
			found := indexFindings(rows)
			included := map[string]bool{}
			for _, image := range out.Images {
				if image.Digest == "" {
					continue
				}
				if match, ok := found.match(image.Digest, ""); ok {
					image.Scanned = true
					image.Critical = match.CriticalCount
					image.High = match.HighCount
					if !included[image.Digest] {
						result := &consolev1.ImageRow{Id: image.Digest, Digest: image.Digest, Ref: match.Ref}
						applyFinding(result, match)
						out.ImageFindings = append(out.ImageFindings, result)
						included[image.Digest] = true
					}
				}
			}
		}
	}
	return out
}

func inspectSnapshot(s *clusterSnapshot, b *comparisonBaseline, tag string, profiles []string) *consolev1.ClusterStatus {
	out := &consolev1.ClusterStatus{Connected: s.observed != "", Context: s.context, Namespace: s.namespace, ReleaseName: s.release, ObservedAt: s.observed, Checks: append([]*consolev1.ObservationCheck(nil), s.checks...), BaselineTag: tag, BaselineError: b.err, AvailableProfiles: b.profiles, Profiles: profiles, DeploymentState: "Unknown"}
	if !out.Connected {
		out.Error = "Cluster observations are unavailable. Check the kubeconfig, connection, and read permissions."
	}
	if s.metadata != nil {
		out.DeploymentState = str(s.metadata["status"])
		out.DeployedAt = str(s.metadata["deployedAt"])
		chart, version := str(s.metadata["chart"]), str(s.metadata["version"])
		out.VersionEvidence = fmt.Sprintf("Helm %s/%s · chart %s %s · revision %v", s.namespace, s.release, chart, version, s.metadata["revision"])
		if out.DeploymentState == "deployed" && chart == "bigbang" && releaseTag.MatchString(version) {
			out.Tag = strings.TrimPrefix(version, "v")
		}
	}
	for _, source := range s.objects["Git sources"] {
		if str(at(source, "metadata", "name")) == s.release {
			out.Revision = str(at(source, "status", "artifact", "revision"))
			candidate := strings.Split(out.Revision, "@")[0]
			if releaseTag.MatchString(candidate) {
				out.SourceTag = strings.TrimPrefix(candidate, "v")
			}
		}
	}
	statuses := map[string][]*consolev1.HelmReleaseStatus{}
	configured := map[string][]object{}
	for _, hr := range s.objects["Helm releases"] {
		status := releaseStatus(hr)
		out.Releases = append(out.Releases, status)
		statuses[status.PackageKey] = append(statuses[status.PackageKey], status)
		configured[status.PackageKey] = append(configured[status.PackageKey], hr)
	}
	flags := flagsFromValues(s.values)
	keys := []string{"global"}
	for key := range b.flags {
		keys = append(keys, key)
	}
	for key := range flags {
		keys = append(keys, key)
	}
	for key := range configured {
		keys = append(keys, key)
	}
	var installedUmbrella object
	if s.checked("Installed values") && str(s.metadata["status"]) == "deployed" {
		installedUmbrella = comparisonValues(s.values)
	}
	umbrellaChanges := compareValues(comparisonValues(b.values), comparisonValues(s.values), installedUmbrella, "Umbrella values")
	for _, key := range unique(keys) {
		_, hasFlag := flags[key]
		p := &consolev1.PackageComparison{Key: key, StandardKnown: b.values != nil, StandardEnabled: b.flags[key], StandardVersion: b.versions[key], ConfiguredKnown: s.checked("Installed values") && hasFlag, ConfiguredEnabled: flags[key], Health: "Unknown", Drift: "Not checked", ValuesChecked: b.err == "" && s.checked("Installed values"), Comparison: "Unknown"}
		if key == "global" {
			p.StandardEnabled = true
			p.ConfiguredEnabled = true
			p.ConfiguredKnown = s.checked("Installed values")
			p.Health = "Configuration"
			p.Drift = "Not applicable"
		}
		for _, change := range umbrellaChanges {
			parts := strings.Split(change.Path, ".")
			owner := parts[0]
			if (owner == "addons" || owner == "packages") && len(parts) > 1 {
				owner = parts[1]
			}
			if _, ok := b.flags[owner]; !ok {
				if _, ok = flags[owner]; !ok {
					owner = "global"
				}
			}
			if owner == key {
				p.Changes = append(p.Changes, change)
			}
		}
		hrs := configured[key]
		states := statuses[key]
		if len(hrs) > 0 {
			if !hasFlag {
				p.ConfiguredKnown = true
				p.ConfiguredEnabled = true
			}
			p.Health = "Ready"
			p.Drift = "In sync"
			desiredVersions, installedVersions := []string{}, []string{}
			for i, hr := range hrs {
				state := states[i]
				p.Releases = append(p.Releases, state.Namespace+"/"+state.Name)
				desiredVersions = append(desiredVersions, state.ConfiguredVersion)
				installedVersions = append(installedVersions, state.DeployedVersion)
				if healthPriority(state.Health) > healthPriority(p.Health) {
					p.Health = state.Health
				}
				if state.Drift == "Drifted" {
					p.Drift = "Drifted"
				} else if state.Drift != "In sync" && p.Drift != "Drifted" {
					p.Drift = "Not checked"
				}
				p.Note = joinNote(p.Note, state.DriftNote)
				standard, baselineErr := standardReleaseValues(b, hr)
				wanted, err := resolveValues(hr, s.refs)
				if baselineErr != nil || err != nil {
					p.ValuesChecked = false
					p.Note = joinNote(p.Note, "Some package values could not be compared; referenced values may be unavailable.")
				} else {
					p.Changes = append(p.Changes, compareValues(standard, wanted, nil, state.Name+" values")...)
					if expected := b.releases[identity(hr)]; expected != nil {
						p.Changes = append(p.Changes, compareValues(object{"chart": at(expected, "spec", "chart"), "sourceRef": at(expected, "spec", "chartRef")}, object{"chart": at(hr, "spec", "chart"), "sourceRef": at(hr, "spec", "chartRef")}, nil, state.Name+" source")...)
					}
				}
			}
			p.ConfiguredVersion = strings.Join(unique(desiredVersions), ", ")
			p.DeployedVersion = strings.Join(unique(installedVersions), ", ")
			if p.ConfiguredKnown && !p.ConfiguredEnabled {
				p.Note = joinNote(p.Note, "The umbrella disables this package, but a HelmRelease still exists.")
			}
		} else if key == "networkPolicies" && p.ConfiguredKnown && p.ConfiguredEnabled && out.Tag != "" {
			p.Health = "Included"
			p.DeployedVersion = out.Tag
			p.Note = joinNote(p.Note, "Included in the umbrella chart; runtime policy drift is not checked.")
		} else if key != "global" && s.checked("Helm releases") {
			p.Health = "Not installed"
			if p.ConfiguredKnown && !p.ConfiguredEnabled {
				p.Health = "Disabled"
				p.Drift = "Not applicable"
			}
		}
		if p.StandardKnown && p.ConfiguredKnown && p.StandardEnabled != p.ConfiguredEnabled {
			p.Changes = append(p.Changes, &consolev1.ConfigurationChange{Path: "enabled", Category: "Enabled", Standard: strconv.FormatBool(p.StandardEnabled), Configured: strconv.FormatBool(p.ConfiguredEnabled), Deployed: p.Health, Status: "Customized", Source: "Package configuration"})
		}
		if p.StandardVersion != "" && p.DeployedVersion != "" && len(unique(strings.Split(p.DeployedVersion, ", "))) == 1 && p.DeployedVersion != p.StandardVersion {
			p.Changes = append(p.Changes, &consolev1.ConfigurationChange{Path: "chart.version", Category: "Source", Standard: p.StandardVersion, Configured: unknownText(p.ConfiguredVersion), Deployed: p.DeployedVersion, Status: "Different version", Source: "Installed Helm chart"})
		}
		if p.StandardKnown && p.ConfiguredKnown && p.ValuesChecked {
			p.Comparison = "Standard"
		}
		for _, change := range p.Changes {
			if change.Status != "Unknown" {
				p.Comparison = "Customized"
				break
			}
		}
		if !p.ValuesChecked {
			p.Note = joinNote(p.Note, "Comparison is incomplete.")
		}
		out.Packages = append(out.Packages, p)
	}
	out.Images, out.Pods = runtimeImages(s, tag)
	out.Services = serviceEndpoints(s)
	sort.Slice(out.Releases, func(i, j int) bool { return out.Releases[i].Name < out.Releases[j].Name })
	return out
}
func healthPriority(state string) int {
	return map[string]int{"Ready": 0, "Unknown": 1, "Reconciling": 2, "Suspended": 3, "Not ready": 4}[state]
}

func unknownText(value string) string {
	if value == "" {
		return "Not checked"
	}
	return value
}
func joinNote(a, b string) string {
	if b == "" || strings.Contains(a, b) {
		return a
	}
	if a == "" {
		return b
	}
	return a + " " + b
}
func standardReleaseValues(b *comparisonBaseline, hr object) (object, error) {
	if b.err != "" {
		return nil, fmt.Errorf("baseline unavailable")
	}
	expected := b.releases[identity(hr)]
	if expected == nil {
		return object{}, nil
	}
	return resolveValues(expected, b.refs)
}

func (s *Service) PackageComparison(ctx context.Context, tag string, profiles []string, key string, recorded ...bool) (*consolev1.PackageComparison, error) {
	snapshot := s.snapshot(ctx)
	baseline, profiles, _ := s.inspectionBaseline(ctx, snapshot, tag, profiles, len(recorded) > 0 && recorded[0])
	status := inspectSnapshot(snapshot, baseline, tag, profiles)
	var out *consolev1.PackageComparison
	for _, p := range status.Packages {
		if p.Key == key {
			out = p
			break
		}
	}
	if out == nil {
		return nil, fmt.Errorf("package is not in this observation")
	}
	if key == "global" {
		return out, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	for _, hr := range snapshot.objects["Helm releases"] {
		if packageKey(hr) != key {
			continue
		}
		standard, baselineErr := standardReleaseValues(baseline, hr)
		wanted, resolveErr := resolveValues(hr, snapshot.refs)
		var installed object
		var history object
		for _, entry := range list(at(hr, "status", "history")) {
			if str(at(entry, "status")) == "deployed" {
				history = obj(entry)
				break
			}
		}
		name := str(history["name"])
		// Helm records live in Flux's storage namespace, not the workload namespace.
		namespace := str(at(hr, "status", "storageNamespace"))
		if namespace == "" {
			namespace = str(at(hr, "spec", "storageNamespace"))
		}
		if namespace == "" {
			namespace = str(at(hr, "metadata", "namespace"))
		}
		if name != "" && namespace != "" && history["version"] != nil {
			raw, err := clusterCommand(ctx, "helm", "get", "values", name, "-n", namespace, "--all", "-o", "json", "--revision", fmt.Sprint(history["version"]))
			if err == nil {
				if err = json.Unmarshal(raw, &installed); err != nil {
					installed = nil
				}
			}
		}
		if installed == nil {
			note := "No deployed Helm revision was reported; installed package values were not checked."
			if name != "" && namespace != "" && history["version"] != nil {
				note = fmt.Sprintf("Installed Helm values could not be read for %s/%s revision %v. Check release storage and the console's read permissions.", namespace, name, history["version"])
			}
			out.Note = joinNote(out.Note, note)
			out.ValuesChecked = false
		}
		source := str(at(hr, "metadata", "name")) + " values"
		kept := out.Changes[:0]
		for _, change := range out.Changes {
			if change.Source != source {
				kept = append(kept, change)
			}
		}
		out.Changes = kept
		if baselineErr == nil && resolveErr == nil {
			out.Changes = append(out.Changes, compareValues(standard, wanted, installed, source)...)
		}
	}
	return out, nil
}

func resourcePackage(resource object, hrs []object) string {
	namespace := str(at(resource, "metadata", "namespace"))
	instance := str(at(resource, "metadata", "labels", "app.kubernetes.io/instance"))
	name := str(at(resource, "metadata", "labels", "app.kubernetes.io/name"))
	matches := []string{}
	for _, hr := range hrs {
		target := str(at(hr, "spec", "targetNamespace"))
		if target == "" {
			target = str(at(hr, "metadata", "namespace"))
		}
		if namespace != target {
			continue
		}
		key := packageKey(hr)
		matches = append(matches, key)
		release := str(at(hr, "spec", "releaseName"))
		if release == "" {
			release = str(at(hr, "metadata", "name"))
		}
		if instance == release || instance == str(at(hr, "metadata", "name")) || name == key || name == str(at(hr, "metadata", "name")) {
			return key
		}
	}
	matches = unique(matches)
	if len(matches) == 1 {
		return matches[0]
	}
	return "Unassigned"
}
func normalizedImage(ref string) string {
	if ref == "" {
		return ref
	}
	first := strings.Split(ref, "/")[0]
	if !strings.Contains(ref, "/") {
		ref = "docker.io/library/" + ref
	} else if !strings.ContainsAny(first, ".:") && first != "localhost" {
		ref = "docker.io/" + ref
	}
	if strings.HasPrefix(ref, "index.docker.io/") {
		ref = strings.Replace(ref, "index.docker.io/", "docker.io/", 1)
	}
	if !strings.Contains(ref, "@") && !strings.Contains(strings.Split(ref, "/")[len(strings.Split(ref, "/"))-1], ":") {
		ref += ":latest"
	}
	return ref
}
func imageRepository(ref string) string {
	ref = strings.Split(normalizedImage(ref), "@")[0]
	i := strings.LastIndex(ref, "/")
	if n := strings.LastIndex(ref, ":"); n > i {
		ref = ref[:n]
	}
	return ref
}
func runtimeImages(s *clusterSnapshot, tag string) ([]*consolev1.RuntimeImage, []*consolev1.PodCount) {
	engine, _ := roots()
	catalog := catalogImages(engine, tag)
	counts := map[string]*consolev1.PodCount{}
	images := []*consolev1.RuntimeImage{}
	for _, pod := range s.objects["Pods"] {
		phase := str(at(pod, "status", "phase"))
		if phase == "Succeeded" || phase == "Failed" {
			continue
		}
		namespace := str(at(pod, "metadata", "namespace"))
		key := resourcePackage(pod, s.objects["Helm releases"])
		if counts[namespace] == nil {
			counts[namespace] = &consolev1.PodCount{Namespace: namespace}
		}
		ready := false
		for _, c := range list(at(pod, "status", "conditions")) {
			if str(at(c, "type")) == "Ready" && str(at(c, "status")) == "True" {
				ready = true
			}
		}
		if ready {
			counts[namespace].Running++
		} else {
			counts[namespace].Other++
		}
		for _, kind := range []string{"containers", "initContainers"} {
			statuses := map[string]object{}
			statusKey := "containerStatuses"
			if kind == "initContainers" {
				statusKey = "initContainerStatuses"
			}
			for _, state := range list(at(pod, "status", statusKey)) {
				statuses[str(at(state, "name"))] = obj(state)
			}
			for _, container := range list(at(pod, "spec", kind)) {
				name := str(at(container, "name"))
				state := statuses[name]
				image := &consolev1.RuntimeImage{PackageKey: key, Namespace: namespace, Pod: str(at(pod, "metadata", "name")), Container: name, Ref: str(at(container, "image")), Digest: hexDigest(str(state["imageID"])), Ready: flag(state["ready"]), Init: kind == "initContainers", Comparison: "Unlisted"}
				if len(catalog) == 0 {
					image.Comparison = "Not checked"
				}
				if len(image.Digest) != 64 {
					image.Digest = ""
				}
				if image.Digest != "" {
					image.Digest = "sha256:" + image.Digest
				}
				candidates := []string{}
				for _, standard := range catalog {
					if standard.Package != key {
						continue
					}
					if normalizedImage(standard.Ref) == normalizedImage(image.Ref) {
						image.Standard = standard.Ref
						image.Comparison = "Reference matches"
						if standard.Digest != "" && image.Digest != "" {
							if digestHit(standard.Digest, image.Digest) {
								image.Comparison = "Digest matches"
							} else {
								image.Comparison = "Different digest"
							}
						}
						break
					}
					if imageRepository(standard.Ref) == imageRepository(image.Ref) {
						candidates = append(candidates, standard.Ref)
					}
				}
				if image.Standard == "" && len(unique(candidates)) == 1 {
					image.Standard = candidates[0]
					image.Comparison = "Different reference"
				}
				images = append(images, image)
			}
		}
	}
	pods := []*consolev1.PodCount{}
	for _, count := range counts {
		pods = append(pods, count)
	}
	sort.Slice(pods, func(i, j int) bool { return pods[i].Namespace < pods[j].Namespace })
	sort.Slice(images, func(i, j int) bool {
		return images[i].Namespace+images[i].Pod+images[i].Container < images[j].Namespace+images[j].Pod+images[j].Container
	})
	return images, pods
}

func serviceEndpoints(s *clusterSnapshot) []*consolev1.ServiceEndpoint {
	out := []*consolev1.ServiceEndpoint{}
	seen := map[string]bool{}
	add := func(resource object, host, scheme, port, path, source string) {
		if host == "" || strings.ContainsAny(host, "*/@?# \\:") || strings.ContainsAny(path, "\r\n") {
			return
		}
		if port != "" {
			number, err := strconv.Atoi(port)
			if err != nil || number < 1 || number > 65535 {
				return
			}
		}
		authority := host
		if port != "" && !(scheme == "http" && port == "80") && !(scheme == "https" && port == "443") {
			authority += ":" + port
		}
		u := url.URL{Scheme: scheme, Host: authority, Path: path}
		href := u.String()
		if seen[href] {
			return
		}
		seen[href] = true
		out = append(out, &consolev1.ServiceEndpoint{Name: str(at(resource, "metadata", "name")), PackageKey: resourcePackage(resource, s.objects["Helm releases"]), Url: href, Source: source + " · " + identity(resource)})
	}
	for _, ingress := range s.objects["Ingress routes"] {
		tlsHosts := map[string]bool{}
		for _, tls := range list(at(ingress, "spec", "tls")) {
			for _, host := range list(at(tls, "hosts")) {
				tlsHosts[str(host)] = true
			}
		}
		for _, rule := range list(at(ingress, "spec", "rules")) {
			host := str(at(rule, "host"))
			scheme := "http"
			if tlsHosts[host] {
				scheme = "https"
			}
			paths := list(at(rule, "http", "paths"))
			if len(paths) == 0 {
				add(ingress, host, scheme, "", "/", "Ingress")
			}
			for _, path := range paths {
				p := str(at(path, "path"))
				if !strings.ContainsAny(p, "()[]*+") {
					add(ingress, host, scheme, "", p, "Ingress")
				}
			}
		}
	}
	for _, vs := range s.objects["Istio routes"] {
		paths := []string{}
		for _, route := range list(at(vs, "spec", "http")) {
			matches := list(at(route, "match"))
			if len(matches) == 0 {
				paths = append(paths, "/")
			}
			for _, match := range matches {
				if at(match, "uri") == nil {
					paths = append(paths, "/")
					continue
				}
				for _, kind := range []string{"exact", "prefix"} {
					if path := str(at(match, "uri", kind)); strings.HasPrefix(path, "/") {
						paths = append(paths, path)
					}
				}
			}
		}
		for _, gatewayRef := range list(at(vs, "spec", "gateways")) {
			ref := str(gatewayRef)
			if ref == "mesh" {
				continue
			}
			if !strings.Contains(ref, "/") {
				ref = str(at(vs, "metadata", "namespace")) + "/" + ref
			}
			for _, gateway := range s.objects["Istio gateways"] {
				if identity(gateway) != ref {
					continue
				}
				for _, server := range list(at(gateway, "spec", "servers")) {
					protocol := strings.ToLower(str(at(server, "port", "protocol")))
					if protocol != "http" && protocol != "https" {
						continue
					}
					if flag(at(server, "tls", "httpsRedirect")) {
						continue
					}
					for _, host := range list(at(vs, "spec", "hosts")) {
						allowed := false
						for _, pattern := range list(at(server, "hosts")) {
							p := str(pattern)
							if i := strings.Index(p, "/"); i >= 0 {
								scope := p[:i]
								namespace := str(at(vs, "metadata", "namespace"))
								if scope == "." {
									scope = str(at(gateway, "metadata", "namespace"))
								}
								if scope != "*" && scope != namespace {
									continue
								}
								p = p[i+1:]
							}
							if p == "*" || p == str(host) || strings.HasPrefix(p, "*.") && strings.HasSuffix(str(host), p[1:]) {
								allowed = true
							}
						}
						if allowed {
							for _, path := range unique(paths) {
								add(vs, str(host), protocol, fmt.Sprint(at(server, "port", "number")), path, "Istio gateway")
							}
						}
					}
				}
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Url < out[j].Url })
	return out
}
