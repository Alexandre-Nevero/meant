# ADR-0058 — The companion becomes an input device: one tap, "this isn't the work"

- **Date:** 2026-09-15
- **Status:** Accepted
- **Depends on:** ADR-0057 (the drift signal is gone)
- **Context:** With drift signalling removed, the companion's output menu is exhausted. It carried two things: drift (now gone) and the intention — and the intention is already delivered, by `showHoverPill()` (`extension/companion-overlay.js:266`), which reveals the session's intention on hover. Everything else it could push at the user has already been refused: ADR-0045 declined a dial and a ticking countdown.

  Meanwhile the tables that are supposed to hold ground truth are empty: `judgment` has 0 rows, all 572 `memory` rows are `kind='list'`, and `domain_class` has never been written.
- **Decision:** **Stop making the companion tell the user things. Make it how the user tells it things.**

  **One tap. One meaning: "this isn't the work."**

  Why one and not two: with no live flag, *"this is the work"* has nothing to correct — nothing claimed otherwise, and the user already declared their work sites at session start (ADR-0035). It is redundant. Only the negative label carries information, and it is precisely the self-reported drift marker that replaces what ADR-0057 removed.

  The gesture reuses the existing hover pill: hover reveals the intention (already built), tap records the label.
- **Why this direction:**
  - **A self-report cannot be a false positive.** The user is definitionally right about their own intent, so ADR-0057's failure mode becomes structurally impossible rather than mitigated.
  - **User-initiated, so it costs zero interruption and zero arousal** — the C11 objection does not apply to an action the user chooses to take.
  - **It generates labelled ground truth with no model in the loop**, which is worth more right now than anything the judge could say, given every table that should hold that data is empty.
  - **ADR-0039** already admits user taps into memory; **ADR-0037** already says an explicit tap resolves at n=1. This uses mechanisms that were decided and never built.
  - It is an **act of awareness performed by the person**, which is exactly ADR-0052's goal rather than a proxy for it.
- **Consequences:**
  - **The tap needs a receipt, not a celebration.** Without feedback the user cannot tell it registered. I2 bans *positive feedback*, not feedback. **ADR-0026's return-pulse motion is freed by ADR-0057 and is reused here** — the same 0.6s ring-collapse, new meaning.
  - What the tap writes is governed by **ADR-0062**: a per-visit label, not a permanent classification.
  - The tap labels the **domain**, not the path — paths are local-only (ADR-0059) and cannot reach server-side memory.
  - **Q12's urgency is removed.** Memory gains a write path that does not depend on the judge being wrong first, and the correction UI stops being a prerequisite of the judge.
  - **Open, and cheap to learn:** whether anyone taps at all. If nobody does, the surface is decoration and we find out for the price of one click handler.
- **Source:** owner decision 2026-09-15 (option B of three); code verification 2026-09-15
