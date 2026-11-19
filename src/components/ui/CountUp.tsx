/** Fade in a changed reading while displaying the actual value throughout the animation. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  return (
    <span key={value} className="animate-in inline-block tabular-nums">
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
