# ADR-0016 — The judge reads in two tiers, T-A and T-B

- **Date:** 2026-08-28
- **Status:** Accepted (requirement) — not yet built as of 2026-09-10
- **Context:** `activeTab` can't read page content on a tab change without a broader permission, and asking for that permission at install (before the user has any reason to trust the product) is poor UX and poor privacy posture.
- **Decision:** Tier T-A judges on hostname plus page title using today's manifest permissions — no new prompt. Tier T-B adds a text extract, behind `optional_host_permissions` requested at runtime, only when the user opts into deeper judging. `<all_urls>` never appears at install for this feature (a separate matter from the block-page permission — see ADR-0027).
- **Consequences:** Spike S-1 (half a day of manual labelling, `docs/index.md` §7) asks whether T-A alone clears the precision floor — if yes, T-B and its permission prompt may never need to ship at all.
- **Source:** `docs/sdd-intent.md` §5.2, V4
