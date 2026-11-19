import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CountUp } from "@/components/ui/CountUp";

/**
 * Reference-style KPI card: title with a round ↗ link, a big number, and a footer line.
 * `hero` paints the one card that matters most in the green gradient.
 */
export function StatCard({
  title,
  value,
  decimals = 0,
  suffix = "",
  unit,
  foot,
  href,
  linkLabel,
  hero = false,
}: {
  title: string;
  value: number;
  decimals?: number;
  suffix?: string;
  unit?: ReactNode;
  foot?: ReactNode;
  href?: string;
  linkLabel?: string;
  hero?: boolean;
}) {
  return (
    <div
      className={`animate-in relative flex min-h-[176px] min-w-0 flex-col justify-between overflow-hidden rounded-card p-5 sm:p-6 ${hero ? "hero-gradient shadow-lg" : "card"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={`min-w-0 text-[17px] font-medium leading-snug ${hero ? "text-white" : ""}`}>
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            aria-label={linkLabel ?? `Open ${title}`}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-200 hover:-translate-y-0.5 ${
              hero ? "bg-white text-brand-strong" : "border border-ink/80 text-ink"
            }`}
          >
            <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        )}
      </div>
      <p className={`mt-4 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 ${hero ? "text-white" : ""}`}>
        <span className="whitespace-nowrap text-[clamp(36px,3.4vw,48px)] font-semibold leading-none tracking-tight">
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        </span>
        {unit && (
          <span className={`min-w-0 text-[15px] leading-snug ${hero ? "text-white/80" : "text-muted"}`}>
            {unit}
          </span>
        )}
      </p>
      {foot && (
        <div className={`mt-4 min-w-0 text-label leading-relaxed ${hero ? "text-white/85" : "text-muted"}`}>
          {foot}
        </div>
      )}
    </div>
  );
}

/** Small boxed change indicator: "↓ 24%" in the reference's chip style. */
export function ChangeChip({
  value,
  hero = false,
  higherIsBetter = false,
}: {
  value: number | null;
  hero?: boolean;
  higherIsBetter?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value > 0;
  const good = up === higherIsBetter;
  const tone = hero
    ? "border-white/60 text-white"
    : good
      ? "border-good/50 text-good"
      : "border-bad/50 text-bad";
  return (
    <span
      className={`mr-1.5 inline-flex items-center rounded-md border px-1.5 py-px text-caption font-semibold tabular-nums ${tone}`}
    >
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      <span className="sr-only">{up ? "up" : "down"} </span>
      {Math.abs(Math.round(value))}%
    </span>
  );
}
