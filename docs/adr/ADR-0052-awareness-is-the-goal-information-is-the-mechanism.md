# ADR-0052 — Awareness is the goal; information is the mechanism

- **Date:** 2026-09-15
- **Status:** Accepted
- **Context:** The product's purpose had four candidate framings and the choice had never been made explicitly, so features were being justified against whichever one fit. **Information** — you cannot tell whether the block delivered. **Awareness** — you do not notice the loss while it happens. **Self-control** — you cannot stop yourself. **Accountability** — you cannot prove your time was worth it. Each implies a different product.
- **Decision:** **Awareness is the goal. Information is the mechanism that produces it.** Self-control and accountability are targeted but secondary, and lose to awareness when they conflict.

  The chain is **information → pattern → noticing**, and it has a lag in the middle. The review does not create awareness directly; it accumulates the pattern knowledge that makes in-the-moment noticing possible later.
- **Consequences:**
  - **The review's job changes from recording to teaching.** It is not a ledger. It is a training loop for noticing, and that is what makes it "the one thing" rather than a report.
  - **The thesis generates its own metric, and the metric does not exist.** If this is right, drift episodes should get shorter over time. PRD §3 already flags drift-and-return as specified-but-unbuilt; `lib/review-data.ts` computes no such field. **Building it is how this decision becomes falsifiable.**
  - **The product pays off on a delay.** A new user gets less than a returning one, and the product must survive the period before the lag closes. Any onboarding that does not account for this is designing for month three.
  - Ordering conflicts resolve toward awareness: where a self-control feature would destroy the evidence awareness needs, awareness wins unless explicitly overridden.
  - **Blocking is the named exception.** A blocked site produces a `block_hit` with null `seconds` — the reach is recorded, the duration never happens. So every blocked site is a site the product stops learning about. This is accepted: a blocked site is solved in the moment, and self-control is the goal blocking serves. The cost is that drift data systematically under-represents the habits the user cared enough to block, and any pattern the coach states carries that bias.
- **Source:** owner decision 2026-09-15; supersedes the implicit information-first framing in IDEA §2 and PRD §1
