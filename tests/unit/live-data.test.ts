import { formatPlace, isGenericPlaceName, nearestSettlement, reverseGeocode } from "@/lib/air/place";
import { pollutantReadings, timesLabel, WHO_LIMIT } from "@/lib/air/pollutants";
import { getAirSnapshot } from "@/lib/air/service";
import type { AirSnapshot } from "@/lib/types";

const current: AirSnapshot["current"] = {
  aqi: 335,
  category: "very_poor",
  pm25: 166,
  pm10: 240,
  no2: 77,
  o3: 40,
  so2: 31,
  co: 2325,
  dominant: "pm25",
};

describe("live pollutant readings", () => {
  it("compares each pollutant with its WHO limit and sorts worst first", () => {
    const r = pollutantReadings(current);
    expect(r.map((x) => x.key)).toEqual(["pm25", "pm10", "no2", "so2", "co", "o3"]);
    expect(r[0]).toMatchObject({ name: "Fine particles (PM2.5)", value: 166, times: 11.1 });
    expect(r.find((x) => x.key === "co")).toMatchObject({ value: 2.3, unit: "mg/m³" });
    expect(WHO_LIMIT.pm25).toBe(15);
  });

  it("skips pollutants a provider does not report", () => {
    const r = pollutantReadings({ ...current, no2: null, so2: undefined, co: undefined });
    expect(r.map((x) => x.key)).toEqual(["pm25", "pm10", "o3"]);
  });

  it("explains the multiple in words", () => {
    expect(timesLabel(0.8)).toBe("At or below the WHO guideline");
    expect(timesLabel(1.4)).toBe("1.4× the WHO guideline");
    expect(timesLabel(11.1)).toBe("11× the WHO guideline");
  });
});

describe("place names", () => {
  it("recognises placeholder names", () => {
    expect(isGenericPlaceName("My location")).toBe(true);
    expect(isGenericPlaceName(" your location ")).toBe(true);
    expect(isGenericPlaceName("Lucknow")).toBe(false);
  });

  it("formats OpenStreetMap results without repeats", () => {
    expect(formatPlace({ address: { city: "New Delhi", state: "Delhi", country: "India" } })).toBe(
      "New Delhi, Delhi, India",
    );
    // A village or town wins over its district, so Bihta isn't shown as Patna.
    expect(
      formatPlace({
        address: {
          village: "Bihta",
          county: "Bihta",
          state_district: "Patna",
          state: "Bihar",
          country: "India",
        },
      }),
    ).toBe("Bihta, Patna, Bihar, India");
    expect(
      formatPlace({
        address: { suburb: "Gomti Nagar", city: "Lucknow", state: "Uttar Pradesh", country: "India" },
      }),
    ).toBe("Gomti Nagar, Lucknow, Uttar Pradesh, India");
    expect(formatPlace({ address: { town: "Delhi", state: "Delhi", country: "India" } })).toBe(
      "Delhi, India",
    );
    // The most local name leads, then its town: a colony in Bihta reads "Sikandarpur, Bihta, Patna…".
    expect(
      formatPlace({
        address: {
          neighbourhood: "Sikandarpur",
          village: "Bihta",
          state_district: "Patna",
          state: "Bihar",
          country: "India",
        },
      }),
    ).toBe("Sikandarpur, Bihta, Patna, Bihar, India");
    expect(
      formatPlace({
        address: {
          hamlet: "Amhara",
          county: "Bihta",
          state_district: "Patna",
          state: "Bihar",
          country: "India",
        },
      }),
    ).toBe("Amhara, Bihta, Patna, Bihar, India");
    expect(formatPlace({ address: {} })).toBeNull();
    expect(formatPlace("nope")).toBeNull();
  });

  it("reverse-geocodes once per area and survives failures", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ address: { city: "Pune", state: "Maharashtra", country: "India" } })),
    );
    expect(await reverseGeocode(18.52, 73.86, fetchImpl as typeof fetch)).toBe("Pune, Maharashtra, India");
    expect(await reverseGeocode(18.52, 73.86, fetchImpl as typeof fetch)).toBe("Pune, Maharashtra, India");
    // One Nominatim call and one Overpass call, then the cache answers.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // About 110 m precision, so the lookup names the right village rather than the next one over.
    const url = (fetchImpl.mock.calls as unknown as [string][])
      .map((c) => String(c[0]))
      .find((u) => u.includes("nominatim"))!;
    expect(url).toContain("lat=18.520");
    expect(url).toContain("zoom=16");
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await reverseGeocode(1.11, 2.22, failing as typeof fetch)).toBeNull();
    const notOk = vi.fn(async () => new Response("", { status: 503 }));
    expect(await reverseGeocode(3.33, 4.44, notOk as typeof fetch)).toBeNull();
  });

  it("trusts the nearest mapped settlement over an oversized village boundary (Bihta, not Bikram)", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("overpass")
        ? new Response(
            JSON.stringify({
              elements: [
                { lat: 25.523, lon: 84.871, tags: { name: "Shahwajpur" } },
                { lat: 25.56, lon: 84.87, tags: { name: "बिहटा", "name:en": "Bihta" } },
                { lat: 25.55, lon: 84.87 },
              ],
            }),
          )
        : new Response(
            JSON.stringify({
              address: {
                road: "Bihta- Kanpa road",
                village: "Bikram",
                county: "Bihta",
                state_district: "Patna",
                state: "Bihar",
                country: "India",
              },
            }),
          ),
    );
    expect(await reverseGeocode(25.546, 84.864, fetchImpl as typeof fetch)).toBe(
      "Bihta, Patna, Bihar, India",
    );
    // Without a nearby settlement the address is used as before, with the block kept for context.
    expect(
      formatPlace({
        address: { village: "Bikram", county: "Bihta", state_district: "Patna", state: "Bihar" },
      }),
    ).toBe("Bikram, Bihta, Patna, Bihar");
    expect(
      await nearestSettlement(1, 1, (async () => new Response("", { status: 504 })) as typeof fetch),
    ).toBeNull();
    expect(await nearestSettlement(1, 1, (async () => new Response("{}")) as typeof fetch)).toBeNull();
  });

  it("names shared GPS locations in the air snapshot", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("nominatim"))
        return new Response(
          JSON.stringify({ address: { city: "Kanpur", state: "Uttar Pradesh", country: "India" } }),
        );
      if (u.includes("air-quality")) {
        return new Response(
          JSON.stringify({
            utc_offset_seconds: 19800,
            current: {
              time: "2026-11-18T18:00",
              pm2_5: 100,
              pm10: 150,
              nitrogen_dioxide: 40,
              ozone: 20,
              sulphur_dioxide: 12,
              carbon_monoxide: 1500,
            },
            hourly: { time: ["2026-11-18T18:00"], pm2_5: [100], pm10: [150] },
          }),
        );
      }
      return new Response("{}", { status: 500 });
    });
    const snap = await getAirSnapshot(
      { lat: 26.45, lon: 80.33, name: "My location" },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(snap.location.name).toBe("Kanpur, Uttar Pradesh, India");
    expect(snap.current).toMatchObject({ so2: 12, co: 1500 });
  });
});

describe("one number for the current hour", () => {
  it("replaces the model value for this hour with the live reading", async () => {
    const { alignCurrentHour } = await import("@/lib/air/service");
    const snap = {
      location: { lat: 0, lon: 0, name: "x" },
      current: { ...current, pm25: 166, pm10: 182, aqi: 335 },
      hourly: [
        { time: "2026-11-18T12:00:00.000Z", pm25: 184, pm10: 200, aqi: 360 },
        { time: "2026-11-18T13:00:00.000Z", pm25: 190, pm10: 210, aqi: 370 },
      ],
      source: "open-meteo" as const,
      updatedAt: "2026-11-18T12:30:00.000Z",
      utcOffsetSeconds: 19800,
    };
    const out = alignCurrentHour(snap, new Date("2026-11-18T12:40:00Z"));
    expect(out.hourly[0]).toMatchObject({ pm25: 166, pm10: 182, aqi: 335 });
    expect(out.hourly[1]).toMatchObject({ pm25: 190 });
  });
});

describe("signed-in household", () => {
  it("shows the account holder instead of the sample family until they set up", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { setAccountOwner, useProfile } = await import("@/lib/profile/store");
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile.members).toHaveLength(5);
    act(() => setAccountOwner("Udit"));
    expect(result.current.isDemo).toBe(true);
    expect(result.current.profile.members.map((m) => m.name)).toEqual(["Udit"]);
    act(() => setAccountOwner(null));
    expect(result.current.profile.members).toHaveLength(5);
  });

  it("keeps the household's own names once saved, even when signed in", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { setAccountOwner, useProfile, profileStore } = await import("@/lib/profile/store");
    const { DEMO_PROFILE } = await import("@/lib/profile/schema");
    profileStore.write({ ...DEMO_PROFILE, members: [{ ...DEMO_PROFILE.members[0]!, name: "Raj" }] });
    const { result } = renderHook(() => useProfile());
    act(() => setAccountOwner("Udit"));
    expect(result.current.profile.members[0]?.name).toBe("Raj");
    act(() => setAccountOwner(null));
    profileStore.write(null);
  });
});
