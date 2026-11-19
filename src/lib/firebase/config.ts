import type { FirebaseOptions } from "firebase/app";

/**
 * Firebase web config. These values identify the project and are safe to ship to the browser;
 * access control is enforced by `firestore.rules`. Each variable is referenced literally so Next.js inlines it.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

/** Cloud features switch on only when the required keys are present; otherwise AirWise stays local-only. */
export function isFirebaseConfigured(config: FirebaseOptions = firebaseConfig): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}
