"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading live air data",
  "Checking your household",
  "Weighing the options",
  "Writing your answer",
];

/** Claude-style "thinking" state: shimmering label with the step currently in progress. */
export function ThinkingIndicator() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-1">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand"
            style={{ animation: `pulse-dot 1.2s ${i * 0.15}s infinite` }}
          />
        ))}
      </span>
      <span className="text-shimmer text-label font-medium">Thinking</span>
      <span key={step} className="animate-in text-label text-muted">
        {STEPS[step]}…
      </span>
    </div>
  );
}
