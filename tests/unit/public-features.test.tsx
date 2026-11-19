import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { bestOuting } from "@/lib/air/activities";
import { stationRows, stationsNear } from "@/lib/air/stations";
import { forgetPlace, placesStore, rememberPlace, POPULAR_CITIES } from "@/lib/places";
import { complaintText, ReportPollution } from "@/components/ReportPollution";
import { LocationPicker } from "@/components/LocationPicker";
import { air, NOW } from "../fixtures";

afterEach(() => {
  localStorage.clear();
  placesStore.write([]);
  vi.unstubAllGlobals();
});

describe("saved places", () => {
  it("keeps newest first, de-duplicates by area and caps the list", () => {
    const a = { name: "Home", lat: 28.61, lon: 77.21 };
    rememberPlace(a);
    rememberPlace({ name: "School", lat: 28.7, lon: 77.1 });
    const list = rememberPlace({ name: "Home again", lat: 28.6101, lon: 77.2099 });
    expect(list.map((p) => p.name)).toEqual(["Home again", "School"]);
    for (const c of POPULAR_CITIES) rememberPlace(c);
    expect(placesStore.read()).toHaveLength(8);
    expect(forgetPlace(POPULAR_CITIES.at(-1)!)).toHaveLength(7);
  });
});

describe("stations near you", () => {
  const now = Date.parse("2026-11-18T14:40:00Z");
  const row = (
    station: string,
    latitude: number,
    longitude: number,
    aqi: number,
    updated = "2026-11-18 19:00",
  ) => ({ station, latitude, longitude, aqi, updated });
  it("lists fresh stations within 50 km, nearest first", () => {
    const here = { name: "", lat: 26.85, lon: 80.95 };
    const list = stationsNear(
      [
        row("Far", 27.5, 80.95, 300),
        row("Near", 26.86, 80.95, 150),
        row("Mid", 26.95, 80.95, 200),
        row("Old", 26.85, 80.96, 99, "2026-11-18 10:00"),
      ],
      here,
      now,
    );
    expect(list.map((s) => s.name)).toEqual(["Near", "Mid"]);
    expect(list[0]!.distanceKm).toBeLessThan(2);
  });

  it("skips the feed outside India and survives failures", async () => {
    expect(await stationRows({ name: "", lat: 51.5, lon: -0.1 })).toEqual([]);
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await stationRows({ name: "", lat: 26.85, lon: 80.95 }, true, failing as typeof fetch)).toEqual(
      [],
    );
    const ok = vi.fn(async () => new Response(JSON.stringify({ data: [row("A", 26.85, 80.95, 100)] })));
    expect(await stationRows({ name: "", lat: 26.85, lon: 80.95 }, true, ok as typeof fetch)).toHaveLength(1);
  });
});

describe("outing planner", () => {
  it("finds the cleanest daylight window of the asked length", () => {
    const two = bestOuting(air(), 2, NOW)!;
    expect(two.window).toMatch(/–/);
    expect(two.pm25).toBeGreaterThan(0);
    const three = bestOuting(air(), 3, NOW)!;
    expect(three.pm25).toBeGreaterThanOrEqual(two.pm25 - 1);
    expect(bestOuting(air(), 20, NOW)).toBeNull();
  });
});

describe("report pollution", () => {
  it("writes a specific, polite complaint", () => {
    const text = complaintText("burning", "Gomti Nagar, Lucknow", 212, new Date("2026-11-19T14:30:00Z"));
    expect(text).toContain("open burning of garbage");
    expect(text).toContain("Place: Gomti Nagar, Lucknow.");
    expect(text).toContain("already 212");
    expect(complaintText("dust", "X", null, new Date())).not.toContain("air quality index");
  });

  it("switches the issue and copies the message", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    render(<ReportPollution place="Patna" aqi={150} />);
    fireEvent.click(screen.getByLabelText("Smoky vehicle"));
    expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toContain(
      "thick visible smoke",
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy or share message/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText(/Copied/)).toBeInTheDocument();
  });
});

describe("location search", () => {
  it("suggests popular cities, searches as you type, and picks with the keyboard", async () => {
    const onChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify([{ name: "Lucknow, Uttar Pradesh, India", lat: 26.85, lon: 80.95 }])),
      ),
    );
    render(<LocationPicker onChange={onChange} />);
    const box = screen.getByRole("combobox");
    fireEvent.focus(box);
    expect(screen.getByRole("listbox", { name: "Suggested places" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mumbai/ })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "Luck" } });
    expect(await screen.findByRole("option", { name: /Lucknow/ })).toBeInTheDocument();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ name: "Lucknow, Uttar Pradesh, India", lat: 26.85, lon: 80.95 });
    expect(placesStore.read()[0]?.name).toBe("Lucknow, Uttar Pradesh, India");
    expect(screen.getByRole("status")).toHaveTextContent("Location set to Lucknow");
  });
});
