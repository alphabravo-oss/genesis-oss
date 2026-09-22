export function jobActive(state: string) {
  return state === "queued" || state === "running";
}

export function withSearch(path: string, tag: string, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function formatWhen(value: string | number | undefined) {
  if (!value) return "not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not yet";
  return date.toLocaleString();
}
