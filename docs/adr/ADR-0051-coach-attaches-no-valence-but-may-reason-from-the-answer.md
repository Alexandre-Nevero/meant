# ADR-0051 — The coach attaches no valence to the outcome answer, but may reason from it

- **Date:** 2026-09-11 (recorded as an ADR 2026-09-14)
- **Status:** Accepted
- **Supersedes:** the 0.2 wording of I3
- **Context:** I3 read "the coach says the same things whether you answered `Yes` or `Not yet`." The intent was right — the moment `Not yet` earns a lecture, everyone answers `Yes`, and the only honest column in the schema dies. But the wording forbade the coach from *using* the single most informative column it has. A product that records an outcome and is then forbidden to read it has paid the cost of asking and collected none of the value.
- **Decision:** The protected thing is **valence**, not **use**.
  - **Forbidden:** praising `Yes`, reproaching `Not yet`, or varying warmth, encouragement, or tone with the answer.
  - **Permitted:** reasoning from the answer. "The three sessions you finished averaged 9 minutes on `chatgpt.com`; the four you didn't averaged 31" is a legitimate, valence-free observation that requires the outcome column to exist.
- **Consequences:** The outcome answer becomes usable as a feature of every later analysis, which is what makes the ledger worth more than a log. I1 is unchanged and still load-bearing — the *companion* remains identical across answers, on screen, during the session. This decision touches only what the coach may compute, in the review, after the fact.
- **Source:** PRD §3.1 I3 (amended), `PRODUCT.md` invariants table
