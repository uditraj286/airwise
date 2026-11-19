import { z } from "zod";
import { aqiCategory, computeAqi } from "@/lib/air/aqi";
import type { AirSnapshot, HourlyPoint } from "@/lib/types";

const Pollutant = z.object({
  code: z.string(),
  concentration: z.object({ value: z.number(), units: z.string().optional() }).optional(),
});

const HourBlock = z.object({
  dateTime: z.iso.datetime(),
  regionCode: z.string().optional(),
  indexes: z.array(z.object({ code: z.string(), aqi: z.number().int().min(0).optional() })).optional(),
  pollutants: z.array(Pollutant).optional(),
});

const ForecastResponse = z.object({ hourlyForecasts: z.array(HourBlock).optional() });
const CurrentResponse = HourBlock;

const BASE = "https://airquality.googleapis.com/v1";
const EXTRA = ["LOCAL_AQI", "POLLUTANT_CONCENTRATION"];

function indiaAqi(block: z.infer<typeof HourBlock>): number | undefined {
  const value = block.indexes?.find(({ code }) => code === "ind_cpcb")?.aqi;
  return value !== undefined && value <= 500 ? value : undefined;
}

function pollutantValue(block: z.infer<typeof HourBlock>, code: string): number | null {
  const value = block.pollutants?.find((p) => p.code === code)?.concentration?.value;
  return typeof value === "number" ? value : null;
}

/** Convert Google Air Quality API responses (current + forecast) into a snapshot. */
export function parseGoogle(
  currentRaw: unknown,
  forecastRaw: unknown,
  location: AirSnapshot["location"],
  utcOffsetSeconds: number,
  historyRaw?: unknown,
): AirSnapshot {
  const current = CurrentResponse.parse(currentRaw);
  const forecast = ForecastResponse.parse(forecastRaw);

  const pm25 = pollutantValue(current, "pm25");
  const pm10 = pollutantValue(current, "pm10");
  if (pm25 == null || pm10 == null) throw new Error("Google AQ response missing PM data");

  const aqi = indiaAqi(current);
  if (aqi === undefined) throw new Error("Google AQ response missing India AQI");

  const history = z.object({ hoursInfo: z.array(HourBlock).optional() }).safeParse(historyRaw);
  const hourly: HourlyPoint[] = [];
  for (const block of [...(history.data?.hoursInfo ?? []), ...(forecast.hourlyForecasts ?? [])]) {
    const h25 = pollutantValue(block, "pm25");
    const h10 = pollutantValue(block, "pm10");
    const hAqi = indiaAqi(block);
    if (
      h25 == null ||
      h10 == null ||
      hAqi === undefined ||
      Date.parse(block.dateTime) === Date.parse(current.dateTime)
    )
      continue;
    hourly.push({ time: block.dateTime, pm25: h25, pm10: h10, aqi: hAqi });
  }

  const { dominant } = computeAqi(pm25, pm10);
  return {
    location,
    current: {
      aqi,
      category: aqiCategory(aqi),
      pm25,
      pm10,
      no2: pollutantValue(current, "no2"),
      o3: pollutantValue(current, "o3"),
      so2: pollutantValue(current, "so2"),
      co: pollutantValue(current, "co"),
      dominant,
    },
    hourly: [{ time: current.dateTime, pm25, pm10, aqi }, ...hourly].sort(
      (a, b) => Date.parse(a.time) - Date.parse(b.time),
    ),
    source: "google",
    updatedAt: current.dateTime,
    utcOffsetSeconds: current.regionCode === "in" || current.regionCode === "IN" ? 19800 : utcOffsetSeconds,
  };
}

/**
 * Fetch current conditions + 48 h forecast from the Google Air Quality API.
 * Google returns UTC timestamps. Use IST when the response identifies India.
 */
export async function fetchGoogle(
  location: AirSnapshot["location"],
  apiKey: string,
  utcOffsetSeconds: number,
  fetchImpl: typeof fetch = fetch,
): Promise<AirSnapshot> {
  const body = { location: { latitude: location.lat, longitude: location.lon }, extraComputations: EXTRA };
  const headers = { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey };
  const start = new Date(Math.floor(Date.now() / 3600_000) * 3600_000 + 3600_000);
  const end = new Date(start.getTime() + 48 * 3600_000);

  const [currentRes, forecastRes, history] = await Promise.all([
    fetchImpl(`${BASE}/currentConditions:lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    }),
    fetchImpl(`${BASE}/forecast:lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...body,
        period: { startTime: start.toISOString(), endTime: end.toISOString() },
        pageSize: 48,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    }),
    fetchImpl(`${BASE}/history:lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, hours: 25, pageSize: 25 }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined),
  ]);
  if (!currentRes.ok || !forecastRes.ok) {
    throw new Error(`Google AQ responded ${currentRes.status}/${forecastRes.status}`);
  }
  return parseGoogle(await currentRes.json(), await forecastRes.json(), location, utcOffsetSeconds, history);
}
