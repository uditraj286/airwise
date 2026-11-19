import { mockSnapshot } from "@/lib/air/mock";
import { DEMO_PROFILE, type Profile } from "@/lib/profile/schema";

/** 10:00 IST on a fixed day, so every test sees the same air. */
export const NOW = new Date("2026-11-18T04:30:00.000Z");
export const IST = 19800;

export const air = () => mockSnapshot({ name: "New Delhi", lat: 28.61, lon: 77.21 }, NOW, IST);

export const profile = (overrides: Partial<Profile> = {}): Profile => ({
  ...structuredClone(DEMO_PROFILE),
  ...overrides,
});
