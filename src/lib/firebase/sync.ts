"use client";

import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import { useSyncExternalStore } from "react";
import { getFirebase } from "@/lib/firebase/client";
import { buildDayRecord } from "@/lib/firebase/dayRecord";
import { deleteUserData, loadProfile, saveDay, saveProfile } from "@/lib/firebase/repo";
import { ProfileSchema } from "@/lib/profile/schema";
import { doneStore, planStore, profileStore, setAccountOwner, todayKey } from "@/lib/profile/store";

export type CloudState =
  | { state: "off" }
  | { state: "connecting" }
  | {
      state: "ready";
      uid: string;
      isAnonymous: boolean;
      email: string | null;
      name: string | null;
      lastSyncedAt: number | null;
    }
  | { state: "error"; message: string };

const OFF: CloudState = { state: "off" };
let status: CloudState = OFF;
const listeners = new Set<() => void>();
const setStatus = (next: CloudState): void => {
  setAccountOwner(
    next.state === "ready" && !next.isAnonymous ? (next.name ?? next.email?.split("@")[0] ?? null) : null,
  );
  status = next;
  listeners.forEach((l) => l());
};

/** Reactive cloud status for the UI (Settings badge, community card, weekly history). */
export function useCloudStatus(): CloudState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => OFF, // stable reference: a new object per call makes React re-render in a loop
  );
}

/** Publish the signed-in user's identity to the UI (also used after linking, which doesn't fire an auth event). */
export function refreshCloudUser(user: User): void {
  setStatus({
    state: "ready",
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    email: user.email,
    name:
      user.displayName ||
      user.providerData?.find((provider) => provider.providerId === "google.com")?.displayName ||
      null,
    lastSyncedAt: status.state === "ready" ? status.lastSyncedAt : null,
  });
}

/** Human-readable explanation for common Firebase setup errors. */
export function friendlyCloudError(err: { code?: string; message?: string }): string {
  switch (err.code) {
    case "auth/admin-restricted-operation":
      return "Anonymous sign-in is disabled. Enable it in Firebase console → Authentication → Sign-in method.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled for the Firebase project yet (Authentication → Sign-in method).";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. If you joined with Google, use Continue with Google, or reset your password below.";
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/account-exists-with-different-credential":
      return "This email is already linked to another sign-in method. Sign in with your email and password instead.";
    case "auth/user-disabled":
      return "This account has been turned off. Contact support for help.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute, then try again.";
    case "auth/requires-recent-login":
      return "For your security, sign in again to do that.";
    case "auth/network-request-failed":
      return "You appear to be offline. Your data is saved on this device and will sync later.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised. Add it in Firebase console → Authentication → Settings → Authorized domains.";
    default:
      return err.message ?? "Unknown error";
  }
}

let started = false;
let applyingRemote = false;
let revision = 0;

function localProfileKey(uid: string): string {
  return `airwise.account-profile.${uid}`;
}

function preserveProfile(uid: string): void {
  try {
    const profile = profileStore.read();
    if (profile) localStorage.setItem(localProfileKey(uid), JSON.stringify(profile));
    else localStorage.removeItem(localProfileKey(uid));
  } catch {
    // Cloud storage remains available when browser storage is disabled.
  }
}

function switchProfile(uid: string): void {
  clearTimeout(profileTimer);
  try {
    const previous = localStorage.getItem("airwise.active-profile");
    localStorage.setItem("airwise.active-profile", uid);
    if (!previous || previous === uid) return;
    applyingRemote = true;
    const saved = localStorage.getItem(localProfileKey(uid));
    const parsed = ProfileSchema.safeParse(saved ? JSON.parse(saved) : null);
    profileStore.write(parsed.success ? parsed.data : null);
    doneStore.write(null);
    planStore.write(null);
    localStorage.removeItem("airwise.chat.v1");
  } catch {
    // Restore from the cloud if the local copy is unavailable.
  } finally {
    applyingRemote = false;
  }
}
let currentUid: string | null = null;
let profileTimer: ReturnType<typeof setTimeout> | undefined;

function markSynced(): void {
  if (status.state === "ready") setStatus({ ...status, lastSyncedAt: Date.now() });
}

function fail(err: unknown): void {
  console.warn("Cloud sync error:", (err as Error).message);
}

/** Push the saved (non-demo) profile, debounced so form edits don't spam writes. */
function queueProfilePush(): void {
  const fb = getFirebase();
  const profile = profileStore.read();
  if (!fb || !currentUid || applyingRemote) return;
  preserveProfile(currentUid);
  clearTimeout(profileTimer);
  if (!profile) return;
  const uid = currentUid;
  profileTimer = setTimeout(() => {
    saveProfile(fb.db, uid, profile).then(markSynced, fail);
  }, 600);
}

/** Log today's plan and progress to airwise_users/{uid}/days/{date}. */
function pushDay(): void {
  const fb = getFirebase();
  const cached = planStore.read();
  if (!fb || !currentUid || applyingRemote || !cached || cached.date !== todayKey()) return;
  const done = doneStore.read();
  const doneIds = done && done.date === todayKey() ? done.ids : [];
  saveDay(fb.db, currentUid, buildDayRecord(cached.date, cached.plan, doneIds)).then(markSynced, fail);
}

/** Restore the account profile locally, using Firestore on a device without a saved copy. */
async function reconcile(user: User): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const run = ++revision;
  switchProfile(user.uid);
  currentUid = user.uid;
  const local = profileStore.read();
  setStatus({ state: "connecting" });
  try {
    const remote = await loadProfile(fb.db, user.uid);
    if (run !== revision) return;
    if (remote && !local && !profileStore.read()) {
      applyingRemote = true;
      profileStore.write(remote);
      applyingRemote = false;
    } else if (profileStore.read()) {
      void saveProfile(fb.db, user.uid, profileStore.read()!).catch(fail);
    }
    preserveProfile(user.uid);
    refreshCloudUser(user);
    pushDay();
    markSynced();
  } catch (err) {
    if (run !== revision) return;
    applyingRemote = false;
    refreshCloudUser(user);
    fail(err);
  }
}

/** Start syncing once per page load. Signs in anonymously so no personal account is required. */
export function startCloudSync(): void {
  if (started) return;
  started = true;
  const fb = getFirebase();
  if (!fb) return;
  setStatus({ state: "connecting" });
  onAuthStateChanged(fb.auth, (user) => {
    if (!user) {
      revision += 1;
      clearTimeout(profileTimer);
      currentUid = null;
      setStatus({ state: "connecting" });
      signInAnonymously(fb.auth).catch((err: { code?: string; message?: string }) =>
        setStatus({ state: "error", message: friendlyCloudError(err) }),
      );
      return;
    }
    void reconcile(user);
  });
  profileStore.subscribe(queueProfilePush);
  doneStore.subscribe(pushDay);
  planStore.subscribe(pushDay);
}

/**
 * Upgrade the anonymous account to Google so the same data follows the family to other devices.
 * If that Google account already has AirWise data, switch to it (its cloud copy is restored).
 */
export async function linkGoogleAccount(): Promise<void> {
  const fb = getFirebase();
  if (!fb?.auth.currentUser) throw new Error("Cloud sync is not available.");
  const provider = new GoogleAuthProvider();
  try {
    const { user } = await linkWithPopup(fb.auth.currentUser, provider);
    await reconcile(user);
  } catch (err) {
    const credential = GoogleAuthProvider.credentialFromError(err as never);
    if ((err as { code?: string }).code === "auth/credential-already-in-use" && credential) {
      await signInWithCredential(fb.auth, credential); // onAuthStateChanged reconciles
      return;
    }
    throw new Error(friendlyCloudError(err as { code?: string; message?: string }));
  }
}

/** Sign out of Google; a fresh anonymous session starts automatically. */
export async function signOutCloud(): Promise<void> {
  const fb = getFirebase();
  if (fb) await signOut(fb.auth);
}

/** Remove this user's cloud data (profile, day log, pledge). */
export async function deleteCloudData(): Promise<void> {
  clearTimeout(profileTimer);
  const fb = getFirebase();
  if (fb && currentUid) await deleteUserData(fb.db, currentUid);
}
