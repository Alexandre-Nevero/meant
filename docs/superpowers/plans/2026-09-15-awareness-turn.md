# The Awareness Turn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the decisions recorded in ADR-0052 through ADR-0064 — remove the companion's drift signal, turn the companion into a one-tap input, persist the session declaration that has never once reached the database, store paths on-device, and build the arithmetic the coach needs before any model call exists.

**Architecture:** Every task here is either a deletion or a small addition to shipped code. **No model call is introduced by this plan.** The batched judge (ADR-0060) is deliberately a separate, later plan: it depends on Tasks 1–6 producing data it does not have today. Server-side changes are additive columns already present in the schema; extension changes are local-storage-only.

**Tech Stack:** Next.js App Router (TypeScript), Neon Postgres via `@neondatabase/serverless`, Chrome MV3 extension (plain ESM JavaScript), `node --test` for unit tests, Playwright for e2e.

## Global Constraints

- **`docs/adr/` is the most up-to-date record (ADR-0063).** Where an ADR and any other document disagree, the ADR is right. Any decision made while executing this plan is appended as a new ADR in the same session.
- **Never write a hex value in a component** (`CLAUDE.md`). `design/tokens.css` is the contract; use `var(--m-*)`.
- **I2 is absolute (ADR-0057).** Nothing good happens on screen during a session. A *receipt* for a user-initiated tap is permitted; a celebration is not.
- **I7 as amended (ADR-0059, ADR-0061):** page text and page titles are never read. Full paths live in extension local storage only and are never written to Postgres. `event.domain` stays hostname-only (D8).
- **No total-hours figure, no percentage, no score, on any surface** (PRD §3.1).
- **Nothing waits on a model** (PRD §7). Session start stays under 200ms.
- **The popup animates nothing** (`CLAUDE.md`).
- **No step may require a Chrome Web Store review** (`apexhuman.md` rule 8).
- **Windows and macOS identically** (`apexhuman.md` rule 9). No macOS-only convenience.
- **Never add AI/assistant attribution to a commit** (`GLOBAL.md`). No `Co-Authored-By`, no "Generated with" trailer.
- Definition of done per `AGENTS.md`: `npm test`, `npm run test:e2e`, and `npx tsc --noEmit` all pass.

---

### Task 1: Persist the session declaration

**Why first:** `work_sites` and `blocked_domains` are non-empty in **0 of 3,668 session rows**. The extension already sends them (`extension/sw.js:155`); the API route silently drops them. ADR-0035's three-question design — the thing that resolves PRD §1.2's Instagram case with no model — has never once produced data. This is the cheapest unblock in the project and every later task reads what it writes.

**Files:**
- Modify: `app/api/sessions/route.ts:19-26`
- Test: `test/sessions-payload.test.js` (create)

**Interfaces:**
- Consumes: the POST body already sent by `startSession()` — `{ id, intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle, startedAt }`, where `cycle` is `{ work: number, break: number } | null`.
- Produces: `normalizeStartPayload(body)` exported from `app/api/sessions/route.ts`, returning `{ intention: string, plannedMinutes: number|null, blocklist: string[], blockedDomains: string[], workSites: string[], cycleWorkMin: number|null, cycleBreakMin: number|null }`. Task 6 reads the columns it fills.

- [ ] **Step 1: Write the failing test**

```javascript
// test/sessions-payload.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStartPayload } from '../app/api/sessions/route.ts'

test('normalizeStartPayload carries workSites, blockedDomains and cycle through', () => {
  const out = normalizeStartPayload({
    intention: 'write the proposal',
    plannedMinutes: 30,
    blocklist: ['social'],
    blockedDomains: ['facebook.com'],
    workSites: ['docs.google.com'],
    cycle: { work: 25, break: 5 },
  })
  assert.deepEqual(out.workSites, ['docs.google.com'])
  assert.deepEqual(out.blockedDomains, ['facebook.com'])
  assert.equal(out.cycleWorkMin, 25)
  assert.equal(out.cycleBreakMin, 5)
})

test('normalizeStartPayload defaults a null cycle to null minutes, not zero', () => {
  const out = normalizeStartPayload({ cycle: null })
  assert.equal(out.cycleWorkMin, null)
  assert.equal(out.cycleBreakMin, null)
})

test('normalizeStartPayload coerces non-arrays to empty arrays rather than throwing', () => {
  const out = normalizeStartPayload({ workSites: 'docs.google.com', blockedDomains: undefined })
  assert.deepEqual(out.workSites, [])
  assert.deepEqual(out.blockedDomains, [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/sessions-payload.test.js`
Expected: FAIL — `normalizeStartPayload` is not exported from `app/api/sessions/route.ts`.

- [ ] **Step 3: Write minimal implementation**

In `app/api/sessions/route.ts`, add above `POST`:

```typescript
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

export function normalizeStartPayload(body: Record<string, unknown>) {
  const cycle = body.cycle as { work?: number; break?: number } | null | undefined
  return {
    intention: typeof body.intention === 'string' ? body.intention : '',
    plannedMinutes: Number.isInteger(body.plannedMinutes) ? (body.plannedMinutes as number) : null,
    blocklist: strArray(body.blocklist),
    blockedDomains: strArray(body.blockedDomains),
    workSites: strArray(body.workSites),
    cycleWorkMin: Number.isInteger(cycle?.work) ? (cycle!.work as number) : null,
    cycleBreakMin: Number.isInteger(cycle?.break) ? (cycle!.break as number) : null,
  }
}
```

Then replace the body of `POST` from the `const intention = ...` line through the `await sql\`...\`` statement with:

```typescript
  const p = normalizeStartPayload(body)

  // Idempotent: a replayed queued start (offline retry) must not overwrite an ended_at
  // that a later PATCH already wrote, so conflicts do nothing rather than update.
  await sql`
    insert into session (
      id, user_id, device_id, intention, planned_minutes, blocklist, started_at,
      work_sites, blocked_domains, cycle_work_min, cycle_break_min)
    values (
      ${body.id}, ${device.user_id}, ${device.id}, ${p.intention}, ${p.plannedMinutes},
      ${p.blocklist}, ${body.startedAt},
      ${p.workSites}, ${p.blockedDomains}, ${p.cycleWorkMin}, ${p.cycleBreakMin})
    on conflict (id) do nothing`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/sessions-payload.test.js && npx tsc --noEmit`
Expected: PASS, and no type errors.

- [ ] **Step 5: Verify against a real session end-to-end**

Run: `npm run test:e2e -- e2e/session-lifecycle.spec.ts`
Expected: PASS. Then start one real session in the loaded-unpacked extension with at least one work site and one blocked site, and confirm the row landed:

```bash
# read-only; delete the probe immediately after
node -e "1" # placeholder — use the probe pattern in the scratchpad note, .env.local is never printed
```
Expected: `array_length(work_sites,1) > 0` for that session id. **This is the acceptance test for the whole task** — the unit test proves the shape, only a real row proves the wiring.

- [ ] **Step 6: Commit**

```bash
git add app/api/sessions/route.ts test/sessions-payload.test.js
git commit -m "feat(api): persist work_sites, blocked_domains and cycle on session start

The extension has sent these since round 6; the route dropped them, leaving
ADR-0035's three-question design with zero rows in 3,668 sessions."
```

---

### Task 2: Remove the companion's live drift signal

**Why here:** ADR-0057. It must land before Task 4, because the tap reuses the ring-collapse motion that the drift signal currently owns, and because leaving dead signalling code in place while adding the input would leave two competing sources of companion state.

**Files:**
- Modify: `extension/sw.js:202-204` (delete constants), `extension/sw.js:206-240` (delete `isKnownDistraction` and `updateCompanion`), and every call site of `updateCompanion`
- Modify: `lib/thresholds.ts` (delete five now-dead constants)
- Modify: `extension/companion-overlay.js` (remove the `drifting` ring state)
- Test: `e2e/companion.spec.ts` (modify — remove drift assertions)

**Interfaces:**
- Consumes: nothing.
- Produces: the companion's only remaining states are `settled` (session running) and absent (no session). `companionState` in `chrome.storage.local` no longer takes the value `'drifting'`.

- [ ] **Step 1: Find every call site before deleting anything**

Run:
```bash
grep -rn "updateCompanion\|isKnownDistraction\|DRIFT_GRACE_MS\|DRIFT_WINDOW_MS\|DRIFT_BUDGET\|drifting" extension/ lib/ app/ test/ e2e/
```
Expected: `extension/sw.js` (declaration plus one call site at the tab-change handler), `extension/companion-overlay.js` (ring state), `e2e/companion.spec.ts`. Record the exact list — you delete exactly these and nothing else.

- [ ] **Step 2: Write the failing test**

```javascript
// test/companion-state.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ADR-0057: the drift signal is removed, not disabled. A constant left behind is a
// constant someone rewires in six months.
test('no drift-signal symbol survives anywhere in the extension', () => {
  const sw = readFileSync('extension/sw.js', 'utf8')
  for (const symbol of ['updateCompanion', 'isKnownDistraction', 'DRIFT_GRACE_MS', 'DRIFT_WINDOW_MS', 'DRIFT_BUDGET']) {
    assert.equal(sw.includes(symbol), false, `${symbol} still present in sw.js`)
  }
})

test('the companion overlay has no drifting ring state', () => {
  const overlay = readFileSync('extension/companion-overlay.js', 'utf8')
  assert.equal(overlay.includes('drifting'), false, 'drifting state still present in companion-overlay.js')
})

test('thresholds.ts no longer declares the five signalling constants', () => {
  const t = readFileSync('lib/thresholds.ts', 'utf8')
  for (const symbol of ['SIGNAL_BUDGET', 'SIGNAL_WINDOW_MS', 'REFRACTORY_MS', 'CONFIDENCE_FLOOR', 'DWELL_MS']) {
    assert.equal(t.includes(symbol), false, `${symbol} still declared`)
  }
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- test/companion-state.test.js`
Expected: FAIL on all three — the symbols are present.

- [ ] **Step 4: Delete**

In `extension/sw.js`: delete lines 202–204 (`DRIFT_GRACE_MS`, `DRIFT_WINDOW_MS`, `DRIFT_BUDGET`), the `isKnownDistraction` function, the explanatory comment block above `updateCompanion`, and `updateCompanion` in full. At its call site, delete the call — do not replace it with a no-op. If `BLOCKLISTS` becomes an unused import in `sw.js`, delete the import too; check with `grep -n "BLOCKLISTS" extension/sw.js` first, because `installRules` may still use it.

In `extension/companion-overlay.js`: remove the `drifting` branch from the ring-state handling so the ring is solid whenever a session is running. **Leave `showHoverPill` and the hover handlers untouched** — Task 4 builds on them.

In `lib/thresholds.ts`: delete `DWELL_MS`, `REFRACTORY_MS`, `SIGNAL_BUDGET`, `SIGNAL_WINDOW_MS`, `CONFIDENCE_FLOOR`. **Keep** `MEMORY_MIN_EVIDENCE`, `MEMORY_MIN_AGREEMENT` (Task 4 and ADR-0062 rely on them), `DAILY_JUDGMENT_CAP`, `PATTERN_MIN_SESSIONS`, `GRACE_MS`, `CYCLE_PRESETS`.

- [ ] **Step 5: Update the e2e spec**

In `e2e/companion.spec.ts`, delete any test asserting a dashed ring or a drift transition. Add:

```typescript
test('the companion never enters a drift state during a session', async ({ page, context }) => {
  // ADR-0057. Visiting a known distraction domain mid-session must change nothing.
  await startSession(page, context, { intention: 'write the proposal', blockedDomains: [] })
  await page.goto('https://facebook.com')
  const state = await readCompanionState(context)
  expect(state).not.toBe('drifting')
})
```
Reuse the existing helpers in `e2e/fixtures.ts`; if `readCompanionState` does not exist, add it there reading `chrome.storage.local.get('companionState')` the same way the existing companion assertions do.

- [ ] **Step 6: Run everything**

Run: `npm test && npx tsc --noEmit && npm run test:e2e -- e2e/companion.spec.ts`
Expected: PASS. `npm test` must pass in full — the deletion touches `lib/thresholds.ts`, which `test/tally.test.js` and `extension/popup.js` may import.

- [ ] **Step 7: Verify by rendering, not by build**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <running-session-url>` and look at the companion. Per `CLAUDE.md`, a clean build is not evidence.
Expected: a solid, breathing ring throughout a session, including while on a distraction domain.

- [ ] **Step 8: Commit**

```bash
git add extension/sw.js extension/companion-overlay.js lib/thresholds.ts e2e/companion.spec.ts test/companion-state.test.js
git commit -m "feat(companion): remove the live drift signal

ADR-0057. No way existed to report a false positive, the signal could only
fire on 14 domains, and the precision that would justify it was never
measurable — judgment.corrected_to is empty in an empty table."
```

---

### Task 3: Capture paths on-device, with a time-based TTL

**Why here:** ADR-0059. Task 4 labels visits and Task 6 compares them; both are better with paths, and the batched judge is impossible without them. It must land after Task 2 so path capture is not entangled with signalling code.

**Files:**
- Create: `extension/lib/path-log.js`
- Create: `test/path-log.test.js`
- Modify: `extension/sw.js` (record on transition; purge on alarm tick)

**Interfaces:**
- Consumes: `bareHostname()` from `extension/sw.js:89` for the host half.
- Produces: `appendVisit(log, { url, at, sessionId })`, `purgeExpired(log, now, ttlMs)`, and `PATH_TTL_MS` — all exported from `extension/lib/path-log.js`. A log entry is `{ sessionId, host, path, at }`. Task 6 and the future judge read this shape.

- [ ] **Step 1: Write the failing test**

```javascript
// test/path-log.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { appendVisit, purgeExpired, PATH_TTL_MS } from '../extension/lib/path-log.js'

test('appendVisit splits host from path and keeps the path', () => {
  const log = appendVisit([], { url: 'https://chatgpt.com/c/abc123', at: 1000, sessionId: 's1' })
  assert.equal(log[0].host, 'chatgpt.com')
  assert.equal(log[0].path, '/c/abc123')
})

test('appendVisit drops the query string and the fragment', () => {
  // A query string carries search terms and tokens. The path alone is enough to tell
  // one area of a site from another, which is all ADR-0059 needs.
  const log = appendVisit([], { url: 'https://x.com/search?q=private+thing#top', at: 1, sessionId: 's1' })
  assert.equal(log[0].path, '/search')
})

test('appendVisit ignores non-http protocols', () => {
  const log = appendVisit([], { url: 'chrome-extension://abc/page.html', at: 1, sessionId: 's1' })
  assert.equal(log.length, 0)
})

test('purgeExpired removes entries older than the TTL and keeps the rest', () => {
  const now = 10_000_000
  const log = [
    { sessionId: 's1', host: 'a.com', path: '/', at: now - PATH_TTL_MS - 1 },
    { sessionId: 's2', host: 'b.com', path: '/', at: now - 1000 },
  ]
  const kept = purgeExpired(log, now, PATH_TTL_MS)
  assert.equal(kept.length, 1)
  assert.equal(kept[0].host, 'b.com')
})

test('the TTL is time-based, not analysis-based', () => {
  // ADR-0059: a free-tier user never runs an analysis, so "purge after analysis"
  // would never fire for them and the log would grow without bound.
  assert.equal(typeof PATH_TTL_MS, 'number')
  assert.ok(PATH_TTL_MS > 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/path-log.test.js`
Expected: FAIL — `extension/lib/path-log.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```javascript
// extension/lib/path-log.js
// ADR-0059. Full paths live here and ONLY here — chrome.storage.local, on the user's
// machine. They are never written to Postgres. lib/migrations/002-drift.sql:24 is why:
// a path is a durable handle to a specific private document, which is worse than a
// title, not better. The browser's own history already holds this, so the device is
// not a new exposure class; the network boundary is the one that matters.

/** 30 days. Time-based on purpose: an on-demand analysis may never run (a free-tier
 *  user gets tracking and no analysis), so an event-based purge would never fire. */
export const PATH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function appendVisit(log, { url, at, sessionId }) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return log
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return log
  const host = parsed.hostname.replace(/^www\./, '')
  return [...log, { sessionId, host, path: parsed.pathname, at }]
}

export function purgeExpired(log, now, ttlMs = PATH_TTL_MS) {
  return log.filter((entry) => now - entry.at < ttlMs)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/path-log.test.js`
Expected: PASS, all five.

- [ ] **Step 5: Wire it into the service worker**

In `extension/sw.js`, in the same handler that calls `transition({ mode: 'attention', domain })` on a tab change, read `pathLog` from `chrome.storage.local`, call `appendVisit`, and write it back. In the existing `TICK` alarm handler, call `purgeExpired(log, Date.now())` and write back only if the length changed. Import from `./lib/path-log.js`.

- [ ] **Step 6: Verify the boundary holds**

Run:
```bash
grep -rn "path" app/api/ lib/migrations/ | grep -iv "pathname\|filepath\|import"
```
Expected: **no result that writes a path to the database.** This is the check that ADR-0059 is not quietly violated.

- [ ] **Step 7: Commit**

```bash
git add extension/lib/path-log.js test/path-log.test.js extension/sw.js
git commit -m "feat(extension): record visit paths on-device with a 30-day TTL

ADR-0059. Paths never reach Postgres; they exist so the batched post-session
judge can tell one area of a large site from another."
```

---

### Task 4: The companion's one-tap label

**Why here:** ADR-0058 and ADR-0062. Depends on Task 2 (the ring-collapse motion is free) and reads better with Task 3 (paths give the label context). It generates labelled ground truth **with no model call**, which matters because `judgment` has 0 rows and all 572 `memory` rows are `kind='list'`.

**Files:**
- Modify: `extension/companion-overlay.js` (add a click handler and the receipt)
- Modify: `extension/sw.js` (handle the message, write the label)
- Create: `test/visit-label.test.js`
- Modify: `e2e/companion.spec.ts`

**Interfaces:**
- Consumes: `showHoverPill()` and the existing pill element in `companion-overlay.js:266`.
- Produces: a runtime message `{ type: 'meant:not-the-work' }` from the overlay to the service worker, and `labelCurrentVisit(session, domain, at)` exported from `extension/sw.js`, which appends `{ domain, label: 'distract', at }` to `session.labels`. The existing `/api/events` payload gains these as `event.label` rows.

- [ ] **Step 1: Write the failing test**

```javascript
// test/visit-label.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { labelCurrentVisit } from '../extension/sw.js'

test('labelCurrentVisit records a per-visit label, not a domain classification', () => {
  // ADR-0062: pencil, not stone. Tapping "this isn't the work" on instagram.com at 4pm
  // must not teach the product that instagram is always drift — PRD 1.2 is the whole
  // reason. Memory forms only when the label recurs past MEMORY_MIN_EVIDENCE.
  const session = { sessionId: 's1', labels: [] }
  const next = labelCurrentVisit(session, 'instagram.com', 1000)
  assert.deepEqual(next.labels, [{ domain: 'instagram.com', label: 'distract', at: 1000 }])
})

test('labelCurrentVisit appends rather than replacing, so repeated taps accumulate evidence', () => {
  const session = { sessionId: 's1', labels: [{ domain: 'a.com', label: 'distract', at: 1 }] }
  const next = labelCurrentVisit(session, 'a.com', 2)
  assert.equal(next.labels.length, 2)
})

test('labelCurrentVisit is a no-op with no domain', () => {
  const session = { sessionId: 's1', labels: [] }
  assert.deepEqual(labelCurrentVisit(session, null, 1).labels, [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/visit-label.test.js`
Expected: FAIL — `labelCurrentVisit` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `extension/sw.js`:

```javascript
// ADR-0058 + ADR-0062. One tap, one meaning: "this isn't the work". A self-report
// cannot be a false positive, which is the whole reason the drift signal went.
// The label is per-VISIT. Memory forms only on repetition (MEMORY_MIN_EVIDENCE /
// MEMORY_MIN_AGREEMENT), never at n=1 — ADR-0037's n=1 rule governs corrections of a
// wrong flag, and there is no flag any more.
export function labelCurrentVisit(session, domain, at) {
  if (!domain) return session
  return { ...session, labels: [...(session.labels ?? []), { domain, label: 'distract', at }] }
}
```

Add a `chrome.runtime.onMessage` branch for `'meant:not-the-work'` that reads the session, calls `labelCurrentVisit(session, await activeDomain(), Date.now())`, writes it back, and returns `{ ok: true }`. Include `labels` in the `chrome.storage.local.set` inside `startSession` so the field starts as `[]`.

In `endSession`, include `session.labels` in the `/api/events` POST so they land as `event.label` rows. `event.label` already exists with values `work|distract|neutral|unknown` (ADR-0044, ADR-0047) — **no migration is needed.**

- [ ] **Step 4: Add the tap and its receipt to the overlay**

In `extension/companion-overlay.js`, add a `click` handler on `dot` that sends the message. Drag must still work: only treat it as a click if the pointer moved less than 4px between `pointerdown` and `pointerup`, otherwise a drag fires a label.

The receipt reuses the 0.6s ring-collapse freed by Task 2 (ADR-0057 → ADR-0058). **It is a receipt, not a celebration** — same motion, no colour change, no text. All colour via `var(--m-*)`; **no hex values.**

- [ ] **Step 5: Run tests**

Run: `npm test -- test/visit-label.test.js && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Add the e2e case**

```typescript
test('tapping the companion records a label and does not change the ring state', async ({ page, context }) => {
  await startSession(page, context, { intention: 'write the proposal', blockedDomains: [] })
  await page.goto('https://example.com')
  await tapCompanion(page)          // add to e2e/fixtures.ts if absent
  const session = await readSession(context)
  expect(session.labels).toHaveLength(1)
  expect(session.labels[0].label).toBe('distract')
  expect(await readCompanionState(context)).not.toBe('drifting')
})
```

Run: `npm run test:e2e -- e2e/companion.spec.ts`
Expected: PASS.

- [ ] **Step 7: Verify by rendering**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <running-session-url>`, hover the dot (the intention appears), tap it, and watch the receipt.
Expected: the pill shows the intention on hover; the tap produces one 0.6s ring-collapse and nothing else. No colour change, no text, no sound.

- [ ] **Step 8: Commit**

```bash
git add extension/companion-overlay.js extension/sw.js test/visit-label.test.js e2e/companion.spec.ts e2e/fixtures.ts
git commit -m "feat(companion): one tap records 'this isn't the work'

ADR-0058, ADR-0062. The companion stops telling the user things and becomes how
the user tells it things. Labels are per-visit; memory forms only on repetition."
```

---

### Task 5: Show what the product did not see

**Why here:** ADR-0054's build obligation. The boundary between served and not-served is now browser share reported at runtime, and nothing computes it. Independent of Tasks 2–4; placed here because it is the smallest honest change to the review.

**Files:**
- Modify: `lib/review-data.ts:5-15` (type) and `:19-60` (computation)
- Modify: `app/review/[sessionId]/page.tsx` (render it)
- Modify: `test/review-data.test.js`

**Interfaces:**
- Consumes: `session.started_at`, `session.ended_at`, and the existing `rows`.
- Produces: `ReviewData.unrecordedSeconds: number` — wall clock minus recorded attention minus away, floored at 0.

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/review-data.test.js
import { computeUnrecorded } from '../lib/review-data.ts'

test('computeUnrecorded is wall clock minus attention minus away', () => {
  const rows = [
    { kind: 'attention', domain: 'a.com', seconds: 600, hits: 1 },
    { kind: 'away', domain: null, seconds: 300, hits: 1 },
  ]
  // 30 minutes of wall clock, 15 minutes accounted for
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', '2026-09-15T10:30:00Z', rows), 900)
})

test('computeUnrecorded floors at zero rather than returning a negative', () => {
  // Clock skew between the extension and the server must never render as "-4 minutes".
  const rows = [{ kind: 'attention', domain: 'a.com', seconds: 9999, hits: 1 }]
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', '2026-09-15T10:01:00Z', rows), 0)
})

test('computeUnrecorded returns 0 for a session with no end', () => {
  assert.equal(computeUnrecorded('2026-09-15T10:00:00Z', null, []), 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/review-data.test.js`
Expected: FAIL — `computeUnrecorded` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `lib/review-data.ts`:

```typescript
/** ADR-0054. The boundary between "this product can see your work" and "it cannot" is
 *  browser share, reported at runtime rather than filtered by job title. A session
 *  where we watched twenty minutes of four hours must say so, instead of presenting a
 *  partial record as a whole one. */
export function computeUnrecorded(
  startedAt: string,
  endedAt: string | null,
  rows: ReviewRow[],
): number {
  if (!endedAt) return 0
  const wall = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  const accounted = rows
    .filter((r) => r.kind === 'attention' || r.kind === 'away')
    .reduce((total, r) => total + r.seconds, 0)
  return Math.max(0, wall - accounted)
}
```

Add `unrecordedSeconds: number` to `ReviewData`, select `started_at` (already selected), and set `unrecordedSeconds: computeUnrecorded(session.started_at, session.ended_at, rows)` in the return.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/review-data.test.js && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Render it**

In `app/review/[sessionId]/page.tsx`, render one line only when `unrecordedSeconds` exceeds a fifth of the session — otherwise it is noise. Wording is plain and carries no judgement, and **states minutes, never a percentage** (PRD §3.1 bans percentages on every surface):

> `Twelve minutes of this session happened outside the browser. This page cannot tell you about those.`

Spell the number as a word, consistent with the dashboard's `toWords` (`app/dashboard/page.tsx`). Use `var(--m-*)` for every colour.

- [ ] **Step 6: Verify by rendering**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <review-url>`
Expected: the line appears on a session with a large gap and is absent on a fully-recorded one.

- [ ] **Step 7: Commit**

```bash
git add lib/review-data.ts app/review/\[sessionId\]/page.tsx test/review-data.test.js
git commit -m "feat(review): say what the session did not see

ADR-0054. The served/not-served boundary is browser share reported at runtime,
not a job-title filter — so the review stops presenting a partial record as whole."
```

---

### Task 6: The arithmetic, before any judge

**Why here:** ADR-0060 states it directly — *"Build the arithmetic before the judge."* The single most useful sentence the product can say today needs no model, no page text and no cost: how attention differs between finished and unfinished sessions. It also becomes the first thing the batched judge is measured against: if a model cannot beat arithmetic, it does not ship.

**Files:**
- Create: `lib/attention-contrast.ts`
- Create: `test/attention-contrast.test.js`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `session.outcome` and `event` rows, both already present.
- Produces: `contrastByOutcome(rows)` exported from `lib/attention-contrast.ts`, taking `{ domain, seconds, outcome }[]` and returning `{ domain, finishedAvgSeconds, unfinishedAvgSeconds, sessions }[]` sorted by the size of the gap.

- [ ] **Step 1: Write the failing test**

```javascript
// test/attention-contrast.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { contrastByOutcome } from '../lib/attention-contrast.ts'

test('contrastByOutcome averages per domain across finished and unfinished sessions', () => {
  const rows = [
    { domain: 'chatgpt.com', seconds: 540, outcome: 'yes' },
    { domain: 'chatgpt.com', seconds: 600, outcome: 'yes' },
    { domain: 'chatgpt.com', seconds: 1860, outcome: 'no' },
  ]
  const [top] = contrastByOutcome(rows)
  assert.equal(top.domain, 'chatgpt.com')
  assert.equal(top.finishedAvgSeconds, 570)
  assert.equal(top.unfinishedAvgSeconds, 1860)
  assert.equal(top.sessions, 3)
})

test('contrastByOutcome omits a domain that appears on only one side of the split', () => {
  // A domain seen only in finished sessions has no contrast to report, and rendering
  // one would be a pattern claim from a single arm — I6 as amended by ADR-0050.
  const rows = [{ domain: 'a.com', seconds: 100, outcome: 'yes' }]
  assert.deepEqual(contrastByOutcome(rows), [])
})

test('contrastByOutcome ignores unanswered sessions entirely', () => {
  const rows = [
    { domain: 'a.com', seconds: 100, outcome: 'yes' },
    { domain: 'a.com', seconds: 900, outcome: 'unanswered' },
  ]
  assert.deepEqual(contrastByOutcome(rows), [])
})

test('contrastByOutcome sorts by the size of the gap, largest first', () => {
  const rows = [
    { domain: 'small.com', seconds: 100, outcome: 'yes' },
    { domain: 'small.com', seconds: 200, outcome: 'no' },
    { domain: 'big.com', seconds: 100, outcome: 'yes' },
    { domain: 'big.com', seconds: 2000, outcome: 'no' },
  ]
  assert.equal(contrastByOutcome(rows)[0].domain, 'big.com')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/attention-contrast.test.js`
Expected: FAIL — `lib/attention-contrast.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/attention-contrast.ts
// ADR-0060: "Build the arithmetic before the judge." This needs no model, no page
// text and no permission, and it answers the question the coach exists for:
// what is different about the sessions that finished?
export type ContrastRow = { domain: string; seconds: number; outcome: string }
export type Contrast = {
  domain: string
  finishedAvgSeconds: number
  unfinishedAvgSeconds: number
  sessions: number
}

export function contrastByOutcome(rows: ContrastRow[]): Contrast[] {
  const byDomain = new Map<string, { yes: number[]; no: number[] }>()
  for (const row of rows) {
    if (row.outcome !== 'yes' && row.outcome !== 'no') continue
    const entry = byDomain.get(row.domain) ?? { yes: [], no: [] }
    entry[row.outcome === 'yes' ? 'yes' : 'no'].push(row.seconds)
    byDomain.set(row.domain, entry)
  }
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
  return [...byDomain.entries()]
    // Both arms required: one arm is not a contrast, and asserting from it would be a
    // pattern claim from a single side — I6 as amended (ADR-0050).
    .filter(([, e]) => e.yes.length > 0 && e.no.length > 0)
    .map(([domain, e]) => ({
      domain,
      finishedAvgSeconds: mean(e.yes),
      unfinishedAvgSeconds: mean(e.no),
      sessions: e.yes.length + e.no.length,
    }))
    .sort((a, b) =>
      Math.abs(b.unfinishedAvgSeconds - b.finishedAvgSeconds) -
      Math.abs(a.unfinishedAvgSeconds - a.finishedAvgSeconds))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/attention-contrast.test.js && npx tsc --noEmit`
Expected: PASS, all four.

- [ ] **Step 5: Render one line on the dashboard, gated by evidence**

Query attention rows joined to `session.outcome` for the signed-in user, pass them through `contrastByOutcome`, and render the top row **only when `sessions >= PATTERN_MIN_SESSIONS`** (`lib/thresholds.ts`, currently 8). This is a *pattern claim* about the user, so I6's floor applies — ADR-0050 removed the floor from description, not from inference.

Wording states minutes, never a rate or a percentage:

> `The sessions you finished averaged nine minutes on chatgpt.com. The ones you did not averaged thirty-one.`

Below the threshold, render nothing. Do not hedge a pattern (PRD US-11).

- [ ] **Step 6: Verify by rendering**

Run: `node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <dashboard-url>`
Expected: nothing renders on the real account, which has 6 sessions — **that is the correct behaviour and proves the gate works.** Verify the populated case against seeded test data, never by lowering the threshold.

- [ ] **Step 7: Commit**

```bash
git add lib/attention-contrast.ts test/attention-contrast.test.js app/dashboard/page.tsx
git commit -m "feat(dashboard): contrast attention between finished and unfinished sessions

ADR-0060 — build the arithmetic before the judge. No model, no page text, no cost,
and it becomes the baseline any future judge has to beat."
```

---

### Task 7: The coach's preset corpus as a file

**Why last:** ADR-0064. It has no dependencies and blocks nothing, but it is the T3 "provided" artifact for the rebuild manual (`apexhuman.md` §6), so it must exist as a *file* rather than as prose scattered through IDEA.

**Files:**
- Create: `lib/coach-corpus.json`
- Create: `test/coach-corpus.test.js`

**Interfaces:**
- Produces: `lib/coach-corpus.json` — an array of `{ id, claim, source, label, checked, bearsOn, actionable }`. `label` is one of `verified | reported | inferred`. `actionable` names the product capability the claim can inform, or `null`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/coach-corpus.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const corpus = JSON.parse(readFileSync('lib/coach-corpus.json', 'utf8'))

test('every claim carries a source, a label and a checked date', () => {
  for (const c of corpus) {
    assert.ok(c.source, `${c.id} has no source`)
    assert.ok(['verified', 'reported', 'inferred'].includes(c.label), `${c.id} has a bad label`)
    assert.match(c.checked, /^\d{4}-\d{2}-\d{2}$/, `${c.id} has no checked date`)
  }
})

test('no claim is sourced from a content farm', () => {
  // ADR-0064 rule 2. This list is the one that actually surfaced on 2026-09-15 when
  // searching for recent focus research, carrying an inflated variant of Gloria Mark's
  // real figure. Source tier is a gate, not a preference.
  const banned = ['makerstations.io', 'speakwiseapp.com', 'amraandelma.com', 'wifitalents.com']
  for (const c of corpus) {
    for (const host of banned) {
      assert.equal(c.source.includes(host), false, `${c.id} cites ${host}`)
    }
  }
})

test('every claim bears on something the product can observe or execute', () => {
  // ADR-0064 rule 1: relevance outranks recency. I5 bans suggesting what we cannot do.
  for (const c of corpus) {
    assert.ok(c.bearsOn, `${c.id} bears on nothing the product can see or do`)
  }
})

test('a reported claim is marked so the coach may not assert it', () => {
  const reported = corpus.filter((c) => c.label === 'reported')
  for (const c of reported) {
    assert.ok(c.caveat, `${c.id} is reported but carries no caveat`)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/coach-corpus.test.js`
Expected: FAIL — `lib/coach-corpus.json` does not exist.

- [ ] **Step 3: Write the corpus**

Seed it with the claims that survive ADR-0064's three rules. Carry over from IDEA §5 only those bearing on something observable or executable — **C9** (reward undermines motivation → why I2 exists), **C11** and **C12** (presence and arousal → why the companion is calm), **C13**'s caveat (sub-goal attainment breeds self-congratulation → why I8 exists) — and add the attention material verified on 2026-09-15:

```json
[
  {
    "id": "C21",
    "claim": "Self-interruption is a major, under-studied component of task switching. Across 889 hours of observed task switching from 36 individuals in three information-work organizations, self-interruption is a function of organizational environment and individual differences AND of external interruptions already experienced. People are significantly more likely to self-interrupt in order to RETURN to a central working sphere (mean 23%) than to a peripheral one (17%, 19%).",
    "source": "Dabbish, Mark & Gonzalez, CHI 2011 — 'Why Do I Keep Interrupting Myself?' — ics.uci.edu/~gmark/",
    "label": "verified",
    "checked": "2026-09-15",
    "bearsOn": "drift classification; the meaning of a tab switch",
    "actionable": "labelling — not all self-interruption is drift, which is why 'neutral' is a first-class label (ADR-0047)"
  },
  {
    "id": "C22",
    "claim": "Average dwell on a single screen before switching is roughly 47 seconds; returning to a task after an interruption costs roughly 23-25 minutes.",
    "source": "attributed to Gloria Mark; primary source ics.uci.edu/~gmark/chi08-mark.pdf not yet read",
    "label": "reported",
    "checked": "2026-09-15",
    "caveat": "DO NOT ASSERT. A search on 2026-09-15 surfaced an inflated variant — '2026 Carnegie Mellon, 3,800 workers, 26.8 minutes, $1.2 trillion' — from SEO content farms. Read the primary source before the coach may state any number here.",
    "bearsOn": "the cost of a drift episode",
    "actionable": null
  }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/coach-corpus.test.js`
Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
git add lib/coach-corpus.json test/coach-corpus.test.js
git commit -m "feat(coach): preset corpus as a dated, source-gated file

ADR-0064. Relevance outranks recency, source tier is a gate, every claim carries a
review date. The old corpus was about motivation; none of it was about attention."
```

---

## Out of scope for this plan, deliberately

- **The batched judge (ADR-0060) and the coach's generation call.** Both need data that Tasks 1–6 do not yet produce — no session has a declaration, no visit has a label, no path has been stored. Building the judge first would be judging an empty room. It gets its own plan once a fortnight of real sessions exists.
- **Deleting `judgment.corrected_to` or the `judgment` table.** Empty, but the batched judge still wants them.
- **Anything answering PRD Q6 (the free/paid boundary) or the persona ranking.** ADR-0054 leaves segments unranked on purpose; nothing here depends on that changing.

## Self-review checklist

- [ ] Every task's files exist at the paths named, or are created by that task
- [ ] No step says "add error handling", "similar to Task N", or "TBD"
- [ ] Every code step shows real code, not a description of code
- [ ] Every UI-touching task ends in a **render** check, not a build check (`CLAUDE.md`)
- [ ] No hex value appears in any proposed component code
- [ ] No commit message contains AI attribution (`GLOBAL.md`)
- [ ] Task 1's acceptance is a real database row, not a passing unit test
- [ ] Task 6 renders nothing on the real account — and that is asserted as correct
