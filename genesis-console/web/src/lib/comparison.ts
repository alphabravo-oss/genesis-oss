import type { ClusterStatus, ConfigurationChange, PackageComparison } from "../gen/console/v1/console_pb";

export function profileSummary(cluster: Pick<ClusterStatus, "profiles" | "observedAt" | "provenance">, selected: string, recorded: boolean) {
  if (!recorded) return selected ? `Manual profiles, in order: ${selected.split(",").join(" → ")}` : "Manual selection: no profiles; release defaults only";
  if (!cluster.observedAt) return "Recorded installation profiles: not yet confirmed";
  if (cluster.profiles.length) return `Recorded profiles, in order: ${cluster.profiles.join(" → ")}`;
  if (!cluster.provenance || cluster.provenance.status === "Not recorded") return "Installation profiles not recorded; comparing release defaults only";
  if (cluster.provenance.status === "Invalid") return "Installation profile record is invalid; comparing release defaults only";
  return "Recorded selection: no profiles; release defaults only";
}

export function comparisonLabel(status: string) {
  return ({ Standard: "Matches comparison release", Customized: "Differences found", "Not applied": "Installed differs from configured", "Different version": "Installed chart version differs", Unknown: "Comparison unavailable" } as Record<string, string>)[status] ?? status;
}

export function hasComparisonDifference(status: string) {
  return ["Customized", "Different version", "Not applied"].includes(status);
}

export function packageDifferenceSummary(pkg: PackageComparison) {
  const changes = pkg.changes.filter((change) => hasComparisonDifference(change.status));
  const reasons = [];
  if (changes.some((change) => change.status === "Different version")) reasons.push("Installed chart version differs");
  const enablement = new Set(changes.filter((change) => change.category === "Enabled" && (change.source === "Package configuration" || (change.source === "Umbrella values" && [`${pkg.key}.enabled`, `addons.${pkg.key}.enabled`, `packages.${pkg.key}.enabled`].includes(change.path)))));
  if (enablement.size) reasons.push("Enablement differs");
  const settings = new Set(changes.filter((change) => change.status !== "Different version" && !enablement.has(change)).map((change) => `${change.source}/${change.path}`)).size;
  if (settings) reasons.push(`${settings} configuration ${settings === 1 ? "difference" : "differences"}`);
  if (reasons.length) return reasons.join(" · ");
  return pkg.comparison === "Standard" && !pkg.valuesChecked ? "Comparison incomplete" : comparisonLabel(pkg.comparison);
}

export function settingDifference(change: ConfigurationChange) {
  if (change.status === "Unknown") return { configured: false, installed: false, explanation: "Comparison incomplete; a release or cluster value could not be checked." };
  if (change.status === "Different version") return { configured: false, installed: true, explanation: "The installed chart version differs from the comparison release." };
  const configured = change.standard !== change.configured;
  const installed = change.status === "Not applied";
  const explanation = [
    configured && "Cluster configuration differs from the comparison release.",
    installed && "Installed value differs from cluster configuration.",
  ].filter(Boolean).join(" ");
  return { configured, installed, explanation };
}

export function comparisonReady(tag: string, installed: string, following: boolean) {
  return Boolean(tag && (!following || (installed && tag === installed)));
}

export function packageHref(key: string, search: URLSearchParams) {
  const params = new URLSearchParams(search);
  params.delete("pkg");
  for (const name of [...params.keys()]) if (name.startsWith("settings.")) params.delete(name);
  return `/packages${key ? `/${encodeURIComponent(key)}` : ""}${params.size ? `?${params}` : ""}`;
}
