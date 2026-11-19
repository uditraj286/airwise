import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { RateLimiter, clientKey } from "@/lib/security/rateLimit";

const MAX_BODY_BYTES = 16 * 1024;

export const limiters = {
  // Per client per minute. The e2e suite runs dozens of dashboards from one address, so it raises this via env.
  air: new RateLimiter(Number(process.env.AIR_RATE_LIMIT_PER_MIN) || 60, 60_000),
  stations: new RateLimiter(30, 60_000),
  ai: new RateLimiter(12, 60_000),
};

/** JSON error with consistent shape; never leaks internals. */
export function jsonError(
  status: number,
  message: string,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...extraHeaders } },
  );
}

export function validationError(err: ZodError): NextResponse {
  const first = err.issues[0];
  return jsonError(
    400,
    `Invalid request${first ? `: ${first.path.join(".") || "body"} ${first.message}` : ""}`,
  );
}

/** Apply a rate limit; returns a 429 response when exceeded, otherwise null. */
export function enforceRateLimit(limiter: RateLimiter, req: Request): NextResponse | null {
  const { ok, retryAfterSec } = limiter.check(clientKey(req.headers));
  return ok
    ? null
    : jsonError(429, "Too many requests, please slow down.", { "Retry-After": String(retryAfterSec) });
}

/** Read a JSON body with a hard size cap and same-origin check. */
export async function readJson(
  req: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; res: NextResponse }> {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return { ok: false, res: jsonError(403, "Cross-origin requests are not allowed.") };
  }
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, res: jsonError(415, "Expected application/json.") };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, res: jsonError(413, "Request body too large.") };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, res: jsonError(400, "Malformed JSON.") };
  }
}
