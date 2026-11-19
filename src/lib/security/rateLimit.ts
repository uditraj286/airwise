/**
 * Fixed-window rate limiter keyed by client id. In-memory and per-instance: adequate for a single Cloud Run
 * container, and it protects the Gemini quota from abuse. Bounded so it cannot grow without limit.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  /** Returns whether the request is allowed and how long to wait if not. */
  check(key: string): { ok: boolean; retryAfterSec: number; remaining: number } {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (this.hits.size >= this.maxKeys) this.prune(t);
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      const ok = this.limit >= 1;
      return {
        ok,
        retryAfterSec: ok ? 0 : Math.ceil(this.windowMs / 1000),
        remaining: Math.max(0, this.limit - 1),
      };
    }
    entry.count += 1;
    const ok = entry.count <= this.limit;
    return {
      ok,
      retryAfterSec: ok ? 0 : Math.ceil((entry.resetAt - t) / 1000),
      remaining: Math.max(0, this.limit - entry.count),
    };
  }

  private prune(t: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}

/** Best-effort client identifier from proxy headers (Cloud Run sets X-Forwarded-For). */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip") || "anonymous";
}
