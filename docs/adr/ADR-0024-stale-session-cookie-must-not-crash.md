# ADR-0024 — A stale or revoked Neon Auth session cookie must not crash a page

- **Date:** 2026-09-01
- **Status:** Accepted
- **Context:** `auth.getSession()` can try to refresh or clear the session cookie as a side effect — Next.js only permits that from a Server Action or Route Handler. Called from a plain Server Component (every page in this app), it throws instead of reporting "no session."
- **Decision:** `lib/auth/session.ts#currentUserId()` catches this and treats it as signed-out, rather than letting the exception surface as a crashed page.
- **Consequences:** Same principle E8 already applies to a revoked device token on the extension side — one consistent "ambiguous auth state degrades to signed-out" rule across both surfaces.
- **Source:** `lib/auth/session.ts`, `docs/sdd-intent.md` flow E8
