export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  const url = new URL(value, "https://genesis.invalid");
  if (url.origin !== "https://genesis.invalid" || url.pathname === "/login" || url.pathname.startsWith("/auth/")) return "/";
  return url.pathname + url.search + url.hash;
}

export function loginURL() {
  return "/login?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
}

export async function getSession(signal?: AbortSignal): Promise<{ required: boolean; authenticated: boolean }> {
  const response = await fetch("/auth/session", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to check your session. Try again.");
  return response.json();
}
