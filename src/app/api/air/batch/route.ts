import { NextResponse, type NextRequest } from "next/server";
import { aqiCategory } from "@/lib/air/aqi";
import { airDepsFromEnv } from "@/lib/air/deps";
import { getAirSnapshot } from "@/lib/air/service";
import { BatchQuerySchema, type BatchReading } from "@/lib/ai/schemas";
import { enforceRateLimit, limiters, validationError } from "@/lib/security/http";

/**
 * GET /api/air/batch?points=lat,lon;lat,lon → current AQI for up to 5 saved places in one request.
 * Each point goes through the same cached air service as /api/air, so repeated places cost nothing upstream.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(limiters.air, req);
  if (limited) return limited;
  const parsed = BatchQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const deps = { ...airDepsFromEnv(parsed.data.tzOffsetMin), allowStale: true };
  const readings: BatchReading[] = await Promise.all(
    parsed.data.points.map(async ([lat, lon]) => {
      try {
        const snap = await getAirSnapshot({ lat, lon, name: "Saved place" }, deps);
        return { lat, lon, aqi: snap.current.aqi, category: aqiCategory(snap.current.aqi) };
      } catch {
        return { lat, lon, aqi: null, category: null };
      }
    }),
  );
  return NextResponse.json(readings, { headers: { "Cache-Control": "private, no-store" } });
}
