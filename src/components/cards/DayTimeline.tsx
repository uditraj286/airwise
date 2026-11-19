"use client";

import { Unit } from "@/components/ui/Unit";
import { House, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { VERDICT_TEXT, dayOutlook, slotLabel, type Verdict } from "@/lib/air/dayWindows";
import type { AirSnapshot } from "@/lib/types";

const VERDICT_BG: Record<Verdict, string> = {
  best: "bg-brand",
  okay: "bg-aqi-moderate",
  avoid: "bg-aqi-very-poor",
};

/**
 * "Today at a glance": the next 24 hours as one coloured band, plus the two answers families actually need —
 * when to go out and when to stay in.
 */
export function DayTimeline({ air }: { air: AirSnapshot }) {
  const outlook = useMemo(() => dayOutlook(air), [air]);
  const [hover, setHover] = useState<number | null>(null);
  const focused = hover !== null ? outlook.slots[hover] : undefined;

  if (outlook.slots.length === 0) return null;

  return (
    <Card className="animate-in">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-title">Today at a glance</h2>
        <p className="text-caption text-muted" aria-live="polite">
          {focused
            ? `${slotLabel(focused)} · ${focused.pm25} micrograms per cubic metre · ${VERDICT_TEXT[focused.verdict]}`
            : "Next 24 hours, hour by hour"}
        </p>
      </div>

      <div className="mt-5">
        <ol className="flex h-9 gap-[3px]" aria-label="Next 24 hours">
          {outlook.slots.map((s, i) => (
            <li key={s.time} className="relative flex-1">
              <button
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${slotLabel(s)}: ${s.pm25} micrograms per cubic metre. ${VERDICT_TEXT[s.verdict]}.`}
                className={`h-full w-full transition-transform duration-200 ease-standard hover:scale-y-110 ${VERDICT_BG[s.verdict]} ${
                  i === 0 ? "rounded-l-lg" : ""
                } ${i === outlook.slots.length - 1 ? "rounded-r-lg" : ""}`}
              />
              {s.isNow && (
                <span
                  className="pointer-events-none absolute -top-1.5 left-0 h-12 w-[2px] rounded bg-ink"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
        <div className="mt-2 flex text-caption text-muted" aria-hidden="true">
          {outlook.slots.map((s, i) => (
            <span key={s.time} className="flex-1 whitespace-nowrap">
              {i % 3 === 0 ? (
                i === 0 ? (
                  <strong className="font-medium text-ink">Now</strong>
                ) : (
                  slotLabel(s)
                )
              ) : (
                ""
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {outlook.goOut && (
          <div className="flex items-start gap-3 rounded-2xl bg-brand/5 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10">
              <Sun className="h-[18px] w-[18px] text-brand" aria-hidden="true" />
            </span>
            <div>
              <p className="text-label text-muted">{"Lowest particle levels in daylight"}</p>
              <p className="text-title">{outlook.goOut.label}</p>
              <p className="text-caption text-muted">
                Fine particles are forecast at about {outlook.goOut.pm25} <Unit />.
                {!outlook.goOut.safe && " Pollution is still elevated during this window."}
              </p>
            </div>
          </div>
        )}
        {outlook.stayIn.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl bg-aqi-very-poor/10 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-aqi-very-poor/20">
              <House className="h-[18px] w-[18px] text-bad" aria-hidden="true" />
            </span>
            <div>
              <p className="text-label text-muted">Stay in, windows shut</p>
              <p className="text-title">
                {outlook.stayIn.map((w) => (
                  <span key={w.label} className="block">
                    {w.label}
                  </span>
                ))}
              </p>
              <p className="text-caption text-muted">The smoggiest hours of the day</p>
            </div>
          </div>
        )}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
        {(["best", "okay", "avoid"] as const).map((v) => (
          <li key={v} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${VERDICT_BG[v]}`} aria-hidden="true" />
            {VERDICT_TEXT[v]}
          </li>
        ))}
      </ul>
    </Card>
  );
}
