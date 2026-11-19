"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { AirProvider } from "@/lib/airContext";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { startCloudSync, useCloudStatus } from "@/lib/firebase/sync";
import { useProfile } from "@/lib/profile/store";
import { AlertsWatcher } from "@/lib/useAlerts";

const noopSubscribe = (): (() => void) => () => undefined;

/** Pages that work before a household exists. */
const OPEN_PATHS = new Set(["/login", "/setup", "/onboarding"]);

/**
 * Decide where a visitor without a household should go. Returns null while we can't tell yet (cloud sync may
 * still be loading a returning user's saved household) or when no redirect is needed.
 */
export function setupRedirect(input: {
  pathname: string;
  hasHousehold: boolean;
  locationConfirmed: boolean;
  syncSettled: boolean;
  signedIn: boolean;
}): string | null {
  if (OPEN_PATHS.has(input.pathname) || !input.syncSettled) return null;
  if (input.hasHousehold && input.locationConfirmed) return null;
  // Signed-in people already chose an account: go straight to setup. Everyone else starts at the welcome page.
  return input.signedIn ? "/setup" : "/login";
}

/** Full-screen app frame from the reference: grey panels (sidebar, top bar, main) holding white cards. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { profile, isDemo } = useProfile();
  const cloud = useCloudStatus();
  const pathname = usePathname();
  const router = useRouter();
  // False during server render and hydration, true afterwards (avoids redirecting before local data is readable).
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    startCloudSync();
  }, []);
  useEffect(() => {
    document.documentElement.lang = profile.language;
  }, [profile.language]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const signedIn = cloud.state === "ready" && !cloud.isAnonymous;
  const syncSettled =
    mounted &&
    (cloud.state === "error" ||
      (cloud.state === "off" && !isFirebaseConfigured()) ||
      (cloud.state === "ready" && cloud.lastSyncedAt !== null));
  const redirect = setupRedirect({
    pathname,
    hasHousehold: !isDemo,
    locationConfirmed: profile.locationConfirmed !== false,
    syncSettled,
    signedIn,
  });
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  const skipLink = (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
    >
      Skip to content
    </a>
  );

  // Sign-in and first-time setup are focused, full-screen flows without app chrome.
  if (pathname === "/login" || pathname === "/setup") {
    return (
      <>
        {skipLink}
        {children}
      </>
    );
  }

  const deciding = isDemo && !OPEN_PATHS.has(pathname) && (!syncSettled || redirect !== null);

  return (
    <AirProvider location={profile.location}>
      {skipLink}
      <AlertsWatcher />
      <div className="app-canvas flex min-h-screen gap-3 p-0 lg:p-3">
        <aside className="hidden w-[272px] shrink-0 lg:block">
          <div className="sticky top-3 h-[calc(100vh-24px)]">
            <Sidebar />
          </div>
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[280px] p-2">
              <Sidebar onNavigate={() => setDrawer(false)} onCollapse={() => setDrawer(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-2 lg:p-0">
          <Topbar onMenu={() => setDrawer(true)} />
          <main id="main" tabIndex={-1} className="panel flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {deciding ? (
              <div role="status" aria-label="Loading your household">
                <DashboardSkeleton />
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </AirProvider>
  );
}
