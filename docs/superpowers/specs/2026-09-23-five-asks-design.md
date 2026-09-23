# Five asks — design

- **Date:** 2026-09-23
- **Status:** Approved by the owner in a brainstorm on 2026-09-23. Each sub-project records its own ADR when its plan runs, not before (ADR-0063: an ADR records a decision already taken).
- **Base:** `origin/main` at `1cc490f` (the judge has merged; ADR-0080 is the newest ADR).

## The asks, as the owner wrote them

> try jev (should be added last because it depends whether or not the customers in apexhuman courses can understand using jev on their own), blocked site presets so users are blocked on those depending on the intention, multiple sessions being juggled — for example, one session can be paused and then switch to task 2 (researching) and then go back to task 1 (writing a letter), remove premium so we can show the whole product, labels of time on the popup and popup shows up after the session is done and asks.

"jev" is the judge; the owner confirmed it. "Labels of time" means the cycle presets: label `25/5` and `50/10` and add a cycle count before `custom`; the owner confirmed that too.

## What was already true before this design

- **Premium is already gone.** ADR-0075 (2026-09-22) suspends every paid feature for the testing phase. No code on `main` gates anything: no `isPaid`, no paywall, no tier column. No UI mentions pricing, trials or upgrades. The only work left is two stale sentences in docs.
- `extension/blocklists.js` holds three groups (social, video, news; 14 domains) that nothing reads.
- The extension keeps exactly one `session` storage key. `startSession` ends any running session as `superseded`. Nothing can pause.
- "Did you?" appears only when the user opens the popup (`pendingReview`). When a session elapses, nothing tells the user.
- The judge writes `judgment` rows and renders nothing (ADR-0073).

## Sub-projects and order

| # | Sub-project | Plan | Depends on |
|---|---|---|---|
| 0 | Premium: docs only | Plan A, Task 1 | — |
| 1 | Cycle labels, cycle count, session ends after last work block | Plan A | — |
| 2 | Popup opens itself at session end | Plan A | — |
| 3 | Intention presets (keyword first, AI fallback) | Plan B | — |
| 4 | Juggling: one session, many tasks | Plan C | Plan B (a new task takes its own preset) |
| 5 | Try the judge | none yet | ADR-0073's eval passing, plus the ApexHuman comprehension check |

Plans: `docs/superpowers/plans/2026-09-23-cycles-and-end-popup.md` (A), `…-intention-presets.md` (B), `…-task-juggling.md` (C).

---

## 0. Premium — docs only

No code. Reconcile two stale passages with ADR-0075, per ADR-0063 (say so, then reconcile): PRD §7.1 and the "Who pays" line in `PRODUCT.md`. Each gets one sentence that cites ADR-0075.

## 1. Cycle labels and cycle count

**Owner choices:** the count sits inside the preset row; a timed session ends after its **last work block**.

- The preset chips read `25 work · 5 break` and `50 work · 10 break`.
- Below them sits one row: a `× N cycles` stepper with `−` and `+` (1–8, default 1), then `custom`.
- The stepper applies to both presets and to custom "timed". It is hidden for "until I stop" and "no cycles".
- `plannedMinutes = count × work + (count − 1) × break`. **Behaviour change:** 25/5 ×1 is now 25 minutes, not 30.
- `cycle` gains `count`. The server stores nothing new, because `planned_minutes` already carries the length.
- A `lastChoice` saved before this change (no `count`, and `plannedMinutes = work + break`) restores as count 1 on the same preset.
- Static text only (ADR-0045): no ticking, no dial, no animation (the popup animates nothing).

**ADR:** cycle count added, and a timed session ends after its last work block. This amends ADR-0045's cycle semantics.

## 2. Popup opens itself at session end

**Owner choice:** open when the user comes back to Chrome, with a badge until answered.

- `chrome.action.openPopup()` has shipped for all extensions since Chrome 127 and needs no user gesture. Verified from the Chrome reference (`developer.chrome.com/docs/extensions/reference/api/action#method-openPopup`) and from Chrome's behaviour table in w3c/webextensions#160 (Chrome 143, January 2026). It only opens into the active, focused window. Otherwise it rejects with "Could not find an active browser window."
- On an `elapsed` end, the service worker sets `askPending` and calls `openPopup()`. On success it clears `askPending`. If it fails, a `chrome.windows.onFocusChanged` listener tries again the next time a Chrome window gains focus.
- Both `stopped` and `elapsed` set the badge text `?`. No badge colour is set: the badge API takes a literal colour value and the service worker cannot read `tokens.css`, so Chrome's default stays (no hex in code). The badge is cleared wherever `pendingReview` is removed.
- The popup opens straight to the existing `outcome()` screen. No animation.

**ADR:** the popup opens itself once, at elapsed end, and on the next window focus if it could not.

## 3. Intention presets

**Owner choices:**
- keywords first; if none match, the AI classifies the intention into one preset from the fixed list;
- block set = own list ∪ preset `block` − preset `allow`;
- presets live in a fixed, shipped file (T3, provided to students).

- **Presets** live in `PRESETS` in `extension/blocklists.js`: `writing`, `research`, `study`, `admin`. Each has `label`, `keywords`, `block` and `allow`. File order is priority order.
- **Matching** (`matchPreset`): lowercase the intention, split on anything that isn't a letter or digit, and return the first preset with a keyword among the words. English only; this limit is stated.
- **Block set** (`presetBlockSet`): (standing distract list ∪ `preset.block`) − `preset.allow` − the selected work sites − any blocked site the intention names.
  - "Names" means the domain's site name, e.g. `instagram` for `instagram.com` or `ycombinator` for `news.ycombinator.com`, appears as a word in the intention. Names of fewer than 3 letters never match.
  - **This rule goes beyond the Q&A** and protects the product's defining case: a freelancer who types "schedule instagram posts" matches `admin`, but must not get Instagram blocked.
- **AI fallback:**
  - `POST /api/presets/classify {intention}`, using `openai/gpt-oss-20b` with Groq strict structured output (the enum of preset ids plus `none`). The 20b model supports `strict: true` (Groq docs, `console.groq.com/docs/structured-outputs`).
  - The model string differs from the coach's and the judge's (`openai/gpt-oss-120b`), so neither of their daily-cap queries ever counts a classify call. It gets its own daily cap, which is cost control, not a paywall (ADR-0075), and each call is recorded in `inference_call`.
  - No key, offline, an error or the cap all return `{preset: null}`.
- **Popup behaviour:**
  - The keyword match runs on every keystroke.
  - The AI runs 800 ms after typing stops, only when no keyword matched, the trimmed intention has at least 3 characters and the device is paired. It runs once per distinct intention text.
  - Chips pre-fill until the user toggles a chip by hand; after that nothing moves them.
  - A meta line names the preset ("Writing preset").
  - If no preset matches, today's behaviour is unchanged (`lastChoice`, or the standing list).
  - The standing list is never written to.
- **Nothing waits on a model:** Start never blocks, and a late answer is ignored.

**ADR:** the intention picks a preset by keyword; the AI only classifies into the fixed list; presets may add blocks. This settles ADR-0046, which was Proposed and never Accepted.

## 4. Juggling — one session, many tasks

**Owner choices:**
- the UI is one session with a task list and a Switch action;
- blocks follow the active task;
- storage is task = `session` row, grouped by a shared `block_id`.

- **Rows.** Each task is an ordinary `session` row, and every task in a block carries the same `block_id` (the first task's id). Old rows have `block_id` null. Review, "Did you?", events, the judge, the coach and the unanswered backlog already work per row, so each task stays individually answerable and judgeable.
- **Time.** Every task in a block shares the block's `startedAt`, `plannedMinutes` and `cycle`, both locally and in the server row. So elapsed time, cycle phase, the block page's "minutes left" and the auto-end all keep working unchanged.
  - A task's intention lock (ADR-0041) runs from its own `lockFrom` instead.
  - Time a task spends inactive, including the time before it was added, is recorded as a new event kind, `paused`. `computeUnrecorded` counts `paused` as accounted for, so the review never calls it "outside the browser".
- **Extension storage.** `session` stays the **active** task, so every listener, `transition`, the companion, `blocked.js`, the path log and the judge client keep working unchanged. A new `block` key holds `{ id, tasks: [inactive task snapshots, each with pausedAt] }`.
- **Add task (at most 4 per block):**
  - Close the active slice, create a task row (same `startedAt`, new `lockFrom`), and queue its pre-creation `paused` event.
  - Its block list is `presetBlockSet(...)` when its intention matches a preset (Plan B). Otherwise it inherits the current task's block list.
  - Swap the block rules to the new task's list and make it active.
- **Switch:** close the active slice, park the active task with `pausedAt = now`, queue one `paused` event for the resumed task (`now − its pausedAt`), swap the block rules, and seed attention.
- **End** (stop, elapsed or recovery): every task row ends with the same `endedAt` and `endReason`, and each inactive task gets a closing `paused` event. `pendingReview = { sessionId: active, sessionIds: [all] }`.
- **No separate pause button.** Switching is the pause, and `chrome.idle` already covers stepping away. (Owner may overrule.)
- **Popup:**
  - Running view: the active task on top, then one row per other task with its minutes and a `switch` chip, plus `+ task` and Stop.
  - Outcome view: one block per task, each with identical Yes / Not yet buttons (colour, weight, size, motion).
- **Web:**
  - `/review/[id]` lists the other tasks in the block as links, plus one sentence with the minutes spent on them.
  - The ledger timeline merges a block's rows into one bar, and dashboard session counts count distinct `coalesce(block_id, id)`.
  - Time sums are per event and don't change. Outcome figures stay per task, since each task has its own answer.

**ADR:** a session may hold several tasks, stored as grouped session rows sharing the block's clock, and blocking follows the active task.

## 5. Try the judge — design only, no plan yet

**Owner choice:** keep ADR-0073.
- **What "try the judge" means:** an action that runs `/api/judge/analyze` for one session and shows verdicts at or above `PROVISIONAL_MIN_CONFIDENCE`. `unknown` renders nothing (ADR-0037).
- **Blocker found while designing:** the paths the judge needs live only in the extension (ADR-0059). The web review page cannot reach the extension without `externally_connectable`, which ADR-0042 refused. So the action must live in the popup's outcome view, or a new ADR must accept `externally_connectable`. The judge's own spec decides.
- **It ships only after two things:**
  1. the-real-eval measures precision on the hand-labelled set;
  2. ApexHuman students, alone, can use it without help (the owner's condition).

## Invariants every plan must hold

- `Yes` and `Not yet` identical in every property. The popup animates nothing. Nothing good happens on screen during a session. No hex in a component (`design/tokens.css` only). Away is a hatch, never solid grey. The class contract is frozen: new shapes use `data-*` attributes, never a new class.
- No path ever reaches the database or a log line (ADR-0059). Error logs print status codes and error names only.
- TDD. Definition of done: `npm test`, `npx tsc --noEmit`, `npm run test:e2e` all pass, plus a real-browser check with screenshots (`meant-qa`).
- Every PR links a GitHub Project 16 issue. No AI attribution in commits or PR bodies.
