# ADR-0017 — V5 amended: "never send" becomes "never store"

- **Date:** 2026-08-28
- **Status:** Accepted
- **Context:** The original privacy rule ("never send page content off-device") cannot survive cloud-based judging (ADR-0012, ADR-0014) — the judge has to send *something* to a model. Deleting the rule outright would remove the product's only structural defence against becoming surveillance.
- **Decision:** The rule narrows instead of disappearing: page text may be sent in flight for one classification, but is never stored, logged, or retained anywhere. Only `{domain, verdict, confidence}` persists.
- **Consequences:** Narrower in what it permits (a network send now happens) and stronger in what it guarantees (nothing textual survives the call) — I7 in `docs/prd-intent.md` §3.1.
- **Source:** `docs/sdd-intent.md` §5.1
