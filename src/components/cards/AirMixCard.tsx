"use client";

import { Unit } from "@/components/ui/Unit";
import { useState } from "react";
import { SourcesDonut } from "@/components/cards/SourcesDonut";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { pollutantReadings, timesLabel, type PollutantReading } from "@/lib/air/pollutants";
import type { SourceProfile } from "@/lib/air/sources";
import type { AirSnapshot } from "@/lib/types";

type View = "now" | "sources";

const tone = (times: number): { bar: string; text: string } =>
  times <= 1
    ? { bar: "bg-aqi-good", text: "text-good" }
    : times <= 3
      ? { bar: "bg-aqi-moderate", text: "text-warn" }
      : { bar: "bg-aqi-very-poor", text: "text-bad" };

function Row({ r, scale }: { r: PollutantReading; scale: number }) {
  const t = tone(r.times);
  // Bars share one scale so they can be compared; the dashed line marks the WHO guideline.
  const width = Math.min(100, (r.times / scale) * 100);
  const limitAt = (1 / scale) * 100;
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0">
          <span className="font-medium">{r.name}</span>{" "}
          <span className="text-label tabular-nums text-muted">
            {r.value} <Unit kind={r.key === "co" ? "milliConc" : "conc"} />
          </span>
        </p>
        <p className={`text-label font-medium ${t.text}`}>{timesLabel(r.times)}</p>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-subtle" aria-hidden="true">
        <div
          className={`bar-grow-x h-full rounded-full ${t.bar}`}
          style={{ width: `${Math.max(2, width)}%` }}
        />
        <span
          className="absolute -inset-y-1 w-px border-l border-dashed border-ink/50"
          style={{ left: `${limitAt}%` }}
        />
      </div>
      <p className="mt-1 text-caption text-muted">{r.from}</p>
    </li>
  );
}

/** Live mix of pollutants in the air right now (vs WHO limits), with the usual city sources on a second tab. */
export function AirMixCard({ air, sources }: { air: AirSnapshot; sources: SourceProfile }) {
  const [view, setView] = useState<View>("now");
  const readings = pollutantReadings(air.current);
  const worst = readings[0];
  const scale = Math.max(4, Math.ceil(Math.max(...readings.map((r) => r.times), 1)));

  return (
    <Card className="animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title">What&apos;s in your air</h2>
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "now", label: "Right now" },
            { value: "sources", label: "Usual sources" },
          ]}
        />
      </div>

      {view === "now" ? (
        <>
          {worst && (
            <p className="mt-4 text-label text-muted">
              {worst.times > 1 ? (
                <>
                  <strong className="font-medium text-ink">{worst.name}</strong> is furthest above its
                  guideline at {timesLabel(worst.times)}.
                </>
              ) : (
                "Current levels are at or below the guideline values shown."
              )}
            </p>
          )}
          <ul
            className="mt-4 space-y-3.5"
            aria-label="Pollutants right now compared with WHO guideline values"
          >
            {readings.map((r) => (
              <Row key={r.key} r={r} scale={scale} />
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-caption text-muted">
            <span className="inline-block h-3 w-px border-l border-dashed border-ink/50" aria-hidden="true" />
            The dashed line marks each pollutant’s guideline. These hourly estimates are compared with WHO
            guidelines for 24-hour averages, or an 8-hour average for ozone.
          </p>
        </>
      ) : (
        <SourcesDonut
          bare
          title="Where your city's smog usually comes from"
          data={sources}
          centerLabel="top source"
        />
      )}
    </Card>
  );
}
