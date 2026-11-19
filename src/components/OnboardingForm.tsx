"use client";

import { updateAccountName } from "@/lib/firebase/auth";
import { ArrowLeft, ArrowRight, Check, Home, MapPin, Plus, Route, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { Logo } from "@/components/layout/Logo";
import { PageHeader, pillPrimary, pillSecondary } from "@/components/ui/PageHeader";
import { DEMO_PROFILE, ProfileSchema, type Member, type Profile } from "@/lib/profile/schema";
import { SAMPLE_PROFILE, useProfile } from "@/lib/profile/store";
import type { Condition } from "@/lib/types";

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "asthma", label: "Asthma" },
  { value: "heart", label: "Heart condition" },
  { value: "copd", label: "COPD / lung disease" },
  { value: "pregnancy", label: "Pregnant" },
  { value: "allergy", label: "Allergies" },
];

const field =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

function Fieldset({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[26px] font-semibold tracking-tight">{legend}</legend>
      {hint && <p className="mt-1 text-[15px] text-muted">{hint}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </fieldset>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[rgb(var(--brand))]"
      />
    </label>
  );
}

function MemberRow({
  member,
  onChange,
  onRemove,
  canRemove,
}: {
  member: Member;
  onChange: (m: Member) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const id = useId();
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
        <div>
          <label htmlFor={`${id}-name`} className="text-xs text-muted">
            First name or nickname
          </label>
          <input
            id={`${id}-name`}
            value={member.name}
            maxLength={30}
            onChange={(e) => onChange({ ...member, name: e.target.value })}
            className={field}
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-age`} className="text-xs text-muted">
            Age group
          </label>
          <select
            id={`${id}-age`}
            value={member.ageGroup}
            onChange={(e) => onChange({ ...member, ageGroup: e.target.value as Member["ageGroup"] })}
            className={field}
          >
            <option value="child">Child (under 14)</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior (60+)</option>
          </select>
        </div>
        <div className="flex items-end">
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-xl p-2 text-muted hover:bg-subtle hover:text-bad"
              aria-label={`Remove ${member.name || "member"}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <fieldset className="mt-3">
        <legend className="text-xs text-muted">Health conditions (optional)</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CONDITIONS.map((c) => {
            const on = member.conditions.includes(c.value);
            return (
              <label key={c.value} className={`chip cursor-pointer ${on ? "border-brand bg-brand/10" : ""}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    onChange({
                      ...member,
                      conditions: on
                        ? member.conditions.filter((x) => x !== c.value)
                        : [...member.conditions, c.value],
                    })
                  }
                />
                {c.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3">
        <Toggle
          label="Goes outdoors daily (walk, play, sport)"
          checked={member.outdoorActivity}
          onChange={(v) => onChange({ ...member, outdoorActivity: v })}
        />
      </div>
    </div>
  );
}

type Step = { id: "where" | "who" | "home" | "travel"; title: string; icon: typeof MapPin };
export const STEPS: Step[] = [
  { id: "where", title: "Where you live", icon: MapPin },
  { id: "who", title: "Who lives with you", icon: Users },
  { id: "home", title: "Your home", icon: Home },
  { id: "travel", title: "Getting around", icon: Route },
];

/** Check one wizard step; returns a plain-language problem or null. */
export function validateStep(step: Step["id"], draft: Profile): string | null {
  switch (step) {
    case "where":
      return draft.locationConfirmed === false
        ? "Choose your city or share your location to continue."
        : null;
    case "who": {
      if (draft.members.some((m) => !m.name.trim())) return "Give everyone a name or nickname.";
      const r = ProfileSchema.shape.members.safeParse(draft.members);
      return r.success ? null : "Please check the people in your household.";
    }
    case "home":
      return ProfileSchema.shape.home.safeParse(draft.home).success
        ? null
        : "Please check the bedroom size and purifier number.";
    case "travel":
      return ProfileSchema.shape.commute.safeParse(draft.commute).success
        ? null
        : "Please check the distance and days per week.";
  }
}

/** First-time draft: the account holder (or an empty name) and no city yet. */
export function freshDraft(base: Profile, isDemo: boolean): Profile {
  if (!isDemo) return { ...base, sample: undefined };
  const first = base.members.length === 1 ? base.members[0] : undefined;
  return {
    ...DEMO_PROFILE,
    locationConfirmed: false,
    sample: undefined,
    members: [
      { id: "me", name: first?.name ?? "", ageGroup: "adult", conditions: [], outdoorActivity: true },
    ],
    home: { ...DEMO_PROFILE.home, usesIncenseOrCoils: false },
    language: base.language,
  };
}

/**
 * Household setup as a 4-step wizard. `setup` is the full-screen first-run flow after sign-up or "Continue as guest";
 * `edit` is the Household page, where every step can be opened directly.
 */
export function OnboardingForm({ mode = "edit" }: { mode?: "setup" | "edit" }) {
  const { profile, save, isDemo } = useProfile();
  return (
    <Wizard
      key={JSON.stringify(profile)}
      initial={freshDraft(profile, isDemo || profile.sample === true)}
      save={save}
      mode={mode}
    />
  );
}

function Wizard({
  initial,
  save,
  mode,
}: {
  initial: Profile;
  save: (p: Profile) => void;
  mode: "setup" | "edit";
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Profile>(initial);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  const update = <K extends keyof Profile>(key: K, value: Profile[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setMember = (i: number, m: Member): void =>
    update(
      "members",
      draft.members.map((x, j) => (j === i ? m : x)),
    );
  const addMember = (): void =>
    update("members", [
      ...draft.members,
      {
        id: `m-${Date.now().toString(36)}`,
        name: "",
        ageGroup: "adult",
        conditions: [],
        outdoorActivity: false,
      },
    ]);
  const num = (v: string, fallback: number): number =>
    Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback;

  const go = (next: number): void => {
    setError(null);
    setIndex(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const finish = (): void => {
    for (const s of STEPS) {
      const problem = validateStep(s.id, draft);
      if (problem) {
        setIndex(STEPS.indexOf(s));
        setError(problem);
        return;
      }
    }
    const parsed = ProfileSchema.safeParse({ ...draft, sample: undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    save(parsed.data);
    const main = parsed.data.members[0]?.name;
    if (main) void updateAccountName(main).catch(() => undefined);
    router.push("/");
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const problem = validateStep(step.id, draft);
    if (problem) {
      setError(problem);
      return;
    }
    if (last) finish();
    else go(index + 1);
  };

  const stepper = (
    <ol className="flex flex-col gap-1" aria-label="Setup steps">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const state = i < index ? "done" : i === index ? "current" : "todo";
        const clickable = mode === "edit" || i < index;
        const inner = (
          <>
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${state === "current" ? "bg-white text-brand-strong" : state === "done" ? "bg-white/25" : "bg-white/10"}`}
            >
              {state === "done" ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span className={state === "todo" ? "text-white/70" : "font-medium"}>{s.title}</span>
          </>
        );
        return (
          <li key={s.id}>
            {clickable ? (
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={state === "current" ? "step" : undefined}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/10"
              >
                {inner}
              </button>
            ) : (
              <span
                aria-current={state === "current" ? "step" : undefined}
                className="flex items-center gap-3 px-2 py-2"
              >
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  const form = (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <div className="mb-8">
        <p className="text-label font-medium text-brand">
          Step {index + 1} of {STEPS.length}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-standard"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div ref={headingRef} key={step.id} tabIndex={-1} className="animate-in flex-1 focus:outline-none">
        {step.id === "where" && (
          <Fieldset
            legend="Where do you live?"
            hint="We use it for live air readings and the hour-by-hour forecast. It is rounded to about 1 km."
          >
            <LocationPicker
              value={draft.locationConfirmed === false ? undefined : draft.location}
              onChange={(location) => setDraft((d) => ({ ...d, location, locationConfirmed: true }))}
            />
          </Fieldset>
        )}
        {step.id === "who" && (
          <Fieldset
            legend="Who lives with you?"
            hint="Children, elders and anyone with heart or lung problems get extra protection in the plan."
          >
            {draft.members.map((m, i) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={draft.members.length > 1}
                onChange={(next) => setMember(i, next)}
                onRemove={() =>
                  update(
                    "members",
                    draft.members.filter((_, j) => j !== i),
                  )
                }
              />
            ))}
            {draft.members.length < 8 && (
              <button
                type="button"
                onClick={addMember}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand/50 px-4 py-2 text-label font-medium text-brand hover:bg-brand/5"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add family member
              </button>
            )}
          </Fieldset>
        )}
        {step.id === "home" && (
          <Fieldset
            legend="Your home"
            hint="Indoor smoke from cooking and coils can matter as much as the air outside."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="stove" className="text-label text-muted">
                  Main cooking fuel
                </label>
                <select
                  id="stove"
                  value={draft.home.stove}
                  onChange={(e) =>
                    update("home", { ...draft.home, stove: e.target.value as Profile["home"]["stove"] })
                  }
                  className={field}
                >
                  <option value="lpg">LPG / piped gas</option>
                  <option value="induction">Induction / electric</option>
                  <option value="kerosene">Kerosene</option>
                  <option value="biomass">Wood / coal / chulha</option>
                </select>
              </div>
              <div>
                <label htmlFor="volume" className="text-label text-muted">
                  Bedroom size in cubic metres (a 3 × 4 m room is about 36)
                </label>
                <input
                  id="volume"
                  type="number"
                  min={10}
                  max={200}
                  value={draft.home.bedroomVolumeM3}
                  onChange={(e) =>
                    update("home", { ...draft.home, bedroomVolumeM3: num(e.target.value, 36) })
                  }
                  className={field}
                />
              </div>
            </div>
            <Toggle
              label="We own an air purifier"
              checked={draft.home.hasPurifier}
              onChange={(v) => update("home", { ...draft.home, hasPurifier: v })}
            />
            {draft.home.hasPurifier && (
              <div>
                <label htmlFor="cadr" className="text-label text-muted">
                  Clean air delivered each hour, in cubic metres. Look for “CADR” on the box. Leave 250 if
                  unsure.
                </label>
                <input
                  id="cadr"
                  type="number"
                  min={0}
                  max={1500}
                  value={draft.home.purifierCadrM3h}
                  onChange={(e) =>
                    update("home", { ...draft.home, purifierCadrM3h: num(e.target.value, 250) })
                  }
                  className={field}
                />
              </div>
            )}
            <Toggle
              label="We use incense, agarbatti or mosquito coils in the evening"
              checked={draft.home.usesIncenseOrCoils}
              onChange={(v) => update("home", { ...draft.home, usesIncenseOrCoils: v })}
            />
            <Toggle
              label="We sometimes burn leaves or waste"
              checked={draft.habits.burnsLeavesOrWaste}
              onChange={(v) => update("habits", { burnsLeavesOrWaste: v })}
            />
          </Fieldset>
        )}
        {step.id === "travel" && (
          <Fieldset legend="Getting around" hint="For whoever travels to work or college most days.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="mode" className="text-label text-muted">
                  Usual way to travel
                </label>
                <select
                  id="mode"
                  value={draft.commute.mode}
                  onChange={(e) =>
                    update("commute", {
                      ...draft.commute,
                      mode: e.target.value as Profile["commute"]["mode"],
                    })
                  }
                  className={field}
                >
                  <option value="car">Car</option>
                  <option value="two_wheeler">Scooter / bike</option>
                  <option value="bus">Bus</option>
                  <option value="metro">Metro</option>
                  <option value="walk_cycle">Walk / cycle</option>
                  <option value="wfh">Work from home</option>
                </select>
              </div>
              <div>
                <label htmlFor="km" className="text-label text-muted">
                  One-way distance in kilometres
                </label>
                <input
                  id="km"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.commute.oneWayKm}
                  onChange={(e) => update("commute", { ...draft.commute, oneWayKm: num(e.target.value, 10) })}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="days" className="text-label text-muted">
                  Days per week
                </label>
                <input
                  id="days"
                  type="number"
                  min={0}
                  max={7}
                  step={1}
                  value={draft.commute.daysPerWeek}
                  onChange={(e) =>
                    update("commute", { ...draft.commute, daysPerWeek: Math.round(num(e.target.value, 5)) })
                  }
                  className={field}
                />
              </div>
            </div>
          </Fieldset>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-bad/10 px-3 py-2.5 text-label text-bad">
          {error}
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        {index > 0 ? (
          <button type="button" onClick={() => go(index - 1)} className={pillSecondary}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          {mode === "edit" && !last && (
            <button type="button" onClick={finish} className={pillSecondary}>
              Save changes
            </button>
          )}
          <button type="submit" className={pillPrimary}>
            {last ? (mode === "setup" ? "Go to my dashboard" : "Save household") : "Continue"}
            {!last && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </form>
  );

  if (mode === "setup") {
    return (
      <div className="app-canvas grid min-h-screen gap-3 p-3 lg:grid-cols-[360px_1fr]">
        <aside className="card-dark flex flex-col justify-between rounded-[28px] p-7 lg:p-9">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo className="h-9 w-9 text-white" />
              <span className="text-xl font-semibold tracking-tight">AirWise</span>
            </div>
            <h1 className="mt-10 text-[30px] font-semibold leading-tight tracking-tight">
              Let&apos;s set up your household
            </h1>
            <p className="mt-2 text-white/75">
              Four quick steps, about a minute. Your answers stay private and shape every number in your plan.
            </p>
            <div className="mt-8">{stepper}</div>
          </div>
          <p className="mt-8 text-caption text-white/70">
            Just looking?{" "}
            <button
              type="button"
              onClick={() => {
                save(SAMPLE_PROFILE);
                router.push("/");
              }}
              className="font-medium text-white underline underline-offset-2"
            >
              Try with a sample family
            </button>
          </p>
        </aside>
        <main id="main" className="panel px-5 py-8 sm:px-10 lg:px-16 lg:py-14">
          <div className="mx-auto max-w-2xl">{form}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your household"
        subtitle="Who you are and how you live shapes every number in your plan. Everything stays private to you."
      />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="card-dark h-fit rounded-card p-5">{stepper}</div>
        <div className="card p-6 sm:p-8">{form}</div>
      </div>
    </div>
  );
}
