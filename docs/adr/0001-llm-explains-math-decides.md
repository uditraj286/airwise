# ADR-0001: The LLM explains, the math decides

**Status:** Accepted

## Context
Families act on AirWise's numbers ("go out 1–4 PM", "56% less smoke breathed"). An LLM can phrase advice well, but it can also invent numbers, times or actions, and it is sometimes slow or unavailable.

## Decision
- Gemini only **chooses and words** actions, from a fixed catalogue (enum IDs), through structured JSON output validated with zod.
- Every number, time and time-of-day slot comes from deterministic, unit-tested code with cited constants (`src/lib/impact`, `src/lib/air`, `src/lib/ai/fallback.ts`) and is attached after the model replies.
- If Gemini fails or times out, a rule-based plan (`rulePlan`) and rule-based chat answers take over.

## Consequences
- The numbers are reproducible and testable, and every one can be explained ("How is this calculated?").
- The app works with no API key (useful for judges and offline demos).
- New action types require code and tests, not just prompt changes.
