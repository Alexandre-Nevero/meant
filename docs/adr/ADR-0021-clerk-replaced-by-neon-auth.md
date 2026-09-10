# ADR-0021 — Clerk replaced by Neon Auth, amending ADR-0007

- **Date:** 2026-09-01
- **Status:** Accepted
- **Context:** Auth as a fourth, separate vendor cost an extra signup on every rebuilding student's provisioning list (`apexhuman.md` §5), for no capability Clerk had that Neon's own managed auth (Better Auth) lacked.
- **Decision:** Auth moves onto the same account and database branch as Postgres via `@neondatabase/auth` (beta, `0.5.x-beta`). No middleware/`proxy.ts` is used — its route-gating `auth.middleware()` would redirect `/` (the public sign-in page) to itself — every protected surface calls `auth.getSession()` directly instead.
- **Consequences:** One fewer vendor, one fewer integration-budget slot spent (freed slot noted in `docs/prd-intent.md` §7). Runs on a beta package — worth re-checking before it graduates.
- **Source:** `PRODUCT.md`, `docs/sdd-intent.md` §4.3/§5/§9.3, `docs/sitemap-intent.md` §5, `docs/prd-intent.md` §7
