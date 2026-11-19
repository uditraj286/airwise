import { z } from "zod";

/** Display names are free text: strip anything that is not a letter, digit, space, dot, apostrophe or hyphen. */
export const safeName = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform((s) => s.replace(/[^\p{L}\p{M}\p{N} .'-]/gu, "").trim() || "Member");

export const MemberSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/i),
  name: safeName,
  ageGroup: z.enum(["child", "adult", "senior"]),
  conditions: z
    .array(z.enum(["asthma", "heart", "copd", "pregnancy", "allergy"]))
    .max(5)
    .default([]),
  outdoorActivity: z.boolean().default(false),
});

export const ProfileSchema = z.object({
  version: z.literal(1),
  /** False until a signed-in user chooses a location. Older saved profiles already have one. */
  locationConfirmed: z.boolean().optional(),
  /** True only for the built-in sample family ("Try with a sample family"). */
  sample: z.boolean().optional(),
  location: z.object({
    name: z.string().trim().min(1).max(80),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  members: z.array(MemberSchema).min(1).max(8),
  home: z.object({
    bedroomVolumeM3: z.number().min(10).max(200).default(36),
    hasPurifier: z.boolean().default(false),
    purifierCadrM3h: z.number().min(0).max(1500).default(250),
    stove: z.enum(["lpg", "induction", "biomass", "kerosene"]).default("lpg"),
    usesIncenseOrCoils: z.boolean().default(false),
  }),
  commute: z.object({
    mode: z.enum(["car", "two_wheeler", "bus", "metro", "walk_cycle", "wfh"]).default("car"),
    oneWayKm: z.number().min(0).max(100).default(10),
    daysPerWeek: z.number().int().min(0).max(7).default(5),
  }),
  habits: z.object({
    burnsLeavesOrWaste: z.boolean().default(false),
  }),
  language: z.enum(["en", "hi"]).default("en"),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Member = z.infer<typeof MemberSchema>;

/** Demo household used until the user personalises — lets judges see value with zero setup. */
export const DEMO_PROFILE: Profile = {
  version: 1,
  location: { name: "New Delhi", lat: 28.6139, lon: 77.209 },
  members: [
    { id: "priya", name: "Priya", ageGroup: "adult", conditions: [], outdoorActivity: false },
    { id: "rahul", name: "Rahul", ageGroup: "adult", conditions: [], outdoorActivity: true },
    { id: "aarav", name: "Aarav", ageGroup: "child", conditions: ["asthma"], outdoorActivity: true },
    { id: "meera", name: "Meera", ageGroup: "child", conditions: [], outdoorActivity: true },
    { id: "dadi", name: "Dadi", ageGroup: "senior", conditions: ["heart"], outdoorActivity: true },
  ],
  home: {
    bedroomVolumeM3: 36,
    hasPurifier: false,
    purifierCadrM3h: 250,
    stove: "lpg",
    usesIncenseOrCoils: true,
  },
  commute: { mode: "car", oneWayKm: 12, daysPerWeek: 5 },
  habits: { burnsLeavesOrWaste: false },
  language: "en",
};

/** Risk tier for a member — drives badges and prompt emphasis. */
export function memberRisk(m: Member): "high" | "elevated" | "standard" {
  if (m.conditions.some((c) => c === "asthma" || c === "heart" || c === "copd" || c === "pregnancy"))
    return "high";
  if (m.ageGroup !== "adult" || m.conditions.length > 0) return "elevated";
  return "standard";
}
