"use client";

import { useCallback, useEffect, useState } from "react";
import { getFirebase } from "@/lib/firebase/client";
import { daysAgo, summariseWeek, type WeekSummary } from "@/lib/firebase/dayRecord";
import {
  cityKey,
  communityStats,
  loadDaysSince,
  loadPledge,
  removePledge,
  savePledge,
  type CommunityStats,
  type Pledge,
} from "@/lib/firebase/repo";
import { useCloudStatus } from "@/lib/firebase/sync";
import { todayKey } from "@/lib/profile/store";

/** Last 7 days of logged progress from Firestore; null while unavailable (local-only mode). */
export function useWeekSummary(refreshKey: string): WeekSummary | null {
  const cloud = useCloudStatus();
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const uid = cloud.state === "ready" ? cloud.uid : null;

  useEffect(() => {
    const fb = getFirebase();
    if (!fb || !uid) return;
    let cancelled = false;
    // small delay lets the latest day write land before reading
    const timer = setTimeout(() => {
      loadDaysSince(fb.db, uid, daysAgo(todayKey(), 6))
        .then((days) => !cancelled && setSummary(summariseWeek(days)))
        .catch(() => undefined);
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [uid, refreshKey]);

  return uid ? summary : null;
}

/** City-wide pledge totals plus this family's own pledge, with pledge/withdraw actions. */
export function useCommunity(locationName: string): {
  available: boolean;
  stats: CommunityStats | null;
  myPledge: Pledge | null;
  pledge: (actions: string[], co2KgWeek: number) => Promise<void>;
  withdraw: () => Promise<void>;
  busy: boolean;
} {
  const cloud = useCloudStatus();
  const uid = cloud.state === "ready" ? cloud.uid : null;
  const city = cityKey(locationName);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [myPledge, setMyPledge] = useState<Pledge | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb || !uid) return;
    let cancelled = false;
    Promise.all([communityStats(fb.db, city), loadPledge(fb.db, uid)])
      .then(([s, p]) => {
        if (cancelled) return;
        setStats(s);
        setMyPledge(p);
      })
      .catch((err: Error) => console.warn("Community stats unavailable:", err.message));
    return () => {
      cancelled = true;
    };
  }, [uid, city, version]);

  const pledge = useCallback(
    async (actions: string[], co2KgWeek: number) => {
      const fb = getFirebase();
      if (!fb || !uid) return;
      setBusy(true);
      try {
        await savePledge(fb.db, uid, { city, actions, co2KgWeek: Math.min(500, Math.max(0, co2KgWeek)) });
        setVersion((v) => v + 1);
      } finally {
        setBusy(false);
      }
    },
    [uid, city],
  );

  const withdraw = useCallback(async () => {
    const fb = getFirebase();
    if (!fb || !uid) return;
    setBusy(true);
    try {
      await removePledge(fb.db, uid);
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }, [uid]);

  return { available: Boolean(uid), stats, myPledge, pledge, withdraw, busy };
}
