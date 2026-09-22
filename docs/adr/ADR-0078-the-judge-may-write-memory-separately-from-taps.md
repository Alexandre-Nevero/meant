# ADR-0078 — The judge may write memory, separately from taps

- **Date:** 2026-09-21
- **Status:** Accepted
- **Amends:** ADR-0039/D32 (*"only user taps write memory"*).
- **Context:** ADR-0039 made taps the sole writer of memory. Memory gates the judge (I4) and is the accuracy story and the margin story in one feature — so under ADR-0039 it learns only as fast as the user labels, and the user has to tap, and tap, and tap. That is a decision, not a gap.
- **Decision:** **The judge may write memory, into a tally kept separate from the user's taps, and the user's word is never overridden.** `memory.value` for `domain_class` becomes `{ taps: Counts, verdicts: Counts, last_at }` where `Counts` is `{focused_n, supportive_n, neutral_n, drift_n}`. Resolution order:

  1. If **taps** clear `MEMORY_MIN_EVIDENCE` (3) and `MEMORY_MIN_AGREEMENT` (0.8), that is the classification.
  2. Otherwise, if **verdicts** clear `MEMORY_MIN_VERDICTS` and `MEMORY_MIN_AGREEMENT`, **and no tap records a different label**, that is the classification.
  3. Otherwise none, and the domain loses any classification it had.

  Rule 2's veto is what makes this safe: a single contrary tap, even at n=1, blocks the judge from classifying against the user — while still not letting one tap *assert* anything alone, which is ADR-0062 unchanged.
- **Consequences:** Memory grows without the user doing anything, which is the point. Counts are per source rather than summed, so *"the user told us"* stays answerable forever; a weighted single integer would have destroyed that to save one field. `MEMORY_MIN_VERDICTS` starts at 8 and is explicitly a **starting value re-tuned against the eval** — the honest basis is that a model opinion is worth less than a deliberate human act, not that eight was measured. The tap survives as a *correction* channel rather than a *collection* channel, which is what makes tapping rare.
- **Source:** owner decision 2026-09-21; ADR-0053 (the evidence bar scales with the cost of being wrong).
