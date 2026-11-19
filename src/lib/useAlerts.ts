"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { dayOutlook } from "@/lib/air/dayWindows";
import { unseen, upcomingAlerts, type SmogAlert } from "@/lib/alerts";
import { useLiveAir } from "@/lib/airContext";
import { createStore, todayKey, useDoneActions, useProfile } from "@/lib/profile/store";
import { useCachedPlan } from "@/lib/usePlan";

const AlertPrefs = z.object({ enabled: z.boolean(), date: z.string(), seen: z.array(z.string()).max(50) });
type Prefs = z.infer<typeof AlertPrefs>;
export const alertStore = createStore<Prefs | null>("airwise.alerts.v1", AlertPrefs.nullable(), null);

export type Permission = NotificationPermission | "unsupported";
const readPermission = (): Permission =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;
const permissionListeners = new Set<() => void>();
const subscribePermission = (l: () => void): (() => void) => {
  permissionListeners.add(l);
  return () => permissionListeners.delete(l);
};

/** Turn on browser notifications. Returns the resulting permission. */
export async function enableAlerts(): Promise<Permission> {
  if (typeof Notification === "undefined") return "unsupported";
  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  const prev = alertStore.read();
  alertStore.write({
    enabled: permission === "granted",
    date: prev?.date ?? todayKey(),
    seen: prev?.seen ?? [],
  });
  permissionListeners.forEach((l) => l());
  return permission;
}

export function disableAlerts(): void {
  const prev = alertStore.read();
  alertStore.write({ enabled: false, date: prev?.date ?? todayKey(), seen: prev?.seen ?? [] });
}

/** Ticks once a minute so countdowns and alerts stay current. */
export function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Today's relevant alerts (shown in the bell menu) plus the notification preference. */
export function useAlerts(): {
  alerts: SmogAlert[];
  enabled: boolean;
  permission: Permission;
  enable: () => Promise<Permission>;
  disable: () => void;
} {
  const air = useLiveAir();
  const { profile } = useProfile();
  const plan = useCachedPlan(profile);
  const { done } = useDoneActions();
  const prefs = useSyncExternalStore(alertStore.subscribe, alertStore.read, () => null);
  // Server render and hydration assume "unsupported"; the real permission is read right after.
  const permission = useSyncExternalStore(
    subscribePermission,
    readPermission,
    () => "unsupported" as Permission,
  );
  const now = useMinute();

  const alerts = useMemo(() => {
    if (air.status !== "ready") return [];
    const steps = (plan?.items ?? []).map((i) => ({
      actionId: i.actionId,
      title: i.title,
      slot: i.slot ?? "anytime",
      time: i.time,
    }));
    return upcomingAlerts({ air: air.data, outlook: dayOutlook(air.data, now), steps, done, now });
  }, [air.status, air.data, plan, done, now]);

  const enable = useCallback(() => enableAlerts(), []);

  return {
    alerts,
    enabled: Boolean(prefs?.enabled) && permission === "granted",
    permission,
    enable,
    disable: disableAlerts,
  };
}

/** Sends each new alert once as a browser notification while AirWise is open. Render once, in the app shell. */
export function AlertsWatcher(): null {
  const { alerts, enabled } = useAlerts();
  const router = useRouter();
  useEffect(() => {
    if (!enabled || alerts.length === 0) return;
    const prefs = alertStore.read();
    const today = todayKey();
    const seen = prefs?.date === today ? prefs.seen : [];
    const fresh = unseen(alerts, seen);
    if (fresh.length === 0) return;
    for (const a of fresh) {
      try {
        const n = new Notification(a.title, { body: a.body, tag: a.key });
        n.onclick = () => {
          window.focus();
          if (a.kind === "step") router.push("/plan");
        };
      } catch {
        /* some browsers only allow notifications from a service worker; the bell menu still lists the alert */
      }
    }
    alertStore.write({ enabled: true, date: today, seen: [...seen, ...fresh.map((a) => a.key)].slice(-50) });
  }, [alerts, enabled, router]);
  return null;
}
