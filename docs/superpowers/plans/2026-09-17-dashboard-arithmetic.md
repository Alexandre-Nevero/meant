# The Dashboard's Arithmetic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard the rest of the arithmetic ADR-0060 ordered built before the judge —
a second contrast, an actions block, and a rule for how many claims about the user may appear at
once — without importing any of the metrics Rize's dashboard is built on.

**Architecture:** All statistics stay pure functions in alias-free `lib/` modules so `node --test`
can reach them (`npm test` cannot resolve `@/`). The dashboard stays a Server Component that
queries, calls the pure functions, and renders. No new route, no model call, no new dependency.

**Tech Stack:** Next.js 16 App Router, React 19, `@neondatabase/serverless`, plain CSS with
`design/tokens.css`, `node --test` for logic, Playwright for anything rendered.

---

## Provenance, and what this is not

The owner asked to take Rize's dashboard redesign
(`https://rize.io/changelog/dashboard-redesign`, **4 November 2022**) and align it with this
product. Read before implementing, because most of that update cannot be copied here.

**What Rize's update actually is:** an information-architecture refactor, not a visual redesign.
Its stated goals were *"reduce complexity and better serve our separate use cases"* after
*"increased functionality has come at the cost of increased complexity"* and *"crammed UI and
information overload."* Its fundamental move, in their words:

> Until now, we've prioritized derived productivity metrics such as Work Hours, Focus Time, Break
> Time, and Meeting Time as the most important pieces of information… Moving forward, your
> categories will be the most important information in the dashboard.

> We've ended up with a current Work Hours metric that is **opaque and confusing, and yet still
> lacking in accuracy** for many users. We've decided to shift back to simplicity.

**Two facts that bound how much authority that update carries here.** It is nearly four years old,
and Rize's own changelog of **4 September 2026** — *"Categories Are Going Away: Labels and App &
Website Rules"* — abandons the categorisation hierarchy this redesign was built around. It is not a
current design to copy; it is a documented lesson to learn from.

**What transfers:**

| From Rize | Applied here |
|---|---|
| Home = *"a summary of your day and a list of any actions you need to take"* | The unanswered-session backlog. Task 2 |
| Focus Hub asks *"what time of day do I focus the best?"* | A time-of-day contrast, computed, no model. Task 1 |
| Demote derived metrics in favour of the fundamental unit | **Already true here** — see below |
| Separate views per use case rather than one crammed screen | Deferred. This product has two surfaces' worth of material, not six |

**What does not transfer, and must not be introduced:**

| Rize ships | The rule it breaks |
|---|---|
| Work Hours, Focus Time, Break Time, Meeting Time as headline metrics | §3.1 / I2 — **no total-hours figure on any surface** |
| Goals tab, group goals, community goals | `docs/design-toolkit.md` §9 — refuses *streaks, badges, flames, rings* |
| Productivity scores | §9 — refuses *a productivity score of any kind* |
| Projects, billable time, custom report export | Not this product (PRD §5) |

**The deeper trap.** Rize organises everything around **categorised time**; this product organises
around **the outcome answer** — *did you finish what you said you would*. `PRODUCT.md`'s competitive
table names Rize as having *"Measurement, AI categorisation"* and lacking *"intention, protection;
hours are its headline."* Adopting Rize's hierarchy would replace this product's differentiator with
the one it was built to reject.

**And this product is already on the right side of Rize's own lesson.** The current headline —
*"Eleven this month. Seven finished."* — is not a derived productivity metric. It is a count of
completed outcomes, which is the fundamental unit here, the exact role Rize moved *categories* into.
It stays. Applying Rize's refactor literally would demote the one thing that should lead.

---

## Global Constraints

Copied verbatim from `CLAUDE.md`, `docs/design.md`, `docs/design-toolkit.md` and the ADRs.

- `design/tokens.css` is the contract. Use `var(--m-*)`. **Never write a hex value in a component.**
- The class contract is frozen at 13 semantic classes and **contested — issue #51 part 3 is an open
  owner decision.** `.m-landing-*`, `.m-rise`, `.m-shell-*` and `.m-review-*` are structural
  families under an existing precedent. **Nothing here may resolve that question**, and any new
  structural name must be declared in the census in `docs/design.md` §5 and
  `docs/design-toolkit.md` §8 the way `.m-review-*` was.
- **`docs/adr/` outranks every other document (ADR-0063).** A decision not in `docs/adr/` has not
  been made.
- **§3.1 / I2: no total-hours figure, no percentage, no score, on any surface.** Counts are spelled
  as words — `toWords` (`lib/words.ts`) handles 0–99 and falls back to digits above that. *"three of
  five"* is one step from a rate and is banned.
- **I6 as amended by ADR-0050: description has no floor; inference does.** Showing the user their
  own rows is free. Asserting a regularity *about them* is gated at
  `PATTERN_MIN_SESSIONS = 8` (`lib/thresholds.ts:20`).
- **I3 as amended by ADR-0051:** no valence on the outcome answer — never praises `Yes`, never
  reproaches `Not yet` — but may freely reason **from** it.
- **PRD US-11:** below the threshold, render **nothing**. Do not hedge a partial pattern.
- Verbal identity: second person, present tense, lowercase for the user's own words, no moralising.
  Never "Failed", "Missed", "Idle", "Unproductive", "Mark as complete".
- `npm test` is `node --test`; it **cannot resolve the `@/` alias**. Pure logic lives in alias-free
  modules and is imported relatively **with the `.ts` extension** (`allowImportingTsExtensions` is
  on for exactly this).
- **`getByRole('alert')` must always be scoped to a surface** — Next 16's App Router mounts its own
  route announcer with `role="alert"` on every page.
- The full e2e suite has a load-related flake profile (~4–6 per run, varying, all passing in
  isolation) and **can be killed by system memory** if run as one command. Run it in chunks of five
  spec files. Re-run any failure individually before believing it.
- `next dev` rewrites `AGENTS.md` and `next-env.d.ts`; `predev` rewrites `extension/tokens.css`. Do
  not commit those. If you change `design/tokens.css`, run `npm run tokens` and commit the result.
- **No AI attribution in any commit message.**

### The defect class this codebase keeps producing

Six findings on the previous branch were tests that **passed for the wrong reason** — including a
34×16 attention band where a full-width bar belonged, on the product's most important page, which
cleared nine green tests because nothing asserted rendered size. When you add a test here, ask what
it would do **if the behaviour under test were deleted**. If the answer is "still pass", it is not a
test. See `docs/superpowers/handoffs/2026-09-17-bugfix-seven.md` §3.

---

## The decision this plan forces, and why it is Task 4 not Task 0

Today exactly one inference sentence can appear. This plan adds a second and an actions block. Three
statements about the user, stacked, is how a dashboard becomes the "productivity score" feel §9
refuses — the individual claims stay legal while the surface as a whole starts grading the person.

**So a rule is needed: how many claims about the user may appear at once.** That is a decision, and
ADR-0063 says a decision not in `docs/adr/` has not been made. It is Task 4 rather than Task 0
because the right answer is easier to see once both statements exist and can be looked at together —
but **Task 4 is not optional and the branch does not merge without it.**

---

## The timezone question — RESOLVED 2026-09-17 (owner)

**Answer: B, with the hour stored on the session row rather than a timezone on the user.**

`session` gains `started_at_local_hour int` (nullable). The extension already mints `startedAt`
locally and posts it (`extension/sw.js:125,164`); it now posts `localHour` taken from the same
clock reading. `normalizeStartPayload` validates it as an integer 0–23 and stores null otherwise,
exactly as it already treats every other untrusted field. The dashboard selects the column. There
is no `at time zone` anywhere, so an unrecognised timezone name cannot raise inside a page query.

**Why not the user-level IANA timezone option B originally proposed:**

- `Europe/Lisbon` tells the server roughly where the user lives. `9` does not. A product that
  stores hostnames and never full URLs (ADR-0008), never reads page text (ADR-0061) and keeps
  paths on the device (ADR-0059) should not acquire a location column to answer a question a
  single integer answers.
- A user-level column is wrong under travel, and wrong across a DST boundary for historical rows.
  The hour is captured at the instant the session starts, so it is right by construction.
- ADR-0061 has the judge reading time of day **from local storage after the session ends** — the
  fact is already client-supplied in the decided architecture. Per-session storage matches that.

**What it costs, and this belongs in the branch report:** every existing session row has
`started_at_local_hour = null` and is excluded. The second contrast therefore renders nothing
until eight answered sessions have been recorded after this branch ships. That is the honest
behaviour under ADR-0053 — null means unknown, not "assume UTC" — but it means Task 3 Step 7's
state 3 must be produced from seeded rows.

**Consequences for this plan:** the schema and extension work is **Task 1a** and runs before
Task 1. Task 3 Step 3's query changes accordingly.

---

## Amendment 2026-09-17 — the vacuous-assertion gap (owner)

Task 3's below-floor test asserts `.m-ledger-pattern` has count 0, and this same change is what
introduces that class. Written that way it passes whether or not the evidence gate works — the
`landing.spec.ts` defect from the previous branch, in a new place. Task 4's one-claim rule has no
test at all.

Both need a signed-in user with eight or more answered sessions, which `endedSession` cannot
produce (it creates a fresh account per call). **A seeding fixture is added in Task 3**, writing
rows into `meant_test` directly, so that the absence assertion is falsifiable and the one-slot
rule is testable. Task 3 Step 7 needs that same state anyway.

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `lib/migrations/005-local-hour.sql` | 1a | **New.** `session.started_at_local_hour` — the resolved timezone decision |
| `lib/session-payload.ts` | 1a | Normalises the new untrusted `localHour` field |
| `extension/sw.js` | 1a | Posts `localHour` from the same clock reading as `startedAt` |
| `app/api/sessions/route.ts` | 1a | Inserts the new column |
| `e2e/fixtures.ts` | 3 | **Modified.** Gains a seeding fixture so the evidence floor can be crossed |
| `lib/attention-contrast.ts` | 1 | **Exists.** Domain contrast by outcome. Untouched except where Task 1 adds the time-of-day function beside it |
| `lib/time-of-day.ts` | 1 | **New.** Pure: session start times + outcomes → the part of day with the widest finished/unfinished split. Alias-free |
| `test/time-of-day.test.js` | 1 | **New.** Covers the gate, the both-arms rule, and the timezone contract |
| `lib/unanswered.ts` | 2 | **New.** Pure: sessions → the answerable backlog, oldest first. Alias-free |
| `test/unanswered.test.js` | 2 | **New.** |
| `app/dashboard/page.tsx` | 3 | Queries, calls the pure functions, renders. The only file that knows about layout |
| `app/globals.css` | 3 | `[data-surface="ledger"]` additions only |
| `e2e/dashboard.spec.ts` | 3 | **Exists** (one test). Appended, not rewritten |
| `docs/adr/ADR-0066-*.md` | 4 | The one-claim rule |
| `docs/design.md`, `docs/design-toolkit.md`, `docs/sitemap-intent.md` | 4 | Class census, surfaces table, route notes |

---

## Task 1a: Where the hour comes from

**Files:**
- Create: `lib/migrations/005-local-hour.sql`
- Modify: `lib/session-payload.ts`, `test/session-payload.test.js`, `app/api/sessions/route.ts`,
  `extension/sw.js`

**Interfaces:**
- Produces: `session.started_at_local_hour` (int, nullable, 0–23) and
  `StartPayload.localHour: number | null`. **Task 3 queries the column.**

- [ ] **Step 1: Write the failing test**

Append to `test/session-payload.test.js`, matching that file's existing style.

- `localHour: 9` normalises to `9`. **`localHour: 0` normalises to `0`** — a falsy-but-valid
  value, and the bug that assertion exists to catch.
- `24`, `-1`, `9.5`, `'9'`, `null`, and a missing key all normalise to `null`. The field is
  client-supplied and untrusted, exactly like `body.id` and every array field in this module.

Ask of each assertion what it would do if `localHour` were deleted from `normalizeStartPayload`
altogether. If it would still pass, it is not a test.

- [ ] **Step 2: Run it to make sure it fails**

```bash
npm test 2>&1 | grep -B2 -A6 "localHour"
```

- [ ] **Step 3: Write the implementation**

`lib/migrations/005-local-hour.sql` — numbered and ordered per ADR-0018. One statement. Note that
`lib/migrate.mjs` strips `--` comments before splitting on `;`, so comments are safe:

```sql
-- The hour, 0-23, local to the user at the instant the session started. Supplied by the
-- extension from the same clock reading that produces started_at (extension/sw.js:125).
--
-- Deliberately NOT a timezone. 'Europe/Lisbon' is a location; 9 is not. This schema stores
-- hostnames and never full URLs (ADR-0008), the judge never reads page text (ADR-0061), and
-- paths stay on the device (ADR-0059). Acquiring a location column to answer a question an
-- integer answers would be the same mistake in a new place.
--
-- Null on every row written before this migration, and null whenever the client sends
-- anything that is not an integer 0-23. Null means unknown, and the time-of-day contrast
-- excludes it rather than guessing (ADR-0053).
alter table session add column if not exists started_at_local_hour int;
```

`lib/session-payload.ts` — add `localHour: number | null` to `StartPayload` and normalise it
beside the other untrusted fields. Say in a comment why a bad value becomes null rather than a
guess. `Number.isInteger(0)` is true and `0` is a legal hour: a truthiness check is wrong here.

`app/api/sessions/route.ts` — insert the new column. The insert stays `on conflict (id) do
nothing`; a replayed offline start must not overwrite anything.

`extension/sw.js` — post `localHour` alongside `startedAt` at line 164, derived from the **same**
`now` that line 125 uses. Do not read the clock a second time; the two must not be able to
disagree.

- [ ] **Step 4: Run the tests and apply the migration**

```bash
node --env-file=.env.test -e "console.log(new URL(process.env.DATABASE_URL).pathname)"
npm test 2>&1 | grep -E "^. (tests|pass|fail)"
npx tsc --noEmit
node --env-file=.env.test lib/migrate.mjs
```

The first command must print `/meant_test` before the migration is run. It is the only guard
between this step and the production database.

- [ ] **Step 5: Commit**

One commit, in this repository's style — long subjects are the convention here, do not trim to a
generic limit. The body says why an hour and not a timezone, and that null means unknown.

---

## Task 1: A second contrast — what time of day you finish things

**The timezone question is resolved above, and Task 1a supplies the hour.** This module is
unchanged by that decision: it takes `startedAtLocalHour`, an integer already local to the user,
and never a timestamp — which is what made the decision impossible to answer by accident inside
it.

**Files:**
- Create: `lib/time-of-day.ts`, `test/time-of-day.test.js`
- Read first: `lib/attention-contrast.ts` — this function is its sibling and must match its shape

**Interfaces:**
- Produces: `contrastByPartOfDay(rows: PartOfDayRow[]): PartOfDayContrast | null`. **Task 3 renders
  it; Task 4's rule orders it against the domain contrast.**

**Why this statistic and not five.** Rize's Focus Hub exists to answer *"what time of day do I focus
the best?"*, and it is the one question in that update this product can answer honestly with no
model and no new data. Session length, fragmentation and blocked-attempt correlations are all
computable too — **do not build them.** They are speculative until someone asks for them, and each
one is another claim about the user competing for the single slot Task 4 defines.

- [ ] **Step 1: Write the failing test**

Create `test/time-of-day.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { contrastByPartOfDay, PARTS } from '../lib/time-of-day.ts'

// ADR-0060: build the arithmetic before the judge. This is the second sentence the product can
// say for free, and the one Rize's Focus Hub is built to answer ("what time of day do I focus
// the best?") — answered here with arithmetic over the outcome column, no model.

const at = (hour, outcome) => ({ startedAtLocalHour: hour, outcome })

test('needs both arms — a part of day with only finished sessions is not a contrast', () => {
  // I6 as amended by ADR-0050: stating one side is a pattern claim from a single side.
  const rows = [at(9, 'yes'), at(10, 'yes'), at(11, 'yes')]
  assert.equal(contrastByPartOfDay(rows), null)
})

test('unanswered sessions are not a third outcome and are excluded', () => {
  const rows = [at(9, 'unanswered'), at(10, 'unanswered')]
  assert.equal(contrastByPartOfDay(rows), null)
})

test('picks the part of day with the widest split, in either direction', () => {
  // Mornings finish, evenings do not. The gap is what carries information.
  const rows = [
    at(9, 'yes'), at(9, 'yes'), at(10, 'yes'), at(10, 'yes'),
    at(20, 'no'), at(20, 'no'), at(21, 'no'), at(9, 'no'),
  ]
  const r = contrastByPartOfDay(rows)
  assert.equal(r.part, 'morning')
  assert.equal(r.finished, 4)
  assert.equal(r.unfinished, 1)
})

test('reports DISTINCT sessions so the I6 gate counts what it says it counts', () => {
  // The domain contrast had exactly this bug: it counted event rows and would have stated a
  // pattern on five sessions while reporting fifty-three. One row is one session here, and the
  // total must equal the rows that survived filtering — never the input length.
  const rows = [at(9, 'yes'), at(9, 'no'), at(14, 'unanswered')]
  assert.equal(contrastByPartOfDay(rows).sessions, 2)
})

test('the four parts partition the clock with no gap and no overlap', () => {
  const covered = new Set()
  for (let h = 0; h < 24; h++) {
    const hit = PARTS.filter((p) => p.covers(h))
    assert.equal(hit.length, 1, `hour ${h} matched ${hit.length} parts`)
    covered.add(hit[0].name)
  }
  assert.equal(covered.size, 4)
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npm test 2>&1 | grep -A3 "time-of-day"
```

Expected: every test in the file fails on `Cannot find module '../lib/time-of-day.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/time-of-day.ts`:

```ts
/** ADR-0060: "Build the arithmetic before the judge." The sibling of attention-contrast.ts.
 *
 *  Rize's Focus Hub exists to answer "what time of day do I focus the best?" — this answers the
 *  version of that question this product can actually support: not "focus", which it does not
 *  measure, but the outcome answer, which is the most informative column in the schema.
 *
 *  ADR-0051 permits reasoning FROM the outcome answer; it forbids valence, not use.
 *
 *  THE HOUR MUST ALREADY BE LOCAL TO THE USER. This module takes `startedAtLocalHour`, not a
 *  timestamp, precisely so the timezone question cannot be answered by accident inside it — a
 *  UTC bucket would state a confident regularity about the person that is an artefact of server
 *  geography, which is exactly what ADR-0053 exists to prevent. */

export const PARTS = [
  { name: 'morning' as const, covers: (h: number) => h >= 5 && h < 12 },
  { name: 'afternoon' as const, covers: (h: number) => h >= 12 && h < 17 },
  { name: 'evening' as const, covers: (h: number) => h >= 17 && h < 22 },
  { name: 'night' as const, covers: (h: number) => h >= 22 || h < 5 },
]

export type PartName = (typeof PARTS)[number]['name']
export type PartOfDayRow = { startedAtLocalHour: number; outcome: string }
export type PartOfDayContrast = {
  part: PartName
  finished: number
  unfinished: number
  /** DISTINCT sessions that carried an answer. The I6 evidence floor counts these. */
  sessions: number
}

export function contrastByPartOfDay(rows: PartOfDayRow[]): PartOfDayContrast | null {
  const byPart = new Map<PartName, { yes: number; no: number }>()
  let answered = 0

  for (const row of rows) {
    // `unanswered` is the absence of an answer, not a third outcome to compare against.
    if (row.outcome !== 'yes' && row.outcome !== 'no') continue
    const hour = row.startedAtLocalHour
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
    const part = PARTS.find((p) => p.covers(hour))!.name
    const entry = byPart.get(part) ?? { yes: 0, no: 0 }
    entry[row.outcome === 'yes' ? 'yes' : 'no'] += 1
    byPart.set(part, entry)
    answered += 1
  }

  const withBothArms = [...byPart.entries()].filter(([, e]) => e.yes > 0 && e.no > 0)
  if (withBothArms.length === 0) return null

  // Widest gap in EITHER direction: a part of day you rarely finish in is as informative as one
  // you usually do.
  const [part, e] = withBothArms.sort(
    (a, b) => Math.abs(b[1].yes - b[1].no) - Math.abs(a[1].yes - a[1].no),
  )[0]

  return { part, finished: e.yes, unfinished: e.no, sessions: answered }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test 2>&1 | grep -E "^. (tests|pass|fail)"
npx tsc --noEmit
```

Expected: 149 + 5 = **154 passing, 0 failures**, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/time-of-day.ts test/time-of-day.test.js
git commit -m "feat(lib): a second free contrast — what time of day you finish things

ADR-0060 ordered the arithmetic built before the judge, and named the shape:
statements that cost no model call, no page text and no permission. The domain
contrast shipped; this is its sibling.

It is also the one question from Rize's Focus Hub this product can answer
honestly. Rize asks 'what time of day do I focus the best' and answers it from
categorised hours. This answers the version the schema supports: the outcome
answer, which ADR-0051 permits reasoning from.

The function takes an already-local hour rather than a timestamp, deliberately.
A UTC bucket would state a confident regularity about the person that is an
artefact of server geography — the failure ADR-0053 exists to prevent — and
taking the hour as an input makes that impossible to do by accident."
```

---

## Task 2: The actions block — unanswered sessions

**Files:**
- Create: `lib/unanswered.ts`, `test/unanswered.test.js`

**Interfaces:**
- Produces: `answerableBacklog(rows: BacklogRow[], now: Date): BacklogRow[]`. **Task 3 renders it.**

**Why.** This is the one idea from Rize's Home view that transfers intact — *"a summary of your day
and a list of any actions you need to take."* Here the action is real and specific: an **unanswered
session is a hole in the column everything else is computed from.** `session.outcome` feeds the
ledger headline, both contrasts, `judgment.corrected_to` later, and the coach after that. A user
with twenty unanswered sessions has a ledger that cannot say anything.

**This is description, not inference — so I6 imposes no floor on it.** It shows the user their own
rows. It must not editorialise about *why* they are unanswered (that would be inference, gated) and
it must carry no valence (I3): an unanswered session is not a failure, it is a question still open.

- [ ] **Step 1: Write the failing test**

Create `test/unanswered.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { answerableBacklog, ANSWERABLE_WINDOW_DAYS } from '../lib/unanswered.ts'

const NOW = new Date('2026-09-17T12:00:00Z')
const ago = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
const row = (id, outcome, endedDaysAgo, endedAt = ago(endedDaysAgo)) => ({
  id, outcome, endedAt, intention: 'a thing',
})

test('only unanswered sessions are answerable', () => {
  const rows = [row('a', 'yes', 1), row('b', 'no', 1), row('c', 'unanswered', 1)]
  assert.deepEqual(answerableBacklog(rows, NOW).map((r) => r.id), ['c'])
})

test('a running session is not a backlog item — it has not ended yet', () => {
  // endedAt null means running. Asking "did you?" of a session still in progress is incoherent.
  const rows = [{ id: 'a', outcome: 'unanswered', endedAt: null, intention: 'x' }]
  assert.deepEqual(answerableBacklog(rows, NOW), [])
})

test('oldest first — the one most likely to be forgotten is the one to ask about', () => {
  const rows = [row('new', 'unanswered', 1), row('old', 'unanswered', 5)]
  assert.deepEqual(answerableBacklog(rows, NOW).map((r) => r.id), ['old', 'new'])
})

test('sessions past the window are dropped rather than asked about forever', () => {
  // Honesty over completeness: nobody can accurately answer "did you finish it" about a session
  // three weeks gone, and a backlog that only grows is a guilt ledger, which §9 refuses.
  const rows = [row('stale', 'unanswered', ANSWERABLE_WINDOW_DAYS + 1), row('fresh', 'unanswered', 1)]
  assert.deepEqual(answerableBacklog(rows, NOW).map((r) => r.id), ['fresh'])
})

test('the window boundary is inclusive, so a session exactly at the edge is still answerable', () => {
  const rows = [row('edge', 'unanswered', ANSWERABLE_WINDOW_DAYS)]
  assert.equal(answerableBacklog(rows, NOW).length, 1)
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npm test 2>&1 | grep -A3 "unanswered"
```

Expected: fails on `Cannot find module '../lib/unanswered.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/unanswered.ts`:

```ts
/** The actions block. The one idea from Rize's 2022 Home view that transfers intact — "a summary
 *  of your day and a list of any actions you need to take" — with an action that is real here.
 *
 *  An unanswered session is a hole in `session.outcome`, the column the ledger headline, both
 *  contrasts, and every later inference are computed from. A user with twenty unanswered sessions
 *  has a ledger that cannot say anything about them.
 *
 *  This is DESCRIPTION, not inference: it shows the user their own rows, so I6 imposes no floor
 *  (ADR-0050). It carries no valence (I3, ADR-0051) — an unanswered session is a question still
 *  open, never a failure — and it must never say why a session went unanswered, which would be an
 *  inference about the person and is gated. */

/** Past this, the honest answer is that nobody remembers. A backlog that only grows is a guilt
 *  ledger, and docs/design-toolkit.md §9 refuses that shape of thing. */
export const ANSWERABLE_WINDOW_DAYS = 14

export type BacklogRow = {
  id: string
  outcome: string
  /** null while the session is still running. */
  endedAt: string | null
  intention: string
}

export function answerableBacklog(rows: BacklogRow[], now: Date): BacklogRow[] {
  const floor = now.getTime() - ANSWERABLE_WINDOW_DAYS * 86_400_000
  return rows
    // A running session cannot be answered — "did you finish it" is incoherent mid-session.
    .filter((r) => r.outcome === 'unanswered' && r.endedAt !== null)
    .filter((r) => new Date(r.endedAt!).getTime() >= floor)
    // Oldest first: the one most likely to be forgotten is the one worth asking about.
    .sort((a, b) => new Date(a.endedAt!).getTime() - new Date(b.endedAt!).getTime())
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test 2>&1 | grep -E "^. (tests|pass|fail)"
npx tsc --noEmit
```

Expected: **159 passing, 0 failures**, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/unanswered.ts test/unanswered.test.js
git commit -m "feat(lib): the answerable backlog

Rize's 2022 Home view is 'a summary of your day and a list of any actions you
need to take'. That idea transfers; here the action is specific. An unanswered
session is a hole in session.outcome — the column the ledger headline, both
contrasts and every later inference are computed from.

Description, not inference, so I6 imposes no floor (ADR-0050): it shows the
user their own rows. No valence (I3) — an unanswered session is a question
still open, not a failure — and it never says why one went unanswered, which
would be an inference about the person.

Bounded at fourteen days because past that the honest answer is that nobody
remembers, and a backlog that only grows is a guilt ledger, which §9 refuses."
```

---

## Task 3: Render both, and the hierarchy

**Files:**
- Modify: `app/dashboard/page.tsx`, `app/globals.css`
- Test: `e2e/dashboard.spec.ts` (append — it has one test today, leave it alone)

**Interfaces:**
- Consumes: `contrastByOutcome` (exists), `contrastByPartOfDay` (Task 1), `answerableBacklog` (Task 2).

**The hierarchy, and the one thing Rize's refactor actually changes here.** Rize demoted derived
metrics beneath the fundamental unit. This product's headline — *"Eleven this month. Seven
finished."* — is already the fundamental unit, not a derived metric, so **it stays first.** What
changes is what sits beneath it:

```
  the headline                     ← counts of outcomes. Unchanged. Leads.
  the actions block                ← NEW. Description, no floor. Only when non-empty
  one pattern sentence             ← gated at PATTERN_MIN_SESSIONS. Task 4 decides WHICH
  "Set up your sites"              ← existing link
  the sessions list                ← the record itself. Unchanged.
```

- [ ] **Step 1: Write the failing test**

Append to `e2e/dashboard.spec.ts`. Use the `endedSession` fixture from `e2e/fixtures.ts`
(`({ intention, events? }) => Promise<string>`) — do not open-code a pair-and-start preamble.

**First, the seeding fixture (see the amendment above).** `endedSession` makes a fresh account per
call, so no test can reach `PATTERN_MIN_SESSIONS = 8` sessions for one user. Add the smallest
fixture that fixes that: it signs up and pairs once, then inserts N answered sessions for that
same user straight into `meant_test` with `@neondatabase/serverless` and `process.env.DATABASE_URL`,
returning the page. Rows carry `outcome`, `started_at`, `ended_at` and `started_at_local_hour`, so
a caller can drive either contrast over the floor.

Rules for it: **additive** — `endedSession` and the other fifteen spec files must keep working
untouched, and `e2e/session-recovery.spec.ts` owns its own context and must not need it. It writes
only to the database the guard already checks, never to production. The three tests below do not
use it; the two new ones at the end of this step do.

```ts
// The actions block. Description, not inference — no evidence floor applies (ADR-0050), so it
// must appear for a single unanswered session, not wait for eight.
test('one unanswered session is enough to raise an action, and it links to the review', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'unanswered on purpose' })
  const page = await context.newPage()
  await page.goto('/dashboard')

  const actions = page.locator('.m-ledger-actions')
  await expect(actions).toBeVisible()
  await expect(actions.getByRole('link', { name: /unanswered on purpose/ })).toHaveAttribute(
    'href', `/review/${sessionId}`,
  )
})

// PRD US-11: below the threshold, render NOTHING. Not a hedge, not a partial pattern.
test('no pattern sentence appears below the evidence floor', async ({ context, endedSession }) => {
  await endedSession({
    intention: 'one session only',
    events: [{ kind: 'attention', domain: 'chatgpt.com', seconds: 600, at: new Date().toISOString() }],
  })
  const page = await context.newPage()
  await page.goto('/dashboard')

  await expect(page.locator('.m-ledger-pattern')).toHaveCount(0)
  // And the surface is not empty — the record is always free and always shown (ADR-0060).
  await expect(page.locator('[data-surface="ledger"] .m-row')).not.toHaveCount(0)
})

// §3.1 bans these outright, and this is the surface most likely to grow one by accident.
test('the ledger shows no percentage, no score and no hours headline', async ({ context, endedSession }) => {
  await endedSession({
    intention: 'no metrics here',
    events: [{ kind: 'attention', domain: 'chatgpt.com', seconds: 3600, at: new Date().toISOString() }],
  })
  const page = await context.newPage()
  await page.goto('/dashboard')
  const text = await page.locator('[data-surface="ledger"]').innerText()

  expect(text).not.toMatch(/\d+\s*%/)
  expect(text).not.toMatch(/\bscore\b/i)
  // "3 hrs", "3 hours", "3h" — a total-hours figure in any spelling.
  expect(text).not.toMatch(/\b\d+(\.\d+)?\s*(h|hr|hrs|hours)\b/i)
})
```

And two that need the seeded fixture, because without them the `toHaveCount(0)` above can never
fail:

```ts
// The falsifier for the test above. If .m-ledger-pattern is never rendered by anything, the
// below-floor assertion is vacuous — the landing.spec.ts defect of the previous branch. This
// test fails if the class is wrong, missing, or if the gate never opens.
test('at the evidence floor the pattern sentence appears', async ({ context, seededUser }) => {
  const page = await seededUser({ sessions: 8 /* answered, contrast-bearing */ })
  await page.goto('/dashboard')
  await expect(page.locator('.m-ledger-pattern')).toHaveCount(1)
})
```

The second — **the one-slot rule's test** — belongs to Task 4 and is written there, once the rule
exists to be tested.

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/dashboard.spec.ts
```

Expected: the first two fail on `.m-ledger-actions` / `.m-ledger-pattern` not existing. **The third
may already pass** — that is correct and wanted. It is a regression guard for a rule that holds
today and must keep holding; record in the report that it passed before the change.

- [ ] **Step 3: Query the two new inputs**

In `app/dashboard/page.tsx`, after the existing `contrastRows` query. The backlog reuses the
`sessions` rows already fetched — **do not add a query for it.**

```tsx
  // Task 1's contrast needs an hour already local to the user. Task 1a stores it on the session
  // row at start, from the extension's own clock. Null means unknown — a session recorded before
  // that column existed, or a client that sent something that was not an integer 0-23 — and is
  // excluded rather than guessed at (ADR-0053). There is no `at time zone` here deliberately.
  const partRows = (await sql`
    select s.started_at_local_hour as "startedAtLocalHour", s.outcome
      from session s
     where s.user_id = ${userId}
       and s.outcome in ('yes', 'no')
       and s.started_at_local_hour is not null`) as {
    startedAtLocalHour: number
    outcome: string
  }[]
  const partOfDay = contrastByPartOfDay(partRows)

  const backlog = answerableBacklog(
    sessions.map((s) => ({
      id: s.id as string,
      outcome: s.outcome as string,
      endedAt: s.ended_at ? new Date(s.ended_at as string).toISOString() : null,
      intention: s.intention as string,
    })),
    new Date(),
  )
```

No `userTimezone` variable exists and none may be introduced — see the resolved timezone section
above.

- [ ] **Step 4: Render the actions block**

Between the headline and the pattern sentence:

```tsx
      {backlog.length > 0 && (
        <div className="m-ledger-actions">
          {/* Description, not inference — no evidence floor (ADR-0050). No valence (I3): an
              unanswered session is a question still open, never a failure. The copy says what
              is true and asks for nothing more. */}
          <p className="m-meta">
            {backlog.length === 1
              ? 'One session is still unanswered.'
              : `${toWords(backlog.length)} sessions are still unanswered.`}
          </p>
          {backlog.slice(0, 3).map((s) => (
            <Link className="m-sentence" key={s.id} href={`/review/${s.id}`}>
              {s.intention || 'No intention given'}
            </Link>
          ))}
        </div>
      )}
```

Three at most: the list below already carries every session, and a backlog that fills the screen is
the guilt ledger §9 refuses.

- [ ] **Step 5: Give the pattern sentence its class and the actions block its layout**

In `app/globals.css`, beside the other `[data-surface="ledger"]` rules. **No new colours** — both
blocks compose existing primitives.

```css
/* The actions block (Rize's 2022 Home view: "a list of any actions you need to take"). Quiet by
 * construction: it is a list of open questions, not a warning. No accent, no border, no icon. */
[data-surface="ledger"] .m-ledger-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
[data-surface="ledger"] .m-ledger-actions .m-sentence { font-size: 20px; }
```

Add `className="m-ledger-pattern"` to the existing pattern `<p>` so the test can assert its absence
by class rather than by matching prose, which would break the moment the copy changes.

`.m-ledger-actions` and `.m-ledger-pattern` are **structural names under the `.m-landing-*` /
`.m-shell-*` / `.m-review-*` precedent.** Task 4 declares them in the census. They do not resolve
#51 part 3.

- [ ] **Step 6: Run the tests**

```bash
npx playwright test e2e/dashboard.spec.ts
npx tsc --noEmit
node ~/.agents/skills/impeccable/scripts/detect.mjs --json app/globals.css
```

Expected: 4 dashboard tests pass, 0 type errors, detector clean on the CSS. (`--json` over a `.tsx`
returns `[]` regardless of contents — it is meaningless for a component and must not be quoted as
evidence.)

- [ ] **Step 7: Look at it — three states, two widths**

Start a server (`npm run dev -- --port 3100`), then render at **1440 and 390**:

1. Below the floor with an unanswered session — actions block present, no pattern sentence.
2. Above the floor with everything answered — pattern sentence present, no actions block.
3. Both present.

Confirm at 390 that the surface does not scroll sideways
(`document.documentElement.scrollWidth - window.innerWidth <= 0`) and that the actions block reads
as a list of open questions rather than a warning. **Report state 3 specifically**: it is the one
where the surface risks starting to grade the person, and it is the input Task 4 needs.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/page.tsx app/globals.css e2e/dashboard.spec.ts
git commit -m "feat(dashboard): the actions block and a second contrast

Rize's 2022 dashboard refactor demoted derived metrics beneath the fundamental
unit. This product's headline is already the fundamental unit — a count of
completed outcomes, not a derived metric — so it stays first. What changes is
what sits under it.

The actions block is the one idea from their Home view that transfers intact.
Description, not inference, so no evidence floor applies: one unanswered
session is enough. Capped at three, because a backlog that fills the screen is
the guilt ledger §9 refuses.

The time-of-day contrast buckets on an hour already local to the user. A bare
extract(hour) buckets in UTC and would state a confident regularity about the
person that is an artefact of server geography.

Adds a test asserting the ledger shows no percentage, no score and no
hours-headline. It passed before this change; it is here because this is the
surface most likely to grow one by accident, and because everything Rize puts
on theirs is exactly that."
```

---

## Task 4: The rule for how many claims may appear at once

**Files:**
- Create: `docs/adr/ADR-0066-<slug>.md`
- Modify: `docs/design.md` §5 and §6, `docs/design-toolkit.md` §8, `docs/sitemap-intent.md`
- Modify: `app/dashboard/page.tsx`, `e2e/dashboard.spec.ts` — **the rule is code as well as a
  document.** Task 3 renders both statements so this task can be decided by looking at them; this
  task implements whatever it decides, and tests it.

**This task does not merge-gate on taste; it gates on ADR-0063.** Two pattern statements now exist
(`contrastByOutcome`, `contrastByPartOfDay`) and more are cheap to add. Without a rule, the dashboard
accretes claims about the user until it is grading them — which is the *productivity score* §9
refuses, arrived at by accumulation rather than by decision.

- [ ] **Step 1: Decide, using Task 3 Step 7's state-3 render**

Look at the screenshot where both fire. The recommended rule, to accept or replace:

> **At most one inference sentence renders at a time — the one with the widest gap relative to its
> own evidence.** Description (the headline, the actions block, the sessions list) is unbounded and
> ungated, per ADR-0050. Adding a new statistic does not add a line to the dashboard; it enters the
> competition for the single slot.

The argument for it: the ban in §9 is on *a productivity score of any kind*, and a stack of
simultaneous claims is a score assembled from parts. One slot also keeps the surface's peak-end
intact — a single sentence is read; four are skimmed.

The argument against, which must be recorded if the rule is adopted: **a user whose strongest signal
is time-of-day never sees the domain contrast, and cannot ask for it.** Whatever is chosen, record
what it costs.

- [ ] **Step 2: Write the ADR**

Match the house style exactly — read `docs/adr/ADR-0064-*.md` and `ADR-0065-*.md` first. The form is
`# ADR-NNNN — Title` then a bullet block: `- **Date:** / - **Status:** / - **Context:** /
- **Decision:** / - **Consequences:** / - **Source:**`. **Not `##` section headers** — that mistake
was made on ADR-0065 and had to be fixed.

State in Consequences that this constrains every future statistic including the judge's own output,
since a judge verdict rendered here would compete for the same slot.

- [ ] **Step 2a: Implement the rule, and write the test that proves it**

Whatever Step 1 decided, `app/dashboard/page.tsx` must enforce it and `e2e/dashboard.spec.ts` must
fail if it stops being enforced. Under the recommended rule that is: both contrasts computed, one
rendered, and a test using the seeded fixture from Task 3 that puts **both** over the floor and
asserts `.m-ledger-pattern` has count exactly 1.

A rule stated only in an ADR is a rule that regresses on the next branch. Ask of the test what it
would do if the selection were deleted and both sentences rendered. If it would still pass, it is
not a test.

- [ ] **Step 3: Reconcile the documents**

- `docs/design.md` §5 and `docs/design-toolkit.md` §8 — add `.m-ledger-*` to the structural-family
  census the way `.m-review-*` was added, with the same "structural, not vocabulary" framing.
  **Do not change the class count and do not resolve #51 part 3.**
- `docs/design.md` §6 — the `ledger` row gains the actions block and the one-slot rule.
- `docs/sitemap-intent.md` — `/dashboard` (S3) gains a note on what the surface now carries.

- [ ] **Step 4: Verify nothing else still contradicts the rule**

```bash
grep -rniE "pattern sentence|contrast|arithmetic" docs/*.md | grep -v superpowers
```

Act on what it finds rather than assuming it is clean. The previous branch's Step 4 grep was too
narrow and missed two stale lines that the new ADR immediately contradicted.

- [ ] **Step 5: Commit**

```bash
git add docs/adr docs/design.md docs/design-toolkit.md docs/sitemap-intent.md
git commit -m "docs(adr): ADR-0066 — one claim about the user at a time"
```

---

## Closing the loop

- [ ] `npm test` (expect 159) · `npx tsc --noEmit` (expect 0)
- [ ] e2e **in chunks of five spec files** — a single full run can be killed by system memory. Re-run
      any failure individually before believing it.
- [ ] REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`.
- [ ] Say what is left: the timezone decision's consequences if it was deferred, and #51 parts 2–3.

---

## Self-Review

**Spec coverage.** The owner asked for Rize's dashboard update aligned to this product. Rize's Home
"actions you need to take" → Task 2 + Task 3. Rize's Focus Hub "what time of day do I focus the
best?" → Task 1. Rize's "demote derived metrics beneath the fundamental unit" → Task 3's hierarchy
note, where it is argued that this product is already on the right side of it. Rize's Goals,
Projects, Work Hours, Focus Time and Break Time → excluded, each against the named rule. Rize's
"separate views per use case" → deferred, with the reason stated.

**Type consistency.** `contrastByPartOfDay` returns `PartOfDayContrast | null`; Task 3 renders it
behind a null check and the `PATTERN_MIN_SESSIONS` gate. `answerableBacklog(rows, now)` takes an
explicit `now` so the window is testable without faking the clock. `BacklogRow.endedAt` is
`string | null` and Task 3 maps `ended_at` through `toISOString()` to match.

**Known risks.**
- **The timezone blocker is unresolved and gates Task 1.** Under option C the branch delivers Tasks
  2–4 only, and that is a legitimate outcome, not a failure.
- `.m-ledger-actions` and `.m-ledger-pattern` add a fifth structural family to a class contract that
  is already the subject of an open owner decision. Task 4 declares them; it must not resolve #51.
- Task 3's third test may pass before the change. That is intended — it is a regression guard, and
  the report must say it passed at RED so nobody mistakes it for proof the feature works.
- `toWords` covers 0–99 and falls back to digits. A backlog of 100+ would render a numeral; the
  fourteen-day window makes that nearly unreachable, and it degrades to a digit rather than breaking.
