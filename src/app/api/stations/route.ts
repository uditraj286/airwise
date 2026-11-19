import { NextResponse, type NextRequest } from "next/server";
import { stationRows, stationsNear } from "@/lib/air/stations";
import { ReverseGeocodeQuerySchema } from "@/lib/ai/schemas";
import { enforceRateLimit, limiters, validationError } from "@/lib/security/http";

/** GET /api/stations?lat=&lon= → live CPCB monitoring stations within 50 km, nearest first. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(limiters.stations, req);
  if (limited) return limited;
  const parsed = ReverseGeocodeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const where = { ...parsed.data, name: "" };
  const mock = process.env.AIRWISE_MOCK_DATA === "1";
  const stations = mock
    ? [
        { name: "Sample station A", aqi: 212, distanceKm: 3.4, updatedAt: new Date().toISOString() },
        { name: "Sample station B", aqi: 168, distanceKm: 7.9, updatedAt: new Date().toISOString() },
      ]
    : stationsNear(await stationRows(where), where);
  return NextResponse.json(stations, { headers: { "Cache-Control": "private, no-store" } });
}
