"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: FirebaseHandles | null | undefined;

/** Lazily initialised Firebase app, Auth and Firestore (with offline IndexedDB cache); null when not configured. */
export function getFirebase(): FirebaseHandles | null {
  if (handles !== undefined) return handles;
  if (typeof window === "undefined" || !isFirebaseConfigured()) {
    handles = null;
    return handles;
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app); // already initialised (hot reload)
  }
  handles = { app, auth: getAuth(app), db };
  return handles;
}
