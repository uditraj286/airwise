"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, LogIn, LogOut, PanelLeft } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/components/layout/nav";
import { useT } from "@/i18n/useT";
import { signOutUser } from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useCloudStatus } from "@/lib/firebase/sync";
import { useAlerts } from "@/lib/useAlerts";

const linkBase = "relative flex items-center gap-3 rounded-xl py-2.5 pl-4 pr-3 text-[15px] transition-colors";

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${linkBase} ${active ? "font-semibold text-ink" : "text-muted hover:bg-surface hover:text-ink"}`}
    >
      {active && (
        <span
          className="absolute -left-4 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-brand"
          aria-hidden="true"
        />
      )}
      <Icon
        className={`h-[19px] w-[19px] ${active ? "text-brand" : ""}`}
        aria-hidden="true"
        strokeWidth={active ? 2.25 : 1.75}
      />
      {t(item.label)}
    </Link>
  );
}

/** Promo card at the bottom of the sidebar: turns on smog alerts (the reference's "Download our app" slot). */
function AlertsPromo() {
  const { enabled, permission, enable } = useAlerts();
  if (permission === "unsupported") return null;
  return (
    <div className="card-dark mt-5 rounded-[22px] p-4">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
        <BellRing className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-3 text-[17px] font-medium leading-snug">
        {enabled ? "Smog alerts are on" : "Get smog alerts"}
      </p>
      <p className="mt-1 text-caption text-white/75">
        {enabled
          ? "We'll tell you when clean air starts or smog gets worse, while AirWise is open."
          : "Know when to open windows and when to bring the kids in."}
      </p>
      {!enabled && (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={permission === "denied"}
          className="mt-3 w-full rounded-full bg-[#22c55e] px-4 py-2 text-label font-semibold text-[#052e16] transition-colors hover:bg-[#4ade80] disabled:opacity-70"
        >
          {permission === "denied" ? "Blocked in browser settings" : "Turn on alerts"}
        </button>
      )}
    </div>
  );
}

/** Left navigation in the reference style: logo, MENU and GENERAL groups with an active bar, alerts promo. */
export function Sidebar({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const cloud = useCloudStatus();
  const signedIn = cloud.state === "ready" && !cloud.isAnonymous;
  const isActive = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("#")[0] ?? href);

  return (
    <div className="panel flex h-full flex-col overflow-y-auto px-4 pb-4 pt-7">
      <div className="mb-9 flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-2.5" onClick={onNavigate}>
          <Logo className="h-9 w-9 text-brand" />
          <span className="text-[22px] font-semibold tracking-tight">AirWise</span>
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-lg p-1.5 text-muted hover:bg-surface"
            aria-label="Close menu"
          >
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="mb-2 px-4 text-caption font-medium uppercase tracking-wider text-muted">{t("menu")}</p>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}
      </nav>

      <p className="mb-2 mt-8 px-4 text-caption font-medium uppercase tracking-wider text-muted">
        {t("general")}
      </p>
      <nav aria-label="General" className="flex flex-col gap-0.5">
        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={item.href === "/settings" && isActive(item.href)}
            onNavigate={onNavigate}
          />
        ))}
        {isFirebaseConfigured() &&
          (signedIn ? (
            <button
              type="button"
              className={`${linkBase} text-muted hover:bg-surface hover:text-ink`}
              onClick={async () => {
                onNavigate?.();
                await signOutUser().catch(() => undefined);
                router.push("/login");
              }}
            >
              <LogOut className="h-[19px] w-[19px]" aria-hidden="true" strokeWidth={1.75} /> Sign out
            </button>
          ) : (
            <Link
              href="/login"
              onClick={onNavigate}
              className={`${linkBase} text-muted hover:bg-surface hover:text-ink`}
            >
              <LogIn className="h-[19px] w-[19px]" aria-hidden="true" strokeWidth={1.75} /> Sign in
            </Link>
          ))}
      </nav>

      <div className="mt-auto">
        <AlertsPromo />
      </div>
    </div>
  );
}
