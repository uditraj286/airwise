# ADR-0005: One live air feed for the whole app

**Status:** Accepted

## Context
The dashboard cards, smog alerts, share text and health page all need the current air. Fetching it in each place multiplied requests and could show slightly different numbers.

## Decision
`AirProvider` (`src/lib/airContext.tsx`) runs a single `useAir()` poll per app (once a minute while visible), and every consumer reads it through `useLiveAir()`. The server sets the current hour to the live reading (`alignCurrentHour`), so "now" is one number everywhere. Saved places use a separate batched endpoint.

## Consequences
- Fewer requests and consistent numbers across cards and alerts.
- Pages outside the app shell (`/login`, `/setup`) don't load air data.
