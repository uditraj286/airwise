import { aqiCategory, computeAqi } from "@/lib/air/aqi";
import { TtlCache } from "@/lib/air/cache";
import { fetchGoogle } from "@/lib/air/google";
import { mockSnapshot } from "@/lib/air/mock";
import { fetchOpenMeteo } from "@/lib/air/openMeteo";
import { isGenericPlaceName, reverseGeocode } from "@/lib/air/place";
import { fetchStation } from "@/lib/air/stations";
import { fetchWeather } from "@/lib/air/weather";
import type { AirSnapshot } from "@/lib/types";

const cache = new TtlCache<{ snapshot: AirSnapshot; fetchedAt: number }>(55 * 60_000);
const FRESH_MS = 55_000;

/** Keep distinct location selections separate in the short-lived reading cache. */
export const cacheKey = (lat: number, lon: number): string => `${lat.toFixed(4)},${lon.toFixed(4)}`;

const HOUR = 3600_000;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Providers report a live "current" reading plus an hourly model series, and the two can differ by 10–20% for the
 * same hour. The hour we are in now must show one number everywhere (KPI, chart "Now" bar, timeline, pollutant card),
 * so the live reading replaces the model value for that hour.
 */
export function alignCurrentHour(snapshot: AirSnapshot, now: Date = new Date()): AirSnapshot {
  const observed = Date.parse(snapshot.updatedAt);
  const current = now.getTime();
  const marks = current >= observed && current - observed < HOUR ? [observed, current] : [observed];
  const { pm25, pm10, aqi } = snapshot.current;
  const hourly = snapshot.hourly.map((p) => {
    const start = Date.parse(p.time);
    return marks.some((t) => t >= start && t < start + HOUR) ? { ...p, pm25, pm10, aqi } : p;
  });
  return { ...snapshot, hourly };
}

/**
 * Factor f (0.25–4) so that the model's current particles × f give the stations' AQI. AQI rises monotonically with
 * f, so a bisection finds it. Calibrating on AQI keeps the headline number and every hourly bar on one scale.
 */
export function factorForAqi(pm25: number, pm10: number, target: number): number {
  let lo = 0.25;
  let hi = 4;
  if (computeAqi(pm25 * hi, pm10 * hi).aqi <= target) return hi;
  if (computeAqi(pm25 * lo, pm10 * lo).aqi >= target) return lo;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (computeAqi(pm25 * mid, pm10 * mid).aqi < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Forecast models (CAMS) often miss local smog by a wide margin, while CPCB monitors measure it. When stations within
 * 30 km report, scale the model's particle series so "now" matches their AQI, keeping the model's hour-to-hour shape
 * for the forecast. The factor is capped to 0.25–4× so one faulty sensor can't distort everything.
 */
export function calibrateToStation(snapshot: AirSnapshot): AirSnapshot {
  const st = snapshot.station;
  if (!st || snapshot.current.pm25 <= 0) return snapshot;
  const factor = factorForAqi(snapshot.current.pm25, snapshot.current.pm10, st.aqi);
  const scale = (p: { pm25: number; pm10: number }) => {
    const pm25 = round1(p.pm25 * factor);
    const pm10 = round1(p.pm10 * factor);
    return { pm25, pm10, aqi: computeAqi(pm25, pm10).aqi };
  };
  const hourly = snapshot.hourly.map((p) => ({ ...p, ...scale(p) }));
  const now = scale(snapshot.current);
  return {
    ...snapshot,
    hourly,
    calibration: Math.round(factor * 100) / 100,
    current: {
      ...snapshot.current,
      pm25: now.pm25,
      pm10: now.pm10,
      aqi: st.aqi,
      category: aqiCategory(st.aqi),
    },
  };
}

export interface AirDeps {
  googleKey?: string;
  stations?: boolean;
  /** Viewer's UTC offset in seconds; used when the provider does not report one. */
  utcOffsetSeconds?: number;
  mock?: boolean;
  refresh?: boolean;
  allowStale?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Resolve air quality for a location: cache → Google Air Quality API (if keyed) → Open-Meteo → error.
 * Provider failures degrade gracefully instead of breaking the dashboard.
 */
export async function getAirSnapshot(
  location: AirSnapshot["location"],
  deps: AirDeps = {},
): Promise<AirSnapshot> {
  if (deps.mock) return mockSnapshot(location, new Date(), deps.utcOffsetSeconds ?? 19800);

  // "My location" (shared GPS) becomes a real place name, so the dashboard and source estimates can use it.
  if (isGenericPlaceName(location.name)) {
    const place = await reverseGeocode(location.lat, location.lon, deps.fetchImpl);
    if (place) location = { ...location, name: place };
  }

  const key = cacheKey(location.lat, location.lon);
  const cached = cache.get(key);
  if (cached && !deps.refresh && Date.now() - cached.fetchedAt < FRESH_MS) {
    return { ...cached.snapshot, location };
  }

  const weatherPromise = fetchWeather(location.lat, location.lon, deps.fetchImpl);
  let snapshot: AirSnapshot | undefined;
  if (deps.googleKey) {
    try {
      snapshot = await fetchGoogle(location, deps.googleKey, deps.utcOffsetSeconds ?? 0, deps.fetchImpl);
    } catch (err) {
      console.warn("Google AQ failed, falling back to Open-Meteo:", (err as Error).message);
    }
  }
  if (!snapshot) {
    const stationPromise = deps.stations ? fetchStation(location, deps.refresh, deps.fetchImpl) : undefined;
    try {
      // One quick retry: the free model API occasionally times out under load.
      snapshot = await fetchOpenMeteo(location, deps.fetchImpl).catch(() =>
        fetchOpenMeteo(location, deps.fetchImpl),
      );
      snapshot = { ...snapshot, station: await stationPromise };
    } catch (err) {
      if (cached && deps.allowStale) return { ...cached.snapshot, location, station: undefined, stale: true };
      throw err;
    }
  }
  snapshot = { ...alignCurrentHour(calibrateToStation(snapshot)), weather: await weatherPromise };
  cache.set(key, { snapshot, fetchedAt: Date.now() });
  return snapshot;
}
