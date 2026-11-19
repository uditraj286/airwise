import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null | undefined;

/** Lazily created Gemini client; `null` when no key is configured (the app then uses rule-based fallbacks). */
export function getGemini(): GoogleGenAI | null {
  if (client !== undefined) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  client = apiKey && process.env.AIRWISE_MOCK_DATA !== "1" ? new GoogleGenAI({ apiKey }) : null;
  return client;
}

/** Tried in order after GEMINI_MODEL when a model is overloaded (503) or retired (404). */
export const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"] as const;

export const geminiModel = (): string => process.env.GEMINI_MODEL || FALLBACK_MODELS[0];

/**
 * Attempt order: the primary model twice (overload spikes are usually momentary), then the other fallbacks.
 */
export function geminiModels(): string[] {
  const primary = geminiModel();
  return [primary, primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

/** Brief pause before retrying the same model after an overload error. */
export const backoff = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Reject after `ms` so a slow model never blocks the UI; callers fall back to rules. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
