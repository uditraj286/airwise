"use client";

import { Activity, Bell, BellRing, CloudSun, Menu, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";
import { useT } from "@/i18n/useT";
import { useCloudStatus } from "@/lib/firebase/sync";
import { useProfile } from "@/lib/profile/store";
import { useAlerts } from "@/lib/useAlerts";
import { liveSummary } from "@/lib/alerts";
import { useLiveAir } from "@/lib/airContext";
import { AQI_BG } from "@/components/ui/aqi";
import { aqiCategory } from "@/lib/air/aqi";

const ALERT_ICON = { clean: CloudSun, worse: TriangleAlert, change: Activity, step: BellRing } as const;

/** Today's alerts in a dropdown; works without notification permission. */
function AlertsMenu() {
  const { alerts, enabled, permission, enable } = useAlerts();
  const air = useLiveAir();
  const live = air.status === "ready" ? liveSummary(air.data) : null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Alerts${alerts.length ? `, ${alerts.length} new` : ""}`}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-card hover:text-brand"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {alerts.length > 0 && (
          <span
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-bad ring-2 ring-surface"
            aria-hidden="true"
          />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Alerts"
          className="card animate-in absolute right-0 z-30 mt-2 w-80 p-2"
        >
          {live && (
            <div className="mb-2 rounded-xl bg-subtle p-3">
              <p className="text-caption text-muted">Live air in {live.place}</p>
              <p className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${AQI_BG[aqiCategory(live.aqi)]}`}
                  aria-hidden="true"
                />
                <span className="text-[20px] font-semibold tabular-nums">AQI {live.aqi}</span>
                <span className="text-label text-muted">{live.category}</span>
              </p>
              <p className="mt-1 text-caption text-muted">{live.detail}</p>
              <p className="mt-1 text-caption text-muted">
                {live.source} · updated{" "}
                {new Date(live.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          )}
          <p className="px-2.5 pb-1 pt-1.5 text-label font-semibold">Alerts</p>
          {alerts.length === 0 ? (
            <p className="px-2.5 pb-2 text-label text-muted">
              Nothing urgent. We&apos;ll flag changes in the air, clean-air windows and smog spikes here.
            </p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a) => {
                const Icon = ALERT_ICON[a.kind];
                return (
                  <li key={a.key} className="flex gap-3 rounded-xl px-2.5 py-2 hover:bg-subtle">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${a.kind === "worse" ? "text-bad" : a.kind === "change" ? "text-warn" : "text-brand"}`}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-label font-medium">{a.title}</span>
                      <span className="block text-caption text-muted">{a.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {permission !== "unsupported" && !enabled && (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={permission === "denied"}
              className="mt-2 w-full rounded-xl bg-brand/10 px-3 py-2 text-label font-medium text-brand disabled:opacity-60"
            >
              {permission === "denied"
                ? "Notifications are blocked in your browser"
                : "Send these as notifications"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Top bar in the reference style: search pill with ⌘F, round share and alert buttons, theme, profile. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const t = useT();
  const router = useRouter();
  const { profile } = useProfile();
  const cloud = useCloudStatus();
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const signedIn = cloud.state === "ready" && !cloud.isAnonymous;
  // The household's main member is the name the user chose; fall back to the account name before setup.
  const name =
    profile.members[0]?.name ??
    (signedIn ? (cloud.name ?? cloud.email?.split("@")[0]) : undefined) ??
    "Guest";
  const sub = signedIn ? (cloud.email ?? "Signed in") : "Guest · saved on this device";

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f" && inputRef.current) {
        e.preventDefault();
        inputRef.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSearch = (e: FormEvent): void => {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    router.push(q ? `/hacks?q=${encodeURIComponent(q)}` : "/hacks");
  };

  return (
    <header className="panel relative z-20 flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onMenu}
        className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-card lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <form role="search" onSubmit={onSearch} className="hidden min-w-0 flex-1 md:block">
        <label htmlFor={searchId} className="sr-only">
          {t("search_placeholder")}
        </label>
        <div className="flex max-w-md items-center gap-3 rounded-full bg-surface px-5 py-3 shadow-card">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
          <input
            id={searchId}
            ref={inputRef}
            type="search"
            placeholder={t("search_placeholder")}
            className="w-full min-w-0 bg-transparent text-[15px] placeholder:text-muted focus:outline-none"
          />
          <kbd
            className="hidden shrink-0 rounded-md bg-subtle px-2 py-0.5 font-sans text-caption text-muted lg:inline"
            aria-hidden="true"
          >
            ⌘ F
          </kbd>
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ShareButton variant="icon" />
        <AlertsMenu />
        <ThemeToggle />
        <div className="flex items-center gap-3 pl-1">
          <AccountMenu fallbackInitial={name} />
          <Link href={signedIn ? "/settings" : "/login"} className="hidden min-w-0 leading-tight xl:block">
            <span className="block max-w-[180px] truncate text-[15px] font-semibold">{name}</span>
            <span className="block max-w-[180px] truncate text-caption text-muted">{sub}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
