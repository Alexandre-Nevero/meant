# The Verdict Taxonomy — Implementation Plan (Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **UNBLOCKED, with a caveat:** `docs/superpowers/specs/2026-09-21-judge-spike-findings.md`
> now exists. Read it before Task 1. **It ran on a synthetic, self-labelled corpus** (the
> real path log covered only 2 sessions, well under the plan's own 15-session floor) — it
> shows the mechanism *can* work and that `supportive` is separable, but its own
> recommendation section says not to treat that as sufficient evidence for a real schema
> commitment on its own. Owner decision 2026-09-22: proceed anyway, on the judgment that a
> reversible schema migration (Task 2's own commit message records the exact row counts,
> and every value stays additive until Task 4 flips the readers) is worth the smaller
> deviation cost against the value of unblocking real agentic features sooner. If the
> findings had said the judge cannot beat the declaration baseline, this plan would still be
> cancelled, not deferred — that finding did not occur.

**Goal:** Record the three remaining decisions the judge's build depends on, and move the product's label vocabulary from the tap era (`work`/`distract`) to the judge's, while the tables that would make it expensive are still empty.

**Architecture:** No model call ships here and no user-visible surface changes. Two things happen. Three ADRs are written — the vocabulary, analysis idempotency, and whether the judge may write memory — each against the spike's evidence rather than ahead of it. (A fourth decision this plan originally intended to record here — the free/paid line — is instead ADR-0075, written standalone on 2026-09-22, suspending premium for the testing phase; see Global Constraints.) Then `event.label` migrates, `judgment.verdict` is dropped as redundant, `memory-accumulate.ts` starts counting taps and verdicts separately with a tap veto, and the app and extension move onto the new words with the old ones still accepted on the wire.

**Why now and not later:** `judgment` has never received a row and `memory.domain_class` has never been written (PRD §6, verified 2026-09-11), so only `event.label`'s tap rows move. One migration, no data at risk — **today**. The day the judge ships, this stops being free.

**Tech Stack:** Next.js 16 App Router · Neon Postgres (`@neondatabase/serverless`) · plain ES-module MV3 extension, no bundler · `node --test` · Playwright.

## Global Constraints

- **`docs/adr/` is canonical (ADR-0063).** Where an ADR and any other document disagree, the ADR is right; reconcile the other document, never silently pick one.
- **An ADR records a decision already taken, never a proposal.** One decision per file, append-only, never edited after acceptance.
- **TDD is mandatory** (`AGENTS.md`): a failing test before every behaviour change.
- **Definition of done:** `npm test`, `npm run test:e2e` and `npx tsc --noEmit` all pass.
- **Every PR links a GitHub Project 16 issue** (`Closes #NN`). Create it with `gh issue create` and add it to Project 16 if it does not exist, before opening the PR.
- **Never add AI or assistant attribution to a commit message.**
- **`lib/` holds pure functions with no `@/` imports** so `node --test` can run them directly.
- **Migrations are numbered and applied manually** with `npm run migrate`. `lib/migrate.mjs` strips `--` comments then splits on `;` — never put a `;` inside a string literal in a migration.
- Migration file for this plan is **`lib/migrations/006-verdict-taxonomy.sql`**. Do not reuse 001–005 (verified still free as of 2026-09-22).
- **ADR numbers here are 0076–0078.** Earlier drafts of this plan assumed Plan 1 took ADR-0070/0071 and that this plan would take 0072–0075 — both wrong. Plan 1 (the judge spike) actually took **ADR-0072** (Groq provider) and **ADR-0073** (the eval is the gate), renumbered from 0070/0071 during execution because those collided with unrelated, concurrently-merged companion-overlay work (which itself ended up at ADR-0070, ADR-0071 and ADR-0074). **ADR-0075** (premium suspended for the testing phase) was written standalone on 2026-09-22, superseding this plan's original Task 1 Step 5/Task 5 pricing decision. This plan's three remaining ADRs are therefore **0076, 0077, 0078** — the next free numbers as of 2026-09-22. Confirm before Task 1: `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -5` should show 0074 and 0075 as the two highest existing numbers, with nothing at 0076+.

---

### Task 1: Write the three remaining ADRs, against the spike's evidence

**Files:**
- Create: `docs/adr/ADR-0076-verdict-vocabulary.md`
- Create: `docs/adr/ADR-0077-an-analysis-is-a-frozen-artifact.md`
- Create: `docs/adr/ADR-0078-the-judge-may-write-memory-separately-from-taps.md`
- Modify: `docs/index.md` (§6 decision table — add D76–D78; D75 already added by the standalone premium-suspension ADR, PR #67)

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-09-21-judge-spike-findings.md`.
- Produces: the decision record Tasks 2–5 cite.

- [ ] **Step 1: Read the findings and the house style**

Run: `cat docs/superpowers/specs/2026-09-21-judge-spike-findings.md && cat docs/adr/ADR-0066-one-claim-about-the-user-at-a-time.md`

Field order in every ADR: `**Date:**`, `**Status:**`, `**Supersedes:**` (only where one applies), `**Context:**`, `**Decision:**`, `**Consequences:**`, `**Source:**`.

**If the findings say `supportive` was not separable, the label set below is three, not four** — `focused` / `neutral` / `drift` — and every later task in this plan drops `supportive_n` and the `supportive` enum value with it. Make that change here, once, and carry it through.

- [ ] **Step 2: Write ADR-0076 — the verdict vocabulary**

Date 2026-09-21. Status Accepted. Supersedes the `serves`/`drifts`/`unclear` wording in PRD-F9 and ADR-0060.

Context: three enums described one fact — `event.label` (`work|distract|neutral|unknown`), `judgment.label` (same), and `judgment.verdict` (`serves|drifts|unclear`). None could express the case the judge exists for: `chatgpt.com` open to draft a proposal is not the proposal, and `docs.google.com` open for reference is not the writing. Both collapse to `work` today.

Decision: the judge emits **`focused`** (directly performs the task), **`supportive`** (helps accomplish it but is not it), **`neutral`** (genuinely neither), **`drift`** (unrelated activity replacing the intended work), plus **`unknown`**, which is not a verdict but the below-confidence floor. `work` becomes `focused`, `distract` becomes `drift`, everywhere.

Two boundaries held on purpose:

- **`break` is not a verdict.** `event.kind = 'break'` exists (`002-drift.sql`) and is *declared* by the cycle timer (ADR-0045). A judge able to emit it could contradict the timer, so break events never reach the prompt.
- **`neutral` and `unknown` stay distinct**, as ADR-0047 decided and for its reason: *"forcing ambiguous domains into work-or-drift poisons the memory that gates the judge."* `neutral` is a positive finding; `unknown` is the absence of one. Collapsing them feeds the judge's own low-confidence noise into the tally that gates the judge.

Cite the spike's measured precision for each label here — this decision is downstream of it, and the numbers are the reason it is defensible.

Consequences: one migration while it is free. `supportive` has nothing to migrate: a tap means one thing (ADR-0058) and cannot mean "supportive"; only the judge emits it. `judgment.verdict` is dropped as redundant. Rendering four labels on one figure collides with `PRODUCT.md`'s *"no figure carries a colour that grades it"* — the split is separated by tone inside the existing terracotta family, never by hue, and that is settled on the design canvas in Plan 4, not here.

Source: owner decision 2026-09-21; the judge spike findings.

- [ ] **Step 3: Write ADR-0077 — an analysis is a frozen artifact**

Date 2026-09-21. Status Accepted.

Context: the model is not deterministic. Running the same batch twice can label the same visit `focused` then `drift`. `judgment` has no unique key, so a second run inserts a second set of rows beside the first and nothing says which is true. Premium is currently suspended (ADR-0075), so there is no quota to burn today — but idempotency is still the right decision, since a re-run silently rewriting the user's own record is wrong regardless of whether it costs anything, and the day quota returns this same design pays for it a second time for free.

Decision: **an analysis is a stored artifact identified by the set of sessions it covers, not a query that re-runs.** Opening an already-analysed set returns the stored analysis, costs nothing and consumes no quota (when quota exists again). Re-analysis exists only as an explicit user act, creates a new analysis row, and consumes quota like any other (once ADR-0075's suspension ends).

Consequences: an `analysis` table and a `judgment.analysis_id` foreign key land in Plan 3, where something writes to them. The user's record stops being able to rewrite itself, which is the property that makes it a record. The reopen path is the cheapest thing in the product and should be the common one.

Source: owner decision 2026-09-21.

- [ ] **Step 4: Write ADR-0078 — the judge may write memory, separately from taps**

Date 2026-09-21. Status Accepted. Amends ADR-0039/D32 (*"only user taps write memory"*).

Context: ADR-0039 made taps the sole writer of memory. Memory gates the judge (I4) and is the accuracy story and the margin story in one feature — so under ADR-0039 it learns only as fast as the user labels, and the user has to tap, and tap, and tap. That is a decision, not a gap.

Decision: **the judge may write memory, into a tally kept separate from the user’s taps, and the user’s word is never overridden.** `memory.value` for `domain_class` becomes `{ taps: Counts, verdicts: Counts, last_at }` where `Counts` is `{focused_n, supportive_n, neutral_n, drift_n}`. Resolution order:

1. If **taps** clear `MEMORY_MIN_EVIDENCE` (3) and `MEMORY_MIN_AGREEMENT` (0.8), that is the classification.
2. Otherwise, if **verdicts** clear `MEMORY_MIN_VERDICTS` and `MEMORY_MIN_AGREEMENT`, **and no tap records a different label**, that is the classification.
3. Otherwise none, and the domain loses any classification it had.

Rule 2’s veto is what makes this safe: a single contrary tap, even at n=1, blocks the judge from classifying against the user — while still not letting one tap *assert* anything alone, which is ADR-0062 unchanged.

Consequences: memory grows without the user doing anything, which is the point. Counts are per source rather than summed, so *"the user told us"* stays answerable forever; a weighted single integer would have destroyed that to save one field. `MEMORY_MIN_VERDICTS` starts at 8 and is explicitly a **starting value re-tuned against the eval** — the honest basis is that a model opinion is worth less than a deliberate human act, not that eight was measured. The tap survives as a *correction* channel rather than a *collection* channel, which is what makes tapping rare.

Source: owner decision 2026-09-21; ADR-0053 (the evidence bar scales with the cost of being wrong).

- [ ] **~~Step 5: Write ADR-0075 — three analyses free, then paid~~ — dropped, do not execute**

This step is struck, not renumbered. ADR-0075 already exists (written standalone, 2026-09-22, PR #67): **premium is suspended for the testing phase**, not priced. There is no free/paid line to record here while that ADR's Status is Accepted — writing one now would contradict an already-accepted ADR, which ADR-0063 forbids (append-only; supersede, never contradict). When the testing phase ends, ending it is its own ADR, written then, against real usage data — not this step, resurrected.

- [ ] **Step 6: Add D76–D78 to `docs/index.md` §6**

One row per ADR, matching the format of the rows already there: `| **D76** | **<one-line decision>** | 2026-09-21 | ADR-0076 |`. (D75 is already present, added by the standalone premium-suspension ADR.)

- [ ] **Step 7: Commit**

```bash
git add docs/adr/ADR-0076-verdict-vocabulary.md docs/adr/ADR-0077-an-analysis-is-a-frozen-artifact.md docs/adr/ADR-0078-the-judge-may-write-memory-separately-from-taps.md docs/index.md
git commit -m "docs(adr): record the taxonomy, idempotency and memory decisions (ADR-0076..0078)"
```

---

### Task 2: Migrate the label vocabulary in the database

**Files:**
- Create: `lib/migrations/006-verdict-taxonomy.sql`
- Test: none (migrations are verified by running them; the code that reads the new values is tested in Tasks 3 and 4)

**Interfaces:**
- Consumes: ADR-0076.
- Produces: `event.label` rows holding `focused` / `drift` / `neutral` / `unknown`; `judgment` without a `verdict` column.

- [ ] **Step 1: Check what is actually in the column first**

Run: `npm run migrate -- --help 2>/dev/null; psql "$DATABASE_URL" -c "select label, count(*) from event group by label order by 2 desc;"`

Expected: a small set of rows, `work` / `distract` / `neutral` / `unknown` / null. Record the counts in the commit message. If any value appears that is not in that list, **stop and report it** — the migration below would leave it untouched and the new `LABELS` check in Task 4 would then reject that row's re-submission.

- [ ] **Step 2: Write the migration**

Create `lib/migrations/006-verdict-taxonomy.sql`:

```sql
-- ADR-0076. The judge's verdict vocabulary replaces the tap-era one.
--
-- work -> focused, distract -> drift. `neutral` and `unknown` are unchanged and keep the
-- distinction ADR-0047 drew on purpose: `neutral` is a positive finding (genuinely neither
-- work nor drift), `unknown` is the absence of one (the judge's below-confidence floor).
-- Collapsing them would feed the judge's own low-confidence noise into the tally that gates
-- the judge.
--
-- `supportive` is new and has nothing to migrate. It is a judge verdict only: a tap means
-- exactly one thing, "this isn't the work" (ADR-0058), and cannot mean "supportive".
--
-- Both statements are no-ops on a second run, so this is safe to re-apply.
update event set label = 'focused' where label = 'work';
update event set label = 'drift'   where label = 'distract';

-- `judgment.verdict` (serves|drifts|unclear) and `judgment.label` (work|distract|neutral|
-- unknown) were two enums for one fact. The table has never received a row from any code
-- path (PRD 6, verified 2026-09-11), so dropping the redundant column costs nothing now and
-- stops the two drifting apart later. `judgment.label` carries the new vocabulary.
alter table judgment drop column if exists verdict;

-- `signalled`, `gate` and `corrected_to` are deliberately LEFT IN PLACE. They belong to the
-- live-signal design ADR-0057 deleted, and M7 currently has no definition (flow Q4, open).
-- Removing them is a separate decision and does not belong in a taxonomy migration.
```

- [ ] **Step 3: Apply it and verify**

Run: `npm run migrate`
Expected: `  apply 006-verdict-taxonomy.sql`

Run: `psql "$DATABASE_URL" -c "select label, count(*) from event group by label order by 2 desc;"`
Expected: no row with `work` or `distract`; the counts previously on `work` now on `focused` and those on `distract` now on `drift`.

Run: `psql "$DATABASE_URL" -c "\d judgment"`
Expected: no `verdict` column; `label`, `confidence`, `source`, `signalled`, `gate`, `corrected_to` still present.

- [ ] **Step 4: Confirm it is idempotent**

Run: `psql "$DATABASE_URL" -c "update event set label = 'focused' where label = 'work'; alter table judgment drop column if exists verdict;"`
Expected: `UPDATE 0` and no error.

- [ ] **Step 5: Commit**

```bash
git add lib/migrations/006-verdict-taxonomy.sql
git commit -m "feat(db): migrate event.label to the verdict vocabulary, drop judgment.verdict (ADR-0076)"
```

---

### Task 3: Reshape memory so taps and verdicts are counted separately

`lib/memory-accumulate.ts` currently folds every observation into one flat tally of three columns. ADR-0078 requires two tallies over four labels, with the user's taps able to veto the judge.

**Files:**
- Modify: `lib/memory-accumulate.ts` (whole file)
- Modify: `lib/thresholds.ts` (add `MEMORY_MIN_VERDICTS`)
- Test: `test/memory-accumulate.test.js` (whole file)

**Interfaces:**
- Consumes: ADR-0078; `MEMORY_MIN_EVIDENCE = 3` and `MEMORY_MIN_AGREEMENT = 0.8` from `lib/thresholds.ts`, unchanged.
- Produces, for Task 4 and for the judge's plan:
  - `type Label = 'focused' | 'supportive' | 'neutral' | 'drift'`
  - `type Counts = { focused_n: number; supportive_n: number; neutral_n: number; drift_n: number }`
  - `type Tally = { taps: Counts; verdicts: Counts; last_at: number }`
  - `const EMPTY_TALLY: Tally`
  - `tally(observations: string[], at: number, source: 'tap' | 'verdict', prior?: Tally): Tally`
  - `classify(t: Tally, opts: { minEvidence: number; minAgreement: number; minVerdicts: number }): { label: Label; confidence: number; evidence_n: number; source: 'tap' | 'verdict' } | null`

- [ ] **Step 1: Add the new threshold**

In `lib/thresholds.ts`, directly beneath the existing `MEMORY_MIN_EVIDENCE` / `MEMORY_MIN_AGREEMENT` block, add:

```ts
/** ADR-0078. Verdicts may classify a domain, but at a higher bar than taps, because a model
 *  opinion is worth less than a deliberate human act. Eight is a STARTING VALUE, not a
 *  measured one — the eval re-tunes it, and nothing should treat it as settled until it has.
 *  A single contrary tap vetoes a verdict classification regardless of this number. */
export const MEMORY_MIN_VERDICTS = 8
```

- [ ] **Step 2: Write the failing tests**

Replace the whole of `test/memory-accumulate.test.js` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { tally, classify, EMPTY_TALLY } from '../lib/memory-accumulate.ts'

// Deliberately literal, unlike the old version of this file, which imported the constants.
// These tests exercise the FUNCTION's rules; re-tuning MEMORY_MIN_VERDICTS against the eval
// (ADR-0078 says it will be) must not silently rewrite what the tests assert.
const opts = { minEvidence: 3, minAgreement: 0.8, minVerdicts: 8 }
const taps = (labels, at = 1, prior) => tally(labels, at, 'tap', prior)
const verdicts = (labels, at = 1, prior) => tally(labels, at, 'verdict', prior)

test('taps and verdicts accumulate into separate counts', () => {
  const t = verdicts(['focused'], 2, taps(['drift', 'drift'], 1))
  assert.equal(t.taps.drift_n, 2)
  assert.equal(t.verdicts.focused_n, 1)
  assert.equal(t.taps.focused_n, 0)
  assert.equal(t.verdicts.drift_n, 0)
})

test('last_at is the latest observation across both sources', () => {
  const t = verdicts(['focused'], 50, taps(['drift'], 900))
  assert.equal(t.last_at, 900)
})

test('unknown is dropped, not counted as a fourth class', () => {
  const t = verdicts(['unknown', 'drift'], 1)
  assert.equal(t.verdicts.drift_n, 1)
  assert.equal(Object.values(t.verdicts).reduce((a, b) => a + b, 0), 1)
})

test('supportive is a first-class count', () => {
  assert.equal(verdicts(['supportive', 'supportive'], 1).verdicts.supportive_n, 2)
})

test('three agreeing taps classify', () => {
  assert.deepEqual(classify(taps(['drift', 'drift', 'drift'], 1), opts), {
    label: 'drift',
    confidence: 1,
    evidence_n: 3,
    source: 'tap',
  })
})

test('two taps are not enough', () => {
  assert.equal(classify(taps(['drift', 'drift'], 1), opts), null)
})

test('taps below 80% agreement do not classify', () => {
  assert.equal(classify(taps(['drift', 'drift', 'focused', 'focused'], 1), opts), null)
})

test('seven verdicts are not enough; eight are', () => {
  const seven = verdicts(Array(7).fill('focused'), 1)
  assert.equal(classify(seven, opts), null)
  const eight = verdicts(['focused'], 2, seven)
  assert.deepEqual(classify(eight, opts), {
    label: 'focused',
    confidence: 1,
    evidence_n: 8,
    source: 'verdict',
  })
})

test('a single contrary tap vetoes a verdict classification', () => {
  const t = taps(['drift'], 2, verdicts(Array(8).fill('focused'), 1))
  assert.equal(classify(t, opts), null)
})

test('a tap agreeing with the verdicts does not veto them', () => {
  const t = taps(['focused'], 2, verdicts(Array(8).fill('focused'), 1))
  assert.equal(classify(t, opts).label, 'focused')
  assert.equal(classify(t, opts).source, 'verdict')
})

test('taps win outright once they clear their own bar', () => {
  const t = taps(['drift', 'drift', 'drift'], 2, verdicts(Array(20).fill('focused'), 1))
  assert.deepEqual(classify(t, opts), {
    label: 'drift',
    confidence: 1,
    evidence_n: 3,
    source: 'tap',
  })
})

test('a domain that becomes contested loses its classification', () => {
  const settled = taps(['drift', 'drift', 'drift'], 1)
  assert.equal(classify(settled, opts).label, 'drift')
  const contested = taps(['focused', 'focused', 'focused'], 2, settled)
  assert.equal(classify(contested, opts), null)
})

test('EMPTY_TALLY classifies as nothing', () => {
  assert.equal(classify(EMPTY_TALLY, opts), null)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/memory-accumulate.test.js`
Expected: FAIL — the first assertion reads `t.taps.drift_n` and the current `tally` returns a flat `{work_n, distract_n, neutral_n, last_at}`, so `t.taps` is `undefined`.

- [ ] **Step 4: Rewrite the implementation**

Replace the whole of `lib/memory-accumulate.ts` with:

```ts
/** Turns observations about a domain into a durable belief about it.
 *
 *  ADR-0062: the companion's tap writes the VISIT, never the site. Memory forms only when a
 *  label recurs, because PRD §1.2's defining case is a domain that means opposite things at
 *  different hours — Instagram at 4pm is the job, Instagram at 11am is avoidance.
 *
 *  ADR-0078 AMENDS ADR-0039/D32, which made taps the sole writer of memory. Under that rule
 *  memory could only learn as fast as the user labelled, which made the user tap and tap.
 *  The judge may now write too — but into a SEPARATE tally, never summed with the taps, so
 *  "the user told us" stays answerable forever. A weighted single integer would have thrown
 *  that away to save one field.
 *
 *  ADR-0076: the vocabulary is focused | supportive | neutral | drift. `unknown` is the
 *  judge's below-confidence floor and is the ABSENCE of an observation, not a fifth class to
 *  disagree about, so it is dropped rather than counted.
 */
export type Label = 'focused' | 'supportive' | 'neutral' | 'drift'
export type Source = 'tap' | 'verdict'
export type Counts = { focused_n: number; supportive_n: number; neutral_n: number; drift_n: number }
export type Tally = { taps: Counts; verdicts: Counts; last_at: number }

const EMPTY_COUNTS: Counts = { focused_n: 0, supportive_n: 0, neutral_n: 0, drift_n: 0 }
export const EMPTY_TALLY: Tally = { taps: EMPTY_COUNTS, verdicts: EMPTY_COUNTS, last_at: 0 }

const COLUMN: Record<Label, keyof Counts> = {
  focused: 'focused_n',
  supportive: 'supportive_n',
  neutral: 'neutral_n',
  drift: 'drift_n',
}

const total = (c: Counts) => c.focused_n + c.supportive_n + c.neutral_n + c.drift_n

const pairs = (c: Counts): [Label, number][] => [
  ['focused', c.focused_n],
  ['supportive', c.supportive_n],
  ['neutral', c.neutral_n],
  ['drift', c.drift_n],
]

/** Folds new observations from ONE source onto an existing tally. Returns a new object;
 *  never mutates, because the caller round-trips this through Postgres and a mutated
 *  reference would hide the write. */
export function tally(
  observations: string[],
  at: number,
  source: Source,
  prior: Tally = EMPTY_TALLY,
): Tally {
  const key = source === 'tap' ? 'taps' : 'verdicts'
  const next: Counts = { ...(prior[key] ?? EMPTY_COUNTS) }
  for (const observation of observations) {
    const column = COLUMN[observation as Label]
    if (column) next[column] = next[column] + 1
  }
  return {
    taps: key === 'taps' ? next : { ...(prior.taps ?? EMPTY_COUNTS) },
    verdicts: key === 'verdicts' ? next : { ...(prior.verdicts ?? EMPTY_COUNTS) },
    last_at: Math.max(prior.last_at ?? 0, at),
  }
}

function winner(c: Counts, minEvidence: number, minAgreement: number) {
  const n = total(c)
  if (n < minEvidence) return null
  const [label, count] = pairs(c).reduce((best, cur) => (cur[1] > best[1] ? cur : best))
  const confidence = count / n
  if (confidence < minAgreement) return null
  return { label, confidence, evidence_n: n }
}

/** The belief, or null when there is not enough evidence or too much disagreement.
 *
 *  null is meaningful and the caller must act on it: a domain that BECOMES contested has to
 *  lose its stored classification, because a stale verdict on a site whose meaning changed
 *  is worse than no verdict at all.
 *
 *  ADR-0078's resolution order, and the veto is the part that makes this safe to ship: a
 *  single contrary tap blocks the judge from classifying against the user, at n=1, while
 *  still not letting that one tap assert anything on its own (ADR-0062, unchanged). */
export function classify(
  t: Tally,
  { minEvidence, minAgreement, minVerdicts }: { minEvidence: number; minAgreement: number; minVerdicts: number },
): { label: Label; confidence: number; evidence_n: number; source: Source } | null {
  const taps = t.taps ?? EMPTY_COUNTS
  const fromTaps = winner(taps, minEvidence, minAgreement)
  if (fromTaps) return { ...fromTaps, source: 'tap' }

  const fromVerdicts = winner(t.verdicts ?? EMPTY_COUNTS, minVerdicts, minAgreement)
  if (!fromVerdicts) return null

  // The veto. Any tap on a DIFFERENT label means the user has said otherwise, and the user
  // is never overridden by a model.
  const contrary = pairs(taps).some(([label, n]) => n > 0 && label !== fromVerdicts.label)
  if (contrary) return null

  return { ...fromVerdicts, source: 'verdict' }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/memory-accumulate.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 6: Check nothing else in the suite broke**

Run: `node --test`
Expected: PASS. `lib/memory-accumulate.ts` has exactly two consumers — this test file and `app/api/events/route.ts:3` (verified 2026-09-21; `test/tally.test.js` imports `extension/lib/tally.js` and is unrelated). The route is not exercised by `node --test`, so the suite stays green here and Task 4 fixes the route's compile.

Run: `npm run build`
Expected: FAIL — `app/api/events/route.ts` passes three arguments to `tally` and options without `minVerdicts`. That is Task 4's work; do not fix it here.

- [ ] **Step 7: Commit**

```bash
git add lib/memory-accumulate.ts lib/thresholds.ts test/memory-accumulate.test.js
git commit -m "feat(memory): count taps and verdicts separately, with a tap veto (ADR-0078)"
```

---

### Task 4: Move the app and the extension onto the new vocabulary

The rename touches four call sites and must accept the **old** values on the wire for a transition window, because extensions update on Chrome's schedule and not ours.

**Files:**
- Modify: `app/api/events/route.ts:11` (`LABELS`) and `:61-100` (`accumulateMemory`)
- Modify: `extension/lib/visit-label.js:35`
- Modify: `lib/dashboard-figures.ts:96`
- Test: `test/visit-label.test.js`, `test/event-kinds.test.js`, `test/dashboard-figures.test.js`

**Interfaces:**
- Consumes: `tally` / `classify` / `EMPTY_TALLY` / `Tally` from Task 3; `MEMORY_MIN_VERDICTS` from `lib/thresholds.ts`.
- Produces: `POST /api/events` accepting `focused | supportive | neutral | drift | unknown` and, transitionally, `work | distract`, normalising the latter before any write.

**Do not rename these — they are a different namespace.** `extension/popup.js` uses `'work'` and `'distract'` for *site lists* (`workSites`, `distractSites`, lines 338, 339, 412, 424) and `'work'` for a *cycle phase* (lines 232, 273, 506). None of those is an event label. Touching them breaks the popup and the site-list API.

- [ ] **Step 1: Write the failing tests**

In `test/visit-label.test.js`, change every occurrence of `label: 'distract'` to `label: 'drift'` (lines 20, 28, 64) and the assertion on line 68 to `assert.equal(events[0].label, 'drift')`.

In `test/event-kinds.test.js:15`, change `label: 'distract'` to `label: 'drift'`.

In `test/dashboard-figures.test.js`, change line 38's `label: 'work'` to `label: 'focused'` and line 39's `label: 'distract'` to `label: 'drift'`.

Then create `test/label-vocabulary.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLabel, LABELS } from '../lib/label-vocabulary.ts'

test('the new vocabulary passes through unchanged', () => {
  for (const label of ['focused', 'supportive', 'neutral', 'drift', 'unknown']) {
    assert.equal(normalizeLabel(label), label)
  }
})

test('the tap-era vocabulary is accepted and normalised', () => {
  // An installed extension keeps sending these until Chrome ships the update. Rejecting
  // them 400s the whole batch, and because nothing is then marked sent, every attention
  // and away event for that session requeues and retries forever with the same payload.
  assert.equal(normalizeLabel('work'), 'focused')
  assert.equal(normalizeLabel('distract'), 'drift')
})

test('anything else is rejected', () => {
  assert.equal(normalizeLabel('productive'), null)
  assert.equal(normalizeLabel(''), null)
  assert.equal(normalizeLabel(undefined), null)
})

test('LABELS is the accepted wire set, old and new', () => {
  assert.deepEqual(
    [...LABELS].sort(),
    ['distract', 'drift', 'focused', 'neutral', 'supportive', 'unknown', 'work'],
  )
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/label-vocabulary.test.js`
Expected: FAIL — `Cannot find module '../lib/label-vocabulary.ts'`.

- [ ] **Step 3: Create the vocabulary module**

Create `lib/label-vocabulary.ts`:

```ts
/** ADR-0076's vocabulary, plus the transition from the tap-era one.
 *
 *  This exists because of the warning already written above KINDS in app/api/events/route.ts:
 *  flush() batches all of a session's queued events into one POST, so a value this list
 *  rejects fails the WHOLE batch — and because nothing is then marked sent, every attention
 *  and away event for that session requeues and retries forever with the same payload.
 *
 *  An installed extension keeps sending `distract` until Chrome ships the update, which is
 *  not on our schedule. So the wire accepts both and normalises on the way in; the database
 *  only ever holds the new values.
 *
 *  Remove `work` and `distract` from ACCEPTED once telemetry shows no client sending them —
 *  and not before. */
export type Label = 'focused' | 'supportive' | 'neutral' | 'drift'
export type WireLabel = Label | 'unknown'

const ALIASES: Record<string, WireLabel> = { work: 'focused', distract: 'drift' }
const CURRENT: WireLabel[] = ['focused', 'supportive', 'neutral', 'drift', 'unknown']

export const LABELS: readonly string[] = [...CURRENT, ...Object.keys(ALIASES)]

/** Returns the canonical label, or null when the value is not one we accept. */
export function normalizeLabel(value: unknown): WireLabel | null {
  if (typeof value !== 'string') return null
  if ((CURRENT as string[]).includes(value)) return value as WireLabel
  return ALIASES[value] ?? null
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/label-vocabulary.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into the events route**

In `app/api/events/route.ts`, replace line 11's `const LABELS = ['work', 'distract', 'neutral', 'unknown']` with an import at the top of the file:

```ts
import { LABELS, normalizeLabel } from '@/lib/label-vocabulary'
import { MEMORY_MIN_EVIDENCE, MEMORY_MIN_AGREEMENT, MEMORY_MIN_VERDICTS } from '@/lib/thresholds'
```

In the validation loop, replace the label check with a normalising one, so the value written to the database is always canonical:

```ts
    if (e.label != null) {
      const normalized = normalizeLabel(e.label)
      if (normalized === null) return Response.json({ error: 'bad label' }, { status: 400 })
      e.label = normalized
    }
```

In `accumulateMemory`, the tap is now an explicitly sourced observation and the options gain the verdict bar:

```ts
  const opts = {
    minEvidence: MEMORY_MIN_EVIDENCE,
    minAgreement: MEMORY_MIN_AGREEMENT,
    minVerdicts: MEMORY_MIN_VERDICTS,
  }
```

and the fold becomes:

```ts
      // 'tap': this path only ever handles kind === 'label', which is the companion's
      // one-tap self-report (ADR-0058). The judge writes verdicts through its own path.
      const next: Tally = tally(labels, at, 'tap', (row?.value as Tally) ?? EMPTY_TALLY)
```

Leave the `delete`-on-null branch, the `on conflict` upsert and the `try/catch` exactly as they are — the semantics are unchanged and the comments still hold.

- [ ] **Step 6: Change the extension's tap and the dashboard default**

In `extension/lib/visit-label.js:35`, change `label: 'distract'` to `label: 'drift'`, and in the JSDoc above `labelsToEvents` change the sentence `` `event.label` already exists with work|distract|neutral|unknown (ADR-0044) `` to `` `event.label` carries focused|supportive|neutral|drift plus unknown (ADR-0076); the server also accepts the tap-era values during the extension transition ``.

In `lib/dashboard-figures.ts:96`, change `{ seconds: 0, label: r.label || 'work' }` to `{ seconds: 0, label: r.label || 'focused' }`.

- [ ] **Step 7: Run the whole suite**

Run: `node --test`
Expected: PASS, all files.

- [ ] **Step 8: Run the browser tests that exercise the tap**

Run: `npx playwright test e2e/companion.spec.ts`
Expected: FAIL at `e2e/companion.spec.ts:173` — `expect(labels[0].label).toBe('distract')`. Change that line to `toBe('drift')` and re-run.
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/label-vocabulary.ts test/label-vocabulary.test.js app/api/events/route.ts extension/lib/visit-label.js lib/dashboard-figures.ts test/visit-label.test.js test/event-kinds.test.js test/dashboard-figures.test.js e2e/companion.spec.ts
git commit -m "feat(labels): move app and extension to the verdict vocabulary, accepting the old one on the wire (ADR-0076)"
```

---

### Task 5: Price the provider and re-derive the caps

`lib/inference-cost.ts` throws on an unknown model by design. Groq's models are unknown to it, and `lib/thresholds.ts` still carries a cap sized for an architecture that no longer exists and a comment pricing a model the project is not using.

**Files:**
- Modify: `lib/inference-cost.ts:16-24` (`MODEL_PRICES`)
- Modify: `lib/thresholds.ts` (replace `DAILY_JUDGMENT_CAP`)
- Test: `test/inference-cost.test.js`

**Interfaces:**
- Consumes: ADR-0072 (Groq provider — corrected from an earlier draft's "ADR-0070"; see Global Constraints), ADR-0075 (premium suspended for the testing phase).
- Produces, for the judge's plan: `MODEL_PRICES` keys `'openai/gpt-oss-20b'` and `'openai/gpt-oss-120b'`; `DAILY_ANALYSIS_CAP`, `DAILY_COACH_TURNS` in `lib/thresholds.ts`. No `FREE_ANALYSES` — see Step 5.

- [ ] **Step 1: Write the failing tests**

Append to `test/inference-cost.test.js`:

```js
test('groq gpt-oss-20b is priced', () => {
  // 2,700 in / 800 out — ADR-0060's verified batch shape.
  const cost = costOf({ model: 'openai/gpt-oss-20b', inputTokens: 2700, outputTokens: 800 })
  assert.ok(Math.abs(cost - 0.00044) < 0.000005, `expected ~$0.00044, got ${cost}`)
})

test('groq gpt-oss-120b is priced', () => {
  const cost = costOf({ model: 'openai/gpt-oss-120b', inputTokens: 2700, outputTokens: 800 })
  assert.ok(Math.abs(cost - 0.000885) < 0.000005, `expected ~$0.000885, got ${cost}`)
})

test('a month of capped analysis stays far under the M9 ceiling', () => {
  const monthly = costOf({ model: 'openai/gpt-oss-120b', inputTokens: 2700, outputTokens: 800 }) * 300
  assert.ok(shareOfSubscription(monthly) < M9_CEILING, `${shareOfSubscription(monthly)} exceeds ${M9_CEILING}`)
})

test('an unpriced model still throws rather than costing nothing', () => {
  assert.throws(
    () => costOf({ model: 'google/gemini-3.5-flash-lite', inputTokens: 1, outputTokens: 1 }),
    /unknown model for costing/,
  )
})
```

Ensure the file's import line includes `shareOfSubscription` and `M9_CEILING`; add them if it does not.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/inference-cost.test.js`
Expected: FAIL — `unknown model for costing: openai/gpt-oss-20b`.

- [ ] **Step 3: Add the prices**

In `lib/inference-cost.ts`, extend `MODEL_PRICES` and update the comment above it:

```ts
/** USD per million tokens. Anthropic verified 2026-09-11; Groq verified 2026-09-21 from
 *  console.groq.com/docs/models. ADR-0072 selects Groq; the Anthropic rows stay because the
 *  eval compares tiers and an unpriced model throws. */
export const MODEL_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  'claude-haiku-4-5-20251001': { inPerM: 1, outPerM: 5 },
  'claude-sonnet-5': { inPerM: 2, outPerM: 10 },
  'claude-opus-5': { inPerM: 5, outPerM: 25 },
  'openai/gpt-oss-20b': { inPerM: 0.075, outPerM: 0.3 },
  'openai/gpt-oss-120b': { inPerM: 0.15, outPerM: 0.6 },
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/inference-cost.test.js`
Expected: PASS.

- [ ] **Step 5: Replace the stale cap**

In `lib/thresholds.ts`, delete the whole `DAILY_JUDGMENT_CAP` block — comment included, since it prices a model the project does not use — and put in its place. **No `FREE_ANALYSES` constant** — ADR-0075 suspends premium for the testing phase, so there is no free/paid line to count against; introducing that constant now would be exactly the payment-gated behaviour ADR-0075 forbids while its Status is Accepted. `DAILY_ANALYSIS_CAP` and `DAILY_COACH_TURNS` remain: they bound API spend regardless of payment status, which ADR-0075 explicitly leaves untouched.

```ts
/** ADR-0072. Replaces DAILY_JUDGMENT_CAP, which was sized when one judgment meant one TAB.
 *  After ADR-0060 a judgment means one BATCH of roughly ten sessions, so the old 150 was a
 *  fuse rated for the wrong current — it would not have blown before the fire.
 *
 *  At openai/gpt-oss-120b's $0.15 / $0.60 per Mtok and ADR-0060's 2,700-in / 800-out batch,
 *  one analysis costs $0.000885. Ten a day is $0.27 a month, 2.2% of a $12 subscription,
 *  against M9's 15% ceiling — a cost-awareness bound, not a paywall (ADR-0075).
 *
 *  Groq's FREE tier is a development convenience and not a plan: 200K tokens/day at ~3,500
 *  tokens an analysis is 57 analyses a day across the entire key, and 8K tokens/minute is
 *  two concurrent analyses — so the queue depth, not this cap, is what binds today. */
export const DAILY_ANALYSIS_CAP = 10

/** The coach is a conversation, not one batched call, so it needs its own ceiling: N turns
 *  resending history costs far more than one analysis. ADR-0075 makes the coach free for the
 *  testing phase, so this bounds spend and abuse only — it is not a paywall and does not vary
 *  by payment status. Re-derive against real transcripts once any exist. */
export const DAILY_COACH_TURNS = 40
```

- [ ] **Step 6: Confirm nothing read the deleted constant**

Run: `grep -rn "DAILY_JUDGMENT_CAP" app lib extension test e2e docs`
Expected: matches in `docs/` only (SDD Q6 / V8 narrative). Add one line under `docs/index.md` §4's staleness row for `sdd-intent.md` noting the cap was re-derived by ADR-0072. If any match appears under `app/`, `lib/`, `extension/`, `test/` or `e2e/`, **stop** — this plan asserted there were no readers and that assertion is wrong.

- [ ] **Step 7: Run the whole suite**

Run: `node --test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/inference-cost.ts lib/thresholds.ts test/inference-cost.test.js docs/index.md
git commit -m "feat(cost): price the Groq models and re-derive the caps for batched analysis (ADR-0072, ADR-0075)"
```

---

## Verification — the whole plan

- [ ] `npm test` — all unit tests pass
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run test:e2e` — e2e passes, including `e2e/companion.spec.ts`
- [ ] `npm run build` — builds clean
- [ ] `psql "$DATABASE_URL" -c "select label, count(*) from event group by label;"` — no `work`, no `distract`
- [ ] `ls docs/adr/ADR-0076*.md docs/adr/ADR-0077*.md docs/adr/ADR-0078*.md` — three files (ADR-0075 already exists from PR #67, before this plan started; don't recount it here)
- [ ] `grep -rn "FREE_ANALYSES" app lib extension test e2e docs` — no matches anywhere; this plan never introduces it
- [ ] `grep -rn "DAILY_JUDGMENT_CAP" app lib extension test e2e` — no matches
- [ ] Nothing user-visible changed. Open `/ledger` and `/dashboard` and confirm both render exactly as before.

## What this plan deliberately does not do

- **No model call.** `lib/ai/` does not exist yet, on purpose — a client with no caller is speculation. It arrives with the judge, which is its first consumer.
- **No `analysis` table, and no quota table at all.** ADR-0077 decides the analysis table's idempotency behaviour; migration `007` creates it in the judge's plan, where something writes to it. A quota table has nothing to count while ADR-0075 keeps premium suspended, and does not belong in this plan or the judge's — it arrives only with the ADR that ends the suspension.
- **No UI.** The split ring, the `Analyse deeper` affordance and the locked state are a design problem before they are a code problem, and they go through `/impeccable` and the design canvas in their own plan.
- **`judgment.signalled`, `gate` and `corrected_to` are left in place.** They belong to the deleted live signal and M7 has no definition left (flow Q4, open). Removing them is a decision nobody has made.
