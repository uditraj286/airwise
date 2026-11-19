import { aqiCategory, computeAqi } from "@/lib/air/aqi";
import { localHour } from "@/lib/air/time";
import type { AirSnapshot, HourlyPoint } from "@/lib/types";

/**
 * Typical Delhi winter diurnal PM2.5 profile (µg/m³) indexed by local hour — night/morning inversion peak,
 * afternoon dip, evening traffic + heating peak. Used for offline demos and deterministic e2e tests.
 */
export const DIURNAL_PM25 = [
  265, 270, 272, 268, 260, 255, 262, 278, 290, 270, 230, 190, 160, 140, 128, 130, 150, 190, 235, 262, 280,
  285, 280, 272,
] as const;

/** Deterministic snapshot anchored at the start of the hour of `now`. */
export function mockSnapshot(
  location: AirSnapshot["location"],
  now: Date = new Date(),
  utcOffsetSeconds = 19800,
): AirSnapshot {
  const anchor = new Date(now);
  anchor.setUTCMinutes(0, 0, 0);
  const hourly: HourlyPoint[] = [];
  for (let offset = -24; offset < 72; offset++) {
    const time = new Date(anchor.getTime() + offset * 3600_000).toISOString();
    const day = Math.max(0, Math.floor(offset / 24));
    const base = DIURNAL_PM25[localHour(time, utcOffsetSeconds)] ?? 200;
    const pm25 = Math.round(base * (1 - day * 0.04));
    const pm10 = Math.round(pm25 * 1.65);
    hourly.push({ time, pm25, pm10, aqi: computeAqi(pm25, pm10).aqi });
  }
  const current = hourly[24] as HourlyPoint;
  const { aqi, dominant } = computeAqi(current.pm25, current.pm10);
  return {
    location,
    current: {
      aqi,
      category: aqiCategory(aqi),
      pm25: current.pm25,
      pm10: current.pm10,
      no2: 68,
      o3: 22,
      so2: 24,
      co: 2100,
      dominant,
    },
    hourly,
    source: "mock",
    updatedAt: current.time,
    utcOffsetSeconds,
    weather: { tempC: 12, humidity: 78, windKmh: 4, dispersion: "trapped" },
  };
}
