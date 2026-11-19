import { CATALOGUE, applicableActions, type ActionId } from "@/lib/impact/catalogue";
import {
  baselineInterventions,
  describeDay,
  householdDose,
  type AirDay,
  type Interventions,
} from "@/lib/impact/exposure";
import type { Profile } from "@/lib/profile/schema";

export interface ActionImpact {
  id: ActionId;
  /** Household inhaled PM2.5 avoided today, µg. */
  doseAvoidedUg: number;
  /** Reduction vs. today's baseline household dose, %. */
  exposureReductionPct: number;
  /** Emissions avoided per week. */
  co2KgWeek: number;
  pm25GWeek: number;
}

export interface PlanImpact {
  baselineDoseUg: number;
  planDoseUg: number;
  exposureReductionPct: number;
  co2KgWeek: number;
  pm25GWeek: number;
  /** Equivalent cigarettes avoided per day (Berkeley Earth: 22 µg/m³ for 24 h ≈ 1 cigarette). */
  cigarettesAvoidedPerDay: number;
  byMember: Record<string, { baselineUg: number; planUg: number }>;
}

const round = (n: number, dp = 1): number => Math.round(n * 10 ** dp) / 10 ** dp;
/** Adult daily inhalation ≈ 16 m³; 22 µg/m³ × 16 m³ ≈ 350 µg per "cigarette" (Berkeley Earth, Muller 2015). */
const UG_PER_CIGARETTE = 22 * 16;

function applyAll(profile: Profile, ids: readonly ActionId[]): Interventions {
  return ids.reduce<Interventions>((iv, id) => {
    const action = CATALOGUE[id];
    return action.apply && action.applies(profile) ? action.apply(iv, profile) : iv;
  }, baselineInterventions(profile));
}

/** Quantify a single action in isolation against the baseline. */
export function evaluateAction(profile: Profile, day: AirDay, id: ActionId): ActionImpact {
  const action = CATALOGUE[id];
  const base = householdDose(profile, baselineInterventions(profile), day).total;
  const after = action.apply ? householdDose(profile, applyAll(profile, [id]), day).total : base;
  const em = action.emissions?.(profile) ?? { co2Kg: 0, pm25G: 0 };
  return {
    id,
    doseAvoidedUg: round(base - after, 0),
    exposureReductionPct: base > 0 ? round(((base - after) / base) * 100) : 0,
    co2KgWeek: em.co2Kg,
    pm25GWeek: em.pm25G,
  };
}

/** Quantify the combined effect of a set of actions (interactions included, so not a simple sum). */
export function evaluatePlan(profile: Profile, day: AirDay, ids: readonly ActionId[]): PlanImpact {
  const unique = [...new Set(ids)].filter((id) => CATALOGUE[id].applies(profile));
  const base = householdDose(profile, baselineInterventions(profile), day);
  const plan = householdDose(profile, applyAll(profile, unique), day);
  const emissions = unique.reduce(
    (acc, id) => {
      const em = CATALOGUE[id].emissions?.(profile);
      return em ? { co2Kg: acc.co2Kg + em.co2Kg, pm25G: acc.pm25G + em.pm25G } : acc;
    },
    { co2Kg: 0, pm25G: 0 },
  );
  // car-pool and transit are mutually exclusive ways to fix the same commute: count the larger only.
  if (unique.includes("carpool") && unique.includes("transit_commute")) {
    const carpool = CATALOGUE.carpool.emissions?.(profile);
    if (carpool) {
      emissions.co2Kg -= carpool.co2Kg;
      emissions.pm25G -= carpool.pm25G;
    }
  }
  const byMember: PlanImpact["byMember"] = {};
  for (const m of profile.members) {
    byMember[m.id] = {
      baselineUg: round(base.byMember[m.id] ?? 0, 0),
      planUg: round(plan.byMember[m.id] ?? 0, 0),
    };
  }
  const avoided = base.total - plan.total;
  return {
    baselineDoseUg: round(base.total, 0),
    planDoseUg: round(plan.total, 0),
    exposureReductionPct: base.total > 0 ? round((avoided / base.total) * 100) : 0,
    co2KgWeek: round(emissions.co2Kg),
    pm25GWeek: round(emissions.pm25G, 2),
    cigarettesAvoidedPerDay: round(avoided / UG_PER_CIGARETTE),
    byMember,
  };
}

/** All applicable actions ranked by impact score (exposure % weighted with emissions). */
export function rankActions(profile: Profile, day: AirDay): ActionImpact[] {
  return applicableActions(profile)
    .map((a) => evaluateAction(profile, day, a.id))
    .sort((a, b) => score(b) - score(a));
}

/** Combine health and climate benefit into one sortable number; health is weighted first for families. */
const score = (i: ActionImpact): number => i.exposureReductionPct * 2 + i.co2KgWeek * 0.5 + i.pm25GWeek * 0.5;

export { describeDay };
