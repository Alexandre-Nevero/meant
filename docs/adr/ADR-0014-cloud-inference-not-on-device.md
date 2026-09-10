# ADR-0014 — Inference runs in the cloud via Vercel AI Gateway; on-device deferred

- **Date:** 2026-08-28
- **Status:** Accepted
- **Context:** On-device (Gemini Nano) needs 22GB free disk and 16GB RAM — a real share of this persona's laptops don't clear that floor, and Apex's own stated hardware floor (macOS 13+/Windows 10+) names no RAM or disk minimum at all, independently confirming the exclusion risk. Two inference code paths is also the kind of complexity that stops a build shipping.
- **Decision:** All inference (plan, judge, coach) runs in the cloud via Vercel AI Gateway. On-device is deferred as a v2 privacy upgrade, not attempted now.
- **Consequences:** One code path, judgment quality prioritized over judgment location. The Prompt API path stays open for v2 once one path works end to end.
- **Source:** `docs/sdd-intent.md` §4.3, §6; C8
