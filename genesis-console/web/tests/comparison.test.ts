import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { ClusterStatusSchema, ConfigurationChangeSchema, InstallationProvenanceSchema, PackageComparisonSchema } from "../src/gen/console/v1/console_pb.ts";
import { comparisonLabel, comparisonReady, hasComparisonDifference, packageDifferenceSummary, packageHref, profileSummary, settingDifference } from "../src/lib/comparison.ts";

test("comparison labels distinguish chosen profiles, unconfirmed observations, and the sides that differ", () => {
  const cluster = create(ClusterStatusSchema);
  assert.equal(profileSummary(cluster, "argocd,ca-trust,enforce-labels,gitlab", false), "Manual profiles, in order: argocd → ca-trust → enforce-labels → gitlab");
  assert.match(profileSummary(cluster, "", false), /no profiles; release defaults only/);
  assert.match(profileSummary(cluster, "", true), /not yet confirmed/);
  cluster.observedAt = "2026-09-22T00:00:00Z";
  assert.match(profileSummary(cluster, "ignored", true), /Installation profiles not recorded/);
  cluster.provenance = create(InstallationProvenanceSchema, { status: "Invalid" });
  assert.match(profileSummary(cluster, "ignored", true), /record is invalid/);
  cluster.provenance.status = "Verified";
  assert.match(profileSummary(cluster, "ignored", true), /Recorded selection: no profiles/);
  cluster.profiles = ["gitlab", "argocd"];
  assert.equal(profileSummary(cluster, "ignored", true), "Recorded profiles, in order: gitlab → argocd");
  assert.equal(comparisonLabel("Customized"), "Differences found");
  assert.equal(comparisonLabel("Not applied"), "Installed differs from configured");
  assert.equal(comparisonLabel("Different version"), "Installed chart version differs");
  assert.equal(comparisonLabel("Standard"), "Matches comparison release");
  assert.equal(comparisonLabel("Unknown"), "Comparison unavailable");
  for (const status of ["Customized", "Different version", "Not applied"]) assert.equal(hasComparisonDifference(status), true);
  for (const status of ["Standard", "Unknown", "Not checked", ""]) assert.equal(hasComparisonDifference(status), false);
});

test("package pages preserve the comparison and list filters without leaking detail filters", () => {
  const params = new URLSearchParams("tag=3.32.0&profiles=gitlab,argocd&profileMode=manual&follow=deployed&state=customized&pkgtable.q=graf&pkgtable.sort=-comparison&pkg=old&settings.q=replicas");
  const url = new URL(packageHref("grafana", params), "http://localhost");
  assert.equal(url.pathname, "/packages/grafana");
  for (const key of ["tag", "profiles", "profileMode", "follow", "state", "pkgtable.q", "pkgtable.sort"]) assert.equal(url.searchParams.get(key), params.get(key));
  assert.equal(url.searchParams.has("pkg"), false);
  assert.equal(url.searchParams.has("settings.q"), false);
  assert.equal(params.get("pkg"), "old");
  assert.equal(packageHref("", url.searchParams), `/packages?${url.searchParams}`);
  assert.equal(packageHref("a/b?c", new URLSearchParams()), "/packages/a%2Fb%3Fc");
});

test("package summaries name confirmed differences without treating missing data as a difference", () => {
  const pkg = create(PackageComparisonSchema, { key: "grafana", comparison: "Standard", valuesChecked: true });
  assert.equal(packageDifferenceSummary(pkg), "Matches comparison release");
  pkg.valuesChecked = false;
  assert.equal(packageDifferenceSummary(pkg), "Comparison incomplete");
  pkg.comparison = "Unknown";
  pkg.changes = [create(ConfigurationChangeSchema, { path: "replicas", status: "Unknown" })];
  assert.equal(packageDifferenceSummary(pkg), "Comparison unavailable");
  pkg.comparison = "Customized";
  pkg.changes = [
    { source: "Installed Helm chart", path: "chart.version", status: "Different version" },
    { source: "Package configuration", path: "enabled", category: "Enabled", status: "Customized" },
    { source: "Umbrella values", path: "grafana.enabled", category: "Enabled", status: "Customized" },
    { source: "grafana values", path: "replicas", status: "Customized" },
    { source: "grafana values", path: "replicas", status: "Customized" },
    { source: "grafana values", path: "resources.cpu", status: "Not applied" },
    { source: "grafana values", path: "image.tag", status: "Unknown" },
  ].map((change) => create(ConfigurationChangeSchema, change));
  assert.equal(packageDifferenceSummary(pkg), "Installed chart version differs · Enablement differs · 2 configuration differences");
  pkg.changes = [pkg.changes[3]];
  assert.equal(packageDifferenceSummary(pkg), "1 configuration difference");
  pkg.changes = [create(ConfigurationChangeSchema, { source: "grafana values", path: "ingress.enabled", category: "Enabled", status: "Customized" })];
  assert.equal(packageDifferenceSummary(pkg), "1 configuration difference");
  pkg.changes = [];
  assert.equal(packageDifferenceSummary(pkg), "Differences found");
});

test("automatic comparison waits for the installed release instead of substituting another release", () => {
  assert.equal(comparisonReady("3.33.0", "", true), false);
  assert.equal(comparisonReady("3.33.0", "3.32.0", true), false);
  assert.equal(comparisonReady("3.32.0", "3.32.0", true), true);
  assert.equal(comparisonReady("3.32.0", "3.33.0", false), true);
  assert.equal(comparisonReady("3.32.0", "", false), true);
  assert.equal(comparisonReady("", "3.33.0", false), false);
});

test("setting explanations identify which comparison sides differ without claiming a cause", () => {
  const explain = (standard: string, configured: string, deployed: string, status: string) => settingDifference(create(ConfigurationChangeSchema, { standard, configured, deployed, status }));
  assert.deepEqual(explain("1", "2", "2", "Customized"), { configured: true, installed: false, explanation: "Cluster configuration differs from the comparison release." });
  assert.deepEqual(explain("1", "2", "3", "Not applied"), { configured: true, installed: true, explanation: "Cluster configuration differs from the comparison release. Installed value differs from cluster configuration." });
  assert.deepEqual(explain("1", "1", "3", "Not applied"), { configured: false, installed: true, explanation: "Installed value differs from cluster configuration." });
  assert.deepEqual(explain("1", "2", "Not checked", "Customized"), { configured: true, installed: false, explanation: "Cluster configuration differs from the comparison release." });
  assert.deepEqual(explain("1", "Not checked", "Not checked", "Unknown"), { configured: false, installed: false, explanation: "Comparison incomplete; a release or cluster value could not be checked." });
  assert.deepEqual(explain("1.0", "Not checked", "2.0", "Different version"), { configured: false, installed: true, explanation: "The installed chart version differs from the comparison release." });
});
