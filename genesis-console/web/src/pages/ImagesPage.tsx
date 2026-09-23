import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "@bufbuild/protobuf";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";
import { createColumnHelper, type ColumnDef, type Row } from "@tanstack/react-table";
import { ListScanJobsResponseSchema, type ImageRow, type ListScanJobsResponse, type ScanItem } from "@/gen/console/v1/console_pb";
import type { ShellContext } from "@/pages/shell-context";
import { DataTable } from "@/components/DataTable";
import { FindingList } from "@/components/FindingList";
import { ReleaseSelect } from "@/components/ReleaseSelect";
import { consoleClient } from "@/lib/connect";
import { formatWhen, jobActive } from "@/lib/cluster";
import { errorText } from "@/lib/errors";
import { fixableCount, scanSeverityCounts, severities } from "@/lib/findings";
import { SeverityLegend, VulnerabilitySummary } from "@/components/VulnerabilitySummary";
import { applyScanResult, groupDeployedImages, imageHref, imageScan, type DeployedImage } from "@/lib/images";

const vulnerabilityColumn = {
  id: "critical", // Preserve existing saved sort URLs.
  header: "Vulnerabilities",
  accessorFn: scanSeverityCounts,
  meta: { csv: (image: ImageRow | DeployedImage) => image.scanned ? scanSeverityCounts(image).map((count, index) => `${severities[index]}: ${count ?? "not collected"}`).join("; ") : "Not scanned" },
  sortingFn: (a: Pick<Row<ImageRow>, "getValue">, b: Pick<Row<ImageRow>, "getValue">) => {
    const left = a.getValue<(number | null)[]>("critical"), right = b.getValue<(number | null)[]>("critical");
    for (let i = 0; i < left.length; i++) {
      const difference = (left[i] ?? -1) - (right[i] ?? -1);
      if (difference) return difference;
    }
    return 0;
  },
  cell: ({ row, getValue }: { row: { original: ImageRow | DeployedImage }; getValue: () => (number | null)[] }) => row.original.scanned ? <VulnerabilitySummary counts={getValue()} /> : <span className="text-[var(--muted)]">Not scanned</span>,
};

// Scan progress replaces the counts only while it says something new: queued, running, or failed.
function withScanState<T extends ImageRow | DeployedImage>(column: ColumnDef<T, any>, item: (row: T) => ScanItem | undefined, starting: (row: T) => boolean): ColumnDef<T, any> {
  return { ...column, cell: (context: any) => {
    const row: T = context.row.original, scan = item(row);
    if (starting(row) || (scan && (jobActive(scan.state) || scan.state === "failed"))) return <ScanStatus item={scan} scanned={row.scanned} starting={starting(row)} />;
    return (column.cell as (context: any) => unknown)(context);
  } } as ColumnDef<T, any>;
}

const columns = createColumnHelper<ImageRow>();
const defaultSort = [{ id: "critical", desc: true }];
const search = {
  placeholder: "Search images",
  text: (row: ImageRow) => [row.packageKey, row.name, row.registry, row.ref, row.digest, row.signature, row.cves.join(" ")].join(" "),
};
const facet = { label: "Registry", value: (row: ImageRow) => row.registry || "No public source" };
const runtimeColumns: ColumnDef<DeployedImage, any>[] = [
  { id: "ref", accessorFn: (row) => row.references.join("\n"), header: "Image" },
  vulnerabilityColumn,
  { id: "fixable", accessorFn: (row) => row.scanned ? fixableCount(row.vulnerabilities) : -1, header: "Fixable", cell: ({ row }) => row.original.scanned ? <span title="Distinct vulnerabilities with a fix reported for at least one affected package">{fixableCount(row.original.vulnerabilities)}</span> : "—" },
  { accessorKey: "digest", header: "Observed digest", cell: ({ getValue }) => <span className="block max-w-36 truncate font-mono text-xs" title={getValue()}>{getValue() || "Not observed"}</span> },
  { id: "packageKey", accessorFn: (row) => row.packages.join(", "), header: "Packages", cell: ({ getValue }) => <span className="line-clamp-2 max-w-44" title={getValue()}>{getValue()}</span> },
  { id: "namespace", accessorFn: (row) => row.namespaces.join(", "), header: "Namespaces", cell: ({ getValue }) => <span className="line-clamp-2 max-w-44" title={getValue()}>{getValue()}</span> },
  { id: "containers", accessorFn: (row) => row.containers.length, header: "Containers" },
  { id: "ready", accessorFn: (row) => row.containers.filter((container) => container.ready).length, header: "Ready", cell: ({ row, getValue }) => `${getValue()}/${row.original.containers.length}` },
];
const runtimeSearch = { placeholder: "Search images or pods", text: (row: DeployedImage) => [row.references.join(" "), row.digest, row.packages.join(" "), row.namespaces.join(" "), ...row.containers.map((container) => `${container.pod} ${container.container}`)].join(" ") };
const runtimeFacet = { label: "Package", value: (row: DeployedImage) => row.packages };

const containerColumns: ColumnDef<DeployedImage["containers"][number], any>[] = [
  { accessorKey: "packageKey", header: "Package" },
  { accessorKey: "namespace", header: "Namespace" },
  { accessorKey: "pod", header: "Pod" },
  { accessorKey: "container", header: "Container", cell: ({ row, getValue }) => `${getValue()}${row.original.init ? " (init)" : ""}` },
  { accessorKey: "ready", header: "Ready", cell: ({ getValue }) => getValue() ? "Yes" : "No" },
  { accessorKey: "comparison", header: "Image vs catalog", cell: ({ row, getValue }) => <>{getValue()}{row.original.standard ? <span className="mt-1 block break-all font-mono text-xs text-[var(--muted)]">{row.original.standard}</span> : null}</> },
];

function ContainerList({ image, tag }: { image: DeployedImage; tag: string }) {
  const columns = useMemo(() => containerColumns.map((column) => "accessorKey" in column && column.accessorKey === "comparison" ? { ...column, header: `Image vs Genesis ${tag} catalog` } : column), [tag]);
  return <DataTable columns={columns} data={image.containers} getRowId={(row) => `${row.namespace}/${row.pod}/${row.init}/${row.container}`} noun="containers" search={{ placeholder: "Search containers or pods", text: (row) => `${row.packageKey} ${row.namespace} ${row.pod} ${row.container} ${row.comparison} ${row.standard}` }} urlKey="containers" />;
}

function scanLabel(item: ScanItem | undefined, scanned: boolean, starting = false) {
  if (starting) return "Starting…";
  return ({ queued: "Queued", running: "Scanning…", succeeded: "Scanned", failed: "Failed", skipped: "Skipped" }[item?.state ?? ""]) ?? (scanned ? "Scanned" : "Not scanned");
}

function ScanStatus({ item, scanned, starting }: { item?: ScanItem; scanned: boolean; starting?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${item?.state === "failed" ? "text-[var(--danger)]" : item && jobActive(item.state) ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}>
    {starting || item?.state === "running" ? <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden /> : null}{scanLabel(item, scanned, starting)}
  </span>;
}

function ImageFindings({ image, item }: { image: ImageRow | DeployedImage; item?: ScanItem }) {
  return <section className="space-y-2">
    <h2 className="text-lg font-semibold">Scan results</h2>
    {item?.state === "failed" ? <p role="alert" className="break-words text-sm text-[var(--danger)]">Scan failed: {item.error || "Try scanning this image again."}</p> : null}
    {item && jobActive(item.state) ? <p role="status" className="text-sm text-[var(--muted)]">{item.state === "queued" ? "Waiting to scan this image." : "Scanning this image…"} {image.scanned ? "Previous saved findings are shown below." : "Results will appear here automatically."}</p> : null}
    {item?.state === "skipped" ? <p className="text-sm text-[var(--muted)]">Skipped: no public image reference is available.</p> : null}
    {image.scanned ? <>
      {image.scannedAt ? <p className="text-xs text-[var(--muted)]">Scanned {formatWhen(image.scannedAt)}</p> : null}
      <FindingList rows={image.vulnerabilities} allSeverities={image.allSeverities} />
    </> : <p className="text-sm text-[var(--muted)]">No saved scan results.</p>}
  </section>;
}

const imageColumns: ColumnDef<ImageRow, any>[] = [
  columns.accessor("packageKey", { header: "Package" }),
  columns.accessor("name", { header: "Image" }),
  vulnerabilityColumn,
  columns.accessor((row) => row.scanned ? fixableCount(row.vulnerabilities) : -1, { id: "fixable", header: "Fixable", cell: (info) => info.row.original.scanned ? <span title="Distinct vulnerabilities with a fix reported for at least one affected package">{info.getValue()}</span> : "—" }),
  columns.accessor("registry", {
    header: "Registry",
    cell: (info) => <span className={info.row.original.ref ? "" : "text-[var(--amber)]"}>{info.getValue()}</span>,
  }),
  columns.accessor("ref", {
    header: "Reference",
    cell: (info) => <span className="block max-w-sm break-all font-mono text-xs">{info.getValue() || info.row.original.ironbank || "—"}</span>,
  }),
  columns.accessor("digest", { header: "Digest", cell: (info) => <span className="block max-w-28 truncate font-mono text-xs" title={info.getValue()}>{info.getValue() || "—"}</span> }),
  columns.accessor("signature", { header: "Signature", cell: (info) => info.getValue() || "—" }),
  columns.accessor("scannedAt", { header: "Scanned", cell: (info) => (info.getValue() ? formatWhen(info.getValue()) : "—") }),
];

export function ImagesPage() {
  const { detail, tag, jobs, cluster, clusterPending, scanEventsConnected } = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const { source, imageId } = useParams();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastJobId, setLastJobId] = useState("");
  const view = source === "deployed" ? "deployed" : source === "catalog" ? "all" : params.get("view") ?? "deployed";
  useEffect(() => { setSelected([]); }, [tag, view]);
  const scanning = jobs.some((job) => jobActive(job.state));
  const watchedJob = jobs.find((job) => job.state === "running") ?? jobs.find((job) => job.state === "queued") ?? jobs.find((job) => job.id === lastJobId) ?? jobs.find((job) => job.tag === tag);
  const scanQuery = useQuery({
    queryKey: ["job", watchedJob?.id],
    queryFn: ({ signal }) => consoleClient.getScanJob({ id: watchedJob?.id ?? "" }, { signal }),
    enabled: Boolean(watchedJob),
    refetchInterval: (query) => !scanEventsConnected && jobActive(query.state.data?.state ?? watchedJob?.state ?? "") ? 1500 : false,
  });
  const currentScan = scanQuery.data;
  const findingsUnavailable = cluster.checks.some((check) => check.name === "Saved image findings" && !check.checked);
  const deployedImages = useMemo(() => groupDeployedImages(cluster.images, cluster.imageFindings).map((image) => applyScanResult(image, imageScan(image, currentScan))), [cluster.images, cluster.imageFindings, currentScan]);
  const starting = (row: { id: string }) => busy && selected.includes(row.id);
  const observedColumns = useMemo(() => [{ ...runtimeColumns[0], cell: ({ row }: { row: { original: DeployedImage } }) => <Link to={imageHref("deployed", row.original.id, params)} className="block min-w-48 max-w-sm space-y-1 break-all font-mono text-xs text-[var(--primary)] underline decoration-[var(--primary)]/40 underline-offset-2">{row.original.references.map((ref) => <div key={ref}>{ref}</div>)}</Link> },
    ...runtimeColumns.slice(1).map((column) => findingsUnavailable && ["critical", "fixable"].includes(column.id ?? "") ? { ...column, cell: () => "Not checked" } : column.id === "critical" ? withScanState<DeployedImage>(column, (row) => imageScan(row, currentScan), starting) : column)],
  [findingsUnavailable, currentScan, busy, selected, params]);
  const catalogColumns = useMemo(() => [imageColumns[0], { ...imageColumns[1], cell: ({ row }: { row: { original: ImageRow } }) => <Link to={imageHref("catalog", row.original.id, params)} className="block text-[var(--primary)] underline decoration-[var(--primary)]/40 underline-offset-2">{row.original.name}</Link> },
    withScanState<ImageRow>(imageColumns[2], (row) => imageScan(row, currentScan, tag), starting), ...imageColumns.slice(3)],
  [currentScan, tag, busy, selected, params]);

  const rows = useMemo(() => {
    if (!detail) return [];
    return detail.images.map((image) => applyScanResult(image, imageScan(image, currentScan, tag))).filter((image) => {
      if (view === "default-on" && image.when !== "default-on") return false;
      if (view === "missing" && image.ref) return false;
      if (view === "unscanned") return image.when === "default-on" && Boolean(image.ref) && !image.scanned;
      if (view === "critical") return image.scanned && image.critical > 0;
      return true;
    });
  }, [detail, view, currentScan, tag]);

  const limited = (view === "deployed" ? deployedImages : rows).filter((image) => image.scanned && !image.allSeverities && image.ref).map((image) => image.id);

  if (!detail) return null;

  async function scanSelected(imageIds = selected) {
    setBusy(true);
    setError("");
    try {
      const job = await consoleClient.startScan({ tag, scope: view === "deployed" ? "deployed" : "selected", imageIds });
      queryClient.setQueryData(["job", job.id], job);
      queryClient.setQueryData<ListScanJobsResponse>(["jobs"], (current) => create(ListScanJobsResponseSchema, { jobs: [job, ...(current?.jobs ?? []).filter((saved) => saved.id !== job.id)].slice(0, 30) }));
      setLastJobId(job.id);
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["job", job.id] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function showView(value: string) {
    setSelected([]);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === "deployed") next.delete("view");
      else next.set("view", value);
      return next;
    });
  }

  if (imageId) {
    const image = source === "deployed" ? deployedImages.find((image) => image.id === imageId) : source === "catalog" ? rows.find((image) => image.id === imageId) : undefined;
    return <div className="space-y-5">
      <Link to={`/images${params.size ? `?${params}` : ""}`} className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"><ArrowLeft className="size-4" aria-hidden />Back to images</Link>
      {error || scanQuery.error ? <p role="alert" className="text-sm text-[var(--danger)]">{error || errorText(scanQuery.error)}</p> : null}
      {image ? <ImageDetails key={image.id} image={image} tag={tag} item={imageScan(image, currentScan, source === "catalog" ? tag : undefined)} busy={busy} scanning={scanning} findingsUnavailable={source === "deployed" && findingsUnavailable} onScan={() => void scanSelected([image.id])} /> : <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{source === "deployed" && clusterPending ? "Loading image…" : "Image unavailable"}</h1>
        <p role="status" className="text-sm text-[var(--muted)]">{source === "deployed" ? (clusterPending ? "Reading deployed images." : "This image is no longer in the observed pod inventory, or the cluster could not be read.") : "This image is not in the selected release catalog."}</p>
      </div>}
    </div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{view === "deployed" ? `${deployedImages.length} unique images across ${cluster.images.length} observed containers. Open an image for findings and the containers using it.` : `Images listed in the Genesis ${tag} catalog, and their latest saved scans. This is the catalog inventory, not the list of running containers.`}</p>
        </div>
        {selected.length ? <div className="flex items-center gap-3">
          <button type="button" className="text-sm text-[var(--primary)] underline underline-offset-2" onClick={() => setSelected([])}>Clear</button>
          <button type="button" className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-50" disabled={busy || scanning} onClick={() => void scanSelected()}>
            {busy ? "Starting scan…" : `Scan ${selected.length} selected`}
          </button>
        </div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Image source" className="inline-flex rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5">
          {[["deployed", "Running in cluster"], ["all", "Release catalog"]].map(([value, label]) => {
            const active = value === "deployed" ? view === "deployed" : view !== "deployed";
            return <button key={value} type="button" aria-pressed={active} className={`rounded px-3 py-1.5 text-sm ${active ? "bg-[var(--accent)] font-medium text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`} onClick={() => showView(value)}>{label}</button>;
          })}
        </div>
        {view !== "deployed" ? <div role="group" aria-label="Catalog filter" className="flex flex-wrap gap-1.5">
          {[["all", "All"], ["default-on", "Default-on"], ["unscanned", "Unscanned"], ["critical", "Critical"], ["missing", "No public source"]].map(([value, label]) =>
            <button key={value} type="button" aria-pressed={view === value} className={`rounded-full border px-2.5 py-1 text-xs ${view === value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--card)]"}`} onClick={() => showView(value)}>{label}</button>)}
        </div> : null}
      </div>
      {view !== "deployed" ? <ReleaseSelect label="Catalog version" /> : null}
      {currentScan && (jobActive(currentScan.state) || currentScan.id === lastJobId) ? <div className="space-y-1" role="status">
        <p className="text-sm text-[var(--muted)]">{currentScan.done} of {currentScan.total} images finished{currentScan.failed ? ` · ${currentScan.failed} failed` : ""}. Progress and results update in the rows below.</p>
        <progress aria-label="Scan progress" className="h-1.5 w-full" value={currentScan.done} max={Math.max(currentScan.total, 1)} />
      </div> : null}
      {scanQuery.error ? <p role="alert" className="text-sm text-[var(--danger)]">Scan progress is temporarily unavailable: {errorText(scanQuery.error)}</p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
      {limited.length ? <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--amber)] bg-[var(--amber-bg)] px-3 py-2 text-sm text-[var(--amber)]">
        <span>{limited.length === 1 ? "1 image has" : `${limited.length} images have`} an older scan with only High and Critical findings.</span>
        <button type="button" className="rounded-md border border-[var(--amber)] px-2.5 py-1 text-xs font-medium disabled:opacity-50" disabled={busy || scanning} onClick={() => void scanSelected(limited)}>Rescan {limited.length === 1 ? "it" : `all ${limited.length}`} for every severity</button>
      </div> : null}
      <SeverityLegend />
      {view === "deployed" ? <>
        {findingsUnavailable ? <p role="status" className="text-sm text-[var(--amber)]">Saved scan findings could not be read. Scan coverage and finding counts are unknown.</p> : null}
        <p className="text-xs text-[var(--muted)]">Each digest is scanned once, whatever its replica count. “Unassigned” means package ownership could not be determined.</p>
        {clusterPending ? <p role="status">Reading running containers…</p> : !cluster.checks.some((check) => check.name === "Pods" && check.checked) ? <p role="status" className="text-sm text-[var(--amber)]">Pod inventory could not be read. Use the catalog tabs to browse release images.</p> : null}
        <DataTable key="runtime" columns={observedColumns} data={deployedImages} getRowId={(row) => row.id} rowHref={(row) => imageHref("deployed", row.id, params)} noun="images" defaultSort={defaultSort} selectable selected={selected} onSelected={setSelected} search={runtimeSearch} facet={runtimeFacet} exportName={`genesis-${tag}-deployed-images`} urlKey="liveimg" />
      </> : <DataTable
        key="catalog"
        columns={catalogColumns}
        data={rows}
        getRowId={(row) => row.id}
        rowHref={(row) => imageHref("catalog", row.id, params)}
        noun="images"
        urlKey="img"
        exportName={`genesis-${tag}-images`}
        defaultSort={defaultSort}
        selectable
        selected={selected}
        onSelected={setSelected}
        search={search}
        facet={facet}
      />}
    </div>
  );
}

function ImageDetails({ image, tag, item, busy, scanning, findingsUnavailable, onScan }: {
  image: ImageRow | DeployedImage; tag: string; item?: ScanItem; busy: boolean; scanning: boolean; findingsUnavailable: boolean; onScan: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const deployed = "references" in image ? image : undefined;
  const catalog = "name" in image ? image : undefined;
  const title = deployed ? (deployed.references[0]?.split("/").at(-1) || "Image") : catalog?.name;
  const facts = [
    { label: "Scan status", value: <ScanStatus item={item} scanned={image.scanned} starting={busy} /> },
    { label: image.allSeverities ? "CVEs" : "CVEs · High and Critical only", value: findingsUnavailable ? "Not checked" : image.scanned ? new Set(image.vulnerabilities.map((finding) => finding.id)).size : "Not scanned", note: image.scanned && !findingsUnavailable ? `Across ${image.vulnerabilities.length} affected ${image.vulnerabilities.length === 1 ? "package" : "packages"}` : "" },
    { label: "CVEs with a fix", value: findingsUnavailable ? "Not checked" : image.scanned ? fixableCount(image.vulnerabilities) : "Not scanned" },
    { label: deployed ? "Containers" : "Signature", value: deployed ? deployed.containers.length : catalog?.signature || "Not checked" },
  ];
  return <>
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs text-[var(--muted)]">{deployed ? "Image observed in the cluster" : `Image from the Genesis ${tag} catalog`}</p>
        <h1 ref={heading} tabIndex={-1} className="break-all text-2xl font-semibold tracking-tight outline-none">{title}</h1>
      </div>
      <button type="button" onClick={onScan} disabled={busy || scanning || !image.ref} className="shrink-0 rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-50">{busy ? "Starting scan…" : image.scanned ? "Rescan image" : "Scan image"}</button>
    </div>
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {facts.map(({ label, value, note }) => <div key={label} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-2 text-lg font-semibold tabular-nums">{value}</dd>{note ? <dd className="mt-1 text-xs text-[var(--muted)]">{note}</dd> : null}</div>)}
    </dl>
    <dl className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <div><dt className="text-xs text-[var(--muted)]">{deployed ? "References" : "Public reference"}</dt><dd className="mt-1 space-y-1 break-all font-mono text-xs">{(deployed?.references ?? [image.ref || "No public source"]).map((ref) => <div key={ref}>{ref}</div>)}</dd></div>
      <div><dt className="text-xs text-[var(--muted)]">{deployed ? "Observed digest" : "Digest"}</dt><dd className="mt-1 break-all font-mono text-xs">{image.digest || "Not observed"}</dd></div>
      <div><dt className="text-xs text-[var(--muted)]">Packages</dt><dd className="mt-1 break-words">{deployed?.packages.join(", ") || image.packageKey || "Unassigned"}</dd></div>
      {deployed ? <div><dt className="text-xs text-[var(--muted)]">Namespaces</dt><dd className="mt-1 break-words">{deployed.namespaces.join(", ")}</dd></div> : null}
      {catalog?.ironbank ? <div><dt className="text-xs text-[var(--muted)]">Upstream reference</dt><dd className="mt-1 break-all font-mono text-xs">{catalog.ironbank}</dd></div> : null}
    </dl>
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-lg font-semibold">Software bill of materials</h2>
      {findingsUnavailable ? <p role="status" className="text-sm text-[var(--amber)]">Saved SBOM availability could not be checked.</p> : image.sbomId ? <>
        <p className="text-sm text-[var(--muted)]">Generated by Trivy from the same image scan, including detected packages without known vulnerabilities. Saved {formatWhen(image.scannedAt)}.</p>
        {item && jobActive(item.state) ? <p role="status" className="text-xs text-[var(--muted)]">Previous scan’s SBOM is available while the new scan runs.</p> : null}
        <div className="flex flex-wrap gap-2">
          {[["cyclonedx", "CycloneDX JSON"], ["spdx-json", "SPDX JSON"]].map(([format, label]) => <a key={format} href={`/sbom/${encodeURIComponent(image.sbomId)}/${format}`} download className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--off)]"><Download className="size-4" aria-hidden />{label}</a>)}
        </div>
      </> : <p role="status" className={`text-sm ${image.sbomError ? "text-[var(--amber)]" : "text-[var(--muted)]"}`}>{image.sbomError || (item && jobActive(item.state) ? "The SBOM will be available when this scan finishes." : image.scanned ? "This older scan has no saved SBOM. Rescan the image to generate one." : "Scan this image to generate its SBOM.")}</p>}
    </section>
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      {findingsUnavailable ? <p role="status" className="text-sm text-[var(--amber)]">Saved scan findings could not be read. Finding counts are unknown.</p> : <ImageFindings image={image} item={item} />}
    </div>
    {deployed ? <section className="min-w-0 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"><h2 className="text-lg font-semibold">Where it runs</h2><ReleaseSelect label="Catalog version" /><p className="text-xs text-[var(--muted)]">References and digests are compared with the Genesis {tag} catalog. Profiles do not change this catalog; differences do not prove runtime drift.</p><ContainerList image={deployed} tag={tag} /></section> : null}
  </>;
}
