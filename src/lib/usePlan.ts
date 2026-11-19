"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DailyPlan } from "@/lib/ai/plan";
import type { Profile } from "@/lib/profile/schema";
import { doneStore, planStore, todayKey } from "@/lib/profile/store";

/** Plans are reused for the same day and the same household settings. */
const PLAN_REFRESH_MS = 60 * 60_000;
const fingerprint = (p: Profile): string => JSON.stringify(p);

/** Today's cached plan for exactly this profile, or null. Never triggers a network call. */
export function useCachedPlan(profile: Profile): DailyPlan | null {
  const cached = useSyncExternalStore(planStore.subscribe, planStore.read, () => null);
  return cached && cached.date === todayKey() && cached.fingerprint === fingerprint(profile)
    ? cached.plan
    : null;
}

type Request = { status: "idle" } | { status: "loading" } | { status: "error"; error: string };
export type PlanState = Request | { status: "ready"; plan: DailyPlan };

/** Today's plan: served from cache, otherwise generated via POST /api/plan (automatically when `auto`). */
export function usePlan(
  profile: Profile,
  { auto = false } = {},
): PlanState & { generate: () => Promise<void> } {
  const cached = useCachedPlan(profile);
  const [request, setRequest] = useState<Request>({ status: "idle" });

  const inFlight = useRef(false);
  // Bumped whenever a request settles, so the auto-run effect re-checks: if the household changed while the
  // request was in flight (e.g. cloud sync), the plan we just saved is for the old settings and we fetch again.
  const [settled, setSettled] = useState(0);

  /** Network round-trip; only touches React state after the request settles. */
  const run = useCallback(
    async ({ fresh = false }: { fresh?: boolean } = {}) => {
      inFlight.current = true;
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, tzOffsetMin: new Date().getTimezoneOffset() }),
        });
        const body: unknown = await res.json();
        if (!res.ok) throw new Error((body as { error?: string }).error ?? "Request failed");
        const previous = planStore.read();
        const householdChanged = Boolean(
          previous && previous.date === todayKey() && previous.fingerprint !== fingerprint(profile),
        );
        planStore.write({ date: todayKey(), fingerprint: fingerprint(profile), plan: body as DailyPlan });
        // A new plan starts with nothing ticked: when the user asks for one, or the household changed. The hourly
        // background refresh of the same household's plan keeps today's ticks.
        if (fresh || householdChanged) doneStore.write(null);
        setRequest({ status: "idle" });
      } catch (err) {
        setRequest({ status: "error", error: (err as Error).message });
      } finally {
        inFlight.current = false;
        setSettled((n) => n + 1);
      }
    },
    [profile],
  );

  /** User-initiated (re)generation. */
  const generate = useCallback(async () => {
    setRequest({ status: "loading" });
    await run({ fresh: true });
  }, [run]);

  const generatedAt = cached?.generatedAt;
  useEffect(() => {
    if (!auto || !generatedAt) return;
    const expiry = Date.parse(generatedAt) + PLAN_REFRESH_MS;
    if (!Number.isFinite(expiry)) return;
    const refresh = (): void => {
      if (document.visibilityState === "visible" && Date.now() >= expiry && !inFlight.current) void run();
    };
    const timer = setTimeout(refresh, Math.max(0, expiry - Date.now()));
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [auto, generatedAt, run]);

  const autoPending = auto && !cached && request.status === "idle";
  useEffect(() => {
    if (autoPending && !inFlight.current) void run();
  }, [autoPending, run, settled]);

  if (autoPending) return { status: "loading", generate };
  if (request.status !== "idle") return { ...request, generate };
  return cached ? { status: "ready", plan: cached, generate } : { status: "idle", generate };
}
