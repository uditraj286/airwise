import { z } from "zod";
import type { Weather } from "@/lib/types";

const WeatherResponse = z.object({
  current: z.object({
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
  }),
});

export function weatherUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m",
    wind_speed_unit: "kmh",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/**
 * Meteorology drives winter smog: calm wind (< 6 km/h) and cold, humid air trap pollution near the ground.
 * Returns a short plain-language explanation used by the dashboard and Gemini.
 */
export function describeDispersion(
  w: Pick<Weather, "windKmh" | "tempC" | "humidity">,
): Weather["dispersion"] {
  if (w.windKmh < 6 && (w.tempC < 18 || w.humidity > 70)) return "trapped";
  if (w.windKmh < 12) return "slow";
  return "dispersing";
}

export function parseWeather(raw: unknown): Weather {
  const c = WeatherResponse.parse(raw).current;
  const base = {
    tempC: Math.round(c.temperature_2m),
    humidity: Math.round(c.relative_humidity_2m),
    windKmh: Math.round(c.wind_speed_10m),
  };
  return { ...base, dispersion: describeDispersion(base) };
}

/** Live weather from Open-Meteo (free, no key). Returns null on any failure — weather is a nice-to-have. */
export async function fetchWeather(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Weather | null> {
  try {
    const res = await fetchImpl(weatherUrl(lat, lon), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return parseWeather(await res.json());
  } catch {
    return null;
  }
}

export const DISPERSION_TEXT: Record<Weather["dispersion"], string> = {
  trapped: "Calm, cold air is trapping smog near the ground",
  slow: "Light wind is clearing smog only slowly",
  dispersing: "Wind is helping disperse pollution",
};
