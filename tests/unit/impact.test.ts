import { next24ByLocalHour } from "@/lib/air/time";
import { ACTION_IDS, CATALOGUE, applicableActions } from "@/lib/impact/catalogue";
import { evaluateAction, evaluatePlan, rankActions } from "@/lib/impact/evaluate";
import {
  baseSchedule,
  baselineInterventions,
  describeDay,
  homeConcentration,
  householdDose,
  shiftOutdoor,
} from "@/lib/impact/exposure";
import { DIURNAL_PM25 } from "@/lib/air/mock";
import { air, NOW, profile } from "../fixtures";

const day = describeDay([...DIURNAL_PM25]);

describe("describeDay", () => {
  it("finds the six worst hours and the cleanest daytime hour", () => {
    expect(day.peakHours).toHaveLength(6);
    expect(day.peakHours).toContain(8);
    expect(day.cleanestDaytime[0]).toBe(14);
  });
});

describe("indoor mass balance", () => {
  const p = profile();
  const base = baselineInterventions(p);

  it("closing windows during a peak lowers indoor PM2.5", () => {
    const open = homeConcentration(8, 290, p, base, day);
    const closed = homeConcentration(8, 290, p, { ...base, closeWindowsAtPeaks: true }, day);
    expect(closed).toBeLessThan(open);
  });

  it("a purifier only works during its running hours", () => {
    const withFilter = { ...base, purifierCadr: 250 };
    expect(homeConcentration(2, 270, p, withFilter, day)).toBeLessThan(
      homeConcentration(2, 270, p, base, day) / 3,
    );
    expect(homeConcentration(12, 160, p, withFilter, day)).toBeCloseTo(
      homeConcentration(12, 160, p, base, day),
    );
  });

  it("indoor sources add exposure and exhaust fans reduce it", () => {
    const biomass = { ...base, stove: "biomass" as const };
    const withHood = { ...biomass, cookingExhaust: true };
    expect(homeConcentration(19, 100, p, biomass, day)).toBeGreaterThan(
      homeConcentration(19, 100, p, withHood, day),
    );
  });

  it("is never above outdoors for a clean, filtered home", () => {
    const clean = { ...base, purifierCadr: 400, noIncense: true, stove: "induction" as const };
    for (let h = 0; h < 24; h++) expect(homeConcentration(h, 200, p, clean, day)).toBeLessThan(200);
  });
});

describe("schedules", () => {
  it("children go to school, adults commute, wfh adults stay home", () => {
    const [, rahul, aarav] = profile().members;
    expect(baseSchedule(aarav!, "car")[10]?.env).toBe("school");
    expect(baseSchedule(rahul!, "car")[8]?.env).toBe("commute");
    expect(baseSchedule(rahul!, "wfh").some((s) => s.env === "commute" || s.env === "work")).toBe(false);
  });

  it("moves outdoor time to the cleanest free daytime hour", () => {
    const dadi = profile().members[4]!;
    const shifted = shiftOutdoor(baseSchedule(dadi, "car"), day);
    expect(shifted[6]?.env).toBe("home");
    expect(shifted[14]?.env).toBe("outdoor");
  });

  it("leaves schedules without outdoor time untouched", () => {
    const priya = profile().members[0]!;
    const slots = baseSchedule(priya, "car");
    expect(shiftOutdoor(slots, day)).toBe(slots);
  });
});

describe("action catalogue", () => {
  it("defines every action with a formula and at least one source", () => {
    for (const id of ACTION_IDS) {
      expect(CATALOGUE[id].formula.length).toBeGreaterThan(5);
      expect(CATALOGUE[id].sources.length).toBeGreaterThan(0);
    }
  });

  it("offers a DIY filter only to homes without a purifier", () => {
    const ids = (p: ReturnType<typeof profile>) => applicableActions(p).map((a) => a.id);
    expect(ids(profile())).toContain("diy_fan_filter");
    const withPurifier = profile({ home: { ...profile().home, hasPurifier: true } });
    expect(ids(withPurifier)).toContain("run_purifier_night");
    expect(ids(withPurifier)).not.toContain("diy_fan_filter");
  });

  it("only offers burning advice to households that burn waste", () => {
    expect(CATALOGUE.no_open_burning.applies(profile())).toBe(false);
    expect(CATALOGUE.no_open_burning.applies(profile({ habits: { burnsLeavesOrWaste: true } }))).toBe(true);
  });
});

describe("evaluate", () => {
  const p = profile();

  it("every exposure action reduces the household dose", () => {
    for (const a of applicableActions(p).filter((x) => x.apply)) {
      expect(evaluateAction(p, day, a.id).exposureReductionPct).toBeGreaterThanOrEqual(0);
    }
    expect(evaluateAction(p, day, "diy_fan_filter").exposureReductionPct).toBeGreaterThan(10);
  });

  it("quantifies transit emissions from commute distance", () => {
    const impact = evaluateAction(p, day, "transit_commute");
    // 12 km × 2 × 5 days = 120 km; (0.15 − 0.025) kg/km
    expect(impact.co2KgWeek).toBeCloseTo(15, 1);
    expect(impact.pm25GWeek).toBeGreaterThan(0);
  });

  it("does not double count car-pool and transit", () => {
    const both = evaluatePlan(p, day, ["transit_commute", "carpool"]);
    const transit = evaluatePlan(p, day, ["transit_commute"]);
    expect(both.co2KgWeek).toBeCloseTo(transit.co2KgWeek, 1);
  });

  it("combined plan beats any single action and reports per-member doses", () => {
    const ranked = rankActions(p, day);
    const plan = evaluatePlan(
      p,
      day,
      ranked.slice(0, 5).map((a) => a.id),
    );
    expect(plan.exposureReductionPct).toBeGreaterThan(ranked[0]!.exposureReductionPct - 0.1);
    expect(plan.planDoseUg).toBeLessThan(plan.baselineDoseUg);
    expect(Object.keys(plan.byMember)).toHaveLength(p.members.length);
    expect(plan.cigarettesAvoidedPerDay).toBeGreaterThan(0);
  });

  it("ignores inapplicable and duplicate actions", () => {
    const plan = evaluatePlan(p, day, ["run_purifier_night", "close_windows_peaks", "close_windows_peaks"]);
    const single = evaluatePlan(p, day, ["close_windows_peaks"]);
    expect(plan).toEqual(single);
  });

  it("ranks by impact, highest first", () => {
    const ranked = rankActions(p, describeDay(next24ByLocalHour(air(), NOW)));
    expect(ranked.length).toBeGreaterThan(3);
    const scores = ranked.map((r) => r.exposureReductionPct * 2 + r.co2KgWeek * 0.5 + r.pm25GWeek * 0.5);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("baseline household dose is positive and per-member", () => {
    const dose = householdDose(p, baselineInterventions(p), day);
    expect(dose.total).toBeGreaterThan(0);
    expect(dose.byMember.aarav).toBeGreaterThan(0);
  });
});
