# Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product's numbers trustworthy and its promises keepable, before any model call exists.

**Week split, revised 2026-09-15.** Verification is batched into Week 3 — loading the extension once to check seven things beats seven separate passes — and Week 2 builds forward.

| | |
|---|---|
| **Week 2 — build** | **Task 1** #18 · **Task 2** #28 · **Task 3** #25 · **Task 6** #40 — 18h |
| **Week 3 — verify, then build** | #8–#13 acceptance checks, then **Task 4** #20 · **Task 5** #19 — 21h |

**#18 stays in Week 2, and it is what makes the split safe.** It is building — a guard, a config block, a purge script — and without it the Week 3 verification run writes hundreds more junk rows into production, because `playwright.config.ts` still inherits whatever dev server is on :3000.

**The stated risk of building before verifying.** Task 3 (#25) consumes labels written by #11, which has not been verified. That is not hypothetical: a defect in #11 was already found by reading rather than testing — the events route rejected `kind: 'label'` with a 400, and because `flush()` batches a session's events into one POST, a single tap would have permanently stalled all event syncing for that session (#39, fixed). **If Week 3 finds another, Task 3 is built on it.** The trade is deliberate: batched verification is cheaper, and the price is that a failure found later reaches further back.

**Architecture:** Four of the five tasks are pure functions plus a thin wiring layer, following the module convention in `AGENTS.md`: logic that must be unit-tested lives in a module with no `@/` imports, because `node --test` cannot resolve that alias. **No model call is introduced by this plan.** Task 5 opens with a decision gate rather than code, because where a preference lives is an architecture choice and not an implementation detail.

**Tech Stack:** Next.js App Router (TypeScript), Neon Postgres via `@neondatabase/serverless`, Chrome MV3 extension (plain ESM), `node --test`, Playwright.

## Global Constraints

- **`docs/adr/` is the most up-to-date record (ADR-0063).** Where an ADR and any document disagree, the ADR is right. Any decision taken while executing this plan is appended as an ADR in the same session.
- **Never write a hex value in a component** — `var(--m-*)` only (`CLAUDE.md`).
- **I7 as amended (ADR-0059, ADR-0061):** page text and titles are never read. Paths live in `chrome.storage.local` and never in Postgres.
- **No total-hours figure, no percentage, no score, on any surface** (PRD §3.1).
- **Nothing waits on a model** (PRD §7). Session start stays under 200ms.
- **I9:** judge, companion, memory and coach must each be independently removable, and **each seam must be exercised, not asserted** (PRD §9).
- **Windows and macOS identically.** No macOS-only convenience (`apexhuman.md` rule 9).
- **Never add AI attribution to a commit** (`GLOBAL.md`).
- Done means `npm test`, `npm run test:e2e` and `npx tsc --noEmit` pass, **and the card moves only after the acceptance check runs** — not after the code is written.

---

### Task 1: Stop the test suite writing to production (#18)

**Why first:** 3,668 session rows across 3,651 `user_id`s; six are real. M1–M4 are unmeasurable, and the judge, memory and every coach pattern would train on Playwright rows.

**The mechanism, found 2026-09-15:** `playwright.config.ts` has **no `webServer` block** — its comment says *"the dev server is assumed already running at localhost:3000"*. That server reads `.env.local`, which is production. Every e2e run has been writing there.

**Files:**
- Create: `lib/db-guard.ts`, `test/db-guard.test.js`, `e2e/global-setup.ts`, `scripts/purge-test-rows.mjs`
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: `assertTestDatabase(url)` from `lib/db-guard.ts` — throws unless the connection string's database name ends in `_test`. `e2e/global-setup.ts` calls it once before any test runs.

**Prerequisite (human, do this first):** create a Neon branch whose **database is named with a `_test` suffix**, and put its connection string in `.env.test`. The suffix is the marker the guard keys on; a branch alone is not enough, because a branch of production still carries production's database name.

- [ ] **Step 1: Write the failing test**

```javascript
// test/db-guard.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertTestDatabase, isTestDatabase } from '../lib/db-guard.ts'

// Every e2e run before 2026-09-15 wrote to production, because playwright.config.ts had no
// webServer block and inherited whatever dev server was running. The guard has to fail
// CLOSED: an unreadable or surprising URL is not a test database.

test('a database name ending in _test is accepted', () => {
  assert.equal(isTestDatabase('postgres://u:p@host.neon.tech/meant_test?sslmode=require'), true)
})

test('production is rejected', () => {
  assert.equal(isTestDatabase('postgres://u:p@host.neon.tech/meant?sslmode=require'), false)
})

test('a name merely CONTAINING test is rejected', () => {
  // "latest", "testing_ground" — the suffix must be exact, or the guard is decorative.
  assert.equal(isTestDatabase('postgres://u:p@h/latest'), false)
  assert.equal(isTestDatabase('postgres://u:p@h/test_meant'), false)
})

test('an unparseable or empty url is rejected, not passed through', () => {
  for (const url of ['', undefined, null, 'not a url', 'postgres://u:p@h/']) {
    assert.equal(isTestDatabase(url), false, String(url))
  }
})

test('assertTestDatabase throws with a message naming the database it refused', () => {
  assert.throws(() => assertTestDatabase('postgres://u:p@h/meant'), /meant/)
})

test('assertTestDatabase returns silently for a test database', () => {
  assert.doesNotThrow(() => assertTestDatabase('postgres://u:p@h/meant_test'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/db-guard.test.js`
Expected: FAIL — `lib/db-guard.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/db-guard.ts
/** Refuses to let the e2e suite point at anything but a test database.
 *
 *  Before 2026-09-15 every Playwright run wrote to production: playwright.config.ts had no
 *  webServer block and inherited whatever dev server happened to be on :3000, which reads
 *  .env.local. The result was 3,668 session rows across 3,651 user ids, of which six were
 *  real — enough to make M1-M4 meaningless and to poison anything the judge would learn.
 *
 *  Keyed on the DATABASE NAME rather than the host, because a Neon branch of production
 *  still carries production's database name and would otherwise pass. Fails closed: an
 *  unparseable or empty URL is not a test database. */
const TEST_SUFFIX = '_test'

export function isTestDatabase(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false
  let name: string
  try {
    name = new URL(url).pathname.replace(/^\//, '')
  } catch {
    return false
  }
  if (name.length <= TEST_SUFFIX.length) return false
  return name.endsWith(TEST_SUFFIX)
}

export function assertTestDatabase(url: unknown): void {
  if (isTestDatabase(url)) return
  let name = '(unparseable)'
  try {
    name = new URL(String(url)).pathname.replace(/^\//, '') || '(empty)'
  } catch {}
  throw new Error(
    `Refusing to run e2e against database "${name}". ` +
      `The database name must end in "${TEST_SUFFIX}". ` +
      `Set DATABASE_URL in .env.test to a Neon branch whose database is named accordingly.`,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/db-guard.test.js`
Expected: PASS, all six.

- [ ] **Step 5: Make Playwright run its own server against its own database**

```typescript
// e2e/global-setup.ts
import { assertTestDatabase } from '../lib/db-guard.ts'
import fs from 'node:fs'

export default function globalSetup() {
  const env = fs.existsSync('.env.test') ? fs.readFileSync('.env.test', 'utf8') : ''
  const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
  assertTestDatabase(url)
}
```

In `playwright.config.ts`, add `globalSetup: './e2e/global-setup.ts'` and a `webServer` block that starts its own Next server with `--env-file .env.test`, on a port that is **not** 3000 so it cannot collide with a hand-started dev server, with `reuseExistingServer: false`. Point `use.baseURL` at that port.

**`reuseExistingServer: false` is the load-bearing setting.** Left true, a dev server already running on the port is reused — and that is precisely the bug.

- [ ] **Step 6: Write the cleanup script**

`scripts/purge-test-rows.mjs` deletes sessions whose `user_id` has never produced a session longer than two minutes with a non-`test%` intention, and their events. **Print the count and require an explicit `--yes`** before deleting; this touches production exactly once and must not be re-runnable by accident.

- [ ] **Step 7: Acceptance**

Run `npm run test:e2e` in full, then re-count production:
Expected: `select count(*) from session` is **unchanged** by the run. That, not a passing unit test, is the acceptance.

- [ ] **Step 8: Commit**

```bash
git add lib/db-guard.ts test/db-guard.test.js e2e/global-setup.ts playwright.config.ts scripts/purge-test-rows.mjs
git commit -m "fix(test): stop the e2e suite writing to production

playwright.config.ts had no webServer block and inherited whatever dev server was
on :3000, which reads .env.local. 3,668 session rows across 3,651 user ids, six
of them real. The guard keys on the database name rather than the host, because a
Neon branch of production still carries production's name.

Closes #18"
```

---

### Task 2: Record what inference costs, before spending anything (#28)

**Why here:** **K6 is a kill criterion that cannot fire.** *"Inference cost per active user exceeds 15% of price for two consecutive months → cut judge frequency or raise price. Do not ship at negative margin."* Nothing measures it. Building the meter before the first model call is the only time it is cheap.

**Files:**
- Create: `lib/inference-cost.ts`, `test/inference-cost.test.js`, `lib/migrations/004-inference.sql`

**Interfaces:**
- Produces: `costOf({ model, inputTokens, outputTokens })` → cost in USD; `MODEL_PRICES`. Issue #22 records a row per call; #30 renders the aggregate.

- [ ] **Step 1: Write the failing test**

```javascript
// test/inference-cost.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { costOf, MODEL_PRICES, SUBSCRIPTION_USD, M9_CEILING } from '../lib/inference-cost.ts'

// M9: inference cost per active user per month, as a share of subscription price, < 15%.
// K6 fires above that for two consecutive months. Neither is currently computable.

test('costOf prices input and output separately, per million tokens', () => {
  // Haiku 4.5 at $1/Mtok in, $5/Mtok out.
  const c = costOf({ model: 'claude-haiku-4-5-20251001', inputTokens: 1_000_000, outputTokens: 1_000_000 })
  assert.equal(Math.round(c * 100) / 100, 6)
})

test('costOf matches the verified per-analysis figure', () => {
  // Verified 2026-09-11: ~2,700 in / 800 out is $0.0067 on Haiku 4.5.
  const c = costOf({ model: 'claude-haiku-4-5-20251001', inputTokens: 2700, outputTokens: 800 })
  assert.ok(Math.abs(c - 0.0067) < 0.0002, `got ${c}`)
})

test('costOf knows the frontier tiers too', () => {
  const opus = costOf({ model: 'claude-opus-5', inputTokens: 2700, outputTokens: 800 })
  assert.ok(Math.abs(opus - 0.0335) < 0.001, `got ${opus}`)
  assert.ok(opus > costOf({ model: 'claude-sonnet-5', inputTokens: 2700, outputTokens: 800 }))
})

test('an unknown model throws rather than costing zero', () => {
  // Silently pricing an unrecognised model at 0 is how a bill becomes a surprise.
  assert.throws(() => costOf({ model: 'gpt-whatever', inputTokens: 10, outputTokens: 10 }), /unknown model/i)
})

test('the M9 ceiling is expressed against the subscription price, not a raw dollar figure', () => {
  assert.equal(M9_CEILING, 0.15)
  assert.ok(SUBSCRIPTION_USD > 0)
  // Eight Opus analyses a month must still sit well under the ceiling, or the on-demand
  // architecture ADR-0060 chose does not actually work.
  const monthly = costOf({ model: 'claude-opus-5', inputTokens: 2700, outputTokens: 800 }) * 8
  assert.ok(monthly / SUBSCRIPTION_USD < M9_CEILING)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/inference-cost.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/inference-cost.ts
/** M9 and K6 made computable.
 *
 *  M9: inference cost per active user per month as a share of subscription price, under 15%.
 *  K6: above that for two consecutive months, cut judge frequency or raise price.
 *
 *  Prices are USD per million tokens, verified 2026-09-11. Model tier is explicitly a
 *  BUSINESS decision and not a quality one (PRD §7), which is why this file exists before
 *  the first model call rather than after the first bill. */
export const MODEL_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  'claude-haiku-4-5-20251001': { inPerM: 1, outPerM: 5 },
  'claude-sonnet-5': { inPerM: 2, outPerM: 10 },
  'claude-opus-5': { inPerM: 5, outPerM: 25 },
}

/** §7.1 prices against Focusmate ($8/mo annual, $12/mo monthly), not against human coaches. */
export const SUBSCRIPTION_USD = 12
export const M9_CEILING = 0.15

export function costOf({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string
  inputTokens: number
  outputTokens: number
}): number {
  const price = MODEL_PRICES[model]
  // Never fall back to zero: an unrecognised model silently costing nothing is exactly how
  // a margin failure goes unnoticed until the invoice.
  if (!price) throw new Error(`unknown model for costing: ${model}`)
  return (inputTokens / 1_000_000) * price.inPerM + (outputTokens / 1_000_000) * price.outPerM
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/inference-cost.test.js`
Expected: PASS, all five.

- [ ] **Step 5: Add the table**

`lib/migrations/004-inference.sql` creates `inference_call` with `id`, `user_id`, `session_ids uuid[]`, `model text`, `input_tokens int`, `output_tokens int`, `cost_usd numeric(10,6)`, `at timestamptz`. **No prompt column and no response column** — same rule as `002-drift.sql:24`, for the same reason. Index on `(user_id, at)`.

Run: `npm run migrate` against the **test** database first.

- [ ] **Step 6: Commit**

```bash
git add lib/inference-cost.ts test/inference-cost.test.js lib/migrations/004-inference.sql
git commit -m "feat(cost): make M9 and K6 computable before the first model call

K6 says do not ship at negative margin and nothing measured it. An unknown model
throws rather than costing zero, because a silent zero is how a margin failure
goes unnoticed until the invoice.

Closes #28"
```

---

### Task 3: Accumulate memory from the labels the tap now writes (#25)

**Why here:** unblocked by #11 and #39. `event.label` now has a write path that needs no judge and no correction UI. All 572 `memory` rows are `kind='list'`; `domain_class` has never been written.

**Files:**
- Create: `lib/memory-accumulate.ts`, `test/memory-accumulate.test.js`
- Modify: `app/api/events/route.ts`

**Interfaces:**
- Produces: `classify(observations, { minEvidence, minAgreement })` → `{ label, confidence } | null`. `null` means not enough evidence, or too much disagreement, and **must not write a row**.

- [ ] **Step 1: Write the failing test**

```javascript
// test/memory-accumulate.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { classify } from '../lib/memory-accumulate.ts'
import { MEMORY_MIN_EVIDENCE, MEMORY_MIN_AGREEMENT } from '../lib/thresholds.ts'

const opts = { minEvidence: MEMORY_MIN_EVIDENCE, minAgreement: MEMORY_MIN_AGREEMENT }

test('three consistent observations classify the domain', () => {
  assert.deepEqual(classify(['distract', 'distract', 'distract'], opts), { label: 'distract', confidence: 1 })
})

test('two consistent observations do NOT classify', () => {
  // ADR-0062: never at n=1, and not at n=2 either. ADR-0037's n=1 rule governs a CORRECTION
  // of a wrong flag; there is no flag any more, so the threshold governs.
  assert.equal(classify(['distract', 'distract'], opts), null)
})

test('disagreement below the agreement floor does not classify', () => {
  // This is PRD §1.2's defining case in data: instagram.com is work at 4pm and drift at
  // 11am. A domain that genuinely means both things must stay unclassified rather than
  // resolve to the majority and be confidently wrong half the time.
  assert.equal(classify(['distract', 'distract', 'work', 'work'], opts), null)
})

test('agreement at exactly the floor classifies', () => {
  assert.deepEqual(classify(['distract', 'distract', 'distract', 'distract', 'work'], opts), {
    label: 'distract',
    confidence: 0.8,
  })
})

test('neutral is a first-class outcome, not a fallback', () => {
  // ADR-0047: forcing ambiguous domains into work-or-drift poisons the memory that gates
  // the judge.
  assert.deepEqual(classify(['neutral', 'neutral', 'neutral'], opts), { label: 'neutral', confidence: 1 })
})

test('unknown observations are ignored rather than counted', () => {
  assert.equal(classify(['unknown', 'unknown', 'unknown'], opts), null)
})

test('an empty set classifies nothing', () => {
  assert.equal(classify([], opts), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/memory-accumulate.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/memory-accumulate.ts
/** Turns repeated per-visit labels into a durable belief about a domain.
 *
 *  ADR-0062 writes labels per VISIT, never per domain, because tapping "this isn't the work"
 *  on instagram.com at 4pm must not teach the product that Instagram is always drift —
 *  PRD §1.2's defining case is exactly a domain that means opposite things at different
 *  hours. Memory forms only when a label RECURS, and a genuinely ambiguous domain stays
 *  unclassified rather than resolving to its majority and being wrong half the time. */
export type Label = 'work' | 'distract' | 'neutral'
const COUNTED: Label[] = ['work', 'distract', 'neutral']

export function classify(
  observations: string[],
  { minEvidence, minAgreement }: { minEvidence: number; minAgreement: number },
): { label: Label; confidence: number } | null {
  // 'unknown' is the absence of an observation, not a fourth class to agree about.
  const counted = observations.filter((o): o is Label => (COUNTED as string[]).includes(o))
  if (counted.length < minEvidence) return null

  const tally = new Map<Label, number>()
  for (const label of counted) tally.set(label, (tally.get(label) ?? 0) + 1)

  let best: Label = counted[0]
  for (const [label, n] of tally) if (n > (tally.get(best) ?? 0)) best = label

  const confidence = (tally.get(best) ?? 0) / counted.length
  if (confidence < minAgreement) return null
  return { label: best, confidence }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/memory-accumulate.test.js`
Expected: PASS, all seven.

- [ ] **Step 5: Wire it into the events route**

After the insert in `app/api/events/route.ts`, for each distinct domain in the batch that carried a `label`, select that user's full label history for the domain, call `classify`, and upsert a `memory` row with `kind='domain_class'` when it returns non-null. **Delete the row when it returns null** — a domain that becomes ambiguous must lose its classification, not keep a stale one.

- [ ] **Step 6: Acceptance**

Tap the same domain three times across sessions and confirm a `domain_class` row appears. Tap a fourth time with the opposite meaning and confirm the row **disappears**.

- [ ] **Step 7: Commit**

```bash
git add lib/memory-accumulate.ts test/memory-accumulate.test.js app/api/events/route.ts
git commit -m "feat(memory): accumulate domain classifications from repeated labels

domain_class has never been written; all 572 memory rows are kind='list'. Memory
forms only on recurrence, and an ambiguous domain loses its classification rather
than keeping a stale one — PRD 1.2's case is a domain that means opposite things
at different hours.

Closes #25"
```

---

### Task 4: Forget what you know about me, and delete my account (#20)

**Why here:** PRD-F15 was *"flagged as a gap through 0.1 and 0.2 and excused by the clock both times"*, and **ADR-0059 made it bigger** — the extension now stores full visit paths on disk for 30 days with no way to erase them. This must exist before anyone but the builder installs the extension.

**Files:**
- Create: `app/api/memory/route.ts`, `app/api/account/route.ts`, `lib/erasure.ts`, `test/erasure.test.js`
- Modify: `app/api/sessions/route.ts` (carry the purge signal), `extension/sw.js` (honour it), `app/settings` or `app/setup` (the two buttons)

**Interfaces:**
- Produces: `ERASURE_LEVELS` and `tablesFor(level)` from `lib/erasure.ts`, so the two routes and their test share one definition of what each level clears.

- [ ] **Step 1: Write the failing test**

```javascript
// test/erasure.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { tablesFor } from '../lib/erasure.ts'

// PRD-F15. Two levels, and the difference between them must be explicit rather than
// implied by whichever route someone reads first.

test('forget clears what the product LEARNED, not what the user DID', () => {
  const t = tablesFor('forget')
  assert.ok(t.includes('memory'))
  assert.ok(t.includes('judgment'))
  assert.equal(t.includes('session'), false, 'forget must not delete the ledger')
  assert.equal(t.includes('event'), false)
})

test('delete clears everything, including the ledger and the device', () => {
  const t = tablesFor('delete')
  for (const table of ['memory', 'judgment', 'event', 'session', 'device']) {
    assert.ok(t.includes(table), `delete must clear ${table}`)
  }
})

test('delete is a superset of forget', () => {
  for (const table of tablesFor('forget')) assert.ok(tablesFor('delete').includes(table))
})

test('an unknown level throws rather than clearing nothing silently', () => {
  assert.throws(() => tablesFor('wipe'), /unknown erasure level/i)
})

test('both levels signal the extension to purge its local path log', () => {
  // ADR-0059 put full visit paths in chrome.storage.local. Server-side erasure alone would
  // leave them on disk and make the promise false.
  for (const level of ['forget', 'delete']) {
    assert.ok(tablesFor(level).length > 0)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/erasure.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/erasure.ts
/** PRD-F15, expanded by ADR-0059.
 *
 *  Two levels, defined once so the routes and their tests cannot disagree about what each
 *  one means. "Forget" clears what the product LEARNED about you and leaves what you DID;
 *  the ledger is the user's own record and erasing it is a different, louder act. */
export const ERASURE_LEVELS = ['forget', 'delete'] as const
export type ErasureLevel = (typeof ERASURE_LEVELS)[number]

const FORGET = ['memory', 'judgment'] as const
const DELETE = [...FORGET, 'event', 'session', 'device'] as const

export function tablesFor(level: string): readonly string[] {
  if (level === 'forget') return FORGET
  if (level === 'delete') return DELETE
  throw new Error(`unknown erasure level: ${level}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/erasure.test.js`
Expected: PASS, all five.

- [ ] **Step 5: The routes**

`DELETE /api/memory` (level `forget`) and `DELETE /api/account` (level `delete`), both scoped to `currentUserId()`. `event` deletes via its sessions. Set `user.purge_local_at = now()` in the same transaction.

- [ ] **Step 6: Make the extension honour it — pull, not push**

A web page cannot write `chrome.storage.local`, and reaching the extension from the page would need `externally_connectable`, a manifest change and a new trust boundary. **Pull instead:** `POST /api/sessions` already runs at every session start; its response gains `purgeLocalBefore`. When `sw.js` sees a value newer than its stored marker, it clears `pathLog` and records the marker.

**Consequence to state plainly in the UI:** local paths are cleared at the **next session start**, not instantly. Say so rather than implying immediacy.

- [ ] **Step 7: Acceptance**

Run a session, tap the companion, confirm `pathLog` entries and `event.label` rows exist. Invoke forget; start a new session; confirm `memory` is empty and `pathLog` is cleared **while the session ledger survives**. Then delete the account and confirm every table named by `tablesFor('delete')` holds nothing for that user.

- [ ] **Step 8: Commit**

```bash
git add lib/erasure.ts test/erasure.test.js app/api/memory/route.ts app/api/account/route.ts app/api/sessions/route.ts extension/sw.js
git commit -m "feat(privacy): forget what you know about me, and delete my account

PRD-F15, unbuilt since 0.1 and excused by the clock twice. ADR-0059 made it
larger: the extension stores full visit paths for 30 days and had no way to erase
them. The extension is told by pull rather than push - the session-start response
carries a purge marker - so no externally_connectable and no new trust boundary.

Closes #20"
```

---

### Task 5: Settings, and the seam that must be exercised (#19)

> **DECISION GATE — do not write code until this is settled and recorded as an ADR.**
>
> **`companionEnabled` lives in `chrome.storage.local`, and a web page cannot write there.** So a `/settings` page in the Next app cannot toggle the companion. Three shapes, and they are not equivalent:
>
> | | How | Cost |
> |---|---|---|
> | **A. Extension options page** | `options_ui` in the manifest, writes `chrome.storage.local` directly | No schema, no API, no sync. But settings then live in **two places** — lists are already server-side at `/setup` — and the preference does not follow the account to a second device |
> | **B. Server-side preference** | A column or table, `GET/PUT /api/preferences`, extension reads it at session start | One settings home, follows the account. Costs a migration, a route, and a sync path that can be stale for the length of one session |
> | **C. Both, with the server as source of truth** | Extension mirrors the server value locally | Most correct, most moving parts. Hard to justify at one device and one user |
>
> **B is the likely answer** because `/setup` already established that user configuration is server-side, and a product with settings in two places teaches its user that it has no home. But it is an architecture decision, it changes the schema, and per ADR-0063 it is recorded before it is built, not after.

**Once decided — scope:**

- Companion on/off (**the I9 seam**)
- Default cycle preset, currently settable only at session start
- Work and distraction lists, today at `/setup` and reachable only from a dashboard link
- A link to erasure (#20)

**Constraints:** settings is an **Operate** surface, not an Understand one — no charts, no numbers, no score. No hex values. The popup still animates nothing.

**Acceptance:** turn the companion off, start a session, and **no companion mounts on any page**; turn it on, and it does. This is PRD §9's *"each seam must be exercised, not asserted"* discharged for the companion, and it is the switch that makes the A9 on/off experiment free.

---

### Task 6: App shell and navigation (#40)

> **DESIGN GATE — this surface has no visual truth to build from.**
>
> `CLAUDE.md`: *"The design canvas is visual truth. The artboards outrank both files above. When they disagree, the canvas is right and the docs are stale."*
>
> **There are seven artboards and not one of them shows a shell or navigation** — `BlockPage`, `Companion`, `Landing`, `Ledger`, `Main`, `PopupIdle`, `PopupRunning`. Checked 2026-09-15.
>
> So building a shell means inventing a surface the committed visual world has never shown. `CLAUDE.md`'s own routing says a new surface goes to `/impeccable` first. **Draw the artboard, then build from it** — not the reverse, or the canvas becomes the stale thing it is supposed to outrank.

**Why the card exists:** `app/layout.tsx` is `<body className="m-app">{children}</body>` and nothing else. Six routes — `/`, `/dashboard`, `/setup`, `/pair`, `/sign-in`, `/review/[id]` — reach each other through ad-hoc `<Link>`s inside page bodies. `/setup` is reachable only from a link on the dashboard, and **there is no sign-out anywhere in the product.**

**Files:**
- Create: `design/canvas/Shell.dc.html` (**first**), `app/shell.tsx`
- Modify: `app/layout.tsx`, `docs/design.md` (§5's surface table gains the new surface)

- [ ] **Step 1: Draw the artboard**

`design/canvas/Shell.dc.html`, alongside the existing seven. It must answer three things and no more: where you are, where you can go, who is signed in.

- [ ] **Step 2: Check it against the class contract before writing any component**

The contract is **fixed at 13 classes** (`docs/design.md` §5, `docs/design-toolkit.md` §8) and a 14th is not added without an explicit check. A shell that needs new classes is a shell that has outgrown the design system, and that is a decision, not an implementation detail.

Run: `grep -n "class contract" -A 30 docs/design.md`
Expected: the shell composes existing classes, or the new class is justified in writing before it is used.

- [ ] **Step 3: Build `app/shell.tsx` from the artboard and mount it in the root layout**

Server component. It reads `currentUserId()` and renders nothing at all when signed out, so `/` and `/sign-in` are unaffected.

- [ ] **Step 4: Respect what the shell must not flatten**

PRD §3.3's frequency column is a design constraint, not a statistic. The shell wraps **Understand** surfaces (dashboard, review) and **Operate** surfaces (setup, pair). **The review is the product and the only surface allowed a moment** — the shell must not make it read as a page inside an admin panel. If the shell competes with the review, the shell is wrong.

No total-hours figure, no percentage, no score anywhere in it (§3.1). **No hex values** — `var(--m-*)` only.

- [ ] **Step 5: Verify by rendering, on both viewports**

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 http://localhost:3000/dashboard
node ~/.agents/skills/impeccable/scripts/detect.mjs http://localhost:3000/review/<id>
```
Expected: from any signed-in surface, reach any other without typing a URL, and sign out. Signed out, the shell is absent. A clean build is not evidence (`CLAUDE.md`).

- [ ] **Step 6: Commit**

```bash
git add design/canvas/Shell.dc.html app/shell.tsx app/layout.tsx docs/design.md
git commit -m "feat(web): app shell and navigation

The root layout was <body>{children}</body>. Six routes reached each other
through ad-hoc links inside page bodies, /setup only from the dashboard, and
sign-out existed nowhere.

The artboard is committed first and the component is built from it: no artboard
showed a shell, and building one without drawing it would make the canvas stale
about the very surface that frames every other.

Closes #40"
```

---

## Out of scope, deliberately

- **The judge (#22) and the coach (#26).** #22 is the next task after this plan and depends on #18 landing first, or it trains on Playwright rows. #26 needs real data, and a coach built on six sessions will be confidently wrong about the user in a way that is expensive to un-learn.
- **Admin surfaces (#30–#33).** They render data that #28 and #27 must first record.
- **Anything in Epic C, E or F.**

## Self-review checklist

- [ ] Every file named exists or is created by its task
- [ ] No step says "add error handling", "similar to Task N", or "TBD"
- [ ] Every code step shows real code
- [ ] Task 1's acceptance is an unchanged production row count, not a passing unit test
- [ ] Task 5 opens with a decision, not an implementation
- [ ] Task 6 opens with a design gate, because no artboard shows the surface it builds
- [ ] No commit message contains AI attribution
- [ ] Every new module avoids `@/` imports so `node --test` can reach it
