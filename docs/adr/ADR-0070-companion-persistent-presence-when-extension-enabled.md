# ADR-0070 — The companion is persistently present whenever the extension is enabled

- **Date:** 2026-09-21
- **Status:** Accepted
- **Depends on:** ADR-0057 (drift signal removed), ADR-0058 (companion as input device), ADR-0069 (Codex Pet Tomato Companion)
- **Context:** Previously, `extension/companion-overlay.js` unmounted the floating companion widget immediately whenever `session` was null (`applyState: if (!session) { unmount(); ... }`). The companion was therefore present on screen only during an actively running focus block and vanished the moment a session ended or before one began.

  User feedback requested that the companion be present on pages as long as the extension is enabled in the browser, even if there is no session running yet. Rather than appearing as an ephemeral session timer attachment, the Tomato Companion acts as a persistent, calm ambient witness sitting with the user across their browser workspace.

- **Decision:**
  1. **Persistent Presence Across Navigation:**
     - As long as the extension is active, the companion remains mounted on all visited web pages (`<all_urls>`).
     - Ending or stopping a session does not unmount the companion; it smoothly transitions from `focus` to `idle`.
  2. **I9 Seam Preserved:**
     - The companion unmounts if and only if `companionEnabled === false`. This strictly preserves Invariant I9 ("Every feature above the mechanical loop is independently removable") and guarantees the off-switch remains fully functional.
     - Both `companion-overlay.js` and `sw.js` listen to `chrome.storage.onChanged` for `companionEnabled`: setting it to `false` unmounts the host immediately; setting it to `true` re-injects and mounts it across open tabs.
  3. **Visual and Interaction States:**
     - **In Session (`data-state="focus"`):** Orbital ring is visible (breathing focus ring at 55% opacity), hover pill reveals the session's active intention sentence, and tapping records the ADR-0058 "this isn't the work" visit label while playing the 160ms tactile receipt.
     - **Idle / Between Sessions (`data-state="idle"`):** Orbital ring is subtle/quiet, core dot maintains gentle ambient breathing, hover pill displays "Ready to focus", `dot.title` reads "MEANT — Ready", and tapping plays the receipt and dispatches `open-meant` to open the popup or navigate to the focus dashboard.
     - **Positioning & Drag:** Fractional position persistence (`companionPosition`) operates consistently across both states, allowing users to reposition the companion anytime.

- **Consequences:**
  - `extension/companion-overlay.js` checks `companionEnabled` and retains the mounted host when `!session`.
  - `extension/sw.js` handles `open-meant` and monitors `companionEnabled` storage changes.
  - `test/companion-state.test.js` asserts both the `companionEnabled` gate and persistent overlay behavior.
  - `e2e/companion.spec.ts` verifies companion visibility before session start, during active session, after session completion, and upon toggling `companionEnabled`.
