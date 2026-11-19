/** Visible measurement labels used beside readings and estimates. */
const UNITS = {
  conc: "micrograms per cubic metre",
  milliConc: "milligrams per cubic metre",
  dose: "micrograms",
} as const;

export function Unit({ kind = "conc", className = "" }: { kind?: keyof typeof UNITS; className?: string }) {
  return <span className={className}>{UNITS[kind]}</span>;
}
