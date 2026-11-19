"use client";

import { StatCard } from "@/components/cards/StatCard";
import { ShareButton } from "@/components/ShareButton";
import { PageHeader, pillPrimary } from "@/components/ui/PageHeader";
import { spellOutUnits } from "@/lib/units";
import { Glossary } from "@/components/cards/Glossary";
import { Unit } from "@/components/ui/Unit";
import {
  CalendarRange,
  HeartPulse,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommunityCard } from "@/components/plan/CommunityCard";
import { PlanItemCard } from "@/components/plan/PlanItemCard";
import { Card } from "@/components/ui/Card";
import { PlanSkeleton } from "@/components/ui/Skeleton";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SLOT_ORDER, type Slot } from "@/lib/ai/fallback";
import type { DailyPlan, PlanItem } from "@/lib/ai/plan";
import { useDoneActions, useProfile } from "@/lib/profile/store";
import { usePlan } from "@/lib/usePlan";

const SLOT_META: Record<Slot, { title: string; hint: string; icon: LucideIcon }> = {
  morning: { title: "Morning", hint: "Before 12 PM", icon: Sunrise },
  afternoon: { title: "Afternoon", hint: "12–5 PM", icon: Sun },
  evening: { title: "Evening", hint: "5–9 PM", icon: Sunset },
  night: { title: "Tonight", hint: "9 PM → morning", icon: Moon },
  anytime: { title: "All day", hint: "Whenever it applies", icon: Timer },
  this_week: { title: "This week", hint: "Bigger swaps", icon: CalendarRange },
};

function MemberBars({ plan, names }: { plan: DailyPlan; names: Record<string, string> }) {
  const entries = Object.entries(plan.impact.byMember);
  const max = Math.max(...entries.map(([, v]) => v.baselineUg), 1);
  const fmt = new Intl.NumberFormat("en-IN");
  return (
    <Card className="animate-in">
      <h2 className="text-title">Estimated fine particles each person breathes in</h2>
      <p className="mt-1 text-label text-muted">
        A daily estimate based on local air and your household routine.
      </p>
      <ul className="mt-3 flex gap-4 text-caption text-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted/40" /> Without the plan
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" /> With the plan
        </li>
      </ul>
      <ul className="mt-4 space-y-4">
        {entries.map(([id, v]) => {
          const cut = v.baselineUg > 0 ? Math.round((1 - v.planUg / v.baselineUg) * 100) : 0;
          return (
            <li key={id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{names[id] ?? id}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {cut === 0
                    ? "No estimated change"
                    : `${Math.abs(cut)}% ${cut > 0 ? "less" : "more"} with the plan`}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-subtle" aria-hidden="true">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-muted/40"
                  style={{ width: `${(v.baselineUg / max) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-700 ease-standard"
                  style={{ width: `${(v.planUg / max) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-caption text-muted">
                With the plan {fmt.format(v.planUg)} <Unit kind="dose" /> · Without it{" "}
                {fmt.format(v.baselineUg)} <Unit kind="dose" />
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Group plan items into the parts of the day, in a fixed order. Old cached plans without a slot go to "All day". */
export function groupBySlot(items: PlanItem[]): { slot: Slot; items: PlanItem[] }[] {
  return SLOT_ORDER.map((slot) => ({
    slot,
    items: items.filter((i) => (i.slot ?? "anytime") === slot),
  })).filter((g) => g.items.length > 0);
}

/** Today's plan as a timeline, with verified impact numbers, per-person dose bars, health note and community card. */
export function PlanView() {
  const { profile } = useProfile();
  const state = usePlan(profile, { auto: true });
  const { done, toggle } = useDoneActions();
  const names = Object.fromEntries(profile.members.map((m) => [m.id, m.name]));

  const header = (actions?: React.ReactNode, subtitle?: string) => (
    <PageHeader
      title="Today's plan"
      subtitle={
        subtitle ??
        `Steps for your household in ${profile.location.name.split(",")[0]}, timed to the cleanest and smokiest hours.`
      }
      actions={actions}
    />
  );
  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="space-y-6">
        {header()}
        <PlanSkeleton message="Reading today's air and building your family's plan" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="space-y-6">
        {header()}
        <StatusPanel kind="error" message={state.error} onRetry={() => void state.generate()} />
      </div>
    );
  }

  const { plan } = state;
  const doneCount = done.filter((d) => plan.items.some((i) => i.actionId === d)).length;
  const groups = groupBySlot(plan.items);

  return (
    <div className="space-y-6">
      {header(
        <>
          <button type="button" onClick={() => void state.generate()} className={pillPrimary}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            New plan
          </button>
          <ShareButton />
        </>,
        spellOutUnits(plan.headline),
      )}
      <Card className="animate-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="flex items-center gap-1.5 text-caption text-muted">
              <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
              {plan.source === "gemini"
                ? `Written by Gemini for ${plan.air.location}`
                : `Built from today's data for ${plan.air.location}`}{" "}
              · numbers from AirWise&apos;s impact model
            </p>
            <p className="mt-2 text-[15px]">{spellOutUnits(plan.summary)}</p>
            {plan.generatedAt && (
              <p className="mt-2 text-caption text-muted">
                Plan updated{" "}
                <time dateTime={plan.generatedAt}>
                  {new Date(plan.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </time>
              </p>
            )}
            <p className="mt-3 flex flex-wrap gap-2 text-label">
              <span className="rounded-full bg-aqi-good/10 px-3 py-1">
                Lower particle levels: <strong className="font-medium">{plan.air.bestWindow}</strong>
              </span>
              <span className="rounded-full bg-aqi-very-poor/10 px-3 py-1">
                Stay in: <strong className="font-medium">{plan.air.peakWindows}</strong>
              </span>
            </p>
          </div>
        </div>
      </Card>

      <section aria-label="Plan impact" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          hero
          title="Less smoke breathed"
          value={Math.round(plan.impact.exposureReductionPct)}
          suffix="%"
          foot="Whole family, today"
        />
        <StatCard
          title="Cigarettes avoided"
          value={plan.impact.cigarettesAvoidedPerDay}
          decimals={1}
          foot="Today, in smoke breathed"
        />
        <StatCard
          title="CO₂ saved"
          value={plan.impact.co2KgWeek}
          decimals={1}
          unit="kilograms"
          foot="Each week, from your swaps"
        />
        <StatCard
          title="Smog not added"
          value={plan.impact.pm25GWeek}
          decimals={2}
          unit="grams"
          foot="Fine smoke (PM2.5) each week"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="actions-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="actions-title" className="text-title">
              Your day, step by step
            </h2>
            <p className="text-label text-muted" aria-live="polite">
              {doneCount} of {plan.items.length} done
            </p>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div
              className="h-full rounded-full bg-good transition-[width] duration-500 ease-standard"
              style={{ width: `${(doneCount / Math.max(1, plan.items.length)) * 100}%` }}
            />
          </div>

          <ol className="relative space-y-7 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-line">
            {groups.map(({ slot, items }) => {
              const meta = SLOT_META[slot];
              const Icon = meta.icon;
              return (
                <li key={slot} className="relative">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="relative z-[1] grid h-9 w-9 place-items-center rounded-xl border border-brand/20 bg-surface text-brand">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="text-label font-medium">
                      {meta.title} <span className="font-normal text-muted">· {meta.hint}</span>
                    </h3>
                  </div>
                  <ol className="space-y-3 pl-12">
                    {items.map((item) => (
                      <PlanItemCard
                        key={item.actionId}
                        item={item}
                        done={done.includes(item.actionId)}
                        onToggle={() => toggle(item.actionId)}
                      />
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-6">
          <MemberBars plan={plan} names={names} />
          <Card className="animate-in">
            <h2 className="flex items-center gap-2 text-title">
              <HeartPulse className="h-5 w-5 text-bad" aria-hidden="true" />
              Health watch
            </h2>
            <p className="mt-2 text-label">{spellOutUnits(plan.healthNote)}</p>
            <p className="mt-3 text-caption text-muted">General guidance, not medical advice.</p>
          </Card>
          <CommunityCard plan={plan} />
          <Glossary />
        </div>
      </div>
    </div>
  );
}
