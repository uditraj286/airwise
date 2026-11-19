import { z } from "zod";
import { aqiCategory, computeAqi } from "@/lib/air/aqi";
import type { AirSnapshot, HourlyPoint } from "@/lib/types";

const nullableNum = z.number().nullable();

const OpenMeteoResponse = z.object({
  utc_offset_seconds: z.number().default(0),
  current: z.object({
    time: z.string(),
    pm2_5: nullableNum,
    pm10: nullableNum,
    nitrogen_dioxide: nullableNum,
    ozone: nullableNum,
    sulphur_dioxide: nullableNum.optional(),
    carbon_monoxide: nullableNum.optional(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    pm2_5: z.array(nullableNum),
    pm10: z.array(nullableNum),
  }),
});

export type OpenMeteoPayload = z.infer<typeof OpenMeteoResponse>;

/** Build the Open-Meteo air-quality URL (free, no key, CAMS model data). */
export function openMeteoUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide",
    hourly: "pm2_5,pm10",
    timezone: "auto",
    past_days: "1",
    forecast_days: "4",
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
}

/** Convert a validated Open-Meteo payload into our provider-neutral snapshot. */
export function parseOpenMeteo(raw: unknown, location: AirSnapshot["location"]): AirSnapshot {
  const data = OpenMeteoResponse.parse(raw);
  const offset = data.utc_offset_seconds;
  const hourly: HourlyPoint[] = [];
  data.hourly.time.forEach((localTime, i) => {
    const time = localToUtcIso(localTime, offset);
    const pm25 = data.hourly.pm2_5[i];
    const pm10 = data.hourly.pm10[i];
    if (pm25 == null || pm10 == null) return;
    hourly.push({ time, pm25: round1(pm25), pm10: round1(pm10), aqi: computeAqi(pm25, pm10).aqi });
  });

  const updatedAt = localToUtcIso(data.current.time, offset);
  const matchingHour = hourly.find((point) => point.time === updatedAt);
  const pm25 = data.current.pm2_5 ?? matchingHour?.pm25;
  const pm10 = data.current.pm10 ?? matchingHour?.pm10;
  if (pm25 == null || pm10 == null) throw new Error("Current particle levels are unavailable.");
  const { aqi, dominant } = computeAqi(pm25, pm10);

  return {
    location,
    current: {
      aqi,
      category: aqiCategory(aqi),
      pm25: round1(pm25),
      pm10: round1(pm10),
      no2: data.current.nitrogen_dioxide,
      o3: data.current.ozone,
      so2: data.current.sulphur_dioxide ?? null,
      co: data.current.carbon_monoxide ?? null,
      dominant,
    },
    hourly,
    source: "open-meteo",
    updatedAt,
    utcOffsetSeconds: offset,
  };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Open-Meteo returns wall-clock strings ("2026-11-18T14:00") in the location's zone; convert to UTC ISO. */
export function localToUtcIso(local: string, offsetSeconds: number): string {
  const asUtc = Date.parse(`${local.length === 16 ? `${local}:00` : local}Z`);
  return new Date(asUtc - offsetSeconds * 1000).toISOString();
}

/** Fetch and normalise Open-Meteo data. Throws on network/validation failure. */
export async function fetchOpenMeteo(
  location: AirSnapshot["location"],
  fetchImpl: typeof fetch = fetch,
): Promise<AirSnapshot> {
  const res = await fetchImpl(openMeteoUrl(location.lat, location.lon), {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return parseOpenMeteo(await res.json(), location);
}
