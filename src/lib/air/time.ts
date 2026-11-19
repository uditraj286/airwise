import type { AirSnapshot, HourlyPoint } from "@/lib/types";

/** Local hour (0–23) of a UTC ISO timestamp at the given UTC offset. */
export function localHour(isoUtc: string, utcOffsetSeconds: number): number {
  const ms = Date.parse(isoUtc) + utcOffsetSeconds * 1000;
  return new Date(ms).getUTCHours();
}

/** "2 PM" style label for a local hour. */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

/** "2–4 PM" style label for a window of `length` hours starting at `start`. */
export function windowLabel(start: number, length = 2): string {
  const end = (start + length) % 24;
  const a = hourLabel(start);
  const b = hourLabel(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/**
 * PM2.5 for each local hour 0–23 over the next 24 hours from `now`.
 * Hours with no data are filled with the current reading so the model always has a full day.
 */
export function next24ByLocalHour(snapshot: AirSnapshot, now: Date = new Date()): number[] {
  const byHour: (number | undefined)[] = new Array(24).fill(undefined);
  const start = now.getTime() - 3600_000;
  const upcoming = snapshot.hourly.filter((p: HourlyPoint) => Date.parse(p.time) >= start).slice(0, 24);
  for (const p of upcoming) {
    const h = localHour(p.time, snapshot.utcOffsetSeconds);
    byHour[h] ??= p.pm25;
  }
  return byHour.map((v) => v ?? snapshot.current.pm25);
}
