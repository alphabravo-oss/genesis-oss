import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useOutletContext, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { create } from "@bufbuild/protobuf";
import { PackageComparisonSchema, type PackageComparison, type ConfigurationChange } from "@/gen/console/v1/console_pb";
import type { ShellContext } from "@/pages/shell-context";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { consoleClient } from "@/lib/connect";
import { hasComparisonDifference, packageDifferenceSummary, packageHref, settingDifference } from "@/lib/comparison";
import { ComparisonContext } from "@/components/ComparisonContext";

function PackageLink({ name }: { name: string }) {
  const [params] = useSearchParams();
  return <Link to={packageHref(name, params)} className="font-medium text-[var(--primary)] underline underline-offset-2">{name === "global" ? "Global settings" : name}</Link>;
}
function ComparisonStatus({ pkg }: { pkg: PackageComparison }) {
  return <span title={pkg.note} className={hasComparisonDifference(pkg.comparison) ? "difference-summary inline-block text-xs" : "text-[var(--muted)]"}>{packageDifferenceSummary(pkg)}{!pkg.valuesChecked && hasComparisonDifference(pkg.comparison) ? " · partial" : ""}</span>;
}
const columns: ColumnDef<PackageComparison, any>[] = [
  { accessorKey: "key", header: "Package", cell: ({ row }) => <PackageLink name={row.original.key} /> },
  { id: "standard", header: "Comparison release", accessorFn: (p) => p.standardKnown ? `${p.standardEnabled ? "Enabled" : "Disabled"}${p.standardVersion ? ` · ${p.standardVersion}` : ""}` : "Unknown" },
  { id: "configured", header: "Cluster configuration", accessorFn: (p) => p.configuredKnown ? `${p.configuredEnabled ? "Enabled" : "Disabled"}${p.configuredVersion ? ` · ${p.configuredVersion}` : ""}` : "Unknown" },
  { accessorKey: "deployedVersion", header: "Installed chart", cell: ({ getValue }) => getValue() || "Not confirmed" },
  { accessorKey: "health", header: "Health", cell: ({ getValue }) => <span className={getValue() === "Not ready" ? "font-medium text-[var(--danger)]" : ["Reconciling", "Suspended", "Not installed"].includes(getValue()) ? "text-[var(--amber)]" : ""}>{getValue()}</span> },
  { id: "comparison", accessorFn: packageDifferenceSummary, header: "Comparison result", cell: ({ row }) => <ComparisonStatus pkg={row.original} /> },
  { accessorKey: "drift", header: "Flux runtime drift", cell: ({ getValue }) => <span className={getValue() === "Drifted" ? "font-medium text-[var(--danger)]" : getValue() === "Not checked" ? "text-[var(--muted)]" : ""}>{getValue()}</span> },
];
const valueColumns: ColumnDef<ConfigurationChange, any>[] = [
  { accessorKey: "source", header: "Source" },
  { accessorKey: "path", header: "Setting", cell: ({ row, getValue }) => <><span className="break-all font-mono text-xs">{getValue()}</span><span className="mt-1 block max-w-xs text-xs text-[var(--muted)]">{settingDifference(row.original).explanation}</span></> },
  ...[["standard", "Comparison release"], ["configured", "Cluster configuration"], ["deployed", "Installed values"]].map(([key, header]) => ({ accessorKey: key, header, cell: ({ row, getValue }: { row: { original: ConfigurationChange }; getValue: () => unknown }) => {
    const difference = settingDifference(row.original);
    const changed = key === "configured" && difference.configured || key === "deployed" && difference.installed;
    return <span className={`block min-w-24 max-w-sm break-all font-mono text-xs ${changed ? "difference-value" : ""}`}>{String(getValue())}</span>;
  } })),
];
const search = { placeholder: "Search packages", text: (pkg: PackageComparison) => `${pkg.key} ${pkg.health} ${packageDifferenceSummary(pkg)} ${pkg.drift}` };
const valueSearch = { placeholder: "Search settings", text: (value: ConfigurationChange) => `${value.source} ${value.path} ${value.category}` };

export function PackagesPage() {
  const { detail, cluster, tag, selection, clusterPending, useRecordedProfiles, comparisonReady } = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [availableProfiles, setAvailableProfiles] = useState(cluster.availableProfiles);
  useEffect(() => { if (!clusterPending) setAvailableProfiles(cluster.availableProfiles); }, [cluster.availableProfiles, clusterPending]);
  const state = params.get("state") === "customized" ? "differences" : params.get("state") ?? "all";
  const key = params.get("pkg") ?? "";
  const profiles = useRecordedProfiles ? cluster.profiles : (selection.profiles ? selection.profiles.split(",") : []);
  const tableColumns = useMemo(() => columns.map((column) => column.id === "standard" ? { ...column, header: `Comparison release · Genesis ${tag}` } : column), [tag]);
  useEffect(() => {
    if (location.hash !== "#comparison-profiles") return;
    const editor = document.getElementById("comparison-profiles") as HTMLDetailsElement | null;
    if (editor && !editor.open) {
      editor.open = true;
      editor.querySelector("summary")?.focus({ preventScroll: true });
      const main = document.getElementById("main");
      if (main) main.scrollTo(0, main.scrollTop + editor.getBoundingClientRect().top - main.getBoundingClientRect().top - 16);
    }
  }, [location]);
  const rows = useMemo(() => {
    const byKey = new Map((detail?.packages ?? []).map((pkg) => [pkg.key, create(PackageComparisonSchema, { key: pkg.key, health: "Not observed", drift: "Not checked", comparison: "Unknown" })]));
    for (const pkg of cluster.packages) byKey.set(pkg.key, pkg);
    return [...byKey.values()].filter((pkg) => state === "differences" ? hasComparisonDifference(pkg.comparison) : state === "drift" ? pkg.drift === "Drifted" : state === "attention" ? ["Not ready", "Reconciling", "Suspended"].includes(pkg.health) || (pkg.configuredKnown && pkg.configuredEnabled && pkg.health === "Not installed") : true);
  }, [detail, cluster.packages, selection.profiles, state]);
  function set(name: string, value: string) {
    setParams((current) => { const next = new URLSearchParams(current); if (name === "profiles") next.set("profileMode", "manual"); if (value) next.set(name, value); else next.delete(name); return next; });
  }
  if (key) return <Navigate replace to={packageHref(key, params)} />;
  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Compare a release’s defaults and profiles with this cluster’s configuration and installed packages. Select a package to inspect the settings side by side.</p>
    </div>
    <ComparisonContext />
    <dl className="grid gap-3 text-sm lg:grid-cols-3">
      <div><dt className="font-medium">{comparisonReady ? `Comparison release · Genesis ${tag}` : "Comparison release not confirmed"}</dt><dd className="mt-1 text-[var(--muted)]">Archived Genesis OSS defaults plus the profiles listed above, in order.</dd></div>
      <div><dt className="font-medium">Cluster configuration</dt><dd className="mt-1 text-[var(--muted)]">The cluster’s umbrella values and current HelmRelease specifications, including referenced values.</dd></div>
      <div><dt className="font-medium">Installed packages</dt><dd className="mt-1 text-[var(--muted)]">Deployed chart versions; package details also read the installed Helm values. Flux reports runtime drift separately.</dd></div>
    </dl>
    <details id="comparison-profiles" className="scroll-mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <summary className="text-sm font-medium">Advanced: override comparison profiles · {profiles.length ? `${profiles.length} selected` : "Release defaults"}</summary>
      <p className="mt-2 text-sm"><strong>All packages are inspected regardless of these checkboxes.</strong> Profiles add optional settings to the comparison release; they do not select which packages to inspect.</p>
      {cluster.observedAt && (!cluster.provenance || ["Not recorded", "Invalid"].includes(cluster.provenance.status)) ? <p className="mt-2 text-sm text-[var(--muted)]">This installation has no usable profile record. Automatic comparison uses release defaults. Running packages cannot reliably identify which profile files were applied or their order.</p> : null}
      <p className="mt-2 text-sm text-[var(--muted)]">Normally, use the profiles recorded by the Genesis installer. Override them only for an installation without a profile record, or to compare against a different intended setup. Selecting a profile changes the release defaults used for comparison; it does not install or change anything in the cluster.</p>
      <p className="mt-2 text-xs text-[var(--muted)]">Select only profiles applied to your installation, or ones you deliberately want to compare against. For example, selecting gitlab makes the comparison expect GitLab to be enabled. Selecting every profile can introduce differences that do not describe your installation.</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{useRecordedProfiles ? "Using recorded installation profiles when available." : "Using manually selected profiles."} {!useRecordedProfiles ? <button type="button" className="underline" onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.delete("profiles"); next.delete("profileMode"); return next; })}>Use installation profiles (automatic)</button> : null}</p>
      <fieldset className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
        <legend className="sr-only">Comparison profiles</legend>
        {availableProfiles.map((name) => <label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profiles.includes(name)} onChange={(event) => set("profiles", (event.target.checked ? [...profiles, name] : profiles.filter((p) => p !== name)).join(","))} />{name}</label>)}
      </fieldset>
      {profiles.length ? <p className="mt-2 text-xs text-[var(--muted)]">Applied in order: {profiles.join(" → ")}. <button className="underline" type="button" onClick={() => set("profiles", "")}>Clear profiles</button></p> : null}
    </details>
    <div className="flex flex-wrap gap-2">
      {[["all", "All packages"], ["attention", "Needs attention"], ["differences", "Differences found"], ["drift", "Flux drift detected"]].map(([value, label]) => <button type="button" key={value} aria-pressed={state === value} onClick={() => set("state", value === "all" ? "" : value)} className={`rounded-md border px-3 py-2 text-sm ${state === value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{label}</button>)}
    </div>
    {clusterPending ? <p role="status" className="text-sm text-[var(--muted)]">Reading deployment configuration…</p> : null}
    {comparisonReady ? <DataTable columns={tableColumns} data={rows} getRowId={(row) => row.key} rowHref={(row) => packageHref(row.key, params)} noun="packages" search={search} exportName={`genesis-${tag}-packages`} urlKey="pkgtable" /> : <p role="status" className="text-sm text-[var(--muted)]">{clusterPending ? "Waiting for the installed release before comparing packages…" : "The installed release is not available for comparison. Choose a release above to compare explicitly."}</p>}
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
    <ComparisonContext />
    <section aria-label={`${packageKey} configuration details`} className="space-y-3">
      <h2 className="text-lg font-semibold">Configuration comparison</h2>
      {comparisonReady ? <PackageDetails packageKey={packageKey} tag={tag} profiles={selection.profiles ?? ""} observedAt={cluster.observedAt} useRecordedProfiles={useRecordedProfiles} /> : <p role="status" className="text-sm text-[var(--muted)]">Confirm the installed release or choose a comparison release above to inspect settings.</p>}
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
