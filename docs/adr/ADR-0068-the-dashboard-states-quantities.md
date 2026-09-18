# ADR-0068 — The dashboard states quantities

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** The dashboard previously read as a simple list of floating session items with a word headline ("five this month. three finished."). While this protected intrinsic motivation by refusing to turn attention into a score (IDEA §5, C9 and C11), it denied users clear visibility into where their working hours went, which domains commanded focus, and what their active daily progress looked like.

  Following comparative analysis of Rize's 2022 layout grammar and user feedback on initial exploration mockups (M1–M5), the owner approved a refined dashboard architecture that combines:
  1. A **Daily Timeline** as hero showing today's chronological attention blocks, away periods, and breaks.
  2. A **Top Sites** ranked list with share bars.
  3. A **Concentric Donut Chart** unifying Attention, Away, and Break ratios into an instrument-grade radial visual with center focus duration.
  4. A **Performance & Fidelity** card balancing total focus recorded, average session duration, completed intention counts, and outcome fidelity percentage.
  5. The **Single Inference Sentence** (ADR-0066) preserved as a focused pattern callout.
  6. The **Session Record Ledger** grouped by day.
  7. Tactile micro-interactions (`:active { transform: scale(0.97); }` with custom cubic-bezier easing) rooted in Emil Kowalski design engineering principles.

- **Decision:** **The dashboard states quantities.** Attended time, session counts, per-site shares, and period-over-period change all render, with the word headline and single inference sentence integrated cleanly.

  Nothing renders a composite "productivity score", and no figure carries a color that morally grades it (I3 remains absolute). The rule is:
  > Quantities render on the dashboard: attended time, counts, shares, and change against the previous period. Nothing renders a composite productivity score, and no figure carries a colour that grades it.

- **Consequences:**
  - **Invariants updated:** The blanket ban on total hours and percentage shares is refined to permit objective duration and share reporting on the authenticated dashboard. The product still never rewards hours, never shows a productivity score, and never celebrates one outcome answer over another during a session (I1, I2, I3, I6, I8 remain binding).
  - **Single Inference Sentence intact (ADR-0066):** Only one inference claim about the user renders at a time, gated by the evidence floor (`PATTERN_MIN_SESSIONS`).
  - **No database migrations required:** Every metric is computable directly from existing tables (`session`, `event`, and `event.label` after `005-local-hour.sql`).
- **Source:** Owner critique and approval of revised mockup `m-unified-cream` on 2026-09-18.
