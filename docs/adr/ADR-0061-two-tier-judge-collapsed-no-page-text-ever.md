# ADR-0061 — The two-tier judge is collapsed; no page text is ever read

- **Date:** 2026-09-15
- **Status:** Accepted
- **Supersedes:** SDD §5.2 in full. Voids SDD Q8, PRD Q7, PRD Q9, and SDD test cases T16/T17. Depends on ADR-0059 and ADR-0060.
- **Context:** SDD §5.2 specified two input tiers. **T-A** judged on hostname plus page title with no new permission. **T-B** added a capped extract of visible text behind `optional_host_permissions`, requested at the moment the user enabled deep judging. PRD Q9 asked whether T-A cleared the precision floor alone, and `docs/index.md` §7 named that question the *"cheapest, highest-leverage question in the project."*

  Three things have since made the whole structure obsolete:
  1. **ADR-0060 moved the judge after the session.** Page text and title cannot be read post-hoc — the page is gone. T-B is not merely optional, it is **impossible**.
  2. **ADR-0059 stores full paths locally.** The disambiguation T-B existed to provide is now supplied by the path, at no privacy cost beyond what the browser already holds.
  3. **IDEA C19** established that `activeTab` cannot read page content on a tab change, so automatic reading always required broad host permissions — and `<all_urls>` shipped unconditionally on 2026-09-07 anyway (ADR-0027), for `declarativeNetRequest`'s redirect.
- **Decision:** **There is one input set, and page text is not in it.** The judge reads, from local storage after the session ends: **hostname, path, dwell time, sequence, time of day, the declared work and distraction sites, and the outcome answer.** It never reads page text and never reads page titles.
- **Consequences:**
  - **The scariest screen disappears from the product.** There is no optional-permission prompt, ever. For a non-technical buyer that removes the most alarming moment in the funnel; for `apexhuman.md` it removes a decision point, a failure mode, and a step from the manual — rule 2, *"zero decisions on the rebuild path."*
  - **PRD Q9 and SDD Q8 are void, not answered.** The question "how much worse is T-A than T-B" has no referent.
  - **`/api/judge`'s contract changes** — `extract` is removed; the request becomes a batch of visits rather than one tab. SDD §5.3's privacy table rows for page title and page extract are void.
  - **T16 and T17 are void** (declining page access; revoking mid-life). Neither state can occur.
  - **I7 remains, and is now trivially satisfied** on the text question — nothing to read means nothing to leak. ADR-0059's path amendment is the only live part of I7.
  - **The judge's justification narrows, and PRD §1.2 is partly stale.** §1.2 concludes *"No blocklist resolves this. Reading the tab against the stated intention does."* But ADR-0035's per-session declaration of work and distraction sites resolves the Instagram case at session start, with no model. **The judge's real job is smaller and should be stated as such:** the residual (sites the user never declared) and in-site ambiguity (which part of a large site). §1.2's *case* stands; its *conclusion* does not.
- **Source:** owner decisions 2026-09-14/15; IDEA C19, C20; ADR-0027, ADR-0035
