import { parseGoogle } from "@/lib/air/google";
import { localToUtcIso, openMeteoUrl, parseOpenMeteo, fetchOpenMeteo } from "@/lib/air/openMeteo";
import { cacheKey, getAirSnapshot } from "@/lib/air/service";

const loc = { name: "Delhi", lat: 28.61, lon: 77.21 };

const openMeteoPayload = {
  utc_offset_seconds: 19800,
  current: { time: "2026-11-18T10:00", pm2_5: 180, pm10: 290, nitrogen_dioxide: 60, ozone: 20 },
  hourly: {
    time: ["2026-11-18T09:00", "2026-11-18T10:00", "2026-11-18T11:00"],
    pm2_5: [200, 180, null],
    pm10: [320, 290, 250],
  },
};

describe("Open-Meteo provider", () => {
  it("builds a keyless URL with rounded coordinates", () => {
    const url = openMeteoUrl(28.61391, 77.20902);
    expect(url).toContain("latitude=28.614");
    expect(url).toContain("hourly=pm2_5%2Cpm10");
    expect(url).not.toContain("key");
  });

  it("converts local wall-clock times to UTC", () => {
    expect(localToUtcIso("2026-11-18T10:00", 19800)).toBe("2026-11-18T04:30:00.000Z");
  });

  it("normalises the payload and drops incomplete hours", () => {
    const snap = parseOpenMeteo(openMeteoPayload, loc);
    expect(snap.source).toBe("open-meteo");
    expect(snap.utcOffsetSeconds).toBe(19800);
    expect(snap.hourly).toHaveLength(2);
    expect(snap.current).toMatchObject({ pm25: 180, pm10: 290, category: "very_poor", dominant: "pm25" });
  });

  it("rejects malformed payloads", () => {
    expect(() => parseOpenMeteo({ nope: true }, loc)).toThrow();
  });

  it("fetches with an injected fetch and surfaces HTTP errors", async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify(openMeteoPayload)));
    await expect(fetchOpenMeteo(loc, ok)).resolves.toMatchObject({ source: "open-meteo" });
    const fail = vi.fn().mockResolvedValue(new Response("x", { status: 500 }));
    await expect(fetchOpenMeteo(loc, fail)).rejects.toThrow("500");
  });
});

describe("Google Air Quality provider", () => {
  const block = (dateTime: string, pm25: number, pm10: number) => ({
    dateTime,
    indexes: [
      { code: "uaqi", aqi: 30 },
      { code: "ind_cpcb", aqi: 158 },
    ],
    pollutants: [
      { code: "pm25", concentration: { value: pm25, units: "MICROGRAMS_PER_CUBIC_METER" } },
      { code: "pm10", concentration: { value: pm10 } },
      { code: "no2", concentration: { value: 40 } },
    ],
  });

  it("merges current + forecast into a snapshot", () => {
    const snap = parseGoogle(
      block("2026-11-18T04:00:00Z", 150, 250),
      { hourlyForecasts: [block("2026-11-18T05:00:00Z", 140, 230)] },
      loc,
      19800,
    );
    expect(snap.source).toBe("google");
    expect(snap.current.aqi).toBe(158);
    expect(snap.hourly.map(({ aqi }) => aqi)).toEqual([158, 158]);
    expect(snap.hourly).toHaveLength(2);
    expect(snap.current.no2).toBe(40);
    expect(snap.current.o3).toBeNull();
  });

  it("requires the India index even if a universal index is available", () => {
    const current = { ...block("2026-11-18T04:00:00Z", 150, 250), indexes: [{ code: "uaqi", aqi: 30 }] };
    expect(() => parseGoogle(current, {}, loc, 0)).toThrow(/missing India AQI/);
  });

  it("fails when PM data is missing", () => {
    expect(() => parseGoogle({ dateTime: "2026-11-18T04:00:00Z", pollutants: [] }, {}, loc, 0)).toThrow(
      /missing PM/,
    );
  });
});

describe("air service", () => {
  it("retains four decimal places for cache keys", () => {
    expect(cacheKey(28.61391, 77.20902)).toBe("28.6139,77.2090");
  });

  it("serves mock data when requested", async () => {
    const snap = await getAirSnapshot(loc, { mock: true });
    expect(snap.source).toBe("mock");
  });

  it("labels the last reading when a forced update fails for the same location", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(openMeteoPayload)));
    const where = { name: "Bihta", lat: 25.5589, lon: 84.8714 };
    const fresh = await getAirSnapshot(where, { fetchImpl });

    fetchImpl.mockImplementation(async () => new Response("", { status: 503 }));
    const stale = await getAirSnapshot(where, { fetchImpl, refresh: true, allowStale: true });
    expect(stale).toEqual({ ...fresh, stale: true });
    await expect(
      getAirSnapshot({ ...where, lat: 25.559 }, { fetchImpl, allowStale: true }),
    ).rejects.toThrow();
  });

  it("falls back to Open-Meteo when Google fails, then caches", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("googleapis")
        ? new Response("denied", { status: 403 })
        : new Response(JSON.stringify(openMeteoPayload)),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const where = { name: "Test", lat: 10.123, lon: 20.456 };
    const first = await getAirSnapshot(where, { googleKey: "k", fetchImpl: fetchImpl as typeof fetch });
    expect(first.source).toBe("open-meteo");
    const calls = fetchImpl.mock.calls.length;
    await getAirSnapshot(where, { googleKey: "k", fetchImpl: fetchImpl as typeof fetch });
    expect(fetchImpl.mock.calls.length).toBe(calls);
    warn.mockRestore();
  });
});

describe("nearby monitoring stations", () => {
  it("selects the nearest fresh reading and skips invalid, stale and distant stations", async () => {
    const { nearestStation } = await import("@/lib/air/stations");
    const bihta = { name: "Bihta", lat: 25.5589, lon: 84.8714 };
    const danapur = {
      station: "Danapur",
      latitude: 25.586562,
      longitude: 85.043586,
      aqi: 227,
      updated: "2026-11-18 19:00",
    };
    const now = Date.parse("2026-11-18T14:40:00Z");
    expect(
      nearestStation(
        [
          { ...danapur, longitude: 86 },
          { ...danapur, longitude: 84.88, updated: "2026-11-18 16:00" },
          { ...danapur, longitude: 84.89, aqi: null },
          danapur,
        ],
        bihta,
        now,
      ),
    ).toMatchObject({ name: "Danapur", aqi: 227, updatedAt: "2026-11-18T13:30:00.000Z" });
    expect(nearestStation([danapur], bihta, now + 3600_000)).toBeUndefined();
  });
});
