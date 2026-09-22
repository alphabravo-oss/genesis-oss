import { Link } from "react-router";
import type { ClusterStatus } from "@/gen/console/v1/console_pb";
import { formatWhen, withSearch } from "@/lib/cluster";
import { profileSummary } from "@/lib/comparison";

export function ComparisonContext({ tag, cluster, selection, recorded, following, pending, page }: {
  tag: string; cluster: ClusterStatus; selection: Record<string, string>; recorded: boolean; following: boolean; pending: boolean; page: string;
}) {
  const crossVersion = Boolean(cluster.tag && tag && cluster.tag !== tag);
  const scope = page === "Images"
    ? `Image comparisons and catalog tabs use the Genesis ${tag} image catalog. Profiles do not change this catalog. Deployed images come from the observed cluster.`
    : page === "Scans"
      ? `Scans assess image contents for vulnerabilities, not configuration differences. Bulk scan buttons use the Genesis ${tag} image catalog; results are matched by image digest.`
      : page === "Services"
        ? "Service addresses come from the observed cluster. Selecting a comparison standard does not change or filter these live routes."
        : "Cluster configuration is compared with the selected standard. Installed package values are checked in package details; Flux runtime drift is a separate check.";
  return <section aria-label="Comparison context" className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-[var(--muted)]">Comparison standard</p>
        <p className="font-semibold">{tag ? `Genesis OSS ${tag}` : "No standard available"} <span className="text-xs font-normal text-[var(--muted)]">· {following ? crossVersion ? "Fallback standard" : "Follows installed version" : "Manually selected version"}</span></p>
        <p className="break-words text-xs text-[var(--muted)]">{profileSummary(cluster, selection.profiles ?? "", recorded)}</p>
        <Link to={withSearch("/packages", tag, selection) + "#comparison-profiles"} className="text-xs text-[var(--primary)] underline underline-offset-2">Profile options (advanced)</Link>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-[var(--muted)]">Observed cluster</p>
        <p className="break-words font-semibold">{cluster.context || (pending ? "Reading cluster…" : "Cluster not confirmed")} <span className="font-normal">· {cluster.tag ? `Installed Genesis ${cluster.tag}` : "Installed version not confirmed"}</span></p>
        <p className="break-words text-xs text-[var(--muted)]">{cluster.namespace && cluster.releaseName ? `Helm release ${cluster.namespace}/${cluster.releaseName}` : "Helm release not confirmed"}{cluster.observedAt ? ` · Observed ${formatWhen(cluster.observedAt)}` : ""}</p>
      </div>
    </div>
    <p className="text-xs text-[var(--muted)]">{scope} Changing the standard or profiles never changes the cluster.</p>
    {crossVersion ? <p role="status" className="text-sm text-[var(--amber)]">Cross-version comparison: installed Genesis {cluster.tag} vs standard {tag}. Differences can come from release changes, not just user customizations.</p> : null}
  </section>;
}
