import { Card } from "@/components/ui/Card";
import type { SourceProfile, SourceShare } from "@/lib/air/sources";

const COLOR: Record<SourceShare["key"], string> = {
  vehicles: "rgb(var(--brand))",
  biomass: "rgb(var(--warn))",
  dust: "rgb(var(--amber))",
  industry: "rgb(var(--good))",
  other: "rgb(var(--muted))",
};

/** Donut ring of source shares with a legend, mirroring "Top Acquisition Sources". `bare` drops the card and title. */
export function SourcesDonut({
  title,
  data: raw,
  centerLabel,
  bare = false,
}: {
  title: string;
  data: SourceProfile;
  centerLabel: string;
  bare?: boolean;
}) {
  const data = { ...raw, shares: [...raw.shares].sort((a, b) => b.pct - a.pct) };
  const r = 58;
  const c = 2 * Math.PI * r;
  const gap = 4;
  const top = data.shares[0];
  const offsets = data.shares.reduce<number[]>(
    (acc, s, i) => [...acc, i === 0 ? 0 : (acc[i - 1] ?? 0) + ((data.shares[i - 1]?.pct ?? 0) / 100) * c],
    [],
  );

  const body = (
    <>
      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <svg
            viewBox="0 0 150 150"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label={`${title}: ${data.shares.map((s) => `${s.label} ${s.pct}%`).join(", ")}`}
          >
            {data.shares.map((s, i) => {
              const len = (s.pct / 100) * c;
              return (
                <circle
                  key={s.key}
                  cx="75"
                  cy="75"
                  r={r}
                  fill="none"
                  stroke={COLOR[s.key]}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                  strokeDashoffset={-(offsets[i] ?? 0)}
                />
              );
            })}
          </svg>
          {top && (
            <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
              <div>
                <p className="text-3xl font-medium">{top.pct}%</p>
                <p className="text-xs text-muted">{centerLabel}</p>
              </div>
            </div>
          )}
        </div>
        <ul className="w-full space-y-3">
          {data.shares.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 text-[15px]">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: COLOR[s.key] }}
                  aria-hidden="true"
                />
                {s.label}
              </span>
              <span className="text-sm text-muted">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-caption text-muted">
        {data.region}. {data.citation}.
      </p>
    </>
  );
  if (bare) return body;
  return (
    <Card>
      <h2 className="text-title">{title}</h2>
      {body}
    </Card>
  );
}
