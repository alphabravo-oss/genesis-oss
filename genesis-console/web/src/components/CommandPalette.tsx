import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ReleaseSummary, PackageTile } from "@/gen/console/v1/console_pb";
import { withSearch } from "@/lib/cluster";

type Item = { id: string; label: string; hint: string; to: string };

export function CommandPalette({
  open,
  onClose,
  tag,
  releases,
  packages,
  selection,
}: {
  open: boolean;
  onClose: () => void;
  tag: string;
  releases: ReleaseSummary[];
  packages: PackageTile[];
  selection: Record<string, string>;
}) {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [open]);

  const items = useMemo(() => {
    const pages: Item[] = [
      { id: "overview", label: "Overview", hint: "Page", to: withSearch("/", tag, selection) },
      { id: "packages", label: "Packages", hint: "Page", to: withSearch("/packages", tag, selection) },
      { id: "images", label: "Images", hint: "Page", to: withSearch("/images", tag, selection) },
      { id: "scans", label: "Scans", hint: "Page", to: withSearch("/scans", tag, selection) },
      { id: "services", label: "Services", hint: "Page", to: withSearch("/services", tag, selection) },
    ];
    const releaseItems = releases.map((release) => ({
      id: `release-${release.tag}`,
      label: release.tag,
      hint: "Release",
      to: withSearch("/", release.tag, { profiles: selection.profiles ?? "", profileMode: selection.profileMode ?? "" }),
    }));
    const packageItems = packages.map((pkg) => ({
      id: `pkg-${pkg.key}`,
      label: pkg.key,
      hint: "Package",
      to: withSearch(`/packages/${encodeURIComponent(pkg.key)}`, tag, selection),
    }));
    const needle = query.trim().toLowerCase();
    return [...pages, ...releaseItems, ...packageItems].filter((item) =>
      !needle || `${item.label} ${item.hint}`.toLowerCase().includes(needle),
    );
  }, [packages, query, releases, tag, selection]);

  return (
    <dialog
      ref={dialog}
      aria-label="Search"
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--foreground)] shadow-[var(--shadow)] backdrop:bg-black/50"
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex items-center border-b border-[var(--border)] px-4">
        <input
          autoFocus
          aria-label="Search releases, packages, and pages"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && items[0]) {
              navigate(items[0].to);
              onClose();
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              dialog.current?.querySelector<HTMLAnchorElement>("li a")?.focus();
            }
          }}
          placeholder="Releases, packages, pages…"
          className="min-w-0 flex-1 bg-transparent py-4 text-sm"
        />
        <button type="button" onClick={onClose} className="ml-3 rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]" aria-label="Close search">Esc</button>
      </div>
      <ul className="max-h-80 overflow-y-auto overscroll-contain py-1" onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const links = Array.from(event.currentTarget.querySelectorAll("a"));
        const index = links.indexOf(document.activeElement as HTMLAnchorElement);
        event.preventDefault();
        links[(index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
      }}>
        {items.length === 0 ? (
          <li className="px-4 py-3 text-sm text-[var(--muted)]">Nothing matches.</li>
        ) : items.slice(0, 30).map((item) => (
          <li key={item.id}>
            <Link
              to={item.to}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[var(--accent)] focus-visible:bg-[var(--accent)]"
              onClick={onClose}
            >
              <span>{item.label}</span>
              <span className="text-[var(--muted)]">{item.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
