import { CalendarRange, Check, Moon, Plus, Sun, Sunrise, Sunset, Timer } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Slot } from "@/lib/ai/fallback";
import type { DailyPlan } from "@/lib/ai/plan";

const ICON: Record<Slot, typeof Sun> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
  anytime: Timer,
  this_week: CalendarRange,
};
const TINT: Record<Slot, string> = {
  morning: "bg-amber/15 text-amber",
  afternoon: "bg-warn/10 text-warn",
  evening: "bg-brand/10 text-brand",
  night: "bg-ink/10 text-ink",
  anytime: "bg-good/10 text-good",
  this_week: "bg-brand-strong/10 text-brand-strong",
};

/** "Project" list in the reference: today's plan steps with their time. */
export function PlanListCard({ plan, done }: { plan: DailyPlan | null; done: string[] }) {
  return (
    <Card className="animate-in h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight">Today&apos;s plan</h2>
        <Link
          href="/plan"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/70 px-3.5 py-1.5 text-label font-medium hover:bg-subtle"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Open
        </Link>
      </div>
      {!plan ? (
        <p className="mt-4 text-label text-muted">
          Open the plan to build today&apos;s steps from the live air and your household.
        </p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {plan.items.slice(0, 5).map((item) => {
            const slot = item.slot ?? "anytime";
            const Icon = ICON[slot];
            const isDone = done.includes(item.actionId);
            return (
              <li key={item.actionId} className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isDone ? "bg-good/15 text-good" : TINT[slot]}`}
                >
                  {isDone ? (
                    <Check className="h-[18px] w-[18px]" aria-label="Done" />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[15px] font-medium ${isDone ? "text-muted line-through" : ""}`}
                  >
                    {item.title}
                  </span>
                  <span className="block truncate text-caption text-muted">{item.time}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
