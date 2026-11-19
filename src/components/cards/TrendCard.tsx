"use client";

import { Unit } from "@/components/ui/Unit";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { AQI_BG, AQI_ORDER } from "@/components/ui/aqi";
import { aqiCategory } from "@/lib/air/aqi";
import { hourLabel, localHour } from "@/lib/air/time";
import { dailyAverages, nextHours, niceScale, pastHours } from "@/lib/air/trends";
import { categoryLabel } from "@/i18n/dict";
import type { AirSnapshot, AqiCategory, Language } from "@/lib/types";

type Range = "past" | "next" | "days";
interface Bar {
  key: string;
  label: string;
  long: string;
  value: number;
  category: AqiCategory;
}

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
const HOUR = 3600_000;

function buildBars(air: AirSnapshot, range: Range, now: Date): Bar[] {
  if (range === "days") {
    const today = new Date(now.getTime() + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
    return dailyAverages(air).map((d) => {
      const day = WEEKDAY.format(new Date(`${d.date}T00:00:00Z`));
      const label = d.date === today ? "Today" : day;
      return {
        key: d.date,
        label,
        long: `${label} (daily average)`,
        value: d.pm25,
        category: aqiCategory(d.aqi),
      };
    });
  }
  const pts = range === "past" ? pastHours(air.hourly, now, 12) : nextHours(air.hourly, now, 12);
  return pts.map((p) => {
    const t = Date.parse(p.time);
    const isNow = now.getTime() >= t && now.getTime() < t + HOUR;
    const label = isNow ? "Now" : hourLabel(localHour(p.time, air.utcOffsetSeconds));
    return {
      key: p.time,
      label,
      long: label === "Now" ? "Right now" : label,
      value: Math.round(p.pm25),
      category: aqiCategory(p.aqi),
    };
  });
}

const HEADLINE: Record<Range, string> = {
  past: "Cleanest hour so far",
  next: "Lowest level in the next 12 hours",
  days: "Cleanest day",
};

/** Bar chart of PM2.5. Bars are coloured by AQI category so every hour reads at a glance. */
export function TrendCard({ air, lang }: { air: AirSnapshot; lang: Language }) {
  const [range, setRange] = useState<Range>("next");
  const now = useMemo(() => new Date(Math.max(new Date().getTime(), Date.parse(air.updatedAt))), [air]);
  const bars = useMemo(() => buildBars(air, range, now), [air, range, now]);
  const [focus, setFocus] = useState<number | null>(null);

  const bestIndex = bars.reduce(
    (best, b, i, arr) => (b.value < (arr[best]?.value ?? Infinity) ? i : best),
    0,
  );
  const best = bars[bestIndex];
  const peak = bars.reduce<Bar | undefined>((p, b) => (!p || b.value > p.value ? b : p), undefined);
  const { top, ticks } = niceScale(Math.max(...bars.map((b) => b.value), 1));
  const shown = focus ?? bestIndex;
  const shownBar = bars[shown];
  const below =
    best && peak && peak.value > 0 ? Math.round(((peak.value - best.value) / peak.value) * 100) : 0;
  const categories = AQI_ORDER.filter((c) => bars.some((b) => b.category === c));

  return (
    <Card className="animate-in flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title">PM2.5 by hour</h2>
        <Segmented
          label="Time range"
          value={range}
          onChange={(v) => {
            setRange(v);
            setFocus(null);
          }}
          options={[
            { value: "past", label: "Past 12h" },
            { value: "next", label: "Next 12h" },
            { value: "days", label: "Next days" },
          ]}
        />
      </div>

      {best && (
        <div className="mt-6">
          <p className="text-label text-muted">{HEADLINE[range]}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-display">{best.label}</span>
            {" · "}
            <span className="text-title text-muted">{categoryLabel(lang, best.category)} air quality</span>
          </p>
          <p className="mt-1 text-label text-muted">
            Fine particles (PM2.5) at {best.value} <Unit />
          </p>
          {peak && below > 0 && (
            <p className="mt-1 text-label text-muted">
              <strong className="font-medium text-ink">{below}% lower</strong> than the highest fine-particle
              level in this period ({peak.value} <Unit /> at {peak.label}).
            </p>
          )}
        </div>
      )}

      <figure className="mt-6 flex flex-1 flex-col">
        {shownBar && (
          <div
            className="pointer-events-none relative mb-2 w-fit max-w-full rounded-lg bg-surface px-2.5 py-1.5 text-caption shadow-card"
            aria-hidden="true"
          >
            <span className="block text-muted">{shown === bestIndex ? HEADLINE[range] : shownBar.long}</span>
            <span className="font-medium">
              {shownBar.value} <Unit /> · {categoryLabel(lang, shownBar.category)}
            </span>
          </div>
        )}

        <div className="relative flex min-h-64 flex-1 flex-col">
          {/* gridlines + y ticks, aligned with the bars' drawing area (below the tooltip row, above the labels) */}
          <div className="absolute inset-x-0 bottom-6 left-9 top-0" aria-hidden="true">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-dashed border-line"
                style={{ bottom: `${(t / top) * 100}%` }}
              >
                <span className="absolute -left-9 -translate-y-1/2 text-caption tabular-nums text-muted">
                  {t}
                </span>
              </div>
            ))}
          </div>

          <ol
            className="relative ml-9 flex flex-1 items-end gap-1.5 pb-6 sm:gap-2.5"
            aria-label="PM2.5 bar chart"
          >
            {bars.map((b, i) => (
              <li key={b.key} className="relative flex h-full flex-1 flex-col items-center justify-end">
                <button
                  type="button"
                  onMouseEnter={() => setFocus(i)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(i)}
                  onBlur={() => setFocus(null)}
                  aria-label={`${b.long}: ${b.value} micrograms per cubic metre, ${categoryLabel(lang, b.category)}${i === bestIndex ? `. ${HEADLINE[range]}` : ""}`}
                  className={`bar-grow w-full max-w-[44px] rounded-t-[8px] rounded-b-[3px] transition-opacity duration-200 ${AQI_BG[b.category]} ${
                    focus !== null && focus !== i ? "opacity-40" : ""
                  } ${i === bestIndex ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                  style={{ height: `${Math.max(3, (b.value / top) * 100)}%`, animationDelay: `${i * 30}ms` }}
                />
                <span
                  className={`absolute -bottom-0.5 translate-y-full whitespace-nowrap text-caption ${
                    b.label === "Now" || b.label === "Today" ? "font-medium text-ink" : "text-muted"
                  } ${bars.length > 8 && i % 2 === 1 ? "hidden" : ""}`}
                  aria-hidden="true"
                >
                  {b.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <figcaption className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
          {categories.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${AQI_BG[c]}`} aria-hidden="true" />
              {categoryLabel(lang, c)}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-ink" aria-hidden="true" />
            Cleanest
          </span>
        </figcaption>
      </figure>
    </Card>
  );
}
