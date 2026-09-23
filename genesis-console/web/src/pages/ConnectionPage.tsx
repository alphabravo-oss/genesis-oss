import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import { create } from "@bufbuild/protobuf";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { ConnectionInputSchema, type ConnectionTest } from "@/gen/console/v1/console_pb";
import { consoleClient } from "@/lib/connect";
import { errorText } from "@/lib/errors";
import { formatAgo, formatWhen } from "@/lib/cluster";
import { sameInput, type FormInput } from "@/lib/connection";

const sources: Record<string, string> = {
  saved: "Saved in the console",
  environment: "Set by the deployment (KUBECONFIG)",
  "in-cluster": "In-cluster service account",
  default: "Default kubeconfig on this host",
  none: "No cluster configured",
};

export function ConnectionPage() {
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const info = useQuery({ queryKey: ["connection"], queryFn: ({ signal }) => consoleClient.getConnection({}, { signal }) });
  const [form, setForm] = useState<FormInput>({ name: "", kubeconfig: "", context: "", rewrite: false });
  const [tested, setTested] = useState<{ input: FormInput; result: ConnectionTest } | null>(null);
  const [busy, setBusy] = useState<"" | "test" | "save" | "delete">("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const result = tested?.result;
  const canSave = Boolean(tested && !result?.error && form.name.trim() && sameInput(tested.input, form) && info.data?.savingEnabled);
  const update = (change: Partial<FormInput>) => setForm((current) => ({ ...current, ...change }));
  const input = () => create(ConnectionInputSchema, { name: form.name.trim(), kubeconfig: form.kubeconfig, context: form.context, rewriteLoopback: form.rewrite });

  async function run(kind: "test" | "save" | "delete", action: () => Promise<void>) {
    setBusy(kind);
    setError("");
    setNote("");
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["connection"] });
    await queryClient.invalidateQueries({ queryKey: ["cluster"] });
    void revalidator.revalidate();
  }

  const current = info.data;
  return <div className="max-w-3xl space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Cluster connection</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">The cluster this console observes. The console only reads from it.</p>
    </div>

    <section aria-labelledby="current-title" className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <h2 id="current-title" className="font-semibold">Current</h2>
      {info.isPending ? <p role="status" className="text-[var(--muted)]">Loading…</p> : current ? <>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          <dt className="text-[var(--muted)]">Source</dt><dd>{sources[current.source] ?? current.source}</dd>
          {current.name ? <><dt className="text-[var(--muted)]">Name</dt><dd className="font-medium">{current.name}</dd></> : null}
          {current.server ? <><dt className="text-[var(--muted)]">API server</dt><dd className="break-all font-mono text-xs">{current.server}</dd></> : null}
          {current.context ? <><dt className="text-[var(--muted)]">Context</dt><dd>{current.context}</dd></> : null}
          {current.savedAt ? <><dt className="text-[var(--muted)]">Saved</dt><dd title={formatWhen(current.savedAt)}>{formatAgo(current.savedAt)}</dd></> : null}
        </dl>
        {current.error ? <p role="alert" className="text-[var(--amber)]">{current.error}</p> : null}
        {current.warnings.map((warning) => <p key={warning} className="text-[var(--amber)]">{warning}</p>)}
        {current.source === "saved" ? <div className="flex items-center gap-2">
          {confirmDelete ? <>
            <button type="button" disabled={busy !== ""} onClick={() => void run("delete", async () => { await consoleClient.deleteConnection({}); setConfirmDelete(false); setNote("Disconnected. The console now uses the deployment's cluster settings."); await refresh(); })} className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-[var(--danger)] disabled:opacity-50">{busy === "delete" ? "Disconnecting…" : "Confirm disconnect"}</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-[var(--muted)] underline">Cancel</button>
          </> : <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--off)]">Disconnect</button>}
        </div> : null}
      </> : <p role="alert" className="text-[var(--danger)]">{errorText(info.error)}</p>}
    </section>

    <section aria-labelledby="connect-title" className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <div>
        <h2 id="connect-title" className="font-semibold">{current?.source === "saved" ? "Replace connection" : "Connect a cluster"}</h2>
        <p className="mt-1 text-[var(--muted)]">Paste a kubeconfig or choose a file. Cloud logins (EKS, GKE, AKS) need a service-account kubeconfig; see the README.</p>
      </div>
      {current && !current.savingEnabled ? <p role="status" className="rounded-md border border-[var(--amber)] bg-[var(--amber-bg)] p-3 text-[var(--amber)]">Saving is off because no connection key is configured. With Docker Compose, run <code>./scripts/up.sh</code> to generate one. With the Helm chart, add <code>connection-key</code> to the credentials Secret. You can still test a kubeconfig.</p> : null}
      <label className="block space-y-1">
        <span className="font-medium">Name</span>
        <input value={form.name} onChange={(event) => update({ name: event.target.value })} maxLength={63} autoComplete="off" spellCheck={false} placeholder="prod-east…" className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2" />
      </label>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="kubeconfig" className="font-medium">Kubeconfig</label>
          <label className="cursor-pointer text-[var(--primary)] underline underline-offset-2">
            Choose file
            <input type="file" className="sr-only" onChange={async (event) => { const file = event.target.files?.[0]; if (file) update({ kubeconfig: await file.text(), context: "" }); event.target.value = ""; }} />
          </label>
        </div>
        <textarea id="kubeconfig" value={form.kubeconfig} onChange={(event) => update({ kubeconfig: event.target.value, context: "" })} rows={10} spellCheck={false} autoComplete="off" placeholder="apiVersion: v1…" className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-xs" />
      </div>
      {result && result.contexts.length > 1 ? <label className="block space-y-1">
        <span className="font-medium">Context</span>
        <select value={form.context || result.context} onChange={(event) => update({ context: event.target.value })} className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[var(--foreground)]">
          {result.contexts.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label> : null}
      {result?.loopback ? <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={form.rewrite} onChange={(event) => update({ rewrite: event.target.checked })} />
        <span>The console runs in Docker: reach this cluster through <code>host.docker.internal</code>. The certificate name is kept, so TLS verification still works.</span>
      </label> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy !== "" || !form.kubeconfig.trim()} onClick={() => void run("test", async () => { const snapshot = { ...form }; const next = await consoleClient.testConnection(input()); setTested({ input: snapshot, result: next }); })} className="rounded-md border border-[var(--border)] px-3 py-2 hover:bg-[var(--off)] disabled:opacity-50">{busy === "test" ? "Testing…" : "Test connection"}</button>
        <button type="button" disabled={busy !== "" || !canSave} onClick={() => void run("save", async () => { const saved = await consoleClient.saveConnection(input()); setForm({ name: "", kubeconfig: "", context: "", rewrite: false }); setTested(null); setNote(`Connected to ${saved.name}.`); await refresh(); })} className="rounded-md bg-[var(--primary)] px-3 py-2 text-[var(--primary-foreground)] disabled:opacity-50">{busy === "save" ? "Saving…" : "Save and connect"}</button>
        {tested && !sameInput(tested.input, form) ? <span className="text-xs text-[var(--muted)]">Input changed; test again before saving.</span> : null}
      </div>
      <div aria-live="polite" className="space-y-2">
        {error ? <p role="alert" className="text-[var(--danger)]">{error}</p> : null}
        {note ? <p role="status" className="text-[var(--primary)]">{note}</p> : null}
        {result ? result.error
          ? <p className="flex items-start gap-2 text-[var(--danger)]"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{result.error}</p>
          : <div className="space-y-1 rounded-md border border-[var(--border)] p-3">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-[var(--primary)]" aria-hidden />Connected to {result.server}</p>
            <p className="text-[var(--muted)]">Kubernetes {result.kubernetesVersion} · context {result.context}{result.genesisVersion ? ` · Genesis ${result.genesisVersion} (${result.release})` : ""}</p>
          </div> : null}
        {result?.warnings.map((warning) => <p key={warning} className="text-[var(--amber)]">{warning}</p>)}
      </div>
    </section>
  </div>;
}
