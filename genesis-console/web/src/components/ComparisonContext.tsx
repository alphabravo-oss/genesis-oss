import { Link, useOutletContext } from "react-router";
import type { ShellContext } from "@/pages/shell-context";
import { formatWhen, withSearch } from "@/lib/cluster";
import { profileSummary } from "@/lib/comparison";
import { ReleaseSelect } from "@/components/ReleaseSelect";

export function ComparisonContext() {
  const { tag, cluster, selection, useRecordedProfiles: recorded, clusterPending: pending, comparisonReady } = useOutletContext<ShellContext>();
  const following = selection.follow === "deployed";
  const crossVersion = Boolean(comparisonReady && cluster.tag && tag && cluster.tag !== tag);
  return <section aria-label="Comparison context" className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-1">
        <ReleaseSelect label="Compare against" />
        <p className="font-semibold">{comparisonReady ? `Comparison release · Genesis ${tag}` : pending ? "Detecting installed release…" : "Comparison release unavailable"} <span className="text-xs font-normal text-[var(--muted)]">· {following ? "Follows installed release" : "Manually selected release"}</span></p>
        <p className="break-words text-xs text-[var(--muted)]">{profileSummary(cluster, selection.profiles ?? "", recorded)}</p>
        <Link to={withSearch("/packages", tag, selection) + "#comparison-profiles"} className="text-xs text-[var(--primary)] underline underline-offset-2">Profile options (advanced)</Link>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-[var(--muted)]">Observed cluster</p>
        <p className="break-words font-semibold">{cluster.context || (pending ? "Reading cluster…" : "Cluster not confirmed")} <span className="font-normal">· {cluster.tag ? `Installed Genesis ${cluster.tag}` : "Installed version not confirmed"}</span></p>
        <p className="break-words text-xs text-[var(--muted)]">{cluster.namespace && cluster.releaseName ? `Helm release ${cluster.namespace}/${cluster.releaseName}` : "Helm release not confirmed"}{cluster.observedAt ? ` · Observed ${formatWhen(cluster.observedAt)}` : ""}</p>
      </div>
    </div>
    <details className="text-xs text-[var(--muted)]"><summary className="font-medium text-[var(--foreground)]">How this comparison works</summary><p className="mt-2">Differences can reflect release changes, profiles, or intentional configuration; they do not indicate a problem. Flux runtime drift is separate. Changing this comparison never changes the cluster.</p></details>
    {cluster.baselineError ? <p role="status" className="text-sm text-[var(--amber)]">{cluster.baselineError}</p> : null}
    {crossVersion ? <p role="status" className="text-sm text-[var(--muted)]">Installed Genesis {cluster.tag} vs comparison Genesis {tag}. Release changes can explain differences.</p> : null}
    <details className="border-t border-[var(--border)] pt-3 text-sm">
      <summary className="font-medium">Release notes and upgrade guidance</summary>
      <ul className="mt-2 space-y-2 text-[var(--primary)]">
        <li><a href={`https://github.com/alphabravo-oss/genesis-oss/releases/tag/${encodeURIComponent(tag)}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Genesis {tag} release notes</a></li>
        {crossVersion ? <li><a href={`https://github.com/alphabravo-oss/genesis-oss/compare/${encodeURIComponent(cluster.tag)}..${encodeURIComponent(tag)}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Source changes: installed {cluster.tag} → selected {tag}</a></li> : null}
        <li><a href="https://github.com/alphabravo-oss/genesis-oss/blob/main/docs/upgrades.md" target="_blank" rel="noreferrer" className="underline underline-offset-2">Genesis upgrade guide</a></li>
      </ul>
      <p className="mt-2 text-xs text-[var(--muted)]">Before upgrading, preserve your profile order and custom values, review upstream package migration notes, and back up application data. Version and configuration differences alone do not establish required migrations; the current Genesis release notes are brief snapshot descriptions.</p>
    </details>
  </section>;
}
