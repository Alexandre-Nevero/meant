# BUILD 4 of 4: The payoff and verification (3:00 to 4:00)

> Paste as the first message of a fresh session, or `claude "$(cat docs/metaprompt-build-4.md)"`.

MEANT is a Chrome/Edge MV3 extension plus a Next.js app with Clerk and Neon. Prompts 1 through 3 shipped the stack, the auth bridge, sessions, passive attention recording, and blocking. This is prompt 4 of 4, and it builds the one screen the whole product exists for, then proves the thing works.

## Read first

1. `docs/build.md` sections 6 (TASK-008, TASK-009, TASK-010), 7.1, 8, 9.
2. `docs/prd-intent.md` US-04 and US-05.
3. `docs/build-intent.md` section 5, the demo script.
4. `docs/design-toolkit.md` sections 8 and 9, the copy and the composition. Use its strings verbatim.

## Scope

**TASK-008, the review.** `app/review/[sessionId]/page.tsx` and `PATCH /api/sessions/:id/outcome`.

A server component doing one `group by domain, kind` over `event`, ordered by seconds descending. Away time is its own row. Blocked attempts are a count. The session's `user_id` must equal the Clerk user's, else 404, never 403.

Three things are not negotiable, because they are the product's argument rather than its styling:
- The answers are `Yes` and `Not yet`, identical in weight, size, and behavior. No celebration on either. The moment one is rewarded, the other becomes punishment and the honest answer stops being safe to give.
- Dismissing without answering stores `unanswered`. Do not force an answer. Counting the dismissals is how assumption A3 gets tested.
- The extension never writes an outcome. That route uses the Clerk session.

`sw.js` opens the review with `chrome.tabs.create` when a session ends.

**TASK-009, the ledger.** Sessions descending by `started_at`: intention, duration, top domain, outcome. Completion rate over answered sessions is the one headline number. **Total hours appear nowhere as a headline.** That is not a preference; it is the difference between this and Rize.

**TASK-010, verification.** Run `docs/build.md` section 8 by hand. T1, T2, T4, and T7 are release-blocking: rules install, rules are removed, worker death loses nothing, another user's review 404s. Then rehearse the demo script twice with no reload.

## Skills

Invoke `verification-before-completion` before any claim that something works, and `systematic-debugging` the moment something behaves unexpectedly. No guess-patching in the last hour; that is how a working demo becomes a broken one.

## Lane

Unchanged. You own everything except `design/**` and `app/globals.css`. The review is where the temptation to write visual CSS is strongest. Resist it: markup and class names only.

## Done when

- The review opens by itself at session end, shows the intention beside per-domain seconds, and answering persists.
- The dashboard shows sessions with outcomes and a completion rate, and no total-hours figure anywhere.
- T1, T2, T4, T7 pass, each run by you.
- The demo path runs twice consecutively without a reload.

## Close the build

- Record every cut in `docs/build-intent.md` section 7, with what it cost.
- Fill `docs/build.md` section 10 run evidence with facts, not impressions.
- Report exactly what works, what is stubbed, and what is missing. If the clock beat you, name the cut-line item you took and when. A partially working loop is not a working loop, and saying so is worth more than the demo.
