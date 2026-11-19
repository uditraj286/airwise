import type { DayRecord } from "@/lib/firebase/repo";
import type { DailyPlan } from "@/lib/ai/plan";

const round = (n: number, dp = 2): number => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Turn today's plan + completed actions into a log entry. A completed emission action is credited with one day's
 * share (1/7) of its weekly savings, so the weekly total adds up as the family repeats it.
 */
export function buildDayRecord(date: string, plan: DailyPlan, doneIds: readonly string[]): DayRecord {
  const done = plan.items.filter((i) => doneIds.includes(i.actionId));
  return {
    date,
    city: plan.air.location.slice(0, 80),
    aqi: plan.air.aqi,
    planIds: plan.items.map((i) => i.actionId),
    doneIds: done.map((i) => i.actionId),
    plannedExposurePct: Math.min(100, Math.max(0, plan.impact.exposureReductionPct)),
    co2KgDone: round(done.reduce((s, i) => s + i.impact.co2KgWeek / 7, 0)),
    pm25GDone: round(
      done.reduce((s, i) => s + i.impact.pm25GWeek / 7, 0),
      3,
    ),
  };
}

export interface WeekSummary {
  actionsDone: number;
  daysOnPlan: number;
  co2KgAvoided: number;
}

/** Totals for the "Your impact this week" card. */
export function summariseWeek(days: readonly DayRecord[]): WeekSummary {
  return {
    actionsDone: days.reduce((s, d) => s + d.doneIds.length, 0),
    daysOnPlan: days.filter((d) => d.doneIds.length > 0).length,
    co2KgAvoided: round(
      days.reduce((s, d) => s + d.co2KgDone, 0),
      1,
    ),
  };
}

/** ISO date `n` days before `today` (YYYY-MM-DD). */
export function daysAgo(today: string, n: number): string {
  const t = Date.parse(`${today}T00:00:00Z`) - n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
