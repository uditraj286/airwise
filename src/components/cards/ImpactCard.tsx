import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface ImpactStat {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Small unit under the number, e.g. "kilograms", so long units never wrap the number. */
  unit?: string;
}

/** Three stats in equal columns: label (up to two lines, same height in every column), number, unit. */
export function ImpactCard({
  title,
  stats,
  footnote,
}: {
  title: string;
  stats: ImpactStat[];
  footnote?: string;
}) {
  return (
    <Card className="animate-in">
      <h2 className="text-title">{title}</h2>
      <dl className="mt-5 grid grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value, unit }) => (
          <div key={label} className="flex min-w-0 flex-col">
            <dt className="flex min-h-[2.5rem] min-w-0 items-start gap-1.5 text-label leading-5 text-muted">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">{label}</span>
            </dt>
            <dd className="mt-2">
              <span className="block text-2xl font-semibold leading-none tracking-tight tabular-nums">
                {value}
              </span>
              {unit && <span className="mt-1 block text-caption text-muted">{unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {footnote && <p className="mt-4 text-caption text-muted">{footnote}</p>}
    </Card>
  );
}
