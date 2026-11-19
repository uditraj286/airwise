import { aqiCategory } from "@/lib/air/aqi";
import { upcoming } from "@/lib/air/dayWindows";
import { hourLabel, localHour, windowLabel } from "@/lib/air/time";
import type { Member } from "@/lib/profile/schema";
import { memberRisk } from "@/lib/profile/schema";
import type { AirSnapshot, AqiCategory } from "@/lib/types";

/**
 * Plain "can we do this now?" advice per activity and person.
 *
 * Thresholds follow the CPCB National AQI health advisories (Satisfactory: minor discomfort for sensitive people;
 * Moderate: discomfort for people with lung or heart disease, children and older adults; Poor: discomfort for most
 * people on long exposure; Very Poor: illness on long exposure; Severe: affects healthy people). Hard exercise and
 * children's play raise breathing rate 2–3× (US EPA Exposure Factors Handbook 2011, Table 6-2), so those activities
 * get one step stricter limits.
 */
export type ActivityId = "walk" | "exercise" | "cycle" | "play" | "commute" | "windows" | "burning";
export type Tier = ReturnType<typeof memberRisk>;
export type Advice = "yes" | "care" | "no";

export interface ActivityVerdict {
  id: ActivityId;
  label: string;
  advice: Advice;
  /** Short sentence: "Fine now", "Keep it short and wear an N95 mask", "Not now". */
  text: string;
  /** When it gets better, e.g. "Better at 2 PM tomorrow". Null when it's fine now or doesn't clear in 24 hours. */
  better: string | null;
}

const LEVEL: Record<AqiCategory, number> = {
  good: 0,
  satisfactory: 1,
  moderate: 2,
  poor: 3,
  very_poor: 4,
  severe: 5,
};

const ACTIVITIES: { id: ActivityId; label: string; vigorous: boolean }[] = [
  { id: "walk", label: "A walk outside", vigorous: false },
  { id: "commute", label: "School or office commute", vigorous: false },
  { id: "play", label: "Children's outdoor play", vigorous: true },
  { id: "exercise", label: "Running or sport", vigorous: true },
  { id: "cycle", label: "Cycling", vigorous: true },
  { id: "windows", label: "Opening the windows", vigorous: false },
  { id: "burning", label: "Burning leaves or waste", vigorous: false },
];

/** Highest AQI level (0–5) at which the activity is fine ("yes") and fine with care ("care"). */
function limits(id: ActivityId, tier: Tier, vigorous: boolean): { yes: number; care: number } {
  if (id === "windows") return { yes: 1, care: 3 };
  if (id === "burning") return { yes: -1, care: -1 };
  const base =
    tier === "standard"
      ? { yes: 2, care: 4 }
      : tier === "elevated"
        ? { yes: 1, care: 3 }
        : { yes: 1, care: 2 };
  return vigorous ? { yes: base.yes - 1, care: base.care - 1 } : base;
}

function textFor(id: ActivityId, advice: Advice, vigorous: boolean): string {
  if (id === "burning")
    return "Never: it adds smoke for the whole street. Compost or hand it to waste collection";
  if (id === "windows")
    return advice === "yes"
      ? "Fine now, let fresh air in"
      : advice === "care"
        ? "Only for 10 minutes, then shut them"
        : "Keep them shut";
  if (advice === "yes") return "Fine now";
  if (advice === "care")
    return vigorous ? "Go easy, keep it short and wear an N95 mask" : "Keep it short and wear an N95 mask";
  return "Not now";
}

/** Advice for one activity at the current air, plus the next hour when it becomes fine. */
export function adviseActivity(
  id: ActivityId,
  tier: Tier,
  air: AirSnapshot,
  now: Date = new Date(),
): ActivityVerdict {
  const def = ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[0]!;
  const lim = limits(id, tier, def.vigorous);
  const level = LEVEL[aqiCategory(air.current.aqi)];
  const advice: Advice = level <= lim.yes ? "yes" : level <= lim.care ? "care" : "no";
  let better: string | null = null;
  if (advice !== "yes" && id !== "burning") {
    const nowMs = now.getTime();
    const today = new Date(nowMs + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
    const next = upcoming(air.hourly, now, 24).find(
      (p) => Date.parse(p.time) > nowMs && LEVEL[aqiCategory(p.aqi)] <= lim.yes,
    );
    if (next) {
      const day = new Date(Date.parse(next.time) + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
      better = `Better at ${hourLabel(localHour(next.time, air.utcOffsetSeconds))}${day !== today ? " tomorrow" : ""}`;
    }
  }
  return { id, label: def.label, advice, text: textFor(id, advice, def.vigorous), better };
}

/** Every activity for one risk tier. */
export function adviseAll(tier: Tier, air: AirSnapshot, now: Date = new Date()): ActivityVerdict[] {
  return ACTIVITIES.map((a) => adviseActivity(a.id, tier, air, now));
}

/** The one outdoor activity that matters most for this person: play for children, exercise if active, else a walk. */
export function memberAdvice(member: Member, air: AirSnapshot, now: Date = new Date()): ActivityVerdict {
  const id: ActivityId = member.ageGroup === "child" ? "play" : member.outdoorActivity ? "exercise" : "walk";
  return adviseActivity(id, memberRisk(member), air, now);
}

export const TIER_LABEL: Record<Tier, string> = {
  high: "Extra care",
  elevated: "Take care",
  standard: "Usual care",
};

export interface Outing {
  /** e.g. "2 PM" or "2 PM tomorrow". */
  start: string;
  /** e.g. "2–4 PM". */
  window: string;
  pm25: number;
  category: AqiCategory;
  /** True when this is still unhealthy (Poor or worse): wear a mask, keep it short. */
  unhealthy: boolean;
}

/**
 * Best start time for an outing of `hours` length in the next 24 hours, between 6 AM and 9 PM local time:
 * the window with the lowest average PM2.5.
 */
export function bestOuting(air: AirSnapshot, hours: number, now: Date = new Date()): Outing | null {
  const pts = upcoming(air.hourly, now, 24).filter((p) => Date.parse(p.time) + 3600_000 > now.getTime());
  const nowDay = new Date(now.getTime() + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
  let best: { i: number; avg: number } | null = null;
  for (let i = 0; i + hours <= pts.length; i++) {
    const win = pts.slice(i, i + hours);
    const startH = localHour(win[0]!.time, air.utcOffsetSeconds);
    const endH = localHour(win[win.length - 1]!.time, air.utcOffsetSeconds);
    if (startH < 6 || endH > 20 || endH < startH) continue;
    const avg = win.reduce((s, p) => s + p.pm25, 0) / hours;
    if (!best || avg < best.avg) best = { i, avg };
  }
  if (!best) return null;
  const first = pts[best.i]!;
  const h = localHour(first.time, air.utcOffsetSeconds);
  const day = new Date(Date.parse(first.time) + air.utcOffsetSeconds * 1000).toISOString().slice(0, 10);
  const tomorrow = day !== nowDay ? " tomorrow" : "";
  const pm25 = Math.round(best.avg);
  const worst = Math.max(...pts.slice(best.i, best.i + hours).map((p) => p.aqi));
  const category = aqiCategory(worst);
  return {
    start: `${hourLabel(h)}${tomorrow}`,
    window: `${windowLabel(h, hours)}${tomorrow}`,
    pm25,
    category,
    unhealthy: LEVEL[category] >= 3,
  };
}
