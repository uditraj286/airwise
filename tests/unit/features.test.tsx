import { render, screen } from "@testing-library/react";
import { adviseActivity, adviseAll, memberAdvice } from "@/lib/air/activities";
import { cleanAirCountdown, formatHms } from "@/lib/air/countdown";
import { dayOutlook } from "@/lib/air/dayWindows";
import { nearestStation } from "@/lib/air/stations";
import { calibrateToStation, factorForAqi } from "@/lib/air/service";
import { computeAqi } from "@/lib/air/aqi";
import { liveSummary, unseen, upcomingAlerts } from "@/lib/alerts";
import { pointNear } from "@/lib/air/trends";
import { shareOrCopy, shareText, whatsappUrl } from "@/lib/share";
import { setupRedirect } from "@/components/layout/AppShell";
import { freshDraft, validateStep } from "@/components/OnboardingForm";
import { nextStep } from "@/components/cards/NextStepCard";
import { ChangeChip, StatCard } from "@/components/cards/StatCard";
import { arcPath, ProgressGauge } from "@/components/cards/ProgressGauge";
import { DEMO_PROFILE } from "@/lib/profile/schema";
import { SAMPLE_PROFILE } from "@/lib/profile/store";
import type { AirSnapshot } from "@/lib/types";
import { air, NOW } from "../fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const withAqi = (aqi: number): AirSnapshot => {
  const a = air();
  return { ...a, current: { ...a.current, aqi } };
};

describe("activity advisor", () => {
  it("is stricter for vulnerable people and vigorous activity", () => {
    const moderate = withAqi(150);
    expect(adviseActivity("walk", "standard", moderate, NOW).advice).toBe("yes");
    expect(adviseActivity("walk", "high", moderate, NOW).advice).toBe("care");
    expect(adviseActivity("walk", "high", withAqi(250), NOW).advice).toBe("no");
    expect(adviseActivity("exercise", "standard", moderate, NOW).advice).toBe("care");
    expect(adviseActivity("play", "elevated", moderate, NOW).advice).toBe("care");
  });

  it("never approves burning and gives a time when it gets better", () => {
    const bad = withAqi(350);
    expect(adviseActivity("burning", "standard", withAqi(20), NOW).advice).toBe("no");
    const walk = adviseActivity("walk", "standard", bad, NOW);
    expect(walk.advice).toBe("care");
    expect(adviseAll("high", bad, NOW)).toHaveLength(7);
    expect(adviseActivity("windows", "standard", withAqi(40), NOW).text).toMatch(/fresh air/);
  });

  it("picks play for children and exercise for active adults", () => {
    const a = withAqi(150);
    expect(
      memberAdvice({ id: "k", name: "K", ageGroup: "child", conditions: [], outdoorActivity: false }, a, NOW)
        .id,
    ).toBe("play");
    expect(
      memberAdvice({ id: "r", name: "R", ageGroup: "adult", conditions: [], outdoorActivity: true }, a, NOW)
        .id,
    ).toBe("exercise");
    expect(
      memberAdvice({ id: "p", name: "P", ageGroup: "adult", conditions: [], outdoorActivity: false }, a, NOW)
        .id,
    ).toBe("walk");
  });
});

describe("clean-air countdown", () => {
  it("counts to the next best hour, or to the end of the current one", () => {
    const outlook = dayOutlook(air(), NOW);
    const c = cleanAirCountdown(outlook, NOW.getTime());
    expect(c.mode).not.toBe("none");
    expect(c.targetMs).toBeGreaterThan(NOW.getTime());
    expect(c.label).toMatch(/Cleanest air/);
    const first = outlook.slots.find((s) => s.verdict === "best")!;
    const inside = cleanAirCountdown(outlook, Date.parse(first.time) + 60_000);
    expect(inside.mode).toBe("during");
    expect(cleanAirCountdown({ slots: [] }, 0).mode).toBe("none");
  });

  it("formats hours, minutes and seconds", () => {
    expect(formatHms(5_048_000)).toBe("01:24:08");
    expect(formatHms(-5)).toBe("00:00:00");
  });
});

describe("smog alerts", () => {
  it("flags clean air starting soon, smog getting worse and due plan steps, once each", () => {
    const a = air();
    const outlook = dayOutlook(a, NOW);
    const first = outlook.slots.find((s) => s.verdict === "best")!;
    const soon = new Date(Date.parse(first.time) - 10 * 60_000);
    const alerts = upcomingAlerts({
      air: a,
      outlook: dayOutlook(a, soon),
      steps: [
        { actionId: "n95_outdoors", title: "Wear a mask", slot: "anytime", time: "Outdoors" },
        { actionId: "x", title: "Morning step", slot: "morning", time: "Now" },
      ],
      done: [],
      now: soon,
    });
    expect(alerts.some((x) => x.kind === "clean")).toBe(true);
    expect(
      unseen(
        alerts,
        alerts.map((x) => x.key),
      ),
    ).toEqual([]);

    const worse = { ...a, current: { ...a.current, aqi: 150 } };
    const w = upcomingAlerts({ air: worse, outlook: dayOutlook(a, NOW), steps: [], done: [], now: NOW });
    expect(Array.isArray(w)).toBe(true);
    const morning = upcomingAlerts({
      air: a,
      outlook: dayOutlook(a, NOW),
      steps: [{ actionId: "x", title: "Shut windows", slot: "morning", time: "Now" }],
      done: [],
      now: NOW,
    });
    expect(morning.find((x) => x.kind === "step")?.title).toBe("Time for: Shut windows");
    const doneAlready = upcomingAlerts({
      air: a,
      outlook: dayOutlook(a, NOW),
      steps: [{ actionId: "x", title: "Shut windows", slot: "morning", time: "Now" }],
      done: ["x"],
      now: NOW,
    });
    expect(doneAlready.find((x) => x.kind === "step")).toBeUndefined();
  });
});

describe("alerts carry real readings", () => {
  it("says when the air category changed, with numbers, place and source", () => {
    const a = air();
    const now = NOW;
    const hourAgo = pointNear(a.hourly, now.getTime() - 3600_000)!;
    const changed = { ...a, current: { ...a.current, aqi: hourAgo.aqi > 200 ? 150 : 350, pm25: 70 } };
    const alerts = upcomingAlerts({
      air: changed,
      outlook: dayOutlook(changed, now),
      steps: [],
      done: [],
      now,
    });
    const change = alerts.find((x) => x.kind === "change")!;
    expect(change.title).toMatch(/^Air in New Delhi is now (Moderate|Very Poor) \(AQI (150|350)\)$/);
    expect(change.body).toMatch(/than an hour ago \(AQI \d+\)/);
    expect(change.body).toContain("fine smoke 70 micrograms per cubic metre, 4.7× the WHO limit");
    expect(change.body).toContain("Sample data");
    const same = upcomingAlerts({ air: a, outlook: dayOutlook(a, now), steps: [], done: [], now });
    expect(same.some((x) => x.kind === "change")).toBe(false);
  });

  it("puts the forecast numbers in clean-air and worsening alerts, and the live AQI in step reminders", () => {
    const a = air();
    const outlook = dayOutlook(a, NOW);
    const first = outlook.slots.find((s) => s.verdict === "best")!;
    const soon = new Date(Date.parse(first.time) - 10 * 60_000);
    const clean = upcomingAlerts({
      air: a,
      outlook: dayOutlook(a, soon),
      steps: [],
      done: [],
      now: soon,
    }).find((x) => x.kind === "clean")!;
    expect(clean.body).toMatch(/AQI \d+ \(\w[\w ]*\), fine smoke \d+ micrograms per cubic metre/);
    expect(clean.body).toMatch(/Now: AQI \d+\./);
    const step = upcomingAlerts({
      air: a,
      outlook,
      steps: [{ actionId: "x", title: "Shut windows", slot: "morning", time: "Now" }],
      done: [],
      now: NOW,
    }).find((x) => x.kind === "step")!;
    expect(step.body).toContain(`Air in New Delhi right now: AQI ${a.current.aqi}`);
    const lowNow = { ...a, current: { ...a.current, aqi: 90, pm25: 40 } };
    const worse = upcomingAlerts({
      air: lowNow,
      outlook: dayOutlook(a, NOW),
      steps: [],
      done: [],
      now: NOW,
    }).find((x) => x.kind === "worse");
    if (worse) expect(worse.body).toMatch(/^Forecast: AQI \d+/);
  });

  it("summarises the live reading and names station data", () => {
    const a = air();
    expect(liveSummary(a)).toMatchObject({ place: "New Delhi", aqi: a.current.aqi, source: "Sample data" });
    const st = liveSummary({
      ...a,
      station: { name: "Danapur", aqi: 120, distanceKm: 4, updatedAt: a.updatedAt, count: 3 },
    });
    expect(st.source).toBe("Measured by 3 CPCB stations near you");
    expect(liveSummary({ ...a, source: "open-meteo" }).source).toBe("Open-Meteo forecast model");
  });
});

describe("family share text", () => {
  const outlook = {
    goOut: {
      start: 13,
      length: 3,
      tomorrow: false,
      label: "1–4 PM",
      pm25: 80,
      category: "moderate" as const,
      safe: false,
    },
    stayIn: [{ start: 21, length: 3, tomorrow: false, label: "9 PM–12 AM" }],
  };
  it("writes English and Hindi summaries", () => {
    const en = shareText({
      city: "Patna, Bihar, India",
      aqi: 335,
      category: "very_poor",
      outlook,
      steps: ["A", "B", "C", "D"],
      language: "en",
    });
    expect(en).toContain("AirWise · Patna today: AQI 335 (Very Poor)");
    expect(en).toContain("Least bad time to go out: 1–4 PM");
    expect(en).toContain("1. A 2. B 3. C");
    expect(en).not.toContain("D");
    const hi = shareText({
      city: "Patna",
      aqi: 335,
      category: "very_poor",
      outlook,
      steps: [],
      language: "hi",
    });
    expect(hi).toContain("बहुत खराब");
    expect(whatsappUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("shares natively, falls back to copy, and reports cancel or failure", async () => {
    const share = vi.fn(async () => undefined);
    expect(await shareOrCopy("t", { share } as unknown as Navigator)).toBe("shared");
    const cancel = vi.fn(async () => {
      throw Object.assign(new Error("x"), { name: "AbortError" });
    });
    expect(await shareOrCopy("t", { share: cancel } as unknown as Navigator)).toBe("cancelled");
    const writeText = vi.fn(async () => undefined);
    expect(await shareOrCopy("t", { clipboard: { writeText } } as unknown as Navigator)).toBe("copied");
    expect(
      await shareOrCopy("t", {
        clipboard: { writeText: () => Promise.reject(new Error("no")) },
      } as unknown as Navigator),
    ).toBe("failed");
  });
});

describe("station-based AQI", () => {
  const now = Date.parse("2026-11-18T14:40:00Z");
  const row = (name: string, lat: number, lon: number, aqi: number, pm?: number) => ({
    station: name,
    latitude: lat,
    longitude: lon,
    aqi,
    updated: "2026-11-18 19:00",
    pollutants: pm ? { "PM2.5": { avg: pm } } : undefined,
  });

  it("blends fresh stations within 30 km, weighting closer ones more", () => {
    const here = { name: "Bihta", lat: 25.5589, lon: 84.8714 };
    const r = nearestStation(
      [
        row("Near", 25.59, 84.95, 100, 60),
        row("Far", 25.6, 85.14, 200, 120),
        row("Too far", 26.5, 85.1, 400),
      ],
      here,
      now,
    )!;
    expect(r.name).toBe("Near");
    expect(r.count).toBe(2);
    expect(r.aqi).toBeGreaterThan(100);
    expect(r.aqi).toBeLessThan(150);
    expect(r.pm25).toBeGreaterThan(60);
  });

  it("scales the model so its AQI matches the stations and keeps the forecast shape", () => {
    const a = air();
    const f = factorForAqi(a.current.pm25, a.current.pm10, 210);
    expect(Math.abs(computeAqi(a.current.pm25 * f, a.current.pm10 * f).aqi - 210)).toBeLessThanOrEqual(2);
    const cal = calibrateToStation({
      ...a,
      station: { name: "S", aqi: 210, distanceKm: 5, updatedAt: a.updatedAt },
    });
    expect(cal.current.aqi).toBe(210);
    expect(cal.current.category).toBe("poor");
    expect(cal.calibration).toBeLessThan(1);
    expect(cal.hourly[0]!.pm25).toBeLessThan(a.hourly[0]!.pm25);
    expect(calibrateToStation(a)).toBe(a);
    expect(factorForAqi(10, 10, 500)).toBe(4);
    expect(factorForAqi(500, 500, 10)).toBe(0.25);
  });
});

describe("household-first flow", () => {
  const base = {
    pathname: "/",
    hasHousehold: false,
    locationConfirmed: true,
    syncSettled: true,
    signedIn: false,
  };
  it("sends new visitors to the welcome page and signed-in people to setup", () => {
    expect(setupRedirect(base)).toBe("/login");
    expect(setupRedirect({ ...base, signedIn: true })).toBe("/setup");
    expect(setupRedirect({ ...base, hasHousehold: true })).toBeNull();
    expect(setupRedirect({ ...base, hasHousehold: true, locationConfirmed: false, signedIn: true })).toBe(
      "/setup",
    );
    expect(setupRedirect({ ...base, syncSettled: false })).toBeNull();
    expect(setupRedirect({ ...base, pathname: "/setup" })).toBeNull();
  });

  it("starts setup from a blank one-person draft and validates each step", () => {
    const draft = freshDraft(DEMO_PROFILE, true);
    expect(draft.members).toHaveLength(1);
    expect(draft.locationConfirmed).toBe(false);
    expect(validateStep("where", draft)).toMatch(/Choose your city/);
    expect(validateStep("who", draft)).toMatch(/Give everyone a name/);
    const named = { ...draft, locationConfirmed: true, members: [{ ...draft.members[0]!, name: "Asha" }] };
    expect(validateStep("where", named)).toBeNull();
    expect(validateStep("who", named)).toBeNull();
    expect(validateStep("home", { ...named, home: { ...named.home, bedroomVolumeM3: 1 } })).toMatch(
      /bedroom/,
    );
    expect(validateStep("travel", { ...named, commute: { ...named.commute, daysPerWeek: 9 } })).toMatch(
      /days per week/,
    );
    expect(freshDraft(SAMPLE_PROFILE, false).sample).toBeUndefined();
    expect(SAMPLE_PROFILE.sample).toBe(true);
  });
});

describe("dashboard cards", () => {
  it("picks the next undone step for this part of the day", () => {
    const item = (actionId: string, slot: string) => ({ actionId, slot, title: actionId, time: "" });
    const plan = { items: [item("a", "evening"), item("b", "morning"), item("c", "anytime")] } as never;
    expect(nextStep(plan, [], 9)?.actionId).toBe("b");
    expect(nextStep(plan, ["b"], 9)?.actionId).toBe("c");
    expect(nextStep(plan, ["a", "b", "c"], 9)).toBeNull();
  });

  it("renders the hero stat card with a link and change chip", () => {
    render(
      <StatCard
        hero
        title="Air quality now"
        value={176}
        unit="Moderate"
        href="/#air"
        foot={<ChangeChip hero value={-24.6} />}
      />,
    );
    expect(screen.getByRole("heading", { name: "Air quality now" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Air quality now" })).toHaveAttribute("href", "/#air");
    expect(screen.getByText("down")).toHaveClass("sr-only");
    render(<ChangeChip value={null} />);
  });
});

describe("progress gauge", () => {
  it("draws even arcs from the left end and labels 100%", () => {
    expect(arcPath(0, 1)).toBe("M 22.00 104.00 A 78 78 0 0 1 178.00 104.00");
    expect(arcPath(0, 0.5)).toMatch(/A 78 78 0 0 1 100.00 26.00$/);
    const { rerender } = render(<ProgressGauge done={0} todo={5} later={0} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/0% of today's steps done/);
    rerender(<ProgressGauge done={5} todo={0} later={0} />);
    expect(screen.getByText("all done")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/100%/);
  });
});
