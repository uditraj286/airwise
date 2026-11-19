"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/lib/profile/schema";
import { useAir } from "@/lib/useAir";

type LiveAir = ReturnType<typeof useAir>;
const AirContext = createContext<LiveAir | null>(null);

/** One live air feed for the whole app (dashboard cards, alerts, share), so pages don't fetch it twice. */
export function AirProvider({ location, children }: { location: Profile["location"]; children: ReactNode }) {
  const air = useAir(location);
  return <AirContext.Provider value={air}>{children}</AirContext.Provider>;
}

export function useLiveAir(): LiveAir {
  const air = useContext(AirContext);
  if (!air) throw new Error("useLiveAir must be used inside <AirProvider>");
  return air;
}
