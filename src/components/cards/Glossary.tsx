import { HelpCircle } from "lucide-react";

const TERMS: { term: string; meaning: string }[] = [
  {
    term: "AQI (Air Quality Index)",
    meaning:
      "One score for how polluted the air is, on India's official scale: 0–50 Good, 51–100 Satisfactory, 101–200 Moderate, 201–300 Poor, 301–400 Very Poor, 401+ Severe.",
  },
  {
    term: "PM2.5",
    meaning:
      "Tiny smoke and soot particles, about 30 times thinner than a hair. They go deep into the lungs and blood, so they matter most for health.",
  },
  {
    term: "Micrograms per cubic metre",
    meaning:
      "Micrograms per cubic metre: how much of a pollutant is in each cubic metre of air. Lower is better.",
  },
  {
    term: "WHO guideline",
    meaning:
      "For fine particles (PM2.5), the World Health Organization guideline is 15 micrograms per cubic metre averaged over 24 hours. The app compares hourly levels with that value for context.",
  },
  {
    term: "Micrograms breathed in",
    meaning:
      "Micrograms of PM2.5 a person inhales over the day. It depends on the air indoors and outside, and on how hard they are breathing.",
  },
  {
    term: "Cigarettes’ worth",
    meaning:
      "A rough comparison: breathing 22 micrograms per cubic metre of PM2.5 for a day is about as harmful as smoking one cigarette (Berkeley Earth).",
  },
];

/** Collapsible plain-language glossary so every number on the page can be understood without prior knowledge. */
export function Glossary({ className = "" }: { className?: string }) {
  return (
    <details className={`group rounded-card border border-line bg-surface px-5 py-4 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-label font-medium [&::-webkit-details-marker]:hidden">
        <HelpCircle className="h-4 w-4 text-muted" aria-hidden="true" />
        What do these numbers mean?
        <span className="ml-auto text-caption font-normal text-muted group-open:hidden">Show</span>
        <span className="ml-auto hidden text-caption font-normal text-muted group-open:inline">Hide</span>
      </summary>
      <dl className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt className="text-label font-medium">{t.term}</dt>
            <dd className="mt-0.5 text-label text-muted">{t.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
