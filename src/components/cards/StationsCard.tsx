"use client";

import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { AQI_BG } from "@/components/ui/aqi";
import { categoryLabel } from "@/i18n/dict";
import { aqiCategory } from "@/lib/air/aqi";
import type { NearbyStation } from "@/lib/air/stations";
import type { Language } from "@/lib/types";

/** Live government (CPCB) monitoring stations within 50 km, refreshed every minute. Hidden where there are none. */
export function StationsCard({ lat, lon, lang }: { lat: number; lon: number; lang: Language }) {
  const [stations, setStations] = useState<NearbyStation[] | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const load = (): void => {
      fetch(`/api/stations?lat=${lat}&lon=${lon}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<NearbyStation[]>) : []))
        .then((s) => setStations(s))
        .catch(() => {
          if (!ctrl.signal.aborted) setStations([]);
        });
    };
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [lat, lon]);

  if (stations && stations.length === 0) return null;
  const max = Math.max(...(stations ?? []).map((s) => s.aqi), 1);

  return (
    <Card className="animate-in h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">Stations near you</h2>
          <p className="mt-0.5 text-label text-muted">
            Live AQI measured by government monitors (CPCB), within 50 km.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-caption font-medium text-ink">
          <Radio className="h-3.5 w-3.5 text-good" aria-hidden="true" /> Live
        </span>
      </div>
      {stations === null ? (
        <div className="mt-4 space-y-3" aria-label="Loading stations">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {stations.map((s) => {
            const cat = aqiCategory(s.aqi);
            return (
              <li key={s.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-medium">
                    {s.name.replace(/ - [A-Z]+$/, "")}
                  </span>
                  <span className="shrink-0 text-label">
                    <span className="font-semibold tabular-nums">{s.aqi}</span>{" "}
                    <span className="text-muted">{categoryLabel(lang, cat)}</span>
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                    <div
                      className={`bar-grow-x h-full rounded-full ${AQI_BG[cat]}`}
                      style={{ width: `${(s.aqi / max) * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-caption text-muted">
                    {s.distanceKm} km ·{" "}
                    {new Date(s.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
