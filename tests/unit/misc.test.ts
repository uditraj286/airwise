import { sourcesFor } from "@/lib/air/sources";
import { HACKS, filterHacks } from "@/lib/hacks";
import { DEMO_PROFILE, ProfileSchema, memberRisk } from "@/lib/profile/schema";
import { enforceRateLimit, jsonError, readJson } from "@/lib/security/http";
import { RateLimiter } from "@/lib/security/rateLimit";
import { translate, categoryLabel } from "@/i18n/dict";

describe("profile schema", () => {
  it("accepts the demo profile", () => {
    expect(ProfileSchema.safeParse(DEMO_PROFILE).success).toBe(true);
  });

  it("strips markup from names", () => {
    const p = ProfileSchema.parse({
      ...DEMO_PROFILE,
      members: [{ ...DEMO_PROFILE.members[0], name: "<img src=x onerror=alert(1)>" }],
    });
    expect(p.members[0]?.name).not.toMatch(/[<>=()]/);
  });

  it("rejects out-of-range values", () => {
    expect(
      ProfileSchema.safeParse({ ...DEMO_PROFILE, location: { name: "x", lat: 200, lon: 0 } }).success,
    ).toBe(false);
    expect(ProfileSchema.safeParse({ ...DEMO_PROFILE, members: [] }).success).toBe(false);
  });

  it("classifies member risk", () => {
    const [priya, , aarav, meera] = DEMO_PROFILE.members;
    expect(memberRisk(aarav!)).toBe("high");
    expect(memberRisk(meera!)).toBe("elevated");
    expect(memberRisk(priya!)).toBe("standard");
  });
});

describe("pollution sources", () => {
  it("matches regions and always sums to 100%", () => {
    for (const city of ["New Delhi", "Lucknow", "Paris"]) {
      const s = sourcesFor(city);
      expect(s.shares.reduce((a, b) => a + b.pct, 0)).toBe(100);
    }
    expect(sourcesFor("Gurugram").region).toMatch(/Delhi/);
    expect(sourcesFor("Lahore").region).toMatch(/Indo-Gangetic/);
  });
});

describe("hacks library", () => {
  it("filters by category and query", () => {
    expect(filterHacks(HACKS, "myth", "").every((h) => h.category === "myth")).toBe(true);
    expect(filterHacks(HACKS, "all", "PURIFIER").length).toBeGreaterThan(0);
    expect(filterHacks(HACKS, "all", "zzz")).toHaveLength(0);
  });
});

describe("i18n", () => {
  it("translates keys and AQI categories", () => {
    expect(translate("hi", "nav_dashboard")).toBe("डैशबोर्ड");
    expect(categoryLabel("en", "very_poor")).toBe("Very Poor");
  });
});

describe("http helpers", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/x", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", host: "localhost", ...headers },
    });

  it("parses valid JSON", async () => {
    await expect(readJson(post('{"a":1}'))).resolves.toEqual({ ok: true, data: { a: 1 } });
  });

  it("rejects cross-origin, wrong type, oversized and malformed bodies", async () => {
    const cases: [Request, number][] = [
      [post("{}", { origin: "https://evil.example" }), 403],
      [
        new Request("http://localhost/api/x", {
          method: "POST",
          body: "{}",
          headers: { "content-type": "text/plain" },
        }),
        415,
      ],
      [post(JSON.stringify({ x: "a".repeat(20_000) })), 413],
      [post("{bad"), 400],
    ];
    for (const [req, status] of cases) {
      const res = await readJson(req);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.res.status).toBe(status);
    }
  });

  it("returns 429 with Retry-After when limited", () => {
    const rl = new RateLimiter(0, 1000);
    const res = enforceRateLimit(rl, new Request("http://localhost"));
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
  });

  it("builds no-store JSON errors", async () => {
    const res = jsonError(400, "nope");
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "nope" });
  });
});
