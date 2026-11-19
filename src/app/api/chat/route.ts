import { airDepsFromEnv } from "@/lib/air/deps";
import { getAirSnapshot } from "@/lib/air/service";
import { streamChat } from "@/lib/ai/chat";
import { ChatRequestSchema } from "@/lib/ai/schemas";
import { enforceRateLimit, jsonError, limiters, readJson, validationError } from "@/lib/security/http";

/** POST /api/chat { profile, message, history } → streamed text/plain answer. */
export async function POST(req: Request): Promise<Response> {
  const limited = enforceRateLimit(limiters.ai, req);
  if (limited) return limited;

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const parsed = ChatRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);
  const { profile, message, history, tzOffsetMin } = parsed.data;

  let air;
  try {
    air = await getAirSnapshot(profile.location, { ...airDepsFromEnv(tzOffsetMin), allowStale: true });
  } catch {
    return jsonError(502, "Air-quality data is temporarily unavailable.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamChat(profile, air, history, message)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
