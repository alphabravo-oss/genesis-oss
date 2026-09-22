import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronRight, Columns3, Download, Rows3, Search } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

declare module "@tanstack/react-table" {
  // The augmentation is keyed by the library's unused type parameters.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    csv?: (row: TData) => unknown;
  }
}

export type { ColumnDef };

type Facet<T> = {
  label: string;
  value: (row: T) => string | string[];
};

function facetValues<T>(facet: Facet<T>, row: T): string[] {
  const values = [facet.value(row)].flat();
  return values.length ? values.map((value) => value || "—") : ["—"];
}

type Props<T> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  getRowId: (row: T) => string;
  rowClassName?: (row: T) => string;
  noun?: string;
  search?: { placeholder: string; text?: (row: T) => string };
  facet?: Facet<T>;
  exportName?: string;
  urlKey?: string;
  defaultSort?: SortingState;
  selectable?: boolean;
  selected?: string[];
  onSelected?: (ids: string[]) => void;
  /** When this returns content, the row opens that panel. */
  detail?: (row: T) => ReactNode | null;
  detailLabel?: string;
};

export function DataTable<T>(props: Props<T>) {
  const [params, setParams] = useSearchParams();
  const key = props.urlKey ? `${props.urlKey}.` : "";
  const q = params.get(`${key}q`) ?? "";
  const facet = params.get(`${key}f`) ?? "";
  const rawSort = params.get(`${key}sort`);
  const sorting: SortingState = useMemo(() => rawSort
    ? [{ id: rawSort.replace(/^-/, ""), desc: rawSort.startsWith("-") }]
    : (props.defaultSort ?? []), [rawSort, props.defaultSort]);
  const set = (name: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(`${key}${name}`, value);
      else next.delete(`${key}${name}`);
      return next;
    }, { replace: true });
  };
  return (
    <TableCore
      {...props}
      q={q}
      facetValue={facet}
      sorting={sorting}
      clearFilters={() => setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete(`${key}q`);
        next.delete(`${key}f`);
        return next;
      }, { replace: true })}
      setQ={(value) => set("q", value)}
      setFacet={(value) => set("f", value)}
      setSorting={(next) => set("sort", next[0] ? `${next[0].desc ? "-" : ""}${next[0].id}` : "")}
    />
  );
}

function TableCore<T>({
  columns,
  data,
  getRowId,
  rowClassName,
  noun = "rows",
  search,
  facet,
  exportName,

  selectable,
  selected,
  onSelected,
  detail,
  detailLabel = "Findings",
  q,
  facetValue,
  sorting,
  setQ,
  setFacet,
  setSorting,
  clearFilters,
}: Props<T> & {
  q: string;
  facetValue: string;
  sorting: SortingState;
  setQ: (value: string) => void;
  setFacet: (value: string) => void;
  setSorting: (sorting: SortingState) => void;
  clearFilters: () => void;
}) {
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem("genesis-console-density") === "compact";
    } catch {
      return false;
    }
  });
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selected) return;
    setPicked(Object.fromEntries(selected.map((id) => [id, true])));
  }, [selected]);

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    const text = search?.text ?? ((row: T) => JSON.stringify(row));
    return data.filter((row) => text(row).toLowerCase().includes(needle));
  }, [data, q, search]);

  const counts = useMemo(() => {
    if (!facet) return [];
    const map = new Map<string, number>();
    for (const row of searched) {
      for (const value of facetValues(facet, row)) map.set(value, (map.get(value) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [facet, searched]);

  const shown = useMemo(
    () => (facet && facetValue ? searched.filter((row) => facetValues(facet, row).includes(facetValue)) : searched),
    [facet, facetValue, searched],
  );

  const selectColumn: ColumnDef<T, unknown> = {
    id: "_select",
    header: () => (
      <input
        type="checkbox"
        aria-label="Select all filtered rows"
        checked={shown.length > 0 && shown.every((row) => picked[getRowId(row)])}
        ref={(input) => { if (input) input.indeterminate = shown.some((row) => picked[getRowId(row)]) && !shown.every((row) => picked[getRowId(row)]); }}
        onChange={(event) => {
          const next = { ...picked };
          for (const row of shown) next[getRowId(row)] = event.target.checked;
          publish(next);
        }}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label={`Select ${getRowId(row.original)}`}
        checked={Boolean(picked[row.id])}
        onChange={(event) => publish({ ...picked, [row.id]: event.target.checked })}
        onClick={(event) => event.stopPropagation()}
      />
    ),
  };

  const detailColumn: ColumnDef<T, unknown> = {
    id: "_detail",
    header: () => <span className="sr-only">Details</span>,
    cell: ({ row }) => detail?.(row.original) ? (
      <button
        type="button"
        aria-label={`${detailLabel} for ${getRowId(row.original)}`}
        aria-expanded={Boolean(open[row.id])}
        onClick={() => setOpen((current) => ({ ...current, [row.id]: !current[row.id] }))}
        className="inline-flex size-7 items-center justify-center rounded hover:bg-[var(--accent)]"
      >
        <ChevronRight className={`size-4 ${open[row.id] ? "rotate-90" : ""}`} aria-hidden />
      </button>
    ) : null,
  };

  function publish(next: Record<string, boolean>) {
    setPicked(next);
    onSelected?.(Object.keys(next).filter((id) => next[id]));
  }

  const table = useReactTable({
    data: shown,
    columns: [...(selectable ? [selectColumn] : []), ...(detail ? [detailColumn] : []), ...columns],
    initialState: { pagination: { pageIndex: 0, pageSize: 50 } },
    autoResetPageIndex: false,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
    },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
  });
  useEffect(() => { table.setPageIndex(0); }, [table, q, facetValue, sorting]);
  const pageCount = table.getPageCount();
  useEffect(() => {
    table.setPageIndex((page) => Math.min(page, Math.max(0, pageCount - 1)));
  }, [table, pageCount]);
  const rows = table.getRowModel().rows;
  const hideable = table.getAllLeafColumns().filter((column) => column.id !== "_select" && typeof column.columnDef.header === "string");

  const exportRows = () => {
    const cols = table.getVisibleLeafColumns().filter((column) => column.id !== "_select" && column.id !== "_detail");
    const header = cols.map((column) => String(column.columnDef.header ?? column.id));
    const body = table.getPrePaginationRowModel().rows.map((row) => cols.map((column) => {
      const custom = column.columnDef.meta?.csv;
      const value = custom ? custom(row.original) : row.getValue(column.id);
      return Array.isArray(value) ? value.join(" ") : value;
    }));
    downloadCSV(exportName ?? "export", header, body);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span role="status" className="mr-1 text-sm text-[var(--muted)]">
            {q || facetValue ? `${shown.length} of ${data.length}` : data.length} {noun}
          </span>
          {facet && counts.map(([name, count]) => (
            <button
              key={name}
              type="button"
              aria-pressed={facetValue === name}
              onClick={() => setFacet(facetValue === name ? "" : name)}
              className={chip(facetValue === name)}
            >
              {name} <span className="text-[var(--muted)]">{count}</span>
            </button>
          ))}
          {q || facetValue ? <button type="button" className="px-2 py-1 text-xs text-[var(--primary)] underline underline-offset-2" onClick={clearFilters}>Clear filters</button> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {search && (
            <label className="relative">
              <span className="sr-only">{search.placeholder}</span>
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={search.placeholder}
                className="h-8 w-56 rounded-md border border-[var(--border)] bg-[var(--card)] pr-2 pl-7 text-sm"
              />
            </label>
          )}
          {hideable.length > 1 && (
            <details className="relative">
              <summary className={toolClass}>
                <Columns3 className="size-3.5" aria-hidden /> Columns
              </summary>
              <fieldset className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow)]">
                <legend className="sr-only">Visible columns</legend>
                {hideable.map((column) => (
                  <label key={column.id} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} />
                    {String(column.columnDef.header)}
                  </label>
                ))}
              </fieldset>
            </details>
          )}
          {exportName && (
            <button type="button" className={toolClass} onClick={exportRows}>
              <Download className="size-3.5" aria-hidden /> CSV
            </button>
          )}
          <button
            type="button"
            className={toolClass}
            aria-pressed={compact}
            onClick={() => {
              const next = !compact;
              setCompact(next);
              try {
                localStorage.setItem("genesis-console-density", next ? "compact" : "comfortable");
              } catch {
                /* density lasts for this page only */
              }
            }}
          >
            <Rows3 className="size-3.5" aria-hidden /> Compact
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm" data-density={compact ? "compact" : "comfortable"}>
          <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} scope="col" aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined} className="px-3 py-2 font-medium">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button type="button" className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                      </button>
                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-[var(--muted)]" colSpan={table.getVisibleLeafColumns().length}>No {noun} in this view.{q || facetValue ? " Try another search or clear the filters." : ""}</td>
              </tr>
            ) : rows.map((row) => {
              const panel = detail?.(row.original) ?? null;
              const expanded = Boolean(open[row.id] && panel);
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`border-t border-[var(--border)] align-top ${panel ? "cursor-pointer hover:bg-[var(--off)]" : ""} ${rowClassName?.(row.original) ?? ""}`}
                    onClick={(event) => {
                      if (!panel) return;
                      const target = event.target as HTMLElement;
                      if (target.closest("a, button, input, label")) return;
                      setOpen((current) => ({ ...current, [row.id]: !current[row.id] }));
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={compact ? "px-3 py-1" : "px-3 py-2"}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expanded ? (
                    <tr key={`${row.id}-detail`} className="border-t border-[var(--border)] bg-[var(--background)]">
                      <td className="px-3 py-3" colSpan={row.getVisibleCells().length}>{panel}</td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 50 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-[var(--muted)]">Showing {table.getState().pagination.pageIndex * 50 + 1}–{Math.min((table.getState().pagination.pageIndex + 1) * 50, shown.length)} of {shown.length} {noun}</span>
          <div className="flex items-center gap-2">
            <button type="button" className={toolClass} disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</button>
            <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
            <button type="button" className={toolClass} disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-full border px-2.5 py-1 text-xs ${active ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`;
}

const toolClass = "inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm hover:bg-[var(--off)] disabled:cursor-default disabled:opacity-40";
