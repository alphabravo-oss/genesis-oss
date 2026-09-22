import type { ShouldRevalidateFunctionArgs } from "react-router";

export function shouldRevalidateShell({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return currentUrl.searchParams.get("tag") !== nextUrl.searchParams.get("tag")
    || (currentUrl.pathname === nextUrl.pathname && currentUrl.search === nextUrl.search && defaultShouldRevalidate);
}

export function finishedSince(jobs: { id: string; finishedAt: string }[], loaded: { id: string; finishedAt: string }[]) {
  const known = new Set(loaded.filter((job) => job.finishedAt).map((job) => job.id));
  return jobs.filter((job) => job.finishedAt && !known.has(job.id)).map((job) => job.id);
}
