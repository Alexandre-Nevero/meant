# ADR-0064 — The coach's preset corpus: relevance, source tier, and a review date

- **Date:** 2026-09-15
- **Status:** Accepted
- **Context:** The coach is to ship with preset knowledge so it is useful from session zero, before any user data exists (owner decision, carried from 2026-09-11). The corpus it would draw on today is IDEA §5, C9–C14:

  | Claim | Source | Year |
  |---|---|---|
  | C9 | Deci, Koestner & Ryan — extrinsic reward undermines motivation | 1999 |
  | C10 | Gollwitzer & Sheeran — implementation intentions | 2006 |
  | C11 | Zajonc — social facilitation | 1965 |
  | C12 | virtual social facilitation mini-review | 2024 |
  | C13 | sub-goals and initiation | 2017 |
  | C14 | Amabile & Kramer — the progress principle | 2011 |

  **Two problems.** It is old — median roughly 2008. And more seriously, **it is about the wrong subject**: motivation, reward, presence and goal-setting. **None of it is about attention in a browser**, which is the only thing this product observes. A coach advising from this corpus would be advising confidently about a topic it has no evidence on.
- **Decision:** Three rules govern the corpus, and recency is the weakest of them.

  **1. Relevance outranks recency.** A claim earns a place only if it bears on something the product can *observe* (attention, switching, interruption, drift, session shape) or something it can *execute* (I5 — blocking, cycles, showing the user their own rows). Generic productivity advice is excluded by I5 regardless of publication date.

  **2. Source tier is a gate, not a preference.** Admissible: peer-reviewed publication, a primary-source PDF read directly, or a named dataset with stated method and sample. **Inadmissible: SEO content farms, "statistics 2026" round-up pages, vendor marketing, and any figure without a traceable primary source.** This is not theoretical. A search for recent focus research on 2026-09-15 returned, among the top results, `makerstations.io`, `speakwiseapp.com`, `amraandelma.com` and `wifitalents.com`, carrying a claim of a *"2026 Carnegie Mellon study of 3,800 knowledge workers"* establishing *"26.8 minutes"* recovery time and *"$1.2 trillion annually."* That has the signature of content-farm inflation applied to Gloria Mark's genuine ~23–25 minute finding. **It is not to be cited.**

  **3. Every claim carries a review date and is re-checked.** Claims about digital behaviour rot faster than claims about motivation. The corpus is a dated table, on the same contract as IDEA §5: *claim · source · label (verified/reported/inferred) · date checked · what dies if it is wrong.*

- **The gap to fill, and the first verified entry.** The missing subject is attention and interruption. Verified from the primary PDF on 2026-09-15:

  > **Dabbish, Mark & González, CHI 2011 — "Why Do I Keep Interrupting Myself?: Environment, Habit and Self-Interruption."** 889 hours of observed task-switching from 36 individuals across three high-technology information-work organizations. Self-interruption accounts for a significant portion of task switching and is far less studied than external interruption. It is a function of organizational environment and individual differences **and of external interruptions already experienced**. Open-plan environments raise it. **People are significantly more likely to self-interrupt in order to return to a central working sphere (Mean 23%) than to a peripheral or other one (17% and 19%)**, and to return to solitary work (23%) over a communication event (16%).

  **The last finding matters more than the rest, and it cuts against the product's instinct: not all self-interruption is drift.** A meaningful share of it is people returning to their real work. That independently supports `neutral` as a first-class label (ADR-0047) and warns against reading every switch as failure.

  **Reported but not yet verified** — do not quote until a primary source is read: Mark's ~47 seconds average dwell on a screen before switching, and the ~23–25 minute return-to-task figure (`ics.uci.edu/~gmark/chi08-mark.pdf`, not yet read).

- **Consequences:**
  - **I5 still binds the corpus.** Most of what this literature recommends — implementation intentions, environment change, sub-goals — the product cannot execute, so the coach may not suggest it. The corpus informs what the coach *understands*, not what it *offers*.
  - **The corpus is table stakes, not the differentiator.** Generic focus advice is free from any general assistant. The differentiator is the corpus instantiated on the user's own rows.
  - IDEA §5 gains the attention/interruption claims as C21 onward, on the existing contract.
  - The corpus needs a home the coach can actually read at runtime — a file, not prose scattered across IDEA. Its shape is a build question, not a decision here.
- **Source:** owner instruction 2026-09-15; primary PDF read 2026-09-15; IDEA §5
