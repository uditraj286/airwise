"use client";

import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { Segmented } from "@/components/ui/Segmented";
import {
  AccountExistsError,
  SignInSchema,
  SignUpSchema,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useCloudStatus } from "@/lib/firebase/sync";
import { SAMPLE_PROFILE, useProfile } from "@/lib/profile/store";

type Mode = "signin" | "signup";
type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

function Field({
  label,
  error,
  children,
  id,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  id: string;
  hint?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-label font-medium">
          {label}
        </label>
        {hint}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-caption text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

const input =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] transition-colors duration-200 placeholder:text-muted/70 focus:border-ink focus:outline-none aria-[invalid=true]:border-bad";

/** Sign in / create account form with Google, inline validation and guest access. */
export function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const cloud = useCloudStatus();
  const { save } = useProfile();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ids = { name: useId(), email: useId(), password: useId() };
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/";

  const finish = (): void => router.push(next);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setNotice(null);
    const parsed =
      mode === "signup"
        ? SignUpSchema.safeParse({ name, email, password })
        : SignInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy("email");
    try {
      if (mode === "signup") await signUpWithEmail({ name, email, password });
      else await signInWithEmail({ email, password });
      finish();
    } catch (err) {
      if (err instanceof AccountExistsError) {
        // Same email, wrong or different password: move them to sign-in with the email kept.
        setMode("signin");
        setPassword("");
        setNotice(err.message);
        return;
      }
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = async (): Promise<void> => {
    setErrors({});
    setBusy("google");
    try {
      await signInWithGoogle();
      finish();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onForgot = async (): Promise<void> => {
    setErrors({});
    try {
      await resetPassword(email);
      setNotice(`We've sent a reset link to ${email.trim()}. Check your inbox.`);
    } catch (err) {
      setErrors({ email: (err as Error).message });
    }
  };

  if (cloud.state === "ready" && !cloud.isAnonymous) {
    return (
      <div className="animate-in w-full max-w-sm text-center">
        <h1 className="text-2xl font-medium tracking-tight">You&apos;re signed in</h1>
        <p className="mt-2 text-muted">{cloud.email ?? cloud.name}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-label font-medium text-onbrand"
        >
          Go to your dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in w-full max-w-sm">
      <h1 className="text-[28px] font-medium tracking-tight">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-muted">
        {mode === "signin"
          ? "Sign in to see your family's plan on any device."
          : "Save your household and progress, and pick up on any device."}
      </p>

      {!isFirebaseConfigured() && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-line bg-subtle px-3.5 py-2.5 text-caption text-muted"
        >
          Accounts are switched off on this deployment, so sign-in won&apos;t work here yet. You can still use
          everything as a guest; your household stays on this device.
        </p>
      )}

      <div className="mt-6">
        <Segmented<Mode>
          label="Account"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrors({});
            setNotice(null);
          }}
          options={[
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={busy !== null}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 hover:bg-subtle disabled:opacity-60"
      >
        {busy === "google" ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-caption text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
        {mode === "signup" && (
          <Field label="Your name" id={ids.name} error={errors.name}>
            <input
              id={ids.name}
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              placeholder="Priya"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
            />
          </Field>
        )}
        <Field label="Email" id={ids.email} error={errors.email}>
          <input
            id={ids.email}
            type="email"
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${ids.email}-error` : undefined}
          />
        </Field>
        <Field
          label="Password"
          id={ids.password}
          error={errors.password}
          hint={
            mode === "signin" ? (
              <button
                type="button"
                onClick={() => void onForgot()}
                className="text-caption text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Forgot password?
              </button>
            ) : (
              <span className="text-caption text-muted">8+ characters</span>
            )
          }
        >
          <div className="relative">
            <input
              id={ids.password}
              type={show ? "text" : "password"}
              className={`${input} pr-11`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? `${ids.password}-error` : undefined}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
            >
              {show ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        {errors.form && (
          <div role="alert" className="rounded-xl bg-bad/10 px-3 py-2.5 text-label text-bad">
            <p>{errors.form}</p>
            {mode === "signin" && email && (
              <button
                type="button"
                onClick={() => void onForgot()}
                className="mt-1.5 font-medium underline underline-offset-2"
              >
                Email me a reset link
              </button>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-brand/10 px-3 py-2.5 text-label text-ink">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-[15px] font-medium text-onbrand transition-colors duration-200 hover:bg-brand-strong disabled:opacity-60"
        >
          {busy === "email" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-label text-muted">
        <p>
          Just looking?{" "}
          <button
            type="button"
            onClick={() => router.push("/setup?new=1")}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            Continue as a guest
          </button>
        </p>
        <button
          type="button"
          onClick={() => {
            save(SAMPLE_PROFILE);
            router.push("/");
          }}
          className="text-caption underline-offset-2 hover:text-ink hover:underline"
        >
          Or try AirWise with a sample family
        </button>
      </div>
      <p className="mt-3 text-center text-caption text-muted">
        Your household details stay private to your account.
      </p>
    </div>
  );
}
