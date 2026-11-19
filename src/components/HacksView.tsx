"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { CATEGORY_LABEL, HACKS, filterHacks, type HackCategory } from "@/lib/hacks";

const COST_STYLE = { Free: "text-good", Low: "text-brand", Medium: "text-warn" } as const;

/** Filterable library of indoor hacks, sustainable swaps and myth-busters. */
export function HacksView() {
  const params = useSearchParams();
  const [category, setCategory] = useState<HackCategory | "all">("all");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const searchId = useId();
  const results = filterHacks(HACKS, category, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indoor hacks & swaps"
        subtitle="Cheap fixes for cleaner air at home, greener everyday swaps, and common smog myths checked against the evidence."
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          label="Category"
          value={category}
          onChange={setCategory}
          options={(Object.keys(CATEGORY_LABEL) as (HackCategory | "all")[]).map((c) => ({
            value: c,
            label: CATEGORY_LABEL[c],
          }))}
        />
        <div>
          <label htmlFor={searchId} className="sr-only">
            Search hacks
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. purifier"
            className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm placeholder:text-muted lg:w-72"
          />
        </div>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? "tip" : "tips"}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((h) => (
          <li
            key={h.id}
            id={h.category === "myth" && h.id === "plants" ? "myths" : undefined}
            className="card flex flex-col p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {CATEGORY_LABEL[h.category]}
            </p>
            <h2 className="mt-2 text-base font-medium">{h.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted">{h.body}</p>
            <p className="mt-4 flex justify-between text-xs">
              <span className={`font-medium ${COST_STYLE[h.cost]}`}>Cost: {h.cost}</span>
              <span className="text-muted">{h.source}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
