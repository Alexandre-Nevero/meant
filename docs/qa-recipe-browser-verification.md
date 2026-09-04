# Recipe: Haiku + gstack browse for MEANT verification

Covers the unverified items from the 0.2 build (Tasks 2/3/5/6) and the Task 7 spike.
Written after checking the real tool, not assumed: `~/.claude/skills/gstack/browse/dist/browse`
is a **Playwright-driven, DOM-level** automation CLI. It has no `--load-extension` flag and no
way to drive a native OS dialog (file picker, Chrome's own permission prompt, a locked screen).
`dialog-accept`/`dialog-dismiss` only handle JS-level `alert`/`confirm`/`prompt` — not Chrome's
own UI. That fact splits this checklist in two, and no recipe should paper over the split.

## Part A — one-time human setup (cannot be automated)

A Haiku agent cannot click through a native "Load unpacked" file-picker dialog — that's an OS
window, not a page. Do this once, by hand:

1. `~/.claude/skills/gstack/browse/dist/browse connect` — launches a real, visible Chromium
   (not your regular Chrome).
2. In that window: `chrome://extensions` → enable Developer mode → **Load unpacked** → select
   `extension/` in this repo.
3. Copy the extension's ID from that page (a 32-character string next to its name).
4. Hand that ID to the agent as `$EXT_ID` in the dispatch below.

Everything after this is either fully automatable (Part B) or still needs you (Part C) — the
recipe doesn't blur the two.

## Part B — what a Haiku + browse agent can actually verify end-to-end

These don't need a real toolbar click or OS-level state — a plain-page `goto` reaches them
directly, which is a standard, legitimate way to test an extension's own pages.

**Dispatch this as a fresh Agent, `model: "haiku"`:**

```
You are QA-verifying the MEANT Chrome extension using the gstack browse CLI
(~/.claude/skills/gstack/browse/dist/browse, call it $B). A real Chromium with
the extension already loaded is running — connect to it, don't relaunch it.
Extension ID: $EXT_ID. Web app base URL: check .env.local or ask if unclear
(likely http://localhost:3000 with `npm run dev` already running, or the
deployed URL — confirm before starting).

Do NOT attempt any action that requires a native OS dialog, a physical screen
lock, or clicking the extension's toolbar icon — those are out of scope for
you; report them as "needs a human" rather than guessing or faking a result.

Run each check, take a screenshot with `$B screenshot <path>` as evidence, and
report PASS/FAIL/COULD-NOT-VERIFY for each with the screenshot path and any
console/network errors ($B console --errors, $B network) you saw.

1. Popup rendering (Task 6). `$B goto chrome-extension://$EXT_ID/popup.html`.
   Check: nothing animates (screenshot twice ~1s apart, pixel-diff by eye);
   layout fits without scrolling; sentence/duration/cycle/where-it-happens/
   blocking rows all present; take a screenshot for the record.

2. Setup / lists flow (Task 5), web app side. `$B goto <base>/setup`.
   Fill "where you work" and "what pulls you away" with 2-3 domains each via
   `$B fill`/`$B click` on the input, `$B press Enter` per chip. Reload the
   page ($B reload). Check the chips persisted (screenshot before/after
   reload). This exercises the session-cookie half of /api/lists' dual auth
   — note whether you're actually signed in (check for a redirect to a
   sign-in page instead of /setup; if so, report COULD-NOT-VERIFY and say
   why, don't fake a pass).

3. Dashboard / review rendering sanity. `$B goto <base>/dashboard`. Screenshot.
   Confirm no console errors, no broken layout.

4. API smoke checks, direct. `$B js` or a `$B chain` script hitting
   `GET <base>/api/lists`, `PATCH <base>/api/sessions/<a-real-id>` with an
   `intention` body — report raw responses. This doesn't need the extension
   at all, just confirms the server side is alive and responding as coded.

Report back: a table of the 4 checks, PASS/FAIL/COULD-NOT-VERIFY, screenshot
paths, and anything that looked wrong (console errors, unexpected redirects,
layout that doesn't match the approved artboard at
design/canvas/PopupIdle.dc.html). Do not mark something PASS on a guess —
COULD-NOT-VERIFY is a fine answer.
```

## Part C — still needs a human, no agent can do this

Confirmed not automatable by `browse` (or any DOM-level tool) after checking its actual command
surface — not guessed:

| Item | Why it's human-only |
|---|---|
| **chrome.idle away detection** (Task 2) — lock the screen ~70s | Real OS-level idle/lock state. No CDP/Playwright API drives this from outside the OS. |
| **Offline session start** (Task 3) — DevTools → Network → Offline, on the *service worker* | `browse` has no documented offline/throttle command, and even if it did, the target is the extension's background service worker context, not a normal page `browse` attaches to. |
| **The Task 7 permission spike** — `chrome.permissions.request({origins})` from the popup: resolve or hang? | This is a real product-decision spike, not just a click. It needs a human watching whether a native prompt appears and what happens after — `dialog-accept` doesn't reach Chrome's own permission UI. |
| **Real toolbar-icon click → Start → sidePanel opens** | The `chrome.sidePanel.open()` call requires a genuine user gesture (a real click), which the direct `chrome-extension://.../popup.html` navigation in Part B doesn't provide — Part B verifies the popup *renders* correctly, not this specific gesture-bound behavior. |

Record results from both parts (B and C) in `docs/dead-ends.md`, per this project's own rule —
the Task 7 spike's result belongs there either way it comes out.
