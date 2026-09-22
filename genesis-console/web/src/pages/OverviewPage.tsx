import { Link, useOutletContext } from "react-router";
import type { ShellContext } from "@/pages/shell-context";
import { formatWhen, withSearch } from "@/lib/cluster";

export function OverviewPage() {
  const { cluster, tag, selection, clusterPending } = useOutletContext<ShellContext>();
  const packages = cluster.packages.filter((pkg) => pkg.key !== "global");
  const attention = packages.filter((pkg) => ["Not ready", "Reconciling", "Suspended"].includes(pkg.health) || (pkg.configuredKnown && pkg.configuredEnabled && pkg.health === "Not installed"));
  const customized = cluster.packages.filter((pkg) => pkg.comparison === "Customized");
  const drifted = packages.filter((pkg) => pkg.drift === "Drifted");
  const images = [...new Map(cluster.images.map((image) => [image.digest || image.ref, image])).values()];
  const critical = images.filter((image) => image.scanned && image.critical > 0).length;
  const scanned = images.filter((image) => image.scanned).length;
  const packageRead = cluster.checks.some((check) => check.name === "Helm releases" && check.checked);
  const podsRead = cluster.checks.some((check) => check.name === "Pods" && check.checked);
  const findingsUnavailable = cluster.checks.some((check) => check.name === "Saved image findings" && !check.checked);
  const unchecked = packages.filter((pkg) => pkg.drift === "Not checked").length;
  const link = (path: string, extra?: Record<string, string>) => withSearch(path, tag, { ...selection, ...extra });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deployment overview</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">What is installed, how it differs from your baseline, and what needs attention.</p>
      </div>
      {clusterPending ? <p role="status" className="text-sm text-[var(--muted)]">Reading deployment metadata and configuration…</p> : null}
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Fact label="Cluster context" value={cluster.context || "Unknown"} />
        <Fact label="Namespace / release" value={cluster.namespace ? `${cluster.namespace} / ${cluster.releaseName}` : "Unknown"} />
        <Fact label="Installed version" value={cluster.tag || "Not confirmed"} />
        <Fact label="Helm state" value={cluster.deploymentState || "Not observed"} />
      </dl>
      <p className="text-sm text-[var(--muted)]">
        {cluster.versionEvidence || "Installed version requires readable Helm metadata."}
        {cluster.observedAt ? ` · Observed ${formatWhen(cluster.observedAt)}` : ""}
        {cluster.revision ? ` · Fetched source: ${cluster.revision}` : ""}
      </p>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm" aria-label="Installation provenance">
        <p><strong>Installation provenance:</strong> {cluster.provenance?.status || "Not recorded"}</p>
        <p className="mt-1 text-[var(--muted)]">Baseline edition: Genesis OSS · Public images · Relaxed conformance. Live configuration may differ.</p>
        <p className="mt-1 text-[var(--muted)]">{cluster.provenance?.note || "Use the Genesis installer to record baseline and profile checksums."}</p>
        {cluster.provenance?.baselineSha256 ? <p className="mt-2 break-all font-mono text-xs">Baseline SHA-256: {cluster.provenance.baselineSha256}</p> : null}
        {cluster.provenance?.profiles.length ? <p className="mt-1">Recorded profiles: {cluster.provenance.profiles.join(" → ")}</p> : null}
        {cluster.provenance?.customValues ? <p className="mt-1 text-[var(--muted)]">Additional custom values were supplied during installation.</p> : null}
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Attention label="Packages needing attention" value={packageRead ? attention.length : "—"} note="Readiness and reconciliation" to={link("/packages", { state: "attention" })} hot={attention.length > 0} />
        <Attention label="Customized packages" value={cluster.packages.length ? customized.length : "—"} note={`${cluster.packages.filter((pkg) => pkg.comparison === "Unknown").length} comparisons unknown`} to={link("/packages", { state: "customized" })} hot={false} />
        <Attention label="Drift detected" value={packageRead ? drifted.length : "—"} note={`${unchecked} packages not checked`} to={link("/packages", { state: "drift" })} hot={drifted.length > 0} />
        <Attention label="Images with critical findings" value={podsRead && !findingsUnavailable ? critical : "—"} note={findingsUnavailable ? "Saved scan findings are unavailable" : `${scanned} of ${images.length} observed images have saved scans`} to={link("/images", { view: "deployed" })} hot={critical > 0} />
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Needs attention</h2>
          <Link to={link("/packages")} className="text-sm text-[var(--primary)] underline underline-offset-2">View all packages</Link>
        </div>
        {attention.length ? <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {attention.map((pkg) => <li key={pkg.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link to={link("/packages", { pkg: pkg.key })} className="font-medium text-[var(--primary)] underline underline-offset-2">{pkg.key}</Link>
            <span className="text-sm text-[var(--amber)]">{pkg.health}</span>
          </li>)}
        </ul> : <p className="text-sm text-[var(--muted)]">{packageRead ? "No readiness issues were reported by the observed HelmReleases. Review coverage below for checks that are unavailable." : "Package health has not been observed."}</p>}
      </section>
      <details className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <summary className="cursor-pointer font-medium">Observation coverage · {cluster.checks.filter((check) => check.checked).length}/{cluster.checks.length} sources read</summary>
        <p className="mt-3 text-sm text-[var(--muted)]">Drift results come from Flux and honor its configured exclusions. A customization is a declared difference from the selected baseline; it does not imply drift.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {cluster.checks.map((check) => <li key={check.name}><strong>{check.name}:</strong> {check.checked ? "Read successfully" : check.message}</li>)}
        </ul>
      </details>
    </div>
  );
}

function Attention({ label, value, note, to, hot }: { label: string; value: number | string; note: string; to: string; hot: boolean }) {
  return <Link to={to} className={`rounded-lg border p-4 hover:border-[var(--primary)] ${hot ? "border-[var(--amber)] bg-[var(--amber-bg)] text-[var(--amber)]" : "border-[var(--border)] bg-[var(--card)]"}`}>
    <div className="text-sm">{label}</div>
    <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    <p className="mt-2 text-xs text-[var(--muted)]">{note}</p>
  </Link>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>;
}
