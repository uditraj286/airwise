# AGENTS.md: AirWise project handbook

This is the single file a coding agent (Codex, Claude Code, Cursor…) or a new teammate should read before touching the code. It covers what AirWise is, how it's built, how to run and test it, the rules the code follows, and what's done or still open.

---

## 1. What AirWise is

AirWise is a GenAI assistant that helps families and communities get through winter smog and urban air pollution. It was built for the **PromptWars hackathon (Hack2Skill), Challenge 6**.

What it does:
- Shows **live air quality** where the family lives, as plain answers: "Best time to go out: 1–4 PM tomorrow" and "Stay in, windows shut: 9 PM–3 AM".
- Builds a **daily plan** of low-emission routines and indoor-air actions, tailored to the household (children, elders, asthma, commute, stove type…).
- Explains the **impact of every choice**: less smoke breathed (%), cigarettes-equivalent avoided, CO₂ saved, and PM2.5 not emitted.
- Offers a **chat assistant** ("Ask AirWise") that streams plain-text answers grounded in the live data and the household.
- Provides **indoor-air hacks**, community pledges, and accounts that sync across devices.

Hackathon judging criteria the code is designed around: **Code Quality, Security, Efficiency, Testing, Accessibility, Problem-statement alignment.** Submission rules: a public GitHub repo under 10 MB, at most 3 attempts.

**Core design principle: "the LLM explains, the math decides."** Gemini writes the wording only. Every number (exposure, CO₂, dose, best hours, slots, times) comes from deterministic, unit-tested code with sourced constants. If Gemini fails, a rule-based plan is used, so the app always works.

---

## 2. Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `output: "standalone"`), React 19 |
| Language | TypeScript, strict with `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS 3.4 with CSS-variable design tokens (`src/app/globals.css`, `tailwind.config.ts`), lucide-react icons |
| Validation | zod 4. Every external payload, request body and localStorage read is parsed. `z.toJSONSchema` feeds Gemini's structured output. |
| AI | `@google/genai`. Default model `gemini-3.5-flash-lite` (retried once on 503), then fallbacks `gemini-3.6-flash` and `gemini-3.5-flash`. |
| Air data | Open-Meteo air quality (Copernicus CAMS model, free, no key). The Google Air Quality API is used instead when `GOOGLE_AIR_QUALITY_API_KEY` is set. |
| Weather | Open-Meteo forecast (wind, temperature, humidity), giving a "smog trapped / slow / dispersing" verdict |
| Place names | OpenStreetMap Nominatim reverse geocoding plus the nearest Overpass settlement point (server-side, cached 24 h; the nearest settlement beats oversized village boundaries, e.g. Bihta not Bikram); Open-Meteo geocoding for city search |
| Accounts and storage | Firebase 13: Auth (anonymous guest, email/password, Google) and Firestore with persistent local cache |
| Tests | Vitest + Testing Library (unit, 80% coverage gate); Playwright + axe-core (end-to-end, WCAG 2.1 AA in light and dark mode) |
| Deploy | `Dockerfile` (non-root, Cloud Run ready); CI in `.github/workflows/ci.yml` |

---

## 3. Run it

```bash
npm install
cp .env.example .env.local   # then fill in the keys (see below)
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build and server |
| `npm run lint` | ESLint (must be clean) |
| `npm run typecheck` | `tsc --noEmit` (must be clean) |
| `npm test` | Vitest unit tests |
| `npm run test:coverage` | Unit tests with the 80% coverage gate |
| `npm run test:e2e` | Playwright end-to-end tests + axe accessibility scan. Starts its own server with `AIRWISE_MOCK_DATA=1` and Firebase/Gemini env vars blanked. |
| `npm run format` / `format:check` | Prettier write / check (CI enforces the check) |
| `npm run check` | lint + typecheck + format check + coverage. Run before every commit. |

### Environment variables (`.env.local`, git-ignored, never commit)

| Variable | Needed? | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Server-side only. Without it the rule-based plan and chat fallback are used. |
| `GEMINI_MODEL` | Optional | Default `gemini-3.5-flash-lite` |
| `GOOGLE_AIR_QUALITY_API_KEY` | Optional | Otherwise Open-Meteo is used |
| `AIRWISE_MOCK_DATA` | Optional | `1` = deterministic sample air data (tests, offline demos) |
| `NEXT_PUBLIC_FIREBASE_*` | Optional | Web app config. Without these, accounts and sync are switched off and everything stays on the device. |

**Firebase project:** `stadiumos-ai`, which is **shared with another app (StadiumOS)**.
- AirWise collections are namespaced: `airwise_users/{uid}`, `airwise_users/{uid}/days/{date}`, `airwise_pledges/{uid}`.
- `firestore.rules` holds StadiumOS's rules unchanged plus an AirWise block between BEGIN/END markers, with helpers prefixed `aw`. **Never replace the whole rules file; edit only the AirWise block.**
- The composite index `airwise_pledges (city ASC, co2KgWeek ASC)` lives in `firestore.indexes.json`.
- Auth providers enabled: Anonymous, Email/Password, Google (public name "AirWise"). `localhost` is an authorised domain.

---

## 4. Project map

```
src/
  app/                      Next.js routes
    page.tsx                Dashboard (/)
    plan/ ask/ hacks/ health/ settings/ onboarding/   pages inside the app shell
    login/ setup/           full-screen welcome page and first-run household wizard (no app chrome)
    api/air/route.ts        GET  live AirSnapshot for lat/lon (rate-limited, cached)
    api/plan/route.ts       POST daily plan (Gemini wording + engine numbers)
    api/chat/route.ts       POST streaming chat (plain text)
    api/geocode/route.ts    GET  ?q=[&near=lat,lon] search (nearest first, block + district in labels) | ?lat=&lon= reverse lookup
    api/stations/route.ts   GET  live CPCB stations within 50 km (India; sample list in mock mode)
    api/air/batch/route.ts  GET  ?points=lat,lon;… current AQI for up to 5 saved places in one request
    globals.css             design tokens, keyframes, reduced-motion rule
  components/
    Dashboard.tsx           page composition for / (reference "Donezo" layout)
    HealthView.tsx          /health: emergency numbers, when to get help, activity advisor, N95 guide
    ShareButton.tsx         share today's summary (native share → copy → WhatsApp link)
    LocationPicker.tsx      accessible combobox: type-ahead results (nearest first), arrow keys + Enter, recent places, popular cities, GPS, Rename (fix the label, keep the coordinates)
    OutingPlanner.tsx       "Plan an outing": cleanest 1/2/3-hour daylight window (Health page)
    ReportPollution.tsx     ready-to-send complaint for burning, dust, smoky vehicles, factory smoke (Health page)
    AlertsSettings.tsx      smog-alert toggle in Settings
    OnboardingForm.tsx      4-step household wizard (mode "setup" full-screen, "edit" on /onboarding)
    cards/                  StatCard (+ ChangeChip, hero variant), WeekBars, NextStepCard, PlanListCard,
                            HouseholdCard, ProgressGauge, CountdownCard, PlacesCard (your places, live AQI each),
                            StationsCard (live CPCB stations near you), DayTimeline, TrendCard, AirMixCard,
                            SourcesDonut, ImpactCard, Glossary
    plan/                   PlanView (timeline by time of day), PlanItemCard, CommunityCard
    chat/                   ChatView, ChatMessage, Composer, ThinkingIndicator
    auth/                   AuthCard (sign in / create account / Google / reset), GoogleMark
    layout/                 AppShell (full-screen panels + setup gate), Sidebar (MENU/GENERAL + alerts promo),
                            Topbar (search ⌘F, share, alerts bell, profile), AccountMenu, ThemeToggle, nav, Logo
    ui/                     Card, PageHeader (+ pill button styles), Segmented, CountUp, Skeleton, StatusPanel, aqi,
                            Unit (plain-language measurement labels visible beside values)
  lib/
    types.ts                shared domain types (AirSnapshot, HourlyPoint, Weather…)
    air/                    providers (openMeteo, google, mock), service (cache + fallbacks + alignCurrentHour),
                            aqi (India NAQI), dayWindows (best/okay/avoid hours), trends, time, weather,
                            pollutants (WHO limits), place (reverse geocoding), sources (city source shares), cache,
                            stations (CPCB area blend), activities (activity advisor), countdown (clean-air timer)
    alerts.ts share.ts      smog-alert rules; family share text
    places.ts               saved places store (airwise.places.v1, max 8) + POPULAR_CITIES
    airContext.tsx          one live air feed for the whole app (AirProvider / useLiveAir)
    useAlerts.ts            alert preferences, permission, AlertsWatcher (sends browser notifications)
    impact/                 constants (sourced), exposure (indoor mass-balance + dose), catalogue (11 actions), evaluate
    ai/                     gemini client, prompts, schemas, context, plan, chat, fallback (rule plan, slots, times),
                            plainText (markdown stripper incl. streaming)
    firebase/               config, client, auth, sync (anonymous session + reconcile), repo, dayRecord, hooks
    profile/                schema (zod + DEMO_PROFILE), store (localStorage stores, useProfile, account owner)
    security/               rateLimit, http (same-origin, body cap, content-type, JSON errors)
    useAir.ts usePlan.ts    client hooks
  i18n/                     dict.ts (English + Hindi strings), useT
tests/
  unit/                     Vitest suites (225 tests)
  e2e/app.spec.ts           34 Playwright flows incl. a keyboard-only journey and axe on 9 pages × 2 themes; seedHousehold() pre-saves a household
  fixtures.ts setup.ts
docs/
  PRD.md                    research, PRD, roadmap and plan
  DESIGN.md                 design system: tokens, components, writing rules, do/don't
  PERFORMANCE.md            caching layers, request budget, bundle notes
  adr/                      architecture decision records (0001–0005)
SECURITY.md ACCESSIBILITY.md threat model / WCAG practice (judge-facing)
firestore.rules firestore.indexes.json firebase.json Dockerfile
```

### Data flow

1. **Profile and first visit.** `useProfile()` returns the saved household from localStorage (`airwise.profile.v1`).
   - **Household first:** `AppShell` waits for cloud sync to settle, then `setupRedirect()` sends anyone without a saved household (or without a confirmed location) to `/login` (guests) or `/setup` (signed in). `/login` → "Continue as a guest" (always `/setup?new=1`, a blank household like a brand-new user) or sign-in/up → `/setup` wizard → dashboard (`/`). "Try with a sample family" saves `SAMPLE_PROFILE` (`sample: true`) and the dashboard shows a "Set up my household" banner.
   - Cloud sync (`lib/firebase/sync.ts`) mirrors the profile and day log to Firestore for the anonymous or signed-in user.
2. **Air.** `useAir(location)` calls `GET /api/air`, which runs `getAirSnapshot()`:
   - mock data, or Google if a key is set, otherwise Open-Meteo, plus weather. Google uses its returned India AQI (ind_cpcb) and Open-Meteo uses a labeled particle-based estimate;
   - with Open-Meteo, fresh CPCB stations within 30 km (India) are blended by inverse-distance-squared weights into one area AQI (`lib/air/stations.ts`). `calibrateToStation()` then scales the model's particle series so its AQI matches the stations (factor capped 0.25–4×, stored in `snapshot.calibration`), so the hero AQI, PM2.5, timeline and charts all agree. Outside India (or with no station nearby) the model estimate is shown and labelled. The national feed receives no user location;
   - Open-Meteo is retried once; `/api/plan` and `/api/chat` accept a cached snapshot if the provider is slow (`allowStale`);
   - a reverse-geocoded name when the location is "My location";
   - `alignCurrentHour()` sets the current hour to the live reading so every card shows the same "Now" number;
   - results are cached for 55 seconds per saved coordinate pair.
   - The dashboard checks every minute while visible and checks on return if due. Opening or reloading the dashboard, restoring it from browser history, and Check now bypass the server cache. The last reading stays visible during a refresh or provider error.
3. **Plan.** `usePlan(profile, {auto})` posts to `/api/plan`. The server:
   - builds context with the ranked actions from the impact engine;
   - asks Gemini for wording (structured JSON, 20 s deadline);
   - falls back to `rulePlan` if that fails;
   - attaches engine impact, slot and time to each item.

   The result is cached per day and per profile fingerprint. If the profile changes mid-request, the hook re-fetches.
4. **Chat.** `/api/chat` streams Gemini output through `PlainTextStream`, so the user never sees `**`, `#` or backticks. The client strips markdown again as a safety net. Questions are wrapped in `<user_question>` tags as a prompt-injection guard.

---

## 5. Rules for changing code

**Correctness and data**
- Numbers come from code, not the LLM. Never let model output decide a time, dose, percentage or slot. Add or adjust logic in `lib/impact`, `lib/air` or `lib/ai/fallback.ts`, with a unit test.
- Validate every boundary with zod: API params and bodies, upstream payloads, localStorage reads.
- One number per moment: the current hour must match `current` everywhere (see `alignCurrentHour`).
- Cite constants. `lib/impact/constants.ts` and `lib/air/pollutants.ts` carry their sources; keep it that way.

**Security**
- Keys stay server-side; only `NEXT_PUBLIC_FIREBASE_*` reach the browser.
- API routes use `enforceRateLimit` (air 60/min, AI 12/min), same-origin checks, a 16 KB body cap and content-type checks (`lib/security/http.ts`).
- The CSP in `next.config.ts` lists exact origins. Add a new browser-side origin there, but prefer server-side fetches.
- Firestore rules: owner-only access, field allow-lists, server timestamps, deny-all at the end.
- Keep four-decimal air lookup coordinates in the device's profile. Round coordinates to two decimals for Firestore sync, and to three decimals (~110 m) for the reverse place-name lookup so the exact village or neighbourhood is named, not the next one over.

**Accessibility (WCAG 2.1 AA, enforced by axe in e2e)**
- Colour never carries meaning alone: give every chart mark an accessible name and a legend in words.
- Use real buttons, checkboxes and labels; `role="radiogroup"` for segmented controls; visible focus rings.
- Respect `prefers-reduced-motion` (the global rule in `globals.css` disables animations; `CountUp` jumps to the final value).
- Check contrast in both light and dark themes when adding colours, and use tokens rather than hex.

**UI and writing** (full guide in `docs/DESIGN.md`)
- Lead with the answer ("Go out 1–4 PM tomorrow"), then the visual, then the numbers and sources.
- Write full times ("3 PM", "7 PM → 7 AM", "tomorrow"); never "3P".
- Use sentence case, no exclamation marks, no emoji, no "AI-powered".
- Health copy is calm and points to a doctor; never diagnose.
- **Explain every technical word on first sight.** Families are not scientists:
  - Lead pollutant names with plain words and keep the code in brackets: "Fine smoke (PM2.5)", "Dust (PM10)", "Traffic gas (NO₂)", "Coal gas (SO₂)", "Carbon monoxide (CO)", "Ozone (O₃)". The names live in `lib/air/pollutants.ts`.
  - Spell out measurement units in visible text. Use `<Unit />` for micrograms per cubic metre and `<Unit kind="dose" />` for micrograms. Use `spellOutUnits` for generated wording.
  - Say what changes for the family, not the metric name: "1.3% less smoke breathed by the family today", not "−1.3% PM2.5 dose"; "1.39 g less smoke put into your city's air each week", not "PM2.5 not emitted".
  - Equipment: say "N95 mask" and "fine-dust filter (MERV-13 or HEPA grade)"; explain form inputs ("CADR" = how much clean air a purifier gives out).
  - New terms belong in `components/cards/Glossary.tsx` too, which appears on the dashboard and the Daily Plan.
  - Mini charts get a caption ("Last 12 h", "Per action") so their meaning is visible without hovering.
- Avoid wrapping that breaks alignment: use `min-w-0`, `truncate` or `line-clamp-2`, and `tabular-nums` for numbers.
- Plain text only in chat.

**Code style**
- TypeScript strict, no `any`. Small pure functions in `lib/` and thin components.
- React: no setState inside effects for derived data. Use `useSyncExternalStore` for stores and `useMemo` for derivations (the React Compiler lint rules are on).
- Tests sit next to their behaviour in `tests/unit/*.test.ts(x)`; e2e flows go in `tests/e2e/app.spec.ts`.
- Before finishing any change, run `npm run check && npm run test:e2e`. `next/dynamic` options must be an inline object literal.

---

## 6. Feature status

**Done and tested**
- Dashboard:
  - household row; KPI tiles (AQI, PM2.5 vs WHO, smoke you can avoid);
  - "Today at a glance" 24-hour timeline with best / okay / avoid hours and a "least bad" warning;
  - PM2.5 by hour chart (past 12 h, next 12 h, next days);
  - "What's in your air" card (live PM2.5, PM10, NO₂, SO₂, CO and ozone vs WHO limits, plus the usual city sources);
  - weekly impact; provider reading time and last check time with a one-minute refresh.
- Daily Plan:
  - Gemini-worded plan grouped Morning → Afternoon → Evening → Tonight → All day → This week, with deterministic times;
  - check-off with progress; per-person dose bars; health watch; community pledge (Firestore aggregation).
- Ask AirWise: Claude/ChatGPT-style chat with suggestions, a "Thinking" indicator, streaming caret, Stop, Copy, Retry, New chat, and per-day history. Plain text only.
- Indoor hacks, onboarding (city search or GPS with a reverse-geocoded name), and settings (language EN/HI, theme, cloud panel, delete data).
- Accounts:
  - optional login at `/login`: email/password, Google, password reset, guest mode;
  - guest data carries over on sign-up (`linkWithCredential` / `linkWithPopup`);
  - "Create account" with an existing email signs in when the password matches, otherwise it switches to Sign in with the email kept;
  - signed-in users without a household see themselves as the household member.
  - once a household is saved, its names always win: editing the main member renames them on the dashboard, top bar and account menu, in Firestore (profile sync) and in the Firebase account display name (`updateAccountName`).
- Light and dark theme, skeleton loaders, motion with reduced-motion support, and a skip link.
- Plain-language pass:
  - every unit explains itself (`Unit`);
  - a "What do these numbers mean?" glossary on the dashboard and plan covers AQI bands, PM2.5, µg/m³, the WHO limit, µg breathed in, and cigarettes' worth;
  - pollutant names and plan impact lines are written for non-experts;
  - the KPI sparklines have captions.
- Plan page reliability: if cloud sync changes the household while a plan is loading, the plan is fetched again instead of spinning forever (regression-tested in `tests/unit/hooks.test.tsx`).
- Reference redesign (deep green, full screen): grey panels holding white cards, PageHeader on every page, 4 stat cards (first is the green hero), "Air this week" pill bars (striped = forecast), Next step, Today's plan list, Your household (per-person "can they go out now?"), Today's progress gauge, and a live clean-air countdown.
- Household-first onboarding: welcome page → 4-step wizard (Where you live, Who lives with you, Your home, Getting around) → dashboard.
- Public-benefit features:
  - **Smog alerts**: browser notifications while AirWise is open (clean air starting within 15 min, air turning Very Poor within 2 h, plan step due), deduplicated per day; the topbar bell lists them without permission. Closed-tab push (service worker/FCM) is not built.
  - **Activity advisor** (`lib/air/activities.ts`): walk, commute, children's play, sport, cycling, windows, burning; stricter for children/elders and people with asthma, heart or lung conditions (CPCB health advisories), with "Better at 2 PM" times.
  - **Health & help** page: 112 / 108 `tel:` links, hospitals near you (Google Maps link from rounded coordinates), when to get help, N95 fit guide.
  - **Share today**: plain-text summary in English or Hindi via the share sheet, clipboard or WhatsApp.
  - **Your places**: compare live AQI at home, school, office or relatives' homes; switch the household location in one tap.
  - **Stations near you**: every live CPCB monitor within 50 km with AQI, distance and time, refreshed every minute.
  - **Plan an outing**: cleanest 1, 2 or 3-hour daylight window in the next 24 hours (`bestOuting` in `lib/air/activities.ts`).
  - **Report pollution**: ready-to-send complaint text for burning, construction dust, smoky vehicles and factory smoke, with official channels (CPCB Sameer app, State PCB, Green Delhi).
  - **Better location search**: combobox with type-ahead, keyboard choice, recent places and popular cities. Same-named villages are ranked by distance from the family and labelled with their block ("Raghopur, Bihta, Patna"). OpenStreetMap lacks many Indian villages and its block lines can name the next town (Raghopur in Bihta reads as Bikram), so the detected name has a **Rename** button that changes only the label.

**Open / ideas**
- Live: code at https://github.com/uditraj286/airwise, app at https://airwise-two.vercel.app (Vercel deploys every push to `main`; env vars are set in the Vercel project, never in git). Add `airwise-two.vercel.app` to Firebase authorised domains for Google sign-in. `Dockerfile` is ready for Cloud Run as an alternative.
- Rotate the Gemini key after the hackathon.
- Hindi (`src/i18n/dict.ts`) has not had the plain-language rewrite yet; some component text is still English-only.
- Station data comes from a public relay of the CPCB feed (`api.dharun.dev`). For production, switch to the official data.gov.in API (free key) or OpenAQ.
- Possible extras: closed-tab push alerts (service worker + FCM), satellite fire hotspots (NASA FIRMS, needs a key), more languages, PWA install.

---

## 7. Gotchas

- Playwright builds and starts its own server on port 3100 and reuses one that is already running there. If results look stale, stop the old `next start -p 3100` first.
- First-visit redirect: e2e and manual tests need a saved household. Use `seedHousehold(page)` in e2e, or "Try with a sample family" in the browser.
- Notification permission and anything else that differs between server and browser must be read with `useSyncExternalStore` and a server snapshot, or hydration fails.

- E2E waits on visible text, not `networkidle`: Firestore keeps a connection open forever.
- In Playwright, `getByLabel("Password")` also matches "Show password", so use `exact: true`.
- Gemini models: `gemini-flash-latest` returns 404; `2.5-flash` is retired for new keys; `3.5-flash` and `3.6-flash` can be slow. Keep the deadline and fallback logic.
- Open-Meteo reports half-hour local times for IST (for example `18:30`); convert with `utc_offset_seconds` (see `localToUtcIso`).
- macOS `sed` has no `\b`; use perl or python for scripted edits.
- Copy changes break text-based tests. Update `tests/unit/components.test.tsx` and `tests/e2e/app.spec.ts` when you reword UI. Use `{ exact: true }` and `.first()` when a phrase repeats (for example "Less smoke breathed" is both a stat label and part of each plan step).
- The Firebase project is shared with StadiumOS. Namespacing and rule markers matter.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
