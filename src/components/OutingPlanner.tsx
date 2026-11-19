"use client";

import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { categoryLabel } from "@/i18n/dict";
import { bestOuting } from "@/lib/air/activities";
import type { AirSnapshot, Language } from "@/lib/types";

const KINDS = [
  { value: "1", label: "1 hour" },
  { value: "2", label: "2 hours" },
  { value: "3", label: "3 hours" },
] as const;

/** "When should we go?": the cleanest stretch of daylight for a walk, market trip, match or school event. */
export function OutingPlanner({ air, lang }: { air: AirSnapshot; lang: Language }) {
  const [hours, setHours] = useState<"1" | "2" | "3">("2");
  const [now] = useState(() => new Date());
  const best = bestOuting(air, Number(hours), now);
  return (
    <Card className="animate-in h-full">
      <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
        <CalendarClock className="h-5 w-5 text-brand" aria-hidden="true" /> Plan an outing
      </h2>
      <p className="mt-1 text-label text-muted">
        A walk, a market trip, a match or a school event: find the cleanest time in the next 24 hours.
      </p>
      <div className="mt-4">
        <Segmented label="How long" value={hours} onChange={setHours} options={[...KINDS]} />
      </div>
      <div className="mt-5" aria-live="polite">
        {best ? (
          <>
            <p className="text-label text-muted">Best time to go</p>
            <p className="mt-1 text-[30px] font-semibold leading-tight tracking-tight">{best.window}</p>
            <p className="mt-1 text-label text-muted">
              Fine smoke around {best.pm25} micrograms per cubic metre ({categoryLabel(lang, best.category)}).
              {best.unhealthy
                ? " Still unhealthy: keep it short, wear an N95 mask and keep children's play gentle."
                : " The cleanest stretch of the day."}
            </p>
          </>
        ) : (
          <p className="text-label text-muted">
            No daylight window of that length in the next 24 hours. Try a shorter outing.
          </p>
        )}
      </div>
    </Card>
  );
}
