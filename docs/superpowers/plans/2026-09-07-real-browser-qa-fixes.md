# Real-Browser QA Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the real bugs and friction found testing MEANT in an actual browser — broken
tracking/blocking for user-configured (non-hardcoded) domains, a missing floating
companion, an intrusive auto-opened review tab, one-domain-at-a-time site entry — and
route the two open-ended visual asks (logo, popup navigation) through this project's
mandated design process instead of guessing at them here.

**Architecture:** Six independent, sequenced tasks against the existing extension +
Next.js codebase. No new services, no new dependencies. Task 3 (the companion) is
evidence-gated: its root cause is being confirmed by a live diagnostic against the real
browser as this plan is written, and the task is structured to consume that evidence
rather than assume a fix.

**Tech Stack:** Chrome Extension Manifest V3 (vanilla JS, no framework), Next.js 16 App
Router, Postgres via `@neondatabase/serverless`, Playwright E2E (`e2e/*.spec.ts`), `node
--test` unit tests.

## Global Constraints

- This is a git worktree (`worktree-drift-and-cycles`) — all commands run from it directly, no `-C`/`cd` into another worktree.
- Never add AI/assistant attribution to any commit message.
- Fix rounds get their own commit; never `--amend`.
- `design/tokens.css` is the single source of truth for color — never a hex value in a component (CLAUDE.md).
- Tokens-first CSS applies to `extension/meant.css` and `app/globals.css` equally.
- No total-hours figure, no percentage, no score, on any surface (PRODUCT.md invariant).
- `Yes` and `Not yet` stay identical in colour, weight, size, and motion (PRODUCT.md invariant).
- The popup animates nothing (PRODUCT.md invariant) — no new CSS transition on anything this plan touches in `extension/meant.css`.
- Run `npm run tokens` after any `design/tokens.css` change, never hand-edit `extension/tokens.css`.
- After each task: run `npx playwright test --workers=1` (full suite, not `--reporter=list` — that flag drops the config's JSON reporter, see `~/.claude/skills/meant-qa/SKILL.md`), `npx tsc --noEmit`, and `npm test` (bare `node --test`, never `node --test test/` — crashes on Node 26 in this environment). All three must be clean before moving to the next task.
- Every fix that changes verifiable behavior gets a new or extended Playwright case — extend `docs/qa-recipe-playwright-e2e.md` with the new lettered case alongside it, per the `meant-qa` skill's own "before trusting the suite is complete" principle.
- The dev server (`npm run dev`) must be running and confirmed live (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`) before any Playwright run.

---

## Task 1: Fix the host-permissions gap (broken tracking and blocking for user-configured domains)

**Confirmed root cause** (grounded in Chrome's own docs, not guessed): `chrome.tabs.query()` redacts `tab.url` for any origin the extension lacks host permission for. `extension/manifest.json`'s `host_permissions` only lists a hardcoded set of distraction domains — never a user's own configured work sites, or any distraction site the user types that isn't in that same hardcoded list. This is why `extension/sw.js`'s `activeDomain()` silently returns `null` for `docs.google.com`, and why the review page showed it at 0 minutes tracked. Separately, Chrome's docs confirm a `redirect` rule action (used by `installRules()`'s block rules) requires host permission for the domain being redirected — the SAME gap, so a user-typed blocked domain outside the hardcoded list can silently fail to redirect too, even though `youtube.com` (already in the hardcoded list) works.

**Files:**
- Modify: `extension/manifest.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task only widens existing permission scope, no new exports.

- [ ] **Step 1: Write the failing test**

Add to `e2e/session-lifecycle.spec.ts` (new test in the existing `describe` block):

```typescript
test('a non-hardcoded work site still accumulates tracked minutes', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await addBlockedDomain(page, 'example.org') // reuses the existing helper, a non-hardcoded distraction domain
  await page.locator('input.m-field').first().fill('tracking test')
  await page.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await page.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  const workPage = await context.newPage()
  await workPage.bringToFront()
  await workPage.goto('https://example.com') // example.com, not example.org — this is a WORK site check, not the blocked one
  await workPage.waitForTimeout(2_000)

  await page.bringToFront()
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  await expect
    .poll(async () => {
      const res = await page.request.get(`/review/${sessionId}`)
      return res.ok() ? await res.text() : ''
    }, { timeout: 5_000 })
    .toMatch(/example\.com/)
  // Explicitly NOT asserting "0 min" is absent by string match — assert the row exists at all,
  // since a genuinely-tracked site must appear in the per-domain rows regardless of exact seconds.
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "non-hardcoded work site" --workers=1`
Expected: FAIL — `example.com` never appears in the review page body, because `chrome.tabs.query()` returns no usable `tab.url` for it and `activeDomain()` returns `null`.

- [ ] **Step 3: Fix the manifest**

Replace `extension/manifest.json`'s `host_permissions` and `web_accessible_resources[0].matches` arrays. The per-domain host permission list becomes redundant once `<all_urls>` is present (a broader pattern already covers every entry in it), and `web_accessible_resources` needs the same broadening — the `blocked.html` redirect target must be reachable from ANY domain a user configures, not just the hardcoded ones, or Task 1's own block-rule fix would install correctly but its redirect target would still be unreachable for a non-hardcoded domain.

```json
{
  "manifest_version": 3,
  "name": "MEANT",
  "version": "0.1.0",
  "permissions": ["declarativeNetRequest", "tabs", "storage", "alarms", "idle"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["companion-overlay.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["blocked.html"],
      "matches": ["<all_urls>"]
    }
  ],
  "background": { "service_worker": "sw.js", "type": "module" },
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "icons": { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "non-hardcoded work site" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1` (all cases, including every existing companion/blocking test — confirm nothing regressed from widening host_permissions), `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Record the finding**

Append to `docs/dead-ends.md`: the `host_permissions` gap, its two consequences (tab.url redaction for tracking, redirect-action failure for blocking), and the fix (broadened to `<all_urls>`, matching the content script's already-existing `<all_urls>` scope — no new category of trust the user hadn't already granted). Reference this task.

- [ ] **Step 7: Commit**

```bash
git add extension/manifest.json e2e/session-lifecycle.spec.ts docs/dead-ends.md
git commit -m "fix(extension): broaden host_permissions so non-hardcoded sites can be tracked and blocked"
```

---

## Task 2: Sweep already-open tabs when a session starts

**Confirmed not a code defect** (declarativeNetRequest only intercepts new navigation requests, never a page already loaded before the rule existed) but a real, reported friction: a tab already open on a newly-blocked domain keeps working silently until the user happens to navigate again.

**Files:**
- Modify: `extension/sw.js:8-26` (`installRules`), `extension/sw.js:62-95` (`startSession`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `installRules(listNames)` now returns `{ ruleIds: number[], domains: string[] }` instead of `number[]` — the one call site (`startSession`) is updated in this same task.

- [ ] **Step 1: Write the failing test**

Add to `e2e/session-lifecycle.spec.ts`:

```typescript
test('a tab already open on a domain being blocked gets swept to blocked.html on Start', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)

  const alreadyOpen = await context.newPage()
  await alreadyOpen.goto('https://example.org') // open BEFORE Start, on the domain we're about to block

  await addBlockedDomain(page, 'example.org')
  await page.locator('input.m-field').first().fill('sweep test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(alreadyOpen).toHaveURL(/blocked\.html/, { timeout: 3_000 })

  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "already open" --workers=1`
Expected: FAIL — `alreadyOpen`'s URL stays `https://example.org/`, never redirected.

- [ ] **Step 3: Return domains alongside rule IDs from `installRules`**

```javascript
async function installRules(listNames) {
  const domains = [...new Set((listNames ?? []).flatMap((name) => BLOCKLISTS[name] ?? [name]))]
  if (domains.length === 0) return { ruleIds: [], domains: [] }

  const existing = await chrome.declarativeNetRequest.getDynamicRules()
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: domains.map((domain, i) => ({
      id: RULE_ID_BASE + i,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: chrome.runtime.getURL(`blocked.html?d=${encodeURIComponent(domain)}`) },
      },
      condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
    })),
  })
  return { ruleIds: domains.map((_, i) => RULE_ID_BASE + i), domains }
}
```

- [ ] **Step 4: Sweep already-open tabs in `startSession`, after rules install successfully**

```javascript
  try {
    const { ruleIds, domains } = await installRules(blockedDomains)
    const s = await getSession()
    await chrome.storage.local.set({ session: { ...s, ruleIds } })
    await sweepOpenTabs(domains)
  } catch (error) {
    console.error('startSession: installRules failed', error)
    await endSession('stopped')
    return { ok: false, error: String(error) }
  }
```

Add the new `sweepOpenTabs` function near `installRules`:

```javascript
// declarativeNetRequest only intercepts NEW navigation requests — a tab already loaded on a
// domain that just became blocked keeps working until it happens to navigate again. Sweep
// every open tab once, right after the rules install, so "Start" is honest immediately.
async function sweepOpenTabs(domains) {
  if (domains.length === 0) return
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue
    let hostname
    try {
      hostname = bareHostname(tab.url)
    } catch {
      continue
    }
    if (hostname && domains.includes(hostname)) {
      const url = chrome.runtime.getURL(`blocked.html?d=${encodeURIComponent(hostname)}`)
      chrome.tabs.update(tab.id, { url }).catch(() => {})
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "already open" --workers=1`
Expected: PASS

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add extension/sw.js e2e/session-lifecycle.spec.ts
git commit -m "fix(extension): redirect already-open tabs to blocked.html when a session starts"
```

---

## Task 3: Re-verify the floating companion against the real browser, with a reliable method

**Current evidence is contradictory, and the live diagnostic side is not trustworthy.**
Three rounds of a computer-use diagnostic against the user's real Brave produced three
different, mutually inconsistent claims — "companion element absent, zero console errors"
(root cause guessed as host_permissions, which does not hold up against Chrome's own docs
or this project's own E2E suite), then "no chrome.storage.local data at all" (based on
reading DevTools' Application → Local Storage panel, which shows `window.localStorage`, an
entirely different API from `chrome.storage.local` — not evidence of anything), then "no
network requests fired, popup closed after Start" (a popup closing on its own is normal
Chrome behavior any time it loses focus, e.g. from opening DevTools right after the click —
not necessarily evidence of failure; and the Network tab checked may have been a regular
page's, not the service worker's own, which is where `sw.js`'s fetch calls actually appear).
None of these three rounds produced a raw, verifiable `chrome.storage.local` dump — the one
check that would have settled this — due to tooling limitations reaching the console
reliably through browser automation.

**Countervailing evidence that IS trustworthy:** this project's own Playwright E2E suite
(`e2e/popup.spec.ts`'s "Start creates a session" test, `e2e/companion.spec.ts`'s three
tests) launches a real, unpacked Chromium load of this exact `extension/` folder and has
passed repeatedly, across many fresh runs today, confirming both that Start reliably
writes a session to `chrome.storage.local` and that the companion reliably renders on
arbitrary pages while one is active. This is far stronger evidence than the live
diagnostic produced, and it directly contradicts the "Start doesn't create a session"
claim.

**Do not implement a code fix based on any of the three rounds above.** None of them
survive scrutiny as a confirmed root cause.

**Files:** none, until Step 1 below produces real evidence.

- [ ] **Step 1: Get one simple, reliable, human-observed data point before anything else**

Ask the user directly (this doesn't need DevTools, just their own eyes): fully quit Brave
(not just reload the extension — actually quit the application and relaunch it), open the
extension's popup, fill in a sentence, and click Start. Does the popup then show a "Stop"
button with an elapsed-minutes counter (a session actually started), or does it revert to
the idle "What do you mean to do?" screen, or show an error message? This rules out (or
confirms) a genuinely stale/broken loaded copy in their specific browser profile, which
would explain everything without any of the three guessed root causes above.

- [ ] **Step 2: Branch on that answer**
  - If Start visibly works (shows Stop + elapsed minutes) in their real browser now: the
    original report was very likely a stale-extension-state issue that a full quit/relaunch
    already resolved. Re-ask specifically about the companion (a small dot, bottom-right,
    on an ordinary page) while that session runs. If it now appears too, this task closes
    with no code change — record the resolution in `docs/dead-ends.md` (stale unpacked-load
    state, resolved by a full quit-and-relaunch, not a code defect) so this isn't
    re-investigated identically next time.
  - If Start visibly does NOT work in their real browser (confirmed, human-observed, not
    computer-use-diagnosed): this is a real, reproducible bug distinct from anything
    guessed so far. Get the popup's own on-screen error text if any is shown (popup.js
    already surfaces `res?.offline ? '...' : 'Could not start.'` on a failed start — read
    which one appears), and check the service worker's console for the
    `console.error('startSession: installRules failed', error)` line specifically (this is
    the one place `startSession` already logs a caught error) — report the exact error
    text. Write a task exactly like Tasks 1 and 2 above from there: a failing E2E test that
    reproduces the SPECIFIC evidenced condition, the minimal fix, and re-verification.

- [ ] **Step 3: Run the full suite and typecheck** (only relevant if Step 2 produced a code change)

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 4: Record the finding in `docs/dead-ends.md`** regardless of outcome — including
the three unreliable diagnostic rounds themselves and why each didn't hold up, so a future
session doesn't repeat the same computer-use methodology mistakes (checking
`window.localStorage` for extension state, checking a page's Network tab instead of the
service worker's own, treating a popup's normal auto-close as failure evidence).

- [ ] **Step 5: Commit** (only if Step 2 produced a code change)

```bash
git add -A
git commit -m "fix(extension): <exact fix, filled in once a real cause is confirmed>"
```

---

## Task 4: Move the session-end outcome question into the popup — no more auto-opened tab

**Explicit user decision:** `extension/sw.js`'s `endSession` currently does
`chrome.tabs.create({url: base+'/review/'+sessionId})` whenever a session stops or its
duration elapses. This must stop entirely. The "Did you...? Yes / Not yet" question and
the per-site elapsed-time summary must render inside the extension's own popup instead,
the next time it's opened after a session ends. The full `/review/:id` web page keeps
existing (reachable on your own, e.g. for history) but nothing pushes it at you anymore.

**Files:**
- Create: `lib/review-data.ts` — extracted, shared query logic (used by both the existing web page and the new API route below)
- Modify: `app/review/[sessionId]/page.tsx:17-95` — refactor to call `getReviewData` instead of inlining the same queries
- Create: `app/api/sessions/[id]/review/route.ts` — new GET endpoint the popup calls
- Modify: `app/api/sessions/[id]/outcome/route.ts` — accept the device token (Bearer), not just the Clerk session cookie, so the popup can call it
- Modify: `extension/sw.js:97-126` (`endSession`) — replace the tab-open branch with a stored `pendingReview` marker
- Modify: `extension/popup.js` — add an `outcome(sessionId)` view, wire `render()` to show it when `pendingReview` exists, add a `get()` helper
- Modify: `extension/api.js` — add the `get(path)` helper
- Modify: `extension/meant.css` — port `.m-answer` and `.m-rate` (popup-sized) from `app/globals.css`, which currently only exist there
- Test: `e2e/review.spec.ts` (extend), `e2e/session-lifecycle.spec.ts` or a new `e2e/outcome-in-popup.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getReviewData(sessionId, userId): Promise<ReviewData | null>` where
  ```typescript
  type ReviewData = {
    intention: string | null
    outcome: 'yes' | 'no' | 'unanswered'
    endedAt: string | null
    rows: { kind: string; domain: string | null; seconds: number; hits: number }[]
    topAttention: { domain: string; seconds: number }[]
    awaySeconds: number
    blockedAttempts: number
    finished: number
    answered: number
  }
  ```
  `GET /api/sessions/:id/review` returns this shape as JSON (401 if unauthenticated, 404 if not found/not yours). `extension/api.js`'s new `get(path)` returns `{ ok, status, data }` matching `post`'s existing shape.

### Step 1: Write the failing test for the shared query extraction (no behavior change yet)

```typescript
// e2e/review.spec.ts — add to the existing test, after the review page assertions:
const apiRes = await reviewPage.request.get(`/api/sessions/${sessionId}/review`)
expect(apiRes.status()).toBe(200)
const apiData = await apiRes.json()
expect(apiData.topAttention.some((r: any) => r.domain === 'example.com')).toBe(true)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/review.spec.ts --workers=1`
Expected: FAIL with 404 — the route doesn't exist yet.

- [ ] **Step 3: Extract `lib/review-data.ts`**

```typescript
import { sql } from '@/lib/db'

export type ReviewRow = { kind: string; domain: string | null; seconds: number; hits: number }
export type ReviewData = {
  intention: string | null
  outcome: 'yes' | 'no' | 'unanswered'
  endedAt: string | null
  rows: ReviewRow[]
  topAttention: { domain: string; seconds: number }[]
  awaySeconds: number
  blockedAttempts: number
  finished: number
  answered: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getReviewData(sessionId: string, userId: string): Promise<ReviewData | null> {
  if (!UUID.test(sessionId)) return null

  const [session] = await sql`
    select id, intention, outcome, started_at, ended_at
      from session where id = ${sessionId} and user_id = ${userId}`
  if (!session) return null

  const rows = (await sql`
    select kind, domain, coalesce(sum(seconds), 0)::int as seconds, count(*)::int as hits
      from event where session_id = ${sessionId}
     group by kind, domain
     order by seconds desc`) as ReviewRow[]

  const topAttention = rows
    .filter((r) => r.kind === 'attention' && r.domain)
    .slice(0, 3)
    .map((r) => ({ domain: r.domain as string, seconds: r.seconds }))
  const awaySeconds = rows
    .filter((r) => r.kind === 'away')
    .reduce((total, r) => total + r.seconds, 0)
  const blockedAttempts = rows
    .filter((r) => r.kind === 'block_hit')
    .reduce((total, r) => total + r.hits, 0)

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session where user_id = ${userId}`

  return {
    intention: session.intention,
    outcome: session.outcome,
    endedAt: session.ended_at,
    rows,
    topAttention,
    awaySeconds,
    blockedAttempts,
    finished: counts.finished,
    answered: counts.answered,
  }
}
```

- [ ] **Step 4: Refactor `app/review/[sessionId]/page.tsx` to use it (no visual change)**

```typescript
import { currentUserId } from '@/lib/auth/session'
import { notFound, redirect } from 'next/navigation'
import { getReviewData } from '@/lib/review-data'
import { toBand } from '@/lib/band'
import { Band } from '../../band'
import { Answer } from './answer'

const TINTS = ['attention-1', 'attention-2', 'attention-3'] as const

function minutes(seconds: number) {
  return Math.round(seconds / 60)
}

export const dynamic = 'force-dynamic'

export default async function Review({ params }: { params: Promise<{ sessionId: string }> }) {
  const userId = await currentUserId()
  if (!userId) redirect('/')

  const { sessionId } = await params
  const data = await getReviewData(sessionId, userId)
  if (!data) notFound()

  return (
    <div data-surface="review">
      <p className="m-mark" data-state="ended" />
      {data.intention ? (
        <>
          <p className="m-meta">You meant to</p>
          <p className="m-sentence">{data.intention}</p>
        </>
      ) : (
        <p className="m-meta">You didn&apos;t say what you meant to do.</p>
      )}

      <Band segments={toBand(data.rows as Parameters<typeof toBand>[0])} state={data.endedAt ? 'ended' : 'running'} />

      {data.topAttention.map((row, i) => (
        <div className="m-row" key={row.domain}>
          <span className="m-row-bar" data-kind={TINTS[i]} />
          <span className="m-row-domain">{row.domain}</span>
          <span className="m-row-figure">{minutes(row.seconds)} min</span>
        </div>
      ))}

      {data.awaySeconds > 0 && (
        <div className="m-row">
          <span className="m-row-bar" data-kind="away" />
          <span className="m-row-domain">away</span>
          <span className="m-row-figure">{minutes(data.awaySeconds)} min</span>
        </div>
      )}

      {data.blockedAttempts > 0 && <p className="m-meta">{data.blockedAttempts} blocked attempts</p>}

      {data.outcome === 'unanswered' ? (
        <>
          <p className="m-rate">Did you?</p>
          <Answer sessionId={sessionId} />
        </>
      ) : (
        <p className="m-meta">
          {data.outcome === 'yes'
            ? `Good. That's ${data.finished} of ${data.answered}.`
            : 'Noted. It carries over.'}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add the new API route, `app/api/sessions/[id]/review/route.ts`**

```typescript
import { deviceFromRequest } from '@/lib/device-auth'
import { currentUserId } from '@/lib/auth/session'
import { getReviewData } from '@/lib/review-data'

export const dynamic = 'force-dynamic'

async function resolveUserId(req: Request): Promise<string | null> {
  const device = await deviceFromRequest(req)
  if (device) return device.user_id
  return currentUserId()
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await getReviewData(id, userId)
  if (!data) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json(data)
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx playwright test e2e/review.spec.ts --workers=1`
Expected: PASS. Also manually confirm the web `/review/:id` page still renders identically (it should — same query, same JSX).

- [ ] **Step 7: Commit the extraction**

```bash
git add lib/review-data.ts "app/review/[sessionId]/page.tsx" "app/api/sessions/[id]/review/route.ts" e2e/review.spec.ts
git commit -m "refactor(review): extract shared review-data query, add a JSON route for it"
```

- [ ] **Step 8: Write the failing test for outcome-in-popup**

```typescript
// e2e/outcome-in-popup.spec.ts (new file)
import { test, expect } from './fixtures'

async function pairAndOpenPopup(page: import('@playwright/test').Page, extensionId: string) {
  const mint = await page.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await page.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
}

test('stopping a session shows the outcome question in the popup, opens no tab', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await page.locator('input.m-field').first().fill('outcome test')
  await page.getByRole('button', { name: 'Start' }).click()

  const pageCountBefore = context.pages().length
  await page.getByRole('button', { name: 'Stop' }).click()

  await page.waitForTimeout(500) // give a would-be chrome.tabs.create a moment to fire, if it were going to
  expect(context.pages().length).toBe(pageCountBefore) // no new tab opened

  await page.reload() // popup.html closes/reopens between real popup opens; this simulates that
  await expect(page.getByText('Did you?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Not yet' })).toBeVisible()

  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByText(/Good\. That's \d+ of \d+\./)).toBeVisible()
})
```

- [ ] **Step 9: Run test to verify it fails**

Run: `npx playwright test e2e/outcome-in-popup.spec.ts --workers=1`
Expected: FAIL — a new tab opens (old behavior), and there's no "Did you?" text in the popup.

- [ ] **Step 10: Add the `get()` helper to `extension/api.js`**

```javascript
export async function get(path) {
  const base = await apiBase()
  const { token } = await chrome.storage.local.get('token')
  try {
    const res = await fetch(base + path, {
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    })
    if (res.status === 401 && token) {
      await chrome.storage.local.set({
        token: null,
        deviceId: null,
        session: null,
        unpairedReason: 'This device was disconnected from your account. Pair again.',
      })
    }
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch {
    return { ok: false, offline: true }
  }
}
```

- [ ] **Step 11: Let the outcome PATCH endpoint accept a device token**

```typescript
// app/api/sessions/[id]/outcome/route.ts — replace the whole file
import { deviceFromRequest } from '@/lib/device-auth'
import { currentUserId } from '@/lib/auth/session'
import { sql } from '@/lib/db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveUserId(req: Request): Promise<string | null> {
  const device = await deviceFromRequest(req)
  if (device) return device.user_id
  return currentUserId()
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID.test(id)) return Response.json({ error: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (body?.outcome !== 'yes' && body?.outcome !== 'no') {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const updated = await sql`
    update session set outcome = ${body.outcome}, answered_at = now()
     where id = ${id} and user_id = ${userId}
     returning id`
  if (updated.length === 0) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json({ ok: true })
}
```

- [ ] **Step 12: Replace `endSession`'s tab-open branch with a `pendingReview` marker**

In `extension/sw.js`, change the import (drop the now-unused `apiBase`) and the branch:

```javascript
import { post } from './api.js'
```

```javascript
  if (endReason === 'stopped' || endReason === 'elapsed') {
    await chrome.storage.local.set({ pendingReview: { sessionId: session.sessionId } })
  }
```

- [ ] **Step 13: Add the outcome view to `extension/popup.js`**

```javascript
import { post, get } from './api.js'
```

```javascript
async function outcome(sessionId) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'ended'

  const res = await get(`/api/sessions/${sessionId}/review`)
  if (!res.ok || !res.data) {
    await chrome.storage.local.remove('pendingReview')
    return idle()
  }
  const data = res.data

  const nodes = [mark]
  if (data.intention) {
    nodes.push(el('p', 'm-meta', 'You meant to'), el('p', 'm-sentence', data.intention))
  } else {
    nodes.push(el('p', 'm-meta', "You didn't say what you meant to do."))
  }
  for (const row of data.topAttention) {
    nodes.push(el('p', 'm-meta', `${row.domain} — ${Math.round(row.seconds / 60)} min`))
  }
  if (data.awaySeconds > 0) {
    nodes.push(el('p', 'm-meta', `away — ${Math.round(data.awaySeconds / 60)} min`))
  }
  if (data.blockedAttempts > 0) {
    nodes.push(el('p', 'm-meta', `${data.blockedAttempts} blocked attempts`))
  }

  if (data.outcome === 'unanswered') {
    nodes.push(el('p', 'm-rate', 'Did you?'))
    const yes = el('button', 'm-answer', 'Yes')
    const notYet = el('button', 'm-answer', 'Not yet')
    const answer = async (value) => {
      yes.disabled = true
      notYet.disabled = true
      await post(`/api/sessions/${sessionId}/outcome`, { outcome: value })
      await chrome.storage.local.remove('pendingReview')
      render()
    }
    yes.addEventListener('click', () => answer('yes'))
    notYet.addEventListener('click', () => answer('no'))
    nodes.push(yes, notYet)
  } else {
    nodes.push(el('p', 'm-meta', data.outcome === 'yes'
      ? `Good. That's ${data.finished} of ${data.answered}.`
      : 'Noted. It carries over.'))
    const done = el('button', 'm-btn', 'Done')
    done.dataset.variant = 'quiet'
    done.addEventListener('click', async () => {
      await chrome.storage.local.remove('pendingReview')
      render()
    })
    nodes.push(done)
  }

  show(...nodes)
}
```

Update `render()`:

```javascript
async function render() {
  const { token, session, unpairedReason, pendingReview } = await chrome.storage.local.get(['token', 'session', 'unpairedReason', 'pendingReview'])
  if (!token) {
    if (unpairedReason) await chrome.storage.local.remove('unpairedReason')
    return unpaired(unpairedReason)
  }
  if (session) return running(session)
  if (pendingReview) return outcome(pendingReview.sessionId)
  await idle()
}
```

- [ ] **Step 14: Port `.m-answer` and `.m-rate` into `extension/meant.css`**

`.m-answer` and `.m-rate` currently only exist in `app/globals.css` (the web app's stylesheet) — the popup's own `extension/meant.css` has never needed them until now. Port them at a popup-appropriate size, following this file's own established pattern (`[data-surface="popup"] .m-X {...}` overrides, e.g. the existing `[data-surface="popup"] .m-btn { padding: 14px 0; }` two lines above where you're adding this):

```css
.m-answer {
  flex: 1;
  padding: 16px 0;
  font-family: var(--m-body);
  font-size: 16px;
  letter-spacing: var(--m-tracking);
  color: var(--m-ink);
  background: transparent;
  border: var(--m-stroke) solid var(--m-ink);
  border-radius: var(--m-r-button);
  cursor: pointer;
}
.m-answer:disabled { opacity: 0.5; cursor: default; }
[data-surface="popup"] .m-answer { padding: 14px 0; }

.m-rate {
  margin: 0;
  font-family: var(--m-display);
  font-weight: 600;
  letter-spacing: var(--m-tracking-tight);
}
[data-surface="popup"] .m-rate { font-size: 28px; line-height: 1.05; }
```

No `transition`/`transform` on either rule — the popup animates nothing (PRODUCT.md invariant), unlike `app/globals.css`'s versions which have a press-scale on non-popup surfaces.

- [ ] **Step 15: Run test to verify it passes**

Run: `npx playwright test e2e/outcome-in-popup.spec.ts --workers=1`
Expected: PASS.

- [ ] **Step 16: Visual check — render it and look (CLAUDE.md: static code is not evidence)**

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs extension/popup.html
```

Take a real screenshot of the outcome view via a throwaway Playwright script (same pattern used earlier this session for the companion's visual check) at the popup's real 360px width. Confirm: `.m-rate` "Did you?" fits without wrapping, both `.m-answer` buttons are equal width and unstyled-identical (PRODUCT.md's Yes/Not-yet invariant), nothing animates.

- [ ] **Step 17: Run the full suite, typecheck, and unit tests**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 18: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a lettered case for `e2e/outcome-in-popup.spec.ts`, and update its "Files this recipe implies" list, matching the pattern of the existing Cases A-I.

- [ ] **Step 19: Commit**

```bash
git add extension/api.js extension/sw.js extension/popup.js extension/meant.css "app/api/sessions/[id]/outcome/route.ts" e2e/outcome-in-popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): show the session-end outcome question inline, stop auto-opening a review tab"
```

---

## Task 5: Natural-language site input (alias resolution)

Full design already brainstormed and approved: `docs/superpowers/specs/2026-09-07-natural-language-site-input-design.md`. Read it for the complete rationale — this task implements it exactly.

**Files:**
- Create: `extension/lib/site-aliases.js`
- Create: `extension/lib/resolve-sites.js`
- Modify: `extension/popup.js:65-106` (the `addable` branch of `chipGroup`)
- Test: `test/extension-resolve-sites.test.js`

**Interfaces:**
- Consumes: `normalizeDomain` from `extension/lib/normalize-domain.js` (existing, unchanged).
- Produces: `resolveSitePhrase(text: string): {ok: true, domains: string[]} | {ok: false, badToken: string, suggestion?: string}` — `suggestion`, when present, is an alias dictionary KEY (e.g. `"gmail"`), not a resolved domain.

- [ ] **Step 1: Write the failing unit tests**

```javascript
// test/extension-resolve-sites.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSitePhrase } from '../extension/lib/resolve-sites.js'

test('resolves a single real domain unchanged', () => {
  assert.deepEqual(resolveSitePhrase('docs.google.com'), { ok: true, domains: ['docs.google.com'] })
})

test('resolves a comma-and-and phrase of aliases and real domains together', () => {
  const result = resolveSitePhrase('docs, gmail, and chatgpt.com')
  assert.equal(result.ok, true)
  assert.deepEqual(result.domains.slice().sort(), ['chatgpt.com', 'docs.google.com', 'gmail.com'])
})

test('rejects the whole phrase on one bad token, with a confident typo suggestion', () => {
  const result = resolveSitePhrase('docs, gmial')
  assert.equal(result.ok, false)
  assert.equal(result.badToken, 'gmial')
  assert.equal(result.suggestion, 'gmail')
})

test('rejects with no suggestion when nothing is close', () => {
  const result = resolveSitePhrase('docs, zzzznotasite')
  assert.equal(result.ok, false)
  assert.equal(result.suggestion, undefined)
})

test('deduplicates repeated resolutions within one phrase', () => {
  const result = resolveSitePhrase('gmail, gmail')
  assert.equal(result.ok, true)
  assert.deepEqual(result.domains, ['gmail.com'])
})

test('a single word with no comma still works, same as today', () => {
  assert.deepEqual(resolveSitePhrase('youtube.com'), { ok: true, domains: ['youtube.com'] })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `extension/lib/resolve-sites.js` doesn't exist yet.

- [ ] **Step 3: Write the alias dictionary**

```javascript
// extension/lib/site-aliases.js
// A curated starter set, deliberately not exhaustive (docs/superpowers/specs/
// 2026-09-07-natural-language-site-input-design.md, "Out of scope") — anything missing
// falls back to typing the real domain, same as before this feature existed.
export const SITE_ALIASES = {
  gmail: 'gmail.com',
  docs: 'docs.google.com',
  sheets: 'sheets.google.com',
  slides: 'slides.google.com',
  drive: 'drive.google.com',
  calendar: 'calendar.google.com',
  chatgpt: 'chatgpt.com',
  claude: 'claude.ai',
  notion: 'notion.so',
  slack: 'slack.com',
  github: 'github.com',
  figma: 'figma.com',
  youtube: 'youtube.com',
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  twitter: 'x.com',
  x: 'x.com',
  reddit: 'reddit.com',
  linkedin: 'linkedin.com',
  tiktok: 'tiktok.com',
  netflix: 'netflix.com',
  twitch: 'twitch.tv',
  amazon: 'amazon.com',
}
```

- [ ] **Step 4: Write `resolveSitePhrase`**

```javascript
// extension/lib/resolve-sites.js
import { normalizeDomain } from './normalize-domain.js'
import { SITE_ALIASES } from './site-aliases.js'

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// A single, unambiguous close match counts as confident. A tie between two equally-close
// keys, or nothing close enough, does not — never guess between two plausible corrections.
function confidentSuggestion(token) {
  const threshold = token.length <= 4 ? 1 : 2
  let best = null
  let bestDistance = Infinity
  let tie = false
  for (const key of Object.keys(SITE_ALIASES)) {
    const d = levenshtein(token, key)
    if (d < bestDistance) {
      bestDistance = d
      best = key
      tie = false
    } else if (d === bestDistance) {
      tie = true
    }
  }
  if (tie || bestDistance > threshold) return null
  return best
}

function resolveToken(token) {
  const lower = token.trim().toLowerCase()
  if (lower.includes('.')) {
    const domain = normalizeDomain(lower)
    return domain ? { ok: true, domain } : { ok: false, badToken: token }
  }
  if (SITE_ALIASES[lower]) return { ok: true, domain: SITE_ALIASES[lower] }
  const suggestion = confidentSuggestion(lower)
  return { ok: false, badToken: token, suggestion: suggestion ?? undefined }
}

// Atomic: every token must resolve, or nothing is added — a single bad word in a phrase
// must never silently drop the other, valid words, nor silently add the good ones while
// hiding that one word failed.
export function resolveSitePhrase(text) {
  const tokens = text
    .split(/,| and /i)
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return { ok: false, badToken: '' }

  const domains = []
  for (const token of tokens) {
    const result = resolveToken(token)
    if (!result.ok) return { ok: false, badToken: result.badToken, suggestion: result.suggestion }
    if (!domains.includes(result.domain)) domains.push(result.domain)
  }
  return { ok: true, domains }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 6 new tests plus the existing 40.

- [ ] **Step 6: Wire it into the popup's addable chip input**

Replace the `plusButton.addEventListener('click', ...)` body in `extension/popup.js`'s `chipGroup`:

```javascript
    plusButton.addEventListener('click', () => {
      const input = el('input', 'm-chip')
      input.type = 'text'
      input.placeholder = 'domain.com, or "gmail, docs"'
      input.style.width = '160px'
      const error = el('p', 'm-meta', '')
      error.hidden = true
      plusButton.replaceWith(input)
      input.after(error)
      input.focus()

      let settled = false
      let pendingSuggestion = null

      function showError(message) {
        error.textContent = message
        error.hidden = false
      }
      function clearError() {
        error.hidden = true
        pendingSuggestion = null
      }

      // Returns true on success (input closed, chips added or nothing typed), false if it
      // stayed open showing an error — the blur handler uses this to re-focus rather than
      // let a bad phrase silently vanish.
      const attemptCommit = () => {
        if (settled) return true
        let text = input.value
        if (pendingSuggestion && text === pendingSuggestion.rawText) {
          text = text.replace(pendingSuggestion.badToken, pendingSuggestion.suggestion)
        }
        if (!text.trim()) {
          settled = true
          error.remove()
          input.replaceWith(plusButton)
          return true
        }
        const result = resolveSitePhrase(text)
        if (!result.ok) {
          pendingSuggestion = result.suggestion
            ? { rawText: input.value, badToken: result.badToken, suggestion: result.suggestion }
            : null
          showError(
            result.suggestion
              ? `did you mean ${result.suggestion}? Press Enter to use it`
              : `"${result.badToken}" isn't a known site — type the full domain`,
          )
          return false
        }
        settled = true
        error.remove()
        input.replaceWith(plusButton)
        let changed = false
        for (const domain of result.domains) {
          if (!selected.has(domain)) {
            selected.add(domain)
            addChip(domain)
            changed = true
          }
        }
        if (changed && onChange) onChange(currentValue())
        return true
      }

      const discard = () => {
        if (settled) return
        settled = true
        error.remove()
        input.replaceWith(plusButton)
      }

      input.addEventListener('input', clearError)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') discard()
        else if (e.key === 'Enter') attemptCommit()
      })
      input.addEventListener('blur', () => {
        if (!attemptCommit()) input.focus()
      })
    })
```

Add the import at the top of `extension/popup.js`:

```javascript
import { resolveSitePhrase } from './lib/resolve-sites.js'
```

- [ ] **Step 7: Write the failing E2E test**

Add to `e2e/popup.spec.ts`:

```typescript
test('typing a phrase resolves multiple aliases at once, atomically', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const plusButtons = page.getByRole('button', { name: '+' })
  await plusButtons.first().click()
  await page.keyboard.type('docs, gmail, and chatgpt')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'docs.google.com' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'gmail.com' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'chatgpt.com' })).toBeVisible()
})

test('a typo in a phrase blocks the whole phrase and offers a correction', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const plusButtons = page.getByRole('button', { name: '+' })
  await plusButtons.first().click()
  await page.keyboard.type('docs, gmial')
  await page.keyboard.press('Enter')
  await expect(page.getByText('did you mean gmail? Press Enter to use it')).toBeVisible()
  await expect(page.getByRole('button', { name: 'docs.google.com' })).toHaveCount(0) // atomic — nothing added yet

  await page.keyboard.press('Enter') // accepts the standing suggestion
  await expect(page.getByRole('button', { name: 'docs.google.com' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'gmail.com' })).toBeVisible()
})
```

- [ ] **Step 8: Run test to verify it fails, then passes**

Run: `npx playwright test e2e/popup.spec.ts --workers=1`
Expected: FAIL before Step 6's wiring lands correctly, PASS after.

- [ ] **Step 9: Run the full suite, typecheck, and unit tests**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 10: Visual check**

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs extension/popup.html
```
Screenshot the error-message state at 360px width — confirm the `m-meta` error line doesn't cause the popup to grow taller than expected and wrap awkwardly against the chip row below it.

- [ ] **Step 11: Extend `docs/qa-recipe-playwright-e2e.md`**

Add these two new popup.spec.ts cases to the existing Case C section.

- [ ] **Step 12: Commit**

```bash
git add extension/lib/site-aliases.js extension/lib/resolve-sites.js extension/popup.js test/extension-resolve-sites.test.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): resolve natural-language site phrases into chips, with typo correction"
```

---

## Task 6: Logo/mark redesign and popup navigation, via the impeccable design process

Both of these are genuine visual-design decisions this plan should not prescribe blindly —
this project's own CLAUDE.md mandates the `impeccable` skill for exactly this ("Visual
world, new surface, or a redesign → /impeccable"). This task's job is to run that process
correctly and implement whatever it produces, not to guess at pixel values here.

**Scope, per explicit user instruction:** the logo/mark change applies ONLY to the
extension's own popup (`extension/meant.css`'s `.m-mark`) — the web app's `.m-mark`
(`app/globals.css`) stays exactly as it is. Do not touch `app/globals.css`'s mark rules
or any web-app surface (dashboard, review page, landing) that renders `.m-mark`.

**Files:** determined by the impeccable design output — likely `design/tokens.css` (only
if a genuinely new token is needed — check first whether the existing palette already
covers it), `extension/meant.css` (the mark, extension-only per the scope note above),
`extension/popup.js` (navigation affordance), and possibly a new small view function in
`popup.js` for whatever the
navigation reveals (session history, blocked-sites list, or a link out — scope is part of
what impeccable's process should resolve, not assumed here).

**Interfaces:**
- Consumes: `getReviewData` (Task 4) if session history in the popup nav needs it — confirm during the design phase whether history belongs in this pass or is out of scope.
- Produces: whatever the design phase specifies — do not invent a signature here.

- [ ] **Step 1: Run the design process**

Invoke the `impeccable` skill's `context.mjs` (per its own Setup instructions) against
`extension/popup.js` and `extension/meant.css` as the target, loading `PRODUCT.md`,
`docs/design-toolkit.md`, and the current `.m-mark` state as incumbent visual truth (this
is a **redesign** of an existing mark, and an **addition** of new navigation — treat the
mark per "Refinement preserves; redesign replaces" and the nav per "new-work" guidance,
per the skill's own routing).

Bring exactly two inputs to that process: the reference logo image the user supplied
earlier in this conversation, and the concrete navigation need ("session history, the
blocked-sites list, and a link to the web app's landing page" — the user's own words).

- [ ] **Step 2: Get the design approved**

Follow impeccable's own process through to a concrete design (mockup or precise
description) — do not stop at a vague direction. This step ends when there is something
implementable: exact classes/markup for the new mark, and exact markup/behavior for the
navigation affordance.

- [ ] **Step 3: Write the failing test(s) for whatever the design specifies**

Concrete test code depends on Step 2's output — write it the same way every other task in
this plan does (a real Playwright interaction test, not a placeholder), once the design is
known.

- [ ] **Step 4: Implement the design**

Following the approved output exactly — tokens-first (no hex in a component), reusing
`design/tokens.css` variables, matching this file's own established
`[data-surface="popup"]` scoping pattern for any popup-specific sizing.

- [ ] **Step 5: Run the new test(s) to verify they pass**

- [ ] **Step 6: Visual verification**

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs extension/popup.html
```
Plus a real screenshot at 360px width, by eye, per CLAUDE.md's "render it and look" rule —
confirm the new mark and navigation actually match the approved design, not just that the
code compiles.

- [ ] **Step 7: Run the full suite, typecheck, and unit tests**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 8: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a lettered case for the new navigation behavior.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(popup): redesign the mark, add navigation to history/blocked sites/landing page"
```
