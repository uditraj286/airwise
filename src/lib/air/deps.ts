import type { AirDeps } from "@/lib/air/service";

/**
 * Server-side air dependencies from the environment.
 * `tzOffsetMin` follows `Date#getTimezoneOffset` (minutes behind UTC, so IST is −330).
 */
export function airDepsFromEnv(tzOffsetMin: number): AirDeps {
  return {
    stations: true,
    googleKey: process.env.GOOGLE_AIR_QUALITY_API_KEY || undefined,
    mock: process.env.AIRWISE_MOCK_DATA === "1",
    utcOffsetSeconds: -tzOffsetMin * 60,
  };
}
