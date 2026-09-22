import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";

export function UserMenu({ authRequired }: { authRequired: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace("/login");
    } catch {
      setError("Unable to sign out. Check your connection and try again.");
      setSigningOut(false);
    }
  }

  return <details ref={menu} className="relative" onKeyDown={(event) => {
    if (event.key === "Escape" && menu.current?.open) {
      event.preventDefault();
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  }} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false;
  }}>
    <summary aria-label="User menu" title="User settings" className="flex size-9 list-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[var(--primary)] hover:bg-[var(--off)]">
      <UserRound className="size-4" aria-hidden />
    </summary>
    <div role="group" aria-label="User settings" className="absolute top-full right-0 z-40 mt-2 w-64 max-w-[calc(100vw-1.5rem)] space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)]">
      <p className="text-sm font-semibold">User settings</p>
      <label className="block space-y-2 text-sm">
        <span>Appearance</span>
        <select value={theme.preference} onChange={(event) => theme.setPreference(event.target.value as ThemePreference)} className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[var(--foreground)]">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      {authRequired ? <div className="border-t border-[var(--border)] pt-3">
        <button type="button" disabled={signingOut} onClick={() => void signOut()} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-[var(--off)] disabled:opacity-50"><LogOut className="size-4" aria-hidden />{signingOut ? "Signing out…" : "Sign out"}</button>
        {error ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
      </div> : null}
    </div>
  </details>;
}
