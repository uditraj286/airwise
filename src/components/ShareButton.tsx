"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { pillSecondary } from "@/components/ui/PageHeader";
import { dayOutlook } from "@/lib/air/dayWindows";
import { useLiveAir } from "@/lib/airContext";
import { useProfile } from "@/lib/profile/store";
import { shareOrCopy, shareText, whatsappUrl, type ShareResult } from "@/lib/share";
import { useCachedPlan } from "@/lib/usePlan";

/** Builds today's summary for the family; null until the air data has loaded. */
export function useShareText(): string | null {
  const air = useLiveAir();
  const { profile } = useProfile();
  const plan = useCachedPlan(profile);
  if (air.status !== "ready") return null;
  const d = air.data;
  return shareText({
    city: d.location.name,
    aqi: d.current.aqi,
    category: d.current.category,
    outlook: dayOutlook(d),
    steps: plan?.items.map((i) => i.title) ?? [],
    language: profile.language,
  });
}

const MESSAGE: Record<ShareResult, string> = {
  shared: "Shared",
  copied: "Copied. Paste it in your family or society group",
  cancelled: "",
  failed: "Couldn't share. Try the WhatsApp link",
};

/** Share today's safe hours and top steps: native share sheet, else copy, plus a WhatsApp link. */
export function ShareButton({ variant = "pill" }: { variant?: "pill" | "icon" }) {
  const text = useShareText();
  const [result, setResult] = useState<ShareResult | null>(null);
  const onClick = async (): Promise<void> => {
    if (!text) return;
    const r = await shareOrCopy(text);
    setResult(r);
    if (r !== "failed") setTimeout(() => setResult(null), 3000);
  };
  const done = result === "shared" || result === "copied";
  return (
    <span className="relative inline-flex items-center">
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => void onClick()}
          disabled={!text}
          aria-label="Share today's air summary"
          className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink shadow-card transition-colors hover:text-brand disabled:opacity-50"
        >
          {done ? (
            <Check className="h-[18px] w-[18px] text-brand" aria-hidden="true" />
          ) : (
            <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
        </button>
      ) : (
        <button type="button" onClick={() => void onClick()} disabled={!text} className={pillSecondary}>
          {done ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden="true" />
          )}
          Share today
        </button>
      )}
      <span
        role="status"
        className={
          result && MESSAGE[result]
            ? "absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-ink px-3 py-2 text-caption text-surface shadow-card"
            : "sr-only"
        }
      >
        {result ? MESSAGE[result] : ""}
        {result === "failed" && text && (
          <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
            Open WhatsApp
          </a>
        )}
      </span>
    </span>
  );
}
