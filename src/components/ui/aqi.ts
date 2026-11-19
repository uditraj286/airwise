import type { AqiCategory } from "@/lib/types";

/** Tailwind background class per AQI category (tokens in globals.css). */
export const AQI_BG: Record<AqiCategory, string> = {
  good: "bg-aqi-good",
  satisfactory: "bg-aqi-satisfactory",
  moderate: "bg-aqi-moderate",
  poor: "bg-aqi-poor",
  very_poor: "bg-aqi-very-poor",
  severe: "bg-aqi-severe",
};

export const AQI_ORDER: AqiCategory[] = ["good", "satisfactory", "moderate", "poor", "very_poor", "severe"];
