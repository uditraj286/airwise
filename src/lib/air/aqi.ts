import type { AqiCategory } from "@/lib/types";

/**
 * India National Air Quality Index (NAQI, CPCB 2014) breakpoints.
 * Each row maps a concentration range [cLo, cHi] (µg/m³) to an index range [iLo, iHi].
 * The last row is extrapolated so values beyond the published scale still clamp at 500.
 */
type Breakpoint = readonly [cLo: number, cHi: number, iLo: number, iHi: number];

const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  [0, 30, 0, 50],
  [30, 60, 50, 100],
  [60, 90, 100, 200],
  [90, 120, 200, 300],
  [120, 250, 300, 400],
  [250, 380, 400, 500],
];

const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  [0, 50, 0, 50],
  [50, 100, 50, 100],
  [100, 250, 100, 200],
  [250, 350, 200, 300],
  [350, 430, 300, 400],
  [430, 510, 400, 500],
];

function subIndex(concentration: number, table: readonly Breakpoint[]): number {
  if (!Number.isFinite(concentration) || concentration <= 0) return 0;
  for (const [cLo, cHi, iLo, iHi] of table) {
    if (concentration <= cHi) {
      return Math.round(iLo + ((iHi - iLo) * (concentration - cLo)) / (cHi - cLo));
    }
  }
  return 500;
}

/** NAQI sub-index for PM2.5. */
export const pm25ToAqi = (pm25: number): number => subIndex(pm25, PM25_BREAKPOINTS);

/** NAQI sub-index for PM10. */
export const pm10ToAqi = (pm10: number): number => subIndex(pm10, PM10_BREAKPOINTS);

/** Overall AQI is the worst sub-index (CPCB method). */
export function computeAqi(pm25: number, pm10: number): { aqi: number; dominant: "pm25" | "pm10" } {
  const a25 = pm25ToAqi(pm25);
  const a10 = pm10ToAqi(pm10);
  return a25 >= a10 ? { aqi: a25, dominant: "pm25" } : { aqi: a10, dominant: "pm10" };
}

/** CPCB category for an AQI value. */
export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "satisfactory";
  if (aqi <= 200) return "moderate";
  if (aqi <= 300) return "poor";
  if (aqi <= 400) return "very_poor";
  return "severe";
}

/** WHO 2021 24-hour PM2.5 guideline, µg/m³. */
export const WHO_PM25_24H = 15;

/** How many times above the WHO guideline a PM2.5 value is (rounded to one decimal). */
export const timesWhoGuideline = (pm25: number): number => Math.round((pm25 / WHO_PM25_24H) * 10) / 10;
