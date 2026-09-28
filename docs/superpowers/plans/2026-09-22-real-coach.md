# The Real Coach — Implementation Plan (Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Depends on `docs/superpowers/plans/2026-09-22-verdict-taxonomy.md` having run first** (owner decision 2026-09-22: Plan 2, then this). This plan does not touch the verdict vocabulary and has no hard code dependency on it, but `lib/dashboard-figures.ts:96`'s default label (`'work'` → `'focused'`) is expected to already be migrated by the time Task 2 here reuses `rankDomains`. If Plan 2 has not run, `rankDomains`'s fallback label is still `'work'` — harmless to this plan (the coach never reads `DomainRank.label`), but confirm before starting so the sequencing assumption is not silently wrong.

**Goal:** Replace `app/api/coach/chat/route.ts`'s keyword-matching stub — which fabricates session statistics (`'5 hr 33 min'`, `sessionCount = 11`) whenever its own DB lookup finds nothing — with a real, Groq-backed conversational coach that speaks only from the user's actual recorded data and says so plainly when there is none.

**Architecture:** Two new pure, unit-tested modules do the thinking: `lib/coach-context.ts` turns real session/event rows into a typed, honest summary (never fabricated), and `lib/coach-prompt.ts` turns that summary plus the conversation history into the message array a model call needs. The route wires them to a single non-streaming Groq chat completion — no schema, since a coach reply is prose, not a per-visit label — logs the call to the existing `inference_call` table, and reuses that same table to enforce a daily turn cap. The client (`app/companion-pet.tsx`) is untouched: the request and response JSON shapes do not change.

**Why non-streaming:** `app/companion-pet.tsx:98` already does a plain `fetch` + `await res.json()` — no stream consumption exists on the client today. Streaming would need a client rewrite for a latency win that matters little at `DAILY_COACH_TURNS`-per-day volume. See ADR-00XX (Task 1) for the full reasoning.

**Tech Stack:** Next.js 16 App Router · Neon Postgres (`@neondatabase/serverless`) · Groq OpenAI-compatible endpoint (`ADR-0072`) · `node --test` · Playwright.

## Global Constraints

- **`docs/adr/` is canonical (ADR-0063).** Where an ADR and any other document disagree, the ADR is right; reconcile the other document, never silently pick one.
- **An ADR records a decision already taken, never a proposal.** One decision per file, append-only, never edited after acceptance.
- **TDD is mandatory** (`AGENTS.md`): a failing test before every behaviour change.
- **Definition of done:** `npm test`, `npm run test:e2e` and `npx tsc --noEmit` all pass.
- **Every PR links a GitHub Project 16 issue** (`Closes #NN`). Create it with `gh issue create` and add it to Project 16 if it does not exist, before opening the PR.
- **Never add AI or assistant attribution to a commit message.**
- **`lib/` holds pure functions with no `@/` imports** so `node --test` can run them directly; a `lib/` → `lib/` import uses a relative path with the `.ts` extension (`from './dashboard-figures.ts'`).
- **Never a fabricated number.** Every figure the coach states must come from `CoachContext`. When there is no data, the reply says so — it never invents a plausible-looking one. This is the whole reason this plan exists.
- **Never log a prompt or response body**, including on an HTTP error — an error body can echo the request (ADR-0072's rule, unchanged for a second Groq consumer).
- **ADR number for this plan: confirm before writing, expected `0079`.** Plan 2 (`2026-09-22-verdict-taxonomy.md`) takes 0076–0078 if it ran first, as this plan assumes. Run `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -3` before Task 1 and use whatever the next free number actually is — do not trust the number written here if it disagrees.

---

### Task 1: Write the ADR

**Files:**
- Create: `docs/adr/ADR-0079-the-coach-speaks-from-real-data-only.md` (confirm the number first — see Global Constraints)
- Modify: `docs/index.md` (§6 decision table — add one row)

**Interfaces:**
- Consumes: ADR-0072 (Groq/ZDR posture), ADR-0075 (premium suspended, `DAILY_COACH_TURNS` not a paywall).
- Produces: the decision Tasks 2–4 implement.

- [ ] **Step 1: Confirm the ADR number and read house style**

Run: `ls docs/adr/ | grep -oE 'ADR-[0-9]{4}' | sort -u | tail -3 && cat docs/adr/ADR-0066-one-claim-about-the-user-at-a-time.md`

Field order: `**Date:**`, `**Status:**`, `**Supersedes:**` (only where one applies), `**Context:**`, `**Decision:**`, `**Consequences:**`, `**Source:**`. Use today's actual date, and whatever ADR number the `ls` above actually shows as next-free — replace every `0079` below with it if it differs.

- [ ] **Step 2: Write the ADR**

Create `docs/adr/ADR-0079-the-coach-speaks-from-real-data-only.md` (renumber the filename too if Step 1's check disagreed):

```markdown
# ADR-0079 — The coach speaks with Groq, non-streaming, and never invents a number

- **Date:** 2026-09-22
- **Status:** Accepted
- **Context:** The coach chat drawer shipped wired to a real UI (`app/companion-pet.tsx`) before any model existed behind it — `app/api/coach/chat/route.ts` matched keywords and fell back to hardcoded figures (`'5 hr 33 min'`, `sessionCount = 11`) whenever its own database lookup found nothing, presenting fabricated numbers as if they were the user's real record. This was flagged as a risk during the judge spike's PR (#61) and is exactly what `docs/design-toolkit.md` §9 and ADR-0068 refuse. ADR-0072 already committed the product's inference posture — Groq, Zero Data Retention, no prompt or response body ever logged — for the judge; the coach is this posture's second consumer. ADR-0075 makes the coach free for the testing phase, gated only by a turn cap, not a paywall.
- **Decision:** The coach calls Groq's `openai/gpt-oss-120b` as a plain, non-streaming chat completion — no `response_format` schema, since a coach reply is prose, not a per-visit label, and the larger tier over the judge's `openai/gpt-oss-120b`-or-`20b` choice is deliberate: a conversational surface is judged on quality, and turn volume is bounded by `DAILY_COACH_TURNS`/day rather than the judge's per-visit volume, so the cost difference is negligible. The coach speaks only from `CoachContext` (`lib/coach-context.ts`), built from the user's own real session and event rows for the current month — never a hardcoded fallback. When there is no data, the reply says so plainly. Every call is logged to the existing `inference_call` table with `session_ids = '{}'` (a coach turn covers no batch of sessions, unlike a judge analysis), which serves two purposes at once: M9/K6 cost visibility, still required under ADR-0075, and the mechanism that enforces `DAILY_COACH_TURNS` by counting today's rows for that user and model.
- **Consequences:** No client change is required — the request/response JSON contract (`{messages, intention}` in, `{reply, stats}` out) is unchanged, so `app/companion-pet.tsx:98`'s `fetch` needs no rewrite. Streaming, which would give a snappier per-token render, is deliberately deferred: `app/companion-pet.tsx` has no stream-consuming code path today, adding one is a client-side task in its own right, and at `DAILY_COACH_TURNS`-per-day volume the latency cost of a full completion is acceptable for a first real version — reconsider only if real usage shows turn frequency the current UX cannot tolerate. `inference_call.session_ids` gains a second meaning (a judge's batch, or empty for a coach turn) rather than a new column or table, since the $/token bookkeeping SDD Q6/V8 already reads from this table is identical either way.
- **Source:** owner decision 2026-09-22; ADR-0072; ADR-0075.
```

- [ ] **Step 3: Add the decision-table row**

In `docs/index.md` §6, add one row after the last existing one, matching the format: `| **D79** | **The coach calls Groq (openai/gpt-oss-120b), non-streaming, speaking only from real session data — never a fabricated fallback number** | 2026-09-22 | ADR-0079 |` (renumber `D79` to match whatever number Step 1 confirmed).

- [ ] **Step 4: Commit**

```bash
git add docs/adr/ADR-0079-the-coach-speaks-from-real-data-only.md docs/index.md
git commit -m "docs(adr): the coach speaks from Groq, non-streaming, real data only (ADR-0079)"
```

---

### Task 2: Build the context the coach is allowed to speak from

**Files:**
- Create: `lib/coach-context.ts`
- Test: `test/coach-context.test.js`

**Interfaces:**
- Consumes: `EventRow`, `totalsByKind`, `rankDomains`, `formatHm` from `./dashboard-figures.ts` (all already exported, unchanged).
- Produces, for Task 3 and Task 4:

```ts
export type CoachTopSite = { domain: string; share: number }
export type CoachContext = {
  hasData: boolean
  totalAttended: string
  totalAway: string
  sessionCount: number
  finishedCount: number
  notYetCount: number
  topSites: CoachTopSite[]
}
export function buildCoachContext(
  sessions: { outcome: string | null }[],
  events: EventRow[],
): CoachContext
```

- [ ] **Step 1: Write the failing tests**

Create `test/coach-context.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachContext } from '../lib/coach-context.ts'

test('no sessions means no data, not zeroed-out fake data', () => {
  const c = buildCoachContext([], [])
  assert.equal(c.hasData, false)
  assert.equal(c.sessionCount, 0)
  assert.deepEqual(c.topSites, [])
})

test('real sessions produce real aggregates', () => {
  const sessions = [{ outcome: 'yes' }, { outcome: 'no' }, { outcome: 'yes' }]
  const events = [
    { kind: 'attention', domain: 'docs.google.com', seconds: 1800, label: 'focused' },
    { kind: 'attention', domain: 'chatgpt.com', seconds: 600, label: 'focused' },
    { kind: 'away', domain: null, seconds: 300, label: null },
  ]
  const c = buildCoachContext(sessions, events)
  assert.equal(c.hasData, true)
  assert.equal(c.sessionCount, 3)
  assert.equal(c.finishedCount, 2)
  assert.equal(c.notYetCount, 1)
  assert.equal(c.totalAttended, '40 min')
  assert.equal(c.totalAway, '5 min')
  assert.deepEqual(c.topSites, [
    { domain: 'docs.google.com', share: 75 },
    { domain: 'chatgpt.com', share: 25 },
  ])
})

test('sessions with no matching events still count, with zeroed durations', () => {
  const c = buildCoachContext([{ outcome: 'yes' }], [])
  assert.equal(c.hasData, true)
  assert.equal(c.sessionCount, 1)
  assert.equal(c.totalAttended, '0 min')
  assert.deepEqual(c.topSites, [])
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/coach-context.test.js`
Expected: FAIL — `Cannot find module '../lib/coach-context.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/coach-context.ts`:

```ts
/** Turns real session/event rows into the ONLY data the coach is allowed to speak from.
 *
 *  ADR-0079: the coach's predecessor fabricated figures ('5 hr 33 min', sessionCount = 11)
 *  whenever its database lookup found nothing, and presented them as the user's real record.
 *  `hasData: false` is the honest alternative — the caller must render it as "no data yet",
 *  never paper over it with a plausible-looking number.
 */
import { totalsByKind, rankDomains, formatHm, type EventRow } from './dashboard-figures.ts'

export type CoachTopSite = { domain: string; share: number }
export type CoachContext = {
  hasData: boolean
  totalAttended: string
  totalAway: string
  sessionCount: number
  finishedCount: number
  notYetCount: number
  topSites: CoachTopSite[]
}

export function buildCoachContext(
  sessions: { outcome: string | null }[],
  events: EventRow[],
): CoachContext {
  if (sessions.length === 0) {
    return {
      hasData: false,
      totalAttended: '',
      totalAway: '',
      sessionCount: 0,
      finishedCount: 0,
      notYetCount: 0,
      topSites: [],
    }
  }

  const totals = totalsByKind(events)
  const ranked = rankDomains(events, 4)

  return {
    hasData: true,
    totalAttended: formatHm(totals.attention),
    totalAway: formatHm(totals.away),
    sessionCount: sessions.length,
    finishedCount: sessions.filter((s) => s.outcome === 'yes').length,
    notYetCount: sessions.filter((s) => s.outcome === 'no').length,
    topSites: ranked.map((r) => ({ domain: r.domain, share: r.share })),
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/coach-context.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/coach-context.ts test/coach-context.test.js
git commit -m "feat(coach): build the coach's context from real data only, never a fallback (ADR-0079)"
```

---

### Task 3: Build the messages a model call needs

**Files:**
- Create: `lib/coach-prompt.ts`
- Test: `test/coach-prompt.test.js`

**Interfaces:**
- Consumes: `CoachContext` from Task 2.
- Produces, for Task 4:

```ts
export type Role = 'system' | 'user' | 'assistant'
export type ChatTurn = { role: Role; content: string }
export function buildCoachMessages(
  context: CoachContext,
  intention: string,
  history: ChatTurn[],
): ChatTurn[]
```

- [ ] **Step 1: Write the failing tests**

Create `test/coach-prompt.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCoachMessages } from '../lib/coach-prompt.ts'

const withData = {
  hasData: true,
  totalAttended: '40 min',
  totalAway: '5 min',
  sessionCount: 3,
  finishedCount: 2,
  notYetCount: 1,
  topSites: [{ domain: 'docs.google.com', share: 75 }],
}

const noData = {
  hasData: false,
  totalAttended: '',
  totalAway: '',
  sessionCount: 0,
  finishedCount: 0,
  notYetCount: 0,
  topSites: [],
}

test('the system message states the coach never grades the person', () => {
  const [system] = buildCoachMessages(withData, 'draft the proposal', [])
  assert.equal(system.role, 'system')
  assert.match(system.content, /never/i)
  assert.match(system.content, /grad|score/i)
})

test('the system message states Yes and Not yet are equally valid', () => {
  const [system] = buildCoachMessages(withData, 'draft the proposal', [])
  assert.match(system.content, /not yet/i)
})

test('real figures appear verbatim when there is data', () => {
  const [system] = buildCoachMessages(withData, 'draft the proposal', [])
  assert.match(system.content, /40 min/)
  assert.match(system.content, /5 min/)
  assert.match(system.content, /docs\.google\.com/)
  assert.match(system.content, /75%/)
  assert.match(system.content, /draft the proposal/)
})

test('no data means an honest statement, never an invented figure', () => {
  const [system] = buildCoachMessages(noData, 'draft the proposal', [])
  assert.match(system.content, /no sessions/i)
  assert.doesNotMatch(system.content, /\d+ (hr|min)/)
})

test('conversation history passes through unchanged, after the system message', () => {
  const history = [
    { role: 'user' as const, content: 'how am I doing?' },
    { role: 'assistant' as const, content: 'You have logged some time today.' },
  ]
  const messages = buildCoachMessages(withData, 'draft the proposal', history)
  assert.equal(messages.length, 3)
  assert.deepEqual(messages.slice(1), history)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/coach-prompt.test.js`
Expected: FAIL — `Cannot find module '../lib/coach-prompt.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/coach-prompt.ts`:

```ts
/** Builds the message array for the coach's model call.
 *
 *  ADR-0079: the coach speaks only from CoachContext. The DATA line below is the one place
 *  real numbers enter the prompt, and the system message instructs the model never to depart
 *  from it — an invented figure would be indistinguishable from the fabricated stub this
 *  plan replaces.
 */
import type { CoachContext } from './coach-context.ts'

export type Role = 'system' | 'user' | 'assistant'
export type ChatTurn = { role: Role; content: string }

function dataLine(context: CoachContext, intention: string): string {
  const intentionPart = `Current intention: "${intention}".`
  if (!context.hasData) {
    return `${intentionPart} No sessions recorded yet this month.`
  }
  const sites = context.topSites.length > 0
    ? context.topSites.map((s) => `${s.domain} (${s.share}%)`).join(', ')
    : 'none recorded'
  return [
    intentionPart,
    `This month: ${context.totalAttended} attended, ${context.totalAway} away,`,
    `across ${context.sessionCount} sessions`,
    `(${context.finishedCount} answered "yes", ${context.notYetCount} answered "not yet").`,
    `Top surfaces: ${sites}.`,
  ].join(' ')
}

export function buildCoachMessages(
  context: CoachContext,
  intention: string,
  history: ChatTurn[],
): ChatTurn[] {
  const system: ChatTurn = {
    role: 'system',
    content: [
      'You are the MEANT coach — a reflective conversation partner for someone using an',
      'attention-tracking app. You are never a grader.',
      '',
      'Rules:',
      '- "Yes" and "Not yet" are equally valid outcomes. Never treat "Not yet" as failure,',
      '  and never praise "Yes" as success — both are honest evidence about scope, not worth.',
      '- Use only the numbers in the DATA line below, exactly as given. Never invent,',
      '  estimate, or round a figure that was not given.',
      '- If DATA says no sessions are recorded, say so plainly. Do not soften it with an',
      '  invented number.',
      '- Never compute or imply a single productivity score, grade, or rating of any kind.',
      "- Speak about the work, never about the person's character or worth.",
      '',
      `DATA: ${dataLine(context, intention)}`,
    ].join('\n'),
  }

  return [system, ...history]
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/coach-prompt.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/coach-prompt.ts test/coach-prompt.test.js
git commit -m "feat(coach): build the model's messages from context, never inventing a figure (ADR-0079)"
```

---

### Task 4: Wire the route to a real Groq call

**Files:**
- Modify: `app/api/coach/chat/route.ts` (whole file)

**Interfaces:**
- Consumes: `buildCoachContext` (Task 2), `buildCoachMessages`/`ChatTurn` (Task 3), `costOf` from `@/lib/inference-cost`, `DAILY_COACH_TURNS` from `@/lib/thresholds`.
- Produces: `POST /api/coach/chat` — same request/response JSON shape as before (`{messages, intention}` in, `{reply, stats}` out), now backed by a real model call.

No test file for this task: the route imports `@/lib/db` and `@/lib/auth/session`, which `node --test` cannot resolve (AGENTS.md's `@/` rule) and which require a live database and a real Groq call to exercise for real. Task 2 and Task 3 already cover every pure decision this route makes; this task is wiring, verified by Task 5's e2e test and a manual check.

- [ ] **Step 1: Replace the whole file**

Replace the whole of `app/api/coach/chat/route.ts`:

```ts
import { currentUserId } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { type EventRow } from '@/lib/dashboard-figures'
import { buildCoachContext } from '@/lib/coach-context'
import { buildCoachMessages, type ChatTurn } from '@/lib/coach-prompt'
import { costOf } from '@/lib/inference-cost'
import { DAILY_COACH_TURNS } from '@/lib/thresholds'

export const dynamic = 'force-dynamic'

// ADR-0079. The larger tier over the judge's cheaper default: a conversational surface is
// judged on quality, and DAILY_COACH_TURNS already bounds the volume this runs at.
const COACH_MODEL = 'openai/gpt-oss-120b'

function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  const out: ChatTurn[] = []
  for (const m of value) {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const history = parseHistory(body?.messages)
  const intention = typeof body?.intention === 'string' ? body.intention.trim() : ''

  const userId = await currentUserId()
  if (!userId) {
    return Response.json({ error: 'not signed in' }, { status: 401 })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    // Never a fabricated reply: an unconfigured server says so, rather than inventing
    // coaching advice with no model behind it.
    return Response.json({ reply: 'The coach is not configured yet — no API key set.', stats: null })
  }

  const turnsToday = (await sql`
    select count(*) from inference_call
     where user_id = ${userId}
       and model = ${COACH_MODEL}
       and at >= date_trunc('day', now())`) as { count: string }[]

  if (Number(turnsToday[0]?.count ?? 0) >= DAILY_COACH_TURNS) {
    return Response.json({
      reply: `You've reached today's conversation limit (${DAILY_COACH_TURNS} turns). Your record is unaffected — come back tomorrow.`,
      stats: null,
    })
  }

  const monthSessions = (await sql`
    select outcome from session
     where user_id = ${userId}
       and started_at >= date_trunc('month', now())`) as { outcome: string | null }[]

  const eventRows = (await sql`
    select e.kind, e.domain, e.seconds, e.label
      from event e
      join session s on s.id = e.session_id
     where s.user_id = ${userId}
       and s.started_at >= date_trunc('month', now())`) as unknown as EventRow[]

  const context = buildCoachContext(monthSessions, eventRows)
  const messages = buildCoachMessages(context, intention, history)

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: COACH_MODEL, temperature: 0.4, messages }),
  })

  if (!res.ok) {
    // Never print the body: on some errors it echoes the request (ADR-0072).
    console.error(`coach: HTTP ${res.status} ${res.statusText}`)
    return Response.json({ reply: "I couldn't reach the coach just now — try again in a moment.", stats: null })
  }

  const data = await res.json()
  const reply: string =
    data.choices?.[0]?.message?.content?.trim() || "I don't have a reply for that — try rephrasing?"
  const inputTokens = data.usage?.prompt_tokens ?? 0
  const outputTokens = data.usage?.completion_tokens ?? 0

  await sql`
    insert into inference_call (user_id, session_ids, model, input_tokens, output_tokens, cost_usd)
    values (
      ${userId}, '{}', ${COACH_MODEL}, ${inputTokens}, ${outputTokens},
      ${costOf({ model: COACH_MODEL, inputTokens, outputTokens })}
    )`

  return Response.json({ reply, stats: context })
}
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add app/api/coach/chat/route.ts
git commit -m "feat(coach): call Groq for real, drop every fabricated fallback figure (ADR-0079)"
```

---

### Task 5: Verify the whole thing, including a real e2e case for the send/reply flow

**Files:**
- Modify: `e2e/ledger.spec.ts` (add one case; the existing case at line ~44 only opens the drawer)

**Interfaces:**
- Consumes: nothing new.
- Produces: regression coverage for the request/response wiring, without needing a real Groq call in CI.

- [ ] **Step 1: Write the failing test**

In `e2e/ledger.spec.ts`, inside the existing `test.describe('Daily Ledger & Dual-Surface Navigation', ...)` block, add a new case in the same style as the three already there (`async ({ context, freshAccount }) => { ... }`, a fresh page, viewport, `freshAccount(page)`):

```ts
test('sending a message in the coach drawer renders the real reply, not a client-side fallback', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await freshAccount(page)

  await page.route('**/api/coach/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'Your longest surface this month was docs.google.com at 75%.',
        stats: { hasData: true, totalAttended: '40 min', totalAway: '5 min', sessionCount: 3, finishedCount: 2, notYetCount: 1, topSites: [{ domain: 'docs.google.com', share: 75 }] },
      }),
    })
  })

  await page.goto('/ledger')
  await page.locator('.m-web-companion-actor').click()
  const drawer = page.locator('.m-coach-drawer')
  await expect(drawer).toBeVisible()

  await drawer.locator('.m-coach-input').fill('how did I do this month?')
  await drawer.locator('.m-coach-send-btn').click()

  await expect(drawer).toContainText('docs.google.com at 75%')
})
```

Route interception (`page.route`) intercepts the request before it leaves the browser, so this exercises the real client-side `sendMessage` wiring in `app/companion-pet.tsx` without needing a live `GROQ_API_KEY` or database state in CI — matching this file's existing style of testing the UI's contract with its API, not the API's own internals.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/ledger.spec.ts -g "renders the real reply"`
Expected: FAIL against the stub (before Task 4 lands) or PASS trivially if run after — this step matters most when this plan is executed in order, Task 4 before Task 5.

- [ ] **Step 3: Run the whole gate**

Run: `npm test && npx tsc --noEmit && npm run build && npm run test:e2e`
Expected: all pass.

- [ ] **Step 4: Manual check**

Start the dev server, open `/ledger`, click the companion to open the drawer, send a real message. With `GROQ_API_KEY` set, confirm a real, non-templated reply renders and references only real numbers (or honestly says there is no data, if the signed-in account has no sessions this month). Confirm sending `DAILY_COACH_TURNS + 1` messages in one day shows the limit message instead of a 41st real call.

- [ ] **Step 5: Commit**

```bash
git add e2e/ledger.spec.ts
git commit -m "test(coach): cover the send/reply flow, mocking the network boundary (ADR-0079)"
```

---

## Verification — the whole plan

- [ ] `npm test` — all unit tests pass, including the two new coach test files
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — clean
- [ ] `npm run test:e2e` — passes, including the new send/reply case
- [ ] `grep -rn "5 hr 33 min\|1 hr 14 min\|sessionCount = 11" app` — no matches; every fabricated figure is gone
- [ ] Manual: the coach gives a real reply grounded in real data, or honestly says there is none

## What this plan deliberately does not do

- **No streaming.** See ADR-0079's Consequences — the client has no stream-consuming code today, and turn volume does not demand it yet.
- **No cross-session pattern references.** `PATTERN_MIN_SESSIONS` (`lib/thresholds.ts`) stays unused by the coach, as its own comment already says — folding in a `contrastByOutcome`/`contrastByPartOfDay`-style claim is a real design decision (ADR-0066's one-claim-at-a-time rule would need to be reconciled against a *conversational* surface, which is a different problem than the dashboard's one-line render) and is not decided here.
- **No new table.** `inference_call` already existed for exactly this bookkeeping; ADR-0079 explains why reusing it (with an empty `session_ids`) is simpler than adding one.
- **No UI change.** `app/companion-pet.tsx` is untouched — the JSON contract this plan preserves is what makes that true.
