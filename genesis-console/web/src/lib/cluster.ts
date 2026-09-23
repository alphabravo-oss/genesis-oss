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

const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];

// Freshness reads better relative; pair with a title of formatWhen for the exact time.
export function formatAgo(value: string | number | undefined, now = Date.now()) {
  if (!value) return "not yet";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "not yet";
  const seconds = Math.round((time - now) / 1000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return "just now";
}

export function plural(count: number, noun: string, many = `${noun}s`) {
  return `${count} ${count === 1 ? noun : many}`;
}

const scopes: Record<string, string> = { deployed: "Deployed images", selected: "Selected images", "default-on": "Catalog default-on images", public: "Catalog public images" };
const states: Record<string, string> = { queued: "Queued", running: "Running", succeeded: "Completed", failed: "Failed", skipped: "Skipped" };
export const scopeLabel = (scope: string) => scopes[scope] ?? scope;
export const stateLabel = (state: string) => states[state] ?? state;
