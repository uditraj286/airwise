"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/useT";

type Theme = "light" | "dark";

/** Subscribe to the <html> "dark" class so every toggle on the page stays in sync. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

function applyTheme(next: Theme): void {
  document.documentElement.classList.toggle("dark", next === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", next === "dark" ? "#09090b" : "#f2f5fa");
  try {
    localStorage.setItem("airwise.theme", next);
  } catch {
    /* ignore */
  }
}

/** Pill with moon/sun buttons, as in the reference header. Persists the choice per device. */
export function ThemeToggle() {
  const t = useT();
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);

  const btn = (value: Theme, label: string, Icon: typeof Sun) => (
    <button
      type="button"
      onClick={() => applyTheme(value)}
      aria-pressed={theme === value}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-full transition ${
        theme === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-0.5 rounded-full bg-subtle p-1">
      {btn("light", t("theme_light"), Sun)}
      {btn("dark", t("theme_dark"), Moon)}
    </div>
  );
}
