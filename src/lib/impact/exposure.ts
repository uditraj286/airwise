import {
  AGE_BREATHING_FACTOR,
  BREATHING_M3H,
  INDOOR,
  INDOOR_SOURCES,
  MASK_REDUCTION,
  MICRO,
} from "@/lib/impact/constants";
import type { Member, Profile } from "@/lib/profile/schema";
import type { CommuteMode, StoveType } from "@/lib/types";

/** Where a person is during a given hour. */
export type Env = "home" | "outdoor" | "commute" | "work" | "school";
export type Activity = keyof typeof BREATHING_M3H;
export interface Slot {
  env: Env;
  activity: Activity;
}

/** Household-level levers that the action catalogue toggles. */
export interface Interventions {
  closeWindowsAtPeaks: boolean;
  /** Clean-air delivery rate of the filter running evenings and nights (m³/h); 0 = none. */
  purifierCadr: number;
  shiftOutdoorToBest: boolean;
  maskOutdoors: boolean;
  noIncense: boolean;
  cookingExhaust: boolean;
  stove: StoveType;
  commuteMode: CommuteMode;
}

export interface AirDay {
  /** Ambient PM2.5 (µg/m³) for local hours 0–23. */
  pm25: number[];
  /** Local hours considered "peak" (worst air). */
  peakHours: number[];
  /** Daytime local hours (7–18) ordered cleanest first. */
  cleanestDaytime: number[];
}

const DAY_HOURS = Array.from({ length: 24 }, (_, h) => h);
const COOKING_HOURS = new Set([7, 19]);
const INCENSE_HOURS = new Set([19, 20]);
const PURIFIER_HOURS = new Set([0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 23]);
/** Baseline habit: windows open during the day for light and ventilation. */
const WINDOWS_OPEN_HOURS = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);

/** Characterise the day's air: peaks (6 worst hours) and cleanest daytime hours. */
export function describeDay(pm25: number[]): AirDay {
  const ranked = DAY_HOURS.slice().sort((a, b) => (pm25[b] ?? 0) - (pm25[a] ?? 0));
  const daytime = DAY_HOURS.filter((h) => h >= 7 && h <= 18).sort((a, b) => (pm25[a] ?? 0) - (pm25[b] ?? 0));
  return { pm25, peakHours: ranked.slice(0, 6).sort((a, b) => a - b), cleanestDaytime: daytime };
}

/** Starting point: what the household does today without AirWise. */
export function baselineInterventions(profile: Profile): Interventions {
  return {
    closeWindowsAtPeaks: false,
    purifierCadr: 0,
    shiftOutdoorToBest: false,
    maskOutdoors: false,
    noIncense: !profile.home.usesIncenseOrCoils,
    cookingExhaust: false,
    stove: profile.home.stove,
    commuteMode: profile.commute.mode,
  };
}

/** A plausible 24-hour schedule for a member, before interventions. */
export function baseSchedule(member: Member, commuteMode: CommuteMode): Slot[] {
  const home = (activity: Activity = "light"): Slot => ({ env: "home", activity });
  const slots: Slot[] = DAY_HOURS.map(() => home());
  const sleepHours =
    member.ageGroup === "child" ? [21, 22, 23, 0, 1, 2, 3, 4, 5, 6] : [22, 23, 0, 1, 2, 3, 4, 5];
  for (const h of sleepHours) slots[h] = home("sleep");

  if (member.ageGroup === "child") {
    for (let h = 8; h <= 13; h++) slots[h] = { env: "school", activity: "light" };
    if (member.outdoorActivity) slots[16] = { env: "outdoor", activity: "moderate" };
  } else if (member.ageGroup === "adult") {
    if (commuteMode !== "wfh") {
      slots[8] = { env: "commute", activity: "light" };
      for (let h = 9; h <= 17; h++) slots[h] = { env: "work", activity: "light" };
      slots[18] = { env: "commute", activity: "light" };
    }
    if (member.outdoorActivity) slots[6] = { env: "outdoor", activity: "moderate" };
  } else if (member.outdoorActivity) {
    slots[6] = { env: "outdoor", activity: "moderate" }; // senior morning walk
  }
  return slots;
}

/** Move a member's outdoor hour to the cleanest daytime hour they are free (at home). */
export function shiftOutdoor(slots: Slot[], day: AirDay): Slot[] {
  const from = slots.findIndex((s) => s.env === "outdoor");
  if (from < 0) return slots;
  const to = day.cleanestDaytime.find((h) => slots[h]?.env === "home" && slots[h]?.activity !== "sleep");
  if (to === undefined || (day.pm25[to] ?? Infinity) >= (day.pm25[from] ?? 0)) return slots;
  const next = slots.slice();
  next[to] = slots[from] as Slot;
  next[from] = { env: "home", activity: "light" };
  return next;
}

const STOVE_SOURCE: Record<StoveType, number> = {
  lpg: INDOOR_SOURCES.lpg.value,
  induction: INDOOR_SOURCES.induction.value,
  kerosene: INDOOR_SOURCES.kerosene.value,
  biomass: INDOOR_SOURCES.biomass.value,
};

/**
 * Indoor PM2.5 from the steady-state mass balance
 *   C_in = (P·a·C_out + S·(a + k)) / (a + k + CADR/V)
 * where S is the hour-averaged increment from indoor sources without filtration.
 */
export function homeConcentration(
  hour: number,
  outdoor: number,
  profile: Profile,
  iv: Interventions,
  day: AirDay,
): number {
  const open = WINDOWS_OPEN_HOURS.has(hour) && !(iv.closeWindowsAtPeaks && day.peakHours.includes(hour));
  const a = open ? INDOOR.airExchangeOpenPerH.value : INDOOR.airExchangeClosedPerH.value;
  const k = INDOOR.depositionPerH.value;
  const filtration = PURIFIER_HOURS.has(hour) ? iv.purifierCadr / profile.home.bedroomVolumeM3 : 0;

  let source = 0;
  if (COOKING_HOURS.has(hour)) {
    source += STOVE_SOURCE[iv.stove] * (iv.cookingExhaust ? 1 - INDOOR_SOURCES.exhaustReduction.value : 1);
  }
  if (!iv.noIncense && INCENSE_HOURS.has(hour)) source += INDOOR_SOURCES.incenseOrCoil.value;

  return (INDOOR.penetration.value * a * outdoor + source * (a + k)) / (a + k + filtration);
}

/** PM2.5 a person actually breathes in a slot. */
export function slotConcentration(
  slot: Slot,
  hour: number,
  profile: Profile,
  iv: Interventions,
  day: AirDay,
): number {
  const outdoor = day.pm25[hour] ?? 0;
  const masked = iv.maskOutdoors ? 1 - MASK_REDUCTION.n95.value : 1;
  switch (slot.env) {
    case "home":
      return homeConcentration(hour, outdoor, profile, iv, day);
    case "outdoor":
      return outdoor * masked;
    case "work":
      return outdoor * MICRO.workplace.value;
    case "school":
      return outdoor * MICRO.school.value;
    case "commute": {
      if (iv.commuteMode === "wfh") return homeConcentration(hour, outdoor, profile, iv, day);
      const micro = MICRO[iv.commuteMode].value;
      const exposedMode = iv.commuteMode !== "car";
      return outdoor * micro * (exposedMode ? masked : 1);
    }
  }
}

/** Inhaled PM2.5 mass (µg) for one member over the day. */
export function memberDose(member: Member, profile: Profile, iv: Interventions, day: AirDay): number {
  let slots = baseSchedule(member, iv.commuteMode);
  if (iv.shiftOutdoorToBest) slots = shiftOutdoor(slots, day);
  const ageFactor = AGE_BREATHING_FACTOR[member.ageGroup];
  return slots.reduce((sum, slot, hour) => {
    const c = slotConcentration(slot, hour, profile, iv, day);
    return sum + c * BREATHING_M3H[slot.activity].value * ageFactor;
  }, 0);
}

/** Inhaled PM2.5 (µg) per member and for the whole household. */
export function householdDose(
  profile: Profile,
  iv: Interventions,
  day: AirDay,
): { total: number; byMember: Record<string, number> } {
  const byMember: Record<string, number> = {};
  let total = 0;
  for (const m of profile.members) {
    const dose = memberDose(m, profile, iv, day);
    byMember[m.id] = dose;
    total += dose;
  }
  return { total, byMember };
}
