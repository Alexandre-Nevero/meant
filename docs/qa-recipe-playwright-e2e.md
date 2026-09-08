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

    **Companion fix (defense-in-depth, Task 3):** Case 40 verifies live tracking never records
    extension IDs. Task 3's unit-tested filter in `lib/band.ts` provides the second layer —
    even historical data rows (from before the live-tracking fix existed, or if the live filter
    ever failed) shaped like extension IDs (32 chars, a-p only) are silently excluded from the
    review page's attention band. A `www.`-prefixed domain is included; a string matching the
    exact extension ID shape is not. This guards against historical junk showing up on the
    review surface.

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

### N — The companion's drift signal was dead code (Task 3 fix)

`updateCompanion()` in `extension/sw.js` computed the ring's drift/focus state but had
zero call sites anywhere in the file — `transition()` never called it, so the companion
could only ever render its default 'focus' ring. It also had a field-name bug
(`session.blocklist`, singular, never set) that would have kept it broken even if called;
sessions store the resolved domain list as `blockedDomains` (plural).

42. Start a session but do not block `youtube.com` this session. Push `session.startedAt`
    back past `DRIFT_GRACE_MS` (60s) in storage (no real wait). Navigate to
    `https://example.com`. **Pass:** the companion's ring is `data-state="focus"`. Then
    perform a real navigation (`waitUntil: 'commit'`) to `https://youtube.com` — a known
    'video'-category distraction domain (`design/blocklists.js`) that is not on this
    session's own `blockedDomains`. **Pass:** the ring flips to `data-state="drift"` within
    3s, confirming `transition()`'s real call to `updateCompanion()` — not a manual
    `companionState` storage write — actually drives the signal on a genuine domain-change
    event.

### O — Companion position stored as a viewport fraction, not absolute pixels (Task 4 fix)

`positionHost()`/`endDrag()` in `extension/companion-overlay.js` used to store a dragged
position as absolute `{left, top}` pixels in `chrome.storage.local`, then reclamp those
pixels against whatever window's own `innerWidth`/`innerHeight` happened to be loading
it (`clampToViewport`). A position valid on a wide monitor got silently reclamped smaller
on a narrower window — the dot appeared to "drift" between windows of different sizes.
The fix stores `{xFrac, yFrac}` (0-1 range) instead, so a fresh window reconstructs the
same relative place regardless of its own size. A stale `{left, top}` value (no
`xFrac`/`yFrac`) is treated the same as no stored position — falls back to the default
bottom-right corner.

43. Pair and start a session on a setup page. Open a wide window (`1400x900`), navigate
    to `https://example.com`, and drag the companion to roughly its horizontal center.
    Record the dragged position as a fraction of that window's own width. Open a genuinely
    narrower window (`500x700`), navigate to `https://example.org`. **Pass:** the
    companion's horizontal fraction in the narrow window is within 0.05 of the fraction
    recorded in the wide window — confirming the stored position holds its relative place
    instead of being reclamped against the narrower window's own smaller width.

### P — Landing page CTA swap based on auth state (Task 5, updated for the canvas landing redesign)

The landing page (`/`) used to redirect a signed-in visitor to `/dashboard`. Task 5 fixed
that by showing the same pitch to both signed-in and signed-out visitors while swapping the
call-to-action. This case was later updated when the landing page's real, previously-built
canvas redesign was ported to `main`: sign-in/sign-up moved to a dedicated `/sign-in` route
(the landing page itself never carries an inline auth form), and the CTA now lives in two
places — the header nav and the ledger section — both swapping between "Sign in" (→
`/sign-in`) and "Go to your dashboard" (→ `/dashboard`) based on auth state. No forced
redirect on `/` either way.

44. Sign up and land on `/dashboard`. Navigate directly to `/`. **Pass:** the hero text "Say
    what you mean. It knows if you did." is visible, a `header` element contains a link
    "Go to your dashboard", `section.m-landing-ledger` contains its own "Go to your
    dashboard" link, and no "Sign in" link is present anywhere on the page.
45. In a fresh browser context, navigate to `/` signed-out. **Pass:** the hero text is
    visible, the header's "Sign in" link points at `href="/sign-in"`, the ledger section
    has its own "Sign in" link, no email input field is visible anywhere on `/` (the auth
    form never renders inline), and no "Go to your dashboard" link is present. (See Case X
    below for the dedicated `/sign-in` route itself.)

### Q — Dashboard ledger container width (pure CSS constraint)

The ledger container had no max-width constraint and stretched to fill the full viewport,
even at very wide breakpoints where a 1000px container is the approved design. This case
verifies the fix wires the approved fixture value into the shipped stylesheet.

46. Sign up and land on `/dashboard`. Set the viewport to 1600px wide. **Pass:** the
    `[data-surface="ledger"]` element's bounding box width is at most 1000px, not close to
    the full 1600px viewport. (This is the CSS-only constraint, already approved in
    `design/fixtures/ledger.html` and `design/canvas/Ledger.dc.html` — not a new design
    decision, just a missing implementation detail.)

### R — Away row clarifying copy

The away row on the review page (representing time when the screen was locked, idle, or
the browser window was not in focus) lacked a clarifying hover tooltip. Users seeing "away"
without context might misunderstand what it tracks. The fix adds a `title` attribute to
the away row's `<div>` explaining the meaning via hover-only disclosure, with no new visible
text (per the design invariant that rows need no inline labels).

47. Start a session, then inject an away event directly via `POST /api/events` with
    `{kind: 'away', domain: null, seconds: 120}` (deterministic, no real idle/focus timing
    needed). Stop the session and fetch its review page via `GET /review/:id`. **Pass:** the
    away row's container `<div>` has a `title` attribute matching `/not measured/i`,
    confirming the hover explanation is present. **Pass:** no new visible text appears on the
    page (the explanation is hover-only, not a new paragraph or label).

### S — Site chip removal, wired to the standing list (Task 8)

`chipGroup` in `extension/popup.js` only ever toggled a chip's `aria-pressed` state — there
was no way to actually delete a work/blocked site from the standing list, only to
deselect it for the current session (it would keep reappearing as an unselected chip on
every future popup open, sourced from `GET /api/lists`). The fix adds a `removable`/
`onRemove` option (default `false`, so the duration and cycle pickers — the other two
`chipGroup` call sites, neither of which passes `removable` — render byte-for-byte as
before): a removable chip shows a trailing " ×" and a `Remove <label>` accessible name;
clicking it deletes the chip from local state and calls `onRemove(domain)`, which does a
read-filter-write against `PUT /api/lists` (no backend change — the route already accepts
device-token auth via `requestUserId()`).

48. Pre-seed the account's server-side `workSites` list with a domain directly via
    `PUT /api/lists` (not by adding it live through the popup's own "+" input — a domain
    only ever added client-side within the same test would make every assertion below
    trivially true even if removal never reached the server; confirmed by mutation
    testing, where a no-op `removeFromList` still passed against the weaker version of
    this test). Open the popup. **Pass:** a `Remove <domain>` button is visible. Click it.
    **Pass:** the chip is gone from the DOM immediately. **Pass:** `GET /api/lists` no
    longer includes the domain (polled, confirming the server-side standing list changed,
    not just local render state). Reload the popup. **Pass:** the chip does not reappear.

### T — Work site chip row max-height and scroll cap (Task 9)

The site chips' flex row had no height limit, so adding many sites (e.g., a list of 15+)
would cause the row to wrap unbounded and grow the popup's own height past its practical
~600px ceiling, pushing the Start button and other controls off-screen. The fix adds
`max-height: 132px; overflow-y: auto;` to `.m-chip-row` — approximately 4 rows of chips
at the popup's 360px width (132px ≈ 4 × ~30px chip height + ~12px gaps), a reasonable
compact cluster without dominating the popup.

49. Pair a device and open the popup. Use the work sites "+" input to add 15 domains
    (e.g., `site0.example.com` through `site14.example.com`), each on its own Enter.
    **Pass:** the `.m-chip-row` containing the work site chips has a `boundingBox().height`
    less than 300px (well under the popup's practical ceiling), confirming that the chips
    scroll internally instead of growing the popup unbounded. (Visually/human check: the
    row appears as a compact ~4-line chip grid with an internal scrollbar, not a tall
    tower of wrapping chips extending past the Start button.)

### U — Cycle phase display in the running popup (Task 10)

The running popup showed elapsed minutes but no sense of where you sit in a configured
work/break cycle. The fix adds a pure `cyclePhase(session)` helper (`session.cycle` +
`session.startedAt` in, `{phase, elapsedInPhaseMs, phaseMs, remainingMinutes}` or `null`
out) and wires it into `running()`: a phase line (`"work — 15 min left"` /
`"break — 3 min left"`) plus a two-segment fill — originally in a separate top-level
`.m-mark:not(:empty)` band, since restructured by Task 5 of the follow-up review-fixes
plan to live inside `[data-timer-pill]` instead (see Case AB below; the top-level
`.m-mark[data-state="running"]` is now always empty, matching idle/ended). Read-only
display only: `extension/lib/attribution.js`'s undriven `'break'` mode stays undriven;
break time keeps being tracked as ordinary attention/away exactly as before. No cycle
configured ⇒ no phase line, no band. No `chrome.storage.onChanged` listener was added —
the display only recomputes when the popup itself re-renders, never on a live
per-second timer.

50. Start a session with the picker's `25/5` preset. **Pass:** a `work — N min left` line
    is visible. Push `session.startedAt` back 26 minutes via `chrome.storage.local` (25/5
    cycle: 26 min elapsed lands 1 min into the break phase — `posInCycle` (1,560,000ms)
    ≥ `workMs` (1,500,000ms)) and reload. **Pass:** the line now reads
    `break — N min left`.
51. Start a session with `no cycles` selected. **Pass:** no `... min left` text renders
    anywhere in the popup.

### V — Blocking UI: the interstitial names the domain, the popup label stops mismatching its sibling (Task 12)

Two gaps from the Task 11 design pass. First, `blocked.html` read `?d=<domain>` into JS
but never rendered it — a user who lands there without having just typed the blocked URL
(a stale tab, a link, a bookmark) had no on-screen confirmation of what got blocked. The
fix folds the domain into the page's existing bottom-most, lowest-emphasis line rather
than adding a new element: `remainingText(session)` now returns
`` `${domain} — ${timeText}` `` (falling back to `timeText` alone if `domain` is falsy),
rendered by the unchanged `.m-row-figure` node. Same three elements as before
(`.m-sentence`, `.m-meta`, `.m-row-figure`), same "no session" early return, no new
class/color/motion. Second, the idle popup's blocklist group was headed by a live count,
`` blocking ${blockedValues.length} ``, updated on every add/remove — its sibling group
directly above it (`where it happens`) uses a plain static label with no count. The fix
replaces the count with the literal `'what to block'` and deletes the `onChange` handler
that used to rewrite it; `onRemove` (still needed for standing-list removal) is unchanged.
The running-state summary line (`blocking: x, y, z`) is untouched — it does a different
job and was already out of scope for this pass.

52. Start a session with a blocked domain configured, then navigate a tab to that domain.
    **Pass:** the redirect lands on `blocked.html`, and the muted bottom line reads
    `<domain> — N minutes left` (or `N minutes in` for an open-ended session) — the domain
    now appears in the same line, same size, same color as the time text always has.
53. Open the idle popup. **Pass:** the blocklist group's header reads `what to block`, not
    a number. Add a domain via its own `+` input, then remove it. **Pass:** the header text
    never changes through either action — it stays the literal string `what to block`
    throughout.

### W — A removable chip splits into a toggle body and a separate delete "×" (Task 8 fix)

Case S's `removable: true` fix was itself a regression: it made *every* click on a
removable chip call `onRemove` and permanently delete the site from the standing list —
the per-session toggle behaviour (`aria-pressed`, include/exclude a known site just for
this session) was gone entirely for the work/blocked site rows. Since `idle()` renders
every standing-list site as a chip whether or not it's selected this session, clicking an
unpressed known site to include it now destroyed it from the account instead. The fix
splits the two actions onto two sibling `<button class="m-chip">` elements sharing a
`div[data-chip-item="removable"]` wrapper (never nested — a `<button>` inside a `<button>`
is invalid HTML): the chip body keeps its plain label and toggles `aria-pressed` exactly
like the non-removable case, while a small trailing `.m-chip[data-chip-role="delete"]`
("×", `aria-label="Remove <label>"`) does the real `onRemove` deletion. `onChange` fires
after either action, same as before. The duration and cycle pickers (the two non-removable
`chipGroup` call sites) render byte-for-byte as before — a single `.m-chip` button, no
wrapper, no second element.

54. Pre-seed a server-side work site via `PUT /api/lists`, open the popup. **Pass:** its
    chip shows `aria-pressed="false"` (a known site, not selected this session). Click the
    chip body (its label). **Pass:** `aria-pressed` flips to `"true"`; `GET /api/lists`
    still includes the domain (polled). Click the body again. **Pass:** `aria-pressed`
    flips back to `"false"`, and the domain is still on the server-side list — a toggle
    never mutates the standing list either direction. Reload. **Pass:** the chip is still
    there.
55. Same setup. Click the separate `Remove <domain>` button (the trailing "×", not the
    label). **Pass:** the chip is gone from the DOM immediately, and `GET /api/lists` no
    longer includes the domain (polled). Reload. **Pass:** it does not reappear.
56. Open the duration picker and the cycle picker. **Pass:** each option is a single
    `.m-chip` button with no adjacent second element, and clicking one still toggles
    `aria-pressed` exclusively among its siblings exactly as before — these two call sites
    never pass `removable` and are unaffected by this fix.

### X — Landing page canvas redesign ported from a previously-built branch

The landing page's header (and every other section) never implemented the canvas's
centered, `max-width: 1200px` container — `app/globals.css` padded the section/header
elements directly with no width cap at all, so on a wide viewport the content stretched
edge to edge instead of sitting in a centered column. This had been fixed once already, on
a separate long-diverged branch/worktree (`worktree-landing-gsap-scroll`) that built out a
fuller landing redesign — the centered container, a live-typing hero element
(`app/intention-typer.tsx`), sign-in extracted to its own `/sign-in` route, and the four
"beats" reworked into a connected sequence with arrows. That branch's `app/page.tsx` still
had the old forced `if (userId) redirect('/dashboard')` (predating the fix that removed
it), so porting it required reconciling: keep the new visual structure, drop the redirect,
and apply the CTA-swap pattern to the new nav locations instead of the old inline form.

57. Sign up, navigate to `/`. Set the viewport to 1920px wide. **Pass:** the header's
    inner content (wordmark + nav buttons) does not stretch to the browser's edges — it
    sits in a column comfortably inset from both sides, matching
    `design/canvas/Landing.dc.html`'s centered structure. Same check for the hero, the
    four-steps section, the two prose sections, and the ledger.
58. Navigate to `/sign-in` in a signed-out context. **Pass:** the real sign-in/sign-up
    form renders (this is the actual auth entry point now, not the landing page). Navigate
    to `/sign-in` while signed in. **Pass:** redirected to `/dashboard` (a route-specific
    redirect, correct and intentional here — unlike the landing page, which never
    redirects).
59. `e2e/fixtures.ts`'s `freshAccount()` helper, and `e2e/session-recovery.spec.ts`'s own
    inline signup flow, both now sign up via `/sign-in`, not `/` — confirmed by the full
    suite passing end to end, since nearly every spec depends on one of these two paths.

### Y — Companion redesign: contrast-safe color, larger size, wake animation

The companion overlay dot's color was bound to `prefers-color-scheme`, which reflects the
user's OS/browser setting, not the actual page's background — so a dark-mode user navigating
to a light-background page got an invisible near-white dot. The fix makes the dot use a
fixed --m-clay (orange) color that has working contrast against both light and dark
backgrounds. The companion also grows from 28px to 36px and gains a one-shot scale+fade
"wake" animation on mount.

60. Start a session, open a new tab, and emulate dark color scheme on that tab. **Pass:**
    the companion dot's computed `backgroundColor` is `rgb(199, 91, 57)` (--m-clay,
    `#C75B39`), not a color that flips with the color-scheme media query. This confirms
    visibility no longer depends on guessing the page's background colors.
61. After starting a session, open a new tab. **Pass:** the companion's bounding box width
    and height are both 36px (not the old 28px), confirming the size increase. Also check
    that the host element has active animations when measured (via
    `getAnimations({ subtree: false }).length > 0`), confirming the wake animation runs
    on mount — the animation scales from 0.5 to 1 over 360ms with an easing curve.

### Z — Review page container width (pure CSS constraint)

The review page container had no max-width constraint and stretched to fill the full viewport,
even at very wide breakpoints where a 1000px container is the approved design. This case
verifies the fix wires the approved fixture value into the shipped stylesheet, matching the
dashboard's ledger container width.

62. Start a session, then navigate to its review page. Set the viewport to 1600px wide.
    **Pass:** the `[data-surface="review"]` element's bounding box width is at most 1000px,
    not close to the full 1600px viewport. (This is the CSS-only constraint, matching the
    `[data-surface="ledger"]` rule's own approved values — same max-width, margin, padding,
    flex layout, and gap for literal visual parity between the two "history" surfaces.)

### AA — A blocked tab reverts to the real site once its session ends (Task 4 fix)

`endSession()` already removed all `declarativeNetRequest` block rules on Stop/elapsed/
recovery, but a tab already sitting on `blocked.html?d=<domain>` (redirected there mid-
session) never navigated back — `declarativeNetRequest` only intercepts *new* navigation
attempts, so removing the rule alone never un-redirects a tab that's already redirected.
The fix adds `sweepBlockedTabsBack(domains)` (mirroring `sweepOpenTabs`'s shape, the
inverse direction), called from `endSession()`'s `finally` block, scoped to that session's
own `blockedDomains` only — a stale `blocked.html` tab left over from an earlier,
already-ended session must not get swept by a *different* session's own end. One ordering
detail mattered in practice, found only by running the test against the brief's literal
ordering and watching it still fail: `removeAllRules()` must run *before* the sweep, not
after — the sweep's own `tabs.update` navigation is itself a new navigation attempt, so if
the block rule is still installed at that instant, `declarativeNetRequest` redirects the
sweep's own navigation right back to the exact same `blocked.html` URL, which looks
indistinguishable from nothing happening at all.

63. Start a session with a blocked domain configured, navigate a tab to that domain so it
    lands on `blocked.html`. Click Stop. **Pass:** that tab navigates to the real
    `https://<domain>/` within 5 seconds — no popup interaction beyond Stop, no further
    navigation on that tab.
64. Same setup, but immediately before Stop, clear `session.blockedDomains` to `[]` directly
    in `chrome.storage.local` (simulating a session that no longer blocks that domain by
    the time it ends). **Pass:** the blocked tab is left untouched — still on
    `blocked.html?d=<domain>` half a second later — confirming the sweep checks membership
    in the *ending* session's own current `blockedDomains`, not a blanket sweep of every
    `blocked.html` tab regardless of which session's domains it belongs to.

### AB — The intention pill's own outline carries cycle progress, not a separate mark (Task 5)

Case U's phase display lived in a separate top-level `.m-mark:not(:empty)` band next to
the intention box. Product direction: the intention's own box should double as the
cycle's static progress indicator — its border carries elapsed/remaining directly,
rather than a separate glyph elsewhere. `running()` now wraps `sentenceNode` (the
editable `<input class="m-field">` inside the grace window, or the read-only
`<p class="m-sentence">` past it) in a plain `<div data-timer-pill="true">`; when a
cycle is configured, the SAME `.m-mark:not(:empty)` / `.m-row-bar[data-kind="attention-1"
|"remainder"]` construction from Case U is appended inside that wrapper instead, and
`[data-timer-pill] > .m-mark:not(:empty)` is pinned via CSS to a thin 3px strip flush
with the wrapper's bottom inside edge (solid fill, dashed remainder), clipped by the
wrapper's own `overflow: hidden`. The top-level `.m-mark[data-state="running"]` glyph
still exists (matching idle/ended) but is now always empty — it no longer carries the
fill. No new class was added; `data-timer-pill` is a plain attribute, and the fill reuses
the pre-existing `.m-row-bar[data-kind]` rules verbatim. Static only, same as Case U —
recomputed on the popup's own natural re-render, never a live tick, never a dial or ring.
Visual check (not exercised by the Playwright cases below): confirmed by screenshot that
the intention text stays legible inside the pill, the two-segment strip is visible flush
with the pill's bottom edge, the phase line sits directly under the pill, and — checked
specifically — clicking into the field during the grace window shows the input's
`:focus-visible` outline drawn fully intact around the pill's rounded corners, not cut
off by the wrapper's `overflow: hidden` (the outline sits close enough to the wrapper's
own border that it isn't clipped in practice; no padding/scoping change was needed).

65. Start a session with the `25/5` preset and a sentence typed in. **Pass:**
    `[data-timer-pill="true"]` is visible and contains the SAME editable
    `input.m-field` holding that sentence (not a separate element) plus a
    `.m-mark:not(:empty)` strip with one `.m-row-bar[data-kind="attention-1"]` and one
    `[data-kind="remainder"]` bar inside it. The separate top-level
    `.m-mark[data-state="running"]` is still visible but has zero `.m-row-bar` children.
    The `work — N min left` phase line still renders immediately after the pill.
66. Start a session with `no cycles` selected. **Pass:** `[data-timer-pill="true"]` is
    visible but contains no `.m-mark` at all, and no `... min left` text renders anywhere.

### AC — Extension-ID-shaped domains excluded from review page (Task 1 fix)

Case L (step 40) verified that the live-tracking filter in `extension/sw.js` prevents
chrome-extension:// URLs from being tracked as domains. This case verifies the server-side
defence-in-depth filter in `lib/review-data.ts`'s `getReviewData()` — even if historical
data or a filter bypass accidentally recorded an extension ID as a domain, it never appears
on the review page's per-domain row list. The shape filter (EXTENSION_ID_SHAPE: exactly 32
chars, a-p only, no dots) is tested both in isolation (unit test) and end-to-end (E2E test
injecting real data), proving it excludes junk extension IDs while still including legitimate
dotless domains like `localhost`.

67. Unit test: `test/review-data.test.js` verifies the exact filter condition that
    `getReviewData()` uses in its `topAttention` computation. **Pass:** a test row array
    containing one real domain (`chatgpt.com`) and one extension-ID-shaped junk entry
    (`emnalgngpciahekjdcgpbgnhmkpjhlhi`, 32 a-p chars) filters to just the real domain when
    the shape guard `/^[a-p]{32}$/` is applied. A separate assertion confirms `localhost`
    (another dotless domain, real and legitimate) still passes the same filter.
68. E2E test: `e2e/review.spec.ts` Case AC. Start a session, inject two attention events
    directly via `POST /api/events` (one real domain, one extension-ID-shaped string),
    stop the session, navigate to the review page. **Pass:** `chatgpt.com` is visible on the
    page (injected real data shows up), and the extension-ID string never appears anywhere
    in the DOM (`toHaveCount(0)`), confirming the server-side filter is wired and working.

### AD — Companion size 52px (Task 2)

The floating companion overlay on injected pages grew from 36px to 52px, a 44% increase
in linear dimension. All position/sizing calculations in `extension/companion-overlay.js`
already derive from the `SIZE` constant, so the change is one line: `const SIZE = 52`.
The old test at Case F (item 25) expects 36px; that assertion has been updated to expect
52px as well to reflect the new size.

69. E2E test: `e2e/companion.spec.ts` "the companion is 52px, not the old 36px". Start a
    session, navigate to an arbitrary page, wait for the companion's wake animation to
    settle (400ms), measure the companion's bounding box. **Pass:** both width and height
    equal exactly 52 pixels, confirming the SIZE constant propagated correctly through
    the CSS and DOM measurement pipeline.

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
  Signs up via `/sign-in`, not `/` (Case X — the landing page never carries an inline
  auth form).
- `app/sign-in/page.tsx`, `app/intention-typer.tsx` — added by Case X's landing redesign
  port: the dedicated sign-in route, and the hero's live-typing decorative element.
- `e2e/setup-lists.spec.ts` (case A), `e2e/pairing.spec.ts` (B), `e2e/popup.spec.ts` (C),
  `e2e/session-lifecycle.spec.ts` (D), `e2e/offline.spec.ts` (E), `e2e/companion.spec.ts`
  (F), `e2e/review.spec.ts` (G, R), `e2e/session-elapsed.spec.ts` (H),
  `e2e/session-recovery.spec.ts` (I, manages its own persistent-context lifecycle rather
  than using the shared fixture, since it needs to close and relaunch the browser),
  `e2e/outcome-in-popup.spec.ts` (J), `e2e/popup.spec.ts` (K, folded into the existing
  idle-state test plus a new running-state describe block).
