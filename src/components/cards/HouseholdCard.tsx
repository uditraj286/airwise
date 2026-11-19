import { Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { memberAdvice, TIER_LABEL } from "@/lib/air/activities";
import { memberRisk, type Member } from "@/lib/profile/schema";
import type { AirSnapshot } from "@/lib/types";

const AVATAR = [
  "bg-brand/15 text-brand",
  "bg-amber/20 text-amber",
  "bg-warn/15 text-warn",
  "bg-good/15 text-good",
  "bg-ink/10 text-ink",
];
const AGE: Record<Member["ageGroup"], string> = { child: "Child", adult: "Adult", senior: "Senior" };
const COND: Record<string, string> = {
  asthma: "asthma",
  heart: "heart condition",
  copd: "lung disease",
  pregnancy: "pregnant",
  allergy: "allergies",
};
const BADGE = {
  yes: "border-good/50 bg-good/10 text-ink",
  care: "border-amber/60 bg-amber/15 text-ink",
  no: "border-bad/50 bg-bad/10 text-ink",
} as const;

/** "Team Collaboration" in the reference: each person, their risk, and whether they can go out right now. */
export function HouseholdCard({ members, air }: { members: Member[]; air: AirSnapshot }) {
  return (
    <Card className="animate-in h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight">Your household</h2>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/70 px-3.5 py-1.5 text-label font-medium hover:bg-subtle"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add member
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {members.map((m, i) => {
          const advice = memberAdvice(m, air);
          const details = [AGE[m.ageGroup], ...m.conditions.map((c) => COND[c] ?? c)].join(", ");
          return (
            <li key={m.id} className="flex items-center gap-3">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${AVATAR[i % AVATAR.length]}`}
                aria-hidden="true"
              >
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">
                  {m.name} <span className="font-normal text-muted">· {details}</span>
                </span>
                <span className="block truncate text-caption text-muted">
                  {advice.label}: <span className="font-medium text-ink">{advice.text}</span>
                  {advice.better ? ` · ${advice.better}` : ""}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-md border px-2 py-0.5 text-caption font-medium ${BADGE[advice.advice]}`}
              >
                {TIER_LABEL[memberRisk(m)]}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
