# ADR-0006 — Extension authenticates by one-time pairing code, not OAuth

- **Date:** 2026-08-18
- **Status:** Accepted
- **Context:** An MV3 extension doing a full OAuth redirect dance is heavier to build and to explain in a rebuild manual than a short-lived code typed once.
- **Decision:** Sign in on the web app; the extension pairs by pasting a short, expiring one-time code, which stores a device token for subsequent events.
- **Consequences:** Simpler flow for both the product and the rebuild manual (`apexhuman.md` treats "two surfaces must agree" as a classic beginner-killer step). Traded for OAuth's familiarity to the user.
- **Source:** `docs/sdd-intent.md` §4.2
