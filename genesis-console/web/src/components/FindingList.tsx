import type { Vulnerability } from "@/gen/console/v1/console_pb";
import { DataTable, type ColumnDef } from "@/components/DataTable";

const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
const columns: ColumnDef<Vulnerability, any>[] = [
  { accessorKey: "id", header: "CVE", cell: ({ row }) => row.original.url ? <a className="text-[var(--primary)] underline decoration-[var(--primary)]/40 underline-offset-2" href={row.original.url} target="_blank" rel="noreferrer">{row.original.id}</a> : row.original.id },
  { accessorKey: "severity", header: "Severity", sortingFn: (a, b) => (severityRank[a.original.severity] ?? 0) - (severityRank[b.original.severity] ?? 0), cell: ({ getValue }) => <span className={getValue() === "CRITICAL" ? "text-[var(--danger)]" : getValue() === "HIGH" ? "text-[var(--amber)]" : "text-[var(--muted)]"}>{getValue() || "UNKNOWN"}</span> },
  { accessorKey: "packageName", header: "Package" },
  { accessorKey: "installed", header: "Installed", cell: ({ getValue }) => getValue() || "—" },
  { accessorKey: "fixed", header: "Fixed", cell: ({ getValue }) => getValue() || "—" },
  { accessorKey: "title", header: "Finding", cell: ({ getValue }) => getValue() || "—" },
];
const defaultSort = [{ id: "severity", desc: true }];
const search = { placeholder: "Search findings", text: (row: Vulnerability) => [row.id, row.severity, row.packageName, row.installed, row.fixed, row.title].join(" ") };
const facet = { label: "Severity", value: (row: Vulnerability) => row.severity || "UNKNOWN" };

export function FindingList({ rows, allSeverities, urlKey = "findings" }: { rows: Vulnerability[]; allSeverities: boolean; urlKey?: string }) {
  return <div className="space-y-3">
    {!allSeverities ? <p role="status" className="text-sm text-[var(--amber)]">This older scan only collected High and Critical findings. Rescan the image to include Medium, Low, and Unknown.</p> : null}
    {rows.length ? <DataTable columns={columns} data={rows} getRowId={(row) => JSON.stringify([row.id, row.packageName, row.installed])} noun="findings" search={search} facet={facet} defaultSort={defaultSort} urlKey={urlKey} exportName="genesis-vulnerabilities" /> : <p className="text-sm text-[var(--muted)]">{allSeverities ? "No vulnerabilities found." : "No saved detailed findings."}</p>}
  </div>;
}
