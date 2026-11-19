import { TtlCache } from "@/lib/air/cache";
import { RateLimiter, clientKey } from "@/lib/security/rateLimit";

describe("TtlCache", () => {
  it("expires entries after the TTL", () => {
    let t = 0;
    const cache = new TtlCache<number>(1000, 10, () => t);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    t = 1001;
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the least recently used entry when full", () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // a is now most recent
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.size).toBe(2);
  });

  it("overwrites existing keys without growing", () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.get("a")).toBe(2);
    expect(cache.size).toBe(1);
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit then blocks with Retry-After", () => {
    let t = 0;
    const rl = new RateLimiter(2, 60_000, () => t);
    expect(rl.check("ip").ok).toBe(true);
    expect(rl.check("ip").ok).toBe(true);
    const blocked = rl.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
    t = 60_001;
    expect(rl.check("ip").ok).toBe(true);
  });

  it("tracks clients independently and stays bounded", () => {
    const rl = new RateLimiter(1, 60_000, () => 0, 2);
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("b").ok).toBe(true);
    expect(rl.check("c").ok).toBe(true); // pruning path
    expect(rl.check("c").ok).toBe(false);
  });

  it("derives a client key from proxy headers", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientKey(new Headers())).toBe("anonymous");
  });
});
