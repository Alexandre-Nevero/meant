# ADR-0084 — One session can hold several tasks; each task is a session row, and blocking follows the active one

- **Date:** 2026-09-23
- **Status:** Accepted
- **Context:** Owner request 2026-09-23: "multiple sessions being juggled — one session can be
  paused and then switch to task 2 (researching) and then go back to task 1 (writing a letter)."
  The extension keeps exactly one `session` storage key, `startSession` ends any running session as
  `superseded`, and nothing can pause. The owner chose, in order:
  1. one session holding many tasks, over separate sessions;
  2. blocks that follow the active task;
  3. of two storage models, the one with the smaller blast radius.
- **Decision:**
  - **Storage.** Each task is an ordinary `session` row. Every task in one session shares
    `session.block_id`, the first task's id; a single-task session is a block of one. Every task
    shares the block's `started_at`, `planned_minutes` and cycle.
  - **Time.** Time a task spends inactive — including the time before it was added — is recorded
    as a `paused` event. `computeUnrecorded` counts `paused` as accounted for, so it is never
    reported as time outside the browser.
  - **Extension.** The `session` storage key stays the active task. A `block` key parks the
    others, each with its `pausedAt`.
  - **Actions.** Adding or switching swaps the block rules to the target task's list. There are
    at most four tasks, and no separate pause control: switching is the pause, and `chrome.idle`
    already covers stepping away.
  - **End.** Every task row ends together, and each is asked "Did you?" on its own.
  - **Intention lock.** A task's intention locks 60 seconds after its own creation (ADR-0041,
    applied per task).
- **Consequences:**
  - Review, outcome, events, the judge (per-row intention) and the unanswered backlog need no
    change: each task is independently answerable and judgeable.
  - The ledger timeline and the dashboard's session counts must group rows by `block_id`, or one
    session would draw as several overlapping bars. Outcome figures stay per task, because each
    task has its own answer.
  - `block_id` is client-supplied. Every query that reads it also filters by `user_id`, so a
    forged value can only group the caller's own rows.
  - A browser restart still ends everything (`recoverStaleSession`), paused tasks included.
- **Source:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §4; owner brainstorm 2026-09-23.
