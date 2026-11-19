import { NextResponse, type NextRequest } from "next/server";
import { airDepsFromEnv } from "@/lib/air/deps";
import { getAirSnapshot } from "@/lib/air/service";
import { AirQuerySchema } from "@/lib/ai/schemas";
import { enforceRateLimit, jsonError, limiters, validationError } from "@/lib/security/http";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** GET /api/air?lat=&lon=&name=&tzOffsetMin= → normalised AirSnapshot. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = enforceRateLimit(limiters.air, req);
  if (limited) return noStore(limited);

  const parsed = AirQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return noStore(validationError(parsed.error));
  const { lat, lon, name, tzOffsetMin, refresh } = parsed.data;

  try {
    const snapshot = await getAirSnapshot(
      { lat, lon, name },
      { ...airDepsFromEnv(tzOffsetMin), refresh: refresh === "1", allowStale: true },
    );
    return noStore(NextResponse.json(snapshot));
  } catch (err) {
    console.error("Air data unavailable:", (err as Error).message);
    return noStore(jsonError(502, "Air-quality data is temporarily unavailable. Please try again shortly."));
  }
}
