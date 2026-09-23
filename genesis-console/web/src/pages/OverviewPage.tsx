import type { ReactNode } from "react";
import { Link, useOutletContext } from "react-router";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import type { ShellContext } from "@/pages/shell-context";
import { formatAgo, formatWhen, plural, withSearch } from "@/lib/cluster";
import { hasComparisonDifference, profileSummary } from "@/lib/comparison";

const unhealthy = ["Not ready", "Reconciling", "Suspended"];

export function OverviewPage() {
  const { cluster, tag, selection, clusterPending, useRecordedProfiles, comparisonReady } = useOutletContext<ShellContext>();
  const link = (path: string, extra?: Record<string, string>) => withSearch(path, tag, { ...selection, ...extra });
  const checked = (name: string) => cluster.checks.some((check) => check.name === name && check.checked);
  const packageRead = checked("Helm releases");
  const podsRead = checked("Pods");
  const findingsUnavailable = cluster.checks.some((check) => check.name === "Saved image findings" && !check.checked);

  const packages = cluster.packages.filter((pkg) => pkg.key !== "global");
  const attention = packages.filter((pkg) => unhealthy.includes(pkg.health) || (pkg.configuredKnown && pkg.configuredEnabled && pkg.health === "Not installed"));
  const installed = packages.filter((pkg) => !["Disabled", "Not installed", "Unknown"].includes(pkg.health));
  const ready = installed.filter((pkg) => pkg.health === "Ready" || pkg.health === "Included").length;
  const drifted = packages.filter((pkg) => pkg.drift === "Drifted");
  const driftUnchecked = installed.filter((pkg) => pkg.drift === "Not checked").length;
  const different = cluster.packages.filter((pkg) => hasComparisonDifference(pkg.comparison)).length;

  // One entry per running image version, keyed like the Images page.
  const images = [...new Map(cluster.images.map((image) => [image.digest || image.ref, image])).values()];
  const scanned = images.filter((image) => image.scanned).length;
  const severe = images.filter((image) => image.scanned && image.critical + image.high > 0)
    .sort((a, b) => b.critical - a.critical || b.high - a.high);
  const failedSources = cluster.checks.filter((check) => !check.checked);

  const actions: ReactNode[] = [
    ...failedSources.map((check) => <Action key={`source-${check.name}`} tone="warn" title={`${check.name} could not be read`} detail={check.message} />),
    ...attention.map((pkg) => <Action key={`pkg-${pkg.key}`} to={link(`/packages/${encodeURIComponent(pkg.key)}`)} tone="warn" title={pkg.key} detail={pkg.health === "Not installed" ? "Enabled but not installed" : pkg.health} />),
    ...drifted.map((pkg) => <Action key={`drift-${pkg.key}`} to={link(`/packages/${encodeURIComponent(pkg.key)}`)} tone="warn" title={pkg.key} detail="Flux reports runtime drift" />),
    ...(findingsUnavailable ? [] : severe.slice(0, 5).map((image) => <Action key={`img-${image.digest || image.ref}`} to={link(`/images/deployed/${encodeURIComponent(image.digest || image.ref)}`)} tone="danger" mono title={image.ref.split("/").at(-1) ?? image.ref} detail={<SeverityCounts critical={image.critical} high={image.high} />} />)),
    ...(severe.length > 5 ? [<Action key="img-more" to={link("/images")} tone="muted" title={`${severe.length - 5} more images with Critical or High findings`} />] : []),
    ...(podsRead && !findingsUnavailable && scanned < images.length ? [<Action key="unscanned" to={link("/images")} tone="muted" title={`${plural(images.length - scanned, "running image")} not scanned yet`} detail="Scan them from Images to complete coverage" />] : []),
  ];

  const headline = clusterPending && !cluster.observedAt ? "Reading the cluster…"
    : [
      packageRead ? (attention.length ? `${attention.length === 1 ? "1 package needs" : `${attention.length} packages need`} attention` : `All ${installed.length} installed packages are ready`) : "Package health not observed",
      findingsUnavailable ? "scan findings unavailable" : severe.length ? `${plural(severe.length, "image")} with Critical or High findings` : scanned ? "no Critical or High findings in scanned images" : null,
    ].filter(Boolean).join(" · ") + ".";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-[var(--muted)]">{headline}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card to={link("/packages", { state: "attention" })} label="Package health" hot={attention.length > 0}
          value={packageRead ? <>{ready}<span className="text-lg font-normal text-[var(--muted)]"> / {installed.length}</span></> : "—"}
          note={packageRead ? (attention.length ? `${attention.length} not ready` : "Installed packages ready") : "Helm releases not read"} />
        <Card to={link("/packages", { state: "drift" })} label="Flux runtime drift" hot={drifted.length > 0}
          value={packageRead ? drifted.length : "—"}
          note={drifted.length ? "Live resources differ from Flux intent" : `No drift detected${driftUnchecked ? ` · ${driftUnchecked} not checked` : ""}`} />
        <Card to={link("/images")} label="Images with Critical or High" hot={severe.length > 0}
          value={podsRead && !findingsUnavailable ? severe.length : "—"}
          note={findingsUnavailable ? "Saved findings unavailable" : `${scanned} of ${images.length} running images scanned`}
          meter={podsRead && !findingsUnavailable && images.length ? scanned / images.length : undefined} />
        <Card to={link("/packages", { state: "differences" })} label={comparisonReady ? `Differences from Genesis ${tag}` : "Configuration differences"}
          value={comparisonReady && cluster.packages.length ? different : "—"}
          note={comparisonReady ? "Informational; not a health finding" : "Comparison release not confirmed"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="attention-title" className="space-y-3">
          <h2 id="attention-title" className="text-lg font-semibold">Needs attention</h2>
          {actions.length ? <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">{actions}</ul>
            : <p className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm">
              <CheckCircle2 className="size-4 text-[var(--primary)]" aria-hidden />{packageRead ? "Nothing needs attention right now." : "Waiting for cluster observations."}
            </p>}
        </section>

        <aside aria-label="Cluster" className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <Row label="Cluster" value={cluster.context || "Unknown"} />
            <Row label="Release" value={cluster.namespace ? `${cluster.namespace}/${cluster.releaseName}` : "Unknown"} />
            <Row label="Installed" value={cluster.tag ? `Genesis ${cluster.tag}` : "Not confirmed"} />
            <Row label="Helm state" value={cluster.deploymentState || "Not observed"} />
            <Row label="Observed" value={cluster.observedAt ? <span title={formatWhen(cluster.observedAt)}>{formatAgo(cluster.observedAt)}</span> : clusterPending ? "Reading…" : "Not observed"} />
          </dl>
          <div className="space-y-1 border-t border-[var(--border)] pt-3">
            <p className="font-medium">Comparison</p>
            <p className="text-[var(--muted)]">{comparisonReady ? `Genesis ${tag} · ${profileSummary(cluster, selection.profiles ?? "", useRecordedProfiles)}` : clusterPending ? "Detecting the installed release…" : "No comparison release"}</p>
            {cluster.baselineError ? <p role="status" className="text-[var(--amber)]">{cluster.baselineError}</p> : null}
            <Link to={link("/packages", { tab: "settings" })} className="text-[var(--primary)] underline underline-offset-2">Change comparison</Link>
          </div>
          <div className="space-y-1 border-t border-[var(--border)] pt-3">
            <p className="font-medium">Installation record · <span className="font-normal">{cluster.provenance?.status || "Not recorded"}</span></p>
            <p className="text-[var(--muted)]">{cluster.provenance?.note || "Use the Genesis installer to record baseline and profile checksums."}</p>
            {cluster.provenance?.profiles.length ? <p>Profiles: {cluster.provenance.profiles.join(" → ")}</p> : null}
            {cluster.provenance?.baselineSha256 ? <p className="truncate font-mono text-xs" title={cluster.provenance.baselineSha256}>SHA-256 {cluster.provenance.baselineSha256}</p> : null}
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            {failedSources.length
              ? <p className="flex items-center gap-2 text-[var(--amber)]"><AlertTriangle className="size-4 shrink-0" aria-hidden />{failedSources.length} of {cluster.checks.length} data sources unavailable; see Needs attention.</p>
              : <p className="flex items-center gap-2 text-[var(--muted)]" title={cluster.checks.map((check) => check.name).join(", ")}><CheckCircle2 className="size-4 shrink-0 text-[var(--primary)]" aria-hidden />{cluster.checks.length ? `All ${cluster.checks.length} data sources read` : "No data sources read yet"}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({ to, label, value, note, hot = false, meter }: { to: string; label: string; value: ReactNode; note: string; hot?: boolean; meter?: number }) {
  return <Link to={to} className={`flex flex-col rounded-lg border p-4 hover:border-[var(--primary)] ${hot ? "border-[var(--amber)] bg-[var(--amber-bg)]" : "border-[var(--border)] bg-[var(--card)]"}`}>
    <span className={`text-sm ${hot ? "text-[var(--amber)]" : "text-[var(--muted)]"}`}>{label}</span>
    <span className={`mt-2 text-3xl font-semibold tabular-nums ${hot ? "text-[var(--amber)]" : ""}`}>{value}</span>
    {meter !== undefined ? <progress aria-label="Scan coverage" className="mt-3 h-1.5 w-full" value={meter} max={1} /> : null}
    <span className="mt-2 text-xs text-[var(--muted)]">{note}</span>
  </Link>;
}

function Action({ to, title, detail, tone, mono = false }: { to?: string; title: string; detail?: ReactNode; tone: "warn" | "danger" | "muted"; mono?: boolean }) {
  const dot = { warn: "bg-[var(--amber)]", danger: "bg-[var(--danger)]", muted: "bg-[var(--border)]" }[tone];
  const body = <>
    <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
    <span className={`min-w-0 flex-1 truncate ${mono ? "font-mono text-xs" : "font-medium"}`}>{title}</span>
    {detail ? <span className="min-w-0 shrink text-right text-[var(--muted)]">{detail}</span> : null}
    {to ? <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden /> : null}
  </>;
  const row = "flex items-center gap-3 px-4 py-3 text-sm";
  return <li>{to ? <Link to={to} className={`${row} hover:bg-[var(--off)]`}>{body}</Link> : <div className={row}>{body}</div>}</li>;
}

function SeverityCounts({ critical, high }: { critical: number; high: number }) {
  return <span className="inline-flex flex-wrap justify-end gap-1 text-xs tabular-nums">
    {critical ? <span className="severity-count rounded px-1.5 py-0.5" data-severity="CRITICAL" data-active>{critical} critical</span> : null}
    {high ? <span className="severity-count rounded px-1.5 py-0.5" data-severity="HIGH" data-active>{high} high</span> : null}
  </span>;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return <><dt className="text-[var(--muted)]">{label}</dt><dd className="min-w-0 truncate text-right font-medium">{value}</dd></>;
}
