import type { AirSnapshot } from "@/lib/types";

export type PollutantKey = "pm25" | "pm10" | "no2" | "o3" | "so2" | "co";

export interface PollutantReading {
  key: PollutantKey;
  /** Short name as people know it. */
  name: string;
  /** What it is and where it usually comes from, in plain words. */
  from: string;
  value: number;
  unit: string;
  /** WHO 2021 guideline it is compared with (µg/m³). */
  limit: number;
  /** value ÷ limit, so 1 means "at the safe limit". */
  times: number;
}

/**
 * WHO 2021 air-quality guidelines (24-hour means; ozone uses the 8-hour peak value).
 * Source: WHO global air quality guidelines, 2021, Table 0.1.
 */
export const WHO_LIMIT: Record<PollutantKey, number> = {
  pm25: 15,
  pm10: 45,
  no2: 25,
  o3: 100,
  so2: 40,
  co: 4000,
};

const META: Record<PollutantKey, { name: string; from: string }> = {
  pm25: { name: "Fine particles (PM2.5)", from: "Tiny particles from smoke, exhaust and other sources" },
  pm10: { name: "Dust (PM10)", from: "Larger particles from roads and building sites" },
  no2: { name: "Nitrogen dioxide (NO₂)", from: "Mostly from vehicle exhaust" },
  so2: { name: "Sulfur dioxide (SO₂)", from: "Coal burning, power plants and industry" },
  co: { name: "Carbon monoxide (CO)", from: "Burning fuel, wood or waste" },
  o3: { name: "Ozone (O₃)", from: "Forms in sunlight from traffic and factory fumes" },
};

/** Live pollutant readings from the snapshot, worst first relative to the WHO limit. Missing values are skipped. */
export function pollutantReadings(current: AirSnapshot["current"]): PollutantReading[] {
  const values: Record<PollutantKey, number | null | undefined> = {
    pm25: current.pm25,
    pm10: current.pm10,
    no2: current.no2,
    o3: current.o3,
    so2: current.so2,
    co: current.co,
  };
  return (Object.keys(values) as PollutantKey[])
    .flatMap((key) => {
      const value = values[key];
      if (value == null || !Number.isFinite(value)) return [];
      const limit = WHO_LIMIT[key];
      const unit = key === "co" ? "mg/m³" : "µg/m³";
      const shown = key === "co" ? Math.round(value / 100) / 10 : Math.round(value);
      return [{ key, ...META[key], value: shown, unit, limit, times: Math.round((value / limit) * 10) / 10 }];
    })
    .sort((a, b) => b.times - a.times);
}

/** Compare an hourly reading with its WHO guideline value. */
export function timesLabel(times: number): string {
  if (times <= 1) return "At or below the WHO guideline";
  return `${times >= 10 ? Math.round(times) : times}× the WHO guideline`;
}
