"use client";

import { Cloud, LogIn, LogOut, Settings, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutUser } from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useCloudStatus } from "@/lib/firebase/sync";

/** Avatar button with an account menu: who you are, sign in / create account, or sign out. */
export function AccountMenu({ fallbackInitial }: { fallbackInitial: string }) {
  const cloud = useCloudStatus();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const signedIn = cloud.state === "ready" && !cloud.isAnonymous;
  const label = signedIn ? (cloud.name ?? cloud.email ?? "Account") : "Guest";
  const initial = (signedIn ? (cloud.name ?? cloud.email ?? "A") : fallbackInitial).slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-label hover:bg-subtle";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-105 ${
          signedIn ? "bg-brand text-onbrand" : "bg-ink text-surface"
        }`}
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="card animate-in absolute right-0 z-30 mt-2 w-64 p-1.5">
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-label font-medium">{label}</p>
            <p className="truncate text-caption text-muted">
              {signedIn
                ? cloud.email
                : isFirebaseConfigured()
                  ? "Saved on this device only"
                  : "Accounts are off on this deployment"}
            </p>
          </div>
          <div className="my-1 h-px bg-line" />
          {signedIn ? (
            <>
              <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}>
                <Settings className="h-4 w-4" aria-hidden="true" /> Settings
              </Link>
              <button
                role="menuitem"
                type="button"
                className={item}
                onClick={async () => {
                  setOpen(false);
                  await signOutUser().catch(() => undefined);
                  router.push("/login");
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
              </button>
            </>
          ) : isFirebaseConfigured() ? (
            <>
              <Link role="menuitem" href="/login" className={item} onClick={() => setOpen(false)}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
              </Link>
              <Link role="menuitem" href="/login?mode=signup" className={item} onClick={() => setOpen(false)}>
                <UserPlus className="h-4 w-4" aria-hidden="true" /> Create an account
              </Link>
              <p className="flex items-start gap-2 px-2.5 py-2 text-caption text-muted">
                <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Your guest data moves
                into your new account.
              </p>
            </>
          ) : (
            <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}>
              <Settings className="h-4 w-4" aria-hidden="true" /> Settings
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
