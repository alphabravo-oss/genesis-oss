import { useOutletContext } from "react-router";
import type { ShellContext } from "@/pages/shell-context";

export function ServicesPage() {
  const { cluster, clusterPending } = useOutletContext<ShellContext>();
  const checks = cluster.checks.filter((check) => /routes|gateways/i.test(check.name));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Addresses advertised by the cluster’s Ingress and Istio gateways. Authentication and external reachability are not tested.</p>
      </div>
      {clusterPending ? <p role="status">Discovering service routes…</p> : null}
      {checks.some((check) => !check.checked) ? <p role="status" className="text-sm text-[var(--amber)]">Some route APIs could not be read. This list may be incomplete.</p> : null}
      {cluster.services.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cluster.services.map((service) => (
            <li key={service.url} className="min-w-0 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <a className="break-all text-lg font-medium text-[var(--primary)] underline underline-offset-2" href={service.url} target="_blank" rel="noreferrer">{service.name}</a>
              <p className="break-all text-sm">{service.url}</p>
              <p className="text-xs text-[var(--muted)]">{service.packageKey} · {service.source}</p>
            </li>
          ))}
        </ul>
      ) : !clusterPending ? <p className="text-sm text-[var(--muted)]">{cluster.connected ? "No external service routes were discovered in the APIs that could be read." : "Connect a cluster to discover its service addresses."}</p> : null}
    </div>
  );
}
