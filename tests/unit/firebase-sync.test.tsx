import { act, renderHook, waitFor } from "@testing-library/react";
import { DEMO_PROFILE } from "@/lib/profile/schema";

type AuthCb = (user: unknown) => void;
let authCallback: AuthCb = () => undefined;
const auth = { currentUser: { uid: "anon-1" } as unknown };

const repo = {
  loadProfile: vi.fn(),
  saveProfile: vi.fn().mockResolvedValue(undefined),
  saveDay: vi.fn().mockResolvedValue(undefined),
  deleteUserData: vi.fn().mockResolvedValue(undefined),
  loadDaysSince: vi.fn().mockResolvedValue([]),
  communityStats: vi.fn().mockResolvedValue({ families: 3, co2KgWeek: 40 }),
  loadPledge: vi.fn().mockResolvedValue(null),
  savePledge: vi.fn().mockResolvedValue(undefined),
  removePledge: vi.fn().mockResolvedValue(undefined),
};
const authFns = {
  onAuthStateChanged: vi.fn((_a: unknown, cb: AuthCb) => {
    authCallback = cb;
    return () => undefined;
  }),
  signInAnonymously: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  linkWithPopup: vi.fn(),
  signInWithCredential: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/firebase/client", () => ({ getFirebase: () => ({ app: {}, auth, db: {} }) }));
vi.mock("@/lib/firebase/repo", async (orig) => ({ ...(await orig<object>()), ...repo }));
vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    static credentialFromError = vi.fn(() => ({ token: "t" }));
  }
  return { ...authFns, GoogleAuthProvider };
});

const sync = await import("@/lib/firebase/sync");
const hooks = await import("@/lib/firebase/hooks");
const { planStore, doneStore, profileStore, todayKey } = await import("@/lib/profile/store");

const user = (over: object = {}) => ({ uid: "anon-1", isAnonymous: true, email: null, ...over });
const plan = {
  items: [{ actionId: "carpool", impact: { co2KgWeek: 7, pm25GWeek: 0.7 } }],
  impact: { exposureReductionPct: 30 },
  air: { aqi: 320, location: "New Delhi" },
};

describe("cloud sync", () => {
  beforeAll(() => sync.startCloudSync());

  it("signs in anonymously when there is no user", async () => {
    authCallback(null);
    expect(authFns.signInAnonymously).toHaveBeenCalled();
    const before = authCallback;
    sync.startCloudSync(); // idempotent: no second auth listener
    expect(authCallback).toBe(before);
  });

  it("restores the cloud profile on sign-in and reports ready", async () => {
    repo.loadProfile.mockResolvedValueOnce({ ...DEMO_PROFILE, language: "hi" });
    const { result } = renderHook(() => sync.useCloudStatus());
    await act(async () => authCallback(user()));
    await waitFor(() => expect(profileStore.read()?.language).toBe("hi"));
    expect(result.current).toMatchObject({ state: "ready", uid: "anon-1", isAnonymous: true });
    expect(repo.saveProfile).not.toHaveBeenCalled();
  });

  it("uploads the local profile when the cloud has none", async () => {
    repo.loadProfile.mockResolvedValueOnce(null);
    await act(async () => authCallback(user()));
    await waitFor(() => expect(repo.saveProfile).toHaveBeenCalled());
  });

  it("debounces profile pushes after local edits", async () => {
    vi.useFakeTimers();
    repo.saveProfile.mockClear();
    profileStore.write({ ...DEMO_PROFILE, language: "en" });
    profileStore.write({ ...DEMO_PROFILE, language: "hi" });
    await vi.advanceTimersByTimeAsync(700);
    expect(repo.saveProfile).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("logs today's plan and progress", async () => {
    repo.saveDay.mockClear();
    planStore.write({ date: todayKey(), fingerprint: "f", plan: plan as never });
    doneStore.write({ date: todayKey(), ids: ["carpool"] });
    const last = repo.saveDay.mock.calls.at(-1)?.[2];
    expect(last).toMatchObject({ doneIds: ["carpool"], co2KgDone: 1, aqi: 320 });
  });

  it("links Google, and switches account if it already exists", async () => {
    authFns.linkWithPopup.mockResolvedValueOnce({ user: user({ isAnonymous: false, email: "a@b.c" }) });
    repo.loadProfile.mockResolvedValueOnce(null);
    await sync.linkGoogleAccount();
    authFns.linkWithPopup.mockRejectedValueOnce(
      Object.assign(new Error("in use"), { code: "auth/credential-already-in-use" }),
    );
    await sync.linkGoogleAccount();
    expect(authFns.signInWithCredential).toHaveBeenCalled();
    authFns.linkWithPopup.mockRejectedValueOnce(
      Object.assign(new Error("popup closed"), { code: "auth/popup-closed" }),
    );
    await expect(sync.linkGoogleAccount()).rejects.toThrow("popup closed");
  });

  it("restores each account’s location and shows its profile name as the first member", async () => {
    const { useProfile } = await import("@/lib/profile/store");
    const { result } = renderHook(() => useProfile());
    const location = { lat: 25.61, lon: 85.14, name: "Patna" };

    repo.loadProfile.mockResolvedValueOnce(null);
    await act(async () =>
      authCallback(user({ uid: "signed-in", isAnonymous: false, displayName: "Asha Sharma" })),
    );
    expect(result.current.profile.locationConfirmed).toBe(false);
    act(() => result.current.save({ ...result.current.profile, location, locationConfirmed: true }));

    repo.loadProfile.mockResolvedValueOnce(null);
    await act(async () => authCallback(user()));
    expect(result.current.profile.location).not.toEqual(location);

    repo.loadProfile.mockResolvedValueOnce(null);
    await act(async () =>
      authCallback(user({ uid: "signed-in", isAnonymous: false, displayName: "Asha Sharma" })),
    );
    expect(result.current.profile.location).toEqual(location);
    expect(result.current.profile.members[0]?.name).toBe("Asha Sharma");

    repo.loadProfile.mockResolvedValueOnce(null);
    await act(async () => authCallback(user()));
  });

  it("signs out and deletes cloud data", async () => {
    await sync.signOutCloud();
    expect(authFns.signOut).toHaveBeenCalled();
    await sync.deleteCloudData();
    expect(repo.deleteUserData).toHaveBeenCalledWith({}, "anon-1");
  });
});

describe("friendlyCloudError", () => {
  it("explains common setup problems", () => {
    expect(sync.friendlyCloudError({ code: "auth/admin-restricted-operation" })).toMatch(
      /Anonymous sign-in is disabled/,
    );
    expect(sync.friendlyCloudError({ code: "auth/network-request-failed" })).toMatch(/offline/);
    expect(sync.friendlyCloudError({ code: "auth/operation-not-allowed" })).toMatch(/isn't enabled/);
    expect(sync.friendlyCloudError({ code: "auth/popup-closed-by-user" })).toMatch(/cancelled/);
    expect(sync.friendlyCloudError({ code: "auth/unauthorized-domain" })).toMatch(/Authorized domains/);
    expect(sync.friendlyCloudError({ code: "x", message: "raw" })).toBe("raw");
  });
});

describe("cloud hooks", () => {
  it("loads community stats and pledges / withdraws", async () => {
    const { result } = renderHook(() => hooks.useCommunity("New Delhi, India"));
    await waitFor(() => expect(result.current.stats).toEqual({ families: 3, co2KgWeek: 40 }));
    expect(repo.communityStats).toHaveBeenCalledWith({}, "new-delhi");
    await act(() => result.current.pledge(["carpool"], 999));
    expect(repo.savePledge).toHaveBeenCalledWith({}, "anon-1", {
      city: "new-delhi",
      actions: ["carpool"],
      co2KgWeek: 500,
    });
    await act(() => result.current.withdraw());
    expect(repo.removePledge).toHaveBeenCalled();
  });

  it("summarises the last 7 days", async () => {
    repo.loadDaysSince.mockResolvedValueOnce([
      {
        date: todayKey(),
        city: "D",
        aqi: 1,
        planIds: ["a"],
        doneIds: ["a"],
        plannedExposurePct: 1,
        co2KgDone: 1.5,
        pm25GDone: 0,
      },
    ]);
    const { result } = renderHook(() => hooks.useWeekSummary("x"));
    await waitFor(
      () => expect(result.current).toEqual({ actionsDone: 1, daysOnPlan: 1, co2KgAvoided: 1.5 }),
      { timeout: 2000 },
    );
  });
});
