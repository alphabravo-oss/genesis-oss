import { useOutletContext, useSearchParams } from "react-router";
import type { ShellContext } from "@/pages/shell-context";

export function ReleaseSelect({ label }: { label: "Compare against" | "Catalog version" }) {
  const { tag, releases, cluster } = useOutletContext<ShellContext>();
  const [params, setParams] = useSearchParams();
  const following = !params.has("tag") || params.get("follow") === "deployed";
  return <div className="space-y-2">
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select aria-label={label} value={following ? "deployed" : tag} disabled={!releases.length} className="h-9 max-w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[var(--foreground)]" onChange={(event) => {
        const value = event.target.value;
        setParams((current) => {
          const next = new URLSearchParams(current);
          if (value === "deployed") {
            next.set("follow", "deployed");
            if (releases.some((release) => release.tag === cluster.tag)) next.set("tag", cluster.tag);
          } else {
            next.set("tag", value);
            next.delete("follow");
          }
          return next;
        });
      }}>
        {!releases.length ? <option value="">No releases</option> : null}
        <option value="deployed">Installed release{cluster.tag ? ` (${cluster.tag})` : ""} · automatic</option>
        {releases.map((release) => <option key={release.tag} value={release.tag}>Genesis {release.tag}</option>)}
      </select>
    </label>
    {following && cluster.tag && !releases.some((release) => release.tag === cluster.tag) ? <p role="status" className="text-xs text-[var(--muted)]">Installed Genesis {cluster.tag} has no local catalog. {label === "Compare against" ? "Choose an available release to compare explicitly." : `Showing the Genesis ${tag} catalog.`}</p> : null}
  </div>;
}
