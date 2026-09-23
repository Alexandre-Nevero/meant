# Task Juggling — Implementation Plan (Plan C of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One running session can hold up to four tasks. The user adds a task ("research sources") while in another ("write the letter"), switches between them in one tap, and blocking follows whichever task is active. At the end, each task is asked "Did you?" on its own.

**Architecture:**
- **Storage (server).** Each task is an ordinary `session` row. Every task in one session shares a new `block_id` (the first task's id), so review, outcome, events, the judge, the coach and the unanswered backlog keep working per row, unchanged.
- **Time.** Every task in a block shares the block's `startedAt`, `plannedMinutes` and `cycle`, so elapsed time, cycle phase, `blocked.js`'s "minutes left" and the auto-end all keep working unchanged. Time a task spends inactive is recorded as a new event kind, `paused`.
- **Storage (extension).** The `session` key stays the **active** task, so every listener, `transition()`, the companion, the path log and the judge client need no change. A new `block` key holds the parked tasks.
- **Logic.** A pure reducer, `extension/lib/block.js`, owns the add, switch and end arithmetic; `sw.js` applies its side effects (rules, events, network).

**Tech Stack:** plain ES-module MV3 extension · Next.js 16 · Neon Postgres (numbered migrations, `lib/migrate.mjs`) · `node --test` · Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §4.

## Global Constraints

- **Prerequisites: Plan A and Plan B are merged to `main`.** This plan edits `endSession`'s tail as Plan A left it (badge + `askOutcome`), `clearPending()` in the popup (Plan A), and uses `PRESETS` / `matchPreset` / `presetBlockSet` (Plan B). Branch off an `origin/main` that contains both. Check with `grep -n "askOutcome" extension/sw.js && grep -n "presetBlockSet" extension/lib/presets.js`; both must match.
- **ADR number: 0084. Migration: `lib/migrations/008-task-blocks.sql`.** Before Task 1, run `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -3 && ls lib/migrations/`. If 0084 or 008 is taken, use the next free number everywhere below.
- **`docs/adr/` is canonical (ADR-0063).** Append-only; one decision per file.
- **TDD is mandatory.** Definition of done: `npm test`, `npx tsc --noEmit`, `npm run test:e2e` all pass.
- **Migrations are manual and precede the deploy** (see `lib/migrations/005-local-hour.sql`'s header). For e2e, apply to the test database: `node --env-file=.env.test lib/migrate.mjs`.
- **Invariants:** `Yes` and `Not yet` identical in every property, including across tasks. The popup animates nothing. No hex in code. The class contract is frozen: new shapes use `data-*` attributes (`data-row="task"`, `data-compact`). Away stays a hatch.
- **ADR-0041 still holds per task:** a task's intention is editable for 60 s from its own `lockFrom`, then locks.
- **ADR-0059:** no path in the database or a log.
- **`extension/lib/*.js` is pure; `lib/*.ts` has no `@/` imports.**
- **Every PR links a GitHub Project 16 issue. Never add AI or assistant attribution to a commit or PR.**

## File map

| File | Change | Responsibility |
|---|---|---|
| `docs/adr/ADR-0084-one-session-many-tasks.md` | Create | Records §4 |
| `extension/lib/block.js` | Create | `MAX_TASKS`, `pausedEvent`, `addTask`, `switchTask`, `closingEvents`, `attendedSeconds` |
| `test/extension-block.test.js` | Create | Unit tests for the reducer |
| `lib/migrations/008-task-blocks.sql` | Create | `session.block_id` + index |
| `lib/session-payload.ts` | Modify | `blockId` |
| `test/session-payload.test.js` | Modify | `blockId` cases |
| `app/api/sessions/route.ts` | Modify | Insert `block_id` |
| `app/api/events/route.ts` | Modify | `KINDS` gains `'paused'` |
| `test/event-kinds.test.js` | Modify | The route accepts `paused` |
| `lib/session-time.ts` | Modify | `paused` counts as accounted |
| `test/session-time.test.js` | Modify | `paused` case |
| `extension/sw.js` | Modify | `blockId`/`lockFrom`/`block` at start, `swapRules`, `addTaskToSession`, `switchToTask`, multi-task `endSession`, recovery, messages |
| `extension/api.js`, `extension/popup.js` (Disconnect) | Modify | Clear `block` wherever `session` is cleared |
| `extension/popup.js` | Modify | Running view (other tasks, `+ task`, per-task lock), `outcomeMany`, `render` |
| `extension/meant.css` | Modify | `.m-row[data-row="task"]`, `.m-sentence[data-compact]` |
| `lib/review-data.ts`, `app/review/[sessionId]/page.tsx` | Modify | `pausedSeconds`, `siblings` |
| `lib/dashboard-figures.ts`, `test/dashboard-figures.test.js` | Modify | `sessionKey`, `countSessions`, timeline merge, per-day distinct counts |
| `app/dashboard/page.tsx`, `app/ledger/page.tsx` | Modify | Select `s.block_id`; count with `countSessions` |
| `e2e/juggle.spec.ts` | Create | End-to-end cases |

---

### Task 1: The pure reducer, and the ADR

**Files:**
- Create: `docs/adr/ADR-0084-one-session-many-tasks.md`
- Create: `extension/lib/block.js`
- Test: `test/extension-block.test.js`

**Interfaces:**
- Consumes: `emptySlice(at)` from `extension/lib/attribution.js` (returns `{ domain: null, since: at, mode: 'attention', awayCarryMs: 0 }`).
- Produces (Tasks 3 and 4 import these):
  - `MAX_TASKS = 4`
  - `pausedEvent(sinceMs: number, atMs: number): { kind: 'paused', domain: null, seconds: number, at: string } | null`. Whole seconds; `null` when under one second.
  - `addTask(block, active, task, atMs): { block, active, paused } | null`. `null` when the block is full. `paused` covers `task.startedAt` (the block's start) up to `atMs`.
  - `switchTask(block, active, targetId, atMs): { block, active, paused } | null`. The resumed task gets a fresh `slice`/`dwellSince` and loses `pausedAt`. `null` for an unknown target.
  - `closingEvents(block, atMs): { sessionId, event }[]`. One `paused` event per parked task.
  - `attendedSeconds(task): number`. The sum of `task.tally.attention`.
  - Shapes: `block = { id: string, tasks: Task[] }`; a parked `Task` is a full session object plus `pausedAt: number`.

- [ ] **Step 1: Confirm numbers, then write the ADR**

Run: `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -3 && ls lib/migrations/`

Create `docs/adr/ADR-0084-one-session-many-tasks.md`:

```markdown
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
```

- [ ] **Step 2: Write the failing tests**

Create `test/extension-block.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_TASKS, pausedEvent, addTask, switchTask, closingEvents, attendedSeconds } from '../extension/lib/block.js'

const T0 = Date.parse('2026-09-23T10:00:00.000Z')
const task = (id, extra = {}) => ({
  sessionId: id,
  intention: id,
  startedAt: new Date(T0).toISOString(),
  tally: { attention: {}, away: 0, break: 0 },
  slice: { domain: null, since: T0, mode: 'attention', awayCarryMs: 0 },
  dwellSince: T0,
  ...extra,
})

test('a block holds at most four tasks', () => {
  assert.equal(MAX_TASKS, 4)
})

test('pausedEvent is whole seconds, and nothing for under one second or a negative span', () => {
  assert.deepEqual(pausedEvent(T0, T0 + 90_500), { kind: 'paused', domain: null, seconds: 90, at: new Date(T0 + 90_500).toISOString() })
  assert.equal(pausedEvent(T0, T0 + 999), null)
  assert.equal(pausedEvent(T0 + 5_000, T0), null)
})

test('addTask parks the active task and accounts the new one\'s time since the block began', () => {
  const at = T0 + 600_000
  const out = addTask({ id: 'a', tasks: [] }, task('a'), task('b'), at)
  assert.equal(out.active.sessionId, 'b')
  assert.deepEqual(out.block.tasks.map((t) => [t.sessionId, t.pausedAt]), [['a', at]])
  assert.equal(out.block.id, 'a')
  assert.equal(out.paused.seconds, 600)
})

test('addTask refuses a fifth task', () => {
  const full = { id: 'a', tasks: [task('b'), task('c'), task('d')] }
  assert.equal(addTask(full, task('a'), task('e'), T0 + 1000), null)
})

test('switchTask resumes the target with a fresh slice and parks the active one', () => {
  const block = { id: 'a', tasks: [task('b', { pausedAt: T0 + 60_000, slice: { domain: 'x.com', since: T0 + 1, mode: 'away', awayCarryMs: 7 } })] }
  const at = T0 + 180_000
  const out = switchTask(block, task('a'), 'b', at)
  assert.equal(out.active.sessionId, 'b')
  assert.equal('pausedAt' in out.active, false)
  assert.deepEqual(out.active.slice, { domain: null, since: at, mode: 'attention', awayCarryMs: 0 })
  assert.equal(out.active.dwellSince, at)
  assert.deepEqual(out.block.tasks.map((t) => [t.sessionId, t.pausedAt]), [['a', at]])
  assert.equal(out.paused.seconds, 120)
})

test('switchTask to a task that is not parked is null', () => {
  assert.equal(switchTask({ id: 'a', tasks: [] }, task('a'), 'zzz', T0), null)
})

test('closingEvents gives each parked task one paused event, and nothing for no block', () => {
  const block = { id: 'a', tasks: [task('b', { pausedAt: T0 + 60_000 }), task('c', { pausedAt: T0 + 120_000 })] }
  const out = closingEvents(block, T0 + 300_000)
  assert.deepEqual(out.map((e) => [e.sessionId, e.event.seconds]), [['b', 240], ['c', 180]])
  assert.deepEqual(closingEvents(null, T0), [])
})

test('attendedSeconds sums attention only', () => {
  assert.equal(attendedSeconds({ tally: { attention: { 'a.com': 60, 'b.com': 30 }, away: 99, break: 5 } }), 90)
  assert.equal(attendedSeconds({}), 0)
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test test/extension-block.test.js`
Expected: FAIL with `Cannot find module '…/extension/lib/block.js'`.

- [ ] **Step 4: Write the reducer**

Create `extension/lib/block.js`:

```js
// ADR-0084. Pure — no chrome.*, no Date.now(). One session, several tasks: chrome.storage's
// `session` is the ACTIVE task (so every listener keeps working unchanged), and the block parks
// the others, each stamped with the moment it stopped being active.
import { emptySlice } from './attribution.js'

export const MAX_TASKS = 4

/** Time a task sat inactive, as one `paused` event; null under one whole second. */
export function pausedEvent(sinceMs, atMs) {
  const seconds = Math.floor(Math.max(0, atMs - sinceMs) / 1000)
  if (seconds <= 0) return null
  return { kind: 'paused', domain: null, seconds, at: new Date(atMs).toISOString() }
}

function park(block, active, atMs) {
  return { ...block, tasks: [...block.tasks, { ...active, pausedAt: atMs }] }
}

/** The caller has already closed `active`'s slice. `task` shares the block's startedAt, so the
 *  time before it existed is inactive time and is accounted as paused, not as unrecorded. */
export function addTask(block, active, task, atMs) {
  if (1 + block.tasks.length >= MAX_TASKS) return null
  return {
    block: park(block, active, atMs),
    active: task,
    paused: pausedEvent(Date.parse(task.startedAt), atMs),
  }
}

/** The caller has already closed `active`'s slice. The resumed task starts a fresh slice: its
 *  old one ended when it was parked, and crediting the gap to its last site would be a lie. */
export function switchTask(block, active, targetId, atMs) {
  const target = block.tasks.find((t) => t.sessionId === targetId)
  if (!target) return null
  const { pausedAt, ...resumed } = target
  return {
    block: park({ ...block, tasks: block.tasks.filter((t) => t !== target) }, active, atMs),
    active: { ...resumed, slice: emptySlice(atMs), dwellSince: atMs },
    paused: pausedEvent(pausedAt, atMs),
  }
}

/** At the end, each parked task's last stretch of inactivity. */
export function closingEvents(block, atMs) {
  return (block?.tasks ?? [])
    .map((t) => ({ sessionId: t.sessionId, event: pausedEvent(t.pausedAt, atMs) }))
    .filter((e) => e.event !== null)
}

export function attendedSeconds(task) {
  return Object.values(task?.tally?.attention ?? {}).reduce((sum, s) => sum + s, 0)
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `node --test test/extension-block.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add docs/adr/ADR-0084-one-session-many-tasks.md extension/lib/block.js test/extension-block.test.js
git commit -m "feat(tasks): the pure add/switch/end reducer for one session with many tasks (ADR-0084)"
```

---

### Task 2: The server learns blocks and the `paused` kind

**Files:**
- Create: `lib/migrations/008-task-blocks.sql`
- Modify: `lib/session-payload.ts`, `test/session-payload.test.js`
- Modify: `app/api/sessions/route.ts`
- Modify: `app/api/events/route.ts` (`KINDS`), `test/event-kinds.test.js`
- Modify: `lib/session-time.ts`, `test/session-time.test.js`

**Interfaces:**
- Consumes: `pausedEvent` (Task 1), used only by the kinds test.
- Produces:
  - column `session.block_id uuid null`;
  - `StartPayload.blockId: string | null` (lowercased UUID, or null);
  - `POST /api/sessions` accepts `blockId`;
  - `POST /api/events` accepts kind `paused`;
  - `computeUnrecorded` treats `paused` as accounted.

- [ ] **Step 1: Write the failing unit tests**

Append to `test/session-payload.test.js`:

```js
test('normalizeStartPayload carries a valid blockId, lowercased, and nulls anything else (ADR-0084)', () => {
  const id = '0b7c2c1e-3f4a-4d5b-9c6d-7e8f9a0b1c2d'
  assert.equal(normalizeStartPayload({ blockId: id }).blockId, id)
  assert.equal(normalizeStartPayload({ blockId: id.toUpperCase() }).blockId, id)
  assert.equal(normalizeStartPayload({ blockId: 'not-a-uuid' }).blockId, null)
  assert.equal(normalizeStartPayload({ blockId: 42 }).blockId, null)
  assert.equal(normalizeStartPayload({}).blockId, null)
})
```

Append to `test/session-time.test.js`:

```js
test('computeUnrecorded counts time parked on another task as accounted for (ADR-0084)', () => {
  // 30 minutes of wall clock: 10 attention, 5 away, 15 spent on the session's other task.
  const parked = [...rows(600, 300), { kind: 'paused', domain: null, seconds: 900, hits: 1 }]
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', '2026-09-15T10:30:00Z', parked), 0)
})
```

In `test/event-kinds.test.js`, add to the imports:

```js
import { pausedEvent } from '../extension/lib/block.js'
```

and in the first test, replace:

```js
  emitted.add('attention').add('away').add('block_hit')
```

with:

```js
  emitted.add('attention').add('away').add('block_hit')
  emitted.add(pausedEvent(0, 60_000).kind) // ADR-0084: a parked task's inactive time
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/session-payload.test.js test/session-time.test.js test/event-kinds.test.js`
Expected: three FAILs. `blockId` is undefined, unrecorded is `900` rather than `0`, and "events route rejects kind 'paused'".

- [ ] **Step 3: Write the migration**

Create `lib/migrations/008-task-blocks.sql`:

```sql
-- RELEASE ORDERING, and `npm run migrate` is manual: APPLY THIS BEFORE DEPLOYING THE APP THAT
-- WRITES IT. Deploy first and every POST /api/sessions throws on the missing column. (ADR-0084)
--
-- One session, several tasks: each task is an ordinary session row, and every task in one block
-- carries the block's id, which is the first task's id. Null on every row written before this
-- migration; after it, a single-task session is a block of one and carries its own id.
--
-- Client-supplied, like session.id itself. Every read also filters by user_id, so a forged
-- value can only ever group the caller's own rows.
alter table session add column if not exists block_id uuid;
create index if not exists session_block_idx on session (block_id);

-- event.kind gains 'paused' alongside attention | away | block_hit | label. kind is free text;
-- no constraint changes.
```

- [ ] **Step 4: Carry `blockId` through the payload**

In `lib/session-payload.ts`, add `blockId: string | null` to the `StartPayload` type after `localHour: number | null`:

```ts
  localHour: number | null
  blockId: string | null
```

Directly above `export function normalizeStartPayload`, add:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

At the end of the returned object, after the `localHour: …` property, add:

```ts
    // ADR-0084. Client-supplied and untrusted, like body.id. Lowercased so every row of one
    // block compares equal whatever case the client sent.
    blockId: typeof body.blockId === 'string' && UUID.test(body.blockId) ? body.blockId.toLowerCase() : null,
```

- [ ] **Step 5: Insert it**

In `app/api/sessions/route.ts`, replace the `insert into session (…) values (…)` statement with:

```ts
  await sql`
    insert into session (
      id, user_id, device_id, intention, planned_minutes, blocklist, started_at,
      work_sites, blocked_domains, cycle_work_min, cycle_break_min, started_at_local_hour, block_id)
    values (
      ${body.id}, ${device.user_id}, ${device.id}, ${p.intention}, ${p.plannedMinutes},
      ${p.blocklist}, ${body.startedAt},
      ${p.workSites}, ${p.blockedDomains}, ${p.cycleWorkMin}, ${p.cycleBreakMin}, ${p.localHour}, ${p.blockId})
    on conflict (id) do nothing`
```

- [ ] **Step 6: Accept the kind, and account for it**

In `app/api/events/route.ts`, replace:

```ts
const KINDS = ['attention', 'away', 'block_hit', 'label']
```

with:

```ts
// 'paused' (ADR-0084) is a parked task's inactive time. Same rule as 'label' above: a kind
// missing here fails the whole batch and requeues it forever.
const KINDS = ['attention', 'away', 'block_hit', 'label', 'paused']
```

In `lib/session-time.ts`, replace:

```ts
    .filter((r) => r.kind === 'attention' || r.kind === 'away' || r.kind === 'break')
```

with:

```ts
    // 'paused' (ADR-0084): time on the session's other task was watched, just not for this row.
    .filter((r) => r.kind === 'attention' || r.kind === 'away' || r.kind === 'break' || r.kind === 'paused')
```

- [ ] **Step 7: Run to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, 0 failures, no type errors.

- [ ] **Step 8: Apply the migration to the test database**

Run: `node --env-file=.env.test lib/migrate.mjs`
Expected: `apply 008-task-blocks.sql`, with every earlier file reported as `skip`.

- [ ] **Step 9: Commit**

```bash
git add lib/migrations/008-task-blocks.sql lib/session-payload.ts test/session-payload.test.js app/api/sessions/route.ts app/api/events/route.ts test/event-kinds.test.js lib/session-time.ts test/session-time.test.js
git commit -m "feat(tasks): session.block_id and the paused event kind (ADR-0084)"
```

---

### Task 3: The service worker adds, switches and ends tasks

**Files:**
- Modify: `extension/sw.js`
- Modify: `extension/api.js` (both 401 branches)
- Test: `e2e/juggle.spec.ts` (new)

**Interfaces:**
- Consumes: `MAX_TASKS`, `addTask`, `switchTask`, `closingEvents` (Task 1); `POST /api/sessions` with `blockId` (Task 2); `askOutcome` (Plan A).
- Produces (Task 4's popup sends these):
  - storage key `block: { id, tasks } | null`;
  - `session.blockId`, `session.lockFrom` (ISO) on every task;
  - message `{ type: 'add-task', intention, blockedDomains, workSites }` answers `{ ok: true, sessionId }`, or `{ ok: false, error: 'no-session' | 'max-tasks' | 'rules' }`;
  - message `{ type: 'switch-task', sessionId }` answers `{ ok: true }`, or `{ ok: false, error: 'no-task' | 'rules' }`;
  - `pendingReview = { sessionId, sessionIds }` (the active task first).

- [ ] **Step 1: Write the failing e2e tests**

Create `e2e/juggle.spec.ts`:

```ts
import { test, expect } from './fixtures'

// ADR-0084. One session, several tasks; blocking follows the active one.
async function pairPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
}
const storage = (page: import('@playwright/test').Page, key: string) =>
  page.evaluate((k) => new Promise<any>((r) => chrome.storage.local.get(k, (v: any) => r(v[k] ?? null))), key)
const send = (page: import('@playwright/test').Page, message: object) =>
  page.evaluate((m) => chrome.runtime.sendMessage(m), message) as Promise<any>
async function ruleDomains(context: import('@playwright/test').BrowserContext) {
  const [sw] = context.serviceWorkers()
  return sw.evaluate(async () =>
    (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => r.condition.requestDomains![0]).sort())
}
const START = { type: 'start', intention: 'write the letter', plannedMinutes: 60, blockedDomains: ['youtube.com'], blocklists: [], workSites: [], cycle: null }

test('adding a task parks the first and swaps the blocks; switching swaps them back; stop ends both', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  expect(start.ok).toBe(true)
  const first = start.sessionId
  expect(await ruleDomains(context)).toEqual(['youtube.com'])

  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: ['x.com'], workSites: [] })
  expect(added.ok).toBe(true)
  expect(await ruleDomains(context)).toEqual(['x.com'])
  const active = await storage(page, 'session')
  expect(active.sessionId).toBe(added.sessionId)
  expect(active.blockId).toBe(first)
  expect(active.startedAt).toBe((await storage(page, 'block')).tasks[0].startedAt) // one shared clock
  const block = await storage(page, 'block')
  expect(block.tasks.map((t: any) => t.sessionId)).toEqual([first])
  expect(typeof block.tasks[0].pausedAt).toBe('number')

  const back = await send(page, { type: 'switch-task', sessionId: first })
  expect(back.ok).toBe(true)
  expect(await ruleDomains(context)).toEqual(['youtube.com'])
  expect((await storage(page, 'session')).sessionId).toBe(first)
  expect((await storage(page, 'block')).tasks.map((t: any) => t.sessionId)).toEqual([added.sessionId])

  await send(page, { type: 'stop' })
  await expect.poll(async () => storage(page, 'session')).toBeNull()
  expect(await storage(page, 'block')).toBeNull()
  expect(await ruleDomains(context)).toEqual([])
  const pending = await storage(page, 'pendingReview')
  expect(pending.sessionId).toBe(first)
  expect([...pending.sessionIds].sort()).toEqual([first, added.sessionId].sort())

  for (const id of [first, added.sessionId]) {
    await expect
      .poll(async () => (await (await page.request.get(`/api/sessions/${id}/review`)).json()).endedAt ?? null, { timeout: 10_000 })
      .not.toBeNull()
  }
})

test('a session holds at most four tasks', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await send(page, START)
  for (const i of [2, 3, 4]) {
    expect((await send(page, { type: 'add-task', intention: `task ${i}`, blockedDomains: [], workSites: [] })).ok).toBe(true)
  }
  expect(await send(page, { type: 'add-task', intention: 'task 5', blockedDomains: [], workSites: [] })).toEqual({ ok: false, error: 'max-tasks' })
  await send(page, { type: 'stop' })
})

test('switching to a task that is not parked changes nothing', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  expect(await send(page, { type: 'switch-task', sessionId: '00000000-0000-4000-8000-000000000000' })).toEqual({ ok: false, error: 'no-task' })
  expect((await storage(page, 'session')).sessionId).toBe(start.sessionId)
  expect(await ruleDomains(context)).toEqual(['youtube.com'])
  await send(page, { type: 'stop' })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/juggle.spec.ts`
Expected: FAIL. `add-task` answers `{ ok: false }` (the message is unknown), so `added.ok` is false.

- [ ] **Step 3: Imports and helpers in `sw.js`**

In `extension/sw.js`, add after the existing imports:

```js
import { MAX_TASKS, addTask, switchTask, closingEvents } from './lib/block.js'
```

Directly after `export async function getSession() { … }`, add:

```js
async function getBlock() {
  const { block } = await chrome.storage.local.get('block')
  return block ?? null
}

// ADR-0084. Blocks follow the active task: lift the rules, send the old task's blocked tabs back
// (only those the new task does not also block), then lay the new task's rules and sweep.
// Same order as endSession, and for the same reason: a rule still installed during the
// sweep-back would redirect that navigation straight back to blocked.html.
async function swapRules(fromDomains, toDomains) {
  await removeAllRules()
  await sweepBlockedTabsBack((fromDomains ?? []).filter((d) => !(toDomains ?? []).includes(d)))
  const { ruleIds, domains } = await installRules(toDomains)
  await sweepOpenTabs(domains)
  return ruleIds
}
```

- [ ] **Step 4: A new session is a block of one**

In `startSession`, in the `chrome.storage.local.set({ session: { … }, companionState: 'settled' })` call:
- add `blockId: sessionId, lockFrom: startedAt,` on the line after `tally: { attention: {}, away: 0, break: 0 },`;
- add `block: { id: sessionId, tasks: [] },` next to `companionState: 'settled',`.

The call becomes:

```js
  await chrome.storage.local.set({
    session: {
      sessionId, intention, startedAt, plannedMinutes,
      blockedDomains, blocklists, workSites, cycle,
      slice: emptySlice(now), dwellSince: now, visitSeq: 0,
      ruleIds: [], signals: [], corrected: [], judged: {},
      labels: [],                                   // ADR-0058: the companion's one-tap labels
      tally: { attention: {}, away: 0, break: 0 },
      blockId: sessionId, lockFrom: startedAt,      // ADR-0084: a new session is a block of one
    },
    block: { id: sessionId, tasks: [] },
    companionState: 'settled',
  })
```

In the same function, replace the final POST:

```js
  post('/api/sessions', { id: sessionId, intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle, startedAt, localHour })
```

with:

```js
  post('/api/sessions', { id: sessionId, intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle, startedAt, localHour, blockId: sessionId })
```

- [ ] **Step 5: Add and switch**

Directly after `startSession`'s closing `}`, add:

```js
/** ADR-0084. A new intention becomes the active task; the current one is parked. Rules swap
 *  FIRST, so a failed swap aborts with nothing else changed (and the old rules restored). */
export async function addTaskToSession({ intention, blockedDomains = [], workSites = [] }) {
  const current = await getSession()
  const block = await getBlock()
  if (!current || !block) return { ok: false, error: 'no-session' }
  if (1 + block.tasks.length >= MAX_TASKS) return { ok: false, error: 'max-tasks' }

  let ruleIds
  try {
    ruleIds = await swapRules(current.blockedDomains, blockedDomains)
  } catch (error) {
    console.error('addTaskToSession: rules failed', error instanceof Error ? error.name : 'unknown')
    await swapRules(blockedDomains, current.blockedDomains).catch(() => {})
    return { ok: false, error: 'rules' }
  }

  const now = Date.now()
  const closed = (await transition({ mode: current.slice?.mode ?? 'attention', domain: null, at: now })) ?? current
  const sessionId = crypto.randomUUID()
  const task = {
    sessionId, intention, startedAt: current.startedAt, plannedMinutes: current.plannedMinutes,
    blockedDomains, blocklists: [], workSites, cycle: current.cycle,
    slice: emptySlice(now), dwellSince: now, visitSeq: 0,
    ruleIds, signals: [], corrected: [], judged: {},
    labels: [],
    tally: { attention: {}, away: 0, break: 0 },
    blockId: block.id, lockFrom: new Date(now).toISOString(),
  }
  const next = addTask(block, closed, task, now)
  await chrome.storage.local.set({ session: next.active, block: next.block })
  if (next.paused) await enqueue(next.active, next.paused)
  const seed = await activeTarget()
  await transition({ mode: 'attention', domain: seed.domain, url: seed.url })
  // AWAITED, unlike startSession's fire-and-forget: a Stop pressed right after "+ task" would
  // otherwise PATCH this row's end before its insert lands, and a 404 PATCH is never queued —
  // the task would stay open forever. Offline, post() queues it and returns at once, and flush()
  // replays the queue in order (this insert before that PATCH). The row shares the block's
  // clock: same started_at, same hour (ADR-0067's hour is the block's).
  await post('/api/sessions', {
    id: sessionId, intention, plannedMinutes: current.plannedMinutes, blockedDomains, blocklists: [],
    workSites, cycle: current.cycle, startedAt: current.startedAt,
    localHour: new Date(current.startedAt).getHours(), blockId: block.id,
  })
  return { ok: true, sessionId }
}

/** ADR-0084. One tap from one task to another; rules swap first, exactly as above. */
export async function switchToTask(targetId) {
  const current = await getSession()
  const block = await getBlock()
  const target = block?.tasks.find((t) => t.sessionId === targetId)
  if (!current || !target) return { ok: false, error: 'no-task' }

  let ruleIds
  try {
    ruleIds = await swapRules(current.blockedDomains, target.blockedDomains)
  } catch (error) {
    console.error('switchToTask: rules failed', error instanceof Error ? error.name : 'unknown')
    await swapRules(target.blockedDomains, current.blockedDomains).catch(() => {})
    return { ok: false, error: 'rules' }
  }

  const now = Date.now()
  const closed = (await transition({ mode: current.slice?.mode ?? 'attention', domain: null, at: now })) ?? current
  const next = switchTask(block, closed, targetId, now)
  await chrome.storage.local.set({ session: { ...next.active, ruleIds }, block: next.block })
  if (next.paused) await enqueue(next.active, next.paused)
  const seed = await activeTarget()
  await transition({ mode: 'attention', domain: seed.domain, url: seed.url })
  return { ok: true }
}
```

- [ ] **Step 6: End every task together**

Replace the whole `endSession` function, as Plan A left it, with:

```js
export async function endSession(endReason) {
  const session = await getSession()
  if (!session) return { ok: false }
  const block = await getBlock()
  const parked = block?.tasks ?? []
  const endedAt = new Date().toISOString()
  try {
    await transition({ mode: session.slice?.mode ?? 'attention', domain: null })
    // ADR-0084: each parked task's last stretch of inactivity, then every row ends together.
    for (const { sessionId, event } of closingEvents(block, Date.parse(endedAt))) {
      await enqueue({ sessionId }, event)
    }
    await flush()
    for (const id of [session.sessionId, ...parked.map((t) => t.sessionId)]) {
      await post(`/api/sessions/${id}`, { endedAt, endReason }, { method: 'PATCH' })
    }
  } finally {
    // removeAllRules() must run BEFORE the sweep: declarativeNetRequest intercepts the
    // sweep's own tabs.update navigation just like any other new navigation attempt — if
    // the block rule is still installed at that instant, the sweep's navigation to the
    // real site gets redirected right back to blocked.html (the exact same URL, so it
    // looks like nothing happened). Removing the rule first closes that race.
    await removeAllRules()
    // A parked task's rules are already lifted, but a tab can still sit on its blocked.html.
    await sweepBlockedTabsBack([...new Set([session, ...parked].flatMap((t) => t.blockedDomains ?? []))])
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null, block: null, companionState: null })
    // No session means no alarm to drain the queue later, so try once more now — this is
    // what lets a queued end-of-session PATCH sync without waiting for the next session.
    await flush()
  }

  if (endReason === 'stopped' || endReason === 'elapsed') {
    await chrome.storage.local.set({
      pendingReview: { sessionId: session.sessionId, sessionIds: [session.sessionId, ...parked.map((t) => t.sessionId)] },
    })
    await chrome.action.setBadgeText({ text: '?' }) // ADR-0082: until the popup's Done
  }
  // Only an elapsed end asks by itself: after 'stopped' the popup is already open on the question.
  if (endReason === 'elapsed') {
    await chrome.storage.local.set({ askPending: true })
    await askOutcome()
  }

  return { ok: true }
}
```

- [ ] **Step 7: Recovery clears a stray block; the messages route**

In `recoverStaleSession`, replace:

```js
  else await removeAllRules()
```

with:

```js
  else {
    await removeAllRules()
    await chrome.storage.local.set({ block: null }) // ADR-0084: never a block without its active task
  }
```

In the `chrome.runtime.onMessage` listener, directly after the `else if (message?.type === 'not-the-work') …` line, add:

```js
    else if (message?.type === 'add-task') sendResponse(await addTaskToSession(message))
    else if (message?.type === 'switch-task') sendResponse(await switchToTask(message.sessionId))
```

- [ ] **Step 8: Clear `block` wherever `session` is force-cleared**

In `extension/api.js`, in **both** 401 branches, change `session: null,` to `session: null, block: null,`.

In `extension/popup.js`'s Disconnect handler, change the `chrome.storage.local.set({ token: null, deviceId: null, session: null, pendingReview: null, askPending: false })` call to:

```js
    await chrome.storage.local.set({ token: null, deviceId: null, session: null, block: null, pendingReview: null, askPending: false })
```

- [ ] **Step 9: Run to verify they pass**

Run: `npx playwright test e2e/juggle.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 10: Run the lifecycle suites that exercise `endSession`**

Run: `npx playwright test e2e/session-lifecycle.spec.ts e2e/session-recovery.spec.ts e2e/session-elapsed.spec.ts e2e/outcome-in-popup.spec.ts e2e/offline.spec.ts && npm test`
Expected: PASS. A single-task session behaves exactly as before, apart from `pendingReview.sessionIds` holding one id.

- [ ] **Step 11: Commit**

```bash
git add extension/sw.js extension/api.js extension/popup.js e2e/juggle.spec.ts
git commit -m "feat(tasks): add, switch and end tasks in the service worker, blocks follow the task (ADR-0084)"
```

---

### Task 4: The popup shows the other tasks and asks each one

**Files:**
- Modify: `extension/popup.js` (imports; `running()`; a new `outcomeMany()`; `render()`)
- Modify: `extension/meant.css`
- Test: `e2e/juggle.spec.ts` (append)

**Interfaces:**
- Consumes: the Task 3 messages; `MAX_TASKS`, `attendedSeconds` (Task 1); `PRESETS`, `matchPreset`, `presetBlockSet` (Plan B, already imported into `popup.js`); `fetchLists()` and `clearPending()` (existing and Plan A); `GET /api/sessions/:id/review` returning `ReviewData` (its `rows`, `intention` and `outcome` fields are used).
- Produces: UI only. A new task takes a **keyword** preset if its intention matches one; otherwise it inherits the current task's blocks. There is no AI call here, so adding a task never waits on the network beyond the list fetch.

- [ ] **Step 1: Write the failing e2e tests**

Append to `e2e/juggle.spec.ts`:

```ts
test('the running popup adds a task and switches back in one tap', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.route('**/api/presets/classify', (r) => r.fulfill({ json: { preset: null } }))

  await page.locator('input.m-field').first().fill('write the letter')
  await page.getByRole('button', { name: 'Start' }).click()

  await page.getByRole('button', { name: '+ task' }).click()
  await page.getByPlaceholder('What else do you mean to do?').fill('research sources')
  await page.getByPlaceholder('What else do you mean to do?').press('Enter')

  await expect(page.locator('[data-timer-pill="true"] input.m-field')).toHaveValue('research sources')
  await expect(page.getByText('other tasks', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to write the letter' }).click()
  await expect(page.locator('[data-timer-pill="true"] input.m-field')).toHaveValue('write the letter')
  await expect(page.getByRole('button', { name: 'Switch to research sources' })).toBeVisible()

  await send(page, { type: 'stop' })
})

test('the + task control disappears once the session holds four tasks', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  await send(page, START)
  for (const i of [2, 3, 4]) await send(page, { type: 'add-task', intention: `task ${i}`, blockedDomains: [], workSites: [] })
  await page.reload()
  await expect(page.getByRole('button', { name: '+ task' })).toBeHidden()
  await send(page, { type: 'stop' })
})

test('ending a two-task session asks Did you? once per task, with identical answers', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: [], workSites: [] })
  await send(page, { type: 'stop' })
  for (const id of [start.sessionId, added.sessionId]) {
    await expect
      .poll(async () => (await (await page.request.get(`/api/sessions/${id}/review`)).json()).endedAt ?? null, { timeout: 10_000 })
      .not.toBeNull()
  }

  await page.reload()
  await expect(page.getByText('Did you?', { exact: true })).toHaveCount(2)
  await expect(page.getByText('write the letter', { exact: true })).toBeVisible()
  await expect(page.getByText('research sources', { exact: true })).toBeVisible()

  // Invariant 1, across tasks too: Yes and Not yet are identical in every property.
  const style = (name: string) => page.getByRole('button', { name, exact: true }).first().evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.color, s.backgroundColor, s.fontSize, s.fontWeight, s.width, s.height, s.transition].join('|')
  })
  expect(await style('Yes')).toBe(await style('Not yet'))

  await page.getByRole('button', { name: 'Yes', exact: true }).first().click()
  await expect(page.getByText('Did you?', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Done' })).toHaveCount(0) // one task still open
  await page.getByRole('button', { name: 'Not yet', exact: true }).first().click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('What do you mean to do?')).toBeVisible()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/juggle.spec.ts`
Expected: the three new tests FAIL (no `+ task` button; one "Did you?"). The Task 3 tests still pass.

- [ ] **Step 3: Imports**

At the top of `extension/popup.js`, add:

```js
import { MAX_TASKS, attendedSeconds } from './lib/block.js'
```

- [ ] **Step 4: `render()` passes the block and routes a multi-task outcome**

Replace the whole `render()` function with:

```js
async function render() {
  const { token, session, unpairedReason, pendingReview, block } = await chrome.storage.local.get(['token', 'session', 'unpairedReason', 'pendingReview', 'block'])
  if (!token) {
    if (unpairedReason) await chrome.storage.local.remove('unpairedReason')
    return unpaired(unpairedReason)
  }
  if (session) return running(session, block)
  // ADR-0084: a session that held several tasks asks each one.
  if (pendingReview) return pendingReview.sessionIds?.length > 1 ? outcomeMany(pendingReview.sessionIds) : outcome(pendingReview.sessionId)
  await idle()
}
```

- [ ] **Step 5: `running()` — per-task lock, the other tasks, `+ task`**

Change the signature `function running(session) {` to `function running(session, block) {`.

Replace:

```js
  if (isEditable(Date.now(), startedAt, GRACE_MS)) {
```

with:

```js
  // ADR-0041 per task (ADR-0084): a task added mid-session gets its own 60 seconds.
  const lockFrom = new Date(session.lockFrom ?? session.startedAt).getTime()
  if (isEditable(Date.now(), lockFrom, GRACE_MS)) {
```

Directly before the `show(` call at the end of `running()`, insert:

```js
  // ADR-0084. The session's other tasks, each one tap from being the active one.
  const others = block?.tasks ?? []
  const tasksLabel = others.length > 0 ? el('p', 'm-meta', 'other tasks') : null
  const taskRows = others.map((t) => {
    const row = el('div', 'm-row')
    row.dataset.row = 'task'
    const bar = el('span', 'm-row-bar')
    bar.dataset.kind = 'step-open'
    const name = el('p', 'm-row-domain', `${t.intention || 'No intention given'} · ${Math.round(attendedSeconds(t) / 60)} min`)
    const go = el('button', 'm-chip', 'switch')
    go.type = 'button'
    go.setAttribute('aria-label', `Switch to ${t.intention || 'the other task'}`)
    go.addEventListener('click', async () => {
      go.disabled = true
      await chrome.runtime.sendMessage({ type: 'switch-task', sessionId: t.sessionId })
      render()
    })
    row.append(bar, name, go)
    return row
  })

  // "+ task": a new intention becomes the active task. Its blocks come from a KEYWORD preset
  // (ADR-0083) when one matches, otherwise from this task — no model call on this path.
  const addButton = el('button', 'm-btn', '+ task')
  addButton.dataset.variant = 'quiet'
  addButton.hidden = 1 + others.length >= MAX_TASKS
  const addField = el('input', 'm-field')
  addField.placeholder = 'What else do you mean to do?'
  addField.spellcheck = false
  addField.hidden = true
  const addError = el('p', 'm-meta', '')
  addError.hidden = true
  addButton.addEventListener('click', () => {
    addButton.hidden = true
    addField.hidden = false
    addField.focus()
  })
  addField.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      addField.hidden = true
      addButton.hidden = false
      return
    }
    if (e.key !== 'Enter') return
    const intention = addField.value.trim()
    if (!intention) return
    addField.disabled = true
    const id = matchPreset(intention)
    const blockedDomains = id
      ? presetBlockSet({ standing: (await fetchLists()).distractSites ?? [], preset: PRESETS[id], workSites: session.workSites ?? [], intention })
      : (session.blockedDomains ?? [])
    const res = await chrome.runtime.sendMessage({ type: 'add-task', intention, blockedDomains, workSites: session.workSites ?? [] })
    if (!res?.ok) {
      addField.disabled = false
      addError.textContent = res?.error === 'max-tasks' ? 'Four tasks is the most one session holds.' : 'Could not add it.'
      addError.hidden = false
      return
    }
    render()
  })
```

Replace the `show(…)` call at the end of `running()` with:

```js
  show(
    header(mark),
    pillWrap,
    phaseLine,
    ...attentionRows,
    ...(tasksLabel ? [tasksLabel, ...taskRows] : []),
    addButton,
    addField,
    addError,
    ...(blockingLabel ? [blockingLabel] : []),
    ...(blockedRowsContainer ? [blockedRowsContainer] : []),
    stop,
  )
```

- [ ] **Step 6: `outcomeMany()` — one question per task**

Directly after the closing `}` of `outcome()`, add:

```js
/** ADR-0084. The multi-task outcome: every task asked on its own, byte-identical Yes / Not yet
 *  for each (invariant 1). Done appears once every task has an answer, exactly as the single
 *  view shows Done only after its one answer. */
async function outcomeMany(sessionIds) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'ended'

  const results = await Promise.all(sessionIds.map((id) => get(`/api/sessions/${id}/review`)))
  if (results.some((r) => r.offline || (typeof r.status === 'number' && r.status >= 500))) {
    const done = el('button', 'm-btn', 'Done')
    done.dataset.variant = 'quiet'
    done.addEventListener('click', async () => {
      await clearPending()
      render()
    })
    return show(mark, el('p', 'm-meta', "Can't reach it right now."), done)
  }
  const tasks = results.map((r, i) => ({ id: sessionIds[i], data: r.ok ? r.data : null })).filter((t) => t.data)
  if (tasks.length === 0) {
    await clearPending()
    return idle()
  }

  const nodes = [header(mark), el('p', 'm-meta', 'You meant to')]
  for (const { id, data } of tasks) {
    const sentence = el('p', 'm-sentence', data.intention || "You didn't say what you meant to do.")
    sentence.dataset.compact = 'true'
    const attended = data.rows.filter((r) => r.kind === 'attention').reduce((sum, r) => sum + r.seconds, 0)
    nodes.push(sentence, el('p', 'm-meta', `${Math.round(attended / 60)} min on it`))
    if (data.outcome === 'unanswered') {
      nodes.push(el('p', 'm-rate', 'Did you?'))
      const yes = el('button', 'm-answer', 'Yes')
      const notYet = el('button', 'm-answer', 'Not yet')
      const answer = async (value) => {
        yes.disabled = true
        notYet.disabled = true
        await post(`/api/sessions/${id}/outcome`, { outcome: value }, { method: 'PATCH' })
        render()
      }
      yes.addEventListener('click', () => answer('yes'))
      notYet.addEventListener('click', () => answer('no'))
      nodes.push(yes, notYet)
    } else {
      nodes.push(el('p', 'm-meta', data.outcome === 'yes'
        ? `Good. That's ${data.finished} of ${data.answered}.`
        : 'Noted. It carries over.'))
    }
  }

  if (tasks.every((t) => t.data.outcome !== 'unanswered')) {
    const done = el('button', 'm-btn', 'Done')
    done.dataset.variant = 'quiet'
    done.addEventListener('click', async () => {
      await clearPending()
      render()
    })
    nodes.push(done)
  }
  show(...nodes)
}
```

- [ ] **Step 7: CSS**

Append to `extension/meant.css`, directly after the `.m-row-bar[data-kind="attention-3"]` rule:

```css
/* ADR-0084. A task row trades the 56px figure column for its switch chip. data-row, not a class. */
[data-surface="popup"] .m-row[data-row="task"] { grid-template-columns: 11px minmax(0, 1fr) auto; }
/* ADR-0084. The multi-task outcome stacks up to four intentions; the full 76px outline each
 * would push the answers below the 600px popup ceiling. */
[data-surface="popup"] .m-sentence[data-compact="true"] { font-size: 16px; min-height: 0; }
```

- [ ] **Step 8: Run to verify they pass**

Run: `npx playwright test e2e/juggle.spec.ts e2e/popup.spec.ts e2e/outcome-in-popup.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add extension/popup.js extension/meant.css e2e/juggle.spec.ts
git commit -m "feat(popup): other tasks, + task, and a Did you? per task (ADR-0084)"
```

---

### Task 5: The review page knows the session's other tasks

**Files:**
- Modify: `lib/review-data.ts`
- Modify: `app/review/[sessionId]/page.tsx`
- Test: `e2e/juggle.spec.ts` (append)

**Interfaces:**
- Consumes: `session.block_id` (Task 2); `paused` rows (Task 3).
- Produces: `ReviewData.pausedSeconds: number` and `ReviewData.siblings: { id: string; intention: string; outcome: string }[]`. The popup's `outcomeMany` ignores both; `GET /api/sessions/:id/review` returns them.

- [ ] **Step 1: Write the failing e2e tests**

Append to `e2e/juggle.spec.ts`:

```ts
test('each task\'s review lists the other, and a late task\'s earlier time counts as paused, not unrecorded', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const start = await send(page, START)
  // Ten minutes into the block, a second task starts. Its row shares the block's clock, so those
  // ten minutes belong to it as paused time.
  await page.evaluate(() => new Promise<void>((resolve) => {
    chrome.storage.local.get('session', ({ session }: any) => {
      session.startedAt = new Date(Date.now() - 10 * 60_000).toISOString()
      chrome.storage.local.set({ session }, () => resolve())
    })
  }))
  const added = await send(page, { type: 'add-task', intention: 'research sources', blockedDomains: [], workSites: [] })
  await send(page, { type: 'stop' })

  await expect
    .poll(async () => (await (await page.request.get(`/api/sessions/${added.sessionId}/review`)).json()).pausedSeconds ?? 0, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(595)
  const late = await (await page.request.get(`/api/sessions/${added.sessionId}/review`)).json()
  expect(late.unrecordedSeconds).toBeLessThan(30)
  expect(late.siblings.map((s: any) => s.id)).toEqual([start.sessionId])

  await page.goto(`/review/${start.sessionId}`)
  await expect(page.getByText('Also in this session', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'research sources' })).toHaveAttribute('href', `/review/${added.sessionId}`)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/juggle.spec.ts -g "each task"`
Expected: FAIL. `pausedSeconds` is undefined, so the poll times out at `0`.

- [ ] **Step 3: `getReviewData`**

In `lib/review-data.ts`, add two fields to the `ReviewData` type after `unrecordedSeconds: number`:

```ts
  /** ADR-0084. Time this task sat parked while another task in its session was active. */
  pausedSeconds: number
  /** ADR-0084. The other tasks in this row's session, if it held more than one. */
  siblings: { id: string; intention: string; outcome: string }[]
```

Change the session query to select `block_id`:

```ts
  const [session] = await sql`
    select id, intention, outcome, started_at, ended_at, block_id
      from session where id = ${sessionId} and user_id = ${userId}`
```

Directly before the `const [counts] = await sql\`` statement, add:

```ts
  const pausedSeconds = rows
    .filter((r) => r.kind === 'paused')
    .reduce((total, r) => total + r.seconds, 0)
  // user_id on this query too: block_id is client-supplied (ADR-0084), so it may only ever
  // group the caller's own rows.
  const siblings = session.block_id
    ? ((await sql`
        select id, intention, outcome from session
         where user_id = ${userId} and block_id = ${session.block_id} and id <> ${sessionId}
         order by id`) as { id: string; intention: string; outcome: string }[])
    : []
```

In the returned object, after `unrecordedSeconds: …,`, add:

```ts
    pausedSeconds,
    siblings,
```

- [ ] **Step 4: The page**

In `app/review/[sessionId]/page.tsx`, add to the imports:

```ts
import Link from 'next/link'
```

Directly after the closing `)}` of the unrecorded-time paragraph (the block that ends `This page cannot tell you about those.`), insert:

```tsx
      {/* ADR-0084. A task shares its session's clock, so time on the other tasks is accounted
          for, not missing — say where it went, in minutes spelled as words like the line above. */}
      {data.pausedSeconds >= 60 && (
        <p {...rise('m-meta')}>
          {toWords(minutes(data.pausedSeconds))} minutes of this session went to your other{' '}
          {data.siblings.length === 1 ? 'task' : 'tasks'}.
        </p>
      )}
      {data.siblings.length > 0 && (
        <div {...rise('m-review-rows')}>
          <p className="m-meta">Also in this session</p>
          {data.siblings.map((s) => (
            <Link key={s.id} className="m-meta" href={`/review/${s.id}`}>
              {s.intention || 'No intention given'}
            </Link>
          ))}
        </div>
      )}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx tsc --noEmit && npx playwright test e2e/juggle.spec.ts e2e/review.spec.ts e2e/review-motion.spec.ts`
Expected: PASS. A single-task session's review is unchanged: `siblings` is empty and `pausedSeconds` is 0.

- [ ] **Step 6: Commit**

```bash
git add lib/review-data.ts "app/review/[sessionId]/page.tsx" e2e/juggle.spec.ts
git commit -m "feat(review): a task's review lists its session's other tasks (ADR-0084)"
```

---

### Task 6: The ledger and dashboard count a session once

**Files:**
- Modify: `lib/dashboard-figures.ts`
- Test: `test/dashboard-figures.test.js` (append)
- Modify: `app/dashboard/page.tsx` (the recent-sessions query, `monthSessions`, `prevMonthSessions`, the `computePerformanceFidelity` call)
- Modify: `app/ledger/page.tsx` (the recent-sessions query)

**Interfaces:**
- Consumes: `session.block_id` (Task 2).
- Produces:
  - `SessionRow.block_id?: string | null`;
  - `sessionKey(s: { id: string; block_id?: string | null }): string`;
  - `countSessions(rows: { id?: string; block_id?: string | null }[]): number`. Rows without an id count once each, so existing callers and tests that pass `{ outcome }` alone are unchanged.

- [ ] **Step 1: Write the failing tests**

Add `countSessions, computeMonthlyBreakdown` to the import list at the top of `test/dashboard-figures.test.js` if they are not already imported, then append:

```js
// ADR-0084. One session with several tasks is several rows sharing a block_id.
test('countSessions counts a block of tasks once, and rows without ids once each', () => {
  assert.equal(countSessions([{ id: 'a', block_id: 'a' }, { id: 'b', block_id: 'a' }, { id: 'c', block_id: null }]), 2)
  assert.equal(countSessions([{ outcome: 'yes' }, { outcome: 'no' }]), 2)
})

test('computePerformanceFidelity counts sessions by block and outcomes by task', () => {
  const perf = computePerformanceFidelity(
    [{ id: 'a', block_id: 'a', outcome: 'yes' }, { id: 'b', block_id: 'a', outcome: 'no' }],
    0, 0, 0,
  )
  assert.equal(perf.sessionCount, 1)
  assert.equal(perf.finishedCount, 1)
  assert.equal(perf.notYetCount, 1)
})

test('computeDailyTimeline draws one bar per block, joining its tasks and ignoring paused time', () => {
  const at = { started_at: '2026-09-18T08:00:00.000Z', ended_at: '2026-09-18T09:00:00.000Z' }
  const timeline = computeDailyTimeline('2026-09-18', [
    { id: 'a', block_id: 'a', intention: 'write', ...at, events: [{ kind: 'attention', seconds: 600 }, { kind: 'paused', seconds: 300 }] },
    { id: 'b', block_id: 'a', intention: 'research', ...at, events: [{ kind: 'attention', seconds: 300 }, { kind: 'paused', seconds: 600 }] },
  ], 4, 22)
  assert.equal(timeline.blocks.length, 1)
  assert.equal(timeline.sessionsCount, 1)
  assert.equal(timeline.blocks[0].intention, 'write · research')
  assert.equal(timeline.blocks[0].attendedSeconds, 900)
})

test('computeMonthlyBreakdown counts a block once per day but sums all its tasks\' time', () => {
  const at = { started_at: '2026-09-01T10:00:00.000Z', ended_at: '2026-09-01T11:00:00.000Z' }
  const month = computeMonthlyBreakdown(2026, 9, [
    { id: 'a', block_id: 'a', ...at, events: [{ kind: 'attention', seconds: 600 }] },
    { id: 'b', block_id: 'a', ...at, events: [{ kind: 'attention', seconds: 300 }] },
  ])
  assert.equal(month.days[0].sessionCount, 1)
  assert.equal(month.days[0].attendedSeconds, 900)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/dashboard-figures.test.js`
Expected: FAIL. `countSessions` is not exported, `sessionCount` is `2`, and the timeline draws two bars.

- [ ] **Step 3: Implement in `lib/dashboard-figures.ts`**

Add `block_id` to `SessionRow`:

```ts
export interface SessionRow {
  id: string
  intention?: string | null
  outcome?: string | null
  started_at: string
  ended_at?: string | null
  /** ADR-0084. Tasks of one session share it; null on rows written before tasks existed. */
  block_id?: string | null
  events?: EventRow[]
}
```

Directly after the `SessionRow` interface, add:

```ts
/** ADR-0084. One session may be several task rows; they share block_id. */
export function sessionKey(s: { id: string; block_id?: string | null }): string {
  return s.block_id ?? s.id
}

/** Sessions, not task rows. A row with no id (callers that pass outcomes alone) counts once. */
export function countSessions(rows: { id?: string; block_id?: string | null }[]): number {
  return new Set(rows.map((s, i) => s.block_id ?? s.id ?? `#${i}`)).size
}

/** One row per session for anything drawn on a time axis: a block's tasks share one clock, so
 *  drawing them separately would stack identical bars. Intentions join; events concatenate. */
function mergeBlocks(sessions: SessionRow[]): SessionRow[] {
  const byKey = new Map<string, SessionRow>()
  for (const s of sessions) {
    const key = sessionKey(s)
    const seen = byKey.get(key)
    if (!seen) {
      byKey.set(key, { ...s, events: s.events ? [...s.events] : s.events })
      continue
    }
    seen.intention = [seen.intention, s.intention].filter(Boolean).join(' · ')
    if (s.events) seen.events = [...(seen.events ?? []), ...s.events]
    if (s.ended_at && (!seen.ended_at || s.ended_at > seen.ended_at)) seen.ended_at = s.ended_at
  }
  return [...byKey.values()]
}
```

In `computePerformanceFidelity`:
- change the parameter type `currentSessions: { outcome?: string | null }[],` to `currentSessions: { id?: string; block_id?: string | null; outcome?: string | null }[],`;
- replace `const sessionCount = currentSessions.length` with `const sessionCount = countSessions(currentSessions)`.

In `computeDailyTimeline`, replace `for (const s of sessions) {` with `for (const s of mergeBlocks(sessions)) {`.

In **both** `computeMonthlyBreakdown` and `computeWeeklyBreakdown`:
1. directly before their `for (const s of sessions) {` loop, add `const counted = new Set<string>() // ADR-0084: day:session pairs already counted`;
2. replace `days[dayIdx].sessionCount += 1` with:

```ts
    const dayKey = `${dayIdx}:${sessionKey(s)}`
    if (!counted.has(dayKey)) {
      counted.add(dayKey)
      days[dayIdx].sessionCount += 1
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/dashboard-figures.test.js`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: The pages select `block_id`**

In `app/dashboard/page.tsx` **and** `app/ledger/page.tsx`, in the recent-sessions query, change:

```sql
    select s.id, s.intention, s.started_at, s.ended_at, s.outcome,
```

to:

```sql
    select s.id, s.intention, s.started_at, s.ended_at, s.outcome, s.block_id,
```

In `app/dashboard/page.tsx`:
- change both `select s.id, s.outcome` (the `monthSessions` and `prevMonthSessions` queries) to `select s.id, s.outcome, s.block_id`;
- change their cast types from `{ id: string; outcome: string | null }[]` to `{ id: string; outcome: string | null; block_id: string | null }[]`;
- add `countSessions` to the import from `@/lib/dashboard-figures`;
- in the `computePerformanceFidelity(` call, replace `prevMonthSessions.length,` with `countSessions(prevMonthSessions),`.

- [ ] **Step 6: Type-check and run the dashboard suites**

Run: `npx tsc --noEmit && npm test && npx playwright test e2e/dashboard.spec.ts e2e/ledger.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/dashboard-figures.ts test/dashboard-figures.test.js app/dashboard/page.tsx app/ledger/page.tsx
git commit -m "feat(dashboard): count a many-task session once, draw it as one bar (ADR-0084)"
```

---

### Task 7: Real-browser verification and the PR

- [ ] **Step 1: The full suites**

Run: `npm test && npx tsc --noEmit && npm run test:e2e`
Expected: all PASS, 0 failures.

- [ ] **Step 2: Look at it**

Invoke `meant-qa`. With `extension/` loaded unpacked, `npm run dev` running, and the migration applied to the dev database (`npm run migrate`):
1. Start "write the letter", 2 × 25/5. Open youtube.com: it is blocked (Writing preset). Screenshot the running popup.
2. `+ task` "research sources". Youtube opens now (Research allows it); x.com is blocked. Screenshot the popup showing "other tasks · write the letter · N min · switch".
3. Switch back. Youtube is blocked again, and a tab left on its blocked page stays there.
4. Stop. The popup shows two "Did you?", with identical buttons. Answer both, press Done, and the badge clears.
5. Open `/review/<first>`. "Also in this session" links the other task, and the paused sentence reads in words.
6. Open the ledger: one bar for the session, not two. On the dashboard, the session count went up by one.
7. The popup never animates at any step.

- [ ] **Step 3: Design floor**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs extension/popup.html extension/meant.css`
Expected: no new findings compared with `main`.

- [ ] **Step 4: Issue, PR, landing check**

```bash
gh issue create --title "Juggle tasks inside one session" --body "Plan C of docs/superpowers/specs/2026-09-23-five-asks-design.md (§4). ADR-0084. Migration 008 must be applied before deploy."
# gh project item-add 16 --owner ED3N-Ventures-Interns --url <issue-url>
git push -u origin HEAD
gh pr create --base main --title "One session, many tasks; blocks follow the active one" \
  --body "Closes #<issue>. Plan: docs/superpowers/plans/2026-09-23-task-juggling.md. ADR-0084. RELEASE ORDER: run npm run migrate (008-task-blocks.sql) against production BEFORE deploying. Verified: npm test, tsc, test:e2e, real-browser pass."
```

After merge: `git fetch origin && git merge-base --is-ancestor origin/<branch> origin/main && echo landed`.
