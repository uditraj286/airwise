import { buildContext, factsBlock } from "@/lib/ai/context";
import { backoff, geminiModels, getGemini } from "@/lib/ai/gemini";
import { PlainTextStream } from "@/lib/ai/plainText";
import { chatSystemPrompt, wrapUserQuestion } from "@/lib/ai/prompts";
import { CATALOGUE } from "@/lib/impact/catalogue";
import type { Profile } from "@/lib/profile/schema";
import type { AirSnapshot } from "@/lib/types";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/** Offline answer built from the same facts, used when Gemini is not configured or fails. */
export function ruleAnswer(profile: Profile, air: AirSnapshot, now: Date = new Date()): string {
  const ctx = buildContext(profile, air, now);
  const top = ctx.ranked
    .slice(0, 3)
    .map((a) => `• ${CATALOGUE[a.id].title} (≈${a.exposureReductionPct}% less exposure)`);
  return [
    `AQI is ${air.current.aqi} in ${profile.location.name} right now (PM2.5 ${air.current.pm25} µg/m³).`,
    `Best time to be outside today: ${ctx.bestWindow}. Avoid ${ctx.peakWindows}.`,
    "Most effective steps for your home:",
    ...top,
    "(AI assistant is offline — this answer comes from AirWise's built-in rules.)",
  ].join("\n");
}

/** Stream a grounded chat answer as plain-text chunks. */
export async function* streamChat(
  profile: Profile,
  air: AirSnapshot,
  history: ChatTurn[],
  message: string,
  now: Date = new Date(),
): AsyncGenerator<string> {
  const ai = getGemini();
  if (!ai) {
    yield ruleAnswer(profile, air, now);
    return;
  }
  const ctx = buildContext(profile, air, now);
  const contents = [
    { role: "user", parts: [{ text: `FACTS:\n${factsBlock(profile, air, ctx)}` }] },
    { role: "model", parts: [{ text: "Understood. I will answer using these facts." }] },
    ...history.slice(-6).map((t) => ({
      role: t.role === "user" ? "user" : "model",
      parts: [{ text: t.role === "user" ? wrapUserQuestion(t.text) : t.text }],
    })),
    { role: "user", parts: [{ text: wrapUserQuestion(message) }] },
  ];
  const models = geminiModels();
  for (const [i, model] of models.entries()) {
    if (i > 0 && models[i - 1] === model) await backoff(800);
    let produced = false;
    const plain = new PlainTextStream();
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: chatSystemPrompt(profile.language),
          temperature: 0.5,
          maxOutputTokens: 600,
        },
      });
      for await (const chunk of stream) {
        if (!chunk.text) continue;
        produced = true;
        const text = plain.push(chunk.text);
        if (text) yield text;
      }
      const rest = plain.flush();
      if (rest) yield rest;
      if (produced) return;
    } catch (err) {
      console.warn(`Gemini chat via ${model} failed:`, (err as Error).message.slice(0, 160));
      if (produced) {
        const rest = plain.flush();
        if (rest) yield rest;
        return; // partial answer already streamed; don't append a second one
      }
    }
  }
  yield ruleAnswer(profile, air, now);
}
