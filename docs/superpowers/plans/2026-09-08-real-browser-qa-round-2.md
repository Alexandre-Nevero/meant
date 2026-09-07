# Real-Browser Feedback Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a second round of real-browser-tested issues in MEANT — dead-code tracking/companion bugs, a hard landing-page redirect, an unstyled dashboard, an invisible cycle/phase indicator, and site-list management gaps — while explicitly declining to build the not-yet-scoped "judge" (intention-aware tracking) feature.

**Architecture:** Thirteen independent, dependency-ordered tasks against the existing extension + Next.js codebase. No new services, no new dependencies, no new npm packages. Three tasks (1, 2, 3) touch `extension/sw.js` and must land in that exact order since 2 and 3 both consume the domain-resolution fix from 1.

**Tech Stack:** Chrome Extension Manifest V3 (vanilla JS, no bundler, no TypeScript), Next.js 16 App Router, Postgres via `@neondatabase/serverless`, Playwright E2E, `node --test` unit tests.

## Global Constraints

- This is a git worktree (`worktree-drift-and-cycles`) at `/Users/alexandreandreinevero/orca/projects/focus/.claude/worktrees/drift-and-cycles` — all commands run from it directly, no `-C`/`cd` into another worktree, no git operations targeting another worktree.
- Never add AI/assistant attribution to any commit message.
- Fix rounds get their own commit; never `--amend`.
- Tokens-first CSS — `design/tokens.css` values only, never a hex value in a component.
- `extension/` is plain ES modules, no bundler, no TypeScript, no React — reusing a `lib/band.ts`/`app/band.tsx` visual pattern means reusing the DOM-construction shape (`el('span', 'm-row-bar', ...)` with matching `data-kind` values and inline `style.flex`), never a cross-runtime import.
- No new class name beyond the frozen 13-class contract (`.m-app .m-mark[data-state] .m-sentence .m-meta .m-field .m-btn[data-variant] .m-answer .m-row .m-row-domain .m-row-bar[data-kind] .m-row-figure .m-rate .m-empty`, plus `.m-chip`/`.m-chip-row`/`.m-companion-*`) — attribute-based extensibility (`data-*`) is fine.
- PRODUCT.md invariants: no total-hours/percentage/score anywhere, `Yes`/`Not yet` stay byte-identical, the popup animates nothing, no celebration during a session.
- Intention-aware tracking (the "judge," PRD-F9) is explicitly **out of scope** for every task below — nothing here should attempt it or half-build toward it.
- After each task: run `npx playwright test --workers=1` (no `--reporter` flag — it silently replaces the config's `[['list'],['json',...]]` array), `npx tsc --noEmit`, and `npm test` (bare `node --test`). All three must be clean before committing.
- Confirm the dev server is live (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`, expect 200) before any Playwright run; start it (`npm run dev`, backgrounded) if not.
- Every behavior-changing fix gets a new or extended Playwright case, plus a matching lettered case in `docs/qa-recipe-playwright-e2e.md` (continue from Case K — the next unused letter is L).

---

## Task 1: Fix `bareHostname`/`safeHostname` protocol filtering

**Do this first** — Tasks 2 and 3 both depend on clean domain resolution from this fix.

**Files:**
- Modify: `extension/sw.js:63-77` (`bareHostname`, `safeHostname`)
- Test: `test/extension-normalize-domain.test.js` is for a different function — add a new test file `test/extension-bare-hostname.test.js`, or extend `e2e/session-lifecycle.spec.ts` since `bareHostname` is unexported (module-private) — an E2E test against the real service worker is the only way to exercise it.

**Interfaces:**
- Consumes: nothing new.
- Produces: `bareHostname(url)` now returns `null` for any non-`http:`/`https:` scheme (previously only threw/returned falsy for a handful of accidentally-unparseable cases); `safeHostname` unchanged in shape.

- [ ] **Step 1: Write the failing test**

Add to `e2e/session-lifecycle.spec.ts` (new test in the `describe('session lifecycle', ...)` block):

```typescript
test('visiting the extension\'s own pages during a session is never tracked as a domain', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await page.locator('input.m-field').first().fill('scheme filter test')
  await page.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await page.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Visit the popup's own chrome-extension:// URL as a real page, and trigger a real
  // tab-activation transition against it.
  const extPage = await context.newPage()
  await extPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await extPage.waitForTimeout(500)

  await page.bringToFront()
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  await expect
    .poll(async () => {
      const res = await page.request.get(`/review/${sessionId}`)
      return res.ok() ? await res.text() : ''
    }, { timeout: 5_000 })
    .not.toMatch(new RegExp(extensionId))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "own pages during a session" --workers=1`
Expected: FAIL — the extension's own ID string appears as a tracked "domain" on the review page.

- [ ] **Step 3: Fix `bareHostname`**

```javascript
// Strips `www.` so a tracked visit matches the same bare form the user configures
// everywhere else (setup, the popup's site chips) — `new URL().hostname` alone
// left `www.facebook.com` on the review page next to a configured `facebook.com`,
// looking like two different sites. Unlike normalizeDomain (extension/lib/
// normalize-domain.js), this never rejects a no-dot hostname: a visited tab's
// hostname (e.g. `localhost`) is already valid, not user-typed free text.
//
// Only http/https are real, trackable sites — a chrome-extension:// URL (the
// popup itself, blocked.html) parses fine and its "hostname" is just the
// extension's own random-looking ID, which must never be attributed time as if
// it were a site the user visited.
function bareHostname(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const hostname = parsed.hostname.toLowerCase()
  return (hostname.startsWith('www.') ? hostname.slice(4) : hostname) || null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "own pages during a session" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 40 (continuing from Case K's last item), documenting this test.

- [ ] **Step 7: Commit**

```bash
git add extension/sw.js e2e/session-lifecycle.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(extension): never track a chrome-extension:// URL as a visited domain"
```

---

## Task 2: Seed the real active tab's domain when a session starts

**Files:**
- Modify: `extension/sw.js:85-123` (`startSession`)
- Modify: `docs/dead-ends.md` (update the existing "docs.google.com showed 0 minutes tracked... remains unexplained" note)
- Test: `e2e/session-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `transition()` (already exported-in-module, defined at `sw.js:210-221`), `activeDomain()` (`sw.js:79-83`) — both unchanged in shape.
- Produces: nothing new — `startSession`'s return shape is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `e2e/session-lifecycle.spec.ts`:

```typescript
test('the already-focused tab starts accumulating attention time immediately on Start, with no tab switch needed', async ({ context, extensionId, freshAccount }) => {
  const workPage = await context.newPage()
  await workPage.goto('https://example.com')
  await workPage.bringToFront()

  const page = await context.newPage()
  await freshAccount(page)
  await pairAndOpenPopup(page, extensionId)
  await page.locator('input.m-field').first().fill('seed test')
  await page.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await page.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Bring the ALREADY-OPEN tab back to front — no *new* tab-activation event, since it
  // was already the active tab before Start was even clicked. If startSession doesn't
  // seed the domain itself, nothing here would ever attribute time to example.com.
  await workPage.bringToFront()
  await workPage.waitForTimeout(2_000)

  await page.bringToFront()
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  await expect
    .poll(async () => {
      const res = await page.request.get(`/review/${sessionId}`)
      return res.ok() ? await res.text() : ''
    }, { timeout: 5_000 })
    .toMatch(/example\.com/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "already-focused tab" --workers=1`
Expected: FAIL — `example.com` never appears in the review page, since no qualifying event ever fires for a tab that was already active before Start.

- [ ] **Step 3: Fix `startSession`**

```javascript
export async function startSession({ intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle }) {
  const existing = await getSession()
  if (existing) await endSession('superseded')

  const sessionId = crypto.randomUUID()
  const now = Date.now()
  const startedAt = new Date(now).toISOString()

  // Local state and block rules first. Nothing here touches the network (N6, N3).
  await chrome.storage.local.set({
    session: {
      sessionId, intention, startedAt, plannedMinutes,
      blockedDomains, blocklists, workSites, cycle,
      slice: emptySlice(now), dwellSince: now, visitSeq: 0,
      ruleIds: [], signals: [], corrected: [], judged: {}, tally: {},
    },
    companionState: 'settled',
  })
  await chrome.alarms.create(TICK, { periodInMinutes: 0.5 })
  // Seed the slice with whatever tab is ALREADY focused right now — without this, an
  // already-active tab gets zero attention time until some other event (tab switch,
  // URL update, window focus change, or a 30s alarm tick) happens to fire next, which
  // may never happen if the user just stays on the same tab.
  await transition({ mode: 'attention', domain: await activeDomain() })
  try {
    const { ruleIds, domains } = await installRules(blockedDomains)
    const s = await getSession()
    await chrome.storage.local.set({ session: { ...s, ruleIds } })
    await sweepOpenTabs(domains)
  } catch (error) {
    console.error('startSession: installRules failed', error)
    await endSession('start-failed')
    return { ok: false, error: String(error) }
  }

  post('/api/sessions', { id: sessionId, intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle, startedAt })
  return { ok: true, sessionId }
}
```

Note: `transition()` is defined below `startSession` in the current file (`sw.js:210-221`), but both are plain `function`/`async function` declarations — hoisting means the call site doesn't need to move.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/session-lifecycle.spec.ts -g "already-focused tab" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Update the existing `docs/dead-ends.md` entry**

Find the note ending "...The original symptom that `docs.google.com` showed 0 minutes tracked remains unexplained; it may not reflect a bug at all and should be re-investigated separately if it recurs." Replace it with:

```markdown
**Update (2026-09-08):** confirmed the real cause. `startSession` (`extension/sw.js`)
never called `transition()` — it seeded `slice: emptySlice(now)` with `domain: null`
regardless of whatever tab was actually focused when Start was clicked. An already-active
tab got zero attention time until some *other* event fired (tab switch, URL update, window
focus change, or a 30s alarm tick while idle) — which never happens if the user simply
stays on the same tab. Fixed by seeding the slice with the real active tab's domain
immediately in `startSession`, right after the session is written to storage.
```

Do not add a new, separate dead-ends.md entry for this — it's the resolution of the existing thread.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 41, documenting this test.

- [ ] **Step 8: Commit**

```bash
git add extension/sw.js e2e/session-lifecycle.spec.ts docs/dead-ends.md docs/qa-recipe-playwright-e2e.md
git commit -m "fix(extension): seed the active tab's domain immediately when a session starts"
```

---

## Task 3: Fix and wire `updateCompanion`

**Files:**
- Modify: `extension/sw.js:166-221` (`isCurrentlyBlocked`, `updateCompanion`, `transition`)
- Test: `e2e/companion.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `transition()` now also drives `companionState` as a side effect (still returns the same `next` session object as before).

- [ ] **Step 1: Write the failing test**

Add to `e2e/companion.spec.ts`, inside the existing `describe('floating companion', ...)` block:

```typescript
test('drifting to a known-distraction domain not on this session\'s own blocklist actually flips the ring to drift', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  // Deliberately don't block youtube.com this session — isKnownDistraction() should still
  // flag it (it's in BLOCKLISTS' 'video' category), and it's not in this session's own
  // blockedDomains, so it should read as drift.
  await pairAndStart(setupPage, extensionId)

  // Push startedAt back past DRIFT_GRACE_MS (60s) without a real wait.
  await setupPage.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('session', ({ session }: any) => {
        session.startedAt = new Date(Date.now() - 90_000).toISOString()
        chrome.storage.local.set({ session }, () => resolve())
      })
    })
  })

  const page = await context.newPage()
  await page.goto('https://example.com')
  const dotWrap = page.locator(HOST_SELECTOR).locator('.dot-wrap')
  await expect(dotWrap).toHaveAttribute('data-state', 'focus')

  // A real navigation to a known-distraction domain, not a manual companionState write —
  // this is what actually exercises updateCompanion's own call site. `waitUntil: 'commit'`
  // (not the default 'load') since only the URL-change event matters here — waiting for
  // youtube.com's own full page load would make this test slow and network-flaky for no
  // reason.
  await page.goto('https://youtube.com', { waitUntil: 'commit' })
  await expect(dotWrap).toHaveAttribute('data-state', 'drift', { timeout: 3_000 })

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/companion.spec.ts -g "actually flips the ring to drift" --workers=1`
Expected: FAIL — the ring stays `data-state="focus"` forever, since `updateCompanion` is never called.

- [ ] **Step 3: Fix and wire `updateCompanion`**

Replace the `isCurrentlyBlocked` function and the `drifting` line inside `updateCompanion`:

```javascript
// isCurrentlyBlocked (resolving BLOCKLISTS *category names*) is removed — it never
// matched this call site's actual shape anyway (see below), and nothing else used it.

// The companion, without a model: a visit to a domain from any of the known distraction
// categories (design/blocklists.js) that isn't even one the user chose to block this
// session is drift they'd recognize as drift. No page content, no permission, no
// inference — this is the honest non-AI signal the judge seam (I9) will later replace.
async function updateCompanion(session, nextDomain) {
  const { companionEnabled } = await chrome.storage.local.get('companionEnabled')
  if (companionEnabled === false) return

  const now = Date.now()
  const withinGrace = now - new Date(session.startedAt).getTime() < DRIFT_GRACE_MS
  // session.blockedDomains is already a flat array of resolved domain strings (set by
  // startSession) — check membership directly, not via a category-name resolver.
  const drifting = !withinGrace && isKnownDistraction(nextDomain) && !(session.blockedDomains ?? []).includes(nextDomain)

  const { companionState } = await chrome.storage.local.get('companionState')

  if (!drifting) {
    if (companionState === 'drifting') await chrome.storage.local.set({ companionState: 'settled' })
    return
  }
  if (companionState === 'drifting') return // already signalled; don't re-cost the budget

  let { driftCount = 0, driftWindowStart = now } = session
  if (now - driftWindowStart > DRIFT_WINDOW_MS) {
    driftCount = 0
    driftWindowStart = now
  }
  if (driftCount >= DRIFT_BUDGET) return // over budget this window — companion stays settled

  const stored = await getSession()
  if (stored) {
    await chrome.storage.local.set({
      session: { ...stored, driftCount: driftCount + 1, driftWindowStart },
      companionState: 'drifting',
    })
  }
}
```

Then wire the call site inside `transition()`:

```javascript
async function transition({ mode, domain, at = Date.now() }) {
  const session = await getSession()
  if (!session) return
  const prior = session.slice ?? emptySlice(new Date(session.startedAt).getTime())
  const { events, state } = advance(prior, { at, mode, domain })
  for (const event of events) await enqueue(session, event)
  // dwellSince survives service-worker death because it lives in storage.
  const dwellSince = state.domain && state.domain === prior.domain ? (session.dwellSince ?? at) : at
  const next = { ...session, slice: state, dwellSince }
  await chrome.storage.local.set({ session: next })
  await updateCompanion(next, state.domain)
  return next
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "actually flips the ring to drift" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Record the finding in `docs/dead-ends.md`**

```markdown
### The companion's drift signal was dead code — `updateCompanion` was never called (2026-09-08)

Confirmed by grep: `updateCompanion` (`extension/sw.js`) was fully defined but had zero
call sites anywhere in the file. It also had a field-name bug that made it moot either
way — `isCurrentlyBlocked(nextDomain, session.blocklist)` read `session.blocklist`
(singular), a field that is never set (sessions store `blockedDomains`/`blocklists`,
plural); `isCurrentlyBlocked` resolves BLOCKLISTS *category names*, but `blockedDomains`
is already a flat array of resolved domain strings, so even passing the right field in
wouldn't have worked without also changing the check's shape. In practice, the companion
could only ever render its default 'focus' ring — the 'drift' state was unreachable,
which independently explains reports that focus vs. drift were "too vague to tell apart."

Fixed both: the check now compares `nextDomain` directly against `session.blockedDomains`,
and `updateCompanion(next, state.domain)` is called from inside `transition()`, so every
real tab/domain-change event now actually drives the signal.
```

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 42, documenting this test.

- [ ] **Step 8: Commit**

```bash
git add extension/sw.js e2e/companion.spec.ts docs/dead-ends.md docs/qa-recipe-playwright-e2e.md
git commit -m "fix(extension): wire up the companion's drift signal, it was dead code"
```

---

## Task 4: Companion position as a viewport fraction, not absolute pixels

**Files:**
- Modify: `extension/companion-overlay.js:106-151` (`clampToViewport`, `positionHost`, `onDrag`, `endDrag`)
- Test: `e2e/companion.spec.ts` (new test, not an extension of the existing drag test — see Step 1)

**Interfaces:**
- Consumes: nothing new.
- Produces: `companionPosition` storage key now holds `{xFrac, yFrac}` (0-1 range) instead of `{left, top}` (absolute px). A stale `{left, top}` value (no `xFrac`/`yFrac`) is treated the same as no stored position at all — falls back to `DEFAULT_POSITION`.

- [ ] **Step 1: Write the failing test**

The existing `'drag position persists across a fresh page load'` test uses one viewport size throughout and would pass identically whether or not this bug is fixed — add a genuinely new test instead:

```typescript
test('a dragged position holds its relative place across windows of different sizes', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  await pairAndStart(setupPage, extensionId)

  const wide = await context.newPage()
  await wide.setViewportSize({ width: 1400, height: 900 })
  await wide.goto('https://example.com')
  const wideHost = wide.locator(HOST_SELECTOR)
  const wideBox = (await wideHost.boundingBox())!

  // Drag it to roughly the horizontal center of the WIDE viewport.
  const target = { x: 700, y: wideBox.y }
  await wide.mouse.move(wideBox.x + wideBox.width / 2, wideBox.y + wideBox.height / 2)
  await wide.mouse.down()
  await wide.mouse.move(target.x, target.y, { steps: 10 })
  await wide.mouse.up()
  const draggedBox = (await wideHost.boundingBox())!
  const draggedFracX = draggedBox.x / 1400

  // A genuinely narrower window loading the same stored position should land at
  // roughly the same FRACTION across its own (smaller) width, not get silently
  // reclamped to a different relative spot.
  const narrow = await context.newPage()
  await narrow.setViewportSize({ width: 500, height: 700 })
  await narrow.goto('https://example.org')
  const narrowBox = (await narrow.locator(HOST_SELECTOR).boundingBox())!
  const narrowFracX = narrowBox.x / 500

  expect(Math.abs(narrowFracX - draggedFracX)).toBeLessThan(0.05)

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/companion.spec.ts -g "relative place across windows" --workers=1`
Expected: FAIL — the narrow window's fraction differs substantially from the wide window's, since the stored absolute pixel position gets reclamped against the narrow window's own smaller `innerWidth`.

- [ ] **Step 3: Fix `companion-overlay.js`**

```javascript
function clampFraction(frac) {
  return Math.min(Math.max(frac, 0), 1)
}

async function positionHost() {
  const { companionPosition } = await chrome.storage.local.get('companionPosition')
  // A stale {left, top} (pre-fraction format) has no xFrac/yFrac — treat it exactly
  // like "nothing stored" rather than writing a migration: a dragged-position
  // preference is low-stakes, and the next drag naturally re-saves the new format.
  if (companionPosition?.xFrac != null && companionPosition?.yFrac != null) {
    const left = clampFraction(companionPosition.xFrac) * (window.innerWidth - SIZE)
    const top = clampFraction(companionPosition.yFrac) * (window.innerHeight - SIZE)
    hostEl.style.left = `${left}px`
    hostEl.style.top = `${top}px`
    hostEl.style.right = ''
    hostEl.style.bottom = ''
  } else {
    hostEl.style.right = `${DEFAULT_POSITION.right}px`
    hostEl.style.bottom = `${DEFAULT_POSITION.bottom}px`
    hostEl.style.left = ''
    hostEl.style.top = ''
  }
}

function onDrag(e) {
  if (!dragState) return
  const left = Math.min(Math.max(e.clientX - dragState.offsetX, 0), Math.max(window.innerWidth - SIZE, 0))
  const top = Math.min(Math.max(e.clientY - dragState.offsetY, 0), Math.max(window.innerHeight - SIZE, 0))
  hostEl.style.left = `${left}px`
  hostEl.style.top = `${top}px`
  hostEl.style.right = ''
  hostEl.style.bottom = ''
}

async function endDrag() {
  if (!dragState) return
  dragState = null
  dot.dataset.dragging = 'false'
  const left = parseInt(hostEl.style.left, 10)
  const top = parseInt(hostEl.style.top, 10)
  await chrome.storage.local.set({
    companionPosition: {
      xFrac: window.innerWidth > SIZE ? left / (window.innerWidth - SIZE) : 0,
      yFrac: window.innerHeight > SIZE ? top / (window.innerHeight - SIZE) : 0,
    },
  })
}
```

Remove the old `clampToViewport` function entirely — both call sites above now inline the same clamp logic against pixel values only where needed (drag), and `positionHost` works in fractions directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/companion.spec.ts -g "relative place across windows" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean (this includes re-verifying the existing `'drag position persists across a fresh page load'` test still passes with the new storage format).

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 43, documenting this test.

- [ ] **Step 7: Commit**

```bash
git add extension/companion-overlay.js e2e/companion.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(companion): store drag position as a viewport fraction, not absolute pixels"
```

---

## Task 5: Landing page — swap the CTA on auth state instead of a hard redirect

**Files:**
- Modify: `app/page.tsx`
- Test: `e2e/review.spec.ts` or a new `e2e/landing.spec.ts` — new file is cleaner given this is a distinct surface.

**Interfaces:**
- Consumes: `currentUserId()` (`lib/auth/session.ts`, already imported in `app/page.tsx`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/landing.spec.ts (new file)
import { test, expect } from './fixtures'

test('a signed-in visitor to / sees the landing page with a dashboard CTA, not a forced redirect', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  // freshAccount lands on /dashboard after signup — navigate back to / explicitly.
  await page.goto('/')
  await expect(page.getByText('Every other focus app has to ask whether you were focused.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to your dashboard' })).toBeVisible()
  await expect(page.getByPlaceholder('Email')).toHaveCount(0) // no auth form for a signed-in visitor
})

test('a signed-out visitor to / still sees the sign-in form', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByText('Every other focus app has to ask whether you were focused.')).toBeVisible()
  await expect(page.getByPlaceholder('Email')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to your dashboard' })).toHaveCount(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/landing.spec.ts --workers=1`
Expected: the first test FAILs — a signed-in visitor to `/` currently gets redirected to `/dashboard` before any landing content renders.

- [ ] **Step 3: Fix `app/page.tsx`**

```tsx
import { currentUserId } from '@/lib/auth/session'
import { AuthForm } from './auth-form'
import { Band } from './band'

export const dynamic = 'force-dynamic'

const BEATS = [
  { title: 'Say it.', body: 'Type what you mean to finish. Leaving it empty is allowed, and it is counted.' },
  { title: 'Work.', body: 'Attention is recorded without you starting anything.' },
  { title: 'Get blocked.', body: 'The sites you chose show your own sentence back to you. No bypass.' },
  { title: 'Answer.', body: 'Did you? Yes or Not yet, weighted the same, forever.' },
]

const LEDGER_PREVIEW = [
  { intention: 'finish the supplier report', outcome: 'Not yet', segments: [{ kind: 'attention-1', flex: 41 }, { kind: 'attention-2', flex: 12 }, { kind: 'attention-3', flex: 9 }] },
  { intention: 'reply to the vendor thread', outcome: 'Yes', segments: [{ kind: 'attention-1', flex: 14 }, { kind: 'attention-2', flex: 3 }, { kind: 'attention-3', flex: 1 }] },
  { intention: 'read the Q3 brief properly', outcome: 'Yes', segments: [{ kind: 'attention-1', flex: 26 }, { kind: 'attention-2', flex: 5 }, { kind: 'attention-3', flex: 2 }] },
] as const

export default async function Home() {
  const userId = await currentUserId()

  return (
    <div data-surface="landing">
      <header className="m-landing-header">
        <div className="m-landing-brand">
          <p className="m-mark" data-state="ended" />
          <p className="m-landing-wordmark">MEANT</p>
        </div>
        <a
          className="m-meta"
          href="https://github.com/ED3N-Ventures-Interns/meant#extension"
          target="_blank"
          rel="noreferrer"
        >
          Add to Chrome
        </a>
      </header>

      <section className="m-landing-hero">
        <p className="m-mark" data-state="ended" />
        <h1 className="m-rate">Eleven this month. Seven finished.</h1>
        <p className="m-landing-lede">
          MEANT asks what you mean to do, turns it into a short plan, blocks what you chose to
          avoid, and sits with you while you work. Every other focus app has to ask whether you
          were focused. This one is inside the tab, so it already knows.
        </p>
        <div className="m-landing-auth" id="auth">
          {userId ? (
            <a className="m-btn" data-variant="primary" href="/dashboard">Go to your dashboard</a>
          ) : (
            <>
              <p className="m-meta">Sign in or create an account to continue.</p>
              <AuthForm />
            </>
          )}
          <p className="m-meta">Chrome and Edge. No installer, no admin rights.</p>
        </div>
      </section>

      <section className="m-landing-beats">
        <h2 className="m-landing-h2">Four steps and one sentence.</h2>
        <div className="m-landing-beats-grid">
          {BEATS.map((beat) => (
            <div key={beat.title}>
              <p className="m-mark" data-state="ended" />
              <p className="m-landing-beat-title">{beat.title}</p>
              <p className="m-meta">{beat.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="m-landing-prose">
        <h2 className="m-landing-h2">It reads the page. It stores nothing.</h2>
        <p className="m-meta">
          To tell your work from your drift it has to read the tab you are on, once, and decide.
          What it keeps is the site name and one word: served, drifted, unclear. There is no
          column for the text, no line in a log, nothing queued for later. Not a promise — there
          is nowhere to put it.
        </p>
      </section>

      <section className="m-landing-prose">
        <h2 className="m-landing-h2">No total hours. Anywhere.</h2>
        <p className="m-meta">
          Time is evidence inside one session&rsquo;s review. It is never a headline, never a
          streak, never a score. The number that accumulates is how many things you said you
          would finish, and did.
        </p>
      </section>

      <section className="m-landing-ledger">
        {LEDGER_PREVIEW.map((row) => (
          <div className="m-row" key={row.intention}>
            <p className="m-sentence">{row.intention}</p>
            <Band segments={[...row.segments]} />
            <p className="m-meta" style={{ color: 'var(--m-ink)' }}>{row.outcome}</p>
          </div>
        ))}
        <div className="m-landing-auth">
          {userId ? (
            <a className="m-btn" data-variant="primary" href="/dashboard">Go to your dashboard</a>
          ) : (
            <a className="m-btn" data-variant="primary" href="#auth">Sign in</a>
          )}
          <p className="m-meta">Your sessions stay in your account. There is no team view.</p>
        </div>
      </section>
    </div>
  )
}
```

Note: `redirect` import is dropped entirely (no longer used anywhere in this file).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/landing.spec.ts --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean. Pay attention to any existing test that assumed `/` redirects a signed-in visitor (check `e2e/fixtures.ts`'s `freshAccount` and any test that navigates to `/` after signing in) — none currently do based on this session's own review, but confirm via the full run.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, items 44-45, documenting both new tests.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx e2e/landing.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(landing): show the pitch to signed-in visitors too, swap the CTA instead of redirecting"
```

---

## Task 6: Wire up the ledger's container width from the already-approved fixture

**Files:**
- Modify: `app/globals.css` (add a `[data-surface="ledger"]` container rule)
- Test: `e2e/dashboard.spec.ts` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure CSS addition.

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/dashboard.spec.ts (new file)
import { test, expect } from './fixtures'

test('the dashboard ledger has the approved max-width, not full viewport width', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1600, height: 900 })
  await freshAccount(page)
  await page.goto('/dashboard')

  const ledger = page.locator('[data-surface="ledger"]')
  const box = await ledger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeLessThanOrEqual(1000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/dashboard.spec.ts --workers=1`
Expected: FAIL — the ledger's bounding box width is close to the full 1600px viewport, since no container rule constrains it.

- [ ] **Step 3: Add the container rule**

In `app/globals.css`, immediately before the first existing `[data-surface="ledger"] ...` rule (the `.m-row .m-mark` one):

```css
[data-surface="ledger"] {
  max-width: 1000px;
  margin: 0 auto;
  padding: 72px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
```

This matches `design/fixtures/ledger.html:9` and `design/canvas/Ledger.dc.html:16` exactly — already-approved visual truth, not a new design decision.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/dashboard.spec.ts --workers=1`
Expected: PASS. Also manually confirm the empty-state dashboard (`app/dashboard/page.tsx`'s `<div className="m-empty" data-surface="ledger">` branch) still looks reasonable — it now also inherits this container rule since it shares the same `data-surface="ledger"` attribute.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 46, documenting this test.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css e2e/dashboard.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(dashboard): wire up the ledger's approved 1000px container width"
```

---

## Task 7: "Away" clarifying copy

No dependencies on any other task — can land any time.

**Files:**
- Modify: `app/review/[sessionId]/page.tsx:46-52` (the away row)
- Test: `e2e/review.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Add to `e2e/review.spec.ts`. Don't rely on real idle/focus timing to produce away seconds
(not reliably forceable, and this suite avoids waiting on real timers) — `POST
/api/events` (device-token auth, already used internally by `extension/sw.js`'s own
`flush()`) accepts a raw `{kind: 'away', ...}` event directly, giving a deterministic way
to guarantee the row actually renders:

```typescript
test('the away row explains what "away" means via a hover title, not new visible text', async ({ context, extensionId, freshAccount }) => {
  const setupPage = await context.newPage()
  await freshAccount(setupPage)
  const mint = await setupPage.request.post('/api/pair')
  const { code } = await mint.json()
  const claim = await setupPage.request.post('/api/pair/claim', { data: { code } })
  const { token, deviceId } = await claim.json()
  await setupPage.goto(`chrome-extension://${extensionId}/popup.html`)
  await setupPage.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await setupPage.reload()
  await setupPage.locator('input.m-field').first().fill('away copy test')
  await setupPage.getByRole('button', { name: 'Start' }).click()

  const sessionId: string = await setupPage.evaluate(
    () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
  )

  // Inject a real away event directly via the same API sw.js's own flush() uses —
  // deterministic, no dependency on real idle/focus timing.
  const deviceOnly = await context.request.newContext()
  await deviceOnly.post('/api/events', {
    headers: { authorization: `Bearer ${token}` },
    data: { sessionId, events: [{ kind: 'away', domain: null, seconds: 120, at: new Date().toISOString() }] },
  })

  await setupPage.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))

  const reviewPage = await context.newPage()
  await reviewPage.goto(`/review/${sessionId}`)
  const awayRow = reviewPage.locator('[data-kind="away"]').locator('xpath=..')
  await expect(awayRow).toHaveAttribute('title', /not measured/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/review.spec.ts -g "explains what" --workers=1`
Expected: FAIL — the away row renders (guaranteed by the injected event) but has no `title` attribute yet.

- [ ] **Step 3: Add the `title` attribute**

In `app/review/[sessionId]/page.tsx`:

```tsx
{data.awaySeconds > 0 && (
  <div className="m-row" title="Time not measured — your screen was locked or idle, or you left the browser.">
    <span className="m-row-bar" data-kind="away" />
    <span className="m-row-domain">away</span>
    <span className="m-row-figure">{minutes(data.awaySeconds)} min</span>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/review.spec.ts -g "explains what" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 47, documenting this test.

- [ ] **Step 7: Commit**

```bash
git add "app/review/[sessionId]/page.tsx" e2e/review.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(review): add a hover explanation for the away row"
```

---

## Task 8: Popup chip removal, wired to the standing list

**Files:**
- Modify: `extension/popup.js` (`chipGroup`, `idle`)
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `PUT /api/lists` (already exists, already accepts device-token auth via `requestUserId()` in `lib/device-auth.ts` — confirmed, no backend change needed). `post()` from `extension/api.js` (already supports a `method` override).
- Produces: `chipGroup(options, {...})` gains a new option `removable: boolean` and, when true and `onRemove(value)` is provided, renders each chip with a trailing " ×" (matching `app/setup/page.tsx`'s `ListEditor` convention) whose click removes the chip from local state AND calls `onRemove`.

- [ ] **Step 1: Write the failing test**

Add to `e2e/popup.spec.ts`:

```typescript
test('a site chip can be removed, not just toggled off, and it does not reappear on reload', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const plusButtons = page.getByRole('button', { name: '+' })
  await plusButtons.first().click()
  await page.keyboard.type('gmail.com')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /gmail\.com/ })).toBeVisible()

  await page.getByRole('button', { name: 'Remove gmail.com' }).click()
  await expect(page.getByRole('button', { name: /gmail\.com/ })).toHaveCount(0)

  // Confirm it's gone from the server-side standing list too, not just local render state.
  await expect
    .poll(async () => {
      const res = await page.request.get('/api/lists')
      const body = await res.json()
      return body.workSites.includes('gmail.com')
    }, { timeout: 5_000 })
    .toBe(false)

  await page.reload()
  await expect(page.getByRole('button', { name: /gmail\.com/ })).toHaveCount(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "can be removed" --workers=1`
Expected: FAIL — no "Remove gmail.com" button exists (chips currently only toggle via their own label text as the accessible name, with no remove affordance).

- [ ] **Step 3: Add removal support to `chipGroup`**

```javascript
function chipGroup(options, { mono = false, multi = false, value, addable = false, removable = false, onChange, onRemove } = {}) {
  const row = el('div', 'm-chip-row')
  const selected = multi ? new Set(value ?? []) : null
  let single = multi ? null : (value ?? options[0]?.value)
  let plusButton = null

  function currentValue() {
    return multi ? [...selected] : single
  }

  function addChip(v, label = v) {
    const chip = el('button', 'm-chip', removable ? `${label} ×` : label)
    chip.type = 'button'
    chip.dataset.mono = String(mono)
    if (removable) chip.setAttribute('aria-label', `Remove ${label}`)
    chip.setAttribute('aria-pressed', String(multi ? selected.has(v) : single === v))
    chip.addEventListener('click', () => {
      if (removable) {
        selected.delete(v)
        chip.remove()
        if (onRemove) onRemove(v)
        if (onChange) onChange(currentValue())
        return
      }
      if (multi) {
        if (selected.has(v)) selected.delete(v)
        else selected.add(v)
        chip.setAttribute('aria-pressed', String(selected.has(v)))
      } else {
        single = v
        for (const b of row.querySelectorAll('.m-chip')) b.setAttribute('aria-pressed', String(b === chip))
      }
      if (onChange) onChange(currentValue())
    })
    row.insertBefore(chip, plusButton)
    return chip
  }

  for (const { label, value: v } of options) addChip(v, label)

  // ... addable branch unchanged ...
}
```

(The `addable` branch's body is unchanged — omitted here for brevity, keep it exactly as it is today.)

Then in `idle()`, wire `removable`/`onRemove` for both site chip groups, and make removal call `PUT /api/lists` with the domain excluded:

```javascript
async function removeFromList(kind, domain) {
  const res = await fetchLists()
  const next = {
    workSites: kind === 'work' ? res.workSites.filter((d) => d !== domain) : res.workSites,
    distractSites: kind === 'distract' ? res.distractSites.filter((d) => d !== domain) : res.distractSites,
  }
  await post('/api/lists', next, { method: 'PUT' })
}

// ... inside idle(), where workSites/blocked are built:
const workSites = chipGroup(workSiteOptions, {
  multi: true, addable: true, removable: true, value: workSiteValues,
  onRemove: (domain) => removeFromList('work', domain),
})
// ...
const blocked = chipGroup(blockedOptions, {
  multi: true, addable: true, removable: true, value: blockedValues,
  onChange: (v) => { blockingLabel.textContent = `blocking ${v.length}` },
  onRemove: (domain) => removeFromList('distract', domain),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "can be removed" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`. Pay particular attention to every OTHER existing `chipGroup` usage (the duration picker, the cycle picker) — none of them pass `removable`, so they must render exactly as before (default `removable: false`).
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 48, documenting this test.

- [ ] **Step 7: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): let a site chip be removed, not just toggled off"
```

---

## Task 9: `.m-chip-row` max-height and scroll cap

Independent of Task 8 — removal reduces the problem but doesn't cap it.

**Files:**
- Modify: `extension/meant.css:159`
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure CSS.

- [ ] **Step 1: Write the failing test**

```typescript
test('a long site list scrolls inside the chip row instead of growing the popup unbounded', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const plusButtons = page.getByRole('button', { name: '+' })
  for (let i = 0; i < 15; i++) {
    await plusButtons.first().click()
    await page.keyboard.type(`site${i}.example.com`)
    await page.keyboard.press('Enter')
  }

  const chipRow = page.locator('.m-chip-row').first()
  const box = (await chipRow.boundingBox())!
  expect(box.height).toBeLessThan(300) // well under the popup's own practical ~600px ceiling
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "scrolls inside the chip row" --workers=1`
Expected: FAIL — with 15 chips wrapping across many lines and no height cap, the row's bounding box height exceeds 300px.

- [ ] **Step 3: Add the scroll cap**

```css
.m-chip-row { display: flex; gap: 8px; flex-wrap: wrap; max-height: 132px; overflow-y: auto; }
```

(132px ≈ 4 rows of chips at this popup's chip height + gap — reasonable for a 360px-wide popup without dominating it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "scrolls inside the chip row" --workers=1`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 6: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, item 49, documenting this test.

- [ ] **Step 7: Commit**

```bash
git add extension/meant.css e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "fix(popup): cap the chip row's height, scroll instead of growing unbounded"
```

---

## Task 10: Cycle phase display in the running popup

**Files:**
- Modify: `extension/popup.js` (`running`)
- Test: `e2e/popup.spec.ts`

**Interfaces:**
- Consumes: `session.cycle` (`{work, break}` in minutes, or `null`), `session.startedAt` — both already present on every session.
- Produces: a new helper `cyclePhase(session)` returning `null` (no cycle configured) or `{phase: 'work'|'break', elapsedInPhaseMs, phaseMs, remainingMinutes}`.

**Scope boundary — read this before writing code:** this task is a read-only display fix. `extension/lib/attribution.js` already has a `'break'` mode that nothing currently drives (no call site ever passes `mode: 'break'` to `transition()`) — this task does NOT wire that up. Break time continues to be tracked as ordinary attention/away exactly as today; only the popup's own display gains phase awareness.

- [ ] **Step 1: Write the failing test**

```typescript
test('a running session with a cycle configured shows which phase it is in, without a ticking countdown', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)

  // 25/5 is already the picker's own preset (CYCLE_PRESETS[0]).
  await page.getByRole('button', { name: '25/5' }).click()
  await page.locator('input.m-field').first().fill('cycle test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText(/^work — \d+ min left$/)).toBeVisible()

  // Push startedAt into the break phase without a real 25-minute wait.
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('session', ({ session }: any) => {
        session.startedAt = new Date(Date.now() - 26 * 60_000).toISOString() // 1 min into break
        chrome.storage.local.set({ session }, () => resolve())
      })
    })
  })
  await page.reload()
  await expect(page.getByText(/^break — \d+ min left$/)).toBeVisible()

  // No cycle at all: no phase line should render.
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
});

test('a running session with no cycle configured shows no phase line', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await page.getByRole('button', { name: 'no cycles' }).click()
  await page.locator('input.m-field').first().fill('no cycle test')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText(/min left$/)).toHaveCount(0)
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/popup.spec.ts -g "which phase it is in" --workers=1`
Expected: FAIL — `running()` never renders any phase text today.

- [ ] **Step 3: Add `cyclePhase` and wire it into `running()`**

```javascript
// Pure computation, no chrome.* API — which phase (work/break) the elapsed time
// currently falls into, and how much of it remains. Read-only display only: this does
// NOT drive extension/lib/attribution.js's 'break' mode, which stays undriven exactly
// as it is today.
function cyclePhase(session) {
  if (!session.cycle) return null
  const { work, break: brk } = session.cycle
  const cycleMs = (work + brk) * 60_000
  const workMs = work * 60_000
  const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
  const posInCycle = ((elapsedMs % cycleMs) + cycleMs) % cycleMs // guard against a negative elapsed edge case
  if (posInCycle < workMs) {
    return { phase: 'work', elapsedInPhaseMs: posInCycle, phaseMs: workMs, remainingMinutes: Math.ceil((workMs - posInCycle) / 60_000) }
  }
  return { phase: 'break', elapsedInPhaseMs: posInCycle - workMs, phaseMs: brk * 60_000, remainingMinutes: Math.ceil((cycleMs - posInCycle) / 60_000) }
}
```

```javascript
function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const phase = cyclePhase(session)
  if (phase) {
    // Reuse the SAME .m-mark:not(:empty) proportional-band construction already used
    // for the review page's attention band (lib/band.ts's DOM shape, ported here since
    // this file has no bundler/TS/React) — a filled portion for elapsed-in-phase, a
    // dashed 'remainder' portion for what's left. No new class, no animation, no
    // ticking — this recomputes only when the popup itself re-renders (it has no
    // chrome.storage.onChanged listener), never on a live per-second timer.
    const filled = el('span', 'm-row-bar')
    filled.dataset.kind = 'attention-1'
    filled.style.flex = String(phase.elapsedInPhaseMs)
    const remainder = el('span', 'm-row-bar')
    remainder.dataset.kind = 'remainder'
    remainder.style.flex = String(Math.max(phase.phaseMs - phase.elapsedInPhaseMs, 1))
    mark.append(filled, remainder)
  }

  const startedAt = new Date(session.startedAt).getTime()
  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60000)
  const elapsed = el('p', 'm-meta', `${elapsedMinutes} min elapsed`)

  const phaseLine = phase ? el('p', 'm-meta', `${phase.phase} — ${phase.remainingMinutes} min left`) : null

  const blockedList = session.blockedDomains?.length
    ? el('p', 'm-meta', `blocking: ${session.blockedDomains.join(', ')}`)
    : null

  const stop = el('button', 'm-btn', 'Stop')
  stop.dataset.variant = 'quiet'
  stop.addEventListener('click', async () => {
    stop.disabled = true
    await chrome.runtime.sendMessage({ type: 'stop' })
    render()
  })

  let sentenceNode
  if (isEditable(Date.now(), startedAt, GRACE_MS)) {
    sentenceNode = el('input', 'm-field')
    sentenceNode.value = session.intention

    const commit = async () => {
      const value = sentenceNode.value.trim()
      if (!value || value === session.intention) return
      session.intention = value
      await chrome.storage.local.set({ session })
      post(`/api/sessions/${session.sessionId}`, { intention: value }, { method: 'PATCH' })
    }
    sentenceNode.addEventListener('blur', commit)
    sentenceNode.addEventListener('keydown', (e) => { if (e.key === 'Enter') sentenceNode.blur() })
  } else {
    sentenceNode = el('p', 'm-sentence', session.intention)
  }

  show(mark, sentenceNode, elapsed, ...(phaseLine ? [phaseLine] : []), ...(blockedList ? [blockedList] : []), stop, navRow())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/popup.spec.ts -g "which phase it is in|no cycle configured shows no phase" --workers=1`
Expected: PASS

- [ ] **Step 5: Visual verification (required — CLAUDE.md: render it and look)**

Write a temporary spec under `e2e/`, run it once, capture a screenshot of the running popup with a cycle configured, read it with the Read tool, then delete the temp spec. Confirm: the mark shows a visible two-segment fill (solid clay portion + dashed remainder portion), the phase text reads clearly at 360px width, and nothing animates.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add Case L, items 50-51, documenting both tests.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.js e2e/popup.spec.ts docs/qa-recipe-playwright-e2e.md
git commit -m "feat(popup): show which cycle phase you're in, without a ticking countdown"
```

---

## Task 11: Blocking UI — design pass

Sequence after Tasks 1 and 3 (domain-safety fixes land first, so this design isn't handed a moving target).

**Files:** none yet — this task's deliverable is a concrete, implementable design, not code.

- [ ] **Step 1: Run `impeccable`'s context-gathering**

```bash
node ~/.agents/skills/impeccable/scripts/context.mjs --target extension/blocked.html
```

Follow its directives. Treat the current `extension/blocked.html`/`extension/blocked.js` and the popup's blocking-related chip UI as incumbent visual truth — this is a refinement, not a replacement (PRODUCT.md/docs/design-toolkit.md already establish the palette, motion rules, and class contract; nothing here should introduce a new visual world).

- [ ] **Step 2: Produce a concrete design**

Read `PRODUCT.md`'s "What the product must never do" and `docs/design-toolkit.md` §9's refusals as binding constraints. Get to a specific, implementable design (exact classes/markup, or a precise description) — not a menu of options. Consider: `extension/blocked.html`'s current layout and copy, and whether the popup's own "blocking N" chip row/label could read more clearly.

- [ ] **Step 3: Write the design decision into a short note**

Save it as `docs/superpowers/specs/2026-09-08-blocking-ui-design.md` so Task 12 has something concrete to implement from — follow the same format as `docs/superpowers/specs/2026-09-07-natural-language-site-input-design.md` in this repo (Problem / Flow / Components / Contracts).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-08-blocking-ui-design.md
git commit -m "docs: design for the blocking UI improvement"
```

---

## Task 12: Blocking UI — implement the Task 11 design

**Files:** determined by Task 11's output — read `docs/superpowers/specs/2026-09-08-blocking-ui-design.md` first.

- [ ] **Step 1: Write the failing test(s) for whatever Task 11 specified**

Concrete test code depends on Task 11's output — write it the same way every other task in this plan does: a real Playwright interaction test, not a placeholder.

- [ ] **Step 2: Run test(s) to verify they fail**

- [ ] **Step 3: Implement the design exactly as specified in Task 11's note**

Tokens-first, no new class beyond the frozen contract, no new animation.

- [ ] **Step 4: Run test(s) to verify they pass**

- [ ] **Step 5: Visual verification**

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs extension/blocked.html
```

Plus a real screenshot, by eye, per CLAUDE.md's "render it and look" rule.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx playwright test --workers=1`, `npx tsc --noEmit`, `npm test`.
Expected: all clean.

- [ ] **Step 7: Extend `docs/qa-recipe-playwright-e2e.md`**

Add a new lettered case (continuing from wherever Task 1-10's Case L additions left off) for the new blocking-UI behavior.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(blocking): implement the improved blocking UI"
```

---

## Task 13: Doc fix — reconcile PRODUCT.md's `<all_urls>` constraint with shipped reality

No dependencies — can land any time, purely a documentation correction.

**Files:**
- Modify: `PRODUCT.md` ("Constraints that shape design" section)

- [ ] **Step 1: Update the constraint text**

Find: `` `<all_urls>` never appears in `host_permissions`. It exists only as `optional_host_permissions`, requested when the user turns on deep judging, and declinable forever. ``

Replace with:

```markdown
`<all_urls>` appears in `host_permissions` (shipped 2026-09-07, see `docs/dead-ends.md`) —
this superseded the original per-domain-optional design. Reasoning: the extension's own
content script already runs at `<all_urls>` (the companion floats on every page), and
`declarativeNetRequest`'s `redirect` action requires host permission for the domain being
redirected — a per-domain `optional_host_permissions` flow would mean asking for a new
permission grant every time the user names a new distraction site to block, which is
worse UX than a single, upfront, honest `<all_urls>` grant for a feature (blocking
arbitrary sites) that fundamentally needs it. This is not a new category of trust beyond
what the content script already requires.
```

- [ ] **Step 2: Commit**

```bash
git add PRODUCT.md
git commit -m "docs: reconcile the <all_urls> host_permissions constraint with what's shipped"
```

---

## Final review

Once all 13 tasks land, dispatch a final whole-branch review the same way the prior plan (`docs/superpowers/plans/2026-09-07-real-browser-qa-fixes.md`) did — `scripts/review-package` over the full range, most capable available model, specifically re-checking `extension/sw.js`'s coherence across Tasks 1/2/3 (three tasks touching one file), and `extension/popup.js`'s coherence across Tasks 8/9/10 (three tasks touching one file). Run a production `next build` before considering the whole batch done.
