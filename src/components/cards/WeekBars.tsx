"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { categoryLabel } from "@/i18n/dict";
import { aqiCategory } from "@/lib/air/aqi";
import { dailyAverages } from "@/lib/air/trends";
import type { AirSnapshot, Language } from "@/lib/types";

const DAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });

/** Pill bar chart of daily fine smoke: solid for days measured, striped for forecast days, as in the reference. */
export function WeekBars({ air, lang }: { air: AirSnapshot; lang: Language }) {
  const days = dailyAverages(air).slice(-7);
  const [nowMs] = useState(() => Date.now());
  const today = new Date(nowMs + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
  const todayIndex = Math.max(
    0,
    days.findIndex((d) => d.date === today),
  );
  const [focus, setFocus] = useState<number | null>(null);
  const shown = focus ?? todayIndex;
  const max = Math.max(...days.map((d) => d.pm25), 1);
  const worst = days.reduce((a, d) => (d.pm25 > a.pm25 ? d : a), days[0] ?? { date: "", pm25: 0, aqi: 0 });
  const best = days.reduce((a, d) => (d.pm25 < a.pm25 ? d : a), days[0] ?? { date: "", pm25: 0, aqi: 0 });
  const name = (date: string): string =>
    date === today ? "Today" : LONG.format(new Date(`${date}T00:00:00Z`));

  return (
    <Card className="animate-in h-full flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight">Air this week</h2>
        <p className="text-caption text-muted">Daily average of fine smoke (PM2.5)</p>
      </div>
      {days.length > 1 && (
        <p className="mt-1 text-label text-muted">
          Cleanest: <span className="font-medium text-ink">{name(best.date)}</span> · Worst:{" "}
          <span className="font-medium text-ink">{name(worst.date)}</span>
        </p>
      )}
      <ol
        className="mt-4 flex h-72 items-end justify-between gap-2 pt-10 sm:gap-4"
        aria-label="Fine smoke by day"
      >
        {days.map((d, i) => {
          const forecast = d.date > today;
          const isToday = i === todayIndex;
          const cat = aqiCategory(d.aqi);
          return (
            <li key={d.date} className="relative flex h-full flex-1 flex-col items-center justify-end gap-2">
              {shown === i && (
                <span
                  className="absolute z-10 whitespace-nowrap rounded-full border border-brand/30 bg-surface px-2 py-0.5 text-caption font-semibold text-brand shadow-card"
                  style={{ bottom: `calc(${Math.max(14, (d.pm25 / max) * 100)}% + 28px)` }}
                  aria-hidden="true"
                >
                  {d.pm25}
                </span>
              )}
              <button
                type="button"
                onMouseEnter={() => setFocus(i)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus(null)}
                aria-label={`${name(d.date)}${forecast ? " (forecast)" : ""}: ${d.pm25} micrograms per cubic metre, ${categoryLabel(lang, cat)}`}
                className={`bar-grow w-full max-w-[64px] rounded-full ${forecast ? "hatch" : isToday ? "bg-brand-strong" : "bg-brand/70"}`}
                style={{ height: `${Math.max(14, (d.pm25 / max) * 100)}%`, animationDelay: `${i * 40}ms` }}
              />
              <span
                className={`text-label ${isToday ? "font-semibold text-ink" : "text-muted"}`}
                aria-hidden="true"
              >
                {isToday ? "Today" : DAY.format(new Date(`${d.date}T00:00:00Z`))}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-caption text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-brand/70" aria-hidden="true" /> Measured
        </span>
        <span className="flex items-center gap-1.5">
          <span className="hatch h-2.5 w-4 rounded-full" aria-hidden="true" /> Forecast
        </span>
        <span>Taller bar = more smoke</span>
      </p>
    </Card>
  );
}
