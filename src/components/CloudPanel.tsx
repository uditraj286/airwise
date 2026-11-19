"use client";

import { Cloud, CloudOff, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { signOutUser } from "@/lib/firebase/auth";
import { useCloudStatus } from "@/lib/firebase/sync";

/** Firebase sync status with an optional Google upgrade for cross-device sync. */
export function CloudPanel() {
  const cloud = useCloudStatus();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        {cloud.state === "ready" ? (
          <Cloud className="h-5 w-5 text-good" aria-hidden="true" />
        ) : (
          <CloudOff className="h-5 w-5 text-muted" aria-hidden="true" />
        )}
        Cloud sync (Firebase)
      </h2>
      <div className="mt-2 text-sm" role="status">
        {!isFirebaseConfigured() && (
          <p className="text-muted">Not configured on this deployment — data stays on this device only.</p>
        )}
        {isFirebaseConfigured() && cloud.state === "connecting" && <p className="text-muted">Connecting…</p>}
        {cloud.state === "error" && <p className="text-bad">Could not connect: {cloud.message}</p>}
        {cloud.state === "ready" && (
          <p>
            <span className="font-medium text-good">On</span> ·{" "}
            {cloud.isAnonymous
              ? "guest on this device"
              : `signed in as ${cloud.email ?? cloud.name ?? "you"}`}
            {cloud.lastSyncedAt && (
              <span className="text-muted">
                {" "}
                · last synced{" "}
                {new Date(cloud.lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </p>
        )}
      </div>
      {cloud.state === "ready" && (
        <div className="mt-4">
          {cloud.isAnonymous ? (
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-muted"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Create an account to sync across devices
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(signOutUser)}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-muted disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </Card>
  );
}
