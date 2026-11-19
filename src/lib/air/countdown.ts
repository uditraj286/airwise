import type { DayOutlook } from "@/lib/air/dayWindows";
import { hourLabel } from "@/lib/air/time";

const HOUR = 3600_000;

export interface Countdown {
  /** "until": counting down to the next clean window; "during": inside it, counting down to its end. */
  mode: "until" | "during" | "none";
  targetMs: number;
  /** e.g. "Cleanest air starts at 1 PM tomorrow" or "Cleanest air now, until 4 PM". */
  label: string;
}

/** What the clean-air countdown should count towards, from today's hour verdicts. */
export function cleanAirCountdown(outlook: Pick<DayOutlook, "slots">, nowMs: number): Countdown {
  const slots = outlook.slots;
  const i = slots.findIndex((s) => s.verdict === "best" && Date.parse(s.time) + HOUR > nowMs);
  const first = slots[i];
  if (!first) return { mode: "none", targetMs: nowMs, label: "No clear window in the next 24 hours" };
  const start = Date.parse(first.time);
  if (start <= nowMs) {
    let j = i;
    while (slots[j + 1]?.verdict === "best") j += 1;
    const end = Date.parse(slots[j]!.time) + HOUR;
    return {
      mode: "during",
      targetMs: end,
      label: `Cleanest air now, until ${hourLabel((slots[j]!.hour + 1) % 24)}`,
    };
  }
  return {
    mode: "until",
    targetMs: start,
    label: `Cleanest air starts at ${hourLabel(first.hour)}${first.tomorrow ? " tomorrow" : ""}`,
  };
}

/** "01:24:08" */
export function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
