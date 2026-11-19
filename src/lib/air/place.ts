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
      state_district: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

/** Turn a reverse-geocoding payload into "City, State, Country" (skipping repeats). */
export function formatPlace(raw: unknown): string | null {
  const parsed = NominatimReverse.safeParse(raw);
  if (!parsed.success) return null;
  const a = parsed.data.address ?? {};
  // Most specific place first (neighbourhood, village or town), so Bihta shows as Bihta rather than its district, Patna.
  const local = a.suburb ?? a.village ?? a.town ?? a.city ?? a.county ?? parsed.data.name ?? a.state_district;
  const parent = a.city ?? a.state_district;
  const parts = [local, parent, a.state, a.country].filter((p): p is string => Boolean(p));
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length ? unique.join(", ") : null;
}

const cache = new TtlCache<string | null>(24 * 3600_000, 500);

/**
 * Reverse-geocode rounded coordinates with OpenStreetMap Nominatim (free, no key). Results are cached for a day
 * per ~1 km cell, which keeps us well inside the service's usage policy. Returns null on any failure.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const key = `v2:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: lat.toFixed(2),
      lon: lon.toFixed(2),
      zoom: "14",
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
