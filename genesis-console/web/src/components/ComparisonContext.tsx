import { Link, useLocation, useOutletContext, useSearchParams } from "react-router";
import type { ShellContext } from "@/pages/shell-context";
import { formatAgo, formatWhen, withSearch } from "@/lib/cluster";
import { profileSummary } from "@/lib/comparison";
import { ReleaseSelect } from "@/components/ReleaseSelect";

function useComparison() {
  const context = useOutletContext<ShellContext>();
  const [, setParams] = useSearchParams();
  const { tag, cluster, selection, comparisonReady } = context;
  const following = selection.follow === "deployed";
  const automatic = following && context.useRecordedProfiles;
  const reset = () => setParams((current) => {
    const next = new URLSearchParams(current);
    for (const name of ["tag", "follow", "profiles", "profileMode"]) next.delete(name);
    return next;
  });
  return { ...context, following, automatic, reset, crossVersion: Boolean(comparisonReady && cluster.tag && tag && cluster.tag !== tag) };
}

// One line that says what the page is compared against, with a way to change it.
export function ComparisonSummary() {
  const { tag, cluster, selection, useRecordedProfiles, clusterPending, comparisonReady, following, automatic, reset, crossVersion } = useComparison();
  const location = useLocation();
  const onSettings = location.pathname === "/packages" && new URLSearchParams(location.search).get("tab") === "settings";
  return <section aria-label="Comparison" className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="min-w-0">
        <span className="font-medium">{comparisonReady ? `Compared with Genesis ${tag}` : clusterPending ? "Detecting the installed release…" : "No comparison release"}</span>
        {comparisonReady ? <span className="text-[var(--muted)]"> · {following ? "installed release" : "manually selected release"} · {profileSummary(cluster, selection.profiles ?? "", useRecordedProfiles)}</span> : null}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        {!automatic ? <button type="button" onClick={reset} className="text-[var(--primary)] underline underline-offset-2">Reset to automatic</button> : null}
        {onSettings ? null : <Link to={withSearch("/packages", tag, { ...selection, tab: "settings" })} className="rounded-md border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--off)]">Change comparison</Link>}
      </div>
    </div>
    {crossVersion ? <p role="status" className="text-xs text-[var(--muted)]">The cluster runs Genesis {cluster.tag}; release changes can explain differences.</p> : null}
    {!comparisonReady && !clusterPending ? <p role="status" className="text-xs text-[var(--muted)]">The installed release could not be confirmed. Choose a release under Change comparison.</p> : null}
    {cluster.baselineError ? <p role="status" className="text-[var(--amber)]">{cluster.baselineError}</p> : null}
  </section>;
}

export function ComparisonSettings({ availableProfiles, profiles, setProfiles }: { availableProfiles: string[]; profiles: string[]; setProfiles: (next: string[] | null) => void }) {
  const { tag, cluster, useRecordedProfiles, clusterPending } = useComparison();
  const noRecord = cluster.observedAt && (!cluster.provenance || ["Not recorded", "Invalid"].includes(cluster.provenance.status));
  return <div className="space-y-6">
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="font-semibold">Release</h2>
      <ReleaseSelect label="Compare against" />
      <p className="text-sm text-[var(--muted)]">
        Installed: <span className="font-medium text-[var(--foreground)]">{cluster.tag ? `Genesis ${cluster.tag}` : clusterPending ? "reading…" : "not confirmed"}</span>
        {cluster.namespace && cluster.releaseName ? ` · Helm release ${cluster.namespace}/${cluster.releaseName}` : ""}
        {cluster.observedAt ? <> · <span title={formatWhen(cluster.observedAt)}>observed {formatAgo(cluster.observedAt)}</span></> : ""}
      </p>
      <p className="text-sm text-[var(--muted)]">Automatic follows the installed release. Choose another to compare against something else, such as an upgrade target.</p>
    </section>
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div>
        <h2 className="font-semibold">Profiles</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Optional. Profiles add settings to the expected configuration; they never filter which packages are shown and never change the cluster.</p>
      </div>
      <fieldset className="space-y-3">
        <legend className="sr-only">Profile source</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="profile-mode" className="mt-1" checked={useRecordedProfiles} onChange={() => setProfiles(null)} />
          <span><span className="font-medium">Automatic</span> <span className="text-[var(--muted)]">(recommended) · {noRecord ? "this installation has no profile record, so release defaults are used" : profileSummary(cluster, "", true)}</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="profile-mode" className="mt-1" checked={!useRecordedProfiles} onChange={() => setProfiles(profiles)} />
          <span><span className="font-medium">Choose profiles</span> <span className="text-[var(--muted)]">· for an installation without a record, or to test an intended setup. Selecting gitlab, for example, makes GitLab expected to be enabled.</span></span>
        </label>
        <div className={`ml-6 flex flex-wrap gap-x-5 gap-y-3 ${useRecordedProfiles ? "opacity-50" : ""}`}>
          {availableProfiles.map((name) => <label key={name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={useRecordedProfiles} checked={!useRecordedProfiles && profiles.includes(name)} onChange={(event) => setProfiles(event.target.checked ? [...profiles, name] : profiles.filter((p) => p !== name))} />{name}
          </label>)}
        </div>
        {!useRecordedProfiles && profiles.length ? <p className="ml-6 text-xs text-[var(--muted)]">Applied in order: {profiles.join(" → ")}</p> : null}
      </fieldset>
    </section>
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <h2 className="font-semibold">How the comparison works</h2>
      <dl className="grid gap-3 lg:grid-cols-3">
        <div><dt className="font-medium">Comparison release</dt><dd className="mt-1 text-[var(--muted)]">Archived Genesis {tag} defaults plus the profiles above, in order.</dd></div>
        <div><dt className="font-medium">Cluster configuration</dt><dd className="mt-1 text-[var(--muted)]">The cluster’s umbrella values and current HelmRelease specifications, including referenced values.</dd></div>
        <div><dt className="font-medium">Installed</dt><dd className="mt-1 text-[var(--muted)]">Deployed chart versions; package details also read the installed Helm values.</dd></div>
      </dl>
      <p className="text-[var(--muted)]">Differences can come from release changes, profiles, or intentional configuration; they are not health problems. Flux runtime drift is reported separately. A package’s own Git source, such as a mirror, is shown but not counted.</p>
    </section>
  </div>;
}

export function UpgradeGuidance() {
  const { tag, cluster, crossVersion } = useComparison();
  return <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
    <ul className="space-y-2 text-[var(--primary)]">
      <li><a href={`https://github.com/alphabravo-oss/genesis-oss/releases/tag/${encodeURIComponent(tag)}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Genesis {tag} release notes</a></li>
      {crossVersion ? <li><a href={`https://github.com/alphabravo-oss/genesis-oss/compare/${encodeURIComponent(cluster.tag)}..${encodeURIComponent(tag)}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Source changes: installed {cluster.tag} → selected {tag}</a></li> : null}
      <li><a href="https://github.com/alphabravo-oss/genesis-oss/blob/main/docs/upgrades.md" target="_blank" rel="noreferrer" className="underline underline-offset-2">Genesis upgrade guide</a></li>
    </ul>
    <p className="text-[var(--muted)]">Before upgrading, preserve your profile order and custom values, review upstream package migration notes, and back up application data. Version and configuration differences alone do not establish required migrations; the current Genesis release notes are brief snapshot descriptions.</p>
  </section>;
}
