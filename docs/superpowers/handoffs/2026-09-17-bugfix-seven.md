# Handoff — the seven defects

**Written:** 2026-09-17 · **Branch:** `worktree-bugfix-seven`, 23 commits, **not pushed**
**State:** 149 unit tests passing · **0 type errors** · 87 e2e, every one green individually
**Plan:** `docs/superpowers/plans/2026-09-16-bugfix-seven.md`

A pointer, not a duplicate. The decisions are in `docs/adr/`, the reasoning is in the commit
messages, and several findings are explained only there. Read `git log 1412b9c..HEAD` before the
code.

---

## 1. What landed

Seven filed defects plus one found while unblocking the suite.

| | |
|---|---|
| **#42** | **P1, data loss.** `/setup` caught every read failure into an empty list, told the user they had configured no sites, and stayed editable from that fabricated state — so one added site replaced the real list wholesale. Loading, ready and failed are now three states; the failed one renders nothing editable, so there is nothing to save over |
| **#45** | The review's closing question was listed in a flat 24px column. It is now staged — `.m-review-ask` at `margin-top: auto` against a filled fold, rows grouped at `gap: 0`, per `design/canvas/Main.dc.html:23,47,59` |
| **#46** | No `error.tsx`, `not-found.tsx` or `global-error.tsx` existed anywhere. Failure dropped the user onto Next's stock page. `[role="alert"]` is now the product's one error treatment |
| **#47** | The outcome PATCH never checked `res.ok`, so a failed write left both buttons disabled forever with no message. Retry is the same two buttons — a third control would break I1 |
| **#48** | `.m-rise` was defined and used nowhere while three documents claimed the review animates. Wired, stepped off the existing `--m-stagger` |
| **#49** | Five inputs, no labels; no `<main>` on `/` or `/sign-in`; one-word metadata |
| **#50** | The companion carried a dead drift rule, a receipt mistimed at 600ms, and no receipt at all under reduced motion |
| **#51 part 1** | **ADR-0065** — MEANT is a cream product; dark is a fallback, not a second look |
| **#53** | **Filed during the run.** See §2 |

The seven `Closes` lines fire only on merge to the default branch. **Nothing is pushed** —
`origin/main` is still `ec41f70`, including the two documentation commits already on local `main`.

---

## 2. #53 — the thing that was not on the list

`extension/api.js:1` defaults `apiBase` to `http://localhost:3000`. The e2e suite's own server has
been on **3100** since #18, and nothing seeded that key — so every write the **extension** made
(session creation, event flush, pairing claim) went to whatever was listening on `:3000`. On a
developer machine that is `next dev` from the main checkout, reading `.env.local`. **That is
production.**

#18 guarded the Next server the suite *starts* and the database it reads. The extension is a
separate origin and was never in scope. The database guard cannot see it, because the extension
never touches the guarded process.

**No production rows were written** — verified read-only immediately: sessions, devices and events
created in the previous three hours were all `0`. It failed safe *by construction, not by design*:
the device token is minted against `meant_test`, so `deviceFromRequest` finds no matching
`token_hash` in production, returns 401, and the extension clears the token instead of writing. A
code path that authenticated some other way would not have been lucky.

Fixed at three sites, all in `e2e/`, no production code changed. **`NEON_AUTH_BASE_URL` is still
shared with production** — e2e signups create real auth users in that project even though the
database is `meant_test`. Pre-existing, out of scope, and the remaining shared surface. #53 is left
**open** deliberately for that half.

---

## 3. Traps — things that will waste your time if nobody tells you

1. **Tests here assert existence far more readily than behaviour.** This is the defect class of the
   whole branch; it recurred **six times**. A visibly broken attention band — 34×16 instead of
   840×32, on the product's most important page — passed **nine green tests**, because nothing
   asserted rendered size. Four more were assertions that could never fail: Next's App Router mounts
   its own `role="alert"` announcer so an unscoped `getByRole('alert')` always matches two elements;
   `answer()` clears its alert synchronously *before* awaiting the fetch, so reading the outcome back
   after the click races the write; React 19 injects `$ACTION_*` hidden inputs into server-action
   forms, so a raw `input` count is never 5; and `landing.spec.ts`'s `toHaveCount(0)` would have
   passed **vacuously** once the placeholders it counted stopped existing anywhere.
   **When you add a test here, ask what it would do if the behaviour were deleted.**
2. **A full `npx playwright test` can be killed by system memory.** Each spec file launches its own
   persistent Chromium with an unpacked extension; 15 files at once is the spike. Run it in chunks of
   five. This is a workaround, not a masking — every test passes.
3. **The suite flakes under load, and the set varies.** 4 of 87 on the last chunked run, 5–6 of 72 on
   the recorded baseline. Every one passes in isolation. Re-run a failure individually before
   believing it. `retries: 1` is the named remedy if you ever want deterministic full runs; it is
   deliberately not set, because it would mask a real regression as "flaky".
4. **`e2e/session-recovery.spec.ts` is the one spec outside `e2e/fixtures.ts`.** It owns its context
   so it can close and relaunch Chromium against one profile dir, which means no shared fixture runs
   for it. Anything you add to the fixture must be added there too — that is how half of #53 hid.
5. **Playwright cannot click `.dot` on the companion.** It carries `animation: breathe 1.6s infinite`,
   and actionability waits for an element to stop moving, so an infinite animation never stabilises.
   Click `.dot-wrap`, which is what carries the pointer handlers anyway. Until this was fixed,
   **ADR-0058's one-tap label had never been verified end to end.**
6. **`next dev` still rewrites `AGENTS.md` and `next-env.d.ts`, and `predev` rewrites
   `extension/tokens.css`.** All three are committed deliberately. But `extension/tokens.css` is
   *generated* from `design/tokens.css` — if you edit the source, run `npm run tokens` and commit the
   result, or the committed copy goes stale.
7. **This repo's commit subjects run long** — median 78 characters, p90 107, 50 of the last 80 over
   72. That is the convention; do not "fix" it to a generic limit.

---

## 4. Decisions still waiting on the owner

| | |
|---|---|
| **#51 part 2** | The landing hero asks for nothing. `Landing.dc.html` specifies a primary "Add to Chrome"; what ships has no CTA and pushes "Sign in" instead — asking a visitor to create an account before they have the extension |
| **#51 part 3** | 13 classes or 15. The census in `docs/design.md` §5 and `docs/design-toolkit.md` §8 now correctly lists **four** structural families — this branch added `.m-review-rows` / `.m-review-ask` under the `.m-landing-*` precedent and said so, without picking a side |
| **`app/page.tsx:109`** | Still reads *"It reads the page. It stores nothing."* **ADR-0061 made that false.** It is the most prominent stale claim in the product and was scoped out of this branch deliberately. It is *not* in the metadata description — that was checked |
| **#53's auth half** | Whether the shared `NEON_AUTH_BASE_URL` is worth its own fix |
| **The purge** | `scripts/purge-test-rows.mjs` is still dry-run by default and still unrun |

---

## 5. What is now verifiable that was not

The e2e suite could not run at all before this branch — #18 left it needing a Neon test branch that
did not exist. It exists now (`e2e` / `meant_test`), `.env.test` is local and gitignored, and the
worktree's own `.env.local` holds **only** the two `NEON_AUTH_*` keys plus the test database URL, so
nothing in it can reach production.

Consequences worth knowing: **ADR-0058's tap, ADR-0057's absent drift state, the reduced-motion
receipt, the review's staging and its stagger are all now covered by tests that fail if the
behaviour is removed.** Before this branch, none of them were.

---

## 6. Verifying anything in here

```bash
npm test                      # 149, expect 0 failures
npx tsc --noEmit              # expect 0 errors
npx playwright test e2e/a11y.spec.ts e2e/companion.spec.ts e2e/dashboard.spec.ts \
                   e2e/error-surfaces.spec.ts e2e/landing.spec.ts     # chunk 1 of 3, 24 tests
git log 1412b9c..HEAD         # 23 commits; the why is in the messages
```

Database claims: query it directly, **read-only**, and delete any probe script immediately.
The main checkout's `.env.local` holds production credentials and must never be printed or
committed.
