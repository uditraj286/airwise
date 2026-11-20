# Performance and efficiency

AirWise runs on a phone in a smoggy city, often on a slow connection, and calls free public APIs that must not be hammered. Efficiency decisions, measured on the production build (`npm run build`, Next.js 16 + Turbopack).

## Network: do less, cache close to the user
| Layer | What it caches | Lifetime | Code |
|---|---|---|---|
| Server air cache | Full snapshot per location (air + weather + stations, calibrated) | 55 s fresh, stale copy kept 55 min as a fallback | `src/lib/air/service.ts` (`TtlCache`, bounded LRU) |
| Station feed | The whole national CPCB feed, shared by every user and place | 55 s | `src/lib/air/stations.ts` |
| Place names | Reverse-geocode result per ~110 m cell; search results per query | 24 h | `src/lib/air/place.ts`, `src/app/api/geocode/route.ts` |
| Plan | Today's plan per household fingerprint (no repeat Gemini calls) | the day, background refresh hourly | `src/lib/usePlan.ts` |
| Shared live feed | One `/api/air` poll per minute for the whole app (dashboard, alerts, share, health page) | while open | `src/lib/airContext.tsx` |
| Saved places | One batched request (`/api/air/batch`, up to 5 places) instead of one per place | every 5 min | `src/app/api/air/batch/route.ts` |
| Firestore | Offline persistent cache, debounced writes (600 ms), server-side `count()`/`sum()` for community totals (no document downloads) | — | `src/lib/firebase/*` |

- Air, weather and the station feed are fetched **in parallel**. Open-Meteo gets one quick retry; plan and chat may reuse a cached snapshot when a provider is slow.
- Polling pauses when the tab is hidden and catches up when it becomes visible again.
- `fetch(..., { cache: "no-store" })` is used only where freshness matters (live readings, place names); everything else relies on the server caches above.

## Request budget (one open dashboard)
| Endpoint | Rate |
|---|---|
| `/api/air` | 1 per minute (only while visible) |
| `/api/stations` | 1 per minute (only while visible) |
| `/api/air/batch` | 1 per 5 minutes |
| `/api/plan` | about 1 per day per household (plus an hourly background refresh while the plan page is open) |

Upstream, the shared caches mean that many families in the same area cost about the same as one.

## Rendering and bundle
- Below-the-fold dashboard cards (`DayTimeline`, `TrendCard`, `AirMixCard`, `PlacesCard`, `StationsCard`, `Glossary`) load on demand with `next/dynamic` and layout-shaped skeletons.
- Charts are hand-built SVG/CSS. There is no chart library, and icons are tree-shaken from `lucide-react`.
- All pages are pre-rendered as static shells; only the API routes run on the server.
- Measured client JavaScript for the whole app is about **500 KB gzipped** across 26 chunks. The largest single chunk (about 200 KB) is the Firebase SDK (Auth + Firestore).
- **Roadmap:** load Firebase lazily after first paint, which would trim about 40% of first-load JavaScript.
- `prefers-reduced-motion` also skips animation work.

## Server
- Standalone Next.js output in a small non-root container (`Dockerfile`), ready for Cloud Run.
- Per-instance caches and rate limits are bounded (LRU), so memory stays flat under load.
