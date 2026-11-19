"use client";

import { OutingPlanner } from "@/components/OutingPlanner";
import { ReportPollution } from "@/components/ReportPollution";
import { Ambulance, ExternalLink, HeartPulse, Hospital, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { adviseAll, type Advice, type Tier } from "@/lib/air/activities";
import { useLiveAir } from "@/lib/airContext";
import { useProfile } from "@/lib/profile/store";
import { memberRisk } from "@/lib/profile/schema";

/** Call 112 or 108 straight away for these (general first-aid guidance, not a diagnosis). */
const URGENT = [
  "Struggling to breathe, or can't finish a sentence",
  "Lips or fingertips turning blue or grey",
  "Chest pain, pressure or tightness",
  "Confusion, fainting or unusual drowsiness",
  "An asthma attack that doesn't ease with the usual inhaler",
];
/** Call a doctor today for these. */
const SOON = [
  "Cough or wheeze that keeps getting worse",
  "A child breathing faster than usual or not feeding well",
  "Needing the reliever inhaler more often than normal",
  "Fever with cough or breathlessness",
];
const MASK_STEPS = [
  "Use an N95 or FFP2 mask. Cloth and surgical masks let most fine smoke through.",
  "Put both straps behind your head, one above the ears and one below.",
  "Press the metal strip to the shape of your nose with both hands.",
  "Breathe out hard: if air leaks at the edges, adjust until it seals. Replace it when it gets hard to breathe through or dirty.",
];

const ADVICE_STYLE: Record<Advice, string> = {
  yes: "border-good/50 bg-good/10 text-ink",
  care: "border-amber/60 bg-amber/15 text-ink",
  no: "border-bad/50 bg-bad/10 text-ink",
};
const ADVICE_WORD: Record<Advice, string> = { yes: "Yes", care: "With care", no: "Not now" };
const TIERS: { value: Tier; label: string }[] = [
  { value: "standard", label: "Healthy adults" },
  { value: "elevated", label: "Children & elders" },
  { value: "high", label: "Asthma, heart or lung" },
];

/** Health & help: what to do right now, when to get help, emergency numbers and a mask guide. */
export function HealthView() {
  const air = useLiveAir();
  const { profile } = useProfile();
  const mostAtRisk: Tier = profile.members.some((m) => memberRisk(m) === "high")
    ? "high"
    : profile.members.some((m) => memberRisk(m) === "elevated")
      ? "elevated"
      : "standard";
  const [tier, setTier] = useState<Tier>(mostAtRisk);
  const lat = profile.location.lat.toFixed(2);
  const lon = profile.location.lon.toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health & help"
        subtitle="What is safe to do right now, the best time to go out, how to report pollution, and when to get medical help. General guidance, not medical advice."
      />

      <section aria-label="Emergency help" className="grid gap-4 md:grid-cols-3">
        <a
          href="tel:112"
          className="hero-gradient animate-in flex items-center gap-4 rounded-card p-5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20">
            <Phone className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[32px] font-semibold leading-none">112</span>
            <span className="mt-1 block text-label text-white/85">National emergency number, India</span>
          </span>
        </a>
        <a
          href="tel:108"
          className="card animate-in flex items-center gap-4 p-5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-bad/10 text-bad">
            <Ambulance className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[32px] font-semibold leading-none">108</span>
            <span className="mt-1 block text-label text-muted">Free ambulance in most states</span>
          </span>
        </a>
        <a
          href={`https://www.google.com/maps/search/hospital/@${lat},${lon},13z`}
          target="_blank"
          rel="noopener noreferrer"
          className="card animate-in flex items-center gap-4 p-5 transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <Hospital className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[17px] font-semibold">
              Hospitals near you <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="mt-1 block text-label text-muted">
              Opens Google Maps around {profile.location.name.split(",")[0]}
            </span>
          </span>
        </a>
      </section>

      <Card className="animate-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight">Can we do this now?</h2>
            <p className="mt-1 text-label text-muted">Based on the air right now and the next 24 hours.</p>
          </div>
          <Segmented label="Who is it for" value={tier} onChange={setTier} options={TIERS} />
        </div>
        {air.status === "ready" ? (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {adviseAll(tier, air.data).map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-line p-4"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{a.label}</span>
                  <span className="mt-0.5 block text-label text-muted">
                    {a.text}
                    {a.better ? `. ${a.better}.` : "."}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-caption font-semibold ${ADVICE_STYLE[a.advice]}`}
                >
                  {ADVICE_WORD[a.advice]}
                </span>
              </li>
            ))}
          </ul>
        ) : air.status === "loading" ? (
          <div className="mt-5">
            <DashboardSkeleton />
          </div>
        ) : (
          <p className="mt-5 text-label text-muted">
            Live air data is unavailable right now, so we can&apos;t give activity advice. The guidance below
            still applies.
          </p>
        )}
      </Card>

      {air.status === "ready" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <OutingPlanner air={air.data} lang={profile.language} />
          <ReportPollution
            place={profile.location.name}
            aqi={air.data.station?.aqi ?? air.data.current.aqi}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-in">
          <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
            <HeartPulse className="h-5 w-5 text-bad" aria-hidden="true" /> When to get help
          </h2>
          <h3 className="mt-4 text-label font-semibold text-bad">Call 112 or 108 now</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            {URGENT.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <h3 className="mt-5 text-label font-semibold text-warn">See a doctor today</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            {SOON.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-muted">
            On smoggy days keep inhalers and medicines in reach, and follow the plan your doctor gave you.
          </p>
        </Card>

        <Card className="animate-in">
          <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" /> Wearing an N95 mask properly
          </h2>
          <ol className="mt-4 space-y-3">
            {MASK_STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-label font-semibold text-brand">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-caption text-muted">
            Masks don&apos;t fit young children well. Keep them indoors in clean air instead.
          </p>
        </Card>
      </div>
    </div>
  );
}
