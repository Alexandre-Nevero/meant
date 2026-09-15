# ADR-0026 — The companion reverses from "coach, not pet" to Orbit

- **Date:** 2026-09-05
- **Status:** Accepted
- **Context:** The 0.2 companion spec was explicit and reasoned: "a coach, not a pet — this audience screen-shares with clients." Gaze/posture only, never color; 80-120px; no visible acknowledgment of a return from drift. Mid-build, an external reference sheet ("MEANT Companion — Orbit") was supplied showing a 28px orbital dot, color-coded ring states, and a visible return-pulse animation — conflicting with all three specifics above. The conflict was surfaced directly, quoting the existing spec, before any code was written.
- **Options considered:**
  1. Keep the documented "coach, not pet" spec — consistent with the screen-share concern, but rejected by the owner on direct instruction.
  2. Adopt Orbit fully — the owner's choice, made explicitly, asking for the written spec to be updated to match rather than left to silently drift out of sync with shipped code.
- **Decision:** Full Orbit adoption. `extension/companion-overlay.js` rebuilt at 28px; ring presence/style (never hue) tells state; one 0.6s return-pulse plays on the drift-to-focus transition, then the ring settles. `PRODUCT.md`'s companion section and `docs/prd-intent.md` §3.2 were rewritten to match.
- **Consequences:** The "screen-shares with clients" concern that motivated the original framing was not re-litigated — the owner chose to accept it. The prior gaze/capsule design (`extension/sidepanel.js`, `.m-companion-*` three-node split) is retired; recoverable from git history before this date if ever needed. `docs/design.md` §4/§6 needed correcting to stop describing the retired architecture as current (fixed 2026-09-10, same pass as this ADR).
- **Source:** `docs/dead-ends.md` ("The companion's design reversed…"), `PRODUCT.md` §"The companion, specifically", `docs/prd-intent.md` §3.2
