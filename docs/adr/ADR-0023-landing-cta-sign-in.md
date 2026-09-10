# ADR-0023 — Landing's CTA is "Sign in," not "Add to Chrome"

- **Date:** 2026-09-01
- **Status:** Accepted; later refined by the round-2 real-browser-QA pass (the hard `/` redirect this CTA originally shipped with was itself later removed — see `docs/superpowers/plans/2026-09-08-real-browser-qa-round-2.md`)
- **Context:** No Chrome Web Store listing exists, and `apexhuman.md` §7 rule 8 forbids the build path needing one — an "Add to Chrome" CTA would point nowhere real.
- **Decision:** Hero and footer become the real Neon Auth sign-in/sign-up form. The header keeps a quiet link out to the extension's own README section instead of a store badge.
- **Consequences:** The CTA promises exactly what the product can deliver today (a real account), not a store listing that doesn't exist.
- **Source:** `PRODUCT.md`, `docs/sitemap-intent.md` S1
