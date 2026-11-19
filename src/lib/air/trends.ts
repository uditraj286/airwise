import { localHour } from "@/lib/air/time";
import type { AirSnapshot, HourlyPoint } from "@/lib/types";

const HOUR = 3600_000;

/** Point closest to `targetMs`, or undefined if nothing is within 90 minutes. */
export function pointNear(hourly: HourlyPoint[], targetMs: number): HourlyPoint | undefined {
  let best: HourlyPoint | undefined;
  let bestGap = Infinity;
  for (const p of hourly) {
    const gap = Math.abs(Date.parse(p.time) - targetMs);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return bestGap <= 1.5 * HOUR ? best : undefined;
}

/** The `n` hourly points ending at the current hour (oldest first). */
export function pastHours(hourly: HourlyPoint[], now: Date, n: number): HourlyPoint[] {
  const t = now.getTime();
  return hourly.filter((p) => Date.parse(p.time) <= t).slice(-n);
}

/** The `n` hourly points starting from the current hour. */
export function nextHours(hourly: HourlyPoint[], now: Date, n: number): HourlyPoint[] {
  const start = now.getTime() - HOUR;
  return hourly.filter((p) => Date.parse(p.time) > start).slice(0, n);
}

/** Percent change from `prev` to `curr`, one decimal; null when there is no baseline. */
export function pctChange(curr: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export interface DailyAvg {
  /** Local date "YYYY-MM-DD". */
  date: string;
  pm25: number;
  aqi: number;
}

/** Mean PM2.5 and AQI per local calendar day. */
export function dailyAverages(snapshot: AirSnapshot): DailyAvg[] {
  const groups = new Map<string, { pm25: number; aqi: number; n: number }>();
  for (const p of snapshot.hourly) {
    const date = new Date(Date.parse(p.time) + snapshot.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
    const g = groups.get(date) ?? { pm25: 0, aqi: 0, n: 0 };
    g.pm25 += p.pm25;
    g.aqi += p.aqi;
    g.n += 1;
    groups.set(date, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.n >= 6)
    .map(([date, g]) => ({ date, pm25: Math.round(g.pm25 / g.n), aqi: Math.round(g.aqi / g.n) }));
}

/** Short axis label for an hourly point, e.g. "2P". */
export function shortHour(p: HourlyPoint, offsetSeconds: number): string {
  const h = localHour(p.time, offsetSeconds);
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${h < 12 ? "A" : "P"}`;
}

/** Round axis: 4–5 evenly spaced ticks at "nice" steps (25, 50, 100…), always starting at 0. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  const steps = [10, 25, 50, 100, 150, 200, 250, 500];
  const step = steps.find((s) => max / s <= 4) ?? 500;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}
