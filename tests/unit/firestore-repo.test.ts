import { DEMO_PROFILE } from "@/lib/profile/schema";

const store = new Map<string, Record<string, unknown>>();
const calls: string[] = [];

vi.mock("firebase/firestore", () => {
  const path = (...parts: string[]) => parts.join("/");
  return {
    doc: (_db: unknown, ...parts: string[]) => ({ path: path(...parts) }),
    collection: (_db: unknown, ...parts: string[]) => ({ path: path(...parts) }),
    documentId: () => "__name__",
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    orderBy: () => ({}),
    query: (col: { path: string }, ...constraints: { field?: string; value?: unknown }[]) => ({
      col,
      constraints,
    }),
    serverTimestamp: () => "SERVER_TIME",
    count: () => "count",
    sum: (f: string) => `sum:${f}`,
    setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      calls.push(`set ${ref.path}`);
      store.set(ref.path, data);
    },
    deleteDoc: async (ref: { path: string }) => {
      calls.push(`delete ${ref.path}`);
      store.delete(ref.path);
    },
    getDoc: async (ref: { path: string }) => ({ data: () => store.get(ref.path) }),
    getDocs: async (q: { path?: string; col?: { path: string } }) => {
      const prefix = `${q.col?.path ?? q.path}/`;
      const docs = [...store.entries()]
        .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
        .map(([k, v]) => ({ id: k.slice(prefix.length), ref: { path: k }, data: () => v }));
      return { docs };
    },
    getAggregateFromServer: async (q: { col: { path: string }; constraints: { value?: unknown }[] }) => {
      const city = q.constraints[0]?.value;
      const pledges = [...store.entries()]
        .filter(([k, v]) => k.startsWith("airwise_pledges/") && v.city === city)
        .map(([, v]) => v);
      return {
        data: () => ({ families: pledges.length, co2: pledges.reduce((s, p) => s + Number(p.co2KgWeek), 0) }),
      };
    },
  };
});

const repo = await import("@/lib/firebase/repo");
const db = {} as never;

beforeEach(() => {
  store.clear();
  calls.length = 0;
});

describe("Firestore repository", () => {
  it("rounds the synced location and uses a server timestamp", async () => {
    await repo.saveProfile(db, "u1", DEMO_PROFILE);
    expect(store.get("airwise_users/u1")?.updatedAt).toBe("SERVER_TIME");
    await expect(repo.loadProfile(db, "u1")).resolves.toEqual({
      ...DEMO_PROFILE,
      location: { name: "New Delhi", lat: 28.61, lon: 77.21 },
    });
  });

  it("returns null for missing or malformed profiles", async () => {
    await expect(repo.loadProfile(db, "nobody")).resolves.toBeNull();
    store.set("airwise_users/bad", { profile: { version: 9 } });
    await expect(repo.loadProfile(db, "bad")).resolves.toBeNull();
  });

  it("refuses to write invalid day records", async () => {
    await expect(repo.saveDay(db, "u1", { date: "yesterday" } as never)).rejects.toThrow();
  });

  it("saves and reads back day records, skipping malformed ones", async () => {
    const rec = {
      date: "2026-11-18",
      city: "Delhi",
      aqi: 310,
      planIds: ["a"],
      doneIds: ["a"],
      plannedExposurePct: 40,
      co2KgDone: 2,
      pm25GDone: 0.1,
    };
    await repo.saveDay(db, "u1", rec);
    store.set("airwise_users/u1/days/2026-11-17", { junk: true });
    const days = await repo.loadDaysSince(db, "u1", "2026-11-12");
    expect(days).toEqual([rec]);
  });

  it("aggregates community pledges per city", async () => {
    await repo.savePledge(db, "u1", { city: "new-delhi", actions: ["carpool"], co2KgWeek: 9 });
    await repo.savePledge(db, "u2", { city: "new-delhi", actions: ["transit_commute"], co2KgWeek: 15.04 });
    await repo.savePledge(db, "u3", { city: "lucknow", actions: [], co2KgWeek: 3 });
    await expect(repo.communityStats(db, "new-delhi")).resolves.toEqual({ families: 2, co2KgWeek: 24 });
    await expect(repo.loadPledge(db, "u1")).resolves.toMatchObject({ city: "new-delhi" });
    await repo.removePledge(db, "u1");
    await expect(repo.loadPledge(db, "u1")).resolves.toBeNull();
  });

  it("never touches another app's collections in the shared project", async () => {
    await repo.saveProfile(db, "u1", DEMO_PROFILE);
    await repo.savePledge(db, "u1", { city: "d", actions: [], co2KgWeek: 0 });
    expect([...store.keys()].every((k) => k.startsWith("airwise_"))).toBe(true);
  });

  it("deletes all of a user's cloud data", async () => {
    await repo.saveProfile(db, "u1", DEMO_PROFILE);
    await repo.saveDay(db, "u1", {
      date: "2026-11-18",
      city: "D",
      aqi: 1,
      planIds: [],
      doneIds: [],
      plannedExposurePct: 0,
      co2KgDone: 0,
      pm25GDone: 0,
    });
    await repo.savePledge(db, "u1", { city: "d", actions: [], co2KgWeek: 0 });
    await repo.deleteUserData(db, "u1");
    expect([...store.keys()].filter((k) => k.includes("u1"))).toEqual([]);
  });
});
