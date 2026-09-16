# ADR-0050 — The evidence threshold gates inference, never description

- **Date:** 2026-09-11 (recorded as an ADR 2026-09-14 — it was applied to the PRD and `PRODUCT.md` three days before this file existed)
- **Status:** Accepted
- **Supersedes:** the 0.2 wording of I6
- **Context:** I6 read "the coach states no pattern below the evidence threshold," and `PATTERN_MIN_SESSIONS` set that threshold at 8. Read literally, it meant a paying user saw nothing at all for eight sessions — the same product as no product, for the eight sessions where churn is highest. The owner's objection was direct: "if i am the user why do i have to wait before i pay for this shit or use this shit?" That objection is correct about half of I6 and wrong about the other half, and the split is what this decision records.
- **Decision:** The threshold gates **inference**, never **description**.
  - **Description has no floor.** Showing someone their own rows — "you spent 41 minutes on `chatgpt.com`, 12 on the document, 9 on a news site" — is not a claim about them. It is their data, rendered. It ships from session one.
  - **Inference keeps its floor.** Asserting a regularity — "you drift at minute 12 of writing sessions" — is a claim about the person, and being wrong about *you* costs far more than being wrong about a tab. A pattern from three sessions is astrology.
- **Consequences:** The free/paid boundary stops depending on a silence period. `PATTERN_MIN_SESSIONS` still governs, but governs a much smaller surface than the 0.2 wording implied. The coach has something true to say on day one, which is the retention problem I6 had accidentally created. Q5 (how many sessions before a pattern) still needs a number, but it now blocks far less.
- **Source:** PRD §3.1 I6 (amended), `PRODUCT.md` invariants table, `lib/thresholds.ts` (`PATTERN_MIN_SESSIONS`, currently zero readers)
