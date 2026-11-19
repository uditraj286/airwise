import { spellOutUnits } from "@/lib/units";

describe("spellOutUnits", () => {
  it("expands measurement abbreviations in generated advice", () => {
    expect(spellOutUnits("78 µg/m³, 0.6mg/m3, 250 m³/h, 30°C, 12 km/h, and 7 μg")).toBe(
      "78 micrograms per cubic metre, 0.6 milligrams per cubic metre, 250 cubic metres per hour, 30 degrees Celsius, 12 kilometres per hour, and 7 micrograms",
    );
  });
});
