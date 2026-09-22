import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLoaderData, useLocation, useNavigation, useRevalidator, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "@bufbuild/protobuf";
import { ListScanJobsResponseSchema } from "@/gen/console/v1/console_pb";
import { Container, Images, LayoutDashboard, LogOut, Moon, PanelLeft, ScanSearch, Search, Sun, AppWindow } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import type { ShellData } from "@/shell-loader";
import { consoleClient } from "@/lib/connect";
import { formatWhen, jobActive, withSearch } from "@/lib/cluster";
import { finishedSince } from "@/lib/revalidation";
import { CommandPalette } from "@/components/CommandPalette";
import { useTheme } from "@/providers/ThemeProvider";
import { useScanEvents } from "@/lib/use-scan-events";

const NAV = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Packages", path: "/packages", icon: Container },
  { label: "Images", path: "/images", icon: Images },
  { label: "Scans", path: "/scans", icon: ScanSearch },
  { label: "Services", path: "/services", icon: AppWindow },
];

export function AppShell() {
  const data = useLoaderData() as ShellData;
  const navigation = useNavigation();
  const location = useLocation();
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const scanEventsConnected = useScanEvents();
  const [params, setParams] = useSearchParams();
  const profiles = params.get("profiles") ?? "";
  const useRecordedProfiles = !params.has("profiles") && params.get("profileMode") !== "manual";
  const following = !params.has("tag") || params.get("follow") === "deployed";
  const selection = { profiles, ...(!useRecordedProfiles ? { profileMode: "manual" } : {}), ...(following ? { follow: "deployed" } : {}) };
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("genesis-console-sidebar") === "true" || window.innerWidth < 768;
    } catch {
      return false;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const clusterQuery = useQuery({
    queryKey: ["cluster", data.tag, profiles, useRecordedProfiles],
    queryFn: async ({ signal }) => {
      const observed = await consoleClient.getCluster({ tag: data.tag, profiles: profiles ? profiles.split(",") : [], useRecordedProfiles }, { signal });
      if (!observed.connected) throw new Error(observed.error || "Cluster is unavailable");
      return observed;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: ({ signal }) => consoleClient.listScanJobs({}, { signal }),
    initialData: () => create(ListScanJobsResponseSchema, { jobs: data.jobs }),
    initialDataUpdatedAt: data.fetchedAt,
    staleTime: 2000,
    refetchInterval: (query) => scanEventsConnected ? false : (query.state.data?.jobs.some((job) => jobActive(job.state)) ? 2000 : 20000),
  });
  const cluster = clusterQuery.data ?? data.cluster;
  const jobs = jobsQuery.dataUpdatedAt > data.fetchedAt ? jobsQuery.data.jobs : data.jobs;
  const scanning = jobs.some((job) => jobActive(job.state));
  const refreshedJobs = useRef(new Set<string>());
  const page = NAV.find((item) => item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path))?.label ?? "Console";

  useEffect(() => {
    if (!following || !cluster.tag || cluster.tag === data.tag || !data.releases.some((release) => release.tag === cluster.tag)) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tag", cluster.tag);
      next.set("follow", "deployed");
      return next;
    }, { replace: true });
  }, [following, cluster.tag, data.tag, data.releases, setParams]);

  useEffect(() => {
    const completed = finishedSince(jobs, data.jobs).filter((id) => !refreshedJobs.current.has(id));
    if (!completed.length || revalidator.state !== "idle") return;
    completed.forEach((id) => refreshedJobs.current.add(id));
    void queryClient.invalidateQueries({ queryKey: ["release"] });
    void queryClient.invalidateQueries({ queryKey: ["cluster"] });
    void revalidator.revalidate();
  }, [data.jobs, jobs, queryClient, revalidator]);

  useEffect(() => {
    document.title = `${page} · ${data.tag || "Genesis"} · Genesis Console`;
  }, [data.tag, page]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mismatch = cluster.connected && cluster.tag && data.tag && cluster.tag !== data.tag;

  return (
    <div className="app-shell flex h-full bg-[var(--background)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-[var(--primary)] focus:px-3 focus:py-2 focus:text-[var(--primary-foreground)]">
        Skip to content
      </a>
      <aside className={`flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] ${collapsed ? "w-16" : "w-16 md:w-60"}`}>
        <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-4">
          <img src="/logo.svg" alt="Genesis" width="120" height="32" className={`h-8 object-cover object-left ${collapsed ? "w-8" : "w-8 md:w-auto"}`} />
        </div>
        <nav aria-label="Console" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={withSearch(item.path, data.tag, selection)}
                end={item.path === "/"}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? "bg-[var(--accent)] text-[var(--primary)]" : "hover:bg-[var(--off)]"}`
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {collapsed ? <span className="sr-only">{item.label}</span> : <span className="sr-only md:not-sr-only md:truncate">{item.label}</span>}
                {!collapsed && item.path === "/scans" && scanning ? <span className="ml-auto hidden size-2 rounded-full bg-[var(--primary)] md:block" aria-label="Scan running" /> : null}
              </NavLink>
            );
          })}
        </nav>
        {data.authRequired ? <button type="button" aria-label="Sign out" title="Sign out" disabled={signingOut} className="mx-2 mb-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--off)] disabled:opacity-50" onClick={async () => {
          setSigningOut(true);
          setLogoutError("");
          try {
            const response = await fetch("/auth/logout", { method: "POST" });
            if (!response.ok) throw new Error("Sign out failed. Try again.");
            await queryClient.cancelQueries();
            queryClient.clear();
            window.location.replace("/login");
          } catch {
            setLogoutError("Unable to sign out. Check your connection and try again.");
            setSigningOut(false);
          }
        }}><LogOut className="size-4 shrink-0" aria-hidden />{!collapsed ? <span className="hidden md:inline">{signingOut ? "Signing out…" : "Sign out"}</span> : null}</button> : null}
        <button
          type="button"
          className="m-2 hidden items-center justify-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--muted)] hover:bg-[var(--off)] md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              localStorage.setItem("genesis-console-sidebar", String(next));
            } catch {
              /* the choice lasts for this page */
            }
          }}
        >
          <PanelLeft className="size-4" aria-hidden />
          {collapsed ? null : "Collapse"}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:gap-3 sm:px-6 sm:h-14">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <div className="truncate text-sm">
              <span className="font-semibold" translate="no">Baseline {data.tag || "unavailable"}</span>
              <span className="text-[var(--muted)]"> / {page}</span>
            </div>
            <p className="truncate text-xs text-[var(--muted)]">
              {cluster.context || "Cluster context unknown"} · {cluster.namespace || "Namespace unknown"}
              {cluster.observedAt ? ` · Observed ${formatWhen(cluster.observedAt)}` : ""}
            </p>
          </div>
          <select
            value={following ? "deployed" : data.tag}
            aria-label="Comparison baseline"
            disabled={!data.releases.length}
            className="h-9 min-w-28 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--foreground)]"
            onChange={(event) => {
              const tag = event.target.value;
              setParams((current) => {
                const next = new URLSearchParams(current);
                if (tag === "deployed") {
                  next.set("follow", "deployed");
                  if (data.releases.some((release) => release.tag === cluster.tag)) next.set("tag", cluster.tag);
                } else {
                  next.set("tag", tag);
                  next.delete("follow");
                }
                return next;
              });
            }}
          >
            {!data.releases.length ? <option value="">No releases</option> : null}
            <option value="deployed">Follow deployed release</option>
            {data.releases.map((release) => <option key={release.tag} value={release.tag}>Compare with {release.tag}</option>)}
          </select>
          <span className={`hidden rounded-full border px-2 py-1 text-xs sm:inline ${cluster.connected ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}>
            {clusterQuery.isError ? "Observation unavailable" : clusterQuery.isPending ? "Connecting…" : cluster.connected ? `Installed: ${cluster.tag || "Unknown"}` : "Cluster not connected"}
          </span>
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--off)]" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" aria-hidden />
          </button>
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--off)]" aria-label={`Appearance ${theme.preference}`} onClick={theme.cycle}>
            {theme.resolved === "dark" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
          </button>
        </header>
        {logoutError ? <p role="alert" className="px-4 py-2 text-sm text-[var(--danger)]">{logoutError}</p> : null}
        {navigation.state === "loading" || revalidator.state === "loading" ? <p role="status" className="border-b border-[var(--border)] bg-[var(--accent)] px-4 py-1 text-xs">Updating view…</p> : null}
        {clusterQuery.isError || jobsQuery.isError ? <p role="alert" className="border-b border-[var(--amber)] bg-[var(--amber-bg)] px-4 py-2 text-sm text-[var(--amber)]">{clusterQuery.error?.message || "Live updates are unavailable."} {cluster.observedAt ? `Showing observations from ${formatWhen(cluster.observedAt)}.` : "Deployment state has not been confirmed."} Retrying automatically.</p> : null}
        {mismatch ? (
          <p className="border-b border-[var(--amber)] bg-[var(--amber-bg)] px-4 py-2 text-sm text-[var(--amber)]">
            Comparing baseline {data.tag} with installed release {cluster.tag}.
          </p>
        ) : null}
        {cluster.baselineError ? <p role="status" className="border-b border-[var(--amber)] bg-[var(--amber-bg)] px-4 py-2 text-sm text-[var(--amber)]">{cluster.baselineError}</p> : null}
        {following && cluster.tag && !data.releases.some((release) => release.tag === cluster.tag) ? <p role="status" className="border-b border-[var(--amber)] bg-[var(--amber-bg)] px-4 py-2 text-sm text-[var(--amber)]">Installed release {cluster.tag} has no local catalog. Showing baseline {data.tag}; it is not the deployed baseline.</p> : null}
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1600px]">
            {data.detail || location.pathname === "/" ? <Outlet key={data.tag} context={{ ...data, cluster, jobs, selection, useRecordedProfiles, scanEventsConnected, clusterPending: clusterQuery.isPending, clusterError: clusterQuery.error?.message ?? "" }} /> : <p className="text-[var(--muted)]">No Genesis catalogs were loaded.</p>}
          </div>
        </main>
      </div>
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        tag={data.tag}
        releases={data.releases}
        packages={data.detail?.packages ?? []}
        selection={selection}
      />
    </div>
  );
}

export function ConsoleError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : "The console could not load this page.";
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Unable to load the console</h1>
      <p role="alert" className="break-words text-[var(--danger)]">{message}</p>
      <p className="text-sm text-[var(--muted)]">Check that the console API is running, then try again.</p>
      <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)]">Retry</button>
    </main>
  );
}
