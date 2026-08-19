# Design — Review, outcome, ledger (BUILD 4 of 4)

**Date:** 2026-08-19 · **Traces to:** build.md TASK-008/009/010 · PRD US-04, US-05 · FLOW E5, EV7 · design-toolkit §8, §9

## Problem

Three builds produced a session that starts, blocks, records, and ends — and nothing that shows it back. This hour builds the one screen the product exists for, the ledger behind it, and then proves the loop by running it rather than by reading it.

## The argument, expressed as constraints

These three are the product's thesis, not its styling. Breaking one makes this a worse Rize.

1. **`Yes` and `Not yet` are identical** — same weight, size, and behavior, no celebration on either. Reward one and the other becomes punishment, and the honest answer stops being safe to give.
2. **Dismissal stores `unanswered`.** No forced answer, no modal trap. Counting dismissals is how assumption A3 gets tested.
3. **No total-hours figure as a headline, anywhere.** Per-session duration is fine (US-05 asks for it). An aggregate hours number is the metric this product demotes.

The extension never writes an outcome. `PATCH /api/sessions/:id/outcome` uses the Clerk session.

## Review composition (design-toolkit §9)

Opening line, then rows, then the question. Copy is verbatim from §8: `Did you?` · `Yes` · `Not yet` · after Yes `Good. That's 7 of 11.` · after Not yet `Noted. It carries over.` Nothing after `Not yet` may encourage, explain, or exclaim.

One SQL `group by kind, domain` produces everything:

| Row | Source |
|---|---|
| per-domain seconds, descending | `kind = 'attention'`, grouped by domain |
| away | `kind = 'away'`, its own row, summed |
| blocked attempts | `kind = 'block_hit'`, counted |

**The gap label** reads `off by N min`, where N is total away time. §9's sample derives it from an on-task/drift split, but build-intent §3 cut categories — nothing is classified, so that split cannot be computed honestly. `away` is a recorded event kind rather than a judgment about a domain, so it is the one split the data actually supports.

**Empty intention** renders `You didn't say what you meant to do.` — invented copy in the toolkit's voice, flagged for the design session to ratify. US-01 makes empty intentions legal on purpose and A2 is only testable if they are counted, so the review must stay readable without one.

## Ledger composition

Completion rate is the only headline: `7 of 11 finished` — `yes` over answered (`yes` + `no`), unanswered excluded from the denominator. Rows carry intention, duration, top domain, and the outcome as a word.

## Ownership and failure

Every query filters on the Clerk `user_id`; another user's session returns 404, never 403 (INV-6). A session id that is not a UUID returns 404 too — without that guard Postgres raises `22P02` and the page 500s, which leaks the difference between "malformed" and "not yours".

## Amendments

1. **A fourth file in `app/review/`.** The two answer buttons need a client boundary, so `app/review/[sessionId]/answer.tsx` joins build.md §3's file list. The page itself stays a server component.
2. **`sw.js` opens the review only for `stopped` and `elapsed`.** A `recovered` session ends during browser startup and a `superseded` one ends because another just began; opening tabs then is noise. The tab opens after cleanup, never before, so INV-3 is untouched.

## Verification — the point of the hour

Release-blocking, each run by hand: **T1** rules install · **T2** every rule removed on stop · **T4** worker death loses nothing · **T7** another user's review 404s. Then the demo script twice, no reload.

T7 needs a session row owned by a different `user_id`; seeding one and requesting its review while signed in is the cheap version of a second account.
