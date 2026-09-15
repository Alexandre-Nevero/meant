# ADR-0042 — No "again" button on the review; the popup pre-fills instead

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** A one-tap "start this session again" button on the review page would need the review (a web page) to start an extension session directly — that requires `externally_connectable`, a new trust boundary, for a pure convenience.
- **Decision:** No such button. The popup already pre-fills the last sentence (part of ADR-0035's chip-memory), which covers the same convenience without the new trust boundary.
- **Consequences:** One fewer surface (`externally_connectable`) to secure and reason about, for a feature the popup already substantially covers.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D35")
