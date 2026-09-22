import type { ClusterStatus } from "../gen/console/v1/console_pb";

export function profileSummary(cluster: Pick<ClusterStatus, "profiles" | "observedAt" | "provenance">, selected: string, recorded: boolean) {
  if (!recorded) return selected ? `Manual profiles, in order: ${selected.split(",").join(" → ")}` : "Manual selection: no profiles; standard values only";
  if (!cluster.observedAt) return "Recorded installation profiles: not yet confirmed";
  if (cluster.profiles.length) return `Recorded profiles, in order: ${cluster.profiles.join(" → ")}`;
  if (!cluster.provenance || ["Not recorded", "Invalid"].includes(cluster.provenance.status)) return "No recorded profiles applied; using standard values only";
  return "Recorded selection: no profiles; standard values only";
}

export function comparisonLabel(status: string) {
  return ({ Standard: "Matches standard", Customized: "Differs from standard", "Not applied": "Installed differs from configured", "Different version": "Installed version differs from standard" } as Record<string, string>)[status] ?? status;
}
