import type { HTMLAttributes } from "react";

/** White rounded surface with hairline border, as in the reference. */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLElement> & { as?: "section" | "div" }) {
  return <section className={`card p-5 sm:p-6 ${className}`} {...rest} />;
}
