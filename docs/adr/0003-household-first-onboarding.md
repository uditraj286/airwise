# ADR-0003: Household first

**Status:** Accepted

## Context
A plan is only useful if it knows who lives in the home and where. Early versions showed a sample family to every new visitor, which confused real users.

## Decision
- `AppShell` waits for cloud sync to settle. Then `setupRedirect()` sends anyone without a saved household (or without a confirmed location) to `/login` (guests) or `/setup` (signed-in users).
- The 4-step wizard (where you live, who lives with you, your home, getting around) validates each step and ends on the dashboard.
- "Try with a sample family" stays on the welcome page for judges and demos, and is clearly marked.
- Once saved, the household's own names win over the account name everywhere, and the account display name follows the main member.

## Consequences
- Every number is personal from the first screen.
- Tests seed a household (`seedHousehold`) to reach inner pages.
