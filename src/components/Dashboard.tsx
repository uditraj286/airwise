"use client";

import { Unit } from "@/components/ui/Unit";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Leaf,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { ImpactCard } from "@/components/cards/ImpactCard";
import { CountdownCard } from "@/components/cards/CountdownCard";
import { HouseholdCard } from "@/components/cards/HouseholdCard";
import { NextStepCard } from "@/components/cards/NextStepCard";
import { PlanListCard } from "@/components/cards/PlanListCard";
import { ProgressGauge } from "@/components/cards/ProgressGauge";
import { ChangeChip, StatCard } from "@/components/cards/StatCard";
import { WeekBars } from "@/components/cards/WeekBars";
import { ShareButton } from "@/components/ShareButton";
import { PageHeader, PillLink, pillSecondary } from "@/components/ui/PageHeader";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { categoryLabel } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { aqiCategory, timesWhoGuideline } from "@/lib/air/aqi";
import { dayOutlook } from "@/lib/air/dayWindows";
import { isGenericPlaceName } from "@/lib/air/place";
import { sourcesFor } from "@/lib/air/sources";
import { DISPERSION_TEXT } from "@/lib/air/weather";
import { pctChange, pointNear } from "@/lib/air/trends";
import { useLiveAir } from "@/lib/airContext";
import { buildContext } from "@/lib/ai/context";
import { evaluatePlan } from "@/lib/impact/evaluate";
import { useDoneActions, useProfile } from "@/lib/profile/store";
import { useCachedPlan } from "@/lib/usePlan";
import { useWeekSummary } from "@/lib/firebase/hooks";
import dynamic from "next/dynamic";

/** Cards below the fold load on demand, so the first screen ships less JavaScript. */
function CardSkeleton({ height }: { height: string }) {
  return <div className={`skeleton ${height}`} aria-hidden="true" />;
}
const DayTimeline = dynamic(() => import("@/components/cards/DayTimeline").then((m) => m.DayTimeline), {
  loading: () => <CardSkeleton height="h-72" />,
});
const TrendCard = dynamic(() => import("@/components/cards/TrendCard").then((m) => m.TrendCard), {
  loading: () => <CardSkeleton height="h-96" />,
});
const AirMixCard = dynamic(() => import("@/components/cards/AirMixCard").then((m) => m.AirMixCard), {
  loading: () => <CardSkeleton height="h-80" />,
});
const PlacesCard = dynamic(() => import("@/components/cards/PlacesCard").then((m) => m.PlacesCard), {
  loading: () => <CardSkeleton height="h-64" />,
});
const StationsCard = dynamic(() => import("@/components/cards/StationsCard").then((m) => m.StationsCard), {
  loading: () => <CardSkeleton height="h-64" />,
});
const Glossary = dynamic(() => import("@/components/cards/Glossary").then((m) => m.Glossary), {
  loading: () => <CardSkeleton height="h-16" />,
});

const greeting = (h: number): string =>
  h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

/** Overview page in the reference layout, filled with live air data and the household's own numbers. */
export function Dashboard() {
  const t = useT();
  const { profile, isDemo, save } = useProfile();
  const air = useLiveAir();
  const cachedPlan = useCachedPlan(profile);
  const { done, toggle } = useDoneActions();
  const week = useWeekSummary(done.join(","));

  const derived = useMemo(() => {
    if (air.status !== "ready") return null;
    const data = air.data;
    const now = new Date();
    const ctx = buildContext(profile, data, now);
    const plannedIds = cachedPlan?.items.map((i) => i.actionId) ?? ctx.ranked.slice(0, 5).map((a) => a.id);
    const potential = evaluatePlan(profile, ctx.day, plannedIds);
    const doneIds = plannedIds.filter((id) => done.includes(id));
    const achieved = evaluatePlan(profile, ctx.day, doneIds);
    const yesterday = pointNear(data.hourly, now.getTime() - 24 * 3600_000);
    const outlook = dayOutlook(data, now);
    const localHour = new Date(now.getTime() + data.utcOffsetSeconds * 1000).getUTCHours();
    const later =
      cachedPlan?.items.filter((i) => i.slot === "this_week" && !done.includes(i.actionId)).length ?? 0;
    return { data, ctx, plannedIds, potential, doneIds, achieved, yesterday, outlook, localHour, later };
  }, [air.status, air.data, profile, cachedPlan, done]);

  // Shared GPS shows up as "My location"; once the server has named the place, remember it in the profile.
  const placeName = air.status === "ready" ? air.data.location.name : profile.location.name;
  useEffect(() => {
    if (!isDemo && isGenericPlaceName(profile.location.name) && !isGenericPlaceName(placeName)) {
      save({ ...profile, location: { ...profile.location, name: placeName } });
    }
  }, [isDemo, placeName, profile, save]);
  const shortPlace = placeName.split(",")[0] ?? placeName;

  const source = air.data?.source;
  const outdated = Boolean(air.refreshError || air.data?.stale);
  const station = outdated ? undefined : air.data?.station;
  const readingAt = station?.updatedAt ?? air.data?.updatedAt;
  const aqi = station?.aqi ?? air.data?.current.aqi ?? 0;
  const category = categoryLabel(profile.language, aqiCategory(aqi));
  const aqiLabel = station ? "Air quality now (AQI)" : source === "google" ? "India AQI" : t("kpi_aqi");
  const providerName = station
    ? "CPCB station · India API"
    : source === "google"
      ? "Google Maps"
      : source === "open-meteo"
        ? "Open-Meteo"
        : "Sample data";
  const firstName = profile.members[0]?.name ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting(derived?.localHour ?? new Date().getHours())}, ${firstName}`}
        subtitle={
          derived
            ? `${category} air in ${shortPlace} right now.${derived.data.weather ? ` ${DISPERSION_TEXT[derived.data.weather.dispersion]}.` : ""}`
            : `Live air for ${shortPlace}, explained for your family.`
        }
        actions={
          <>
            <PillLink href="/plan">
              {t("view_plan")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PillLink>
            <ShareButton />
            <button
              type="button"
              onClick={air.retry}
              disabled={air.refreshing || air.status === "loading"}
              className={pillSecondary}
            >
              <RefreshCw
                className={`h-4 w-4 ${air.refreshing ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
              {air.refreshing ? "Updating…" : "Update data"}
            </button>
          </>
        }
      />

      {profile.sample && (
        <div className="animate-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3 text-label">
          <p>
            You&apos;re looking at a sample family in New Delhi. Set up your own household to see your air and
            your plan.
          </p>
          <Link
            href="/setup"
            className="whitespace-nowrap rounded-full bg-brand px-4 py-1.5 font-medium text-onbrand transition-colors hover:bg-brand-strong"
          >
            Set up my household
          </Link>
        </div>
      )}

      {air.status === "loading" && <DashboardSkeleton />}
      {air.status === "error" && (
        <StatusPanel
          kind="error"
          message="Air quality unavailable. Try again shortly."
          onRetry={air.retry}
          retryLabel={t("retry")}
        />
      )}

      {derived && (
        <>
          <section
            aria-label="Key numbers"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0"
          >
            <StatCard
              hero
              title={aqiLabel}
              value={aqi}
              unit={category}
              href="/#air-now"
              linkLabel="See what is in your air"
              foot={
                station ? (
                  <>
                    Measured by {station.count ?? 1} CPCB{" "}
                    {station.count === 1 || !station.count ? "station" : "stations"} near you
                  </>
                ) : (
                  <>
                    <ChangeChip hero value={pctChange(derived.data.current.aqi, derived.yesterday?.aqi)} />
                    {t("vs_yesterday")}
                  </>
                )
              }
            />
            <StatCard
              title={t("kpi_pm25")}
              value={Math.round(derived.data.current.pm25)}
              unit={<Unit />}
              href="/#air-now"
              linkLabel="See fine smoke details"
              foot={
                <>
                  <ChangeChip value={pctChange(derived.data.current.pm25, derived.yesterday?.pm25)} />
                  <span className="font-medium text-bad">{`${timesWhoGuideline(derived.data.current.pm25)}${t("who_times")}`}</span>
                </>
              }
            />
            <StatCard
              title={t("kpi_cut")}
              value={Math.round(derived.potential.exposureReductionPct)}
              suffix="%"
              href="/plan"
              linkLabel="Open today's plan"
              foot={
                <>
                  ≈ {derived.potential.cigarettesAvoidedPerDay} {t("cig_day")}
                </>
              }
            />
            <StatCard
              title="Steps done today"
              value={derived.doneIds.length}
              unit={`of ${derived.plannedIds.length}`}
              href="/plan"
              linkLabel="Open today's plan"
              foot={
                cachedPlan
                  ? `${Math.round(derived.achieved.exposureReductionPct)}% less smoke breathed so far`
                  : "Open the plan to build today's steps"
              }
            />
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <div className="md:col-span-2">
              <WeekBars air={derived.data} lang={profile.language} />
            </div>
            <NextStepCard plan={cachedPlan} done={done} localHour={derived.localHour} onDone={toggle} />
            <PlanListCard plan={cachedPlan} done={done} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <div className="md:col-span-2">
              <HouseholdCard members={profile.members} air={derived.data} />
            </div>
            <ProgressGauge
              done={derived.doneIds.length}
              todo={Math.max(0, derived.plannedIds.length - derived.doneIds.length - derived.later)}
              later={derived.later}
            />
            <CountdownCard outlook={derived.outlook} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
            <PlacesCard />
            <StationsCard lat={profile.location.lat} lon={profile.location.lon} lang={profile.language} />
          </div>

          <DayTimeline air={derived.data} />

          <div id="air-now" className="grid scroll-mt-6 gap-4 xl:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
            <TrendCard air={derived.data} lang={profile.language} />
            <div className="flex flex-col gap-4">
              <AirMixCard air={derived.data} sources={sourcesFor(placeName)} />
              <ImpactCard
                title={week ? t("impact_week") : t("impact_title")}
                stats={
                  week
                    ? [
                        {
                          icon: CheckCircle2,
                          label: t("actions_done_week"),
                          value: String(week.actionsDone),
                        },
                        { icon: CalendarDays, label: t("days_on_plan"), value: `${week.daysOnPlan}/7` },
                        {
                          icon: Leaf,
                          label: t("co2_avoided"),
                          value: String(week.co2KgAvoided),
                          unit: "kilograms",
                        },
                      ]
                    : [
                        {
                          icon: ClipboardList,
                          label: t("planned"),
                          value: String(derived.plannedIds.length),
                        },
                        { icon: CheckCircle2, label: t("done"), value: String(derived.doneIds.length) },
                        {
                          icon: Sparkles,
                          label: t("exposure_cut"),
                          value: `${Math.round(derived.achieved.exposureReductionPct)}%`,
                        },
                      ]
                }
                footnote={week ? t("synced_note") : undefined}
              />
            </div>
          </div>

          <Glossary />

          <div className="reading-strip">
            <div role="status" className="text-sm text-muted">
              {providerName} · {outdated ? "Outdated reading from " : "Reading from "}
              <time dateTime={readingAt}>
                {new Date(
                  Date.parse(readingAt ?? derived.data.updatedAt) +
                    (station ? 19800 : derived.data.utcOffsetSeconds) * 1000,
                ).toLocaleString([], {
                  timeZone: "UTC",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>{" "}
              local time.
              {station && (
                <span className="block">
                  Nearest station: {station.name}, {Math.round(station.distanceKm)} km away
                  {station.count && station.count > 1
                    ? `, blended with ${station.count - 1} more within 30 km`
                    : ""}
                  .
                  {derived.data.calibration && derived.data.calibration !== 1
                    ? ` Forecast adjusted to match them (×${derived.data.calibration}).`
                    : ""}
                </span>
              )}
              {air.checkedAt && (
                <>
                  {" "}
                  Last checked at{" "}
                  {new Date(air.checkedAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                  .
                </>
              )}
              {air.refreshing && <span className="block">Checking for newer data…</span>}
              {!air.refreshing && !outdated && air.sameReading && (
                <span className="block">No newer reading yet.</span>
              )}
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-x-1 text-caption text-muted">
            Data:{" "}
            {derived.data.source === "google"
              ? "Google Air Quality API"
              : derived.data.source === "open-meteo"
                ? "Open-Meteo (Copernicus CAMS)"
                : "Sample data"}
            {derived.data.weather ? " · weather: Open-Meteo" : ""}
            {source === "google"
              ? " · Source: Includes air quality data from Google"
              : " · AQI estimated from hourly fine particles and dust"}{" "}
            · checks every minute
          </p>
        </>
      )}
    </div>
  );
}
