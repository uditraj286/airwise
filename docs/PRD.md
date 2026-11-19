# AirWise — GenAI Smog & Air-Quality Companion (PromptWars Challenge 6)

## Context
PromptWars (Hack2Skill, Google-backed) Challenge 6 asks for a GenAI assistant that helps families and communities get through severe winter smog: low-emission daily routines, indoor air hacks and sustainable swaps, tailored to location and lifestyle, with a clear explanation of what each choice changes. Submissions are a **public GitHub repo under 10 MB** and are scored by an AI judge on six parameters: **Code Quality, Security, Efficiency, Testing, Accessibility, Problem Statement Alignment**. Max 3 submission attempts. The project folder `/Users/udit/Downloads/PromptWars` is empty, so this is a greenfield build.

UI reference: a clean SaaS dashboard (left sidebar, "Overview" header with search, bell and light/dark toggle, three KPI cards with mini bar charts, avatar row, big bar-chart trend card with Days/Week/Month segmented control, donut "sources" card, 3-stat funnel card). We reproduce that layout, spacing, type scale and light/dark behaviour 1:1, with our own logo, copy and data (no third-party branding).

---

## 1. Research summary (drives the product decisions)
- **The problem is acute and seasonal.** North Indian cities (Delhi NCR, Lucknow, Kanpur, Patna) routinely hit AQI 300–500 ("Very Poor"/"Severe") from Oct–Jan: stubble burning, vehicle exhaust, construction dust, biomass/coal heating, plus winter inversions that trap PM2.5 near the ground. Similar episodes hit Lahore, Dhaka, Beijing, Ulaanbaatar.
- **PM2.5 is the metric that matters** for health; WHO 24-h guideline is 15 µg/m³, Delhi winter days often exceed 250 µg/m³. Children, elderly, pregnant people, asthma/COPD and cardiac patients are the high-risk groups.
- **People mostly know "it's bad" but not "what do I change today".** The actionable levers are: timing (pollution peaks early morning and late evening; mid-afternoon is usually least bad), indoor sealing + filtration (HEPA purifiers, DIY box-fan + MERV-13 filter, closing windows during peaks, wet mopping, avoiding incense/mosquito coils/kerosene/frying fumes), masks (N95 fit matters; cloth masks do little), route choice (avoid arterial roads), and emission-reducing swaps (metro/carpool, not burning leaves/waste, induction over gas, avoiding diwali crackers).
- **Indoor air is not automatically safer.** Without filtration, indoor PM2.5 is commonly 60–90% of outdoor; a correctly sized HEPA purifier (CADR ≥ room volume × 4–5 air changes/hr) cuts it 50–80%.
- **Data sources:** Google **Air Quality API** (current, hourly forecast up to 96 h, health recommendations per group, pollutant breakdown) — fits a Google-judged hackathon. **Open-Meteo Air Quality API** (free, no key) as fallback and for tests. Google **Geocoding/Places** or browser geolocation for location.
- **Gap in existing apps** (IQAir, SAFAR, Sameer, AQI.in): they show numbers and generic advice; none build a *personal plan for your household* or quantify *"if you do X, your family's PM2.5 dose drops by Y%"*. That gap is our pitch and our Problem-Statement-Alignment score.

## 2. PRD

### 2.1 Problem statement
Families in smog-hit cities lack a personalised, actionable daily plan that reduces both their **exposure** (health) and their **contribution** (emissions), and they can't see the concrete impact of each choice.

### 2.2 Goals / success metrics (demo-measurable)
| Goal | Metric shown in-app |
|---|---|
| Reduce household exposure | "Today's inhaled PM2.5 dose" vs. baseline, % reduction |
| Reduce emissions | kg CO₂ and g PM2.5 avoided per week from swaps |
| Make it actionable | Plan generated in < 5 s, ≤ 6 tasks, each with time + impact |
| Trust | Every number traceable to a formula + source (Explain panel) |

### 2.3 Personas
1. **Priya, parent in Delhi** — 2 kids (one asthmatic), car commute, gas stove. Wants: when to send kids out, purifier advice, school-run plan.
2. **Mr. Sharma, 68, retired, Lucknow** — morning walker, heart condition. Wants: safe walk window, simple large-text guidance, Hindi.
3. **RWA / community lead** — wants a shareable community brief (car-pool, no-burning pledge, collective impact).

### 2.4 Features
**P0 (must ship for judging)**
1. **Onboarding profile** (≤ 60 s): location (geolocation or city search), household members + sensitive conditions, home (rooms, purifier Y/N, stove type), commute mode/distance, outdoor habits. Stored locally (no account).
2. **Overview dashboard** (the reference layout):
   - KPI cards → **Current AQI**, **PM2.5 µg/m³**, **Your exposure score** (each with 12-hour mini bar sparkline and "vs yesterday" delta).
   - Avatar row → **Household members** with per-person risk badge ("Aarav – asthma – High risk") + "Edit".
   - Big trend card → **AQI forecast** bar chart with **Hours / Days / Week** segmented control; highlighted bar = "best window outside" with tooltip.
   - Donut card → **Pollution sources for your city** (vehicles, dust, biomass, industry, other) — the donut centre shows dominant pollutant.
   - Funnel card → **Your impact this week**: Actions planned → Actions done → PM2.5 dose avoided.
3. **AI Daily Plan** (Gemini, structured JSON): time-blocked routine for today (e.g., "7–9 AM keep windows shut, run purifier on high in kids' room"), each item tagged *exposure* or *emission*, with a deterministic **impact number** and a one-line "why".
4. **Ask AirWise chat**: grounded Q&A ("Can my son play cricket at 4 PM?") using live AQI + profile as context; refuses medical diagnosis, points to doctor for symptoms.
5. **Impact explainer**: click any number → panel showing formula, inputs and source (WHO, CPCB, EPA). This is the "clearly explaining direct impact" requirement.
6. **Light/dark mode, keyboard navigation, screen-reader labels, English + Hindi** toggle.

**P1 (if time allows)**
- Indoor hacks library (filterable cards: DIY purifier, plants myth-buster, cooking ventilation).
- Sustainable swaps calculator (car → metro, gas → induction) with weekly savings.
- Community brief: one-click shareable card for RWA WhatsApp groups.
- Smart alerts (browser notifications when AQI crosses a threshold).

**Out of scope:** user accounts, medical advice, hardware sensor integration, native apps.

### 2.5 Non-functional requirements (mapped to judging criteria)
| Criterion | What we do |
|---|---|
| **Code Quality** | TypeScript strict, ESLint + Prettier, small pure modules, domain logic separate from UI, README with architecture diagram, JSDoc on public functions, conventional commits |
| **Security** | API keys only server-side (route handlers), zod validation on every input/LLM output, rate limiting per IP, prompt-injection guard (user text wrapped and never trusted as instructions), CSP + security headers, no PII stored server-side, `.env.example` only, dependency audit in CI |
| **Efficiency** | AQI responses cached (5–15 min, keyed by rounded lat/lng), Gemini Flash with structured output + low temperature, streaming chat, server components, lazy-loaded charts, Lighthouse perf ≥ 90 |
| **Testing** | Vitest unit tests for impact engine + prompt builder + schemas (≥ 80% coverage on `lib/`), Testing Library component tests, Playwright e2e on the onboarding→plan flow with mocked APIs, GitHub Actions CI |
| **Accessibility** | WCAG 2.1 AA: contrast-checked tokens in both themes, semantic landmarks, focus rings, chart data also exposed as visually-hidden tables, `aria-live` for streaming answers, reduced-motion support, axe checks in e2e, Lighthouse a11y ≥ 95 |
| **Problem Alignment** | Every feature maps to a phrase in the brief: families & communities, low-emission routines, indoor hacks, sustainable alternatives, location + lifestyle tailoring, explained impact |

## 3. Architecture

```
Browser (Next.js client)                     Server (Next.js route handlers on Cloud Run)
┌───────────────────────────┐   fetch        ┌───────────────────────────────────────┐
│ Dashboard / Plan / Chat   │──────────────► │ /api/air      → AirQualityService      │──► Google Air Quality API
│ Profile in localStorage   │                │                  (fallback Open-Meteo)  │    (cache 10 min)
│ Recharts, theme toggle    │◄────────────── │ /api/plan     → PlanService            │──► Gemini (structured JSON)
└───────────────────────────┘   JSON/stream  │ /api/chat     → ChatService (stream)   │──► Gemini (stream)
                                             │ lib/impact    → deterministic formulas  │
                                             │ middleware    → rate limit, headers     │
                                             └───────────────────────────────────────┘
```

**Key design decision (ADR-001): LLM explains, math decides.** Impact numbers (dose reduction, CO₂ saved) are computed by a pure, tested `lib/impact` engine from cited constants. Gemini only selects/orders actions from a typed catalogue, personalises wording and explains. Prevents hallucinated numbers, makes testing possible, and is the strongest story for judges.

**Stack:** Next.js 15 (App Router) + TypeScript strict, Tailwind CSS with design tokens matching the reference, Recharts, lucide-react icons, `@google/genai` SDK (model via `GEMINI_MODEL` env, default latest Gemini Flash), zod, Vitest, Testing Library, Playwright + @axe-core/playwright, deploy on Google Cloud Run (Dockerfile) — keeps the whole thing in the Google ecosystem.

### Impact engine (lib/impact)
- `inhaledDose = Σ_hours concentration(h, location) × breathingRate(ageGroup, activity) × hours`
- indoor concentration = outdoor × infiltration factor (0.7 windows closed / 0.9 open) × (1 − purifierEfficiency), purifierEfficiency from CADR / room volume.
- emission savings = distance × (factor_car − factor_alternative); factors in `lib/impact/constants.ts` with source comments.
- Output per action: `{ exposureReductionPct, co2KgSaved, pm25GramsAvoided, formulaId }`.

### Gemini prompt design
- System prompt: role, safety rules (no diagnosis, cite sensitive groups), output schema, "only choose actions from the provided catalogue IDs".
- Context block: profile (sanitised), current AQI + 24h forecast summary, best/worst windows, computed impacts per candidate action.
- `responseMimeType: application/json` + `responseSchema`; validate with zod; on failure retry once, then fall back to rule-based plan (app never breaks in demo).

## 4. Repo structure
```
airwise/
  app/(dashboard)/page.tsx, plan/, ask/, hacks/, settings/
  app/api/air/route.ts, plan/route.ts, chat/route.ts
  components/layout/Sidebar.tsx, Topbar.tsx, ThemeToggle.tsx
  components/cards/KpiCard.tsx, TrendCard.tsx, SourcesDonut.tsx, ImpactFunnel.tsx, HouseholdRow.tsx
  components/plan/, components/chat/, components/ui/ (Button, Segmented, Card, Badge)
  lib/air/ (google.ts, openMeteo.ts, cache.ts, aqi.ts)
  lib/impact/ (dose.ts, emissions.ts, constants.ts, catalogue.ts)
  lib/ai/ (gemini.ts, prompts.ts, schemas.ts, fallback.ts)
  lib/security/ (rateLimit.ts, sanitize.ts)
  i18n/en.json, hi.json
  tests/unit, tests/e2e
  .github/workflows/ci.yml, Dockerfile, README.md, .env.example
```

## 5. Roadmap (time-boxed; ~11 days left on the module clock)
| Phase | Days | Deliverable |
|---|---|---|
| 0. Setup | 0.5 | Next.js + TS strict + Tailwind tokens + lint/format + Vitest/Playwright + CI + Dockerfile |
| 1. UI shell | 1.5 | Pixel-match of reference: sidebar, topbar, theme toggle, all 5 card components with mock data, responsive down to mobile |
| 2. Air data | 1 | `/api/air` with Google AQ API + Open-Meteo fallback, caching, AQI category mapping, wired into KPI + trend + donut |
| 3. Onboarding + impact engine | 1.5 | Profile wizard, localStorage, `lib/impact` with full unit tests |
| 4. Gemini plan + chat | 2 | Structured plan, streaming chat, injection guard, fallback plan, explain panel |
| 5. Hardening | 1.5 | Rate limit, CSP headers, axe/Lighthouse fixes, Hindi strings, e2e flow, coverage ≥ 80% on lib |
| 6. Ship | 1 | Cloud Run deploy, README (problem, architecture, criteria mapping, screenshots), demo video, repo < 10 MB check, **submission 1** |
| Buffer | 2 | Use AI-judge feedback from attempt 1 to improve, then attempts 2–3 |

## 6. Verification
- `npm run lint && npm run typecheck && npm test -- --coverage` all green in CI.
- `npx playwright test` — onboarding → dashboard → generate plan → ask question, with axe zero serious violations.
- Lighthouse (desktop + mobile): Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95.
- Manual: compare dashboard screenshot side-by-side with reference in light and dark mode; test Delhi, Lahore and a clean-air city; kill the Gemini key to confirm fallback plan renders.
- `du -sh` of repo < 10 MB, no secrets in git history (`git log -p | grep -i key`).
