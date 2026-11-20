# ADR-0004: Privacy by default

**Status:** Accepted

## Decision
- Local-first: the household, plan and progress live in zod-validated localStorage; Firebase sync is optional, and guests use an anonymous session.
- Precise coordinates stay on the device. The server and Firestore use about 1 km rounding, the place-name lookup about 110 m, and the station relay gets no location at all.
- Firestore data is namespaced (`airwise_*`) in a project shared with another app. Rules are owner-only with field allow-lists and deny by default.
- Gemini receives first names, age groups and conditions, never contact details.
- "Delete all my data" clears the device and Firestore; signing out wipes the device copy for shared phones.
