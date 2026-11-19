import Link from "next/link";
import type { ReactNode } from "react";

/** Primary (filled green) and secondary (outlined) pill buttons used in page headers and cards. */
export const pillPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[15px] font-medium text-onbrand shadow-sm transition-colors duration-200 hover:bg-brand-strong disabled:opacity-60";
export const pillSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-brand/40 bg-surface px-5 py-2.5 text-[15px] font-medium text-ink transition-colors duration-200 hover:border-brand hover:bg-brand/5 disabled:opacity-60";

export function PillLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={variant === "primary" ? pillPrimary : pillSecondary}>
      {children}
    </Link>
  );
}

/** Big page title with a one-line subtitle and optional actions, as in the reference ("Dashboard … Add Project"). */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="animate-in flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
