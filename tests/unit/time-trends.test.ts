import { hourLabel, localHour, next24ByLocalHour, windowLabel } from "@/lib/air/time";
import { dailyAverages, nextHours, pastHours, pctChange, pointNear, shortHour } from "@/lib/air/trends";
import { air, IST, NOW } from "../fixtures";

describe("time helpers", () => {
  it("computes local hours across offsets", () => {
    expect(localHour("2026-11-18T04:30:00Z", IST)).toBe(10);
    expect(localHour("2026-11-18T23:00:00Z", -18000)).toBe(18);
  });

  it("formats hour labels and windows", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(15)).toBe("3 PM");
    expect(windowLabel(15, 2)).toBe("3–5 PM");
    expect(windowLabel(11, 2)).toBe("11 AM–1 PM");
  });

  it("produces a full 24-hour local day", () => {
    const day = next24ByLocalHour(air(), NOW);
    expect(day).toHaveLength(24);
    expect(day.every((v) => v > 0)).toBe(true);
    expect(day[14]).toBeLessThan(day[8] ?? 0);
  });

  it("fills gaps with the current reading", () => {
    const snap = { ...air(), hourly: [] };
    expect(new Set(next24ByLocalHour(snap, NOW))).toEqual(new Set([snap.current.pm25]));
  });
});

describe("trend helpers", () => {
  const snap = air();

  it("finds the point nearest a time, within tolerance", () => {
    expect(pointNear(snap.hourly, NOW.getTime() - 24 * 3600_000)).toBeDefined();
    expect(pointNear(snap.hourly, NOW.getTime() + 1000 * 3600_000)).toBeUndefined();
  });

  it("slices past and future windows", () => {
    const past = pastHours(snap.hourly, NOW, 12);
    const next = nextHours(snap.hourly, NOW, 12);
    expect(past).toHaveLength(12);
    expect(next).toHaveLength(12);
    expect(Date.parse(past.at(-1)!.time)).toBeLessThanOrEqual(NOW.getTime());
  });

  it("computes percent change", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(50, undefined)).toBeNull();
    expect(pctChange(50, 0)).toBeNull();
  });

  it("averages by local day and labels hours", () => {
    const days = dailyAverages(snap);
    expect(days.length).toBeGreaterThanOrEqual(3);
    expect(shortHour(snap.hourly[0]!, IST)).toMatch(/^\d{1,2}[AP]$/);
  });
});
