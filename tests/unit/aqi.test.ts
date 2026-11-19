import { aqiCategory, computeAqi, pm10ToAqi, pm25ToAqi, timesWhoGuideline } from "@/lib/air/aqi";

describe("NAQI calculation", () => {
  it.each([
    [0, 0],
    [15, 25],
    [30, 50],
    [45, 75],
    [60, 100],
    [90, 200],
    [120, 300],
    [250, 400],
    [380, 500],
    [999, 500],
  ])("PM2.5 %d µg/m³ → AQI %d", (pm, aqi) => {
    expect(pm25ToAqi(pm)).toBe(aqi);
  });

  it("treats invalid input as zero", () => {
    expect(pm25ToAqi(Number.NaN)).toBe(0);
    expect(pm25ToAqi(-5)).toBe(0);
  });

  it("uses PM10 breakpoints", () => {
    expect(pm10ToAqi(100)).toBe(100);
    expect(pm10ToAqi(250)).toBe(200);
  });

  it("takes the worst sub-index and names the dominant pollutant", () => {
    expect(computeAqi(40, 400)).toEqual({ aqi: pm10ToAqi(400), dominant: "pm10" });
    expect(computeAqi(200, 100)).toEqual({ aqi: pm25ToAqi(200), dominant: "pm25" });
  });

  it.each([
    [50, "good"],
    [100, "satisfactory"],
    [200, "moderate"],
    [300, "poor"],
    [400, "very_poor"],
    [401, "severe"],
  ] as const)("AQI %d is %s", (aqi, cat) => {
    expect(aqiCategory(aqi)).toBe(cat);
  });

  it("expresses PM2.5 as a multiple of the WHO guideline", () => {
    expect(timesWhoGuideline(150)).toBe(10);
    expect(timesWhoGuideline(40.5)).toBe(2.7);
  });
});
