# ADR-0060 — The judge runs after the session, batched, on demand

- **Date:** 2026-09-15
- **Status:** Accepted
- **Supersedes:** ADR-0033 (judge runs after dwell), ADR-0040 (judge cache keyed per visit), and PRD §6.2's per-tab framing. Depends on ADR-0057 and ADR-0059.
- **Context:** PRD §6 specified a judge firing on tab change, ~5–30 model calls per session, with a 3-second soft latency budget. That architecture existed to feed a live companion signal, which ADR-0057 removed. Verified pricing (2026-09-11): one batched analysis across ~10 sessions costs $0.0067–$0.0335 depending on model tier, against 7.5% of a $12 subscription for per-session judging on one of the cheapest models available.
- **Decision:** **The judge runs after a session ends, in batches, when the user asks for an analysis.** Not per tab, not per session automatically.
- **Consequences:**
  - **Roughly 20× cheaper, and the saving buys quality rather than margin.** On-demand frequency makes a frontier model affordable for the one thing that is the product.
  - **Latency constraints vanish.** Nothing is waiting on a model, ever — which was already PRD §7's rule and is now structurally guaranteed rather than carefully maintained.
  - **It trades content depth for context breadth.** A per-tab judge sees one page deeply. A batched judge sees sequence, proportion, time-of-day and the outcome answer across many sessions — and ADR-0051 permits reasoning from the outcome column.
  - **Some of what was wanted from "AI" turns out not to need it.** *"Your finished sessions averaged 9 minutes on `chatgpt.com`; your unfinished ones averaged 31"* is arithmetic over the outcome column — no model, no page text, no cost. Build the arithmetic before the judge.
  - **Sessions are always viewable, free and unjudged.** The analysis is the paid act, not the record.
  - **The judge's justification narrows** — see the note in ADR-0061. The Instagram case is resolved at session start by declaration, not by the judge.
- **Source:** owner decision 2026-09-14; pricing verified 2026-09-11
