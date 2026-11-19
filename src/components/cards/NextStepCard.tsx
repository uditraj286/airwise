"use client";

import { Check, Clock } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { pillPrimary } from "@/components/ui/PageHeader";
import type { Slot } from "@/lib/ai/fallback";
import { SLOT_ORDER } from "@/lib/ai/fallback";
import type { DailyPlan } from "@/lib/ai/plan";

const slotOfHour = (h: number): Slot =>
  h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";

/** The undone step that fits best right now: this part of the day first, then all-day steps, then later today. */
export function nextStep(
  plan: DailyPlan,
  done: string[],
  localHour: number,
): DailyPlan["items"][number] | null {
  const todo = plan.items.filter((i) => !done.includes(i.actionId));
  const now = slotOfHour(localHour);
  const order = [now, "anytime", ...SLOT_ORDER.slice(SLOT_ORDER.indexOf(now) + 1), "this_week"] as Slot[];
  for (const slot of order) {
    const hit = todo.find((i) => (i.slot ?? "anytime") === slot);
    if (hit) return hit;
  }
  return todo[0] ?? null;
}

/** "Reminders" in the reference: the one thing to do next, with a big Mark done button. */
export function NextStepCard({
  plan,
  done,
  localHour,
  onDone,
}: {
  plan: DailyPlan | null;
  done: string[];
  localHour: number;
  onDone: (id: string) => void;
}) {
  const step = plan ? nextStep(plan, done, localHour) : null;
  return (
    <Card className="animate-in h-full flex flex-col">
      <h2 className="text-[20px] font-semibold tracking-tight">Next step</h2>
      {!plan ? (
        <>
          <p className="mt-4 flex-1 text-[15px] text-muted">
            Your plan for today isn&apos;t built yet. It takes about ten seconds.
          </p>
          <Link href="/plan" className={`${pillPrimary} mt-5 w-full py-3`}>
            Build today&apos;s plan
          </Link>
        </>
      ) : !step ? (
        <>
          <p className="mt-4 flex-1 text-[22px] font-semibold leading-snug text-brand">All done for today</p>
          <p className="text-label text-muted">Every step in today&apos;s plan is ticked off. Nice work.</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-[22px] font-semibold leading-snug text-brand">{step.title}</p>
          <p className="mt-2 flex items-center gap-1.5 text-label text-muted">
            <Clock className="h-4 w-4" aria-hidden="true" /> {step.time}
          </p>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onDone(step.actionId)}
            className={`${pillPrimary} mt-5 w-full py-3`}
          >
            <Check className="h-4 w-4" aria-hidden="true" /> Mark done
          </button>
        </>
      )}
    </Card>
  );
}
