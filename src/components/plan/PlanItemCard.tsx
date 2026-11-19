"use client";

import { spellOutUnits } from "@/lib/units";
import { Unit } from "@/components/ui/Unit";
import { Check, Clock, Info } from "lucide-react";
import type { PlanItem } from "@/lib/ai/plan";

const KIND_LABEL = {
  exposure: "Protects health",
  emission: "Cleaner air for all",
  both: "Health + cleaner air",
} as const;
const KIND_STYLE = {
  exposure: "bg-brand/10 text-brand",
  emission: "bg-good/10 text-good",
  both: "bg-warn/10 text-warn",
} as const;

/** One plan action: done checkbox, time, title, why, impact chips and an expandable "how we calculated this". */
export function PlanItemCard({
  item,
  done,
  onToggle,
}: {
  item: PlanItem;
  done: boolean;
  onToggle: () => void;
}) {
  const { impact } = item;
  const checkboxId = `done-${item.actionId}`;
  return (
    <li
      className={`card animate-in p-5 transition-opacity duration-300 ease-standard ${done ? "opacity-60" : ""}`}
    >
      <div className="flex gap-4">
        <div className="pt-0.5">
          <input
            id={checkboxId}
            type="checkbox"
            checked={done}
            onChange={onToggle}
            className="peer sr-only"
          />
          <label
            htmlFor={checkboxId}
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border-2 border-line text-transparent peer-checked:border-good peer-checked:bg-good peer-checked:text-onbrand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Mark “{spellOutUnits(item.title)}” as done</span>
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 font-medium text-surface">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">When: </span>
              {item.time}
            </span>
            <span className={`rounded-full px-2.5 py-1 font-medium ${KIND_STYLE[item.kind]}`}>
              {KIND_LABEL[item.kind]}
            </span>
            {item.forWhom.map((name) => (
              <span key={name} className="rounded-full border border-line px-2.5 py-1">
                {name}
              </span>
            ))}
          </div>
          <h3
            className={`mt-2 text-base font-medium decoration-muted transition-colors duration-200 ${done ? "text-muted line-through" : ""}`}
          >
            {spellOutUnits(item.title)}
          </h3>
          <p className="mt-1 text-sm text-muted">{spellOutUnits(item.why)}</p>

          <dl className="mt-3 flex flex-wrap gap-2 text-sm">
            {impact.exposureReductionPct > 0 && (
              <div className="rounded-xl bg-brand/5 px-3 py-1.5">
                <dt className="sr-only">Less smoke breathed</dt>
                <dd>
                  <strong className="font-semibold text-brand">{impact.exposureReductionPct}% less</strong>{" "}
                  smoke breathed by the family today
                </dd>
              </div>
            )}
            {impact.co2KgWeek > 0 && (
              <div className="rounded-xl bg-good/5 px-3 py-1.5">
                <dt className="sr-only">Carbon dioxide avoided</dt>
                <dd>
                  <strong className="font-semibold text-good">{impact.co2KgWeek} kilograms less</strong> CO₂
                  (climate-warming gas) each week
                </dd>
              </div>
            )}
            {impact.pm25GWeek > 0 && (
              <div className="rounded-xl bg-warn/5 px-3 py-1.5">
                <dt className="sr-only">Less smoke released</dt>
                <dd>
                  <strong className="font-semibold text-warn">{impact.pm25GWeek} grams less</strong> smoke put
                  into your city&apos;s air each week
                </dd>
              </div>
            )}
          </dl>

          <details className="group mt-3 text-sm">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-muted hover:text-ink">
              <Info className="h-4 w-4" aria-hidden="true" />
              How is this calculated?
            </summary>
            <div className="mt-2 space-y-2 rounded-xl bg-subtle p-3">
              <p>
                <span className="font-medium">How to do it: </span>
                {spellOutUnits(item.how)}
              </p>
              <p>
                <span className="font-medium">The maths: </span>
                <code className="text-xs">{spellOutUnits(item.formula)}</code>
              </p>
              {impact.doseAvoidedUg > 0 && (
                <p>
                  <span className="font-medium">Result: </span>
                  {impact.doseAvoidedUg.toLocaleString()} <Unit kind="dose" /> less fine smoke (PM2.5)
                  breathed in by the household today.
                </p>
              )}
              <div>
                <p className="font-medium">Sources</p>
                <ul className="mt-1 list-disc pl-5 text-muted">
                  {item.sources.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>
    </li>
  );
}
