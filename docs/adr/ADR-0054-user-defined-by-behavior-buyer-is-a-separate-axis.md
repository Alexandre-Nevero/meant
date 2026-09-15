# ADR-0054 — The user is defined by behavior; the buyer is a separate axis; segments stay unranked

- **Date:** 2026-09-15
- **Status:** Accepted
- **Amends:** D10 / ADR-0010. Returns toward D1 ("user defined by behavior, not job title") without discarding what D10 fixed.
- **Context:** D10 narrowed the primary user to the self-employed browser-native worker for one stated reason: the previous persona "had no purchasing authority, and the only party with budget was the employer — whom IDEA §9 forbids serving, permanently. The product had designed itself into having no legal buyer." That narrowing was by *job title* and by *buyer* at once, and the two were never separated.

  A persona scorecard was then built (2026-09-15) across seven candidate groups and five tests — work is in the browser · the loss is felt · owns the card · $12/mo is trivial · findable cheaply. **Two of the five columns were blank for every single row**: relative pain acuity, and reachability. Those two are the ones that decide the ranking. An earlier attempt to record this decision (a reverted ADR-0052, 2026-09-14) filled both columns with reasoning and was withdrawn for exactly that reason.
- **Decision:** Three parts.

  **1. Who is served — behavioral, no job titles.** Anyone for whom **the work surface and the distraction surface are the same browser.** Researchers, students, marketers, freelancers, operators, and the browser-resident portion of anyone else's day.

  **2. The boundary is browser share, reported at runtime — not a title filter.** IDEA §9's warning was never about titles; it is that the product "would see a fraction of their day and be confidently wrong about the rest." So it stops guessing: **where recorded browser attention is a small fraction of a session's wall clock, the review states what it did not see.** The user self-qualifies inside one session, on evidence.

  **3. Who buys — unchanged, and explicitly a different axis.** The paying core remains D10's self-employed worker, who feels the loss as unbilled money. Everyone else is served on the free tier.

  **4. Segments are deliberately NOT ranked.** Which group to aim marketing at stays open until the two blank columns are filled. Pain acuity is closable only by talking to people; reachability by desk research. **Not choosing is the correct state, not a deferral.**
- **Consequences:**
  - **Load-bearing on the freemium shape and unsafe without it.** Serving a population that cannot pay is only safe because free tracking and blocking have near-zero marginal cost and the paywall sits on the inference cost. Any change to **Q6** that narrows the free tier or moves the paywall off inference re-creates D10's no-buyer problem and must re-open this ADR.
  - **Go-to-market narrows even though the product does not.** Wide product, narrow channel, sequenced — segment the channel, never the product.
  - **New build obligation from part 2:** the review needs an unrecorded-time concept — wall clock minus recorded attention minus `away`. `lib/review-data.ts` computes nothing like it.
  - IDEA §9's "Not for" line moves from title-based to share-based exclusion. Employers remain excluded permanently, at any tier.
- **Source:** owner decision 2026-09-14; persona scorecard 2026-09-15; D1, D10, IDEA §9, PRD §2, §7.1
