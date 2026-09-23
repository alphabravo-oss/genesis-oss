import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

const KEY = "genesis-console-theme";

type ThemeValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
  cycle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* this page keeps the default */
  }
  return "system";
}

function systemDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [osDark, setOsDark] = useState(systemDark);
  const resolved = preference === "system" ? (osDark ? "dark" : "light") : preference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setOsDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--background").trim());
    try {
      localStorage.setItem(KEY, preference);
    } catch {
      /* preference lasts for this page only */
    }
  }, [preference, resolved]);

  const cycle = () => {
    setPreference((current) => (current === "system" ? "light" : current === "light" ? "dark" : "system"));
  };

  return <ThemeContext.Provider value={{ preference, resolved, setPreference, cycle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme outside ThemeProvider");
  return value;
}
