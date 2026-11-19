import { classifyHours, dayOutlook, mergeWindows, slotLabel, upcoming } from "@/lib/air/dayWindows";
import { niceScale } from "@/lib/air/trends";
import type { AirSnapshot, HourlyPoint } from "@/lib/types";
import { air, IST, NOW } from "../fixtures";

describe("day windows", () => {
  const snap = air();
  const slots = classifyHours(upcoming(snap.hourly, NOW), IST, NOW);

  it("covers the next 24 hours starting now", () => {
    expect(slots).toHaveLength(24);
    expect(slots[0]?.isNow).toBe(true);
    expect(slotLabel(slots[0]!)).toBe("Now");
    expect(slotLabel(slots[3]!)).toBe("12 PM"); // sample hours start at :30 IST
  });

  it("marks the cleanest daytime hours best and the smoggiest avoid", () => {
    const best = slots.filter((s) => s.verdict === "best");
    expect(best.length).toBeGreaterThanOrEqual(2);
    expect(best.every((s) => s.hour >= 6 && s.hour <= 20)).toBe(true);
    const maxBest = Math.max(...best.map((s) => s.pm25));
    const avoid = slots.filter((s) => s.verdict === "avoid");
    expect(avoid.every((s) => s.pm25 >= maxBest)).toBe(true);
  });

  it("flags hours on the next calendar day", () => {
    expect(slots.find((s) => s.hour === 23)?.tomorrow).toBe(false);
    expect(slots.find((s) => s.hour === 2)?.tomorrow).toBe(true);
  });

  it("merges consecutive hours and labels tomorrow's windows", () => {
    const windows = mergeWindows(slots, "avoid");
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.some((w) => w.label.endsWith("tomorrow"))).toBe(true);
    expect(windows.every((w) => /AM|PM/.test(w.label))).toBe(true);
  });

  it("calls the best window 'least bad' when it is still unhealthy", () => {
    const outlook = dayOutlook(snap, NOW);
    expect(outlook.goOut?.safe).toBe(false); // Delhi sample: even the afternoon dip is Poor
    expect(outlook.summary).toMatch(/^Least bad time outside: .+\. Stay in: .+\.$/);
  });

  it("calls it a safe window on a clean day and never marks clean hours as avoid", () => {
    const clean: AirSnapshot = {
      ...snap,
      hourly: snap.hourly.map((p): HourlyPoint => ({
        ...p,
        pm25: p.pm25 / 10,
        pm10: p.pm10 / 10,
        aqi: Math.round(p.aqi / 8),
      })),
    };
    const outlook = dayOutlook(clean, NOW);
    expect(outlook.goOut?.safe).toBe(true);
    expect(outlook.stayIn).toHaveLength(0);
    expect(outlook.summary.startsWith("Go out:")).toBe(true);
  });

  it("handles missing data", () => {
    expect(dayOutlook({ ...snap, hourly: [] }, NOW)).toMatchObject({
      slots: [],
      goOut: null,
      stayIn: [],
      summary: "",
    });
  });
});

describe("niceScale", () => {
  it("uses round steps starting at zero", () => {
    expect(niceScale(166)).toEqual({ top: 200, ticks: [0, 50, 100, 150, 200] });
    expect(niceScale(78)).toEqual({ top: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(320).ticks.every((t) => t % 100 === 0)).toBe(true);
    expect(niceScale(0).top).toBeGreaterThan(0);
  });
});
