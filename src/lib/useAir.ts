"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/profile/schema";
import type { AirSnapshot } from "@/lib/types";

type AirState =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: AirSnapshot; error?: undefined }
  | { status: "error"; data?: undefined; error: string };

/** How often the dashboard quietly pulls fresh readings (the upstream models update hourly). */
export const AIR_REFRESH_MS = 60_000;

/**
 * Fetch the air snapshot for the profile location; aborts on location change/unmount.
 * Keeps itself live: refreshes once a minute and when the tab comes back into view after that long,
 * without flashing a loading state (the old numbers stay until the new ones arrive).
 */
export function useAir(location: Profile["location"]): AirState & {
  retry: () => void;
  refreshing: boolean;
  refreshError?: string;
  checkedAt?: number;
  sameReading?: boolean;
} {
  const [attempt, setAttempt] = useState({ force: true });
  const [result, setResult] = useState<{
    key: string;
    state: AirState;
    request: typeof attempt;
    checkedAt?: number;
    refreshError?: string;
    sameReading?: boolean;
  }>();
  const { lat, lon, name } = location;
  const key = JSON.stringify([lat, lon]);
  const state: AirState = result?.key === key ? result.state : { status: "loading" };

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      name,
      tzOffsetMin: String(new Date().getTimezoneOffset()),
    });
    if (attempt.force) params.set("refresh", "1");
    fetch(`/api/air?${params}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const body: unknown = await res.json();
        if (!res.ok) throw new Error((body as { error?: string }).error ?? "Request failed");
        if (ctrl.signal.aborted) return;
        const data = body as AirSnapshot;
        const checkedAt = Date.now();
        setResult((previous) => {
          const old = previous?.key === key ? previous.state.data : undefined;
          return {
            key,
            request: attempt,
            checkedAt,
            sameReading: Boolean(
              attempt.force &&
              old &&
              old.source === data.source &&
              old.station?.name === data.station?.name &&
              (old.station?.updatedAt ?? old.updatedAt) === (data.station?.updatedAt ?? data.updatedAt),
            ),
            state: { status: "ready", data },
          };
        });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error = (err as Error).message;
        setResult((previous) =>
          previous?.key === key && previous.state.status === "ready"
            ? { ...previous, request: attempt, refreshError: error }
            : { key, request: attempt, state: { status: "error", error } },
        );
      });
    return () => ctrl.abort();
  }, [lat, lon, name, key, attempt]);

  useEffect(() => {
    let last = Date.now();
    const refresh = (): void => {
      last = Date.now();
      setAttempt({ force: false });
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, AIR_REFRESH_MS);
    const onVisible = (): void => {
      if (document.visibilityState === "visible" && Date.now() - last >= AIR_REFRESH_MS) refresh();
    };
    const onPageShow = (event: PageTransitionEvent): void => {
      if (!event.persisted) return;
      last = Date.now();
      setAttempt({ force: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [key]);

  return {
    ...state,
    refreshing: result?.key === key && result.request !== attempt,
    refreshError: result?.key === key ? result.refreshError : undefined,
    checkedAt: result?.key === key ? result.checkedAt : undefined,
    sameReading: result?.key === key ? result.sameReading : undefined,
    retry: () => setAttempt({ force: true }),
  };
}
