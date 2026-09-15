# ADR-0063 — `docs/adr/` is the canonical current record; every change is written as an ADR

- **Date:** 2026-09-15
- **Status:** Accepted
- **Context:** This project has repeatedly lost decisions between the moment they were made and the moment they were recorded. Amendment 0.2c documents the worst case: `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` made 17 real product decisions (D26–D42) and shipped code for them, but its own Task 20 — writing those decisions into the canonical record — was never executed, and the decisions sat undiscoverable inside a 153KB plan file for a week.

  The same failure recurred on 2026-09-14 in the opposite direction: six ADRs were written *before* the decisions they recorded had any evidence, and had to be reverted.

  Both failures share a cause: **no rule said where current truth lives.** Long-form documents (PRD, IDEA, SDD) are periodically reconciled, so between reconciliations they are stale by construction — and nothing told a reader that.
- **Decision:** Three rules.
  1. **`docs/adr/` is the most up-to-date record in the repository.** Where an ADR and any other document disagree, **the ADR is right and the other document is stale.** Say so, then reconcile — never silently pick one.
  2. **Every change of decision is written as an ADR**, one file per decision, append-only, never edited after acceptance. A decision that is not in `docs/adr/` has not been made.
  3. **An ADR records a decision that has been taken — never one that is proposed.** Where the evidence is not yet in, it belongs in the relevant document's open-questions table, not here. A decision made against unknown evidence must say so in its own Consequences.
- **Consequences:**
  - `AGENTS.md` and `CLAUDE.md` carry this rule so every agent session reads it before touching a document.
  - `docs/index.md` §6's table remains a historical at-a-glance index; `docs/adr/` is the point of entry, as it has been since 2026-09-10.
  - The long documents become periodic reconciliations of the ADR log rather than independent sources. Their amendment headers should name the ADR range they absorbed.
  - This does not license writing an ADR to *make* a decision. Rule 3 exists because that is exactly the failure of 2026-09-14.
- **Source:** owner instruction 2026-09-15; amendment 0.2c; the reverted ADRs of 2026-09-14
