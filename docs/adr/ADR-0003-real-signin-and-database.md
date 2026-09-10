# ADR-0003 — Real sign-in and a database, not local-only storage

- **Date:** 2026-08-18
- **Status:** Accepted
- **Context:** A local-only extension can't back a ledger the user trusts across devices or reinstalls, and can't support the web app's dashboard/review surfaces at all.
- **Decision:** Sessions, tasks, judgments, and memory live in a real Postgres database behind real sign-in, not `chrome.storage` alone.
- **Consequences:** Requires an auth vendor and a hosted database from day one (see ADR-0007, ADR-0021) — real infrastructure cost even at zero users, accepted because the alternative (local-only) can't ship the review/ledger loop at all.
- **Source:** `docs/sdd-intent.md` §2
