"use client";

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { z } from "zod";
import { getFirebase } from "@/lib/firebase/client";
import { friendlyCloudError, linkGoogleAccount, refreshCloudUser } from "@/lib/firebase/sync";

export const SignInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const SignUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(40, "Keep it under 40 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export type SignInInput = z.infer<typeof SignInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;

/** Wrap Firebase errors so the UI only ever shows a friendly sentence. */
async function friendly<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(friendlyCloudError(err as { code?: string; message?: string }));
  }
}

function requireFirebase(): NonNullable<ReturnType<typeof getFirebase>> {
  const fb = getFirebase();
  if (!fb) throw new Error("Accounts aren't available on this deployment.");
  return fb;
}

/** Thrown when someone tries to create an account for an email that already has one. */
export class AccountExistsError extends Error {
  constructor(readonly email: string) {
    super(
      "You already have an account with this email. Sign in with your password, or use Continue with Google if that's how you joined.",
    );
    this.name = "AccountExistsError";
  }
}

export const accountsAvailable = (): boolean => getFirebase() !== null;

/**
 * Create an account. When the visitor is already using AirWise as a guest, the guest account is upgraded in place
 * (linkWithCredential), so their household, plan history and pledges carry over.
 */
export async function signUpWithEmail(input: SignUpInput): Promise<"created" | "signed-in"> {
  const { name, email, password } = SignUpSchema.parse(input);
  const fb = requireFirebase();
  try {
    const current = fb.auth.currentUser;
    const user = current?.isAnonymous
      ? (await linkWithCredential(current, EmailAuthProvider.credential(email, password))).user
      : (await createUserWithEmailAndPassword(fb.auth, email, password)).user;
    await updateProfile(user, { displayName: name });
    refreshCloudUser(user);
    return "created";
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/email-already-in-use" && code !== "auth/credential-already-in-use") {
      throw new Error(friendlyCloudError(err as { code?: string; message?: string }));
    }
  }
  // The email is already registered. If the password is right, just sign them in: they meant to log in.
  try {
    await signInWithEmailAndPassword(fb.auth, email, password);
    return "signed-in";
  } catch {
    throw new AccountExistsError(email);
  }
}

/**
 * Keep the account's display name in step with the household's main member, so the top bar, the account menu and
 * Firebase all show the name the user chose. Guests have no account name, so nothing happens for them.
 */
export async function updateAccountName(name: string): Promise<void> {
  const fb = getFirebase();
  const user = fb?.auth.currentUser;
  const clean = name.trim().slice(0, 40);
  if (!user || user.isAnonymous || !clean || user.displayName === clean) return;
  await friendly(() => updateProfile(user, { displayName: clean }));
  refreshCloudUser(user);
}

/** Sign in to an existing account; its saved cloud data replaces the guest data on this device. */
export async function signInWithEmail(input: SignInInput): Promise<void> {
  const { email, password } = SignInSchema.parse(input);
  const fb = requireFirebase();
  await friendly(() => signInWithEmailAndPassword(fb.auth, email, password));
}

/** Google sign-in: upgrades a guest session when possible, otherwise a normal popup sign-in. */
export async function signInWithGoogle(): Promise<void> {
  const fb = requireFirebase();
  if (fb.auth.currentUser?.isAnonymous) {
    await linkGoogleAccount();
    return;
  }
  await friendly(() => signInWithPopup(fb.auth, new GoogleAuthProvider()));
}

export async function resetPassword(email: string): Promise<void> {
  const parsed = SignInSchema.shape.email.safeParse(email);
  if (!parsed.success) throw new Error("Enter your email above first.");
  const fb = requireFirebase();
  await friendly(() => sendPasswordResetEmail(fb.auth, parsed.data));
}

/** Sign out. The auth listener switches AirWise to a separate guest profile. */
export async function signOutUser(): Promise<void> {
  const fb = requireFirebase();
  await friendly(() => signOut(fb.auth));
}
