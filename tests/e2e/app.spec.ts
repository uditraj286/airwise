import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

/** Rewrite an /api/air response. Requests the app cancels mid-flight (it aborts superseded fetches) are ignored. */
async function rewriteAir(
  route: Route,
  change: (snapshot: Record<string, unknown>) => Record<string, unknown>,
  before?: () => Promise<void>,
): Promise<void> {
  try {
    const response = await route.fetch();
    const snapshot = (await response.json()) as Record<string, unknown>;
    if (before) await before();
    await route.fulfill({ response, json: change(snapshot) });
  } catch {
    // The page already moved on from this request.
  }
}

/** Each page and a piece of text that proves it has finished loading (no networkidle: Firebase keeps sockets open). */
const PAGES: Record<string, string | RegExp> = {
  "/": "Today at a glance",
  "/plan": "Your day, step by step",
  "/ask": /What would you like to know/,
  "/hacks": /\d+ tips/,
  "/health": "Can we do this now?",
  "/onboarding": "Where do you live?",
  "/settings": "Language",
  "/login": "Welcome back",
  "/setup": "Where do you live?",
};

/** A saved household, so pages open directly instead of sending a first-time visitor to the welcome page. */
const HOUSEHOLD = {
  version: 1,
  locationConfirmed: true,
  location: { name: "New Delhi", lat: 28.6139, lon: 77.209 },
  members: [
    { id: "asha", name: "Asha", ageGroup: "adult", conditions: [], outdoorActivity: false },
    { id: "aarav", name: "Aarav", ageGroup: "child", conditions: ["asthma"], outdoorActivity: true },
  ],
  home: {
    bedroomVolumeM3: 36,
    hasPurifier: false,
    purifierCadrM3h: 250,
    stove: "lpg",
    usesIncenseOrCoils: true,
  },
  commute: { mode: "car", oneWayKm: 12, daysPerWeek: 5 },
  habits: { burnsLeavesOrWaste: false },
  language: "en",
};

async function seedHousehold(page: Page): Promise<void> {
  await page.addInitScript((profile) => {
    if (!localStorage.getItem("airwise.profile.v1")) localStorage.setItem("airwise.profile.v1", profile);
  }, JSON.stringify(HOUSEHOLD));
}

async function open(page: Page, path: string, { seed = true } = {}): Promise<void> {
  if (seed) await seedHousehold(page);
  await page.goto(path);
  await expect(page.getByText(PAGES[path]!).first()).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("accessibility (WCAG 2.1 AA)", () => {
  for (const path of Object.keys(PAGES)) {
    for (const theme of ["light", "dark"] as const) {
      test(`${path} has no serious axe violations in ${theme} mode`, async ({ page }) => {
        await page.addInitScript((choice) => localStorage.setItem("airwise.theme", choice), theme);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await open(page, path, { seed: path !== "/setup" && path !== "/login" });
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual(
          [],
        );
      });
    }
  }
});

test("first visit starts at the welcome page, then household setup, then the dashboard", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Continue as a guest" }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByText("Step 1 of 4")).toBeVisible();

  // Step 1 can't be skipped without a location.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Choose your city or share your location/)).toBeVisible();
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 25.55884, longitude: 84.87141, accuracy: 10 });
  await page.route(/\/api\/geocode\?lat=/, (route) =>
    route.fulfill({ json: { name: "Bihta, Bihar, India" } }),
  );
  await page.getByRole("button", { name: "Use precise location" }).click();
  await expect(page.getByText("Location set to Bihta, Bihar, India.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByLabel("First name or nickname").first().fill("Asha");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Go to my dashboard" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("air in Bihta right now", { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Daily Plan" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByText("Less smoke breathed", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('label[for^="done-"]').first().click();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await expect(page.getByText(/1 of \d+ done/)).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page
      .getByRole("heading", { name: "Good evening, Asha" })
      .or(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Asha/ })),
  ).toBeVisible();
  await expect(page.getByText("air in Bihta right now", { exact: false })).toBeVisible();
});

test("the sample family opens the dashboard with a set-up prompt", async ({ page }) => {
  await open(page, "/login", { seed: false });
  await page.getByRole("button", { name: "Or try AirWise with a sample family" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/You're looking at a sample family/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Set up my household" })).toBeVisible();
});

test("dashboard explains today's air in plain words", async ({ page }) => {
  await open(page, "/");
  const kpis = page.getByLabel("Key numbers");
  await expect(kpis.getByText("Estimated AQI", { exact: true })).toBeVisible();
  await expect(kpis.getByText("micrograms per cubic metre", { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/[µμ]g|mg\/m³/);
  await expect(kpis.getByText(/× the WHO/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Air this week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your household" })).toBeVisible();
  await expect(page.getByText(/Children's outdoor play: /)).toBeVisible();
  await expect(page.getByRole("region", { name: "Clean-air countdown" })).toBeVisible();
  await expect(page.getByText("Stay in, windows shut").first()).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Next 24 hours" }).getByRole("button").first(),
  ).toHaveAccessibleName(/^Now:/);
  await page.getByRole("radio", { name: "Usual sources" }).click();
  await expect(page.getByText("top source")).toBeVisible();
  await page.getByRole("radio", { name: "Next days" }).click();
  await expect(page.getByRole("radio", { name: "Next days" })).toHaveAttribute("aria-checked", "true");
});

test("dashboard shows refresh progress and replaces the top reading", async ({ page }) => {
  await open(page, "/");
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(/\/api\/air\?.*refresh=1/, (route) =>
    rewriteAir(
      route,
      (snapshot) => ({ ...snapshot, current: { ...(snapshot.current as object), aqi: 123 } }),
      () => pending,
    ),
  );

  await page.getByRole("button", { name: "Update data" }).click();
  await expect(page.getByText("Checking for newer data…")).toBeVisible();
  release();
  await expect(page.getByLabel("Key numbers").getByText("123", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sample data · Reading from/)).toBeVisible();
});

test("precise location is used by the dashboard and survives reload", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 25.55884, longitude: 84.87141, accuracy: 10 });
  await page.route(/\/api\/geocode\?lat=/, (route) =>
    route.fulfill({ json: { name: "Bihta, Bihar, India" } }),
  );
  await open(page, "/settings");
  await page.getByRole("button", { name: "Use precise location" }).click();
  await expect(page.getByText("Location set to Bihta, Bihar, India.")).toBeVisible();

  for (let visit = 0; visit < 2; visit += 1) {
    const request = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return (
        url.pathname === "/api/air" &&
        url.searchParams.get("lat") === "25.5588" &&
        url.searchParams.get("lon") === "84.8714"
      );
    });
    if (visit === 0) await page.goto("/");
    else await page.reload();
    await request;
    await expect(page.getByText(/air in Bihta right now/)).toBeVisible();
  }
});

test("chat shows plain-text answers with no markdown", async ({ page }) => {
  await open(page, "/ask");
  await page.getByLabel("Message AirWise").fill("When can the kids play outside?");
  await page.keyboard.press("Enter");
  const answer = page.getByRole("list", { name: "Conversation" }).locator("li").nth(1);
  await expect(answer).toContainText("Best time to be outside", { timeout: 20_000 });
  await expect(answer).not.toContainText("**");
  await expect(page.getByRole("button", { name: "Copy answer" })).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByText(/What would you like to know/)).toBeVisible();
});

test("login page validates input and lets guests continue", async ({ page }) => {
  await open(page, "/login", { seed: false });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByRole("radio", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Continue as a guest" }).click();
  await expect(page).toHaveURL(/\/setup$/);
});

test("theme toggle persists and keyboard skip link works", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, "/");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("dashboard leads with the nearby station and labels the model forecast", async ({ page }) => {
  await page.route(/\/api\/air\?/, (route) =>
    rewriteAir(route, (snapshot) => ({
      ...snapshot,
      source: "open-meteo",
      station: { name: "Danapur", aqi: 227, distanceKm: 17.5, updatedAt: snapshot.updatedAt },
    })),
  );
  await open(page, "/");
  const kpis = page.getByLabel("Key numbers");
  await expect(kpis.getByText("Air quality now (AQI)")).toBeVisible();
  await expect(kpis.getByText("227", { exact: true })).toBeVisible();
  await expect(page.getByText(/Nearest station: Danapur, 18 km away/)).toBeVisible();
});

test("a normal reload replaces the dashboard reading without clearing browser data", async ({ page }) => {
  let aqi = 201;
  await page.route(/\/api\/air\?/, (route) => {
    const fresh = new URL(route.request().url()).searchParams.get("refresh") === "1";
    return rewriteAir(route, (snapshot) => ({
      ...snapshot,
      current: { ...(snapshot.current as object), aqi: fresh ? aqi : 201 },
    }));
  });
  await open(page, "/");
  await expect(page.getByLabel("Key numbers").getByText("201", { exact: true })).toBeVisible();
  aqi = 158;
  await page.reload();
  await expect(page.getByLabel("Key numbers").getByText("158", { exact: true })).toBeVisible();
});

test("health page has emergency numbers and activity advice", async ({ page }) => {
  await open(page, "/health");
  await expect(page.getByRole("link", { name: /112/ })).toHaveAttribute("href", "tel:112");
  await expect(page.getByRole("link", { name: /108/ })).toHaveAttribute("href", "tel:108");
  await expect(page.getByRole("link", { name: /Hospitals near you/ })).toHaveAttribute(
    "href",
    /google\.com\/maps\/search\/hospital/,
  );
  await page.getByRole("radio", { name: "Asthma, heart or lung" }).click();
  await expect(page.getByText("Burning leaves or waste")).toBeVisible();
});

test("share today falls back to copying the summary", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await open(page, "/");
  await page.getByRole("button", { name: "Share today", exact: true }).click();
  await expect(page.getByText(/Copied\. Paste it/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^AirWise · New Delhi today: AQI \d+/);
});

test("location search suggests cities and the dashboard compares places and stations", async ({ page }) => {
  await page.route(/\/api\/geocode\?q=/, (route) =>
    route.fulfill({ json: [{ name: "Lucknow, Uttar Pradesh, India", lat: 26.8467, lon: 80.9462 }] }),
  );
  await open(page, "/settings");
  const box = page.getByRole("combobox", { name: "Search for your city or area" });
  await box.click();
  await expect(page.getByRole("option", { name: /Mumbai/ })).toBeVisible();
  await box.fill("Luck");
  await expect(page.getByRole("option", { name: /Lucknow/ })).toBeVisible();
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page.getByText("Location set to Lucknow, Uttar Pradesh, India.")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Your places" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Stations near you" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Sample station A")).toBeVisible();
});

test("health page plans an outing and drafts a pollution complaint", async ({ page }) => {
  await open(page, "/health");
  await expect(page.getByRole("heading", { name: "Plan an outing" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("radio", { name: "1 hour" }).click();
  await expect(page.getByText("Best time to go", { exact: true })).toBeVisible();
  await page.getByText("Construction dust").click();
  await expect(page.getByLabel("Your message")).toHaveValue(/construction or demolition/);
});

test("the main journey works with the keyboard alone", async ({ page }) => {
  await page.route(/\/api\/geocode\?q=/, (route) =>
    route.fulfill({ json: [{ name: "Lucknow, Uttar Pradesh, India", lat: 26.8467, lon: 80.9462 }] }),
  );
  await open(page, "/settings");
  // Skip link is the first stop.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  // City search: type, arrow down, Enter.
  const box = page.getByRole("combobox", { name: "Search for your city or area" });
  await box.focus();
  await page.keyboard.type("Luck");
  await expect(page.getByRole("option", { name: /Lucknow/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Location set to Lucknow, Uttar Pradesh, India.")).toBeVisible();
  // Alerts menu opens with Enter and closes with Escape.
  await page.getByRole("button", { name: /^Alerts/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Alerts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Alerts" })).toBeHidden();
  // Tick a plan step with Space.
  await page.goto("/plan");
  const first = page.getByRole("checkbox").first();
  await expect(first).toBeAttached({ timeout: 20_000 });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
});
