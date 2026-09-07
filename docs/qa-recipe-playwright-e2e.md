# Recipe: headless Playwright E2E for MEANT

Written before any test code, per instruction. Covers the extension + web app together,
using Playwright's own bundled Chromium (`channel: 'chromium'`, `launchPersistentContext`),
which — confirmed against Playwright's official docs before assuming it — supports loading
an unpacked extension in genuinely headless mode. No visible window; nothing to disturb.

Runs against `.env.local`'s real dev Neon DB (already used by every task's own verification
this whole build) — not mocked. Each test creates its own account, so runs don't collide.

## Why these cases, not others

Unit tests (40/40, `node --test`) already cover every pure function: `advance`, `idleMode`,
`normalizeDomain` (both copies), `isEditable`, `cyclePresetKey`. Re-deriving those here would
duplicate coverage for no new confidence. E2E exists for what only shows up when the real
browser, the real popup, the real server, and the real extension APIs all touch each other —
integration, not logic.

`chrome.idle`'s actual OS-level detection (Task 2) is explicitly excluded: there is no real
user-inactivity signal to simulate in an automated browser, headless or not — that's a
human-hands check, already on the manual checklist from the last recipe.

## Setup (once, shared across the whole suite)

1. `chromium.launchPersistentContext(tmpUserDataDir, { channel: 'chromium', args: [
   --disable-extensions-except=<repo>/extension, --load-extension=<repo>/extension] })`
   — no `headless` flag needed; the chromium channel runs headless by default unless told
   otherwise. A fresh `tmpUserDataDir` per test file, so extension `chrome.storage.local`
   never leaks between tests.
2. Get the extension ID: `const [sw] = context.serviceWorkers(); extensionId =
   sw.url().split('/')[2]` (wait for the `serviceworker` event if none yet attached).
3. The Next.js dev server must already be running at `http://localhost:3000` — the suite
   does not start it (matches every prior task's own manual verification pattern); a
   `globalSetup` checks `GET /` returns before the suite runs and fails fast with a clear
   message if not, rather than every test timing out individually.
4. Each test file creates its own account via the real signup form (no fixture/mock) —
   cheap, and it's the same path a real user takes, so a broken signup fails loudly here
   instead of only in production.

## Cases

Numbered for the report; not necessarily execution order (independent tests may run in
any order, so each creates and cleans up its own account/session).

### A — Setup and lists (Task 5), authenticated this time

The last recipe's automated pass couldn't tell if it was signed in when testing `/setup` —
resolve that ambiguity for real here.

1. Sign up, land on `/dashboard` empty state.
2. Navigate to `/setup`. Add 2 domains to "where you work," 2 to "what pulls you away."
   Click Done.
3. Reload `/setup` directly. **Pass:** all 4 chips still present (this is the exact check
   that came back inconclusive last time).
4. `GET /api/lists` with the session cookie. **Pass:** returns both lists matching what was
   entered.

### B — Pairing and device disconnect

5. Mint a pairing code via `POST /api/pair` (authenticated request).
6. Claim it via `POST /api/pair/claim` (unauthenticated, code only) — **Pass:** 200, returns
   `token`/`deviceId`.
7. Re-claim the same code. **Pass:** 401 (single-use, matches `claimed_at is null` guard).
8. `DELETE /api/device` with the claimed token. **Pass:** 200. Then retry any authenticated
   call (`GET /api/lists`) with that same now-revoked token. **Pass:** 401 — confirms
   `revoked_at` actually gates `deviceFromRequest`, not just a client-side clear.

### C — Popup rendering and interaction (Task 6)

9. Open `chrome-extension://<id>/popup.html` directly as a page (the standard Playwright
   pattern for extension UI — confirmed against official docs, not assumed).
10. **Pass:** sentence field, duration row (25 min selected by default), cycle row
    (no cycles selected by default), "where it happens" row, "blocking N" row all present
    and rendered — matches the approved artboard's row order.
11. Click a duration chip, a cycle preset, toggle a site chip in each row — **Pass:**
    `aria-pressed` flips correctly, multi-select rows don't reset each other (the bug
    the old single-select `chipGroup` had).
12. Type a domain into the "+" input on the blocking row, press Enter — **Pass:** chip
    appears normalized (test the exact regression case: type `HTTPS://Gmail.COM/inbox`,
    expect chip text `gmail.com`). Repeat via blur-instead-of-Enter (the other fix-round
    bug) — type a domain, click elsewhere without pressing Enter — **Pass:** chip still
    committed, not silently dropped.
13. Click Start with no other input beyond a typed sentence. **Pass:** `res.ok` true,
    `chrome.storage.local.session` populated, `POST /api/sessions` fires (check via
    `page.on('request')` or by querying the DB row afterward).
13a. Type a multi-domain phrase into the "+" input (e.g. `docs, gmail, and chatgpt`), press
    Enter. **Pass:** all three domains resolve to their aliases and appear as chips
    (e.g. `docs.google.com`, `gmail.com`, `chatgpt.com`), atomically — all or nothing.
13b. Type a phrase with a typo (e.g. `docs, gmial`), press Enter. **Pass:** error message
    "did you mean gmail? Press Enter to use it" appears; no chips are added yet (atomic
    rejection). Press Enter again to accept the suggestion. **Pass:** the corrected phrase
    resolves and both chips appear (`docs.google.com`, `gmail.com`).
13c. Fix round: type a phrase where the bad token is a substring of an earlier valid token
    (`docs, doc`), press Enter. **Pass:** suggestion "did you mean docs? Press Enter to use
    it" appears; press Enter again — resolves to a single deduplicated `docs.google.com`
    chip rather than oscillating forever (a naive string `.replace()` call would keep
    rewriting the "doc" inside "docs" instead of the bad token's own position).

### D — Session lifecycle, block rules, and the sentence lock (D34)

14. After Start (from case C), inspect `chrome.declarativeNetRequest.getDynamicRules()`
    in the service worker context. **Pass:** one rule per configured blocked domain,
    `condition.requestDomains` matches the normalized (not raw-typed) form.
15. Visit one of the blocked domains in a new tab. **Pass:** redirected to `blocked.html`.
    (This uses a domain already in the old hardcoded `host_permissions` list.)
15a. Regression test (Task 1): Start a *new* session configured to block a domain that
     was *not* in the old manifest's hardcoded `host_permissions` list (e.g. `github.com`).
     Visit that domain in a new tab. **Pass:** redirected to `blocked.html` (verifies that
     the broadened `host_permissions` allows `redirect` rules to execute for non-hardcoded
     domains; this test fails against the pre-fix manifest).
15b. Sweep test (Task 2): Open a tab to a domain *before* starting a session, then start
     a session that adds that domain to the blocklist. **Pass:** the already-open tab is
     redirected to `blocked.html` within 3 seconds (verifies that `sweepOpenTabs` runs
     immediately after `installRules`, catching tabs that were loaded before the rules
     existed; this distinct from 15, which tests the ordinary `declarativeNetRequest` rule
     for a fresh navigation after rules are installed).
16. Sentence lock, without waiting 60 real seconds: directly set
    `session.startedAt` in `chrome.storage.local` to "now" for the editable case and to
    ">60s ago" for the locked case, then open the popup fresh for each and read the
    rendered node. **Pass:** `<input class="m-field">` when within the window,
    plain `<p class="m-sentence">` once past it — this tests the real integration
    (popup.js's actual branch), not a re-derivation of the already-unit-tested predicate.
17. Edit the sentence while in the editable window, blur. **Pass:** `PATCH
    /api/sessions/:id` fires with the new `intention`; re-fetching the session confirms
    the DB value changed.
18. Stop the session. **Pass:** `chrome.storage.local.session` is null, dynamic rules are
    cleared. (Superseded by Task 4 / Case J: no tab opens anymore — a `pendingReview`
    marker is set instead, and the outcome renders in the popup on next open.)

### E — Offline resilience (Task 3)

19. `context.setOffline(true)`. Start a session. **Pass:** popup shows running immediately
    (no hang) — this is the local-first guarantee, and this is the first time it's been
    checked by anything other than a human's own hands.
20. `context.setOffline(false)`, *then* stop the session. `endSession` (`extension/sw.js`)
    clears the `TICK` alarm in its own `finally` block and makes exactly one `flush()`
    attempt right there so a queued end-of-session PATCH doesn't have to wait for the next
    session — that attempt only lands if connectivity is already back by the time
    `endSession` runs. (Stopping while still offline is real, documented behavior, not a
    bug: nothing drains the queue again until the next session starts or the browser
    restarts, since the alarm that would have retried it is gone.) **Pass:** the session
    and its events appear via `GET /review/:id` shortly after stopping.

### F — The floating companion (this session's own new feature)

21. Start a session, then `context.newPage()` and navigate to three different, unrelated
    origins (e.g. `example.com`, `example.org`, and back to `localhost:3000/dashboard`).
    **Pass:** the companion's shadow-DOM host element is present on all three (confirms
    `<all_urls>` content-script injection, not just the one page it happened to load on).
22. Drag the dot via synthetic pointer events (`pointerdown` → `pointermove` → `pointerup`)
    to a new position. Navigate to a fresh page. **Pass:** it appears at the same dragged
    position (confirms `companionPosition` persistence across page loads).
23. Set `companionState` to `'drifting'` in storage. **Pass:** the ring is present, dashed
    (`data-state="drift"` inside the shadow root). Set it back to `'focus'`-equivalent
    (i.e. anything other than `'drifting'`). **Pass:** `data-returning="true"` appears
    briefly (the one-shot pulse), then clears back to `false` within ~1s.
24. Stop the session. **Pass:** the shadow-DOM host element is removed from the page
    entirely, on every open tab, not just the one that was active.
25. Visual regression against the Orbit reference: screenshot the dot at rest, at drift,
    mid-return-pulse. Confirm by eye (this one needs a human or a design-literate review,
    not just a pixel diff) that it reads as "a minimal orbital dot," not the old capsule.

### G — Review page (this session's bug fixes)

26. Run a short session touching a `www.`-prefixed domain (e.g. navigate to
    `https://www.example.com` while a session with that as a work-site is running).
    **Pass:** the review page's per-domain row shows `example.com`, not `www.example.com`.
27. **Pass:** no "off by N min" text node exists anywhere on the review page (grep the
    rendered HTML), confirming the redundant line is actually gone, not just visually
    absent from one viewport.

### H — The auto-end-of-session path (added on the second deep QA pass)

Every other case stops a session via the popup's own `{type: 'stop'}` message
(`endReason: 'stopped'`). Nothing exercised the *other* way a session ends: the TICK
alarm's own elapsed check (`extension/sw.js`, alarm handler, `endReason: 'elapsed'`) for
a session started with a fixed `plannedMinutes` duration. It's a different code path,
untested until this pass turned it up by reading `sw.js` directly rather than assuming
the two `endReason`s behave identically just because they share the same `endSession()`
call.

28. Start a session with a fixed duration (e.g. "25 min"). Push `session.startedAt` back
    past that duration in storage (same technique as the sentence-lock case — no real
    wait). Re-arm the real `TICK` alarm to fire imminently
    (`chrome.alarms.create('meant-tick', {delayInMinutes: 0.01})` from the service worker)
    rather than waiting for its natural ~30s period. **Pass:** the session clears itself
    from storage without any popup interaction, and the block rules it installed are
    gone — confirming `endReason: 'elapsed'` runs the same cleanup as a manual stop, not
    a partial version of it. (Superseded by Task 4 / Case J: no tab opens — same
    `pendingReview` marker as a manual stop.)
29. (Folded into Case D's own rule-installation test.) After a manual stop, re-read
    `chrome.declarativeNetRequest.getDynamicRules()`. **Pass:** empty. The original version
    of this suite only checked that rules got *installed* on Start, never that they got
    *removed* on Stop — a leaked rule would silently keep blocking a domain forever.

### I — Browser-restart recovery (added on the second deep QA pass)

Neither Case D's `'stopped'` nor Case H's `'elapsed'` covers what happens if the browser
itself closes with a session still running. `extension/sw.js` has a third `endReason`,
`'recovered'`, wired to both `onInstalled` and `onStartup` (see `docs/dead-ends.md`,
2026-09-07 entry, for why both — empirically, only `onInstalled` fires for an unpacked
extension loaded via `--load-extension`, and Chrome's own docs don't confirm `onStartup`'s
behavior for a real user's UI-loaded install either way).

30. Start a session, close the whole persistent browser context (not just a tab), relaunch
    a fresh context against the *same* profile directory (a real Chromium startup, not a
    simulated one — needs its own context management, not the shared `fixtures.ts`
    context, which tears down a throwaway profile dir per test). **Pass:** the session is
    cleared from storage without any popup interaction, no tab auto-opens to `/review/:id`
    (the asymmetry from `'stopped'`/`'elapsed'`, which do open one), its block rules are
    gone, and the server-side session shows as ended.
31. **Unverified, human-only:** whether `onStartup` itself ever actually fires for a real
    user's manually "Load unpacked" install across an ordinary restart — Playwright's
    `--load-extension` CLI loading is a different code path from that. See
    `docs/qa-recipe-browser-verification.md` Part C.

### J — The outcome question moves into the popup (Task 4)

An explicit user decision reversed Case D step 18 and Case H step 28's own pass criteria:
stopping or elapsing a session no longer opens a browser tab to `/review/:id` at all. The
"Did you...? Yes / Not yet" question and the per-site elapsed summary now render inside
the popup itself, the next time it's opened — driven by a `pendingReview` marker in
`chrome.storage.local` and a new `GET /api/sessions/:id/review` JSON route
(`lib/review-data.ts` is the shared query both that route and the web `/review/:id` page
now call). The full web page still exists and still works on its own; nothing pushes it
at you anymore.

32. Start a session, click Stop. **Pass:** no new tab opens (`context.pages().length`
    unchanged 500ms after the click — long enough for a would-be `chrome.tabs.create` to
    have fired).
33. Reload the popup (`popup.html` closes/reopens between real popup opens, so a reload is
    the honest simulation). **Pass:** the outcome view renders — `.m-rate` "Did you?", the
    intention sentence if one was set, and `Yes`/`Not yet` buttons, both `.m-answer`,
    styled identically (PRODUCT.md's Yes/Not-yet invariant).
34. Click `Yes`. **Pass:** `PATCH /api/sessions/:id/outcome` fires with the device
    Authorization header (not a Clerk cookie — the popup has no browser session), the
    popup re-renders showing `Good. That's N of N.`, and a `Done` button. Click `Done`.
    **Pass:** `pendingReview` is cleared from storage and the popup returns to idle.
35. `GET /api/sessions/:id/review` with the device token. **Pass:** 200, JSON body matches
    the `ReviewData` shape (`topAttention`, `awaySeconds`, `blockedAttempts`, `outcome`,
    `finished`, `answered`). Same request unauthenticated. **Pass:** 401.
35a. Fix round: start a session while offline, stop it while STILL offline (so its
    `POST /api/sessions` never synced — this GET is genuinely unreachable, not a real
    404/401). Reopen the popup, still offline. **Pass:** shows "Can't reach it right now."
    with a `Done` button, NOT a silent revert to the idle "What do you mean to do?" screen
    (`pendingReview` must survive a transient/offline failure). Click `Done`. **Pass:**
    `pendingReview` clears and the popup now correctly shows idle.

### K — The idle mark's missing glyph, and popup navigation (Task 6)

`extension/meant.css`'s `.m-mark` drew its decorative gradient `::after` only for
`data-state="running"`/`"ended"` — `idle()` (the state seen dozens of times a day, the
popup opened with no session running) rendered a bare outlined rectangle with no fill.
Fixed by adding `data-state="idle"` to the `::after` selector and removing `idle` from the
blank-background rule (`data-state="empty"`, used only by the dashboard's true-empty
state, is untouched — it stays blank on purpose). Same commit adds a `navRow()` (History /
`meant.app` links, reusing `.m-btn[data-variant="quiet"]` and `.m-chip-row`, no new class)
to both `idle()` and `running()`, and a read-only `blocking: <domains>` line
(`.m-meta`) to `running()`, sourced from `session.blockedDomains`.

36. Open the popup with no session running (idle view). **Pass:** `.m-mark`'s `::after`
    has a real `background-image` (the three-tint clay gradient), not `none` — check via
    `getComputedStyle(el, '::after').backgroundImage`. Visually: the same glyph as the
    running/ended mark, not a blank outline.
37. Still in the idle view. **Pass:** a `History` and a `meant.app` button are both visible
    (`.m-btn[data-variant="quiet"]`, in a `.m-chip-row` after `Disconnect this device`).
38. Configure at least one blocked domain and Start a session. **Pass:** the running view
    shows a `blocking: <domain list>` line (`.m-meta`, right after the elapsed-time line)
    matching the configured domains, plus the same `History`/`meant.app` buttons after
    `Stop`.
39. **Visual, human/screenshot check:** at the popup's real 360px width, confirm nothing
    animates — no `transition`/`transform` introduced anywhere in this task's CSS or JS
    (PRODUCT.md: the popup animates nothing) — and the two nav buttons render at a
    reasonable size without wrapping awkwardly.

### L — Extension protocol filtering (Task 1 fix)

The `bareHostname()` function in `extension/sw.js` parses tab URLs to extract hostnames
for time-tracking. Before this fix, it did not check the URL's protocol, so
`chrome-extension://<id>/popup.html` would parse fine and its "hostname" (the extension's
own random ID string) would be tracked as a visited domain. This case verifies the fix
silently filters non-HTTP(S) schemes.

40. Start a session, then `context.newPage()` and navigate to the extension's own popup
    page (e.g. `chrome-extension://<extensionId>/popup.html`). **Pass:** wait a moment,
    then stop the session and fetch its review data via `GET /review/:id`. The review page
    HTML does *not* contain the extension ID string anywhere — confirming the chrome-extension://
    URL's hostname was never tracked as a domain. (The regex used for this pass criteria
    must match the extension ID to be meaningful, so the test constructs it dynamically
    from `extensionId` rather than hardcoding.)

### M — Already-focused tab seeding on session start (Task 2 fix)

`startSession()` in `extension/sw.js` calls `transition()` to seed the session's time slice
with whatever tab is currently focused, so an already-active tab gets tracked immediately
without needing a separate tab-switch event afterward. Without this seed, a user who starts
a session on a tab and never switches tabs would see zero minutes attributed to that domain
(until a 30s TICK alarm fires, if the user stays idle — or never, if they stay active).

41. Create a page open on `https://example.com` and bring it to focus. Create a second
    page and pair a device on it, navigate to the extension's popup. Fill in a sentence
    and click Start. Bring the already-open `example.com` tab back to focus. Wait 2 seconds
    (long enough for the attribution timer to emit an event). Bring the popup back to focus,
    stop the session via `chrome.runtime.sendMessage({type: 'stop'})`. **Pass:** fetch the
    review page via `GET /review/:id`, and confirm it contains the string `example.com`
    in its HTML. (The 2-second wait is empirically necessary: `extension/lib/attribution.js`
    floors milliseconds to whole seconds, so a shorter wait would never emit an event, and
    a test that checks this fix would pass falsely even without the fix.)

## What Sonnet writes vs. what Haiku runs

Sonnet (this session) writes every spec file and the shared fixtures/helpers below —
extension automation setup, popup/service-worker access patterns, and any tricky assertion
are exactly the kind of thing a cheaper model gets subtly wrong first try. Haiku's job is
narrower and mechanical: run `npx playwright test`, capture the full report (pass/fail per
case, screenshots/traces on failure), and relay it verbatim — no interpretation, no "looks
fine to me" judgment calls, since severity triage belongs to whoever reads the results next.

## Files this recipe implies

- `playwright.config.ts` — headless by default, no `webServer` block (dev server assumed
  already running per Setup step 3), `reporter: [['list'], ['json', {outputFile:
  'test-results/report.json'}]]` so Haiku's relay is a file read, not a terminal scrape.
  A CLI `--reporter=...` flag on the dispatch command replaces this array wholesale rather
  than adding to it — confirmed directly, this silently drops `report.json` (only
  `.last-run.json`, a 3-line summary, gets written instead). Run plain
  `npx playwright test --workers=1`, no `--reporter` flag, or the file this bullet promises
  never appears.
- `e2e/fixtures.ts` — the shared `launchPersistentContext` + extension-ID helper, a
  `freshAccount()` helper (signup with a random email, returns the page + credentials).
- `e2e/setup-lists.spec.ts` (case A), `e2e/pairing.spec.ts` (B), `e2e/popup.spec.ts` (C),
  `e2e/session-lifecycle.spec.ts` (D), `e2e/offline.spec.ts` (E), `e2e/companion.spec.ts`
  (F), `e2e/review.spec.ts` (G), `e2e/session-elapsed.spec.ts` (H),
  `e2e/session-recovery.spec.ts` (I, manages its own persistent-context lifecycle rather
  than using the shared fixture, since it needs to close and relaunch the browser),
  `e2e/outcome-in-popup.spec.ts` (J), `e2e/popup.spec.ts` (K, folded into the existing
  idle-state test plus a new running-state describe block).
