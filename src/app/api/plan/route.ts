import { NextResponse } from "next/server";
import { airDepsFromEnv } from "@/lib/air/deps";
import { getAirSnapshot } from "@/lib/air/service";
import { generatePlan } from "@/lib/ai/plan";
import { PlanRequestSchema } from "@/lib/ai/schemas";
import { enforceRateLimit, jsonError, limiters, readJson, validationError } from "@/lib/security/http";

/** POST /api/plan { profile, tzOffsetMin } → DailyPlan (Gemini wording + engine-computed impact). */
export async function POST(req: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(limiters.ai, req);
  if (limited) return limited;

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const parsed = PlanRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);
  const { profile, tzOffsetMin } = parsed.data;

  try {
    const air = await getAirSnapshot(profile.location, { ...airDepsFromEnv(tzOffsetMin), allowStale: true });
    const plan = await generatePlan(profile, air);
    return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Plan generation failed:", (err as Error).message);
    return jsonError(502, "Could not build a plan right now. Please try again.");
  }
}
