# ADR-0027 — `<all_urls>` ships upfront in `host_permissions`, superseding ADR-0009

- **Date:** 2026-09-07
- **Status:** Accepted
- **Context:** ADR-0009's per-domain `optional_host_permissions` approach meant a fresh permission prompt every time the user named a new site to block — worse UX than one upfront grant, for a feature (arbitrary site blocking) that fundamentally needs broad host access anyway. Separately, the companion's content script (ADR-0026) already runs at `<all_urls>` — the block-page permission model was narrower than the trust the product already required elsewhere.
- **Options considered:**
  1. Keep per-domain `optional_host_permissions` (ADR-0009) — minimal at install, but a recurring prompt on every new blocked domain.
  2. Grant `<all_urls>` in `host_permissions` unconditionally, once, at install.
- **Decision:** `<all_urls>` appears in `host_permissions`, unconditionally. Reasoning recorded directly in `PRODUCT.md`: this is not a new category of trust beyond what the content script already required, and `declarativeNetRequest`'s `redirect` action needs host permission for whatever domain it's redirecting.
- **Consequences:** `docs/prd-intent.md` §7 and `docs/sdd-intent.md` V4/§5.2 both stated the old, narrower rule as fact until corrected in this same documentation pass (2026-09-10) — those sections previously contradicted shipped code. The judge's T-A/T-B permission tiers (ADR-0016) are a separate, still-future permission question — this ADR only concerns the block-page/companion host permission, not page-text reading for judging.
- **Source:** `PRODUCT.md` "Constraints that shape design", `docs/dead-ends.md`
