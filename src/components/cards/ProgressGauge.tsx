import { Card } from "@/components/ui/Card";

const CX = 100;
const CY = 104;
const R = 78;
const STROKE = 24;

/** SVG path for the part of the half ring between fractions `from` and `to` (0 = left end, 1 = right end). */
export function arcPath(from: number, to: number): string {
  const point = (f: number): string => {
    const angle = Math.PI * (1 - f);
    return `${(CX + R * Math.cos(angle)).toFixed(2)} ${(CY - R * Math.sin(angle)).toFixed(2)}`;
  };
  return `M ${point(from)} A ${R} ${R} 0 0 1 ${point(to)}`;
}

/**
 * Half-ring gauge of today's plan, as in the reference "Project Progress": done, to do today, later this week.
 * Each part is its own arc with rounded ends, so 0%, 100% and everything between look even.
 */
export function ProgressGauge({ done, todo, later }: { done: number; todo: number; later: number }) {
  const total = Math.max(1, done + todo + later);
  const pct = Math.round((done / total) * 100);
  const doneEnd = done / total;
  const todoEnd = (done + todo) / total;
  return (
    <Card className="animate-in h-full flex flex-col">
      <h2 className="text-[20px] font-semibold tracking-tight">Today&apos;s progress</h2>
      <div className="relative mx-auto mt-4 w-full max-w-[260px]">
        <svg
          viewBox="0 0 200 122"
          className="w-full"
          role="img"
          aria-label={`${pct}% of today's steps done: ${done} done, ${todo} to do today, ${later} later`}
        >
          <defs>
            <pattern
              id="gauge-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="rgb(var(--subtle))" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(var(--brand) / 0.55)" strokeWidth="3" />
            </pattern>
          </defs>
          {/* Track: striped for "later", or a soft grey when nothing is left for later. */}
          <path
            d={arcPath(0, 1)}
            fill="none"
            stroke={later > 0 ? "url(#gauge-hatch)" : "rgb(var(--subtle))"}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {todoEnd > 0 && (
            <path
              d={arcPath(0, todoEnd)}
              fill="none"
              stroke="rgb(var(--brand-strong))"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          )}
          {doneEnd > 0 && (
            <path
              d={arcPath(0, doneEnd)}
              fill="none"
              stroke="rgb(var(--aqi-good))"
              strokeWidth={STROKE}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
        </svg>
        {/* Sits inside the ring's hollow (between the arc ends), sized so even "100%" never touches the arc. */}
        <div className="absolute inset-x-[22%] bottom-[8%] text-center" aria-hidden="true">
          <p className="text-[clamp(24px,2.4vw,32px)] font-semibold leading-none tracking-tight tabular-nums">
            {pct}%
          </p>
          <p className="mt-1 truncate text-caption text-muted">{pct === 100 ? "all done" : "done"}</p>
        </div>
      </div>
      <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-caption text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-aqi-good" aria-hidden="true" /> Done ({done})
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-brand-strong" aria-hidden="true" /> To do today ({todo})
        </li>
        <li className="flex items-center gap-1.5">
          <span className="hatch h-3 w-3 rounded-full" aria-hidden="true" /> This week ({later})
        </li>
      </ul>
    </Card>
  );
}
