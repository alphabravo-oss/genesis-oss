import { useState } from "react";
import { useOutletContext, useRevalidator, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShellContext } from "@/pages/shell-context";
import { FindingList } from "@/components/FindingList";
import { consoleClient } from "@/lib/connect";
import { formatWhen, jobActive } from "@/lib/cluster";
import { errorText } from "@/lib/errors";

export function ScansPage() {
  const { detail, tag, autoClean, jobs, scanEventsConnected } = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [openId, setOpenId] = useState(params.get("job") ?? "");
  const list = jobs;
  const requested = params.get("job");
  const active = list.find((job) => job.id === requested) ?? list.find((job) => jobActive(job.state)) ?? list[0];
  const detailQuery = useQuery({
    queryKey: ["job", active?.id],
    queryFn: ({ signal }) => consoleClient.getScanJob({ id: active?.id ?? "" }, { signal }),
    enabled: Boolean(active?.id),
    refetchInterval: (query) => (!scanEventsConnected && query.state.data && jobActive(query.state.data.state) ? 1500 : false),
  });
  const current = detailQuery.data ?? active;
  const scanning = list.some((job) => jobActive(job.state));
  if (!detail) return null;
  const defaultOn = detail.images.filter((image) => image.when === "default-on" && image.ref).length;
  const publicRefs = detail.images.filter((image) => image.ref).length;

  async function start(scope: "default-on" | "public") {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const job = await consoleClient.startScan({ tag, scope });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("job", job.id);
        return next;
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleClean(next: boolean) {
    setSavingSettings(true);
    setError("");
    try {
      await consoleClient.setScanSettings({ autoClean: next });
      await revalidator.revalidate();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function clean() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await consoleClient.cleanImages({});
      setNote("Pulled image data removed. Scan results are still saved.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const running = current?.items.filter((item) => item.state === "running" || item.state === "queued") ?? [];
  const failed = current?.items.filter((item) => item.state === "failed") ?? [];
  const succeeded = current?.items.filter((item) => item.state === "succeeded").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scans</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Scan public images from the Genesis {tag} catalog for vulnerabilities. Use Images → Deployed images to scan what is running in the cluster. Profiles do not change the scan catalog. Cleaning images keeps findings and SBOMs.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-50" disabled={busy || scanning} onClick={() => void start("default-on")}>
          {busy ? "Working…" : `Scan ${defaultOn} catalog default-on images`}
        </button>
        <button type="button" className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm disabled:opacity-50" disabled={busy || scanning} onClick={() => void start("public")}>
          Scan {publicRefs} catalog public images
        </button>
        <button type="button" className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm disabled:opacity-50" disabled={busy || scanning} onClick={() => void clean()}>
          Clean images
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoClean} disabled={savingSettings} onChange={(event) => void toggleClean(event.target.checked)} />
        Auto cleanup after each successful image
      </label>
      {error || detailQuery.error ? <p role="alert" className="text-sm text-[var(--danger)]">{error || errorText(detailQuery.error)}</p> : null}
      {note ? <p role="status" className="text-sm">{note}</p> : null}
      {current ? (
        <section className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="font-semibold">
            {current.tag} · {current.scope} · {current.state}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {current.done} of {current.total} finished
            {current.failed ? ` · ${current.failed} failed` : ""}
            {current.skipped ? ` · ${current.skipped} skipped` : ""}
            {current.startedAt ? ` · started ${formatWhen(current.startedAt)}` : ""}
          </p>
          <progress aria-label="Scan progress" className="h-2 w-full" value={current.done} max={Math.max(current.total, 1)} />
          {current.error ? <p className="text-sm text-[var(--amber)]">{current.error}</p> : null}
          <ul className="space-y-1 text-sm">
            {running.slice(0, 8).map((item) => (
              <li key={item.imageId}>{item.state} · {item.ref || item.imageId}</li>
            ))}
            {failed.slice(0, 8).map((item) => (
              <li key={item.imageId} className="text-[var(--danger)]">{item.imageId}: {item.error || "failed"}</li>
            ))}
            {succeeded ? <li className="text-[var(--muted)]">{succeeded} succeeded</li> : null}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">History</h2>
        {list.length === 0 ? <p className="text-sm text-[var(--muted)]">No scans yet.</p> : (
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-[var(--card)]">
            {list.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  aria-expanded={openId === job.id}
                  className="flex w-full flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--off)]"
                  onClick={() => setOpenId(openId === job.id ? "" : job.id)}
                >
                  <span>{job.tag} · {job.scope} · {job.state}</span>
                  <span className="text-[var(--muted)]">{job.done}/{job.total} · {formatWhen(job.startedAt)}</span>
                </button>
                {openId === job.id ? (
                  <div className="border-t border-[var(--border)] px-3 py-3">
                    <ScanDrilldown jobId={job.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScanDrilldown({ jobId }: { jobId: string }) {
  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: ({ signal }) => consoleClient.getScanJob({ id: jobId }, { signal }),
  });
  if (job.error) return <p role="alert" className="text-sm text-[var(--danger)]">{errorText(job.error)}</p>;
  if (!job.data) return <p role="status" className="text-sm text-[var(--muted)]">Loading findings…</p>;
  const succeeded = job.data.items.filter((item) => item.state === "succeeded");
  const failed = job.data.items.filter((item) => item.state === "failed");
  if (succeeded.length === 0 && failed.length === 0) {
    return <p className="text-sm text-[var(--muted)]">This scan has no finished images.</p>;
  }
  return (
    <div className="space-y-4">
      {succeeded.map((item) => {
        return (
          <section key={item.imageId} className="space-y-2">
            <h3 className="text-sm font-medium">{item.ref || item.imageId}</h3>
            {item.findingsAvailable ? <FindingList rows={item.vulnerabilities} allSeverities={item.allSeverities} urlKey={`findings.${jobId}.${item.imageId}`} /> : <p className="text-sm text-[var(--muted)]">Saved findings are unavailable for this image.</p>}
          </section>
        );
      })}
      {failed.map((item) => (
        <p key={item.imageId} className="text-sm text-[var(--danger)]">{item.imageId}: {item.error || "failed"}</p>
      ))}
    </div>
  );
}
