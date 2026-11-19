"use client";

/** Pill segmented control (Days / Week / Month in the reference). Uses radio semantics for screen readers. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              active ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:border-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
