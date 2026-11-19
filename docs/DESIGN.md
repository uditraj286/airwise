# AirWise design system

The UI follows one rule: **answer the family's question at a glance, then let them dig in.** Every screen leads with a plain sentence ("Go out 3–5 PM"), then a visual, then the numbers and their sources.

## Tokens

All colours are RGB triplets on `:root` / `.dark` in `src/app/globals.css`, exposed to Tailwind in `tailwind.config.ts`. Every text/background pair is checked for WCAG 2.1 AA in both themes by the axe e2e suite.

### Colour
| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | 245 245 246 | 9 9 11 | Page background behind the app frame |
| `surface` | 255 255 255 | 22 22 25 | Cards, inputs |
| `subtle` | 247 247 248 | 30 30 34 | Sidebar, KPI tray, user chat bubble |
| `line` | 236 236 239 | 44 44 50 | Hairline borders, gridlines |
| `ink` / `muted` | 17 17 19 / 100 100 110 | 244 244 245 / 161 161 170 | Primary / secondary text |
| `brand` (+ `onbrand`) | 22 101 52 | 74 222 128 | Primary buttons, links, focus ring, active nav |
| `brand-strong` | 20 83 45 | 21 128 61 | Button hover, "to do" in the progress gauge |
| `panel` | 246 247 246 | 15 18 16 | Grey panels (sidebar, top bar, main) that hold white cards |
| `good` / `warn` / `bad` | green / orange / red | lighter variants | Deltas and status text |

### AQI scale (CPCB categories)
`aqi-good`, `aqi-satisfactory`, `aqi-moderate`, `aqi-poor`, `aqi-very-poor`, `aqi-severe`. They're used for chart bars and the "Today at a glance" band. Colour never carries meaning alone: every bar and band segment has an accessible name with the value and category, and the legend repeats it in words.

### Typography (Inter)
| Token | Size / line height | Use |
|---|---|---|
| `text-display` | 44 / 1, −0.03em, 500 | The one big number or time on a card |
| `text-title` | 18 / 1.4, 500 | Card titles |
| body (default) | 15–16 / 1.6 | Paragraphs, chat |
| `text-label` | 14 / 20 | Field labels, chips, secondary lines |
| `text-caption` | 12 / 16 | Legends, axis labels, footnotes |

Numbers use `tabular-nums` so they don't jitter while counting up.

### Surfaces (reference "Donezo" layout)
- `.panel`: rounded 28px grey panel. The app is full screen: sidebar, top bar and main area are three panels on the `canvas`.
- `.hero-gradient`: green gradient for the one most important number on a page (first stat card, 112 on Health).
- `.card-dark`: deep green card with soft curves (clean-air countdown, sidebar alerts promo, login and setup side panels).
- `.hatch`: diagonal stripes for forecast or "later" values (week bars, progress gauge).
- `PageHeader` (`components/ui/PageHeader.tsx`): 40px title, one-line subtitle, `pillPrimary` / `pillSecondary` actions.
- `StatCard`: title, round ↗ link, 48px number, footer with `ChangeChip`; `hero` for the first card.

### Shape and elevation
- Card radius `rounded-card` (24px); KPI tiles 16px; trays 22px; pills `rounded-full`.
- One elevation, `shadow-card`: a 1px hairline plus a soft shadow. Depth comes from the grey tray behind the white cards, as in the reference.

### Motion
| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120 ms | Hover colour |
| `--dur-base` | 200 ms | Buttons, toggles, check-off |
| `--dur-slow` | 320 ms | Card entrance (`.animate-in`) |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Everything |

Keyframes: `fade-up` (entrances), `bar-grow` (charts, staggered by 25–30 ms), `shimmer` (skeletons and the "Thinking" label), `pulse-dot` (loading dots), `caret` (streaming cursor). `prefers-reduced-motion` turns all of them off; `CountUp` shows the final number immediately.

## Components

| Component | File | States | Accessibility |
|---|---|---|---|
| KPI tile | `cards/KpiCard.tsx` | loading (skeleton), value, delta up/down | Sparkline is `role="img"` with a label; delta announces "up/down" |
| Today at a glance | `cards/DayTimeline.tsx` | best / okay / avoid hours, "least bad" warning | Each hour is a focusable button with value and verdict; hover text is `aria-live` |
| PM2.5 by hour | `cards/TrendCard.tsx` | past 12h / next 12h / next days; focused bar | Segmented control uses `radiogroup`; bars are buttons with spoken values |
| Plan timeline | `plan/PlanView.tsx` | grouped by Morning → This week; progress bar | `ol` per section; progress announced politely |
| Plan step | `plan/PlanItemCard.tsx` | todo / done (animated check) | Real checkbox behind a styled label; "How is this calculated?" is a native `details` |
| Chat message | `chat/ChatMessage.tsx` | thinking, streaming (caret), done (copy / retry) | Speaker prefixes for screen readers; output is always plain text |
| Composer | `chat/Composer.tsx` | idle, typing, near limit, streaming (Stop) | Enter sends, Shift+Enter adds a line; labelled textarea |
| Auth card | `auth/AuthCard.tsx` | sign in / create account, field errors, loading, reset sent | `aria-invalid` + `aria-describedby` on fields; errors in `role="alert"` |
| Account menu | `layout/AccountMenu.tsx` | guest / signed in | `aria-haspopup="menu"`, closes on Escape and outside click |

## Writing rules
- Lead with the answer: "Go out 1–4 PM tomorrow", not "PM2.5 forecast analysis".
- Times are always full: "3 PM", "7 PM → 7 AM", plus "tomorrow" when the hour is on the next day. No "3P".
- Say what the number means: "Less smoke breathed in 45%", not "Exposure reduction".
- Sentence case. No exclamation marks or emoji. Don't call anything "AI-powered" in the UI.
- Health copy is calm and points to a doctor for symptoms; it never diagnoses.

## Do / don't
| Do | Don't |
|---|---|
| Colour bars by AQI category and add a legend | Highlight one bar and leave the rest grey |
| Call an unhealthy best hour "least bad" and suggest an N95 | Call an unhealthy hour "best time to go out" |
| Truncate long labels on one line | Let labels wrap and push numbers out of line |
| Show skeletons shaped like the final layout | Show a lone spinner in an empty page |
| Strip markdown from model output | Show `**` or `#` to users |
