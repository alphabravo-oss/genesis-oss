function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+@\t\r]/.test(text) || /^-(?![\d.])/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCSV(filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob([body + "\r\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
