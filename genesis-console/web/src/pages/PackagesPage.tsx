import { useEffect, useMemo } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { create } from "@bufbuild/protobuf";
import { PackageComparisonSchema, type PackageComparison, type ConfigurationChange } from "@/gen/console/v1/console_pb";
import type { ShellContext } from "@/pages/shell-context";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { consoleClient } from "@/lib/connect";

function PackageLink({ name }: { name: string }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params); next.set("pkg", name);
  return <Link to={`?${next}#package-details`} className="font-medium text-[var(--primary)] underline underline-offset-2">{name === "global" ? "Global settings" : name}</Link>;
}
const columns: ColumnDef<PackageComparison, any>[] = [
  { accessorKey: "key", header: "Package", cell: ({ row }) => <PackageLink name={row.original.key} /> },
  { id: "standard", header: "Standard", accessorFn: (p) => p.standardKnown ? `${p.standardEnabled ? "Enabled" : "Disabled"}${p.standardVersion ? ` · ${p.standardVersion}` : ""}` : "Unknown" },
  { id: "configured", header: "Configured", accessorFn: (p) => p.configuredKnown ? `${p.configuredEnabled ? "Enabled" : "Disabled"}${p.configuredVersion ? ` · ${p.configuredVersion}` : ""}` : "Unknown" },
  { accessorKey: "deployedVersion", header: "Deployed chart", cell: ({ getValue }) => getValue() || "Not confirmed" },
  { accessorKey: "health", header: "Health", cell: ({ getValue }) => <span className={getValue() === "Not ready" ? "font-medium text-[var(--danger)]" : ["Reconciling", "Suspended", "Not installed"].includes(getValue()) ? "text-[var(--amber)]" : ""}>{getValue()}</span> },
  { accessorKey: "comparison", header: "Configuration", cell: ({ row }) => <span title={row.original.note}>{row.original.comparison}{!row.original.valuesChecked ? " · partial" : ""}</span> },
  { accessorKey: "drift", header: "Runtime drift", cell: ({ getValue }) => <span className={getValue() === "Drifted" ? "font-medium text-[var(--danger)]" : getValue() === "Not checked" ? "text-[var(--muted)]" : ""}>{getValue()}</span> },
];
const valueColumns: ColumnDef<ConfigurationChange, any>[] = [
  { accessorKey: "source", header: "Source" },
  { accessorKey: "path", header: "Setting", cell: ({ getValue }) => <span className="break-all font-mono text-xs">{getValue()}</span> },
  ...["standard", "configured", "deployed"].map((key) => ({ accessorKey: key, header: key[0].toUpperCase() + key.slice(1), cell: ({ getValue }: { getValue: () => unknown }) => <span className="block max-w-sm break-all font-mono text-xs">{String(getValue())}</span> })),
  { accessorKey: "status", header: "Comparison" },
];
const search = { placeholder: "Search packages", text: (pkg: PackageComparison) => `${pkg.key} ${pkg.health} ${pkg.comparison} ${pkg.drift}` };
const valueSearch = { placeholder: "Search settings", text: (value: ConfigurationChange) => `${value.source} ${value.path} ${value.category}` };

export function PackagesPage() {
  const { detail, cluster, tag, selection, clusterPending, useRecordedProfiles } = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const state = params.get("state") ?? "all";
  const key = params.get("pkg") ?? "";
  const profiles = useRecordedProfiles ? cluster.profiles : (selection.profiles ? selection.profiles.split(",") : []);
  useEffect(() => {
    if (!key) return;
    const section = document.getElementById("package-details");
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: "start" });
  }, [key]);
  const rows = useMemo(() => {
    const byKey = new Map((detail?.packages ?? []).map((pkg) => [pkg.key, create(PackageComparisonSchema, { key: pkg.key, health: "Not observed", drift: "Not checked", comparison: "Unknown" })]));
    for (const pkg of cluster.packages) byKey.set(pkg.key, pkg);
    return [...byKey.values()].filter((pkg) => state === "customized" ? pkg.comparison === "Customized" : state === "drift" ? pkg.drift === "Drifted" : state === "attention" ? ["Not ready", "Reconciling", "Suspended"].includes(pkg.health) || (pkg.configuredKnown && pkg.configuredEnabled && pkg.health === "Not installed") : true);
  }, [detail, cluster.packages, selection.profiles, state]);
  function set(name: string, value: string) {
    setParams((current) => { const next = new URLSearchParams(current); if (name === "profiles") next.set("profileMode", "manual"); if (value) next.set(name, value); else next.delete(name); return next; });
  }
  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Compare the Genesis baseline with configured packages and observed deployments. Select a package to inspect its settings.</p>
    </div>
    <details className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <summary className="text-sm font-medium">Baseline {tag} · {profiles.length ? `${profiles.length} selected profile${profiles.length === 1 ? "" : "s"}` : "Standard Genesis values"}</summary>
      <p className="mt-2 text-sm text-[var(--muted)]">Profiles change the comparison baseline only. They do not change the cluster. The Genesis installer records profiles for automatic comparison. For older installations, select the profiles you intended to apply.</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{useRecordedProfiles ? "Using recorded installation profiles when available." : "Using manually selected profiles."} {!useRecordedProfiles ? <button type="button" className="underline" onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.delete("profiles"); next.delete("profileMode"); return next; })}>Use recorded profiles</button> : null}</p>
      <fieldset className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
        <legend className="sr-only">Baseline profiles</legend>
        {cluster.availableProfiles.map((name) => <label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profiles.includes(name)} onChange={(event) => set("profiles", (event.target.checked ? [...profiles, name] : profiles.filter((p) => p !== name)).join(","))} />{name}</label>)}
      </fieldset>
      {profiles.length ? <p className="mt-2 text-xs text-[var(--muted)]">Applied in order: {profiles.join(" → ")}. <button className="underline" type="button" onClick={() => set("profiles", "")}>Clear profiles</button></p> : null}
    </details>
    <div className="flex flex-wrap gap-2">
      {[["all", "All packages"], ["attention", "Needs attention"], ["customized", "Customizations"], ["drift", "Drift detected"]].map(([value, label]) => <button type="button" key={value} aria-pressed={state === value} onClick={() => set("state", value === "all" ? "" : value)} className={`rounded-md border px-3 py-2 text-sm ${state === value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{label}</button>)}
    </div>
    {clusterPending ? <p role="status" className="text-sm text-[var(--muted)]">Reading deployment configuration…</p> : null}
    <DataTable columns={columns} data={rows} getRowId={(row) => row.key} noun="packages" search={search} exportName={`genesis-${tag}-packages`} urlKey="pkgtable" />
    {key ? <section id="package-details" tabIndex={-1} aria-label={`${key} configuration details`} className="scroll-mt-4 space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{key === "global" ? "Global settings" : key}</h2><button type="button" className="text-sm text-[var(--primary)] underline" onClick={() => set("pkg", "")}>Close details</button></div>
      <PackageDetails packageKey={key} tag={tag} profiles={selection.profiles ?? ""} observedAt={cluster.observedAt} useRecordedProfiles={useRecordedProfiles} />
    </section> : null}
  </div>;
}

function PackageDetails({ packageKey, tag, profiles, observedAt, useRecordedProfiles }: { packageKey: string; tag: string; profiles: string; observedAt: string; useRecordedProfiles: boolean }) {
  const query = useQuery({ queryKey: ["package-comparison", tag, profiles, packageKey, observedAt, useRecordedProfiles], queryFn: ({ signal }) => consoleClient.getPackageComparison({ tag, profiles: profiles ? profiles.split(",") : [], packageKey, useRecordedProfiles }, { signal }), enabled: Boolean(observedAt), staleTime: 30_000 });
  if (!observedAt) return <p className="text-sm text-[var(--muted)]">A cluster observation is needed to compare configuration.</p>;
  if (query.error) return <p role="alert" className="text-sm text-[var(--danger)]">{query.error.message}</p>;
  if (!query.data) return <p role="status">Reading installed package values…</p>;
  const pkg = query.data;
  return <div className="space-y-3">
    <p className="text-sm">{pkg.health} · Runtime drift: {pkg.drift}. {pkg.note}</p>
    <p className="text-sm text-[var(--muted)]">Compares enablement, sources and images, replicas, resources, storage, and ingress. Sensitive settings are omitted. “Not applied” means the configured value differs from installed Helm values; it can indicate a pending or failed rollout.</p>
    {pkg.changes.length ? <DataTable columns={valueColumns} data={pkg.changes} getRowId={(row) => `${row.source}/${row.path}`} noun="differences" search={valueSearch} exportName={`genesis-${tag}-${packageKey}-differences`} urlKey="settings" /> : <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">{pkg.valuesChecked ? "No differences were found in the compared settings." : "A complete comparison is unavailable. No differences shown does not confirm that this package is standard."}</p>}
  </div>;
}
