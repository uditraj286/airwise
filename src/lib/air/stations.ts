import { z } from "zod";
import { TtlCache } from "@/lib/air/cache";
import type { AirSnapshot, StationReading } from "@/lib/types";

const Avg = z.object({ avg: z.number().nullable().optional() }).partial();
const Station = z.object({
  station: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  aqi: z.number().int().min(0).max(500),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
  pollutants: z.record(z.string(), Avg.nullable()).optional(),
});
const Feed = z.object({ data: z.array(z.unknown()) });
const cache = new TtlCache<unknown[]>(55_000, 1);

/** Stations further than this are not used for the area reading. */
export const STATION_RADIUS_KM = 30;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/**
 * Area reading from fresh CPCB stations within 30 km: AQI and PM2.5 blended by inverse-distance-squared weights
 * (a standard way to interpolate between monitors), so one station on a busy junction doesn't decide the whole area.
 */
export function nearestStation(
  rows: unknown[],
  location: AirSnapshot["location"],
  now = Date.now(),
): StationReading | undefined {
  const fresh: { name: string; aqi: number; pm25: number | null; d: number; at: number }[] = [];
  for (const row of rows) {
    const parsed = Station.safeParse(row);
    if (!parsed.success) continue;
    const s = parsed.data;
    const at = Date.parse(s.updated.replace(" ", "T") + ":00+05:30");
    const age = now - at;
    if (!Number.isFinite(age) || age < 0 || age > 2 * 3600_000) continue;
    const d = distanceKm(location.lat, location.lon, s.latitude, s.longitude);
    if (d > STATION_RADIUS_KM) continue;
    const pm = s.pollutants?.["PM2.5"]?.avg;
    fresh.push({ name: s.station, aqi: s.aqi, pm25: typeof pm === "number" && pm > 0 ? pm : null, d, at });
  }
  if (fresh.length === 0) return undefined;
  fresh.sort((x, y) => x.d - y.d);
  const nearest = fresh[0]!;
  const w = (d: number): number => 1 / Math.max(1, d) ** 2;
  const total = fresh.reduce((sum, s) => sum + w(s.d), 0);
  const aqi = Math.round(fresh.reduce((sum, s) => sum + s.aqi * w(s.d), 0) / total);
  const withPm = fresh.filter((s) => s.pm25 !== null);
  const pmTotal = withPm.reduce((sum, s) => sum + w(s.d), 0);
  const pm25 = withPm.length
    ? Math.round(withPm.reduce((sum, s) => sum + (s.pm25 ?? 0) * w(s.d), 0) / pmTotal)
    : null;
  return {
    name: nearest.name,
    aqi,
    distanceKm: nearest.d,
    updatedAt: new Date(Math.max(...fresh.map((s) => s.at))).toISOString(),
    count: fresh.length,
    pm25,
  };
}

export interface NearbyStation {
  name: string;
  aqi: number;
  distanceKm: number;
  updatedAt: string;
}

/** Every fresh station within `radiusKm`, nearest first (for the "Stations near you" list). */
export function stationsNear(
  rows: unknown[],
  location: AirSnapshot["location"],
  now = Date.now(),
  radiusKm = 50,
  limit = 8,
): NearbyStation[] {
  const out: NearbyStation[] = [];
  for (const row of rows) {
    const parsed = Station.safeParse(row);
    if (!parsed.success) continue;
    const s = parsed.data;
    const at = Date.parse(s.updated.replace(" ", "T") + ":00+05:30");
    const age = now - at;
    if (!Number.isFinite(age) || age < 0 || age > 3 * 3600_000) continue;
    const d = distanceKm(location.lat, location.lon, s.latitude, s.longitude);
    if (d <= radiusKm)
      out.push({
        name: s.station,
        aqi: s.aqi,
        distanceKm: Math.round(d * 10) / 10,
        updatedAt: new Date(at).toISOString(),
      });
  }
  return out.sort((x, y) => x.distanceKm - y.distanceKm).slice(0, limit);
}

/** The national station feed (cached 55 s). Empty outside India or when the feed is down. */
export async function stationRows(
  location: AirSnapshot["location"],
  refresh = false,
  fetchImpl = fetch,
): Promise<unknown[]> {
  if (location.lat < 6 || location.lat > 38 || location.lon < 68 || location.lon > 98) return [];
  try {
    let rows = refresh ? undefined : cache.get("india");
    if (!rows) {
      const response = await fetchImpl("https://api.dharun.dev/v1/air-quality", {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return [];
      rows = Feed.parse(await response.json()).data;
      cache.set("india", rows);
    }
    return rows;
  } catch {
    return [];
  }
}

export async function fetchStation(
  location: AirSnapshot["location"],
  refresh = false,
  fetchImpl = fetch,
): Promise<StationReading | undefined> {
  // Download the public national feed and match locally. The relay receives no user location.
  if (location.lat < 6 || location.lat > 38 || location.lon < 68 || location.lon > 98) return;
  try {
    let rows = refresh ? undefined : cache.get("india");
    if (!rows) {
      const response = await fetchImpl("https://api.dharun.dev/v1/air-quality", {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return;
      rows = Feed.parse(await response.json()).data;
      cache.set("india", rows);
    }
    return nearestStation(rows, location);
  } catch {
    return undefined;
  }
}
