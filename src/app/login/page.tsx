import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, HeartPulse, Leaf } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  {
    icon: CalendarClock,
    title: "Know when to go out",
    body: "Hour-by-hour smog forecast for your street, in plain words.",
  },
  {
    icon: HeartPulse,
    title: "Protect who's most at risk",
    body: "Plans built around kids, elders and anyone with asthma.",
  },
  {
    icon: Leaf,
    title: "See your impact",
    body: "Every step shows the smoke it keeps out and the pollution it saves.",
  },
];

/** Sample hour band for the brand panel, mirroring the dashboard's "Today at a glance". */
const BAND = [
  "avoid",
  "avoid",
  "okay",
  "okay",
  "best",
  "best",
  "best",
  "okay",
  "okay",
  "avoid",
  "avoid",
  "avoid",
] as const;
const BAND_BG = { best: "bg-aqi-good", okay: "bg-aqi-moderate", avoid: "bg-aqi-very-poor" } as const;

export default function LoginPage() {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.05fr_1fr]">
      <aside className="card-dark relative m-3 hidden flex-col justify-between overflow-hidden rounded-[28px] p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8 text-white" />
          <span className="text-lg font-semibold tracking-tight">AirWise</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-[40px] font-medium leading-[1.1] tracking-tight">
            Breathe easier through smog season.
          </h2>
          <p className="mt-4 text-white/75">
            A daily plan for your family, built from live air data and explained in numbers you can trust.
          </p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white/75">Today in New Delhi</span>
              <span className="font-medium">Go out 1–4 PM</span>
            </div>
            <div className="mt-3 flex h-7 gap-[3px]" aria-hidden="true">
              {BAND.map((v, i) => (
                <span
                  key={i}
                  className={`flex-1 ${BAND_BG[v]} ${i === 0 ? "rounded-l-md" : ""} ${i === BAND.length - 1 ? "rounded-r-md" : ""}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/75">
              <span>Now</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
            </div>
          </div>
        </div>

        <ul className="grid gap-5">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-sm text-white/75">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <main id="main" className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center gap-2 lg:hidden">
          <Logo className="h-7 w-7 text-brand" />
          <span className="font-semibold tracking-tight">AirWise</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <Suspense>
            <AuthCard />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
