# Handoff — MEANT 0.2 drift-and-cycles build

**Written:** 2026-09-04, at the end of the planning-and-Task-1 session.
**Read this first, then the plan.** Everything here was verified against the working tree at the
moment of writing, not recalled.

---

## 1. Where the work is

| | |
|---|---|
| **Worktree** | `~/orca/projects/focus/.claude/worktrees/drift-and-cycles` |
| **Branch** | `worktree-drift-and-cycles` |
| **HEAD** | `e55422d` |
| **Base** | `66cd8ee` (`origin/main`, identical to local `main` when the worktree was cut) |
| **Plan (canonical)** | `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` — committed, in the worktree |
| **Ledger** | `.superpowers/sdd/plan-deeply-how-to-refactored-wand/progress.md` |

**Work in the worktree, not the main checkout.** The main checkout is on `main` and does not have
this branch's code. There is an untracked convenience copy of the plan at
`~/orca/projects/focus/docs/superpowers/plans/2026-09-04-drift-and-cycles.md` so it is visible in
an editor opened on the main checkout; the worktree copy is the source of truth. Re-copy it there
after editing the plan, or the two drift.

**⚠️ `.superpowers/` is VCS-ignored.** The ledger and all task briefs die if the worktree is
removed or cleaned. This handoff and the plan's own `## Progress` section are the durable record;
the ledger is the detailed trace on top. Do not treat the ledger as safe storage.

---

## 2. State

**Two commits, working tree clean, 11/11 tests passing.**

| Commit | Contents |
|---|---|
| `7c19205` | `extension/lib/attribution.js` (35 lines) + `test/attribution.test.js` (11 tests) + `extension/package.json` + `"test"` script. +141/−0 |
| `e55422d` | The plan, 2,981 lines |

**Task 1 of 20 is complete. Nothing in the running extension has changed.** `extension/sw.js`
still uses the original `attribute()` (line ~180) and `settleFocus()` (line ~202). The new module
is tested but not called from anywhere — `grep -n "attribution" extension/sw.js` returns nothing.

**Next: Task 2.** It wires the module in and adds `chrome.idle` away-detection. It is the first
task with a visible behaviour change, and its verification is physical: start a session, lock the
screen ~70 seconds with Chrome focused, stop, read the review. Today that time is credited to
whatever tab was open; after Task 2 it reads `away`.

---

## 3. Environment facts that are expensive to rediscover

Each of these cost real time to find. None is guessable.

| Fact | Consequence |
|---|---|
| **Node is v26.3.0** | `node --test test/` **crashes** — Node executes the directory argument as a test file and dies `MODULE_NOT_FOUND`. The script is bare `node --test`. Do not "fix" it by adding the path back. |
| **`.env.local` is VCS-ignored** and was copied into the worktree by hand | Without it `npm run build` fails at `/api/sessions/[id]/outcome` with *"Missing required config: cookies.secret"*. If the worktree is recreated, copy it from the main checkout again. |
| **The worktree needs its own CodeGraph index** | Already built (`codegraph init .`, 33 files / 205 nodes). Without it the session hook serves symbols and blast-radius from the **main checkout** — wrong branch, stale data. If CodeGraph output warns about a different worktree, re-run `codegraph init .`. |
| **The Bash guard in this worktree refuses compound commands, heredocs, and variable-named commands** | Run one plain command at a time. For multi-line file writes use the Write/Edit tools, or write a script to the scratchpad with Write and then run it with a single plain `python3 <path>`. |
| **`extension/package.json` is `{"type":"module"}`** and the root `package.json` has **no** `"type"` | Extension files are ESM; the root is not. Adding `"type"` at the root changes how Next.js treats the whole app. Leave both alone. |
| **DB tables that exist right now** | `device`, `pairing_code`, `session`, `event`. Task 4 adds `judgment`, `memory`, `_migration` and several columns. |
| **All task briefs currently on disk are STALE** | The plan was edited after they were generated. **Regenerate every brief before dispatching it.** |

---

## 4. Process rules adopted during Task 1 — keep them

1. **Fix rounds get their own commits.** Do not `--amend` them into the task commit. Amending
   makes the pre-fix SHA a non-ancestor, so `review-package FIX_BASE HEAD` yields nothing and the
   scoped re-review has to be hand-assembled. Separate commits also preserve the fix history that
   `context.md` §7 rule 10 wants for the rebuild manual's troubleshooting chapter.
2. **Verify a patch with `grep`, never a script's own success message.** A Python script whose
   `write_text()` sits after its assertions silently discards every earlier edit when a later
   assertion throws. This happened, and I reported two fixes as applied when they were not.
3. **Verify agent claims independently before acting on them.** Every agent in this build has
   been right about something and wrong about something. The implementer caught bad arithmetic in
   the plan; the reviewer caught a stale brief; and the reviewer's one Important finding was
   over-escalated and correctly adjudicated as not-a-defect after tracing it by hand.
4. **No AI or assistant attribution in any commit message.** No `Co-Authored-By`, no "Generated
   with", no mention of an assistant. Absolute, every commit, every repo.
5. **Implementers must stay in scope.** Task 1 was told not to touch `sw.js`; it did not. If an
   implementer edits files outside its brief's file list, send it back.
6. **Commit only when asked**, except the per-task commits the plan itself specifies.

---

## 5. The plan's own shape

Read `## Progress` (line ~25) before the task bodies. It carries the task status table, what Task
1 shipped, the six plan defects executing Task 1 exposed, and these process rules.

Every task declares **Consumes / Produces**. That block exists because the plan originally had
five forward references — tasks calling code that later tasks create — which would each have
shipped an extension importing a missing module. The dependency graph is now verified acyclic and
strictly ordered; a checker lives at
`/private/tmp/claude-501/.../scratchpad/checkdeps.py` (ephemeral — rewrite it if the plan changes
substantially, it is ~30 lines that parse `Consumes` blocks for `(Tn)` refs and assert `n < N`).

**Two tasks stop for human sign-off by design:** Task 6 and Task 16 both change
`design/canvas/*.dc.html`, and the design canvas outranks the plan. Do not write popup code in
those tasks before the artboard is agreed.

---

## 6. What still needs a human, and cannot be delegated

| Gate | Task |
|---|---|
| Artboard sign-off for the popup's two new rows | **6**, **16** |
| An `AI_GATEWAY_API_KEY`, and confirming zero-data-retention on the gateway project | **12** |
| Agreeing the 60 labelled eval cases (what counts as `serves` / `drifts` / `unclear`) | **15** |
| A real 25-minute screen recording of the companion, watched back | **20** |
| Physical browser checks: screen lock, badge, block page, permission grant | **2, 7, 8, 10** |

---

## 7. Two spikes still unresolved, both in Task 7

Both are timeboxed and both have a stated fallback in the plan. Neither is verified.

1. **`chrome.permissions.request({origins})` from a popup may never resolve** — the popup's
   context is destroyed when the prompt opens. Reported behaviour is that requesting *permissions*
   works but requesting *origins* hangs, and origins is exactly what a user-added blocked domain
   needs. 10-minute spike. Fallback (and the plan's default): request from a full extension page
   in a tab.
2. **Whether `web_accessible_resources.matches: ["<all_urls>"]` adds an install-time warning.**
   WAR is not a permission, so it should not. 5-minute check: set it, reload unpacked, read the
   prompt. Fallback: keep the static 13-domain list and block user-added domains with
   `action: "block"` (Chrome's error page instead of the MEANT block page).

Record both results in `docs/dead-ends.md` either way — `context.md` §7 rule 10.

---

## 8. Three things flagged for the owner, not solved by this plan

1. **"Did you finish it?" does not fit a learning intention.** You cannot finish "learning how to
   harness engineering." The answer goes soft, and it lands in the same completion rate as a
   freelancer answering about a finished deck. The product's one accumulating number gets mushier
   the more it is used for learning — which is the owner's own primary use case.
2. **The blocked-list mismatch is visible but unacted-on.** Task 19 fixes it prospectively (the
   model carves out today's relevant sites). Nothing tells you *afterwards* that you picked the
   wrong list — three blocked attempts on `x.com` during a learning session is a real signal. The
   data is there (`block_hit` rows plus the intention); acting on it is the coach's job
   (`PRD-F12`), out of scope.
3. **`PRD-F15` (forget what you know about me / delete my account) remains unbuilt**, and this
   plan makes the obligation larger: `memory` will hold four counts per domain plus two standing
   lists, and it deliberately does not cascade from `session`.

---

## 9. Exact next action

```bash
cd ~/orca/projects/focus/.claude/worktrees/drift-and-cycles
npm test          # expect 11/11 — confirms you are in the right place and nothing rotted

# regenerate the brief (the one on disk is stale)
~/.claude/skills/subagent-driven-development/scripts/task-brief \
  docs/superpowers/plans/2026-09-04-drift-and-cycles.md 2

git rev-parse HEAD     # record as BASE before dispatching the implementer
```

Then dispatch a Task 2 implementer per `superpowers:subagent-driven-development`: fresh subagent,
brief path in the prompt, report file alongside it, Sonnet, then the task review, then the fix
loop if needed.

**Task 2's two subtleties, both already in the plan but easy to lose:**

- `chrome.idle.onStateChanged` fires **on transitions only**, and `locked` can arrive with no
  prior `idle` *(verified against developer.chrome.com)*. That is why Step 3 uses an exhaustive
  pure `idleMode(idleState, audible)` that fails safe to `'away'`, and why **Step 3b's `TICK`
  re-check is not optional** — without it, an idle-but-audible tab would accrue attention forever
  once the audio stopped, which is the phantom-attention bug the whole task exists to remove.
- `transition()` must stay **self-contained**. It does not call `cyclePhase` (Task 8) or
  `evaluate` (Task 10). Those tasks insert their own lines. After Task 2 the extension must load
  and track correctly on its own.
