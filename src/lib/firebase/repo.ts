import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getAggregateFromServer,
  getDoc,
  getDocs,
  count,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  sum,
  where,
  type Firestore,
} from "firebase/firestore";
import { z } from "zod";
import { ProfileSchema, type Profile } from "@/lib/profile/schema";

/**
 * Collection names are namespaced with `airwise_` because the Firebase project is shared with another app
 * (StadiumOS); AirWise must never read or overwrite that app's documents.
 */
export const COLLECTIONS = { users: "airwise_users", days: "days", pledges: "airwise_pledges" } as const;

/**
 * Firestore data model
 *   airwise_users/{uid}                    { profile, updatedAt }
 *   airwise_users/{uid}/days/{yyyy-mm-dd}  DayRecord — the family's plan and progress log
 *   airwise_pledges/{uid}                  Pledge — anonymous community commitments, aggregated per city
 * Everything read back is validated with zod, so a malformed document can never crash the UI.
 */

export const DayRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().max(80),
  aqi: z.number().min(0).max(1000),
  planIds: z.array(z.string().max(40)).max(11),
  doneIds: z.array(z.string().max(40)).max(11),
  plannedExposurePct: z.number().min(0).max(100),
  co2KgDone: z.number().min(0).max(100),
  pm25GDone: z.number().min(0).max(100),
});
export type DayRecord = z.infer<typeof DayRecordSchema>;

export const PledgeSchema = z.object({
  city: z.string().min(1).max(60),
  actions: z.array(z.string().max(40)).max(11),
  co2KgWeek: z.number().min(0).max(500),
});
export type Pledge = z.infer<typeof PledgeSchema>;

export interface CommunityStats {
  families: number;
  co2KgWeek: number;
}

/** Normalise a place name to a city key shared by neighbours: "New Delhi, Delhi, India" → "new-delhi". */
export function cityKey(name: string): string {
  const first = name.split(",")[0] ?? name;
  return (
    first
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "unknown"
  );
}

const userDoc = (db: Firestore, uid: string) => doc(db, COLLECTIONS.users, uid);

export async function loadProfile(db: Firestore, uid: string): Promise<Profile | null> {
  const snap = await getDoc(userDoc(db, uid));
  const parsed = ProfileSchema.safeParse(snap.data()?.profile);
  return parsed.success ? parsed.data : null;
}

export async function saveProfile(db: Firestore, uid: string, profile: Profile): Promise<void> {
  const { name, lat, lon } = profile.location;
  const location = { name, lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)) };
  await setDoc(userDoc(db, uid), {
    profile: ProfileSchema.parse({ ...profile, location }),
    updatedAt: serverTimestamp(),
  });
}

export async function saveDay(db: Firestore, uid: string, record: DayRecord): Promise<void> {
  const data = DayRecordSchema.parse(record);
  await setDoc(doc(db, COLLECTIONS.users, uid, COLLECTIONS.days, data.date), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Day records from `fromDate` (inclusive) onward, oldest first. */
export async function loadDaysSince(db: Firestore, uid: string, fromDate: string): Promise<DayRecord[]> {
  const q = query(
    collection(db, COLLECTIONS.users, uid, COLLECTIONS.days),
    where(documentId(), ">=", fromDate),
    orderBy(documentId()),
  );
  const snap = await getDocs(q);
  return snap.docs.flatMap((d) => {
    const parsed = DayRecordSchema.safeParse(d.data());
    return parsed.success ? [parsed.data] : [];
  });
}

export async function savePledge(db: Firestore, uid: string, pledge: Pledge): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.pledges, uid), {
    ...PledgeSchema.parse(pledge),
    updatedAt: serverTimestamp(),
  });
}

export async function loadPledge(db: Firestore, uid: string): Promise<Pledge | null> {
  const parsed = PledgeSchema.safeParse((await getDoc(doc(db, COLLECTIONS.pledges, uid))).data());
  return parsed.success ? parsed.data : null;
}

export async function removePledge(db: Firestore, uid: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.pledges, uid));
}

/** Server-side aggregation: how many families in this city pledged, and their combined weekly CO₂ savings. */
export async function communityStats(db: Firestore, city: string): Promise<CommunityStats> {
  const q = query(collection(db, COLLECTIONS.pledges), where("city", "==", city));
  const agg = await getAggregateFromServer(q, { families: count(), co2: sum("co2KgWeek") });
  const data = agg.data();
  return { families: data.families, co2KgWeek: Math.round((data.co2 ?? 0) * 10) / 10 };
}

/** Delete everything this user stored in the cloud (profile, day log, pledge). */
export async function deleteUserData(db: Firestore, uid: string): Promise<void> {
  const days = await getDocs(collection(db, COLLECTIONS.users, uid, COLLECTIONS.days));
  await Promise.all([
    ...days.docs.map((d) => deleteDoc(d.ref)),
    deleteDoc(userDoc(db, uid)),
    removePledge(db, uid),
  ]);
}
