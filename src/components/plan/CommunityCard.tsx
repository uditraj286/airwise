"use client";

import { spellOutUnits } from "@/lib/units";
import { Copy, HandHeart, Users } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { DailyPlan } from "@/lib/ai/plan";
import { useCommunity } from "@/lib/firebase/hooks";

/** Community tip, a shareable message, and an anonymous city-wide pledge counter stored in Firestore. */
export function CommunityCard({ plan }: { plan: DailyPlan }) {
  const community = useCommunity(plan.air.location);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const swaps = plan.items.filter((i) => i.kind !== "exposure");
  const swapCo2 = Math.round(swaps.reduce((s, i) => s + i.impact.co2KgWeek, 0) * 10) / 10;

  const share = async (): Promise<void> => {
    const pledged = community.stats?.families
      ? `\n${community.stats.families} families in ${plan.air.location} have pledged cleaner habits on AirWise.`
      : "";
    const text = `Air quality update: AQI ${plan.air.aqi} in ${plan.air.location} today.\nCleanest time outdoors: ${plan.air.bestWindow}. Avoid ${plan.air.peakWindows}.\n${spellOutUnits(plan.communityTip)}${pledged}\n— shared from AirWise`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const onPledge = async (): Promise<void> => {
    setError(null);
    try {
      if (community.myPledge) await community.withdraw();
      else
        await community.pledge(
          swaps.map((i) => i.actionId),
          swapCo2,
        );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Users className="h-5 w-5 text-good" aria-hidden="true" />
        With your community
      </h2>
      <p className="mt-2 text-sm">{spellOutUnits(plan.communityTip)}</p>

      {community.available && community.stats && (
        <div className="mt-4 rounded-xl bg-good/5 p-3 text-sm" aria-live="polite">
          <p>
            <strong className="text-lg font-semibold text-good">{community.stats.families}</strong>{" "}
            {community.stats.families === 1 ? "family" : "families"} in {plan.air.location.split(",")[0]}{" "}
            pledged · <strong>{community.stats.co2KgWeek} kilograms</strong> CO₂ less every week together
          </p>
          {swaps.length > 0 && (
            <button
              type="button"
              onClick={() => void onPledge()}
              disabled={community.busy}
              aria-pressed={Boolean(community.myPledge)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-good px-4 py-2 text-sm font-medium text-onbrand disabled:opacity-60"
            >
              <HandHeart className="h-4 w-4" aria-hidden="true" />
              {community.myPledge
                ? "Pledged ✓ (tap to withdraw)"
                : `Pledge our ${swaps.length} swap${swaps.length > 1 ? "s" : ""} (−${swapCo2} kilograms CO₂ each week)`}
            </button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-bad">
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => void share()}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-muted"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
        {copied ? "Copied!" : "Copy a message for your society group"}
      </button>
      <p className="sr-only" aria-live="polite">
        {copied ? "Message copied to clipboard" : ""}
      </p>
    </Card>
  );
}
