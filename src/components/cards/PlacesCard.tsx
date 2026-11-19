"use client";

import { MapPin, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { Card } from "@/components/ui/Card";
import { AQI_BG } from "@/components/ui/aqi";
import { categoryLabel } from "@/i18n/dict";
import { aqiCategory } from "@/lib/air/aqi";
import { forgetPlace, rememberPlace, usePlaces, type Place } from "@/lib/places";
import { useProfile } from "@/lib/profile/store";
import type { BatchReading } from "@/lib/ai/schemas";

type Reading = { aqi: number } | "error" | undefined;
const key = (p: Place): string => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;

/** Live AQI for a few saved places in one batched request, refreshed every 5 minutes (server-cached per place). */
function usePlaceReadings(places: Place[]): Record<string, Reading> {
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const list = places.map(key).join("|");
  useEffect(() => {
    const ctrl = new AbortController();
    const points = places.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(";");
    const load = (): void => {
      const params = new URLSearchParams({ points, tzOffsetMin: String(new Date().getTimezoneOffset()) });
      fetch(`/api/air/batch?${params}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) =>
          r.ok ? (r.json() as Promise<BatchReading[]>) : Promise.reject(new Error("unavailable")),
        )
        .then((rows) =>
          setReadings(
            Object.fromEntries(
              rows.map((r) => [
                `${r.lat.toFixed(4)},${r.lon.toFixed(4)}`,
                r.aqi === null ? "error" : { aqi: r.aqi },
              ]),
            ),
          ),
        )
        .catch(() => {
          if (!ctrl.signal.aborted)
            setReadings(Object.fromEntries(places.map((p) => [key(p), "error" as const])));
        });
    };
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `list` captures the places that matter
  }, [list]);
  return readings;
}

/** "Your places": compare live air at home, school, office or relatives' homes, and switch with one tap. */
export function PlacesCard() {
  const { profile, save } = useProfile();
  const saved = usePlaces();
  const [adding, setAdding] = useState(false);
  const home = profile.location;
  const others = saved.filter((p) => key(p) !== key(home)).slice(0, 4);
  const shown = [home, ...others];
  const readings = usePlaceReadings(shown);

  return (
    <Card className="animate-in h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">Your places</h2>
          <p className="mt-0.5 text-label text-muted">Compare the air where your family spends the day.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/70 px-3.5 py-1.5 text-label font-medium hover:bg-subtle"
        >
          {adding ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          {adding ? "Close" : "Add place"}
        </button>
      </div>

      {adding && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <LocationPicker
            onChange={(p) => {
              rememberPlace(p);
              setAdding(false);
            }}
          />
        </div>
      )}

      <ul className="mt-4 divide-y divide-line">
        {shown.map((p, i) => {
          const r = readings[key(p)];
          const cat = r && r !== "error" ? aqiCategory(r.aqi) : null;
          return (
            <li key={key(p)} className="flex items-center gap-3 py-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${i === 0 ? "bg-brand/10 text-brand" : "bg-subtle text-muted"}`}
              >
                <MapPin className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{p.name.split(",")[0]}</span>
                <span className="block truncate text-caption text-muted">
                  {i === 0
                    ? "Your household's location"
                    : p.name.split(",").slice(1).join(",").trim() || "Saved place"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {r === undefined ? (
                  <span className="skeleton block h-5 w-16" aria-label="Loading" />
                ) : r === "error" ? (
                  <span className="text-caption text-muted">Unavailable</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${AQI_BG[cat!]}`} aria-hidden="true" />
                    <span className="text-[17px] font-semibold tabular-nums">{r.aqi}</span>
                    <span className="hidden text-caption text-muted sm:inline">
                      {categoryLabel(profile.language, cat!)}
                    </span>
                  </span>
                )}
              </span>
              {i > 0 && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => save({ ...profile, location: p, locationConfirmed: true })}
                    className="rounded-full border border-line px-3 py-1 text-caption font-medium hover:border-brand hover:text-brand"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    onClick={() => forgetPlace(p)}
                    aria-label={`Remove ${p.name.split(",")[0]}`}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-subtle hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {others.length === 0 && !adding && (
        <p className="mt-1 text-label text-muted">
          Add your school, office or a relative&apos;s home to compare their air with yours.
        </p>
      )}
    </Card>
  );
}
