import { aqiCategory, timesWhoGuideline } from "@/lib/air/aqi";
import type { DayOutlook, HourSlot } from "@/lib/air/dayWindows";
import { hourLabel } from "@/lib/air/time";
import { pointNear } from "@/lib/air/trends";
import type { Slot } from "@/lib/ai/fallback";
import type { AirSnapshot, AqiCategory } from "@/lib/types";

export type AlertKind = "clean" | "worse" | "change" | "step";

export interface SmogAlert {
  /** Stable per day, so each alert is sent once. */
  key: string;
  kind: AlertKind;
  title: string;
  body: string;
}

export interface PlanStep {
  actionId: string;
  title: string;
  slot: Slot;
  time: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const SOON = 15 * MIN;
const AHEAD = 2 * HOUR;
const BAD = new Set<AqiCategory>(["very_poor", "severe"]);
const LEVEL: Record<AqiCategory, number> = {
  good: 0,
  satisfactory: 1,
  moderate: 2,
  poor: 3,
  very_poor: 4,
  severe: 5,
};
const NAME: Record<AqiCategory, string> = {
  good: "Good",
  satisfactory: "Satisfactory",
  moderate: "Moderate",
  poor: "Poor",
  very_poor: "Very Poor",
  severe: "Severe",
};
const ADVICE: Record<AqiCategory, string> = {
  good: "A good time to open the windows and go out.",
  satisfactory: "Fine for most people; sensitive people can go out with care.",
  moderate: "Keep outdoor time short for children, elders and anyone with asthma.",
  poor: "Keep windows shut, run a purifier if you have one, and wear an N95 mask outside.",
  very_poor: "Stay indoors with windows shut. Bring children and elders in.",
  severe: "Stay indoors. Avoid all outdoor exercise, and wear an N95 mask if you must go out.",
};

const slotOfHour = (h: number): Slot =>
  h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";

/** "AQI 176 (Moderate), fine smoke 83 micrograms per cubic metre, 5.5× the WHO limit". */
function reading(aqi: number, pm25: number): string {
  return `AQI ${aqi} (${NAME[aqiCategory(aqi)]}), fine smoke ${Math.round(pm25)} micrograms per cubic metre, ${timesWhoGuideline(pm25)}× the WHO limit`;
}

/** Where the number comes from, so people know it is measured, not guessed. */
function sourceOf(air: AirSnapshot): string {
  if (air.station) {
    const n = air.station.count ?? 1;
    return `Measured by ${n} CPCB ${n === 1 ? "station" : "stations"} near you`;
  }
  return air.source === "google"
    ? "Google air quality data"
    : air.source === "mock"
      ? "Sample data"
      : "Open-Meteo forecast model";
}

/** Short place name for alert titles, e.g. "Bihta". */
const placeOf = (air: AirSnapshot): string => air.location.name.split(",")[0]?.trim() || "your area";

const slotWhen = (s: HourSlot): string => `${hourLabel(s.hour)}${s.tomorrow ? " tomorrow" : ""}`;

/**
 * Alerts that matter right now, built from the live reading, the forecast and today's plan:
 *  - the air category changed since an hour ago (with the real numbers),
 *  - the cleanest window of the day starts within 15 minutes (or has started),
 *  - the air turns Very Poor or Severe within the next 2 hours,
 *  - a plan step for the current part of the day is still to do.
 */
export function upcomingAlerts(input: {
  air: AirSnapshot;
  outlook: DayOutlook;
  steps: PlanStep[];
  done: string[];
  now: Date;
}): SmogAlert[] {
  const { air, outlook, steps, done, now } = input;
  const nowMs = now.getTime();
  const date = new Date(nowMs + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
  const place = placeOf(air);
  const cur = air.current;
  const curCat = aqiCategory(cur.aqi);
  const alerts: SmogAlert[] = [];

  // 1. The air got better or worse since an hour ago.
  const before = pointNear(air.hourly, nowMs - HOUR);
  if (before) {
    const prevCat = aqiCategory(before.aqi);
    if (prevCat !== curCat) {
      const better = LEVEL[curCat] < LEVEL[prevCat];
      alerts.push({
        key: `change-${date}-${curCat}`,
        kind: "change",
        title: `Air in ${place} is now ${NAME[curCat]} (AQI ${cur.aqi})`,
        body: `${better ? "Better" : "Worse"} than an hour ago (AQI ${before.aqi}). ${reading(cur.aqi, cur.pm25)}. ${ADVICE[curCat]} ${sourceOf(air)}.`,
      });
    }
  }

  // 2. The cleanest stretch of the day is starting.
  const firstBest = outlook.slots.find((s) => s.verdict === "best");
  if (firstBest && outlook.goOut) {
    const start = Date.parse(firstBest.time);
    if (firstBest.isNow || (start > nowMs && start - nowMs <= SOON)) {
      alerts.push({
        key: `clean-${firstBest.time}`,
        kind: "clean",
        title: firstBest.isNow
          ? `Cleanest air of the day in ${place} is now`
          : `Cleanest air in ${place} starts at ${slotWhen(firstBest)}`,
        body: `${outlook.goOut.label}: ${reading(firstBest.aqi, firstBest.pm25)}. ${
          outlook.goOut.safe
            ? "A good time for walks, play and airing the house."
            : "Still unhealthy, so keep it short and wear an N95 mask."
        } Now: AQI ${cur.aqi}.`,
      });
    }
  }

  // 3. Smog is about to turn Very Poor or Severe.
  const turning = outlook.slots.find((s) => {
    const t = Date.parse(s.time);
    return !s.isNow && t > nowMs && t - nowMs <= AHEAD && BAD.has(s.category);
  });
  if (turning && !BAD.has(curCat)) {
    alerts.push({
      key: `worse-${turning.time}`,
      kind: "worse",
      title: `Air in ${place} turns ${NAME[turning.category]} around ${slotWhen(turning)}`,
      body: `Forecast: ${reading(turning.aqi, turning.pm25)}. Now: AQI ${cur.aqi}. ${ADVICE[turning.category]}`,
    });
  }

  // 4. A plan step for this part of the day is still to do.
  const hour = new Date(nowMs + air.utcOffsetSeconds * 1000).getUTCHours();
  const step = steps.find((s) => s.slot === slotOfHour(hour) && !done.includes(s.actionId));
  if (step) {
    alerts.push({
      key: `step-${date}-${step.actionId}`,
      kind: "step",
      title: `Time for: ${step.title}`,
      body: `${step.time}. Air in ${place} right now: AQI ${cur.aqi} (${NAME[curCat]}). Tap to open today's plan.`,
    });
  }
  return alerts;
}

/** Keys not yet notified today. */
export const unseen = (alerts: SmogAlert[], seen: string[]): SmogAlert[] =>
  alerts.filter((a) => !seen.includes(a.key));

/** One-line live status for the alerts menu, e.g. "AQI 176 · Moderate · fine smoke 83". */
export function liveSummary(air: AirSnapshot): {
  place: string;
  aqi: number;
  category: string;
  detail: string;
  source: string;
  updatedAt: string;
} {
  return {
    place: placeOf(air),
    aqi: air.current.aqi,
    category: NAME[aqiCategory(air.current.aqi)],
    detail: `Fine smoke ${Math.round(air.current.pm25)} micrograms per cubic metre · ${timesWhoGuideline(air.current.pm25)}× the WHO limit`,
    source: sourceOf(air),
    updatedAt: air.station?.updatedAt ?? air.updatedAt,
  };
}
