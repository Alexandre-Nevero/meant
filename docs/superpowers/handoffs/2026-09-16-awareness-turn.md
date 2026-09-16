# Handoff — the awareness turn

**Written:** 2026-09-16 · **Branch:** `awareness-turn`, 25 commits, pushed, **PR #52**
**State:** 149 unit tests passing · **0 type errors** · working tree clean

This document is a pointer, not a duplicate. The decisions live in `docs/adr/`, the work lives
in the issues and the plans, and the reasoning lives in the commit messages — several of which
are the only place a particular finding is explained. Read the log before the code.

---

## 1. Read these first, in this order

| | |
|---|---|
| `docs/adr/ADR-0052` → `ADR-0064` | Fifteen decisions from this turn. **ADR-0063 makes `docs/adr/` outrank every other document** — where one disagrees with an ADR, the doc is stale |
| `AGENTS.md` → *Decisions* and *Work tracking* | The hard rules, and the GitHub Project conventions with the three rules that exist because they were broken |
| `docs/superpowers/plans/2026-09-15-foundations.md` | The near-term build plan. Week 2 builds, Week 3 verifies |
| `docs/superpowers/plans/2026-09-15-ui-refinement.md` | The UI plan, from a two-assessment critique |
| `git log main..HEAD` | 25 commits. The *why* is in the messages, not the diffs |

---

## 2. The one unresolved thread — start here

**The owner could not see the new navigation, and the diagnosis was cut short.**

What is known: the shell is built, renders correctly (verified by screenshot at 1440px and
390px), and is covered by no test. The browser session used for testing had **silently become
signed out** and landed on the marketing page, which correctly has no app shell. `curl` to
`/dashboard` returns **307**, consistent with no session cookie.

What is **not** known: whether the sign-out is benign (short session lifetime, a restarted dev
server) or a real defect that logs users out. **Do not assume benign.** `lib/auth/session.ts`
carries a comment explaining that `getSession()` throws in a plain Server Component rather than
reporting no session, and `currentUserId()` swallows that into `null`. The shell now calls it
from a **layout** — a call site that did not exist before this branch. That is the first
hypothesis to test, not a conclusion.

Reproduce: sign in at `/sign-in` with the seeded demo account (see §6), confirm the shell
appears, then determine what invalidates the session.

---

## 3. What changed about the product

Summarised only to orient you. The reasoning is in the ADRs.

- **The companion stopped signalling drift and became an input** (ADR-0057, ADR-0058). One tap,
  "this isn't the work". A self-report cannot be a false positive, which is why this replaces
  the signal rather than repairing it.
- **The judge moved after the session**, batched and on demand (ADR-0060), and **never reads
  page text or titles** (ADR-0061). That deleted an entire optional-permission flow — `UF4`,
  `E10`, `T16`, `T17`, PRD `Q4`/`Q7`/`Q9` and SDD `Q8` are all void, marked in place rather than
  removed.
- **Full visit paths live on the device only** (ADR-0059). `event.domain` stays hostname-only.
- **Labels are written per visit; memory forms only on repetition** (ADR-0062), never at n=1 —
  PRD §1.2's Instagram case is a domain that means opposite things at different hours.
- **Segments are deliberately unranked** (ADR-0054). Two of the five columns needed to rank them
  are empty and one is closable only by talking to people. Not choosing is the correct state.

---

## 4. Traps — things that will waste your time if nobody tells you

1. **The Impeccable detector returning `[]` means nothing for `.tsx` files.** It was sanity-checked
   against a file containing `#ff0000`, 10px type and `transition: all 0.3s` and still returned
   `[]`; most rules only run for full-page documents. Do not quote it as evidence of quality.
2. **`node --test` cannot resolve the `@/` alias.** Any module importing `@/…` is unreachable
   from a unit test — which is why pure logic lives in its own alias-free module. For a
   `lib/`→`lib/` value import use a relative path **with the `.ts` extension**;
   `allowImportingTsExtensions` is enabled for exactly this.
3. **`next dev` rewrites `AGENTS.md` and `next-env.d.ts` on every run.** Both are committed
   deliberately. Do not "clean up" the diff; it comes straight back.
4. **The e2e suite writes to production unless `.env.test` exists.** `playwright.config.ts` now
   refuses to start without it — that refusal is correct behaviour, not a failure. See
   `.env.test.example`; the database **name** must end `_test`, because a Neon branch inherits
   its parent's database name and would otherwise pass.
5. **`PRODUCT.md`'s "Status — what is actually built" section is stale.** It still describes the
   drift signal as live and 572 `memory` rows as meaningful. Both are false: the signal is
   deleted, and every one of those rows belongs to a test user.
6. **Issues #42–#51 are not on the project board.** They were filed but never added to
   Project 16. 41 issues are open; 30 are on the board.
7. **`Closes #40/#43/#44` in the commits has not fired.** GitHub only auto-closes on merge to
   the default branch, and this work is on `awareness-turn`.

---

## 5. Decisions waiting on the owner — do not make these unilaterally

| | |
|---|---|
| **Run the purge?** | `scripts/purge-test-rows.mjs` is **dry run by default**. It would delete 3,649 sessions, 5,481 devices, 5,481 pairing codes and 572 memory rows belonging to 5,823 test users, keeping 2 real ones. Irreversible, on production. Never run it with `--yes` without an explicit instruction |
| **Is MEANT light or dark?** (#51) | `design/tokens.css:54` applies a dark palette from `prefers-color-scheme` with no `data-theme` anywhere, while `design-toolkit.md` §9 refuses "dark mode as the default look" and `design.md` §3.1 says "nothing renders dark by default". Both false on a dark OS |
| **The landing hero asks for nothing** (#51) | `Landing.dc.html` specifies a primary "Add to Chrome" in the hero. What ships has **no CTA at all**, and pushes "Sign in" instead — asking a visitor to create an account before they have the extension |
| **The class contract** (#51) | §5 says 13 classes; the code ships 15 (`.m-chip`, `.m-chip-row`), plus the structural `.m-shell-*` added on this branch under the `.m-landing-*` precedent |
| **Q6, the free/paid boundary** | Still formally open, and **ADR-0054 is load-bearing on it**. Any answer that narrows the free tier re-creates the no-legal-buyer problem D10 exists to solve, and must re-open that ADR |

---

## 6. The demo account

A seeded account exists for looking at populated surfaces: **`e2e-demo@example.com`**.
**The password is not recorded here** — ask the owner, or delete the account and reseed.

It has 11 sessions built to exercise cases real data cannot: one with **zero events** (the band
fix), one **90 minutes long with 17 recorded** (the unrecorded-time line), and `chatgpt.com` in
10 sessions across both outcomes (the dashboard contrast line).

Its email matches the purge pattern, so `purge-test-rows.mjs` removes it with everything else —
no special handling, and **no reason to keep it** once the real account has data.

---

## 7. What to do next

**Immediately:** finish §2. An unexplained sign-out on a branch that added a new auth call site
is not something to leave open.

**Then, in order of consequence:**

1. **#42 — the setup page can destroy a user's site lists.** A failed fetch renders as "you have
   no sites"; the page is then editable, and saving replaces the stored list wholesale. This is
   the data ADR-0035 depends on and it only started persisting in #8. **The most damaging open
   bug.**
2. **#18's prerequisite** — create the Neon test branch so the e2e suite can run at all. Nothing
   on this branch has been verified in a browser except by screenshot.
3. **Week 2's remaining card and Week 3's verification batch** — see the foundations plan.

**Deliberately not next:** the judge (#22) and the coach (#26). `judgment` has zero rows,
`work_sites` only began persisting last week, and a coach built on eleven seeded sessions would
be confidently wrong about the owner in a way that is expensive to un-learn.

---

## 8. The number that should govern your judgment

**About 37 minutes of real observed browser attention exists, from one person.** Everything
strategic rests on that. Two claims that had been repeated for days turned out to be wrong when
queried — a pattern described as "n=5, clean split" was **n=2**, and "572 memory rows" are **all
test data**. Re-verify before citing. `docs/adr/ADR-0053` is the rule that came out of it: the
evidence bar scales with the cost of being wrong.

---

## 9. Suggested skills

| Skill | When |
|---|---|
| `impeccable` | **Mandatory for any UI work.** Run its `context.mjs` once per session. `critique` requires two isolated sub-agents; running them inline is a degraded run and must be declared |
| `emil-design-eng` | Motion decisions. `--m-ease` already matches its recommended curve; #50 lists what does not |
| `ui-ux-pro-max` | Accessibility and interaction specifics. It has a local searchable dataset — query one observable outcome at a time |
| `office-hours` · `plan-ceo-review` | Product and strategy questions. Both were used for the decisions in §3 |
| `writing-plans` | Implementation plans. Note it is an *implementation* skill — it is the wrong tool for planning strategy work |
| `ponytail` · `caveman` | Always on, per `GLOBAL.md` |

---

## 10. Verifying anything in here

```bash
npm test                      # 149, expect 0 failures
npx tsc --noEmit              # expect 0 errors
git log main..HEAD            # 25 commits, the reasoning is in the messages
node --env-file-if-exists=.env.local scripts/purge-test-rows.mjs   # read-only, deletes nothing
```

Database claims: query it directly, **read-only**, and delete any probe script immediately.
`.env.local` holds production credentials and must never be printed or committed.
