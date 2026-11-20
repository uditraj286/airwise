import { NextRequest } from "next/server";
import { profile } from "../fixtures";

process.env.AIRWISE_MOCK_DATA = "1";

const { GET: airGet } = await import("@/app/api/air/route");
const { POST: planPost } = await import("@/app/api/plan/route");
const { POST: chatPost } = await import("@/app/api/chat/route");
const { GET: geoGet } = await import("@/app/api/geocode/route");
const { GET: batchGet } = await import("@/app/api/air/batch/route");
const { GET: stationsGet } = await import("@/app/api/stations/route");

const json = (body: unknown, ip = "9.9.9.9") =>
  new Request("http://localhost/api/x", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": ip },
  });

describe("GET /api/air", () => {
  it("returns a snapshot for valid coordinates", async () => {
    const res = await airGet(
      new NextRequest("http://localhost/api/air?lat=28.6&lon=77.2&name=Delhi&tzOffsetMin=-330"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("mock");
    expect(body.utcOffsetSeconds).toBe(19800);
  });

  it("rejects invalid coordinates", async () => {
    const res = await airGet(new NextRequest("http://localhost/api/air?lat=999&lon=0"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/plan", () => {
  it("returns a plan with verified impact numbers", async () => {
    const res = await planPost(json({ profile: profile(), tzOffsetMin: -330 }, "1.1.1.1"));
    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.impact.exposureReductionPct).toBeGreaterThan(0);
  });

  it("rejects invalid bodies", async () => {
    const res = await planPost(json({ profile: { version: 2 } }, "1.1.1.2"));
    expect(res.status).toBe(400);
  });

  it("rate-limits bursts", async () => {
    let last = 200;
    for (let i = 0; i < 14; i++) last = (await planPost(json({ profile: profile() }, "7.7.7.7"))).status;
    expect(last).toBe(429);
  });
});

describe("POST /api/chat", () => {
  it("streams a text answer", async () => {
    const res = await chatPost(
      json({ profile: profile(), message: "Can kids play outside?", history: [] }, "2.2.2.2"),
    );
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain("Best time to be outside");
  });

  it("rejects empty questions", async () => {
    const res = await chatPost(json({ profile: profile(), message: "" }, "2.2.2.3"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/geocode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps geocoder results and caches them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              name: "Lucknow",
              latitude: 26.85,
              longitude: 80.95,
              admin1: "Uttar Pradesh",
              country: "India",
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await geoGet(new NextRequest("http://localhost/api/geocode?q=Lucknow"));
    expect(await res.json()).toEqual([{ name: "Lucknow, Uttar Pradesh, India", lat: 26.85, lon: 80.95 }]);
    await geoGet(new NextRequest("http://localhost/api/geocode?q=lucknow"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lists the same-named village nearest the family first, with its block", async () => {
    const village = (admin3: string, latitude: number, longitude: number) => ({
      name: "Raghopur",
      latitude,
      longitude,
      admin1: "Bihar",
      admin2: "Patna district",
      admin3,
      country: "India",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            village("Revelganj", 25.806, 84.634),
            village("Bikram", 25.462, 84.83),
            village("Bihta", 25.546, 84.864),
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await geoGet(new NextRequest("http://localhost/api/geocode?q=Raghopur&near=25.56,84.87"));
    const places = (await res.json()) as { name: string }[];
    expect(places[0]?.name).toBe("Raghopur, Bihta, Patna, Bihar, India");
    expect(places.map((p) => p.name)[2]).toContain("Revelganj");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("count=50");
    expect((await geoGet(new NextRequest("http://localhost/api/geocode?q=Raghopur&near=bad"))).status).toBe(
      400,
    );
  });

  it("returns 502 when the geocoder fails and 400 for short queries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    expect((await geoGet(new NextRequest("http://localhost/api/geocode?q=Nowhere"))).status).toBe(502);
    expect((await geoGet(new NextRequest("http://localhost/api/geocode?q=a"))).status).toBe(400);
  });
});

describe("GET /api/air/batch", () => {
  it("returns the AQI for several places in one request", async () => {
    const res = await batchGet(
      new NextRequest("http://localhost/api/air/batch?points=28.61,77.21;26.85,80.95&tzOffsetMin=-330"),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as { lat: number; lon: number; aqi: number; category: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ lat: 26.85, lon: 80.95 });
    expect(rows[0]!.aqi).toBeGreaterThan(0);
    expect(rows[0]!.category).toMatch(/good|satisfactory|moderate|poor|very_poor|severe/);
  });

  it("rejects bad points and more than five places", async () => {
    expect((await batchGet(new NextRequest("http://localhost/api/air/batch?points=999,1"))).status).toBe(400);
    expect((await batchGet(new NextRequest("http://localhost/api/air/batch?points=abc"))).status).toBe(400);
    expect(
      (await batchGet(new NextRequest("http://localhost/api/air/batch?points=1,1;2,2;3,3;4,4;5,5;6,6")))
        .status,
    ).toBe(400);
    expect((await batchGet(new NextRequest("http://localhost/api/air/batch"))).status).toBe(400);
  });
});

describe("GET /api/stations", () => {
  it("lists sample stations in mock mode and validates coordinates", async () => {
    const res = await stationsGet(new NextRequest("http://localhost/api/stations?lat=26.85&lon=80.95"));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBeGreaterThan(0);
    expect((await stationsGet(new NextRequest("http://localhost/api/stations?lat=91&lon=0"))).status).toBe(
      400,
    );
  });
});
