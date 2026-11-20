import { z } from "zod";
import { TtlCache } from "@/lib/air/cache";

/** Names we store when the user shares GPS instead of picking a city; these get replaced by a real place name. */
const GENERIC = /^(my|your) location$/i;
export const isGenericPlaceName = (name: string): boolean => GENERIC.test(name.trim()) || name.trim() === "";

const NominatimReverse = z.object({
  name: z.string().optional(),
  address: z
    .object({
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      suburb: z.string().optional(),
      neighbourhood: z.string().optional(),
      quarter: z.string().optional(),
      hamlet: z.string().optional(),
      city_district: z.string().optional(),
      state_district: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

/**
 * Turn a reverse-geocoding payload into "Area, Town, Block, District, State, Country" (skipping repeats).
 * The most local name comes first. `nearest` is the closest mapped settlement to the point (see
 * `nearestSettlement`); it wins over Nominatim's village label, because village boundaries in rural India are
 * often drawn far too large: a spot 1.6 km from Bihta is labelled "Bikram", a town 12 km away.
 */
export function formatPlace(raw: unknown, nearest?: string | null): string | null {
  const parsed = NominatimReverse.safeParse(raw);
  if (!parsed.success) return null;
  const a = parsed.data.address ?? {};
  const area = nearest
    ? (a.neighbourhood ?? a.quarter)
    : (a.neighbourhood ?? a.quarter ?? a.hamlet ?? a.suburb);
  const locality =
    nearest ?? a.village ?? a.town ?? a.city_district ?? a.city ?? a.county ?? parsed.data.name;
  const parent = a.city ?? a.state_district;
  const parts = [area, locality, a.county, parent, a.state, a.country].filter((p): p is string => Boolean(p));
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(", ") : null;
}

const OverpassPlaces = z.object({
  elements: z.array(
    z.object({
      lat: z.number(),
      lon: z.number(),
      tags: z.object({ name: z.string().optional(), "name:en": z.string().optional() }).optional(),
    }),
  ),
});

/** Name of the closest town, village, suburb or hamlet point within ~3 km (OpenStreetMap Overpass), or null. */
export async function nearestSettlement(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const query = `[out:json][timeout:5];node(around:3000,${lat.toFixed(3)},${lon.toFixed(3)})[place~"^(city|town|village|suburb|hamlet)$"][name];out;`;
  try {
    const res = await fetchImpl("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "User-Agent": "AirWise/1.0 (air-quality assistant)",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const parsed = OverpassPlaces.safeParse(await res.json());
    if (!parsed.success) return null;
    const cos = Math.cos((lat * Math.PI) / 180);
    let best: { name: string; d: number } | null = null;
    for (const e of parsed.data.elements) {
      const name = e.tags?.["name:en"] ?? e.tags?.name;
      if (!name) continue;
      const d = Math.hypot((e.lon - lon) * cos, e.lat - lat);
      if (!best || d < best.d) best = { name, d };
    }
    return best?.name ?? null;
  } catch {
    return null;
  }
}

const cache = new TtlCache<string | null>(24 * 3600_000, 500);

/**
 * Reverse-geocode coordinates rounded to three decimals (~110 m, enough to name the right village or
 * neighbourhood without pinpointing a home) with OpenStreetMap: Nominatim for the address and Overpass for the
 * nearest settlement, in parallel (both free, no key). Results are cached for a day per cell, which keeps us
 * inside the services' usage policies. Returns null when Nominatim fails; Overpass is best-effort.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const key = `v4:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: lat.toFixed(3),
      lon: lon.toFixed(3),
      zoom: "16",
      "accept-language": "en",
    });
    const [res, nearest] = await Promise.all([
      fetchImpl(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { "User-Agent": "AirWise/1.0 (air-quality assistant)" },
        signal: AbortSignal.timeout(4000),
      }),
      nearestSettlement(lat, lon, fetchImpl),
    ]);
    if (!res.ok) return null;
    const name = formatPlace(await res.json(), nearest);
    cache.set(key, name);
    return name;
  } catch {
    return null;
  }
}
