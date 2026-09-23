import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useOutletContext, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { create } from "@bufbuild/protobuf";
import { PackageComparisonSchema, type PackageComparison, type ConfigurationChange } from "@/gen/console/v1/console_pb";
import type { ShellContext } from "@/pages/shell-context";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { consoleClient } from "@/lib/connect";
import { hasComparisonDifference, packageDifferenceSummary, packageHref, settingDifference, versionText } from "@/lib/comparison";
import { ComparisonSettings, ComparisonSummary, UpgradeGuidance } from "@/components/ComparisonContext";

function PackageLink({ name }: { name: string }) {
  const [params] = useSearchParams();
  return <Link to={packageHref(name, params)} className="font-medium text-[var(--primary)] underline underline-offset-2">{name === "global" ? "Global settings" : name}</Link>;
}
function ComparisonStatus({ pkg }: { pkg: PackageComparison }) {
  return <span title={pkg.note} className={hasComparisonDifference(pkg.comparison) ? "difference-summary inline-block text-xs" : "text-[var(--muted)]"}>{packageDifferenceSummary(pkg)}{!pkg.valuesChecked && hasComparisonDifference(pkg.comparison) ? " · partial" : ""}</span>;
}
const columns: ColumnDef<PackageComparison, any>[] = [
  { accessorKey: "key", header: "Package", cell: ({ row }) => <PackageLink name={row.original.key} /> },
  { id: "standard", header: "Comparison release", accessorFn: (p) => p.standardKnown ? `${p.standardEnabled ? "Enabled" : "Disabled"}${p.standardVersion ? ` · ${versionText(p.standardVersion)}` : ""}` : "Unknown" },
  { id: "configured", header: "Cluster configuration", accessorFn: (p) => p.configuredKnown ? `${p.configuredEnabled ? "Enabled" : "Disabled"}${p.configuredVersion ? ` · ${versionText(p.configuredVersion)}` : ""}` : "Unknown" },
  { accessorKey: "deployedVersion", header: "Installed chart", cell: ({ getValue }) => getValue() || "Not confirmed" },
  { accessorKey: "health", header: "Health", cell: ({ getValue }) => <span className={getValue() === "Not ready" ? "font-medium text-[var(--danger)]" : ["Reconciling", "Suspended", "Not installed"].includes(getValue()) ? "text-[var(--amber)]" : ""}>{getValue()}</span> },
  { id: "comparison", accessorFn: packageDifferenceSummary, header: "Comparison result", cell: ({ row }) => <ComparisonStatus pkg={row.original} /> },
  { accessorKey: "drift", header: "Flux runtime drift", cell: ({ getValue }) => <span className={getValue() === "Drifted" ? "font-medium text-[var(--danger)]" : getValue() === "Not checked" ? "text-[var(--muted)]" : ""}>{getValue()}</span> },
];
const valueColumns: ColumnDef<ConfigurationChange, any>[] = [
  { accessorKey: "source", header: "Source" },
  { accessorKey: "path", header: "Setting", cell: ({ row, getValue }) => {
    const difference = settingDifference(row.original);
    return <div className={difference.configured || difference.installed ? "difference-setting" : ""}><span className="break-all font-mono text-xs">{getValue()}</span><span className="mt-1 block max-w-xs text-xs text-[var(--muted)]">{difference.explanation}</span></div>;
  } },
  ...[["standard", "Comparison release"], ["configured", "Cluster configuration"], ["deployed", "Installed values"]].map(([key, header]) => ({ accessorKey: key, header, cell: ({ row, getValue }: { row: { original: ConfigurationChange }; getValue: () => unknown }) => {
    const difference = settingDifference(row.original);
    const changed = key === "configured" && difference.configured || key === "deployed" && difference.installed;
    return <span className={`block min-w-24 max-w-sm break-all font-mono text-xs ${changed ? "difference-value" : row.original.status === "Installation" ? "text-[var(--muted)]" : ""}`}>{String(getValue())}</span>;
  } })),
];
const search = { placeholder: "Search packages", text: (pkg: PackageComparison) => `${pkg.key} ${pkg.health} ${packageDifferenceSummary(pkg)} ${pkg.drift}` };
const valueSearch = { placeholder: "Search settings", text: (value: ConfigurationChange) => `${value.source} ${value.path} ${value.category}` };

const tabs = [["packages", "Packages"], ["settings", "Comparison settings"], ["upgrade", "Upgrade guidance"]] as const;

export function PackagesPage() {
  const { detail, cluster, tag, selection, clusterPending, useRecordedProfiles, comparisonReady } = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const [availableProfiles, setAvailableProfiles] = useState(cluster.availableProfiles);
  useEffect(() => { if (!clusterPending) setAvailableProfiles(cluster.availableProfiles); }, [cluster.availableProfiles, clusterPending]);
  const tab = tabs.some(([value]) => value === params.get("tab")) ? params.get("tab") : "packages";
  const state = params.get("state") === "customized" ? "differences" : params.get("state") ?? "all";
  const key = params.get("pkg") ?? "";
  const profiles = useRecordedProfiles ? cluster.profiles : (selection.profiles ? selection.profiles.split(",") : []);
  const tableColumns = useMemo(() => columns.map((column) => column.id === "standard" ? { ...column, header: `Comparison release · Genesis ${tag}` } : column), [tag]);
  const rows = useMemo(() => {
    const byKey = new Map((detail?.packages ?? []).map((pkg) => [pkg.key, create(PackageComparisonSchema, { key: pkg.key, health: "Not observed", drift: "Not checked", comparison: "Unknown" })]));
    for (const pkg of cluster.packages) byKey.set(pkg.key, pkg);
    return [...byKey.values()].filter((pkg) => state === "differences" ? hasComparisonDifference(pkg.comparison) : state === "drift" ? pkg.drift === "Drifted" : state === "attention" ? ["Not ready", "Reconciling", "Suspended"].includes(pkg.health) || (pkg.configuredKnown && pkg.configuredEnabled && pkg.health === "Not installed") : true);
  }, [detail, cluster.packages, state]);
  function set(name: string, value: string) {
    setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(name, value); else next.delete(name); return next; });
  }
  // null returns to automatic (recorded) profiles; a list, even empty, is a manual choice.
  function setProfiles(next: string[] | null) {
    setParams((current) => {
      const params = new URLSearchParams(current);
      params.delete("profiles");
      params.delete("profileMode");
      if (next) {
        params.set("profileMode", "manual");
        if (next.length) params.set("profiles", next.join(","));
      }
      return params;
    });
  }
  if (key) return <Navigate replace to={packageHref(key, params)} />;
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Each package’s expected configuration, cluster configuration, installed version, and health. Select a package to compare its settings side by side.</p>
    </div>
    <ComparisonSummary />
    <div role="tablist" aria-label="Packages views" className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
      {tabs.map(([value, label]) => <button key={value} type="button" role="tab" id={`tab-${value}`} aria-selected={tab === value} aria-controls="packages-panel" onClick={() => set("tab", value === "packages" ? "" : value)} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${tab === value ? "border-[var(--primary)] font-medium text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
        {label}{value === "settings" && !useRecordedProfiles ? <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 text-xs text-[var(--primary)]">Manual</span> : null}
      </button>)}
    </div>
    <div id="packages-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
      {tab === "settings" ? <ComparisonSettings availableProfiles={availableProfiles} profiles={profiles} setProfiles={setProfiles} />
        : tab === "upgrade" ? <UpgradeGuidance />
        : <>
          <div className="flex flex-wrap gap-2">
            {[["all", "All packages"], ["attention", "Needs attention"], ["differences", "Differences found"], ["drift", "Flux drift detected"]].map(([value, label]) => <button type="button" key={value} aria-pressed={state === value} onClick={() => set("state", value === "all" ? "" : value)} className={`rounded-full border px-3 py-1 text-sm ${state === value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{label}</button>)}
          </div>
          {/* While the comparison recomputes, placeholder rows would read as "Unknown" everywhere. */}
          {clusterPending ? <p role="status" className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted)]">Comparing packages with Genesis {tag || "the installed release"}…</p>
            : comparisonReady ? <DataTable columns={tableColumns} data={rows} getRowId={(row) => row.key} rowHref={(row) => packageHref(row.key, params)} noun="packages" search={search} exportName={`genesis-${tag}-packages`} urlKey="pkgtable" />
            : <p role="status" className="text-sm text-[var(--muted)]">The installed release is not available for comparison. Choose a release under Comparison settings.</p>}
        </>}
    </div>
  </div>;
}

export function PackagePage() {
  const { cluster, tag, selection, useRecordedProfiles, comparisonReady } = useOutletContext<ShellContext>();
  const { packageKey = "" } = useParams();
  const [params] = useSearchParams();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [packageKey]);
  return <div className="space-y-5">
    <Link to={packageHref("", params)} className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"><ArrowLeft className="size-4" aria-hidden />Back to packages</Link>
    <h1 ref={heading} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight focus:outline-none">{packageKey === "global" ? "Global settings" : packageKey}</h1>
    <ComparisonSummary />
    <section aria-label={`${packageKey} configuration details`} className="space-y-3">
      <h2 className="text-lg font-semibold">Configuration comparison</h2>
      {comparisonReady ? <PackageDetails packageKey={packageKey} tag={tag} profiles={selection.profiles ?? ""} observedAt={cluster.observedAt} useRecordedProfiles={useRecordedProfiles} /> : <p role="status" className="text-sm text-[var(--muted)]">Confirm the installed release or choose one under Change comparison to inspect settings.</p>}
    </section>
  </div>;
}

function PackageDetails({ packageKey, tag, profiles, observedAt, useRecordedProfiles }: { packageKey: string; tag: string; profiles: string; observedAt: string; useRecordedProfiles: boolean }) {
  const query = useQuery({ queryKey: ["package-comparison", tag, profiles, packageKey, observedAt, useRecordedProfiles], queryFn: ({ signal }) => consoleClient.getPackageComparison({ tag, profiles: profiles ? profiles.split(",") : [], packageKey, useRecordedProfiles }, { signal }), enabled: Boolean(observedAt), staleTime: 30_000 });
  const tableColumns = useMemo(() => valueColumns.map((column) => "accessorKey" in column && column.accessorKey === "standard" ? { ...column, header: `Comparison release · Genesis ${tag}` } : column), [tag]);
  if (!observedAt) return <p className="text-sm text-[var(--muted)]">A cluster observation is needed to compare configuration.</p>;
  if (query.error) return <p role="alert" className="text-sm text-[var(--danger)]">{query.error.message}</p>;
  if (!query.data) return <p role="status">Reading installed package values…</p>;
  const pkg = query.data;
  return <div className="space-y-3">
    <p className={`${hasComparisonDifference(pkg.comparison) ? "difference-summary" : ""} inline-block text-sm font-medium`}>{packageDifferenceSummary(pkg)}{!pkg.valuesChecked && hasComparisonDifference(pkg.comparison) ? " · Comparison incomplete" : ""}</p>
    <p className="text-sm">{pkg.health} · Runtime drift: {pkg.drift}. {pkg.note}</p>
    <p className="text-sm text-[var(--muted)]">Genesis {tag} defaults and profiles → cluster configuration → installed Helm values. Sensitive settings are omitted.</p>
    <details className="text-sm text-[var(--muted)]"><summary className="font-medium text-[var(--foreground)]">About these differences</summary><p className="mt-2">The comparison covers enablement, sources and images, replicas, resources, storage, and ingress. Configured values that differ from installed values can reflect a pending rollout; check package health and Flux status. Flux source-reference rows have no corresponding installed Helm value and remain “Not checked.”</p></details>
    {pkg.changes.length ? <DataTable columns={tableColumns} data={pkg.changes} getRowId={(row) => `${row.source}/${row.path}`} noun="settings" search={valueSearch} exportName={`genesis-${tag}-${packageKey}-differences`} urlKey="settings" /> : <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">{pkg.valuesChecked ? "No differences were found in the compared settings." : "A complete comparison is unavailable. No differences shown does not confirm a match with the comparison release."}</p>}
  </div>;
}
