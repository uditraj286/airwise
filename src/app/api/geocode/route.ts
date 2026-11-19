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

/**
 * GET /api/geocode?q=Lucknow → up to 5 matching places (Open-Meteo geocoding, no key).
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

  const hit = cache.get(`v2:${q}`);
  if (hit) return NextResponse.json(hit);

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: "5", language: "en" })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    const data = Result.parse(await res.json());
    const places: Place[] = (data.results ?? []).map((r) => ({
      // Include the district so two places with the same name (e.g. two Bihtas) can be told apart.
      name: [r.name, r.admin2?.replace(/ district$/i, ""), r.admin1, r.country]
        .filter((p, i, all) => p && all.indexOf(p) === i)
        .join(", "),
      lat: r.latitude,
      lon: r.longitude,
    }));
    cache.set(`v2:${q}`, places);
    return NextResponse.json(places, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (err) {
    console.error("Geocoding failed:", (err as Error).message);
    return jsonError(502, "Location search is unavailable right now.");
  }
}
