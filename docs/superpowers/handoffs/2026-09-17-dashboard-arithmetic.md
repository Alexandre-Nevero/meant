# Handoff — the dashboard's arithmetic

**Written:** 2026-09-17 · **Branch:** `dashboard-arithmetic`, 15 commits, **not pushed**
**State:** 169 unit tests · **0 type errors** · 97 e2e, three chunks, all green in one pass
**Plan:** `docs/superpowers/plans/2026-09-17-dashboard-arithmetic.md`

A pointer, not a duplicate. The decisions are in `docs/adr/` — **ADR-0066** and **ADR-0067** are
new — and the reasoning is in the commit messages. Read `git log 1c3658e..HEAD` before the code.

---

## 1. What landed

| | |
|---|---|
| **A second contrast** | `lib/time-of-day.ts` — which part of day your sessions finish in. Free arithmetic over `session.outcome`, the sibling of `lib/attention-contrast.ts`, no model call |
| **The actions block** | `lib/unanswered.ts` — sessions ended without an answer, oldest first, bounded at fourteen days. Description, so no evidence floor (ADR-0050); one is enough |
| **ADR-0066** | At most one inference sentence renders at a time — the one resting on more answered sessions, ties to the domain contrast |
| **ADR-0067** | The session row stores the **hour**, not a timezone. `session.started_at_local_hour`, migration `005` |
| **Reconciled** | `docs/sitemap-intent.md` S3 and two lines in `docs/build.md` still described a duration column, a top-domain column and a completion rate the surface lost on 2026-09-11. Corrected under ADR-0063 |

---

## 2. The timezone question, and why the answer is not a timezone

There is no timezone anywhere in this product and `session.started_at` is `timestamptz`, so any
server-side `extract(hour …)` buckets in UTC — which would state a confident regularity about the
person that is an artefact of server geography, the failure ADR-0053 exists to prevent.

The obvious fix is a `user_timezone` column. It was rejected. **`Europe/Lisbon` tells the server
roughly where the user lives; `9` does not**, and this schema stores hostnames and never full URLs
(ADR-0008), never reads page text (ADR-0061) and keeps paths on the device (ADR-0059). Per-session
capture is also right under travel and across a DST boundary, where a user-level column is not, and
ADR-0061 already has the judge reading time of day from local storage — so the fact is
client-supplied in the architecture that was already decided.

**The cost, which is real and is not a bug.** Every session written before migration `005` has a
null hour and is excluded. The time-of-day sentence therefore says nothing until eight answered
sessions have accumulated *after* this ships, however long the record already is — and because
ADR-0066 hands the single slot to whichever claim rests on more sessions, for the first weeks the
competition it describes is not one. Recorded in ADR-0066's Consequences and ADR-0067's.

**Release ordering.** `npm run migrate` is manual. Deploy the app before `005` applies and every
`POST /api/sessions` throws and `/dashboard` 500s. The note lives at the top of
`lib/migrations/005-local-hour.sql` because this repo has no deploy runbook; it belongs in one.

---

## 3. One behaviour change to code this branch did not set out to touch

`contrastByOutcome` picked the widest-gap domain and the page then gated on *that* domain's session
count — so a thin domain with a dramatic split silently suppressed a thick one that qualified.
`contrastByPartOfDay` shipped with the identical defect. ADR-0066 makes that selection load-bearing
(it decides which single sentence a user sees), so both were fixed: the modules rank, the caller
takes the first entry clearing the floor.

**Consequence: a domain sentence can now appear where none appears on `main` today.** Nothing else
on the branch changes existing behaviour.

---

## 4. Traps — what cost time here

1. **Tests that pass for the wrong reason recurred in every single task.** Four findings in Task 1,
   all in fixtures the plan supplied verbatim; three rewritten rows in Task 3; the CSS added in
   Task 3 was asserted by nothing at all until the review caught it. The plan's own Global
   Constraint — *ask what a test would do if the behaviour were deleted* — outranks its example
   fixtures, and that ruling had to be made three times. **Break the code and watch the assertion
   fail. A green test is not evidence.**
2. **The worst defect was invisible to per-task review.** The `localHour` write path
   (`extension/sw.js` → `normalizeStartPayload` → the route → the column) was covered by nothing:
   every e2e touching the time-of-day sentence seeds rows with raw SQL and bypasses it. Deleting
   `localHour` from the POST left 165 unit and 94 e2e tests green — and the failure mode is
   indistinguishable from the accepted "silent until eight sessions" state, so nobody would ever
   have noticed. `endedSession` now reads the row back.
3. **`e2e/fixtures.ts` gained `seededUser`**, which signs up, pairs, then writes sessions straight
   into `meant_test` through `testDatabaseUrlFrom` — the only way to cross the eight-session
   evidence floor, since `endedSession` makes a fresh account per call. It is additive;
   `e2e/session-recovery.spec.ts` still owns its own context and does not use it.
4. **The suite flaked once** (`e2e/popup.spec.ts`, twice in one chunked run) and passed 33/33 alone.
   The final chunked run was clean in one pass.
5. `.env.test` and a three-line `.env.local` had to be recreated in this worktree — the previous
   ones died with the last branch's worktree. Both must resolve to `/meant_test`; the main
   checkout's `.env.local` is production.

---

## 5. Decisions still waiting on the owner

| | |
|---|---|
| **#51 part 2** | The landing hero still asks for nothing. Untouched, deliberately |
| **#51 part 3** | 13 classes or 15. `.m-ledger-actions` and `.m-ledger-pattern` were added to the census as a fifth structural family, exactly as `.m-review-*` was. **The count is unchanged and no side was taken** |
| **`app/page.tsx:109`** | Still reads *"It reads the page. It stores nothing."* **ADR-0061 made that false.** Scoped out again |
| **#53's auth half** | `NEON_AUTH_BASE_URL` is still shared with production |
| **The purge** | `scripts/purge-test-rows.mjs` is still dry-run by default and still unrun — and this branch's e2e wrote 51-session fixtures into `meant_test` |

---

## 6. Deferred, small, and known

- The backlog query has no `ORDER BY`; `answerableBacklog` sorts on `endedAt`, and two identical
  `timestamptz` values would fall back to row order. Unreachable in practice, same class as the
  defect fixed in both contrasts.
- `docs/design.md` §6's surface table still calls `.m-ledger-pattern` a styled group; §5 and
  `docs/design-toolkit.md` §8 say correctly that nothing styles it — it is a marker class.
- `docs/index.md`'s D-table gained D66 and D67 — and D65, which the previous branch never registered and which adding the two new rows turned into a visible hole.
- The 51-row seed test makes ~53 sequential Neon round trips inside a 30s timeout. It passes; it is
  the first thing that will break if latency rises.
- The plan document still shows `PartOfDayContrast | null` in three places. Its own amendment
  supersedes that, and ADR-0063 makes the ADRs canonical anyway.

---

## 7. Verifying any of this

```bash
npm test                      # 169, expect 0 failures
npx tsc --noEmit              # expect 0 errors
npx playwright test e2e/a11y.spec.ts e2e/companion.spec.ts e2e/dashboard.spec.ts \
                   e2e/error-surfaces.spec.ts e2e/landing.spec.ts     # chunk 1 of 3, 34 tests
git log 1c3658e..HEAD         # 15 commits; the why is in the messages
```

Run e2e in chunks of five spec files — a single full run can be killed by system memory.
