import type { PlanContext } from "@/lib/ai/context";
import type { LlmPlan } from "@/lib/ai/schemas";
import { CATALOGUE, type ActionId } from "@/lib/impact/catalogue";
import { memberRisk, type Profile } from "@/lib/profile/schema";
import type { AirSnapshot } from "@/lib/types";

/** When in the day an action belongs, for grouping the plan into a readable timeline. */
export type Slot = "morning" | "afternoon" | "evening" | "night" | "anytime" | "this_week";
export const SLOT_ORDER: Slot[] = ["morning", "afternoon", "evening", "night", "anytime", "this_week"];

const slotOfHour = (h: number): Slot =>
  h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";

/** Deterministic slot per action, based on today's windows (never left to the model). */
export function slotFor(id: ActionId, ctx: PlanContext): Slot {
  switch (id) {
    case "close_windows_peaks":
      return slotOfHour(ctx.day.peakHours[0] ?? 7);
    case "run_purifier_night":
    case "diy_fan_filter":
      return "night";
    case "shift_outdoor_best_window":
      return slotOfHour(ctx.bestHour);
    case "skip_incense_coils":
      return "evening";
    case "transit_commute":
      return "morning";
    case "n95_outdoors":
    case "cooking_exhaust":
      return "anytime";
    case "switch_to_induction":
    case "carpool":
    case "no_open_burning":
      return "this_week";
  }
}

/** Default, plain-language time for each action, filled from the day's windows. */
export function defaultTime(id: ActionId, ctx: PlanContext): string {
  switch (id) {
    case "close_windows_peaks":
      return ctx.peakWindows;
    case "run_purifier_night":
    case "diy_fan_filter":
      return "7 PM → 7 AM";
    case "shift_outdoor_best_window":
      return ctx.bestWindow;
    case "n95_outdoors":
      return "Every time you step out";
    case "skip_incense_coils":
      return "7–9 PM";
    case "cooking_exhaust":
      return "At every meal";
    case "transit_commute":
      return "Your next commute";
    case "switch_to_induction":
    case "carpool":
      return "This week";
    case "no_open_burning":
      return "This weekend";
  }
}

function forWhom(id: ActionId, profile: Profile): string[] {
  if (id === "shift_outdoor_best_window" || id === "n95_outdoors") {
    const names = profile.members.filter((m) => m.outdoorActivity).map((m) => m.name);
    return names.length ? names : ["Everyone"];
  }
  return ["Everyone"];
}

/**
 * Deterministic plan used when Gemini is unavailable, slow, or returns invalid output.
 * Keeps the product fully functional offline and in tests.
 */
export function rulePlan(profile: Profile, air: AirSnapshot, ctx: PlanContext): LlmPlan {
  const picks: ActionId[] = ctx.ranked.slice(0, 5).map((a) => a.id);
  const emission = ctx.ranked.find((a) => CATALOGUE[a.id].kind !== "exposure");
  if (emission && !picks.includes(emission.id)) picks[picks.length - 1] = emission.id;

  const highRisk = profile.members.filter((m) => memberRisk(m) === "high").map((m) => m.name);
  return {
    headline: `AQI ${air.current.aqi} in ${profile.location.name}: stay in during ${ctx.peakWindows}, go out ${ctx.bestWindow}`,
    summary: `Smog peaks ${ctx.peakWindows}. The cleanest daytime window is ${ctx.bestWindow}. These steps are ranked by how much PM2.5 they keep out of your family's lungs and how much pollution they avoid.`,
    items: picks.map((id) => ({
      actionId: id,
      time: defaultTime(id, ctx),
      title: CATALOGUE[id].title,
      why: CATALOGUE[id].how,
      forWhom: forWhom(id, profile),
    })),
    healthNote: highRisk.length
      ? `${highRisk.join(", ")} ${highRisk.length > 1 ? "are" : "is"} high-risk today. Keep inhalers or medicines handy and see a doctor for breathlessness, chest pain or persistent wheezing.`
      : "Watch for coughing, itchy eyes or breathlessness, especially in children and elders, and contact a doctor if symptoms persist.",
    communityTip:
      "Propose a no-burning pledge and a car-pool group in your housing society chat; shared action lowers everyone's air.",
  };
}
