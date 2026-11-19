"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { cleanAirCountdown, formatHms } from "@/lib/air/countdown";
import type { DayOutlook } from "@/lib/air/dayWindows";
import { useAlerts } from "@/lib/useAlerts";

/** "Time Tracker" in the reference: a live countdown to the next clean-air window, with an alerts button. */
export function CountdownCard({ outlook }: { outlook: Pick<DayOutlook, "slots"> }) {
  const [now, setNow] = useState(() => Date.now());
  const { enabled, permission, enable } = useAlerts();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const c = cleanAirCountdown(outlook, now);
  const left = c.targetMs - now;
  // Recompute the target when the window passes (the next render picks the following window).
  return (
    <section
      className="card-dark animate-in flex h-full min-h-[220px] min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-card p-6"
      aria-label="Clean-air countdown"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight">
          {c.mode === "during" ? "Clean air now" : "Next clean air"}
        </h2>
        {permission !== "unsupported" && (
          <button
            type="button"
            onClick={() => void enable()}
            disabled={enabled || permission === "denied"}
            aria-label={enabled ? "Smog alerts are on" : "Turn on smog alerts"}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25 disabled:cursor-default"
          >
            {enabled ? (
              <BellRing className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {c.mode === "none" ? (
        <p className="text-[22px] font-semibold">{c.label}</p>
      ) : (
        <div>
          <p
            className="whitespace-nowrap text-[44px] font-semibold leading-none tracking-tight tabular-nums xl:text-[min(48px,calc((100vw-380px)/22))]"
            aria-hidden="true"
          >
            {formatHms(left)}
          </p>
          <p className="sr-only">{`${c.label}. ${Math.round(left / 60000)} minutes ${c.mode === "during" ? "left" : "to go"}.`}</p>
        </div>
      )}
      <p className="text-label text-white/80">
        {c.mode === "none" ? "Keep windows shut and use a purifier if you have one." : c.label}
      </p>
    </section>
  );
}
