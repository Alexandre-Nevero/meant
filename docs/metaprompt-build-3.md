# BUILD 3 of 4: The loop (2:00 to 3:00)

> Paste as the first message of a fresh session, or `claude "$(cat docs/metaprompt-build-3.md)"`.

MEANT is a Chrome/Edge MV3 extension plus a Next.js app with Clerk and Neon. Prompts 1 and 2 provisioned the stack, shipped the signed-in shell, and connected the extension to the account. This is prompt 3 of 4, and it is the hour that makes the product exist: sessions, passive attention recording, and blocking.

Do not build the review page. That is prompt 4.

## Read first

1. `docs/build.md` sections 2, 6 (TASK-005, TASK-006, TASK-007), 7.1, 7.2, 7.3, 7.4, 9.
2. `docs/flow-intent.md` sections 5 and 6, the edge cases and the seven events.
3. `docs/prd-intent.md` US-01, US-02, US-03.
4. The `googlechrome/modern-web-guidance@chrome-extensions` skill before writing the service worker.

## The constraint that dictates every line of this hour

An MV3 service worker is killed after 30 seconds of inactivity, and `chrome.alarms` cannot tick faster than 30 seconds. **Nothing lives in memory.** A session is a start timestamp in `chrome.storage.local`, and elapsed time is always computed as `now - storedTimestamp`, never accumulated. A single `setInterval` reintroduces the bug silently and it will not show up until the demo.

## Scope

**TASK-005, sessions.** `POST /api/sessions` and `PATCH /api/sessions/:id`, plus `lib/device-auth.ts`. One storage key holds `{ sessionId, startedAt, plannedMinutes, currentDomain, currentSince, ruleIds }` and nothing else. An empty intention is valid and is stored as an empty string; that is deliberate, because assumption A2 is only testable if empty intentions are possible and counted. On startup, close any open session with `end_reason = 'recovered'`.

**TASK-006, attention.** Listeners on `tabs.onActivated`, `tabs.onUpdated` (only when `changeInfo.url` is set), `windows.onFocusChanged`, and a 30-second alarm. One shared handler computes `now - currentSince`, queues an event, and resets. `kind` is `away` when the browser is unfocused for more than 60 seconds, otherwise `attention`. `domain` is `new URL(tab.url).hostname` and nothing else. `POST /api/events` rejects any event whose domain contains `/`, `?`, or `#`, because the invariant is enforced at the boundary rather than trusted at the source.

**TASK-007, blocking.** Three hardcoded blocklists. A redirect action is an unsafe rule: it needs host permissions for the request URL, and `blocked.html` must be in `web_accessible_resources`. Declare host permissions per blocklist domain, never `<all_urls>`. Record rule ids in storage on start. Remove them on end **on every path, including errors and recovery**. A rule that outlives its session is release-blocking, not a bug to file.

`blocked.js` shows the intention and the time remaining. There is no bypass control, no "five more minutes", no dismiss.

## Parallelism

TASK-007 shares no file with TASK-006 and can be dispatched to a subagent while you build attribution, provided you hand it the exact contract from `docs/build.md` section 7 and its file scope. Verify its work yourself on the real surface. A subagent's report is not evidence.

## Lane

Unchanged. You own everything except `design/**` and `app/globals.css`. `blocked.html` uses the class vocabulary and the tokens; it carries no colors of its own.

## Done when

- Three tabs of roughly a minute each produce three attention rows with sane seconds.
- Stopping the worker from `chrome://serviceworker-internals` mid-session loses nothing: the session still runs and time continues to accrue.
- A blocked domain redirects to a page showing your own sentence during a session, and loads normally after it ends.
- Going offline mid-session and returning loses no events.

Report each with what you actually ran, not what the code implies. Prompt 4 assumes a completed session has real rows behind it.
