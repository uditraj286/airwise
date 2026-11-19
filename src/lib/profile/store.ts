"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { DEMO_PROFILE, ProfileSchema, type Profile } from "@/lib/profile/schema";
import type { DailyPlan } from "@/lib/ai/plan";

/**
 * Minimal localStorage-backed store with schema validation on read.
 * Everything personal stays on the device: the server only ever sees what a request needs.
 */
export function createStore<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return fallback;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (raw === null) {
      cachedValue = fallback;
      return fallback;
    }
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      cachedValue = parsed.success ? parsed.data : fallback;
    } catch {
      cachedValue = fallback;
    }
    return cachedValue;
  };

  const write = (value: T | null): void => {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable (private mode); state simply won't persist */
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent): void => {
      if (e.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { read, write, subscribe, fallback };
}

export const profileStore = createStore<Profile | null>("airwise.profile.v1", ProfileSchema.nullable(), null);

/**
 * Name of the signed-in account holder (set by cloud sync), or null for guests. Until they set up their household,
 * a signed-in user sees a starter household of just themselves instead of the sample family.
 */
let owner: string | null = null;
const ownerListeners = new Set<() => void>();
export function setAccountOwner(name: string | null): void {
  const next = name?.trim() ? name.trim().slice(0, 30) : null;
  if (next === owner) return;
  owner = next;
  ownerListeners.forEach((l) => l());
}
const subscribeOwner = (l: () => void): (() => void) => {
  ownerListeners.add(l);
  return () => ownerListeners.delete(l);
};
const readOwner = (): string | null => owner;

/** The built-in sample family, saved when someone picks "Try with a sample family". */
export const SAMPLE_PROFILE: Profile = { ...DEMO_PROFILE, sample: true };

/** Starter household for a signed-in user who hasn't personalised yet: just them, sample city and home. */
export function starterProfile(name: string): Profile {
  const me = ProfileSchema.shape.members.element.parse({
    id: "me",
    name,
    ageGroup: "adult",
    conditions: [],
    outdoorActivity: true,
  });
  return { ...DEMO_PROFILE, locationConfirmed: false, members: [me] };
}

/** The saved profile, or a sample household (named after the account holder when signed in) until they personalise. */
export function useProfile(): {
  profile: Profile;
  isDemo: boolean;
  save: (p: Profile) => void;
  reset: () => void;
} {
  const saved = useSyncExternalStore(profileStore.subscribe, profileStore.read, () => null);
  const name = useSyncExternalStore(subscribeOwner, readOwner, () => null);
  const demo = useMemo(() => (name ? starterProfile(name) : DEMO_PROFILE), [name]);
  const save = useCallback((p: Profile) => profileStore.write(ProfileSchema.parse(p)), []);
  const reset = useCallback(() => profileStore.write(null), []);
  // Once a household is saved, its names are the user's own choice and always win over the account name.
  const profile = saved ?? demo;
  return { profile, isDemo: saved === null, save, reset };
}

const DoneSchema = z.object({ date: z.string(), ids: z.array(z.string()).max(20) });
export const doneStore = createStore<z.infer<typeof DoneSchema> | null>(
  "airwise.done.v1",
  DoneSchema.nullable(),
  null,
);

const today = (): string => new Date().toISOString().slice(0, 10);

/** Which plan actions the family marked as done today. */
export function useDoneActions(): { done: string[]; toggle: (id: string) => void } {
  const state = useSyncExternalStore(doneStore.subscribe, doneStore.read, () => null);
  const done = useMemo(() => (state && state.date === today() ? state.ids : []), [state]);
  const toggle = useCallback(
    (id: string) => {
      const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
      doneStore.write({ date: today(), ids: next });
    },
    [done],
  );
  return { done, toggle };
}

/** Clear every AirWise key from this device. */
export function clearAllLocalData(): void {
  try {
    window.localStorage.removeItem("airwise.chat.v1");
  } catch {
    /* storage unavailable */
  }
  profileStore.write(null);
  doneStore.write(null);
  planStore.write(null);
}

const CachedPlanSchema = z.object({
  date: z.string(),
  fingerprint: z.string(),
  plan: z.custom<DailyPlan>(
    (v) => typeof v === "object" && v !== null && Array.isArray((v as { items?: unknown }).items),
  ),
});
export type CachedPlan = z.infer<typeof CachedPlanSchema>;

/** Today's generated plan, cached on-device so revisiting the page does not spend another AI call. */
export const planStore = createStore<CachedPlan | null>("airwise.plan.v1", CachedPlanSchema.nullable(), null);
export const todayKey = today;
