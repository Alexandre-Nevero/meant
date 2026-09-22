# ADR-0077 — An analysis is a frozen artifact, not a re-runnable query

- **Date:** 2026-09-21
- **Status:** Accepted
- **Context:** The model is not deterministic. Running the same batch twice can label the same visit `focused` then `drift`. `judgment` has no unique key, so a second run inserts a second set of rows beside the first and nothing says which is true. Premium is currently suspended (ADR-0075), so there is no quota to burn today — but idempotency is still the right decision, since a re-run silently rewriting the user's own record is wrong regardless of whether it costs anything, and the day quota returns this same design pays for it a second time for free.
- **Decision:** **An analysis is a stored artifact identified by the set of sessions it covers, not a query that re-runs.** Opening an already-analysed set returns the stored analysis, costs nothing and consumes no quota (when quota exists again). Re-analysis exists only as an explicit user act, creates a new analysis row, and consumes quota like any other (once ADR-0075's suspension ends).
- **Consequences:** An `analysis` table and a `judgment.analysis_id` foreign key land in Plan 3, where something writes to them. The user's record stops being able to rewrite itself, which is the property that makes it a record. The reopen path is the cheapest thing in the product and should be the common one.
- **Source:** owner decision 2026-09-21.
