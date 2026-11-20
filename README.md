# AirWise: a GenAI smog companion for families

**Live demo:** https://airwise-two.vercel.app · **Code:** https://github.com/uditraj286/airwise

> **PromptWars, Challenge 6.** A GenAI-powered assistant that helps families and communities get through severe winter smog and urban air pollution. It suggests **low-emission daily routines**, **indoor air-quality hacks** and **sustainable alternatives** tailored to each family's **location and lifestyle**, and it **clearly explains the direct impact of every choice**.

AirWise reads **live air data for the exact place a family lives**. It blends nearby government monitoring stations (CPCB) with the Copernicus CAMS forecast, and adds live weather. It combines that with the household (children, elders, asthma, commute, stove) and a **source-cited exposure and emissions model**. **Google Gemini** then writes a plain-language plan for today and answers questions, in English or Hindi. **Firebase** keeps the household, daily progress and community pledges in sync across devices.

**Core principle ([ADR-0001](docs/adr/0001-llm-explains-math-decides.md)): _the LLM explains, the math decides._** Gemini picks and words the actions. Every number on screen (% less smoke breathed, kilograms of CO₂, grams of PM2.5, "cigarettes avoided", best hours) comes from deterministic, unit-tested code whose formulas and sources the user can open. If Gemini is slow or down, a rule-based plan takes over, so the app always works.

---

## For judges: where to look

| Parameter | Evidence |
|---|---|
| **Problem statement alignment** | [Feature map](#problem-statement--feature-map) below: every phrase of the brief maps to a shipped feature and the file that implements it. |
| **Code quality** | TypeScript `strict` + `noUncheckedIndexedAccess`, ESLint and Prettier clean and enforced in CI. Pure domain logic in `src/lib/**` with thin UI components; one zod schema per contract, shared by client, server and LLM. Design decisions in [`docs/adr/`](docs/adr) and the [project handbook](AGENTS.md). |
| **Security** | [`SECURITY.md`](SECURITY.md): threat model, mitigations and the code behind each. Strict CSP and security headers; zod on every boundary; per-IP rate limits; prompt-injection guard; owner-only Firestore rules; secrets server-only; gitleaks and `npm audit` in CI. |
| **Efficiency** | [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md): layered caching (55-second air cache, 24-hour place-name cache, shared station feed, day-and-household plan cache), one shared live-air feed per app, a batched endpoint for saved places, below-the-fold cards loaded on demand, hand-built SVG charts (no chart library). |
| **Testing** | **225 unit, component and route tests** (Vitest, coverage gate ≥ 80% enforced in CI) and **34 Playwright end-to-end flows**, including a keyboard-only journey and axe scans. See [Testing](#testing). |
| **Accessibility** | [`ACCESSIBILITY.md`](ACCESSIBILITY.md): WCAG 2.1 AA, axe scans of **9 pages × light and dark** with zero serious or critical violations, full keyboard use, reduced motion, colour never used alone, plain-language units and a glossary, Hindi UI. |

---

## Problem statement → feature map

| The brief asks for… | AirWise | Where |
|---|---|---|
| **Families** | A 4-step household setup (who lives there, their age and health, home, travel). A per-person "can they go out now?" answer, extra-care rules for children, elders and people with asthma or heart conditions, and per-person smoke-breathed bars. | `components/OnboardingForm.tsx`, `lib/air/activities.ts`, `components/cards/HouseholdCard.tsx` |
| **Communities** | City pledges with live totals (Firestore server-side aggregation), a share card for family and housing-society groups, and a ready-to-send complaint about burning, dust or smoky vehicles. | `components/plan/CommunityCard.tsx`, `lib/share.ts`, `components/ReportPollution.tsx` |
| **Severe winter smog / urban pollution** | Live AQI for the exact place (blended CPCB stations within 30 km, with the forecast calibrated to them), six pollutants against WHO limits, the stations near you, and why smog is trapped today (wind, cold, humidity). | `lib/air/stations.ts`, `lib/air/service.ts`, `components/cards/AirMixCard.tsx`, `components/cards/StationsCard.tsx` |
| **Low-emission daily routines** | Today's plan, laid out by time of day, from the cleanest and smokiest hours: when to shut windows, when to walk, the best outing window, and a live countdown to clean air. | `lib/air/dayWindows.ts`, `components/plan/PlanView.tsx`, `components/OutingPlanner.tsx`, `components/cards/CountdownCard.tsx` |
| **Indoor air-quality hacks** | Purifier and ₹1,500 DIY filter, cooking exhaust, swapping incense and coils, an N95 fit guide, and a library of 18 hacks and myth-busters with sources. | `lib/impact/catalogue.ts`, `lib/hacks.ts`, `components/HealthView.tsx` |
| **Sustainable alternatives** | Metro or bus instead of the car, car-pooling, induction cooking, composting instead of burning, each with the CO₂ and smoke kept out of the city every week. | `lib/impact/catalogue.ts`, `lib/impact/evaluate.ts` |
| **Tailored to location** | Precise GPS or type-ahead search down to the town or neighbourhood (for example "Bihta, Patna"), saved places compared side by side, and city-specific pollution sources. | `components/LocationPicker.tsx`, `lib/air/place.ts`, `components/cards/PlacesCard.tsx` |
| **Tailored to lifestyle** | Commute mode and distance, stove type, purifier, incense, waste burning, and who goes outdoors. | `lib/profile/schema.ts`, `lib/impact/exposure.ts` |
| **Clearly explaining direct impact** | Every step shows "x% less smoke breathed by the family today", kilograms of CO₂ and grams of smoke saved each week, and "How is this calculated?" (formula, inputs, citations). A glossary explains every term, and units are spelled out. | `components/plan/PlanItemCard.tsx`, `components/cards/Glossary.tsx` |
| **GenAI assistant** | Gemini writes the plan (structured JSON output) and powers "Ask AirWise", a streaming chat grounded in the live air and the household, in plain text, English or Hindi. | `lib/ai/*`, `components/chat/*` |

**Also built for the public:**
- smog alerts (browser notifications with real readings, plus an in-app alerts bell);
- the Health & help page (112 and 108, hospitals near you, when to see a doctor);
- smog alerts and plans that work offline-first;
- accounts that are optional, with guests welcome.

---

## How GenAI is used

1. **Grounding.** `lib/ai/context.ts` builds a compact facts block: the live AQI and its source, the cleanest and smokiest hours, the household, and the impact of each candidate action, already calculated.
2. **Structured planning.** `lib/ai/plan.ts` calls Gemini (`@google/genai`) with `responseJsonSchema` generated from the same zod schema the server validates with. Action IDs are an enum, so the model cannot invent an action. Times, slots and numbers are then attached from deterministic code.
3. **Chat.** `lib/ai/chat.ts` streams answers, which pass through `PlainTextStream` so no markdown reaches the screen. User text is wrapped in `<user_question>` tags as a prompt-injection guard.
4. **Resilience.** Model fallbacks (`gemini-3.5-flash-lite` → `gemini-3.6-flash` → `gemini-3.5-flash`), short timeouts, then a rule-based plan and answer. Plans are cached per day and per household.

## Real-world data

| Data | Source | Notes |
|---|---|---|
| Station AQI | CPCB national feed (public relay) | All stations within 30 km, inverse-distance blended; schema-validated, 3-second timeout, see [`SECURITY.md`](SECURITY.md) |
| Hourly PM2.5, PM10, NO₂, SO₂, CO, O₃ and the forecast | Open-Meteo (Copernicus CAMS); Google Air Quality API if a key is set | Calibrated to the stations so every card agrees ([ADR-0002](docs/adr/0002-station-blend-and-calibration.md)) |
| Weather (wind, temperature, humidity) | Open-Meteo | Tells families why smog is trapped today |
| Place names and search | OpenStreetMap Nominatim, Open-Meteo geocoding | Place-name lookup at about 110 m, search by name only |

---

## Screens
- **Welcome / sign in** (`/login`): email and password, Google, password reset, continue as a guest, or try a sample family.
- **Household setup** (`/setup`): four steps (where you live, who lives with you, your home, getting around), then the dashboard.
- **Dashboard** (`/`):
  - greeting and today's air in a sentence;
  - four number cards (live AQI, fine smoke against the WHO limit, smoke you can avoid, steps done);
  - "Air this week" (striped bars are forecast days);
  - Next step, Today's plan, Your household, a progress ring and the clean-air countdown;
  - Your places and Stations near you;
  - Today at a glance (24-hour band), PM2.5 by hour, What's in your air, and weekly impact.
- **Daily Plan** (`/plan`): the timeline of the day with check-off, impact per step, per-person bars, a health watch and community pledges.
- **Ask AirWise** (`/ask`): Claude/ChatGPT-style streaming chat with a thinking indicator, Stop, Copy and Retry.
- **Indoor Hacks** (`/hacks`), **Health & help** (`/health`), **Household** (`/onboarding`), **Settings** (`/settings`: language, theme, alerts, location, cloud sync, delete my data).

---

## Architecture

```
Browser (Next.js client)                          Server (Next.js route handlers, Cloud Run-ready)
┌──────────────────────────────┐   GET /api/air          ┌──────────────────────────────────────────────┐
│ App shell: setup gate,       │───────────────────────►│ rate limit → zod → air service (55 s LRU)     │──► CPCB station feed (blend, calibrate)
│ one shared live-air feed     │   GET /api/air/batch    │   Open-Meteo / Google AQ + weather            │──► Open-Meteo / Google Air Quality
│ (AirProvider), alerts        │   GET /api/stations     │                                                │
│ Dashboard · Plan · Chat      │   POST /api/plan        │ rate limit → zod → impact engine → Gemini     │──► Gemini (structured JSON)
│ localStorage (zod-validated) │   POST /api/chat        │   → validate → attach verified numbers        │──► Gemini (streaming, plain text)
│ Firebase sync ───────┐       │   GET /api/geocode      │   fallback: rule-based plan / answer          │──► Nominatim / Open-Meteo geocoding
└──────────────────────┼───────┘                          └──────────────────────────────────────────────┘
                       ▼
     Firebase Auth (anonymous guest → email/password or Google, data carried over)
     Firestore: airwise_users/{uid} · …/days/{date} · airwise_pledges/{uid}  (owner-only rules, deny by default)
```

Project map, data flow and coding rules: [`AGENTS.md`](AGENTS.md). Design tokens and writing rules: [`docs/DESIGN.md`](docs/DESIGN.md). Research and roadmap: [`docs/PRD.md`](docs/PRD.md).

### The impact model (`src/lib/impact`)
- **Indoor PM2.5** uses a steady-state mass balance: `C_in = (P·a·C_out + S·(a+k)) / (a + k + CADR/V)`. Here P is penetration, a is air exchange (windows open or closed), k is deposition, S is indoor sources (stove, incense), and CADR/V is the purifier (Riley et al. 2002).
- **Inhaled dose** is the sum, over 24 hours, of the concentration in each place × breathing rate by age and activity (US EPA Exposure Factors Handbook 2011).
- **Places and masks**: car, two-wheeler, bus and metro factors (Goel et al. 2015, Delhi). An N95 removes about 70% in real-world wear (Cherrie et al. 2018).
- **Emissions**: per-passenger-km CO₂ and PM2.5 by mode (ARAI, DMRC, EEA), cooking fuel (IPCC, CEA grid factor), open burning (Akagi et al. 2011).
- **Cigarette equivalent**: 22 micrograms per cubic metre for a day ≈ 1 cigarette (Berkeley Earth).
- The combined plan is simulated together, not summed, so overlapping actions are not double-counted.

---

## Run it

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (free at aistudio.google.com); Firebase keys optional
npm run dev                  # http://localhost:3000
```

No keys? It still runs: air data comes from Open-Meteo and the station feed, and plans and chat use the built-in rules. `AIRWISE_MOCK_DATA=1` gives deterministic offline sample data.

## Testing

```bash
npm run check      # lint + typecheck + Prettier + unit tests with the 80% coverage gate
npm run test:e2e   # production build + Playwright + axe accessibility scans
```

- **Unit, component and route tests (225, Vitest + Testing Library)** cover:
  - the air pipeline: NAQI, station blending and calibration, the day windows, alerts, the activity advisor, the outing planner and the countdown;
  - the impact model;
  - Gemini paths (success, timeouts, fallbacks, plain-text streaming);
  - every API route (validation, rate limits, mock mode);
  - Firebase auth and sync (mocked);
  - hooks (plan re-fetch, ticks reset, auto-refresh);
  - UI components (location combobox, report form, gauge, stat card).
- **End-to-end (34, Playwright)**:
  - the first visit → welcome → 4-step setup → dashboard → plan → tick;
  - a sample family;
  - dashboard numbers and plain units;
  - station-led AQI;
  - refresh without clearing data;
  - chat in plain text;
  - login validation;
  - theme;
  - security headers;
  - health page;
  - share fallback;
  - location search;
  - a **keyboard-only journey**;
  - **axe WCAG 2.1 AA on 9 pages × 2 themes**.
- CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs gitleaks, lint, typecheck, format, unit tests with coverage, `npm audit`, and the full e2e suite on every push.

## Deploy (Google Cloud Run)
```bash
gcloud run deploy airwise --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-3.5-flash-lite --set-secrets GEMINI_API_KEY=gemini-key:latest
```
The non-root `Dockerfile` uses the Next.js standalone output.

## Privacy
- Accounts are optional; guests use an anonymous Firebase session, and only that user can read their data (Firestore rules).
- The precise location stays on the device. The server and Firestore see coordinates rounded to about 1 km; the place-name lookup uses about 110 m so it names the exact village or neighbourhood.
- The station feed never receives a location: the whole national feed is downloaded and matched on the server.
- "Delete all my data" removes everything from the device and Firestore.

## Honesty notes
- Impact figures are **model estimates** built from published coefficients. They show the size of an effect, not a personal medical measurement.
- Away from monitoring stations (or outside India) the AQI is a labelled model estimate.
- Alerts are sent while AirWise is open in a tab. Closed-tab push notifications are on the roadmap.
- AirWise is not medical advice. The health notes point people to a doctor for symptoms.
