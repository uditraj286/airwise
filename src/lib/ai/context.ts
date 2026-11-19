import { aqiCategory, timesWhoGuideline } from "@/lib/air/aqi";
import { next24ByLocalHour, windowLabel } from "@/lib/air/time";
import { DISPERSION_TEXT } from "@/lib/air/weather";
import { CATALOGUE } from "@/lib/impact/catalogue";
import { describeDay, rankActions, type ActionImpact } from "@/lib/impact/evaluate";
import type { AirDay } from "@/lib/impact/exposure";
import { memberRisk, type Profile } from "@/lib/profile/schema";
import type { AirSnapshot } from "@/lib/types";

/** Group sorted hours into contiguous windows, e.g. [7,8,19,20,21] → "7–9 AM, 7–10 PM". */
export function peakWindowsLabel(hours: number[]): string {
  const sorted = [...hours].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const h of sorted) {
    const last = runs.at(-1);
    if (last && h === last[1] + 1) last[1] = h;
    else runs.push([h, h]);
  }
  return runs.map(([start, end]) => windowLabel(start, end - start + 1)).join(", ");
}

export interface PlanContext {
  day: AirDay;
  ranked: ActionImpact[];
  bestWindow: string;
  bestHour: number;
  peakWindows: string;
}

/** Derive everything the planner and the chat need from the live air data and profile. */
export function buildContext(profile: Profile, air: AirSnapshot, now: Date = new Date()): PlanContext {
  const day = describeDay(next24ByLocalHour(air, now));
  const bestHour = day.cleanestDaytime[0] ?? 14;
  return {
    day,
    ranked: rankActions(profile, day),
    bestHour,
    bestWindow: windowLabel(bestHour, 2),
    peakWindows: peakWindowsLabel(day.peakHours),
  };
}

/**
 * Compact, model-friendly facts. Only sanitised, schema-validated fields are included; no free text from the
 * user reaches the planner prompt, which removes the prompt-injection surface for plan generation.
 */
export function factsBlock(profile: Profile, air: AirSnapshot, ctx: PlanContext): string {
  const members = profile.members
    .map(
      (m) =>
        `- ${m.name} (${m.ageGroup}${m.conditions.length ? `, ${m.conditions.join("/")}` : ""}; risk: ${memberRisk(m)}${m.outdoorActivity ? "; goes outdoors daily" : ""})`,
    )
    .join("\n");
  const actions = ctx.ranked
    .map((a) => {
      const def = CATALOGUE[a.id];
      return `- ${a.id} [${def.kind}] "${def.title}": exposure −${a.exposureReductionPct}%, CO2 −${a.co2KgWeek} kg/week, PM2.5 emitted −${a.pm25GWeek} g/week`;
    })
    .join("\n");
  return [
    `LOCATION: ${profile.location.name}`,
    ...(air.station
      ? [
          `NEARBY CPCB STATION AQI: ${air.station.aqi} at ${air.station.name}, ${Math.round(air.station.distanceKm)} km away, reported ${air.station.updatedAt}. Local forecast below is modeled.`,
        ]
      : []),
    `AIR NOW: AQI ${air.current.aqi} (${aqiCategory(air.current.aqi).replace("_", " ")}), PM2.5 ${air.current.pm25} µg/m³ = ${timesWhoGuideline(air.current.pm25)}× WHO 24-h guideline`,
    ...(air.weather
      ? [
          `WEATHER NOW: ${air.weather.tempC}°C, wind ${air.weather.windKmh} km/h, humidity ${air.weather.humidity}% — ${DISPERSION_TEXT[air.weather.dispersion]}`,
        ]
      : []),
    `CLEANEST DAYTIME WINDOW: ${ctx.bestWindow} (~${ctx.day.pm25[ctx.bestHour]} µg/m³)`,
    `PEAK SMOG WINDOWS: ${ctx.peakWindows}`,
    `HOUSEHOLD:\n${members}`,
    `HOME: stove=${profile.home.stove}, purifier=${profile.home.hasPurifier ? `yes (CADR ${profile.home.purifierCadrM3h} m³/h)` : "no"}, incense/coils=${profile.home.usesIncenseOrCoils ? "yes" : "no"}`,
    `COMMUTE: ${profile.commute.mode}, ${profile.commute.oneWayKm} km each way, ${profile.commute.daysPerWeek} days/week`,
    `CANDIDATE ACTIONS (pre-computed impact, ranked):\n${actions}`,
  ].join("\n");
}
