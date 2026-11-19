import { buildContext, factsBlock, type PlanContext } from "@/lib/ai/context";
import { defaultTime, rulePlan, slotFor, type Slot } from "@/lib/ai/fallback";
import { backoff, geminiModels, getGemini, withTimeout } from "@/lib/ai/gemini";
import { planSystemPrompt } from "@/lib/ai/prompts";
import { LlmPlanSchema, llmPlanJsonSchema, type LlmPlan } from "@/lib/ai/schemas";
import { CATALOGUE, type ActionId } from "@/lib/impact/catalogue";
import { evaluatePlan, type ActionImpact, type PlanImpact } from "@/lib/impact/evaluate";
import type { Profile } from "@/lib/profile/schema";
import type { AirSnapshot } from "@/lib/types";

export interface PlanItem {
  actionId: ActionId;
  time: string;
  title: string;
  why: string;
  forWhom: string[];
  /** Part of the day this action belongs to (for the timeline view). */
  slot: Slot;
  kind: "exposure" | "emission" | "both";
  how: string;
  formula: string;
  sources: string[];
  impact: ActionImpact;
}

export interface DailyPlan {
  headline: string;
  summary: string;
  healthNote: string;
  communityTip: string;
  items: PlanItem[];
  impact: PlanImpact;
  air: { aqi: number; pm25: number; bestWindow: string; peakWindows: string; location: string };
  source: "gemini" | "rules";
  /** Gemini model that wrote the plan, when source is "gemini". */
  model?: string;
  generatedAt: string;
}

/** Keep only actions the engine considers valid for this household, de-duplicated. */
export function sanitizePlan(plan: LlmPlan, ctx: PlanContext): LlmPlan {
  const allowed = new Set(ctx.ranked.map((a) => a.id));
  const seen = new Set<ActionId>();
  const items = plan.items.filter(
    (i) => allowed.has(i.actionId) && !seen.has(i.actionId) && seen.add(i.actionId),
  );
  return { ...plan, items };
}

async function askGemini(
  profile: Profile,
  air: AirSnapshot,
  ctx: PlanContext,
): Promise<{ plan: LlmPlan; model: string } | null> {
  const ai = getGemini();
  if (!ai) return null;
  const deadline = Date.now() + 20_000;
  const models = geminiModels();
  for (const [i, model] of models.entries()) {
    if (i > 0 && models[i - 1] === model) await backoff(800);
    const remaining = deadline - Date.now();
    if (remaining < 2_000) break;
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: `FACTS:\n${factsBlock(profile, air, ctx)}` }] }],
          config: {
            systemInstruction: planSystemPrompt(profile.language),
            responseMimeType: "application/json",
            responseJsonSchema: llmPlanJsonSchema,
            temperature: 0.4,
            maxOutputTokens: 1500,
          },
        }),
        Math.min(8_000, remaining),
      );
      const parsed = LlmPlanSchema.safeParse(JSON.parse(res.text ?? ""));
      if (parsed.success) {
        const clean = sanitizePlan(parsed.data, ctx);
        if (clean.items.length > 0) return { plan: clean, model };
      }
    } catch (err) {
      console.warn(`Gemini plan via ${model} failed:`, (err as Error).message.slice(0, 160));
    }
  }
  return null;
}

/** Assemble the final plan: Gemini wording (or rule fallback) + engine-computed impact for every item. */
export async function generatePlan(
  profile: Profile,
  air: AirSnapshot,
  now: Date = new Date(),
): Promise<DailyPlan> {
  const ctx = buildContext(profile, air, now);
  const llm = await askGemini(profile, air, ctx);
  const plan = llm?.plan ?? rulePlan(profile, air, ctx);
  const impactById = new Map(ctx.ranked.map((a) => [a.id, a]));

  const items: PlanItem[] = plan.items.flatMap((item) => {
    const impact = impactById.get(item.actionId);
    if (!impact) return [];
    const def = CATALOGUE[item.actionId];
    return [
      {
        ...item,
        time: defaultTime(item.actionId, ctx),
        slot: slotFor(item.actionId, ctx),
        kind: def.kind,
        how: def.how,
        formula: def.formula,
        sources: def.sources,
        impact,
      },
    ];
  });

  return {
    headline: plan.headline,
    summary: plan.summary,
    healthNote: plan.healthNote,
    communityTip: plan.communityTip,
    items,
    impact: evaluatePlan(
      profile,
      ctx.day,
      items.map((i) => i.actionId),
    ),
    air: {
      aqi: air.current.aqi,
      pm25: air.current.pm25,
      bestWindow: ctx.bestWindow,
      peakWindows: ctx.peakWindows,
      location: profile.location.name,
    },
    source: llm ? "gemini" : "rules",
    ...(llm ? { model: llm.model } : {}),
    generatedAt: now.toISOString(),
  };
}
