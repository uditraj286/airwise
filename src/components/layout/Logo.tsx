/** AirWise's airflow A. The adjacent wordmark provides the accessible brand name. */
export function Logo({ className = "h-8 w-8 text-brand" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" fill="currentColor">
      <path d="M4.3 26.1 15.8 5.8A3 3 0 0 1 18.4 4h4.5a3 3 0 0 1 2.6 1.6l8.1 15.6c-3.1-2.5-6.4-3-10.4-1.9l-2.8-5.1-3.6 7.1c-1.9.8-3.7 1-5.3 1-2.8 0-5.2 1.4-7.2 3.8Z" />
      <path d="M1.1 33.7 3 30.3c1.9-3 5-4.2 8.5-4 4 .3 7.3-1.2 10.6-3.2 4.4-2.7 9-3 12.4.5l5.2 10.2c.6 1.1 0 2.2-1.4 2.2H31a2.8 2.8 0 0 1-2.5-1.6l-4.2-9c-3 2.3-6.4 3.5-9.9 3.3l-3.3 5.8A2.8 2.8 0 0 1 8.7 36H2.6C1.1 36 .5 34.9 1.1 33.7Z" />
    </svg>
  );
}
