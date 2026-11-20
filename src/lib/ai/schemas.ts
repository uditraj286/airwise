import type { AqiCategory } from "@/lib/types";
import { z } from "zod";
import { ACTION_IDS } from "@/lib/impact/catalogue";
import { ProfileSchema } from "@/lib/profile/schema";

/** What Gemini must return for a daily plan. Numbers are deliberately absent: the impact engine owns them. */
export const LlmPlanSchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  items: z
    .array(
      z.object({
        actionId: z.enum(ACTION_IDS),
        time: z.string().min(1).max(40),
        title: z.string().min(1).max(100),
        why: z.string().min(1).max(280),
        forWhom: z.array(z.string().max(30)).max(8),
      }),
    )
    .min(1)
    .max(6),
  healthNote: z.string().min(1).max(300),
  communityTip: z.string().min(1).max(240),
});
export type LlmPlan = z.infer<typeof LlmPlanSchema>;

/** JSON Schema handed to Gemini's structured-output mode, generated from the same zod schema. */
export const llmPlanJsonSchema = z.toJSONSchema(LlmPlanSchema);

export const PlanRequestSchema = z.object({
  profile: ProfileSchema,
  tzOffsetMin: z.number().int().min(-840).max(840).default(0),
});

export const ChatRequestSchema = z.object({
  profile: ProfileSchema,
  tzOffsetMin: z.number().int().min(-840).max(840).default(0),
  message: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(10)
    .default([]),
});

export const AirQuerySchema = z.object({
  refresh: z.literal("1").optional(),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z.string().trim().max(80).optional().default("Your location"),
  tzOffsetMin: z.coerce.number().int().min(-840).max(840).default(0),
});

export const GeocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(60),
  /** Optional "lat,lon" (rounded) so same-named villages closest to the family come first. */
  near: z
    .string()
    .regex(/^-?\d{1,2}(\.\d{1,2})?,-?\d{1,3}(\.\d{1,2})?$/)
    .optional(),
});
export const ReverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** "lat,lon;lat,lon" with at most 5 points, each inside valid ranges. */
export const BatchQuerySchema = z.object({
  points: z
    .string()
    .max(200)
    .transform((s) => s.split(";").filter(Boolean))
    .pipe(
      z
        .array(
          z
            .string()
            .transform((p) => p.split(",").map(Number))
            .pipe(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])),
        )
        .min(1)
        .max(5),
    ),
  tzOffsetMin: z.coerce.number().int().min(-840).max(840).default(0),
});

export interface BatchReading {
  lat: number;
  lon: number;
  aqi: number | null;
  category: AqiCategory | null;
}
