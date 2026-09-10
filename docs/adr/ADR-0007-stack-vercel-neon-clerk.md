# ADR-0007 — Stack: Vercel + Neon Postgres + Clerk

- **Date:** 2026-08-18
- **Status:** Superseded by ADR-0021 (Clerk replaced by Neon Auth, 2026-09-01)
- **Context:** Needed hosting, a database, and auth from day one (ADR-0003); picked well-known managed services to avoid infrastructure work competing with product work.
- **Decision:** Vercel for hosting, Neon for Postgres, Clerk for auth — three vendors, three integration budget slots.
- **Consequences:** Worked until D21 folded auth into Neon directly, dropping a fourth vendor to a third and freeing an integration-budget slot (`apexhuman.md` §5 — every vendor costs a rebuilding student 10-15 minutes).
- **Source:** `docs/sdd-intent.md` §4.3
