import type { Vulnerability } from "@/gen/console/v1/console_pb";

export function FindingList({ rows }: { rows: Vulnerability[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No high or critical findings.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-[var(--muted)]">
          <tr>
            {["CVE", "Severity", "Package", "Installed", "Fixed", "Finding"].map((heading) => (
              <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id}-${row.packageName}-${index}`} className="border-t border-[var(--border)] align-top">
              <td className="px-3 py-2">
                {row.url ? (
                  <a className="text-[var(--primary)] underline decoration-[var(--primary)]/40 underline-offset-2" href={row.url} target="_blank" rel="noreferrer">
                    {row.id}
                  </a>
                ) : row.id}
              </td>
              <td className={`px-3 py-2 ${row.severity === "CRITICAL" ? "text-[var(--danger)]" : "text-[var(--amber)]"}`}>{row.severity || "—"}</td>
              <td className="px-3 py-2">{row.packageName || "—"}</td>
              <td className="px-3 py-2">{row.installed || "—"}</td>
              <td className="px-3 py-2">{row.fixed || "—"}</td>
              <td className="px-3 py-2">{row.title || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
