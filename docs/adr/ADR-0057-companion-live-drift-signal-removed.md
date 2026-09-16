# ADR-0057 — The companion's live drift signal is removed

- **Date:** 2026-09-15
- **Status:** Accepted
- **Supersedes:** the drift-signalling half of PRD-F10 and PRD §3.2. Makes **ADR-0038** moot and **PRD Q4** void.
- **Context:** `updateCompanion()` (`extension/sw.js:214`) switched the companion's ring from solid to dashed on a visit to a known distraction domain. The owner's objection, verified and upheld: **there is no way to report a false positive.**

  Verified 2026-09-15:
  - The companion's only event handlers are `pointerdown/move/up/cancel/enter/leave` — **drag and hover. There is no click handler.** "Accepts one tap" was aspirational, never built.
  - **No correction UI exists anywhere** in `app/`, `extension/` or `lib/`.
  - `judgment.corrected_to`, commented in the schema as **"THIS COLUMN IS THE TRAINING SET"**, sits empty in a table with **0 rows**.
  - `isKnownDistraction()` tests membership in the three built-in lists, which total **14 domains** (social 7, video 3, news 4).

  So the signal fires, cannot be dismissed, and can only fire on fourteen of the most notorious websites in existence.
- **Decision:** **Remove live drift signalling.** Drift is determined after the session — by the batched judge (ADR-0060) and shown in the review and dashboard. **Detection is not removed: attention continues to be recorded live and silently** (PRD-F3). Only the signal goes.
- **Reasoning, in the order it actually decides:**
  1. **A false positive costs three withdrawals from the attention the product exists to protect** — noticing the ring changed, judging the signal wrong, acting to dismiss it. All three occur *because the product was wrong*, and a correction affordance does not reduce that cost; it is where the cost is incurred.
  2. **The asymmetry is unfavourable.** A true positive saves perhaps thirteen minutes. A false positive breaks focus during novel or complex work — the case C11 (Zajonc) says interruption harms most, and the only kind of work this audience does.
  3. **The precision that would justify it is unknown and unmeasurable.** Q4 was never answered, PRD-F14's eval set was never built, and the training-set column is empty.
  4. **Against ADR-0052, it does not serve the goal.** Fourteen notorious domains are precisely the ones where awareness is already total. Nobody is unaware they are on Facebook.
- **Consequences:**
  - **Dead, not dormant:** `updateCompanion()`, `DRIFT_GRACE_MS`/`DRIFT_WINDOW_MS`/`DRIFT_BUDGET` (`sw.js:202-204`), and roughly five of the nine unread constants in `lib/thresholds.ts` — `SIGNAL_BUDGET`, `SIGNAL_WINDOW_MS`, `REFRACTORY_MS`, `CONFIDENCE_FLOOR`, and `DWELL_MS` in its signalling role. They stop being "not wired yet" and become deletable.
  - **ADR-0026's return-pulse dies with it** — the 0.6s ring-collapse exists solely to acknowledge a return *from drift*. No drift signal, no return. **I2 becomes absolute again**, with no named exception. The motion itself is reused by ADR-0058.
  - **ADR-0033** (judge runs after dwell) and **ADR-0040** (judge cache keyed per visit) describe a live per-tab judge and are superseded by ADR-0060.
  - **ADR-0049 survives and becomes more important** — the running popup's live band shows time-by-site and never marks drift. It is now the *only* in-session information surface, and it was already designed to inform without alarming.
  - **PRD §3.3's loop table is false** where it reads *"Witness — its ring is solid while you work, dashed when you drift."*
  - **A9 is not resolved by this, only isolated.** A9 concerns *presence*, not signalling. Removing the signal makes A9 cleanly testable for the first time. The owner accepts deciding this without running the twenty-session on/off experiment, which remains available — `sw.js:216` already reads `companionEnabled`.
- **Source:** owner decision 2026-09-14; code and database verification 2026-09-14/15
