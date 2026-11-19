/** Shimmering placeholders that mirror the real layout, so the page doesn't jump when data arrives. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading live air data" className="space-y-6">
      <div className="grid gap-3 rounded-[22px] bg-subtle p-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[132px] bg-surface" />
        ))}
      </div>
      <div className="skeleton h-16" />
      <div className="skeleton h-48" />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="skeleton h-96" />
        <div className="space-y-6">
          <div className="skeleton h-56" />
          <div className="skeleton h-36" />
        </div>
      </div>
    </div>
  );
}

export function PlanSkeleton({ message }: { message: string }) {
  return (
    <div role="status" className="space-y-6">
      <div className="card flex items-center gap-3 p-6">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-brand"
              style={{ animation: `pulse-dot 1.2s ${i * 0.15}s infinite` }}
            />
          ))}
        </span>
        <p className="text-shimmer text-label">{message}</p>
      </div>
      <div className="grid gap-3 rounded-[22px] bg-subtle p-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 bg-surface" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-32" />
      ))}
    </div>
  );
}
