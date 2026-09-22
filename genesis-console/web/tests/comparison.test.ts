import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { ClusterStatusSchema } from "../src/gen/console/v1/console_pb.ts";
import { comparisonLabel, comparisonRowClass, profileSummary } from "../src/lib/comparison.ts";

test("comparison labels distinguish chosen profiles, unconfirmed observations, and the sides that differ", () => {
  const cluster = create(ClusterStatusSchema);
  assert.equal(profileSummary(cluster, "argocd,ca-trust,enforce-labels,gitlab", false), "Manual profiles, in order: argocd → ca-trust → enforce-labels → gitlab");
  assert.match(profileSummary(cluster, "", false), /no profiles; standard values only/);
  assert.match(profileSummary(cluster, "", true), /not yet confirmed/);
  cluster.observedAt = "2026-09-22T00:00:00Z";
  assert.match(profileSummary(cluster, "ignored", true), /No recorded profiles applied/);
  cluster.profiles = ["gitlab", "argocd"];
  assert.equal(profileSummary(cluster, "ignored", true), "Recorded profiles, in order: gitlab → argocd");
  assert.equal(comparisonLabel("Customized"), "Differs from standard");
  assert.equal(comparisonLabel("Not applied"), "Installed differs from configured");
  assert.equal(comparisonLabel("Different version"), "Installed version differs from standard");
  assert.equal(comparisonLabel("Standard"), "Matches standard");
  assert.equal(comparisonLabel("Unknown"), "Unknown");
  for (const status of ["Customized", "Different version", "Not applied"]) assert.equal(comparisonRowClass(status), "comparison-difference");
  for (const status of ["Standard", "Unknown", "Not checked", ""]) assert.equal(comparisonRowClass(status), "");
});
