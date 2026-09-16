# ADR-0037 — Ambiguity is a reason to stay silent; an explicit tap resolves at n=1

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** A domain with conflicting evidence (sometimes work, sometimes drift) shouldn't get memorized on weak signal — but a user's own direct correction is unambiguous even the first time.
- **Decision:** The 3-observation / 80%-agreement rule (`MEMORY_MIN_EVIDENCE`, `MEMORY_MIN_AGREEMENT` in `lib/thresholds.ts`) governs *conflicting* evidence only. An explicit user tap resolves and memorizes at n=1 — no threshold applies to a direct correction.
- **Consequences:** The product never states an ambiguous pattern with false confidence, while still respecting an explicit "that was work" immediately.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D30"), `lib/thresholds.ts`
