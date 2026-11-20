import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { TtlCache } from "@/lib/air/cache";
import { reverseGeocode } from "@/lib/air/place";
import { GeocodeQuerySchema, ReverseGeocodeQuerySchema } from "@/lib/ai/schemas";
import { enforceRateLimit, jsonError, limiters, validationError } from "@/lib/security/http";

const Result = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        admin2: z.string().optional(),
        admin3: z.string().optional(),
      }),
    )
    .optional(),
});

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

const cache = new TtlCache<Place[]>(24 * 3600_000, 300);

/** Rough distance in km (equirectangular), enough to rank search results by closeness. */
function distKm([lat, lon]: [number, number], r: { latitude: number; longitude: number }): number {
  const x = (r.longitude - lon) * Math.cos(((lat + r.latitude) / 2) * (Math.PI / 180));
  return Math.hypot(x, r.latitude - lat) * 111;
}

/**
 * GET /api/geocode?q=Lucknow[&near=25.56,84.87] → matching places, nearest first when `near` is given
 * (Open-Meteo geocoding, no key).
 * GET /api/geocode?lat=28.61&lon=77.21 → the place name for shared GPS coordinates (OpenStreetMap).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(limiters.air, req);
  if (limited) return limited;

  if (req.nextUrl.searchParams.has("lat")) {
    const coords = ReverseGeocodeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!coords.success) return validationError(coords.error);
    const name = await reverseGeocode(coords.data.lat, coords.data.lon);
    // No browser caching: place names improve over time (the server keeps its own 24-hour cache).
    return NextResponse.json({ name }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const parsed = GeocodeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const q = parsed.data.q.toLowerCase();
  const near = parsed.data.near?.split(",").map(Number) as [number, number] | undefined;
  const key = `v3:${q}|${parsed.data.near ?? ""}`;

  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  try {
    // With a reference point, ask for more matches and keep the nearest: there are dozens of villages called
    // Raghopur in Bihar, and the family wants the one next to them.
    const count = near ? "50" : "5";
    const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count, language: "en" })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    const data = Result.parse(await res.json());
    const ranked = near
      ? [...(data.results ?? [])].sort((a, b) => distKm(near, a) - distKm(near, b))
      : (data.results ?? []);
    const places: Place[] = ranked.slice(0, 6).map((r) => ({
      // Block and district tell same-named places apart: "Raghopur, Bihta, Patna, Bihar, India".
      name: [r.name, r.admin3, r.admin2?.replace(/ district$/i, ""), r.admin1, r.country]
        .filter((p, i, all) => p && all.indexOf(p) === i)
        .join(", ")
        // Plain letters ("Rāghopur, Sáran" → "Raghopur, Saran") match what families type and read.
        .normalize("NFD")
        .replace(/\p{M}/gu, ""),
      lat: r.latitude,
      lon: r.longitude,
    }));
    cache.set(key, places);
    return NextResponse.json(places, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (err) {
    console.error("Geocoding failed:", (err as Error).message);
    return jsonError(502, "Location search is unavailable right now.");
  }
}
