export {};

const auth = { currentUser: null as null | { uid: string; isAnonymous: boolean } };
const fns = {
  createUserWithEmailAndPassword: vi.fn(async () => ({
    user: { uid: "new", isAnonymous: false, email: "a@b.co", displayName: null },
  })),
  linkWithCredential: vi.fn(async () => ({
    user: { uid: "anon", isAnonymous: false, email: "a@b.co", displayName: null },
  })),
  signInWithEmailAndPassword: vi.fn(async () => ({})),
  signInWithPopup: vi.fn(async () => ({})),
  sendPasswordResetEmail: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  updateProfile: vi.fn(async () => undefined),
};
const linkGoogleAccount = vi.fn(async () => undefined);
const refreshCloudUser = vi.fn();
const clearAllLocalData = vi.fn();

vi.mock("firebase/auth", () => ({
  ...fns,
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  GoogleAuthProvider: class {},
}));
vi.mock("@/lib/firebase/client", () => ({ getFirebase: () => ({ auth }) }));
vi.mock("@/lib/firebase/sync", async (orig) => ({
  ...(await orig<object>()),
  linkGoogleAccount,
  refreshCloudUser,
}));
vi.mock("@/lib/profile/store", async (orig) => ({ ...(await orig<object>()), clearAllLocalData }));

const a = await import("@/lib/firebase/auth");

beforeEach(() => {
  vi.clearAllMocks();
  auth.currentUser = null;
});

describe("sign up", () => {
  it("upgrades a guest account in place so their data carries over", async () => {
    auth.currentUser = { uid: "anon", isAnonymous: true };
    await a.signUpWithEmail({ name: "Priya", email: "priya@example.com", password: "longenough" });
    expect(fns.linkWithCredential).toHaveBeenCalledWith(auth.currentUser, {
      email: "priya@example.com",
      password: "longenough",
    });
    expect(fns.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(fns.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ uid: "anon" }), {
      displayName: "Priya",
    });
    expect(refreshCloudUser).toHaveBeenCalled();
  });

  it("creates a fresh account when nobody is signed in", async () => {
    await a.signUpWithEmail({ name: "Sam", email: " sam@example.com ", password: "longenough" });
    expect(fns.createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, "sam@example.com", "longenough");
  });

  it("validates input before calling Firebase", async () => {
    await expect(a.signUpWithEmail({ name: "", email: "x", password: "short" })).rejects.toThrow();
    expect(a.SignUpSchema.safeParse({ name: "A", email: "a@b.co", password: "1234567" }).success).toBe(false);
    expect(fns.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("signs an existing user in when they try to sign up again with the right password", async () => {
    auth.currentUser = { uid: "anon", isAnonymous: true };
    fns.linkWithCredential.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "auth/email-already-in-use" }),
    );
    await expect(
      a.signUpWithEmail({ name: "P", email: "p@example.com", password: "longenough" }),
    ).resolves.toBe("signed-in");
    expect(fns.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, "p@example.com", "longenough");
  });

  it("sends existing users to sign in when the password doesn't match", async () => {
    fns.createUserWithEmailAndPassword.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "auth/email-already-in-use" }),
    );
    fns.signInWithEmailAndPassword.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "auth/invalid-credential" }),
    );
    const err = await a
      .signUpWithEmail({ name: "P", email: "p@example.com", password: "longenough" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(a.AccountExistsError);
    expect((err as Error).message).toMatch(/already have an account/);
  });

  it("turns other Firebase errors into friendly sentences", async () => {
    fns.createUserWithEmailAndPassword.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "auth/weak-password" }),
    );
    await expect(
      a.signUpWithEmail({ name: "P", email: "p@example.com", password: "longenough" }),
    ).rejects.toThrow(/stronger password/);
  });
});

describe("sign in", () => {
  it("signs in with email and reports wrong passwords kindly", async () => {
    await a.signInWithEmail({ email: "p@example.com", password: "pw" });
    expect(fns.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, "p@example.com", "pw");
    fns.signInWithEmailAndPassword.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "auth/invalid-credential" }),
    );
    await expect(a.signInWithEmail({ email: "p@example.com", password: "bad" })).rejects.toThrow(
      /don't match/,
    );
  });

  it("links Google to a guest, or opens the popup otherwise", async () => {
    auth.currentUser = { uid: "anon", isAnonymous: true };
    await a.signInWithGoogle();
    expect(linkGoogleAccount).toHaveBeenCalled();
    auth.currentUser = null;
    await a.signInWithGoogle();
    expect(fns.signInWithPopup).toHaveBeenCalled();
  });

  it("sends a reset link only for a valid email", async () => {
    await expect(a.resetPassword("nope")).rejects.toThrow(/email above/);
    await a.resetPassword("p@example.com");
    expect(fns.sendPasswordResetEmail).toHaveBeenCalledWith(auth, "p@example.com");
  });

  it("preserves saved profiles on sign out", async () => {
    await a.signOutUser();
    expect(fns.signOut).toHaveBeenCalled();
    expect(clearAllLocalData).not.toHaveBeenCalled();
    expect(a.accountsAvailable()).toBe(true);
  });
});

describe("account name", () => {
  it("follows the household's main member for signed-in users only", async () => {
    const user = { uid: "u1", isAnonymous: false, displayName: "Udit" };
    auth.currentUser = user;
    await a.updateAccountName("  Udit Raj ");
    expect(fns.updateProfile).toHaveBeenCalledWith(user, { displayName: "Udit Raj" });
    expect(refreshCloudUser).toHaveBeenCalledWith(user);
    vi.clearAllMocks();
    await a.updateAccountName("Udit");
    expect(fns.updateProfile).not.toHaveBeenCalled();
    auth.currentUser = { uid: "g", isAnonymous: true };
    await a.updateAccountName("Asha");
    expect(fns.updateProfile).not.toHaveBeenCalled();
  });
});
