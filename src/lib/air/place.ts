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
 * Turn a reverse-geocoding payload into "Area, Town, District, State, Country" (skipping repeats).
 * The most local name comes first (neighbourhood, hamlet or village), so a family in Bihta sees Bihta,
 * and a family in a city neighbourhood sees that neighbourhood, not just the city or district.
 */
export function formatPlace(raw: unknown): string | null {
  const parsed = NominatimReverse.safeParse(raw);
  if (!parsed.success) return null;
  const a = parsed.data.address ?? {};
  const area = a.neighbourhood ?? a.quarter ?? a.hamlet ?? a.suburb;
  const locality = a.village ?? a.town ?? a.city_district ?? a.city ?? a.county ?? parsed.data.name;
  const parent = a.city ?? a.state_district;
  const parts = [area, locality, parent, a.state, a.country].filter((p): p is string => Boolean(p));
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(", ") : null;
}

const cache = new TtlCache<string | null>(24 * 3600_000, 500);

/**
 * Reverse-geocode coordinates rounded to three decimals (~110 m, enough to name the right village or
 * neighbourhood without pinpointing a home) with OpenStreetMap Nominatim (free, no key). Results are cached
 * for a day per cell, which keeps us inside the service's usage policy. Returns null on any failure.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const key = `v3:${lat.toFixed(3)},${lon.toFixed(3)}`;
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
    const res = await fetchImpl(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { "User-Agent": "AirWise/1.0 (air-quality assistant)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const name = formatPlace(await res.json());
    cache.set(key, name);
    return name;
  } catch {
    return null;
  }
}
