import { useSearchParams } from "react-router";
import type { Vulnerability } from "@/gen/console/v1/console_pb";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { fixableCount, hasFix, severityRank, vulnerabilityCounts } from "@/lib/findings";
import { SeverityBadge, SeverityLegend, VulnerabilitySummary } from "@/components/VulnerabilitySummary";

const columns: ColumnDef<Vulnerability, any>[] = [
  { accessorKey: "id", header: "CVE", cell: ({ row }) => row.original.url ? <a className="whitespace-nowrap text-[var(--primary)] underline decoration-[var(--primary)]/40 underline-offset-2" href={row.original.url} target="_blank" rel="noreferrer">{row.original.id}</a> : row.original.id },
  { accessorKey: "severity", header: "Severity", sortingFn: (a, b) => (severityRank[a.original.severity] ?? 0) - (severityRank[b.original.severity] ?? 0), cell: ({ getValue }) => <SeverityBadge severity={getValue()} /> },
  { accessorKey: "packageName", header: "Package" },
  { accessorKey: "installed", header: "Installed", cell: ({ getValue }) => getValue() || "—" },
  { accessorKey: "fixed", header: "Fixed in", cell: ({ row }) => hasFix(row.original) ? row.original.fixed : <span className="text-[var(--muted)]">No fix reported</span> },
  { accessorKey: "title", header: "Finding", cell: ({ getValue }) => getValue() || "—" },
];
const defaultSort = [{ id: "severity", desc: true }];
const search = { placeholder: "Search findings", text: (row: Vulnerability) => [row.id, row.severity, row.packageName, row.installed, row.fixed, row.title].join(" ") };
const facet = { label: "Severity", value: (row: Vulnerability) => row.severity || "UNKNOWN" };

export function FindingList({ rows, allSeverities, urlKey = "findings" }: { rows: Vulnerability[]; allSeverities: boolean; urlKey?: string }) {
  const [params, setParams] = useSearchParams();
  const fix = params.get(`${urlKey}.fix`) ?? "";
  const filtered = fix === "available" ? rows.filter(hasFix) : fix === "unavailable" ? rows.filter((row) => !hasFix(row)) : rows;
  const available = rows.filter(hasFix).length;
  const cves = new Set(rows.map((row) => row.id)).size;
  const counts = vulnerabilityCounts(rows).map((count, index) => !allSeverities && index > 1 ? null : count);
  return <div className="space-y-3">
    {rows.length || allSeverities ? <div className="flex flex-wrap items-center gap-3"><VulnerabilitySummary counts={counts} /><SeverityLegend /></div> : null}
    {!allSeverities ? <p role="status" className="text-sm text-[var(--amber)]">This older scan only collected High and Critical findings. Rescan the image to include Medium, Low, and Unknown.</p> : null}
    {rows.length ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-[var(--muted)]">{cves} CVEs across {rows.length} affected {rows.length === 1 ? "package" : "packages"}; {fixableCount(rows)} CVEs have a fix for at least one package. Fixed versions come from Trivy; rebuild the image with updated packages to apply them.</p>
        <label className="flex flex-wrap items-center gap-2 text-sm">Fix availability
          <select value={fix === "available" || fix === "unavailable" ? fix : ""} onChange={(event) => setParams((current) => {
            const next = new URLSearchParams(current);
            if (event.target.value) next.set(`${urlKey}.fix`, event.target.value);
            else next.delete(`${urlKey}.fix`);
            return next;
          }, { replace: true })} className="h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2">
            <option value="">All findings ({rows.length})</option>
            <option value="available">Fix available ({available})</option>
            <option value="unavailable">No fix reported ({rows.length - available})</option>
          </select>
        </label>
      </div>
      <DataTable key={fix} columns={columns} data={filtered} getRowId={(row) => JSON.stringify([row.id, row.packageName, row.installed])} noun="affected packages" search={search} facet={facet} defaultSort={defaultSort} urlKey={urlKey} exportName="genesis-vulnerabilities" />
    </> : <p className="text-sm text-[var(--muted)]">{allSeverities ? "No vulnerabilities found." : "No saved detailed findings."}</p>}
  </div>;
}
