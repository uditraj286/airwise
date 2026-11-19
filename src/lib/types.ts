/**
 * Shared domain types for AirWise.
 * Runtime validation lives in `lib/profile/schema.ts` and `lib/ai/schemas.ts`; these types are inferred from it
 * where possible so the compile-time and runtime contracts can never drift apart.
 */

export type AgeGroup = "child" | "adult" | "senior";
export type Condition = "asthma" | "heart" | "copd" | "pregnancy" | "allergy";
export type CommuteMode = "car" | "two_wheeler" | "bus" | "metro" | "walk_cycle" | "wfh";
export type StoveType = "lpg" | "induction" | "biomass" | "kerosene";
export type Language = "en" | "hi";
export type DataSource = "google" | "open-meteo" | "mock";

/** One hour of air-quality data. Concentrations in µg/m³. */
export interface HourlyPoint {
  /** ISO-8601 UTC timestamp. */
  time: string;
  pm25: number;
  pm10: number;
  aqi: number;
}

/** Normalised air-quality snapshot returned by `/api/air`, independent of the upstream provider. */
export interface StationReading {
  name: string;
  aqi: number;
  /** Distance to the nearest station used. */
  distanceKm: number;
  updatedAt: string;
  /** How many stations within 30 km were blended (inverse-distance weighted). */
  count?: number;
  /** Blended PM2.5 reported by those stations, µg/m³, when available. */
  pm25?: number | null;
}

export interface AirSnapshot {
  location: { lat: number; lon: number; name: string };
  current: {
    aqi: number;
    category: AqiCategory;
    pm25: number;
    pm10: number;
    no2: number | null;
    o3: number | null;
    /** Sulphur dioxide, µg/m³ (coal, industry). Not every provider reports it. */
    so2?: number | null;
    /** Carbon monoxide, µg/m³ (burning fuel, wood, waste). */
    co?: number | null;
    dominant: "pm25" | "pm10";
  };
  /** Hourly points: up to 24 h in the past and up to 96 h ahead. */
  hourly: HourlyPoint[];
  source: DataSource;
  station?: StationReading;
  /** Factor applied to the model's particle levels to match nearby stations (1 = unchanged). */
  calibration?: number;
  updatedAt: string;
  /** Returned by the dashboard endpoint when neither live provider responds. */
  stale?: boolean;
  /** Offset of the location's local time from UTC, in seconds (e.g. 19800 for IST). */
  utcOffsetSeconds: number;
  /** Live surface weather, when available. */
  weather?: Weather | null;
}

export interface Weather {
  tempC: number;
  humidity: number;
  windKmh: number;
  /** How well the atmosphere is clearing pollution right now. */
  dispersion: "trapped" | "slow" | "dispersing";
}

export type AqiCategory = "good" | "satisfactory" | "moderate" | "poor" | "very_poor" | "severe";
