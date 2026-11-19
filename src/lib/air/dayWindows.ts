import { aqiCategory } from "@/lib/air/aqi";
import { hourLabel, localHour, windowLabel } from "@/lib/air/time";
import type { AirSnapshot, AqiCategory, HourlyPoint } from "@/lib/types";

/** What a family should do in a given hour. */
export type Verdict = "best" | "okay" | "avoid";

export interface HourSlot {
  time: string;
  hour: number;
  /** True when this hour falls on the next calendar day (local time). */
  tomorrow: boolean;
  pm25: number;
  aqi: number;
  category: AqiCategory;
  verdict: Verdict;
  isNow: boolean;
}

export interface Window {
  start: number;
  length: number;
  /** Starts on the next calendar day. */
  tomorrow: boolean;
  /** e.g. "3–5 PM" or "6–11 AM tomorrow". */
  label: string;
}

export interface DayOutlook {
  slots: HourSlot[];
  /** Cleanest daytime window to be outdoors. */
  goOut: (Window & { pm25: number; category: AqiCategory; safe: boolean }) | null;
  /** Worst windows: keep windows shut, stay in. */
  stayIn: Window[];
  /** Human sentence, e.g. "Go out 3–5 PM. Stay in 7–11 PM." */
  summary: string;
}

const HOUR = 3600_000;
const DAYTIME = (h: number): boolean => h >= 6 && h <= 20;
const SAFE: ReadonlySet<AqiCategory> = new Set(["good", "satisfactory"]);

/** The next `n` hourly points, starting with the current hour. */
export function upcoming(hourly: HourlyPoint[], now: Date, n = 24): HourlyPoint[] {
  const start = now.getTime() - HOUR;
  return hourly.filter((p) => Date.parse(p.time) > start).slice(0, n);
}

/**
 * Classify each hour. In cities where every hour is unhealthy, absolute thresholds would mark the whole day red
 * and tell families nothing, so verdicts are relative within the day:
 *   best  = the cleanest daytime hours (bottom quintile, at least 2)
 *   avoid = the dirtiest 30% of hours, unless the air is actually Good/Satisfactory
 *   okay  = everything else
 */
export function classifyHours(points: HourlyPoint[], utcOffsetSeconds: number, now: Date): HourSlot[] {
  if (points.length === 0) return [];
  const sorted = points.map((p) => p.pm25).sort((a, b) => a - b);
  const avoidFrom = sorted[Math.floor(sorted.length * 0.7)] ?? Infinity;
  const daytime = points
    .map((p, i) => ({ i, pm25: p.pm25, h: localHour(p.time, utcOffsetSeconds) }))
    .filter((x) => DAYTIME(x.h))
    .sort((a, b) => a.pm25 - b.pm25);
  const bestCount = Math.max(2, Math.ceil(daytime.length * 0.2));
  const best = new Set(daytime.slice(0, bestCount).map((x) => x.i));
  const nowMs = now.getTime();
  const localDate = (ms: number): string => new Date(ms + utcOffsetSeconds * 1000).toISOString().slice(0, 10);
  const today = localDate(nowMs);

  return points.map((p, i) => {
    const category = aqiCategory(p.aqi);
    const clean = category === "good" || category === "satisfactory";
    const verdict: Verdict = best.has(i) ? "best" : p.pm25 >= avoidFrom && !clean ? "avoid" : "okay";
    const t = Date.parse(p.time);
    return {
      time: p.time,
      hour: localHour(p.time, utcOffsetSeconds),
      tomorrow: localDate(Date.parse(p.time)) !== today,
      pm25: Math.round(p.pm25),
      aqi: p.aqi,
      category,
      verdict,
      isNow: nowMs >= t && nowMs < t + HOUR,
    };
  });
}

/** Merge consecutive slots with the given verdict into windows, in time order. */
export function mergeWindows(slots: HourSlot[], verdict: Verdict): Window[] {
  const out: Window[] = [];
  let run: { start: number; length: number; tomorrow: boolean } | null = null;
  const flush = (): void => {
    if (run)
      out.push({ ...run, label: `${windowLabel(run.start, run.length)}${run.tomorrow ? " tomorrow" : ""}` });
    run = null;
  };
  for (const s of slots) {
    if (s.verdict !== verdict) {
      flush();
      continue;
    }
    // a window that starts tonight and runs past midnight stays one window ("10 PM–2 AM")
    if (run) run.length += 1;
    else run = { start: s.hour, length: 1, tomorrow: s.tomorrow };
  }
  flush();
  return out;
}

/** Everything the dashboard needs to explain today's timing in plain words. */
export function dayOutlook(air: AirSnapshot, now: Date = new Date()): DayOutlook {
  const slots = classifyHours(upcoming(air.hourly, now), air.utcOffsetSeconds, now);
  const bestWindows = mergeWindows(slots, "best");
  // pick the best window with the lowest average PM2.5
  let goOut: DayOutlook["goOut"] = null;
  for (const w of bestWindows) {
    const inWindow = slots
      .filter((s) => s.verdict === "best")
      .filter((s) => {
        const offset = (s.hour - w.start + 24) % 24;
        return offset < w.length;
      });
    const avg = Math.round(inWindow.reduce((a, s) => a + s.pm25, 0) / Math.max(1, inWindow.length));
    const worst = inWindow.reduce<HourSlot | undefined>((a, s) => (!a || s.aqi > a.aqi ? s : a), undefined);
    if (!goOut || avg < goOut.pm25) {
      goOut = {
        ...w,
        pm25: avg,
        category: worst?.category ?? "moderate",
        safe: worst ? SAFE.has(worst.category) : false,
      };
    }
  }
  const stayIn = mergeWindows(slots, "avoid");
  const parts: string[] = [];
  if (goOut) parts.push(`${goOut.safe ? "Go out" : "Least bad time outside"}: ${goOut.label}.`);
  if (stayIn.length) parts.push(`Stay in: ${stayIn.map((w) => w.label).join(", ")}.`);
  return { slots, goOut, stayIn, summary: parts.join(" ") };
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  best: "Lower levels in daylight",
  okay: "Other forecast hours",
  avoid: "Stay in, windows shut",
};

/** "Now", or "3 PM". */
export const slotLabel = (s: Pick<HourSlot, "hour" | "isNow">): string =>
  s.isNow ? "Now" : hourLabel(s.hour);
