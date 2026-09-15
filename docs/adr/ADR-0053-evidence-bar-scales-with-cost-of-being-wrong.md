# ADR-0053 — The evidence bar scales with the cost of being wrong

- **Date:** 2026-09-15
- **Status:** Accepted
- **Context:** A prior session recorded a pattern in the owner's own sessions — intentions beginning with a concrete verb ended `Yes`, intentions beginning "think about…" ended `Not yet` — and described it as a clean split at n=5. Re-queried against the live database on 2026-09-14, the real rows are `write`→yes ×2, `think`/`thinking`→no ×3, `take`→unanswered ×1. **The positive arm is n=2.** The pattern's direction survives; its weight does not. It had already been used to justify a proposed feature (PRD Q11, a model call at declaration time).

  The question this raised — *why does an evidence bar matter at all?* — has a better answer than "rigour."
- **Decision:** **There is no single bar. The bar scales with the cost of being wrong.**

  | Cost if wrong | Bar |
  |---|---|
  | Cheap and reversible — changing one's own habit, trying a wording | **n=1 or n=2 is sufficient. Act now** |
  | Persistent, affects future sessions, or costs build time | **Requires evidence proportionate to the commitment** |

  Worked: *"I will start writing intentions with a concrete verb"* is free and reversible — n=2 is plenty. *"We will build a model call that rewrites the user's sentence before the timer starts"* costs build time, a service dependency, and is annoying at the highest-friction moment in the product — that needs real evidence. **Same finding, two bars, because the downside differs by roughly a hundred times.**
- **Consequences:**
  - The earlier flat claim "n=2 is not a hypothesis" is **withdrawn**. It is a perfectly good basis for changing behavior and a bad basis for building a feature, simultaneously.
  - **PRD Q11 stays open and unevidenced.** Its justification was the n=5 reading.
  - This rule settles other questions without new information — see ADR-0062, where it decides that a user's tap writes a per-visit label rather than a permanent one.
  - **Second reason, specific to AI-assisted work:** when artifacts cost nothing to produce, confidence inflates silently across sessions. A guess written in session one is quoted as fact in session three because the summary carried the claim and dropped its provenance. This rule is the circuit breaker, and the n=5→n=2 correction is the worked example of the failure.
- **Source:** owner question and decision 2026-09-14/15; live database re-query 2026-09-14
