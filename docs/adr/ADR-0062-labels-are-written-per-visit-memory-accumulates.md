# ADR-0062 — Labels are written per visit; memory accumulates by threshold, not at n=1

- **Date:** 2026-09-15
- **Status:** Accepted
- **Narrows:** ADR-0037. Depends on ADR-0058 and ADR-0053.
- **Context:** ADR-0058 gives the user a one-tap label. The question is what it writes. `event.label` records the meaning of a single visit; `memory.domain_class` records a belief about a domain that persists across sessions and gates the judge (I4).

  ADR-0037 states that *"an explicit user tap resolves and memorizes at n=1 — no threshold applies to a direct correction."* Applied to a volunteered label, that collides head-on with PRD §1.2: tap "this isn't the work" on Instagram at 11am and memory believes Instagram is drift, including at 4pm when it is the job. The product would be confidently wrong about the exact case it exists for.
- **Decision:** **The tap writes `event.label` — the visit, not the site.** Memory forms only when the same label recurs, through the thresholds that already exist: `MEMORY_MIN_EVIDENCE` (3 observations) and `MEMORY_MIN_AGREEMENT` (80%), per ADR-0037's conflicting-evidence rule.

  **ADR-0037 is narrowed, not contradicted.** Its n=1 rule was written for a *correction of a wrong flag* — a context where the user is disambiguating a specific error the product made. A volunteered label is a different act, made without a claim to correct, and often means "this session" rather than "always." The n=1 rule applies to corrections; the threshold applies to volunteered labels.
- **Reasoning:** This is ADR-0053 applied directly. Writing `event.label` is cheap and reversible — if wrong, one visit is mislabelled and nothing downstream persists. Writing `memory.domain_class` is persistent, affects every future session, gates the judge, and §1.2 says it can be confidently wrong. **Different costs, different bars.**
- **Consequences:**
  - **The undefined phrase "intention class" stops blocking.** I4 keys memory to "this user's intention class" and nothing in the repo defines it. While labels are written per-visit and memory forms only by repetition, no intention class is needed. It returns when memory starts forming, and must be defined before then.
  - `event.label` already exists with values `work|distract|neutral|unknown` (D37, ADR-0044), and `neutral` is first-class (ADR-0047) — so the schema supports this today with no migration.
  - **A rejected or contrary label is evidence too** and is stored, not discarded. Negative labels are the cheapest accuracy data this product will get.
  - The judge (ADR-0060) reads these labels as ground truth for the sessions it analyses.
- **Source:** owner decision 2026-09-15; ADR-0037, ADR-0044, ADR-0047, PRD §1.2, I4
