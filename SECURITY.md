# Security

AirWise handles household details (names, ages, health conditions, location), so it is built to collect little, keep it close, and validate everything that crosses a boundary. This page lists the threats we considered and where each mitigation lives in the code.

## Reporting a problem
Please open a private security advisory on this GitHub repository (Security → Report a vulnerability), or open an issue marked **security** without exploit details. We aim to reply within 72 hours.

## Threat model and mitigations

| Threat | Mitigation | Code |
|---|---|---|
| **Prompt injection** through chat | User text is cleaned (tag spoofing and control characters removed) and wrapped in `<user_question>`. The system prompt says that text is a question, never an instruction. The planner prompt receives no free text at all, only validated facts. | `src/lib/ai/prompts.ts` |
| **LLM making things up** (numbers, unsafe advice) | Structured output validated with zod; action IDs are an enum; every number, time and slot comes from deterministic code, not the model ([ADR-0001](docs/adr/0001-llm-explains-math-decides.md)). Chat output passes through a markdown/plain-text sanitiser. Health copy points to a doctor and never diagnoses. | `src/lib/ai/schemas.ts`, `src/lib/ai/plan.ts`, `src/lib/ai/plainText.ts` |
| **Malformed or hostile input** to the API | Every route validates query and body with zod (coordinates in range, lengths capped, at most 5 points per batch). Same-origin check, `application/json` only, 16 KB body cap. | `src/lib/ai/schemas.ts`, `src/lib/security/http.ts` |
| **Abuse and cost blow-ups** | Per-IP rate limits: air 60/min, stations 30/min, AI 12/min. Gemini calls have short timeouts and capped tokens; results are cached per day and household. | `src/lib/security/rateLimit.ts`, `src/lib/security/http.ts` |
| **Untrusted upstream data** (air providers, station relay, geocoder) | Every upstream payload is parsed with zod; bad rows are skipped; timeouts of 3–6 seconds; on failure the app falls back (station → model → last good reading) instead of erroring. | `src/lib/air/*.ts` |
| **Third-party station relay** (`api.dharun.dev`, a public mirror of the CPCB feed) | We download the **whole national feed** and pick stations on our server, so the relay **never receives a user's location**. Rows are schema-validated (AQI 0–500, coordinates in range, fresh timestamps only), the call times out after 3 seconds, and the model takes over if it fails. For production, switch to the official data.gov.in CPCB API (free key). | `src/lib/air/stations.ts` |
| **XSS and clickjacking** | Strict Content-Security-Policy (`default-src 'self'`, only the Firebase and Google sign-in origins), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS, Referrer-Policy, Permissions-Policy, COOP, no `X-Powered-By`. React escapes all output; model text is shown as plain text, never as HTML. | `next.config.ts` (tested in `tests/e2e/app.spec.ts`) |
| **Leaked secrets** | `GEMINI_API_KEY` and `GOOGLE_AIR_QUALITY_API_KEY` are server-only. Only public Firebase web-config values (`NEXT_PUBLIC_FIREBASE_*`) reach the browser; access is enforced by Firestore rules. `.env.local` is git-ignored, and CI runs a gitleaks secret scan. | `.gitignore`, `.github/workflows/ci.yml` |
| **Reading or changing someone else's data** | Firestore rules: owner-only read and write, field allow-lists, size limits, server-set timestamps, deny by default. AirWise collections are namespaced (`airwise_*`) inside a shared project. | `firestore.rules` |
| **Account attacks** | Firebase Auth handles passwords (8+ characters), Google sign-in and password resets; AirWise never sees or stores a password. Firebase's built-in protection against repeated guesses applies ("too many attempts"). | `src/lib/firebase/auth.ts` |
| **Location privacy** | The precise point stays on the device. Reverse geocoding, Firestore sync and server caches use coordinates rounded to about 1 km. The station relay gets no location at all. | `src/lib/air/place.ts`, `src/lib/firebase/repo.ts` |
| **Tampered local storage** | Every localStorage read is parsed with zod and falls back to safe defaults. | `src/lib/profile/store.ts` |
| **Vulnerable dependencies** | `npm audit --omit=dev --audit-level=high` in CI (currently 0 vulnerabilities); the `@grpc/grpc-js` override pins a patched version. | `package.json`, CI |
| **Account enumeration** (trade-off) | To help families who forgot they signed up, "Create account" with a registered email says so and offers sign-in. This reveals that an email is registered; Firebase rate-limits these attempts. Turn on Firebase email-enumeration protection to hide it if needed. | `src/lib/firebase/auth.ts` |
| **Container hardening** | Non-root user, standalone output, no dev dependencies in the image. | `Dockerfile` |

## Known limits
- Rate limits and caches are per instance. That's fine for one Cloud Run instance; use a shared store (for example Memorystore) to scale out.
- Smog alerts use the browser Notification API while the tab is open; there's no push server, so no device tokens are stored.
