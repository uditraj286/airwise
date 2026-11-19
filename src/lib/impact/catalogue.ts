import {
  COOKING_CO2_KG_WEEK,
  DIY_FAN_FILTER_CADR,
  EMISSIONS,
  INDOOR,
  INDOOR_SOURCES,
  MASK_REDUCTION,
  MICRO,
  OPEN_BURNING,
} from "@/lib/impact/constants";
import type { Interventions } from "@/lib/impact/exposure";
import type { Profile } from "@/lib/profile/schema";

export const ACTION_IDS = [
  "close_windows_peaks",
  "run_purifier_night",
  "diy_fan_filter",
  "shift_outdoor_best_window",
  "n95_outdoors",
  "skip_incense_coils",
  "cooking_exhaust",
  "switch_to_induction",
  "transit_commute",
  "carpool",
  "no_open_burning",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];
export type ActionKind = "exposure" | "emission" | "both";

export interface WeeklyEmissions {
  co2Kg: number;
  pm25G: number;
}

export interface ActionDef {
  id: ActionId;
  kind: ActionKind;
  title: string;
  how: string;
  /** Human-readable formula shown in the Explain panel. */
  formula: string;
  sources: string[];
  applies: (p: Profile) => boolean;
  /** Exposure lever (omit for emission-only actions). */
  apply?: (iv: Interventions, p: Profile) => Interventions;
  /** Weekly emissions avoided by the household (omit for exposure-only actions). */
  emissions?: (p: Profile) => WeeklyEmissions;
}

const weeklyKm = (p: Profile): number => p.commute.oneWayKm * 2 * p.commute.daysPerWeek;
const round = (n: number, dp = 1): number => Math.round(n * 10 ** dp) / 10 ** dp;

/** Emissions saved by moving the commute from the current mode to metro/bus. */
function transitSavings(p: Profile): WeeklyEmissions {
  const from = EMISSIONS[p.commute.mode];
  const to = EMISSIONS.metro;
  const km = weeklyKm(p);
  return { co2Kg: round(km * (from.co2 - to.co2)), pm25G: round(km * (from.pm25 - to.pm25), 2) };
}

const hasOutdoor = (p: Profile): boolean => p.members.some((m) => m.outdoorActivity);

export const CATALOGUE: Record<ActionId, ActionDef> = {
  close_windows_peaks: {
    id: "close_windows_peaks",
    kind: "exposure",
    title: "Keep windows shut during peak smog hours",
    how: "Close windows and doors in the worst hours; air out briefly in the cleanest afternoon hour instead.",
    formula: "Indoor = P·a·C_out / (a + k): a drops from 3/h (open) to 0.8/h (closed)",
    sources: [INDOOR.airExchangeOpenPerH.source, INDOOR.penetration.source],
    applies: () => true,
    apply: (iv) => ({ ...iv, closeWindowsAtPeaks: true }),
  },
  run_purifier_night: {
    id: "run_purifier_night",
    kind: "exposure",
    title: "Run the air purifier in the bedroom from 7 PM to 7 AM",
    how: "Keep the door closed, run on high for the first 30 minutes, then auto. Replace the HEPA filter as advised.",
    formula: "Indoor = P·a·C_out / (a + k + CADR/V)",
    sources: [INDOOR.penetration.source],
    applies: (p) => p.home.hasPurifier,
    apply: (iv, p) => ({ ...iv, purifierCadr: p.home.purifierCadrM3h }),
  },
  diy_fan_filter: {
    id: "diy_fan_filter",
    kind: "exposure",
    title: "Build a ₹1,500 home-made purifier: a box fan with a fine-dust filter",
    how: "Tape a fine-dust filter (MERV-13 or HEPA grade) to the intake side of a box/table fan; run it in the bedroom at night.",
    formula: `Indoor = P·a·C_out / (a + k + CADR/V), CADR ≈ ${DIY_FAN_FILTER_CADR.value} m³/h`,
    sources: [DIY_FAN_FILTER_CADR.source, INDOOR.penetration.source],
    applies: (p) => !p.home.hasPurifier,
    apply: (iv) => ({ ...iv, purifierCadr: DIY_FAN_FILTER_CADR.value }),
  },
  shift_outdoor_best_window: {
    id: "shift_outdoor_best_window",
    kind: "exposure",
    title: "Move walks and outdoor play to the cleanest hour",
    how: "Schedule the walk, run or kids' play in the lowest-PM2.5 daytime hour shown on the forecast.",
    formula: "Dose = Σ C(hour) × breathing rate; outdoor hour moved to min C(hour) in daylight",
    sources: ["US EPA Exposure Factors Handbook 2011, Table 6-2"],
    applies: hasOutdoor,
    apply: (iv) => ({ ...iv, shiftOutdoorToBest: true }),
  },
  n95_outdoors: {
    id: "n95_outdoors",
    kind: "exposure",
    title: "Wear a well-fitted N95 mask outdoors and on open-air commutes",
    how: "Pinch the nose clip, check the seal by exhaling; cloth and surgical masks do little for PM2.5.",
    formula: `Outdoor dose × (1 − ${MASK_REDUCTION.n95.value})`,
    sources: [MASK_REDUCTION.n95.source],
    applies: (p) => hasOutdoor(p) || ["two_wheeler", "bus", "walk_cycle", "metro"].includes(p.commute.mode),
    apply: (iv) => ({ ...iv, maskOutdoors: true }),
  },
  skip_incense_coils: {
    id: "skip_incense_coils",
    kind: "exposure",
    title: "Swap mosquito coils and incense for nets or plug-in repellents",
    how: "Use bed nets or electric repellents; if lighting a diya or agarbatti, do it near an open window briefly.",
    formula: `Indoor source of +${INDOOR_SOURCES.incenseOrCoil.value} µg/m³ at 7–9 PM removed`,
    sources: [INDOOR_SOURCES.incenseOrCoil.source],
    applies: (p) => p.home.usesIncenseOrCoils,
    apply: (iv) => ({ ...iv, noIncense: true }),
  },
  cooking_exhaust: {
    id: "cooking_exhaust",
    kind: "exposure",
    title: "Use the exhaust fan and lids while cooking",
    how: "Switch the chimney/exhaust on before you start and leave it 10 minutes after; cook on back burners.",
    formula: `Cooking source × (1 − ${INDOOR_SOURCES.exhaustReduction.value})`,
    sources: [INDOOR_SOURCES.exhaustReduction.source, INDOOR_SOURCES.lpg.source],
    applies: (p) => p.home.stove !== "induction",
    apply: (iv) => ({ ...iv, cookingExhaust: true }),
  },
  switch_to_induction: {
    id: "switch_to_induction",
    kind: "both",
    title: "Switch everyday cooking to an induction cooktop",
    how: "A ₹2,000 induction plate handles chai, dal and rice; keep the gas for rotis if you like.",
    formula: "Cooking source falls to the induction value; weekly CO₂ = LPG − grid electricity",
    sources: [
      INDOOR_SOURCES.lpg.source,
      COOKING_CO2_KG_WEEK.lpg.source,
      COOKING_CO2_KG_WEEK.induction.source,
    ],
    applies: (p) => p.home.stove !== "induction",
    apply: (iv) => ({ ...iv, stove: "induction" }),
    emissions: (p) => ({
      co2Kg: round(
        Math.max(0, COOKING_CO2_KG_WEEK[p.home.stove].value - COOKING_CO2_KG_WEEK.induction.value),
      ),
      pm25G: 0,
    }),
  },
  transit_commute: {
    id: "transit_commute",
    kind: "both",
    title: "Take the metro or bus instead of driving",
    how: "Metro cabins have filtered air (about 0.65× street PM2.5) and cut per-km CO₂ by over 80%.",
    formula: "Weekly km × (EF_current − EF_metro); commute exposure × microenvironment factor",
    sources: [EMISSIONS.car.source, EMISSIONS.metro.source, MICRO.metro.source],
    applies: (p) => p.commute.mode === "car" || p.commute.mode === "two_wheeler",
    apply: (iv) => ({ ...iv, commuteMode: "metro" }),
    emissions: transitSavings,
  },
  carpool: {
    id: "carpool",
    kind: "emission",
    title: "Car-pool with a neighbour or colleague",
    how: "Two people per car halves per-person emissions; use your society or office group to match routes.",
    formula: "Weekly km × EF_car × 0.5",
    sources: [EMISSIONS.car.source],
    applies: (p) => p.commute.mode === "car",
    emissions: (p) => ({
      co2Kg: round(weeklyKm(p) * EMISSIONS.car.co2 * 0.5),
      pm25G: round(weeklyKm(p) * EMISSIONS.car.pm25 * 0.5, 2),
    }),
  },
  no_open_burning: {
    id: "no_open_burning",
    kind: "emission",
    title: "Compost leaves and hand over dry waste instead of burning",
    how: "Bag dry leaves for your society's composter or municipal pickup; report burning on the CPCB Sameer app.",
    formula: `${OPEN_BURNING.kgPerWeek.value} kg/week × ${OPEN_BURNING.pm25GPerKg.value} g PM2.5/kg`,
    sources: [OPEN_BURNING.pm25GPerKg.source],
    applies: (p) => p.habits.burnsLeavesOrWaste,
    emissions: () => ({ co2Kg: 0, pm25G: OPEN_BURNING.kgPerWeek.value * OPEN_BURNING.pm25GPerKg.value }),
  },
};

/** Actions relevant to this household, in catalogue order. */
export const applicableActions = (p: Profile): ActionDef[] =>
  ACTION_IDS.map((id) => CATALOGUE[id]).filter((a) => a.applies(p));
