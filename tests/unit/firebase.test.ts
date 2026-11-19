import { buildContext } from "@/lib/ai/context";
import { generatePlan } from "@/lib/ai/plan";
import { describeDispersion, fetchWeather, parseWeather, weatherUrl } from "@/lib/air/weather";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { buildDayRecord, daysAgo, summariseWeek } from "@/lib/firebase/dayRecord";
import { DayRecordSchema, cityKey } from "@/lib/firebase/repo";
import { air, NOW, profile } from "../fixtures";

describe("weather (real-world dispersion context)", () => {
  it("classifies calm cold air as trapping smog", () => {
    expect(describeDispersion({ windKmh: 3, tempC: 10, humidity: 80 })).toBe("trapped");
    expect(describeDispersion({ windKmh: 9, tempC: 10, humidity: 80 })).toBe("slow");
    expect(describeDispersion({ windKmh: 20, tempC: 25, humidity: 40 })).toBe("dispersing");
  });

  it("parses Open-Meteo current weather", () => {
    const w = parseWeather({
      current: { temperature_2m: 11.6, relative_humidity_2m: 82.2, wind_speed_10m: 4.4 },
    });
    expect(w).toEqual({ tempC: 12, humidity: 82, windKmh: 4, dispersion: "trapped" });
    expect(weatherUrl(28.6, 77.2)).toContain("wind_speed_10m");
  });

  it("returns null instead of throwing on failure", async () => {
    await expect(
      fetchWeather(0, 0, vi.fn().mockResolvedValue(new Response("x", { status: 500 }))),
    ).resolves.toBeNull();
    await expect(fetchWeather(0, 0, vi.fn().mockRejectedValue(new Error("offline")))).resolves.toBeNull();
    await expect(fetchWeather(0, 0, vi.fn().mockResolvedValue(new Response("{}")))).resolves.toBeNull();
  });

  it("feeds weather into the Gemini facts", async () => {
    const { factsBlock } = await import("@/lib/ai/context");
    const facts = factsBlock(profile(), air(), buildContext(profile(), air(), NOW));
    expect(facts).toContain("WEATHER NOW: 12°C, wind 4 km/h");
  });
});

describe("firebase config", () => {
  it("is off unless all required keys exist", () => {
    expect(isFirebaseConfigured({})).toBe(false);
    expect(isFirebaseConfigured({ apiKey: "a", authDomain: "b", projectId: "c", appId: "d" })).toBe(true);
    expect(isFirebaseConfigured({ apiKey: "a", authDomain: "b", projectId: "c" })).toBe(false);
  });
});

describe("cityKey", () => {
  it("normalises place names so neighbours share a key", () => {
    expect(cityKey("New Delhi, Delhi, India")).toBe("new-delhi");
    expect(cityKey("  Lucknow ")).toBe("lucknow");
    expect(cityKey("Ulaanbaatar City")).toBe("ulaanbaatar-city");
    expect(cityKey(",,,")).toBe("unknown");
    expect(cityKey("x".repeat(100))).toHaveLength(60);
  });
});

describe("day log", () => {
  it("records plan + progress and credits a day of weekly savings", async () => {
    const plan = await generatePlan(profile(), air(), NOW);
    const emission = plan.items.find((i) => i.impact.co2KgWeek > 0)!;
    const rec = buildDayRecord("2026-11-18", plan, [emission.actionId, "not-in-plan"]);
    expect(DayRecordSchema.safeParse(rec).success).toBe(true);
    expect(rec.doneIds).toEqual([emission.actionId]);
    expect(rec.co2KgDone).toBeCloseTo(emission.impact.co2KgWeek / 7, 1);
    expect(rec.planIds).toHaveLength(plan.items.length);
  });

  it("summarises a week", () => {
    const base = { city: "Delhi", aqi: 300, planIds: ["a", "b"], plannedExposurePct: 40, pm25GDone: 0 };
    const week = summariseWeek([
      { ...base, date: "2026-11-17", doneIds: ["a"], co2KgDone: 2.14 },
      { ...base, date: "2026-11-18", doneIds: ["a", "b"], co2KgDone: 2.14 },
      { ...base, date: "2026-11-16", doneIds: [], co2KgDone: 0 },
    ]);
    expect(week).toEqual({ actionsDone: 3, daysOnPlan: 2, co2KgAvoided: 4.3 });
  });

  it("computes date offsets across month boundaries", () => {
    expect(daysAgo("2026-12-03", 6)).toBe("2026-11-27");
  });
});
