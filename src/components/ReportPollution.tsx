"use client";

import { Check, Megaphone, Share2 } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { shareOrCopy } from "@/lib/share";

export type Issue = "burning" | "dust" | "vehicle" | "industry";
export const ISSUES: { value: Issue; label: string; detail: string }[] = [
  {
    value: "burning",
    label: "Garbage or leaf burning",
    detail: "open burning of garbage, leaves or crop waste",
  },
  {
    value: "dust",
    label: "Construction dust",
    detail: "construction or demolition work without dust covers or water spraying",
  },
  { value: "vehicle", label: "Smoky vehicle", detail: "a vehicle giving out thick visible smoke" },
  { value: "industry", label: "Factory smoke", detail: "smoke or fumes from a factory, kiln or generator" },
];

/** Complaint text a resident can paste into an official channel. Plain, polite and specific. */
export function complaintText(issue: Issue, place: string, aqi: number | null, when: Date): string {
  const what = ISSUES.find((i) => i.value === issue)?.detail ?? "air pollution";
  const time = when.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return [
    `Air pollution complaint: ${what}.`,
    `Place: ${place}. Seen on ${time}.`,
    aqi
      ? `The air quality index here is already ${aqi}, and this is making it worse for children, elders and people with asthma.`
      : "",
    "Please inspect and take action under the Air (Prevention and Control of Pollution) Act, 1981 and the local rules on burning and dust.",
    "Thank you.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Helps residents report burning, dust and smoke to the authorities, with a ready-to-send message. */
export function ReportPollution({ place, aqi }: { place: string; aqi: number | null }) {
  const [issue, setIssue] = useState<Issue>("burning");
  const [done, setDone] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const text = complaintText(issue, place, aqi, now);
  const act = async (): Promise<void> => {
    const r = await shareOrCopy(text);
    setDone(
      r === "shared"
        ? "Shared"
        : r === "copied"
          ? "Copied. Paste it into the app or message"
          : r === "failed"
            ? "Couldn't copy. Select the text above instead"
            : null,
    );
  };
  return (
    <Card className="animate-in">
      <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
        <Megaphone className="h-5 w-5 text-brand" aria-hidden="true" /> Report pollution near you
      </h2>
      <p className="mt-1 text-label text-muted">
        Burning and dust are against the rules. Reporting them helps everyone on your street breathe easier.
      </p>
      <fieldset className="mt-4">
        <legend className="sr-only">What did you see?</legend>
        <div className="flex flex-wrap gap-2">
          {ISSUES.map((i) => (
            <label
              key={i.value}
              className={`chip cursor-pointer ${issue === i.value ? "border-brand bg-brand/10 font-medium" : ""}`}
            >
              <input
                type="radio"
                name="issue"
                value={i.value}
                checked={issue === i.value}
                onChange={() => setIssue(i.value)}
                className="sr-only"
              />
              {i.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="complaint" className="mt-4 block text-label font-medium">
        Your message
      </label>
      <textarea
        id="complaint"
        readOnly
        value={text}
        rows={5}
        className="mt-1.5 w-full resize-none rounded-xl border border-line bg-subtle p-3 text-label"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void act()}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-label font-medium text-onbrand hover:bg-brand-strong"
        >
          {done ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden="true" />
          )}
          Copy or share message
        </button>
        <span role="status" className="text-caption text-muted">
          {done ?? ""}
        </span>
      </div>
      <div className="mt-4 rounded-2xl bg-subtle p-4 text-label">
        <p className="font-medium">Where to send it</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
          <li>The CPCB “Sameer” app (Android and iPhone): file a complaint with a photo.</li>
          <li>Your State Pollution Control Board or municipal corporation helpline.</li>
          <li>In Delhi, the “Green Delhi” app routes complaints to the right department.</li>
        </ul>
      </div>
    </Card>
  );
}
