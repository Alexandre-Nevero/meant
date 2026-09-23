# ADR-0082 — The popup opens itself to ask, once, when a timed session elapses

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Owner request 2026-09-23: "popup shows up after the session is done and asks."
  Since the review tab stopped auto-opening (docs/superpowers/plans/2026-09-07-real-browser-qa-fixes.md),
  "Did you?" has appeared only when the user happens to open the popup. A session that elapses
  tells the user nothing, and an unanswered outcome is a hole in the column every figure is
  computed from. `chrome.action.openPopup()` has shipped to all extensions since Chrome 127 and
  needs no user gesture, but it only opens into the active, focused browser window. It rejects
  otherwise ("Could not find an active browser window"; Chrome 143 behaviour table,
  w3c/webextensions#160).
- **Decision:** When a session ends by `elapsed`, the service worker sets `askPending` and calls
  `openPopup()`. If that rejects — the user is in another app — a `windows.onFocusChanged`
  listener tries again the next time a Chrome window gains focus, and `askPending` clears on the
  first success. `stopped` never auto-opens: the user pressed Stop inside the popup, which is
  already showing the question. Both `stopped` and `elapsed` set the toolbar badge to `?` until
  the popup's Done clears it. The badge sets no colour: the service worker cannot read
  `design/tokens.css`, and a literal colour would be a hex in code.
- **Consequences:** The popup can appear without a click, once per elapsed session, and never
  during one: I2 holds, since nothing happens on screen while a session runs. The owner rejected
  an OS notification (a new permission, and noise in the notification centre). If Chrome never
  regains focus before the next session starts, the question waits in the popup exactly as it
  did before this ADR.
- **Source:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §2; owner brainstorm 2026-09-23.
