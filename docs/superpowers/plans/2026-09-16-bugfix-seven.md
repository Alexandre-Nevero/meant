# Seven Defects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close #42, #45, #46, #47, #48, #49 and #50 — one data-loss bug, two silent-write-failure
bugs, the missing error world, the review's staging and motion, the companion's dead motion, and the
accessibility floor — each proved by a test that fails first.

**Architecture:** Nine tasks. Task 0 unblocks Playwright, because five of the seven defects are
*failure paths* and `page.route()` forcing a 500 is the only honest proof of a failure path. Task 1
establishes one shared error treatment (`[role="alert"]`, no new class) that Tasks 2 and 3 both
consume. Tasks 4–5 change the review's structure before its motion, so the stagger indices are
computed against the final DOM. Task 8 writes the ADR the dark-mode decision requires.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, `@neondatabase/serverless`, plain CSS with
`design/tokens.css`, `node --test` for alias-free logic, Playwright 1.63 for everything that renders.

---

## Global Constraints

Copied verbatim from `CLAUDE.md`, `docs/design.md`, `docs/design-toolkit.md` and the ADRs. Every
task's requirements implicitly include this section.

- **`design/tokens.css` is the contract.** Use `var(--m-*)`. **Never write a hex value in a
  component.** A missing colour belongs in tokens first, or it does not belong.
- **`docs/adr/` outranks every other document (ADR-0063).** Where an ADR and a PRD, SDD, `PRODUCT.md`,
  `apexhuman.md` or `CLAUDE.md` disagree, the ADR is right and the other is stale. Say so, then
  reconcile. **A decision not in `docs/adr/` has not been made.**
- **The design canvas outranks `tokens.css` and the docs.** `design/canvas/*.dc.html` is visual truth.
  Where the canvas and an ADR disagree, the ADR still wins — see Task 4's note on the cut task-plan.
- `Yes` and `Not yet` are identical in colour, weight, size, and motion (I1).
- No total-hours figure, no percentage, no score, on any surface (I2 / §3.1).
- The popup animates nothing. `[data-surface="popup"] .m-btn { transition: none; }` stays.
- Nothing good happens on screen during a session. **No exception since ADR-0057.** A *receipt* for
  a user-initiated tap is not positive feedback (ADR-0058).
- The companion never varies with the outcome answer, and never signals drift (ADR-0057).
- Away is a hatch, never a solid grey.
- Motion: one curve `cubic-bezier(0.23, 1, 0.32, 1)` (`--m-ease`). **Never `ease-in`. Never
  `transition: all`.** Never animate from `scale(0)`. Every animated element has a
  `prefers-reduced-motion` branch.
- Durations: press `160ms`, settle `240ms`, rise `280ms`, landing mark `900ms`, popup none.
- Verbal identity: second person, present tense, lowercase for the user's own words. No moralising.
  Never "Failed", "Missed", "Idle", "Unproductive", "Mark as complete".
- **`node --test` cannot resolve the `@/` alias.** Any module importing `@/…` is unreachable from a
  unit test. For a `lib/`→`lib/` value import use a relative path **with the `.ts` extension**;
  `allowImportingTsExtensions` is enabled for exactly this.
- **`next dev` rewrites `AGENTS.md` and `next-env.d.ts` on every run.** Both are committed
  deliberately. Do not "clean up" that diff.
- **The Impeccable detector returns `[]` for `.tsx` files regardless of contents.** Never quote it as
  evidence for a component. It is meaningful only over `.css`.
- **No AI attribution in any commit message.** No `Co-Authored-By`, no "Generated with".
- **`.env.local` holds production credentials.** Never print it, never commit it, never point a test
  at it.

### What this plan does NOT do

- **#51.2** (the landing hero asks for nothing) and **#51.3** (13 classes vs 15) stay open owner
  decisions. Task 4 adds two structural classes under the existing `.m-landing-*` / `.m-shell-*`
  precedent and **does not resolve #51.3**.
- **`app/page.tsx:109`** still reads *"It reads the page. It stores nothing."* ADR-0061 makes that
  false. It is out of scope by the owner's choice and remains the most prominent stale claim in the
  product. **Do not quietly rewrite it inside another task.**
- The judge (#22) and the coach (#26). `judgment` has zero rows.

### Three issue bodies are stale — verified 2026-09-16 against the code

Do not implement what the issue text says where this section contradicts it.

| Issue | Says | Actually |
|---|---|---|
| #49 | `<main>` = 0, `<nav>` = 0, `aria-*` = 3 | 4 `<main>`, 1 `<nav>`, 6 `aria-*` — the shell layouts added landmarks. Still true: `<label>` = 0, `/` and `/sign-in` have no `<main>`, metadata is `title` only |
| #49 | `.m-landing-header` is defined nowhere | Defined at `app/globals.css:410` |
| #50 | hover pill is `220ms` | It is `150ms` (`companion-overlay.js:145`). The 220ms is `.ring`'s opacity transition (`:95`), which now only ever fires once, at mount. **Leave it.** |
| #51.1 | "no `data-theme` anywhere" | `tokens.css:54` is `:root:not([data-theme="light"])` and `:root[data-theme="dark"]` exists at `:70`. The hooks ship; nothing sets the attribute |

---

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `.env.test` | 0 | Points the e2e suite at a Neon test database. Gitignored |
| `app/globals.css` | 1, 4, 5, 7 | The one stylesheet. Error treatment, review layout, rise delay, label layout |
| `app/error.tsx` | 1 | Route-level failure inside the app shell |
| `app/not-found.tsx` | 1 | 404, including `review/[sessionId]`'s `notFound()` |
| `app/global-error.tsx` | 1 | Root-layout failure. Renders its own `<html>`/`<body>` |
| `app/auth-form.tsx` | 1, 7 | Error announcement; real `<label>`s; per-form `aria-label` |
| `app/setup/page.tsx` | 2 | Three states: loading, ready, failed. Never fabricates |
| `app/review/[sessionId]/answer.tsx` | 3 | Checks the PATCH, re-enables, announces, retries on the same two buttons |
| `app/review/[sessionId]/page.tsx` | 4, 5 | Row group, staged ask group, rise indices |
| `app/layout.tsx` | 7 | `metadataBase`, description, OpenGraph |
| `app/page.tsx`, `app/sign-in/page.tsx` | 7 | `<main>` landmark |
| `extension/companion-overlay.js` | 6 | Dead drift rule out, receipt retimed, reduced-motion receipt |
| `e2e/fixtures.ts` | 7 | `getByLabel` instead of `getByPlaceholder` |
| `e2e/*.spec.ts` | 0–7 | Every proof that renders |
| `docs/adr/ADR-0065-*.md` | 8 | The dark-mode decision |

---

## Task 0: Unblock the only harness that can prove a failure path

**Why first.** Five of the seven defects are failure paths. `npm test` is `node --test` over
alias-free logic — it cannot render a component, and none of these bugs is reachable from pure
logic. Playwright can force a 500 with `page.route()`. Without `.env.test` it refuses to start, and
that refusal is correct behaviour: before 2026-09-15 every run wrote to production
(`lib/db-guard.ts:3-8`, 3,668 rows across 3,651 user ids, six of them real).

**Files:**
- Create: `.env.test` (gitignored, never committed)
- Read: `.env.test.example`, `playwright.config.ts:16-19`, `lib/db-guard.ts`

**Interfaces:**
- Produces: a working `npx playwright test`. Every later task depends on it.

- [ ] **Step 1: Land the uncommitted documentation reconciliation first**

**Controller does this, on `main`, before the worktree exists — the owner authorised it on
2026-09-16.** Twelve files are modified in the working tree: the ADR-0052–0064 reconciliation from
the previous session, 402 insertions. They must land before branching, because Tasks 4, 6 and 8 edit
text that exists **only** in that uncommitted diff — verified: `design-toolkit.md` §9's violation
note, `design.md` §5's #51 note and its review-width correction are in none of HEAD's copies.

```bash
git status --short          # expect the 12 files below, plus this untracked plan, and nothing else
npm test                    # expect 149 passing, 0 failures
npx tsc --noEmit            # expect 0 errors
git add AGENTS.md CLAUDE.md PRODUCT.md docs/build.md docs/design-toolkit.md docs/design.md \
        docs/flow-intent.md docs/idea-intent.md docs/index.md docs/prd-intent.md \
        docs/sdd-intent.md docs/sitemap-intent.md
git commit -m "docs: reconcile the intent documents against ADR-0052 to ADR-0064"

git add docs/superpowers/plans/2026-09-16-bugfix-seven.md
git commit -m "docs: the plan for the seven open defects"
```

If `git status --short` shows anything beyond those twelve and this plan, stop and ask. `AGENTS.md` and
`next-env.d.ts` are rewritten by `next dev` — if they reappear modified after this, leave them.

- [ ] **Step 2: Create the isolated workspace**

REQUIRED SUB-SKILL: `superpowers:using-git-worktrees`. Detect existing isolation first; prefer the
native worktree tool, fall back to `git worktree`. Branch name: `bugfix-seven`. Announce the path.

- [ ] **Step 3: The owner creates the Neon test branch**

**This step is the owner's, not the implementer's.** It needs their Neon credentials. Ask, then wait.

The `neon` CLI is **not installed on this machine** — verified 2026-09-16. Use `npx`:

```bash
npx neonctl auth
npx neonctl branches create --name e2e
npx neonctl databases create --name meant_test --branch e2e
```

Or create the branch and a database named `meant_test` in the Neon console and copy the pooled
connection string. Either way, `.env.test` lives **in the worktree**, because `playwright.config.ts`
reads it relative to the working directory.

- [ ] **Step 4: Write `.env.test`**

The database **name** must end `_test` — `lib/db-guard.ts:23` rejects anything else, and
`playwright.config.ts:16` asserts it at config load, before a server starts. A Neon *branch* alone is
not enough: a branch inherits its parent's database name and would sail through.

```bash
cat > .env.test <<'ENV'
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/meant_test?sslmode=require
ENV
grep -c '^\.env\*' .gitignore   # expect 1 — .env.test must never be committed
git check-ignore -v .env.test   # expect a match on .gitignore
```

- [ ] **Step 5: Verify the guard refuses production before trusting it**

```bash
node --input-type=module -e "
import { isTestDatabase } from './lib/db-guard.ts'
console.log('prod-shaped:', isTestDatabase('postgresql://u:p@h/meant?sslmode=require'))
console.log('test-shaped:', isTestDatabase('postgresql://u:p@h/meant_test?sslmode=require'))
"
```

Expected: `prod-shaped: false`, `test-shaped: true`. If the first prints `true`, **stop** — do not
run the suite.

- [ ] **Step 6: Migrate the test database**

```bash
export DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' .env.test)"
node lib/migrate.mjs
unset DATABASE_URL
```

Expected: `apply 001-*.sql`, `apply 002-drift.sql`, … one line per file in `lib/migrations/`.

- [ ] **Step 7: Record the honest baseline**

```bash
npx playwright install chromium    # no-op if already installed
npx playwright test 2>&1 | tail -40
```

**Write down the pass/fail counts before changing anything.** Some specs may already fail —
`e2e/companion.spec.ts` in particular was written against the pre-ADR-0057 companion. A pre-existing
failure is not this plan's to fix silently; note it, and if it blocks a later task, say so.

- [ ] **Step 8: Prove production was untouched**

Read-only, against `.env.local`, and delete the probe immediately afterwards.

```bash
node --env-file=.env.local --input-type=module -e "
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
console.log(await sql\`select count(*)::int as sessions from session\`)
"
```

Run it once before Step 7 and once after. The two numbers must be equal. If they are not, the suite
is still pointed at production — stop everything and report.

- [ ] **Step 9: Commit**

```bash
git add .env.test.example
git commit --allow-empty -m "test(e2e): the suite can run — Neon test branch wired

.env.test is gitignored and stays local. Baseline recorded in the plan."
```

---

## Task 1: Give failure somewhere to land (#46)

**Files:**
- Create: `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`
- Modify: `app/globals.css` (after the `.m-meta` block, around `:178`), `app/auth-form.tsx:26,37`
- Test: `e2e/error-surfaces.spec.ts` (create)

**Interfaces:**
- Produces: `[role="alert"]` as the one error treatment in the product — `color: var(--m-ink)`,
  `font-weight: 500`, no new class, announced to a screen reader. **Tasks 2 and 3 use exactly this.**

**Why not colour.** Clay is banned as a text colour at 3.74:1 (`docs/design.md` §10). So weight,
position and announcement carry it. That constraint gives the better result: a screen-reader user
gets told, which a colour never does.

- [ ] **Step 1: Write the failing test**

Create `e2e/error-surfaces.spec.ts`:

```ts
import { test, expect } from './fixtures'

// #46. A failure must stay inside the product's visual world, and must be announced.
test('a 404 renders in the product, not Next.js stock black-on-white', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)

  // A well-formed UUID that belongs to nobody — review/[sessionId] calls notFound() for it.
  await page.goto('/review/00000000-0000-4000-8000-000000000000')

  await expect(page.locator('[data-surface="not-found"]')).toBeVisible()
  const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(ground).not.toBe('rgba(0, 0, 0, 0)')
  expect(ground).not.toBe('rgb(255, 255, 255)')
  await expect(page.getByRole('link', { name: 'Your sessions' })).toBeVisible()
})

test('a failed sign-in is announced, and does not read as a hint', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/sign-in')

  const form = page.locator('form', { has: page.getByRole('button', { name: 'Sign in' }) })
  await form.getByPlaceholder('Email').fill('nobody@example.com')
  await form.getByPlaceholder('Password').fill('not-the-password')
  await form.getByRole('button', { name: 'Sign in' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()

  // The defect was that it rendered identically to the word "or" two lines below it.
  const [alertWeight, hintWeight] = await Promise.all([
    alert.evaluate((el) => getComputedStyle(el).fontWeight),
    page.getByText('or', { exact: true }).evaluate((el) => getComputedStyle(el).fontWeight),
  ])
  expect(alertWeight).not.toBe(hintWeight)
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/error-surfaces.spec.ts
```

Expected: both fail. The first on `[data-surface="not-found"]` never appearing; the second on
`getByRole('alert')` finding nothing.

- [ ] **Step 3: Add the shared error treatment**

In `app/globals.css`, immediately after the `.m-meta` rule (currently ending `:178`):

```css
/* ---------- errors ----------------------------------------------------------------------
 * One treatment, hooked on the ARIA role rather than a new class, so the thing that makes it
 * visible and the thing that makes it audible cannot drift apart — and the 13-class contract
 * is untouched.
 *
 * Colour cannot carry this. Clay is banned as a text colour at 3.74:1 (docs/design.md §10),
 * and the defect being fixed (#46) is precisely that a failed sign-in rendered as --m-ink-3,
 * the same grey as the word "or". So: full ink, one weight up, and announced. */
[role="alert"] {
  color: var(--m-ink);
  font-weight: 500;
}
```

- [ ] **Step 4: Announce the auth errors**

In `app/auth-form.tsx`, lines 26 and 37 — add the role, change nothing else:

```tsx
{signInState?.error && <p className="m-meta" role="alert">{signInState.error}</p>}
```

```tsx
{signUpState?.error && <p className="m-meta" role="alert">{signUpState.error}</p>}
```

- [ ] **Step 5: Create `app/not-found.tsx`**

```tsx
import Link from 'next/link'

/** #46. `review/[sessionId]/page.tsx:24` calls notFound() for a session that is not yours or
 *  not there, and Next's stock 404 is black-on-white in system fonts — the user falls out of
 *  the product at the exact moment they are already confused. */
export default function NotFound() {
  return (
    <div data-surface="not-found">
      <p className="m-mark" data-state="empty" />
      <p className="m-sentence">That isn&rsquo;t here.</p>
      <Link className="m-meta" href="/dashboard">Your sessions</Link>
    </div>
  )
}
```

- [ ] **Step 6: Create `app/error.tsx`**

A route-level error boundary must be a Client Component, and `reset()` is its retry.

```tsx
'use client'

/** #46. Before this, a DB failure on the dashboard (app/dashboard/page.tsx:17, an unguarded
 *  `sql` call) threw straight through to Next's stock error page. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div data-surface="not-found">
      <p className="m-mark" data-state="empty" />
      <p className="m-sentence">This page didn&rsquo;t load.</p>
      <p className="m-meta" role="alert">Nothing you have recorded was changed.</p>
      <button className="m-btn" data-variant="quiet" onClick={reset}>Try again</button>
    </div>
  )
}
```

Do not render `error.message` — it can carry a connection string.

- [ ] **Step 7: Create `app/global-error.tsx`**

This one replaces the root layout, so it owns `<html>` and `<body>` itself.

```tsx
'use client'

import './globals.css'

/** #46. The root layout itself failing. next/font's CSS variables are declared on <html> by
 *  app/layout.tsx, which this file replaces — so --m-display/--m-body fall back to the Georgia
 *  and system-ui tails already declared in globals.css:6-8. Correct by construction, not by
 *  accident: this page is a crash screen, and re-invoking three font loaders to dress it would
 *  be the wrong trade. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="m-app">
        <div data-surface="not-found">
          <p className="m-mark" data-state="empty" />
          <p className="m-sentence">Something broke.</p>
          <button className="m-btn" data-variant="quiet" onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Give the three surfaces a layout**

In `app/globals.css`, after the `[data-surface="review"]` block (currently ending `:105`):

```css
/* The failure surfaces. Centred and short on purpose — there is nothing to read here, only
 * somewhere to go. Reuses the ledger's own column so it does not jump when it replaces one. */
[data-surface="not-found"] {
  max-width: 1000px;
  margin: 0 auto;
  padding: 72px 80px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
}
[data-surface="not-found"] .m-btn { width: auto; padding: 16px 32px; }

@media (max-width: 700px) {
  [data-surface="not-found"] { padding: 40px 24px; }
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npx playwright test e2e/error-surfaces.spec.ts
npx tsc --noEmit
node ~/.agents/skills/impeccable/scripts/detect.mjs --json app/globals.css
```

Expected: both tests pass, 0 type errors, detector clean on the CSS. (`--json` over a `.tsx` proves
nothing — do not run it on the three new components and do not quote the result.)

- [ ] **Step 10: Look at it**

```bash
~/.claude/skills/gstack/browse/dist/browse goto http://localhost:3100/review/00000000-0000-4000-8000-000000000000
~/.claude/skills/gstack/browse/dist/browse screenshot
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 http://localhost:3100/review/00000000-0000-4000-8000-000000000000
```

Check both grounds: run once with the OS in light mode and once in dark. Every value here is a token,
so both must already be right — confirm it rather than assume it.

- [ ] **Step 11: Commit**

```bash
git add app/error.tsx app/not-found.tsx app/global-error.tsx app/auth-form.tsx \
        app/globals.css e2e/error-surfaces.spec.ts
git commit -m "fix(web): failure stays inside the product

No error.tsx, not-found.tsx or global-error.tsx existed anywhere under app/, so
review/[sessionId]'s notFound() and any dashboard DB failure dropped the user onto
Next's stock black-on-white page in system fonts.

In-product errors were also indistinguishable from hints: a failed sign-in rendered
as .m-meta, the same --m-ink-3 grey as the word 'or', with no role and no
announcement. Clay is banned as a text colour at 3.74:1, so weight, position and
announcement carry it instead — hooked on [role=alert] so the visible treatment and
the audible one cannot drift apart, and so the class contract is untouched.

Closes #46"
```

---

## Task 2: Stop the setup page destroying a user's site lists (#42)

**P1, data loss, unrecoverable — there is no history and no soft delete.**

**Files:**
- Modify: `app/setup/page.tsx:68-119`
- Test: `e2e/setup-lists.spec.ts` (append)

**Interfaces:**
- Consumes: `[role="alert"]` from Task 1.
- Produces: nothing other tasks read.

**The mechanism, exactly.** `app/setup/page.tsx:76` catches *any* read failure and calls
`setLists({ workSites: [], distractSites: [] })`. The UI cannot distinguish *we could not load your
lists* from *you have no lists*, and it shows the second. The page is then immediately editable, and
`update()` (`:79`) PUTs the whole object, which `app/api/lists/route.ts:45-50` writes with
`on conflict … do update set value = excluded.value` — wholesale replacement. Fetch fails → user sees
an empty list → adds one site → **every previously configured site is destroyed.** This is the data
ADR-0035's three-question flow depends on, and it only started persisting in #8.

`update()` also calls `fetch` with no `.catch()` and no response check: a failed save updates local
state and returns, so the UI shows the change and the server never received it.

- [ ] **Step 1: Write the failing test**

Append to `e2e/setup-lists.spec.ts`:

```ts
// #42, P1. A failed read rendered as "you have configured no sites", and the page stayed
// editable from that fabricated state — so one added site replaced the real list wholesale.
test('a failed read never fabricates an empty list, and cannot be saved over', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)

  // Seed a real list through the API, so there is something to destroy.
  const seeded = await page.request.put('/api/lists', {
    data: { workSites: ['docs.google.com', 'github.com'], distractSites: ['x.com'] },
  })
  expect(seeded.ok()).toBeTruthy()

  await page.route('**/api/lists', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
  )
  await page.goto('/setup')

  await expect(page.getByRole('alert')).toBeVisible()
  // The load-bearing assertion: nothing editable exists, so nothing can be saved over.
  await expect(page.getByPlaceholder('add a site and press enter')).toHaveCount(0)

  await page.unroute('**/api/lists')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('docs.google.com')).toBeVisible()
  await expect(page.getByText('github.com')).toBeVisible()

  // And the stored list survived the whole episode.
  const after = await page.request.get('/api/lists')
  expect((await after.json()).workSites.sort()).toEqual(['docs.google.com', 'github.com'])
})

// #42, second half. A silent write failure is worse than a visible one.
test('a failed save is announced and rolled back, not shown as saved', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await page.goto('/setup')

  const work = page.locator('section', { hasText: 'Where do you work?' })
  await work.getByPlaceholder('add a site and press enter').fill('github.com')
  await work.getByPlaceholder('add a site and press enter').press('Enter')
  await expect(work.getByText('github.com')).toBeVisible()

  await page.route('**/api/lists', (route) =>
    route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
  )
  await work.getByPlaceholder('add a site and press enter').fill('gitlab.com')
  await work.getByPlaceholder('add a site and press enter').press('Enter')

  await expect(page.getByRole('alert')).toBeVisible()
  // Rolled back: the interface must not claim a site is saved when it is not.
  await expect(work.getByText('gitlab.com')).toHaveCount(0)
  await expect(work.getByText('github.com')).toBeVisible()
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/setup-lists.spec.ts
```

Expected: the first existing test still passes; both new tests fail — the first because the page
renders an editable empty state instead of an alert, the second because nothing is announced.

- [ ] **Step 3: Replace `Setup`'s state with three real states**

`app/setup/page.tsx`, lines 68-119. `ListEditor` above it is unchanged.

```tsx
type Loaded =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; lists: Lists }

export default function Setup() {
  const router = useRouter()
  const [state, setState] = useState<Loaded>({ status: 'loading' })
  const [saveFailed, setSaveFailed] = useState(false)
  // Two edits in flight: without a sequence number, a slow failing PUT can roll back a later
  // successful one. Only the newest response is allowed to act.
  const seq = useRef(0)

  function load() {
    setState({ status: 'loading' })
    fetch('/api/lists')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      // Loading, loaded and failed are three states, not two. #42: catching a read failure
      // into an empty list told the user they had configured nothing, and then let them save
      // that over the real thing. There is no history and no soft delete, so it was final.
      .then((lists: Lists) => setState({ status: 'ready', lists }))
      .catch(() => setState({ status: 'failed' }))
  }

  useEffect(load, [])

  function update(next: Lists, previous: Lists) {
    const mine = ++seq.current
    setSaveFailed(false)
    setState({ status: 'ready', lists: next })
    fetch('/api/lists', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    })
      .then((r) => {
        if (r.ok || seq.current !== mine) return
        // The optimistic chip is a claim the server did not honour. Withdraw it.
        setState({ status: 'ready', lists: previous })
        setSaveFailed(true)
      })
      .catch(() => {
        if (seq.current !== mine) return
        setState({ status: 'ready', lists: previous })
        setSaveFailed(true)
      })
  }

  if (state.status === 'loading') {
    return (
      <div data-surface="setup">
        <p className="m-meta">Loading…</p>
      </div>
    )
  }

  if (state.status === 'failed') {
    return (
      <div data-surface="setup">
        <p className="m-meta" role="alert">Your sites didn&rsquo;t load. Nothing here has been changed.</p>
        <button className="m-btn" data-variant="quiet" onClick={load}>Try again</button>
      </div>
    )
  }

  const { lists } = state

  return (
    <div data-surface="setup">
      <ListEditor
        question="Where do you work?"
        hint="The sites your actual work happens on."
        domains={lists.workSites}
        onChange={(workSites) => update({ ...lists, workSites }, lists)}
      />
      <ListEditor
        question="What pulls you away?"
        domains={lists.distractSites}
        onChange={(distractSites) => update({ ...lists, distractSites }, lists)}
      />
      {saveFailed && <p className="m-meta" role="alert">That didn&rsquo;t save. Nothing was changed.</p>}
      <div style={{ display: 'flex', gap: 14 }}>
        <button className="m-btn" data-variant="primary" onClick={() => router.push('/dashboard')}>
          Done
        </button>
        <button className="m-btn" data-variant="quiet" onClick={() => router.push('/dashboard')}>
          skip for now
        </button>
      </div>
    </div>
  )
}
```

Add `useRef` to the import on line 3:

```tsx
import { useEffect, useRef, useState } from 'react'
```

- [ ] **Step 4: Widen the buttons rule so the failed state's button is not full-bleed**

`.m-btn` is `width: 100%`. In `app/globals.css`, beside the `[data-surface="setup"]` rules:

```css
[data-surface="setup"] .m-btn { width: auto; padding: 16px 32px; }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx playwright test e2e/setup-lists.spec.ts
npx tsc --noEmit
```

Expected: three tests pass, 0 type errors. The **pre-existing** test at `:5` must still pass — its
comment at `:25-28` describes the fire-and-forget PUT; the save is still optimistic, so its
`expect.poll` on `/api/lists` still holds.

- [ ] **Step 6: Look at it**

Render `/setup` at 1440 and 390 with the GET forced to 500, and confirm the failed state shows no
input, no chip row, and no Done button — there is nothing to be done from a state that has no data.

- [ ] **Step 7: Commit**

```bash
git add app/setup/page.tsx app/globals.css e2e/setup-lists.spec.ts
git commit -m "fix(setup): stop a failed read destroying the stored site lists

The read path caught every failure — offline, 500, an auth blip — into
{ workSites: [], distractSites: [] }, so the page told the user they had configured
no sites. It was then immediately editable from that fabricated state, and update()
PUTs the whole object, which /api/lists replaces wholesale. Fetch fails, user adds
one site, every previously configured site is gone. No history, no soft delete.

Loading, ready and failed are now three states. The failed one renders nothing
editable, so there is nothing to save over.

The write path failed silently too: no .catch, no response check. A failed save is
now announced and the optimistic chip is withdrawn, with a sequence number so a slow
failing PUT cannot roll back a later successful one.

Closes #42"
```

---

## Task 3: Stop the review losing the outcome answer (#47)

**Files:**
- Modify: `app/review/[sessionId]/answer.tsx`, `e2e/fixtures.ts`
- Test: `e2e/review.spec.ts` (append)

**Interfaces:**
- Consumes: `[role="alert"]` from Task 1.
- Produces: `Answer` still renders exactly two buttons and nothing else interactive. **Task 4 wraps
  it; Task 5 gives the wrapper a rise index.**
- Produces: the `endedSession` fixture in `e2e/fixtures.ts`. **Tasks 4 and 5 use it.**

`answer.tsx:12-17` PATCHes and never checks `res.ok`. On failure both buttons are left permanently
disabled, with no message and no retry. The user answered; nothing was recorded; the interface showed
neither. `session.outcome` is the column the whole ledger accumulates and ADR-0051 makes it the
coach's primary input.

**Retry is the same two buttons.** A third control here would break the symmetry I1 protects, and the
message must never name which answer was pressed — `Yes` and `Not yet` stay identical in every
visual property, including what happens after them.

- [ ] **Step 1: Give the suite one way to produce an ended session**

`e2e/review.spec.ts` open-codes the same pair-and-start preamble four times already (`:5-23`,
`:52-67`, `:91-106`, `:119-134`), and Tasks 3, 4 and 5 each need it again. One fixture instead.

In `e2e/fixtures.ts`, add to the `Fixtures` type:

```ts
  endedSession: (opts: { intention: string; events?: unknown[] }) => Promise<string>
```

and to `base.extend`, after `freshAccount`:

```ts
  endedSession: async ({ context, extensionId, freshAccount }, use) => {
    await use(async ({ intention, events = [] }) => {
      const page = await context.newPage()
      await freshAccount(page)
      const mint = await page.request.post('/api/pair')
      const { code } = await mint.json()
      const claim = await page.request.post('/api/pair/claim', { data: { code } })
      const { token, deviceId } = await claim.json()
      await page.goto(`chrome-extension://${extensionId}/popup.html`)
      await page.evaluate(
        ({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())),
        { token, deviceId },
      )
      await page.reload()
      await page.locator('input.m-field').first().fill(intention)
      await page.getByRole('button', { name: 'Start' }).click()
      const sessionId: string = await page.evaluate(
        () => new Promise<string>((r) => chrome.storage.local.get('session', ({ session }: any) => r(session.sessionId))),
      )
      // The Start click is fire-and-forget from sw.js startSession(); sessionId is in storage
      // immediately, but the server row may not exist yet. Same wait the open-coded copies use.
      await page.waitForTimeout(500)
      if (events.length > 0) {
        // The same API sw.js's own flush() uses — deterministic, no dependency on real timing.
        const res = await context.request.post('/api/events', {
          headers: { authorization: `Bearer ${token}` },
          data: { sessionId, events },
        })
        if (res.status() !== 200) throw new Error(`event injection failed: ${res.status()}`)
      }
      await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
      await page.waitForTimeout(300)
      return sessionId
    })
  },
```

Leave the four existing open-coded copies alone. Rewriting passing tests is not this task, and a
fixture that has never run is not yet worth migrating four working specs onto.

- [ ] **Step 2: Write the failing test**

Append to `e2e/review.spec.ts`:

```ts
// #47. The most important write in the product, and it was unchecked.
test('a failed outcome write re-enables both buttons, says so, and retries on the same two', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'outcome failure test' })

  const page = await context.newPage()
  await page.route('**/api/sessions/*/outcome', (route) => route.fulfill({ status: 500, body: '{}' }))
  await page.goto(`/review/${sessionId}`)

  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yes' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Not yet' })).toBeEnabled()
  // I1: the retry affordance is the two buttons themselves, never a third control.
  // Scoped to the surface — the app shell contributes its own <button> for Sign out.
  await expect(page.locator('[data-surface="review"] button')).toHaveCount(2)

  await page.unroute('**/api/sessions/*/outcome')
  await page.getByRole('button', { name: 'Yes' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)

  const review = await page.request.get(`/api/sessions/${sessionId}/review`)
  expect((await review.json()).outcome).toBe('yes')
})
```

- [ ] **Step 3: Run it to make sure it fails**

```bash
npx playwright test e2e/review.spec.ts -g "failed outcome write"
```

Expected: fails at `getByRole('alert')` — nothing is rendered, and both buttons stay disabled forever.

- [ ] **Step 4: Check the response**

Replace the body of `app/review/[sessionId]/answer.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Answer({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function answer(outcome: 'yes' | 'no') {
    setSending(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/outcome`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome }),
      })
      // #47. This was unchecked, so a failure left both buttons disabled forever with no
      // message: the user answered, nothing was recorded, and the interface showed neither.
      if (!res.ok) throw new Error(String(res.status))
      router.refresh()
    } catch {
      setSending(false)
      setFailed(true)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 14 }}>
        <button className="m-answer" data-answer="yes" disabled={sending} onClick={() => answer('yes')}>
          Yes
        </button>
        <button className="m-answer" data-answer="not-yet" disabled={sending} onClick={() => answer('no')}>
          Not yet
        </button>
      </div>
      {/* The retry is the same two buttons — a third control here would break the symmetry
          I1 protects. The message never names which answer was pressed, for the same reason. */}
      {failed && <p className="m-meta" role="alert">That didn&rsquo;t save. Answer again.</p>}
    </>
  )
}
```

On success `sending` deliberately stays `true` — `router.refresh()` re-renders into the answered
branch, and re-enabling the buttons first would flash them live for a frame.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx playwright test e2e/review.spec.ts
npx tsc --noEmit
grep -rn 'm-answer\[data-answer' app extension   # must print nothing — docs/design.md §5
```

Expected: all review tests pass, 0 type errors, the grep silent.

- [ ] **Step 6: Commit**

```bash
git add "app/review/[sessionId]/answer.tsx" e2e/fixtures.ts e2e/review.spec.ts
git commit -m "fix(review): stop losing the outcome answer on a failed write

The PATCH never checked res.ok. On failure both buttons were left permanently
disabled, with no message and no retry — the user answered, nothing was recorded,
and the interface showed neither. session.outcome is the column the ledger
accumulates and ADR-0051 makes it the coach's primary input.

The retry is the same two buttons, and the message never names which was pressed:
a third control, or asymmetric copy, would break the symmetry invariant 1 protects.

Adds an endedSession fixture while here: e2e/review.spec.ts open-codes the same
pair-and-start preamble four times, and three more specs in this branch need it. The
four existing copies are left alone — rewriting passing tests is not this change.

Closes #47"
```

---

## Task 4: Stage the review's question instead of listing it (#45)

**Files:**
- Modify: `app/globals.css:98-105` and the `.m-shell` rule (`:632`), `app/review/[sessionId]/page.tsx:26-97`
- Read first: `design/canvas/Main.dc.html:23,47-65`
- Test: `e2e/review.spec.ts` (append)

**Interfaces:**
- Produces: `.m-review-rows` and `.m-review-ask`. **Task 5 puts a rise index on `.m-review-ask`.**

**What the artboard actually says.** `design/canvas/Main.dc.html:23` is a flex column at **`gap: 40px`**
with `padding: 72px 80px`. Rows sit in their **own container at `gap: 0`** (`:47`), each carrying its
own `padding: 14px 0` and hairline. The question and its answers sit in a container with
**`margin-top: auto`** and an internal `gap: 20px` (`:59`).

Shipped today: one flat column at uniform `gap: 24px`, rows as direct children. So "Did you?" — the
highest-stakes moment in the product — arrives 24px below a grey caveat, in the same rhythm as
everything above it.

**Two deviations from the artboard, both deliberate, both recorded:**

1. **Width stays 1000px, not 880px.** `docs/design.md` §6 already corrected this on 2026-09-16: the
   review shares the ledger's shell. Do not narrow it.
2. **The artboard's step-list (`:31-38`) and its "Drifted twice…" line (`:57`) are not built.**
   PRD-F8's generated task plan is **cut** (ADR-0048/D38) and the drift signal is **deleted**
   (ADR-0057). ADR-0063: the ADR wins, the artboard is stale in exactly those two places. Port the
   layout and the staging; port neither of those elements.

**Why `min-height`.** `margin-top: auto` needs somewhere to push. The artboard is a fixed 1120px
board; the shipped column has no height, so `auto` resolves to zero and does nothing. The shell's
height must therefore be a knowable number.

**Why the wrapper holds both branches.** The answered branch (`page.tsx:91`) replaces the question
with a sentence. If only the question were pinned, answering would make the reply jump up the page at
the exact peak-end moment the review exists for. One wrapper, two contents, one position.

- [ ] **Step 1: Write the failing test**

Append to `e2e/review.spec.ts`:

```ts
// #45. The artboard stages the question (Main.dc.html:59, margin-top:auto); the code listed it.
test('the review stages the question at the bottom of the fold, and keeps rows tight', async ({ context, endedSession }) => {
  const sessionId = await endedSession({
    intention: 'staging test',
    events: [{ kind: 'attention', domain: 'chatgpt.com', seconds: 90, at: new Date().toISOString() }],
  })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/review/${sessionId}`)

  const surface = page.locator('[data-surface="review"]')
  const ask = page.locator('.m-review-ask')
  const [surfaceBox, askBox, shellBox] = await Promise.all([
    surface.boundingBox(), ask.boundingBox(), page.locator('.m-shell').boundingBox(),
  ])

  // The shell's height is a real number, so calc(100dvh - var(--m-shell-h)) is honest.
  expect(shellBox!.height).toBeCloseTo(60, 0)
  // The surface fills the fold, so margin-top:auto has somewhere to push.
  expect(surfaceBox!.height).toBeGreaterThanOrEqual(900 - 60 - 1)
  // And the question group sits at its bottom, not 24px under the last row.
  const askBottom = askBox!.y + askBox!.height
  const surfaceBottom = surfaceBox!.y + surfaceBox!.height
  expect(surfaceBottom - askBottom).toBeLessThanOrEqual(73) // the 72px pad, plus a pixel

  await expect(page.locator('.m-review-rows')).toBeVisible()
})

// The narrow breakpoint. The ledger got one in #7; the review never did.
test('the review does not scroll sideways at 390px', async ({ context, endedSession }) => {
  const sessionId = await endedSession({
    intention: 'a deliberately long intention sentence for the narrow breakpoint',
  })

  const page = await context.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/review/${sessionId}`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/review.spec.ts -g "stages the question"
npx playwright test e2e/review.spec.ts -g "390px"
```

Expected: the first fails on `.m-review-ask` not existing. The second reveals the review's real
gutter at 390px — `padding: 72px 80px` leaves a 230px column. Record whichever way it lands; if it
already passes, keep it as the regression guard for Step 4.

- [ ] **Step 3: Make the shell's height a real number**

`app/globals.css`. Add to the `:root` block that already redefines the font aliases (`:5-9`):

```css
  /* The shell has no artboard (docs/design.md §6 — design/canvas/ holds seven and none of
     them shows navigation), so this number lives here rather than in tokens.css, which
     carries only values lifted from the artboards. Declared as a height rather than derived
     from padding so calc() against it is exact — the landing header does the same at :399. */
  --m-shell-h: 60px;
```

Then in the `.m-shell` rule (`:632`), replace `padding: 20px 80px 18px;` with:

```css
  height: var(--m-shell-h);
  padding: 0 80px;
```

The two mobile overrides that set `padding-left`/`padding-right` are unaffected.

- [ ] **Step 4: Port the artboard's column**

Replace the `[data-surface="review"]` block (`:98-105`):

```css
/* Ported from design/canvas/Main.dc.html:23,47,59. The artboard's step-list (:31) and its
 * "Drifted twice…" line (:57) are NOT ported: PRD-F8's generated plan is cut (ADR-0048) and
 * the drift signal is deleted (ADR-0057), and ADR-0063 makes the ADR right where the canvas
 * is stale. Width stays 1000px, not the artboard's 880 — docs/design.md §6 corrected that on
 * 2026-09-16; the review shares the ledger's shell. */
[data-surface="review"] {
  max-width: 1000px;
  margin: 0 auto;
  padding: 72px 80px;
  display: flex;
  flex-direction: column;
  gap: 40px;
  /* So margin-top:auto below has somewhere to push. The artboard is a fixed 1120px board;
     without a height here `auto` resolves to zero and the staging silently does nothing. */
  min-height: calc(100dvh - var(--m-shell-h));
}

/* The rows are their own group at gap 0 — each already carries 14px of padding and a
 * hairline. As direct children of a 40px column the list falls apart. */
.m-review-rows { display: flex; flex-direction: column; }

/* "Did you?" is the highest-stakes moment in the product and it arrived 24px below a grey
 * caveat, in the same rhythm as everything above it. Staged, not listed.
 *
 * The wrapper holds BOTH outcome branches, not just the question: if only the question were
 * pinned, answering would make the reply jump up the page at exactly the peak-end moment the
 * review exists for. */
.m-review-ask { display: flex; flex-direction: column; gap: 20px; margin-top: auto; }

/* The review had no narrow step at all — 80px gutters leave a 230px column at 390px, the
 * same defect the ledger had before #7. Same remedy, same breakpoint. */
@media (max-width: 700px) {
  [data-surface="review"] { padding: 40px 24px; gap: 28px; }
}
```

- [ ] **Step 5: Group the rows and the ask in the page**

`app/review/[sessionId]/page.tsx`. Replace lines 40-54 (the two row blocks) with:

```tsx
      <div className="m-review-rows">
        {data.topAttention.map((row, i) => (
          <div className="m-row" key={row.domain}>
            <span className="m-row-bar" data-kind={TINTS[i]} />
            <span className="m-row-domain">{row.domain}</span>
            <span className="m-row-figure">{minutes(row.seconds)} min</span>
          </div>
        ))}

        {data.awaySeconds > 0 && (
          <div className="m-row" title="Time not measured — your screen was locked or idle, or you left the browser.">
            <span className="m-row-bar" data-kind="away" />
            <span className="m-row-domain">away</span>
            <span className="m-row-figure">{minutes(data.awaySeconds)} min</span>
          </div>
        )}
      </div>
```

Then wrap the outcome conditional (lines 77-96) in the ask group, leaving every existing comment in
place:

```tsx
      <div className="m-review-ask">
        {data.outcome === 'unanswered' ? (
          <>
            <p className="m-rate">Did you?</p>
            <Answer sessionId={sessionId} />
          </>
        ) : (
          /* …existing comment block, unchanged… */
          <p className="m-sentence">
            {data.outcome === 'yes'
              ? `Good. That's ${toWords(data.finished)} of ${toWords(data.answered)}.`
              : 'Noted. It carries over.'}
          </p>
        )}
      </div>
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx playwright test e2e/review.spec.ts
npx tsc --noEmit
node ~/.agents/skills/impeccable/scripts/detect.mjs --json app/globals.css
```

Expected: every review test passes — including Case Z at `:91`, which asserts the container is still
≤1000px wide.

- [ ] **Step 7: Look at it, in both states and both widths**

```bash
~/.claude/skills/gstack/browse/dist/browse goto http://localhost:3100/review/<id> && \
~/.claude/skills/gstack/browse/dist/browse screenshot
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 http://localhost:3100/review/<id>
```

Four renders: unanswered and answered, at 1440 and 390. **The question and the reply must occupy the
same position** — flip between the two screenshots and confirm nothing jumps. Also confirm the shell
still reads correctly with its new fixed height: 60px against the previous ~57px is a three-pixel
change, and it must not look like a different bar.

- [ ] **Step 8: Update the one stale doc line and commit**

`docs/design.md` §6's review row already carries the width correction. Add the gap to it in the same
cell. Do **not** touch §5's class count — #51.3 is the owner's.

```bash
git add app/globals.css "app/review/[sessionId]/page.tsx" docs/design.md e2e/review.spec.ts
git commit -m "fix(review): stage the question the artboard staged

design/canvas/Main.dc.html:23,47,59 gives the review a 40px column, rows grouped at
gap 0, and question+answers in their own container with margin-top:auto. The code
shipped a flat column at uniform gap 24px, so 'Did you?' arrived 24px below a grey
caveat in the same rhythm as everything above it.

margin-top:auto needs somewhere to push, so .m-shell now declares a height (60px)
rather than deriving one from padding, and the review fills the fold against it.

The wrapper holds both outcome branches, not just the question: pinning only the
question would make the reply jump up the page at the peak-end moment.

Two artboard elements deliberately not ported — its step list and its 'Drifted
twice' line. PRD-F8 is cut (ADR-0048) and the drift signal is deleted (ADR-0057);
ADR-0063 makes the ADR right where the canvas is stale.

Also gives the review the 700px step the ledger got in #7. Its 80px gutters left a
230px column at 390px.

Closes #45"
```

---

## Task 5: Wire the motion the codebase already claims (#48)

**Files:**
- Modify: `app/globals.css:596-616`, `app/review/[sessionId]/page.tsx`
- Test: `e2e/review-motion.spec.ts` (create)

`.m-rise` is defined at `globals.css:596-605` and **used nowhere** — verified across `app` and
`extension`. `docs/design.md` §6 calls the review *"the one page with an authored motion moment
(staggered rise, 50ms steps)"*, `docs/design-toolkit.md` §6 specifies it, and
`design/canvas/Main.dc.html:14-20,25-59` implements it with 0–500ms delays. The shipped review has
zero motion.

**Why CSS and not a helper.** `--m-stagger` is already `50ms` in `tokens.css:50`, and the reduced-
motion block at `:85` already drops it to `0ms`. A `calc()` off an index costs one line and needs no
JavaScript, no unit test, and no second source of truth for the step.

**The reduced-motion branch is not optional.** A staggered entrance without one is a vestibular
trigger, on the product's most important page. Confirm it, do not assume it.

- [ ] **Step 1: Write the failing test**

Create `e2e/review-motion.spec.ts`. It uses the `endedSession` fixture Task 3 added to
`e2e/fixtures.ts` — do not re-open-code the pair-and-start preamble.

```ts
import { test, expect } from './fixtures'

const ONE_ROW = [{ kind: 'attention', domain: 'chatgpt.com', seconds: 90, at: new Date().toISOString() }]

// #48. .m-rise was defined at globals.css:596 and used nowhere.
test('the review staggers its entrance, 50ms a step', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'motion test', events: ONE_ROW })
  const page = await context.newPage()
  await page.goto(`/review/${sessionId}`)

  const risers = page.locator('[data-surface="review"] .m-rise')
  expect(await risers.count()).toBeGreaterThanOrEqual(5)

  const delays = await risers.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).transitionDelay),
  )
  expect(delays[0]).toBe('0s')
  expect(delays[1]).toBe('0.05s')
  expect(delays[2]).toBe('0.1s')
  // Strictly increasing, so nothing shares a step.
  const ms = delays.map((d) => parseFloat(d) * 1000)
  expect(ms.every((v, i) => i === 0 || v > ms[i - 1])).toBe(true)

  // The ask group is last, so the question is the last thing to arrive.
  const askDelay = await page.locator('.m-review-ask').evaluate((el) => getComputedStyle(el).transitionDelay)
  expect(parseFloat(askDelay) * 1000).toBe(Math.max(...ms))
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a staggered entrance is a vestibular trigger, so there is none', async ({ context, endedSession }) => {
    const sessionId = await endedSession({ intention: 'reduced motion test', events: ONE_ROW })
    const page = await context.newPage()
    await page.goto(`/review/${sessionId}`)

    const sentence = page.locator('[data-surface="review"] .m-sentence').first()
    await expect(sentence).toBeVisible()
    expect(await sentence.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s')
    expect(await sentence.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/review-motion.spec.ts
```

Expected: the first fails at `count()` — zero `.m-rise` elements exist anywhere.

- [ ] **Step 3: Give `.m-rise` its step**

In `app/globals.css`, replace the `.m-rise` rule (`:596-605`):

```css
/* ---------- motion: entry ----------
 * The one authored moment in the product (docs/design-toolkit.md §6). The step comes from
 * --m-stagger, which tokens.css already drops to 0ms under prefers-reduced-motion — so the
 * index below needs no branch of its own. */
.m-rise {
  opacity: 1;
  transform: none;
  transition: opacity var(--m-dur-rise) var(--m-ease), transform var(--m-dur-rise) var(--m-ease);
  transition-delay: calc(var(--m-rise-i, 0) * var(--m-stagger));
}
@starting-style { .m-rise { opacity: 0; transform: translateY(8px); } }

@media (prefers-reduced-motion: reduce) {
  .m-rise { transition: none; }
  .m-btn, .m-answer { transition: none; }
}
```

The `translateY(8px)` start, not `scale(0)`, is the existing and correct choice — nothing in the real
world appears from nothing.

- [ ] **Step 4: Index the review's children**

In `app/review/[sessionId]/page.tsx`, immediately inside the component, before the `return`:

```tsx
  // The review's authored entrance (#48). A running counter rather than hard-coded indices
  // because three of the children are conditional — a short-circuited `&&` simply never calls
  // rise(), which is exactly right: the sequence closes up rather than leaving a hole.
  let riseIndex = 0
  // String(), not the bare number: React only skips its automatic `px` suffix for properties it
  // knows, and a custom property is not one of them. `calc(1px * 50ms)` is invalid and fails
  // silently — the whole stagger would flatten to zero with nothing in the console.
  const rise = (extra = '') => ({
    className: extra ? `${extra} m-rise` : 'm-rise',
    style: { '--m-rise-i': String(riseIndex++) } as React.CSSProperties,
  })
```

Then spread `{...rise()}` onto each direct child of the surface, in source order, passing any
existing `className` through the helper:

```tsx
      <p {...rise('m-mark')} data-state="ended" />
      {data.intention ? (
        <>
          <p {...rise('m-meta')}>You meant to</p>
          <p {...rise('m-sentence')}>{data.intention}</p>
        </>
      ) : (
        <p {...rise('m-meta')}>You didn&apos;t say what you meant to do.</p>
      )}
```

`<Band>` renders its own `<p className="m-mark">` (`app/band.tsx:5`) and takes no `className`, so wrap
it rather than change its props:

```tsx
      <div {...rise()}>
        <Band segments={toBand(data.rows as Parameters<typeof toBand>[0])} state={data.endedAt ? 'ended' : 'running'} />
      </div>
```

Then `{...rise()}` on the `.m-review-rows` div (as `rise('m-review-rows')`), on the blocked-attempts
`<p>` (`rise('m-meta')`), on the unrecorded-time `<p>` (`rise('m-meta')`), and finally:

```tsx
      <div {...rise('m-review-ask')}>
```

**Do not** rise the individual `.m-row`s. The artboard staggers them one by one, but they now sit
inside `.m-review-rows`, which rises as a unit — and a per-row stagger under a dynamic row count is a
second source of truth for the same step.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx playwright test e2e/review-motion.spec.ts
npx tsc --noEmit
```

Expected: both pass. If TypeScript rejects the custom property, the `as React.CSSProperties` cast is
missing on that element — it is required for every one of them.

- [ ] **Step 6: Watch it, slowly**

Temporarily raise `--m-dur-rise` to `1400ms` in a devtools override and reload. Check: does anything
arrive out of order, does the question land last, does the band's own segments fight the container's
transform? Put the token back. Then reload at normal speed twice — the second time with the OS set to
reduce motion, and confirm the page simply appears.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css "app/review/[sessionId]/page.tsx" e2e/review-motion.spec.ts
git commit -m "feat(review): wire the motion moment the codebase already claimed

.m-rise was defined at globals.css:596 and used nowhere, while docs/design.md §6,
docs/design-toolkit.md §6 and design/canvas/Main.dc.html:14-20 all describe a
staggered rise on this page. The shipped review had zero motion.

The step is calc(var(--m-rise-i) * var(--m-stagger)) — one line, no JavaScript, and
no second source of truth for the 50ms, since tokens.css:85 already drops --m-stagger
to 0ms under prefers-reduced-motion. Confirmed by test rather than assumed: a
staggered entrance without that branch is a vestibular trigger on the product's most
important page.

Rows rise as one group rather than individually: a per-row stagger under a dynamic
row count would reintroduce the second source of truth.

Closes #48"
```

---

## Task 6: Delete the companion's dead motion and retime its receipt (#50)

**Files:**
- Modify: `extension/companion-overlay.js:87-115,175-178,246-251,347-364`
- Modify: `docs/design.md` §6 companion row, `PRODUCT.md` companion section
- Test: `e2e/companion.spec.ts` (append)

**Three findings, two of them introduced by ADR-0057/0058 last week.**

| Before | After | Why |
| --- | --- | --- |
| `animation: pulse-drift 1.2s ease-out infinite` on `[data-state="drift"]` | delete rule **and** keyframes | Dead. ADR-0057 removed the only code that set `drift`; `applyState` always passes `'focus'` |
| `return-pulse 0.6s` as the tap receipt, 620ms timer | `receipt 160ms`, timer keyed to the mode | 600ms was chosen when it meant *the witness settling after drift* — a moment. ADR-0058 reused it as **feedback for a tap**, and feedback wants 100–160ms. 600ms reads as lag |
| `@media (prefers-reduced-motion) { * { animation: none } }` | a discrete, non-moving receipt | **The tap's only confirmation is an animation.** Reduced-motion users tap and get nothing back — the control reads as dead |
| `if (prev === 'drift' && next === 'focus')` in `applyVisualState` | delete the branch | Unreachable for the same reason as row 1 |
| `ease-out` on the receipt | `var(--m-ease)` | Not in #50, but it is the documented rule: one curve, `cubic-bezier(0.23, 1, 0.32, 1)` (toolkit §6). The rule is already declared on `:host`; the receipt simply was not using it |

**Two things are already right — do not touch.** `--m-ease: cubic-bezier(0.23, 1, 0.32, 1)` is exactly
the recommended strong ease-out. `breathe` uses symmetric `ease-in-out` on an infinite loop, which is
correct; an asymmetric curve would stutter at the seam. **And the hover pill is already 150ms** — #50's
fourth row misread `.ring`'s 220ms as the pill's. `.ring`'s transition now fires only once, at mount.
Leave it.

- [ ] **Step 1: Write the failing test**

Append to `e2e/companion.spec.ts`, inside the existing `test.describe('floating companion', …)`:

```ts
  // #50. The drift rule is dead code (ADR-0057) and the receipt is mistimed (ADR-0058).
  test('carries no drift motion, and acknowledges a tap at feedback speed', async ({ context, extensionId, freshAccount }) => {
    const setupPage = await context.newPage()
    await freshAccount(setupPage)
    await pairAndStart(setupPage, extensionId)

    const page = await context.newPage()
    await page.goto('https://example.com')
    await page.waitForTimeout(400) // let the wake animation settle

    const sheet = await page.locator(HOST_SELECTOR).evaluate(
      (host: any) => host.shadowRoot.querySelector('style').textContent,
    )
    expect(sheet).not.toContain('pulse-drift')
    expect(sheet).not.toContain('data-state="drift"')
    expect(sheet).toContain('animation: receipt var(--m-dur-press) var(--m-ease)')
    expect(sheet).toContain('--m-dur-press: 160ms')

    const host = page.locator(HOST_SELECTOR)
    // The receipt now clears after 180ms, which a round trip can outlive — so watch for the
    // attribute rather than reading it after the fact and hoping to win the race.
    await host.evaluate((h: any) => {
      const wrap = h.shadowRoot.querySelector('.dot-wrap')
      ;(window as any).__receipt = false
      new MutationObserver(() => {
        if (wrap.dataset.returning === 'true') (window as any).__receipt = true
      }).observe(wrap, { attributes: true, attributeFilter: ['data-returning'] })
    })

    const box = (await host.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => page.evaluate(() => (window as any).__receipt), { timeout: 2_000 }).toBe(true)
  })

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the tap still gets a receipt, without moving anything', async ({ context, extensionId, freshAccount }) => {
      const setupPage = await context.newPage()
      await freshAccount(setupPage)
      await pairAndStart(setupPage, extensionId)

      const page = await context.newPage()
      await page.goto('https://example.com')
      await page.waitForTimeout(400)

      const host = page.locator(HOST_SELECTOR)
      const box = (await host.boundingBox())!
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

      // No animation at all, but the ring changes discretely — otherwise the control is dead.
      // Polled, not read once: the static window is 600ms and a round trip can eat into it.
      await expect
        .poll(() =>
          host.evaluate((h: any) => {
            const cs = getComputedStyle(h.shadowRoot.querySelector('.ring'))
            return `${cs.animationName}|${cs.opacity}|${cs.borderTopWidth}`
          }),
        )
        .toBe('none|1|2px')
    })
  })
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/companion.spec.ts -g "drift motion"
npx playwright test e2e/companion.spec.ts -g "without moving anything"
```

Expected: the first fails on `pulse-drift` still being present; the second on the ring's computed
opacity being `0.55`, because `* { animation: none !important; transition: none !important }` erases
the receipt entirely.

- [ ] **Step 3: Declare the missing tokens on `:host`**

`extension/companion-overlay.js:51-61`. This file redeclares tokens on `:host` because the host page's
`:root` has none to inherit — add the two it now needs:

```js
    :host {
      --m-ground: #F3F1EE;
      --m-clay: #C75B39;
      --m-ease: cubic-bezier(0.23, 1, 0.32, 1);
      --m-dur-press: 160ms;
      --m-stroke-loud: 2px;
      all: initial;
```

- [ ] **Step 4: Delete the drift rule and retime the receipt**

Replace lines 87-115:

```js
    /* .ring — presence tells the state. Never a colour change (an orbit that changes hue
     * reads as a status light, not a witness). ADR-0057 deleted the drift signal, so while a
     * session runs there is exactly ONE state: solid, present, breathing. The dashed variant
     * and its pulse were kept unreferenced for a week after that and are now gone —
     * applyState() has only ever passed 'focus' since. */
    .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1.5px solid var(--m-clay);
      opacity: 0;
      transition: opacity 220ms var(--m-ease);
    }
    .dot-wrap[data-state="focus"] .ring { opacity: 0.55; }

    /* The receipt for the one-tap label (ADR-0058). It is ADR-0026's return-pulse motion,
     * freed when the drift signal went — but NOT its duration: 0.6s was chosen when this
     * meant the witness settling after drift, which is a moment. As feedback for a tap it
     * belongs in the 100-160ms press band, and 600ms reads as lag. */
    .dot-wrap[data-returning="true"] .ring {
      opacity: 1;
      border-style: solid;
      animation: receipt var(--m-dur-press) var(--m-ease);
    }
    @keyframes receipt {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
```

- [ ] **Step 5: Give reduced motion a receipt that does not move**

Replace lines 175-177:

```js
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
      /* Reduced motion means fewer and gentler animations, not none at all — and the tap's
       * ONLY confirmation was an animation, so this block used to leave the control looking
       * dead. A discrete state change instead: the ring goes fully opaque and thickens for
       * the receipt window, then returns. Nothing moves, nothing fades. */
      .dot-wrap[data-returning="true"] .ring {
        opacity: 1;
        border-width: var(--m-stroke-loud);
      }
    }
```

- [ ] **Step 6: Key the timer to the mode**

Replace `playReceipt` (lines 246-251):

```js
// Two windows, because the two receipts are different things. The animated one must clear as
// soon as it has played, or [data-returning] lingers as a visible opacity change long after
// the motion ended. The static one must be held long enough to be *seen*, since it neither
// moves nor fades.
const RECEIPT_ANIMATED_MS = 180
const RECEIPT_STATIC_MS = 600

function receiptWindow() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
    ? RECEIPT_STATIC_MS
    : RECEIPT_ANIMATED_MS
}

function playReceipt() {
  if (!dot) return
  dot.dataset.returning = 'true'
  clearTimeout(returnTimer)
  returnTimer = setTimeout(() => { if (dot) dot.dataset.returning = 'false' }, receiptWindow())
}
```

- [ ] **Step 7: Delete the unreachable branch**

Replace `applyVisualState` (lines 347-364):

```js
// ADR-0057 removed the drift signal, so a running session has exactly one visual state: a
// solid, breathing ring. The drift->focus branch that used to live here was unreachable —
// applyState() has only ever passed 'focus'. Its motion survives, with a new meaning and a
// new duration, as the receipt in playReceipt() (ADR-0058).
function applyVisualState(next) {
  if (!dot) return
  dot.dataset.state = next
}
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npx playwright test e2e/companion.spec.ts
npm test
grep -n "pulse-drift\|return-pulse\|0.6s" extension/companion-overlay.js   # must print nothing
```

Expected: every companion spec passes, the 149 unit tests still pass, the grep silent. If a companion
spec was already failing at Task 0's baseline, compare against that baseline, not against zero.

- [ ] **Step 9: Reconcile the two documents that state the old duration**

Both now say something false. **The ADR is right; these are stale (ADR-0063).**

- `docs/design.md` §6, companion row: *"the 0.6s ring-collapse now fires only as the receipt for a
  tap"* → 160ms, and note the reduced-motion receipt.
- `PRODUCT.md`, "The companion, specifically": *"The 0.6s ring-collapse acknowledges the tap."* →
  160ms. `PRODUCT.md` is derived from `docs/prd-intent.md`; check whether that file carries the same
  sentence and fix it there first if so.
- `CLAUDE.md` says *"acknowledged by a 0.6s ring-collapse"*. Same correction.

- [ ] **Step 10: Commit**

```bash
git add extension/companion-overlay.js docs/design.md PRODUCT.md CLAUDE.md e2e/companion.spec.ts
git commit -m "fix(companion): delete the dead drift motion, retime the receipt

Three findings, two of them introduced by ADR-0057/0058 last week.

pulse-drift and its [data-state=drift] rule were dead: ADR-0057 removed the only
code that set drift, and applyState() has only ever passed 'focus' since. The
drift->focus branch in applyVisualState was unreachable for the same reason.

The 0.6s ring-collapse was chosen when it meant the witness settling after drift,
which is a moment. ADR-0058 reused it as feedback for a tap, and feedback belongs in
the 100-160ms press band; 600ms reads as lag.

And the reduced-motion block erased the tap's only confirmation, so those users
tapped and got nothing back. Reduced motion means gentler, not none: the ring now
goes opaque and thickens for the receipt window without moving or fading.

Left alone deliberately: --m-ease is already the right curve, breathe is correctly
symmetric on an infinite loop, and the hover pill is already 150ms — #50's fourth
row misread .ring's 220ms mount transition as the pill's.

Closes #50"
```

---

## Task 7: The accessibility floor (#49)

**Files:**
- Modify: `app/auth-form.tsx`, `app/layout.tsx:21-23`, `app/page.tsx:57`, `app/sign-in/page.tsx:12`,
  `app/globals.css:193`
- Modify: `e2e/fixtures.ts:47-49`
- Test: `e2e/a11y.spec.ts` (create)

**What is actually missing**, measured 2026-09-16 (#49's own counts are stale — see Global Constraints):

- `<label>` = **0**. Sign-in has five inputs and no labels, two sharing the placeholder "Email", with
  no headings to tell the two forms apart.
- Placeholder contrast **3.20:1 at 15px** (`--m-ink-3` on `--m-ground`), under the 4.5:1 floor. And a
  placeholder disappears exactly when the user is typing and needs it.
- `/` and `/sign-in` have **no `<main>`** — no skip target, no structure. The four signed-in surfaces
  got one from the shell layouts.
- `layout.tsx:21-23` sets `title: 'meant'` and nothing else. No description, no OG, no
  `metadataBase` — a shared link previews as one word and a bare URL, on a product whose landing page
  is its only persuasion surface.

**Copy constraint:** the description must come from the landing's existing prose. Do not invent a new
proposition, and **do not reuse `app/page.tsx:109`** — ADR-0061 made *"It reads the page"* false.

- [ ] **Step 1: Write the failing test**

Create `e2e/a11y.spec.ts`:

```ts
import { test, expect } from './fixtures'

test('every auth input has a real label, and the two forms are distinguishable', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/sign-in')

  expect(await page.locator('input').count()).toBe(5)
  expect(await page.locator('label').count()).toBe(5)

  const signIn = page.getByRole('form', { name: 'Sign in' })
  const signUp = page.getByRole('form', { name: 'Create an account' })
  await expect(signIn.getByLabel('Email')).toBeVisible()
  await expect(signUp.getByLabel('Email')).toBeVisible()
  await expect(signUp.getByLabel('Name')).toBeVisible()
})

test('the public surfaces have a main landmark', async ({ context }) => {
  const page = await context.newPage()
  for (const path of ['/', '/sign-in']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toHaveCount(1)
  }
})

test('a shared link previews as more than one word', async ({ context }) => {
  const page = await context.newPage()
  await page.goto('/')
  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description).toBeTruthy()
  expect(description!.length).toBeGreaterThan(20)
  // ADR-0061: no page text or title is ever read. The old landing claim must not resurface here.
  expect(description!.toLowerCase()).not.toContain('reads the page')
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1)
})
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx playwright test e2e/a11y.spec.ts
```

Expected: all three fail — zero labels, zero `main` on the public routes, no description meta.

- [ ] **Step 3: Give the fields real labels**

Replace `app/auth-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { signIn, signUp } from './auth-actions'

/** #49. Five inputs, no labels, and two of them shared the placeholder "Email" — which is not
 *  a label, is announced inconsistently, and disappears exactly when the user is typing and
 *  needs it. The placeholders are gone rather than duplicated: at 3.20:1 they were under the
 *  contrast floor anyway. */
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span className="m-meta">{label}</span>
      <input className="m-field" {...props} />
    </label>
  )
}

function Fields() {
  return (
    <>
      <Field label="Email" name="email" type="email" required />
      <Field label="Password" name="password" type="password" required minLength={8} />
    </>
  )
}

export function AuthForm() {
  const [signInState, signInAction, signingIn] = useActionState(signIn, null)
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, null)

  return (
    <>
      {/* Both forms carry the same two field labels, so the accessible name of the FORM is what
          tells them apart for anyone not reading the buttons. */}
      <form action={signInAction} aria-label="Sign in">
        <Fields />
        <button className="m-btn" data-variant="primary" disabled={signingIn}>
          Sign in
        </button>
        {signInState?.error && <p className="m-meta" role="alert">{signInState.error}</p>}
      </form>

      <p className="m-meta">or</p>

      <form action={signUpAction} aria-label="Create an account">
        <Field label="Name" name="name" type="text" required />
        <Fields />
        <button className="m-btn" data-variant="quiet" disabled={signingUp}>
          Create an account
        </button>
        {signUpState?.error && <p className="m-meta" role="alert">{signUpState.error}</p>}
      </form>
    </>
  )
}
```

- [ ] **Step 4: Lay the labels out, and raise the remaining placeholders**

In `app/globals.css`, beside the `.m-field` rules (`:181-194`):

```css
/* Scoped with :has so a real <label> gets its layout without a 14th class name. */
label:has(> .m-field) { display: flex; flex-direction: column; gap: 6px; }
label:has(> .m-field) > .m-meta { color: var(--m-ink-2); }
```

And change line 193 — `/setup` and the popup still use placeholders as genuine hints, and 3.20:1 is
under the floor wherever it appears:

```css
.m-field::placeholder { color: var(--m-ink-2); font-family: var(--m-body); font-size: 15px; }
```

- [ ] **Step 5: Update the fixture that typed into the placeholders**

`e2e/fixtures.ts:47-49`. Every other spec locates popup fields by `input.m-field`; only this one used
placeholders.

```ts
      const signupForm = page.getByRole('form', { name: 'Create an account' })
      await signupForm.getByLabel('Name').fill('E2E Test')
      await signupForm.getByLabel('Email').fill(email)
      await signupForm.getByLabel('Password').fill(password)
      await signupForm.getByRole('button', { name: 'Create an account' }).click()
```

Then confirm nothing else depended on them:

```bash
grep -rn "getByPlaceholder('Email'\|getByPlaceholder('Password'\|getByPlaceholder('Name'" e2e
```

Expected: nothing. `e2e/error-surfaces.spec.ts` from Task 1 uses `getByPlaceholder` on the sign-in
form — **update it to `getByLabel` in this step**, scoped by `getByRole('form', { name: 'Sign in' })`.

- [ ] **Step 6: Add the landmarks**

`app/page.tsx:57` — change the outer element, nothing else:

```tsx
    <main data-surface="landing">
```

and its closing tag at the end of the component. The `<header>` stays where it is; it becomes `main`'s
own header rather than a page banner. That trades the `banner` role for the `main` landmark and the
skip target, which is the one the page had none of.

`app/sign-in/page.tsx:12`:

```tsx
    <main data-surface="pair">
```

Both selectors are attribute-based (`[data-surface="landing"]`), so no CSS changes.

- [ ] **Step 7: Give a shared link something to show**

Replace `app/layout.tsx:21-23`:

```tsx
// The description is the landing page's own lede (app/page.tsx:82), verbatim — it is the
// strongest writing in the product and #49 is explicit that nothing new is invented here.
// Deliberately NOT the "It reads the page" section: ADR-0061 made that claim false.
const DESCRIPTION = 'Say what you mean. It knows if you did.'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'meant',
  description: DESCRIPTION,
  openGraph: {
    title: 'meant',
    description: DESCRIPTION,
    type: 'website',
  },
}
```

No OG image: none exists in `design/`, and inventing one is not this task's job. Note it in the commit.

- [ ] **Step 8: Run everything**

```bash
npx playwright test
npm test
npx tsc --noEmit
node ~/.agents/skills/impeccable/scripts/detect.mjs --json app/globals.css
```

Expected: the whole suite green against Task 0's baseline. **`e2e/fixtures.ts` is used by every spec
in the suite — a mistake in Step 5 fails all of them, so run the full suite here, not one file.**

- [ ] **Step 9: Look at it**

Render `/sign-in` at 1440 and 390. The two forms now carry five visible labels where there were none —
confirm the page has not become a form wall, that the labels read as labels and not as prose, and that
`--m-ink-2` labels sit correctly against both grounds.

- [ ] **Step 10: Commit**

```bash
git add app/auth-form.tsx app/layout.tsx app/page.tsx app/sign-in/page.tsx app/globals.css \
        e2e/fixtures.ts e2e/a11y.spec.ts e2e/error-surfaces.spec.ts
git commit -m "fix(web): the accessibility floor

Five inputs on /sign-in had no labels, two of them sharing the placeholder 'Email',
with nothing to tell the two forms apart. Placeholders are not labels: they are
announced inconsistently, they disappear exactly when the user is typing, and at
3.20:1 they were under the contrast floor. Real labels now, the duplicated
placeholders dropped, each form named, and the remaining placeholders on /setup and
the popup lifted to --m-ink-2.

/ and /sign-in had no main landmark, so no skip target and no structure — the four
signed-in surfaces got theirs from the shell layouts last week.

And layout.tsx set a title of one word and nothing else, so a shared link previewed
as 'meant' and a bare URL on a product whose landing page is its only persuasion
surface. The description is the landing lede verbatim, not the 'It reads the page'
section, which ADR-0061 made false. No OG image: none exists, and inventing one is
not this change.

Closes #49"
```

---

## Task 8: Write the dark-mode decision down (#51.1)

**Files:**
- Create: `docs/adr/ADR-0065-meant-is-a-cream-product-dark-is-a-fallback.md`
- Modify: `docs/design-toolkit.md` §9, `docs/design.md` §3.1, `design/tokens.css:54`

**ADR-0063: a decision not in `docs/adr/` has not been made.** The owner decided on 2026-09-16 that
MEANT is a cream product and the dark palette is a fallback, not a second look. Until it is an ADR it
does not exist, and `docs/design-toolkit.md` §9 still carries a note calling the shipped token file a
violation.

This closes **part 1 of #51 only**. Parts 2 (the landing hero asks for nothing) and 3 (13 classes vs
15) stay open, and Task 4 added two more structural class names without resolving part 3.

- [ ] **Step 1: Write the ADR**

```markdown
# ADR-0065 — MEANT is a cream product; dark is a fallback, not a second look

**Status:** accepted · **Date:** 2026-09-16 · **Supersedes:** nothing · **Closes:** #51 part 1

## Context

`design/tokens.css:54` applies the full dark palette from `prefers-color-scheme: dark`. Nothing
anywhere sets `data-theme`, so on a dark OS — a large share of this audience — MEANT *is* dark and
the user cannot say otherwise.

Two documents said that could not happen. `docs/design-toolkit.md` §9 refuses "dark mode as the
default look" and `docs/design.md` §3.1 says "nothing renders dark by default". Both were false for
any user on a dark OS, and had been for weeks.

It renders correctly. But it arrived by inheritance rather than by choice, and it is near-black —
the exact Rize anti-reference. The question was whether MEANT is a cream product with a dark
fallback, or a product with two equal looks.

## Decision

**A cream product.** `--m-ground: #F3F1EE` is the product's ground. The dark palette is a
**fallback** for a user whose OS asks for one — correct, maintained, and never the reference. Where
the two disagree about how something should look, the cream palette is the answer and the dark one
follows it.

The `data-theme` hooks already in `tokens.css` (`:54`, `:70`) stay. They are what makes a future
explicit toggle possible without touching a single component. No toggle ships now.

## Consequences

- `docs/design-toolkit.md` §9's refusal stands, and its violation note is removed: shipping a dark
  fallback is not "dark mode as the default look".
- `docs/design.md` §3.1's "nothing renders dark by default" is **amended**, not deleted — it was
  describing an intention the code contradicted.
- Every artboard in `design/canvas/` stays cream. A dark artboard would make the fallback a
  reference, which is what this decision refuses.
- Design review judges the cream rendering first. The dark one must be correct, not equal.
- Re-opening this means shipping a `data-theme` toggle and a persistence story, and the class
  contract question (#51 part 3) would want settling first.
```

- [ ] **Step 2: Amend the two stale documents**

`docs/design-toolkit.md` §9 — delete the blockquote that begins *"The first item is currently
violated by the shipped token file"* and replace it with:

```markdown
> **Settled 2026-09-16 (ADR-0065).** MEANT is a cream product; the dark palette at
> `design/tokens.css:54` is a *fallback* for a user whose OS asks for one, not a second look.
> Shipping a correct fallback is not "dark mode as the default look" — the refusal below stands.
```

`docs/design.md` §3.1 — amend *"nothing renders dark by default"* in place, in the file's own
strike-through-and-correct idiom, pointing at ADR-0065.

- [ ] **Step 3: Say so in the token file**

Above `design/tokens.css:54`:

```css
/* ADR-0065 — a FALLBACK, not a second look. The cream palette above is the product; this
 * block keeps a dark-OS user correct and is never the reference. The data-theme hooks exist
 * so an explicit toggle can be added later without touching a component; none ships today. */
```

- [ ] **Step 4: Verify nothing else still claims the old position**

```bash
grep -rn "nothing renders dark\|dark mode as the default" docs PRODUCT.md CLAUDE.md
```

Every remaining hit must either be the amended text or point at ADR-0065.

- [ ] **Step 5: Commit**

```bash
git add docs/adr/ADR-0065-meant-is-a-cream-product-dark-is-a-fallback.md \
        docs/design-toolkit.md docs/design.md design/tokens.css
git commit -m "docs(adr): ADR-0065 — MEANT is a cream product, dark is a fallback

design/tokens.css:54 has applied the full dark palette from prefers-color-scheme for
weeks, while design-toolkit.md §9 refused 'dark mode as the default look' and
design.md §3.1 said 'nothing renders dark by default'. Both were false for any user
on a dark OS.

Settled: a cream product with a correct dark fallback. The data-theme hooks stay so
a future toggle costs no component change; no toggle ships now. Both documents
amended rather than deleted — they were describing an intention the code contradicted.

Part 1 of #51 only. Parts 2 and 3 remain open."
```

---

## Closing the loop

- [ ] **Full suite, once, from clean**

```bash
npm test                 # expect 149, 0 failures
npx tsc --noEmit         # expect 0 errors
npx playwright test      # compare against Task 0 Step 7's recorded baseline
node ~/.agents/skills/impeccable/scripts/detect.mjs --json app/globals.css design/tokens.css
```

- [ ] **Confirm production is still untouched** — re-run Task 0 Step 8's read-only count. Equal, or stop.

- [ ] **Merge.** REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`. The `Closes #NN`
  lines fire only on merge to the default branch — the seven issues stay open until then.

- [ ] **Say what is left.** #51 parts 2 and 3, the stale landing privacy claim at `app/page.tsx:109`,
  and anything Task 0's baseline showed already failing.

---

## Self-review

**Spec coverage.** #42 → Task 2. #45 → Task 4. #46 → Task 1. #47 → Task 3. #48 → Task 5. #49 → Task 7.
#50 → Task 6. #51.1 → Task 8. The e2e prerequisite → Task 0. Nothing in the chosen scope is unassigned.

**Type consistency.** `[role="alert"]` is defined once (Task 1 Step 3) and consumed by Tasks 2, 3 and 7.
`--m-shell-h` is defined once (Task 4 Step 3) and consumed once (Task 4 Step 4) and asserted once
(Task 4 Step 1). `--m-rise-i` is defined in CSS (Task 5 Step 3) and set in JSX (Task 5 Step 4).
`.m-review-ask` is created in Task 4 and given a rise index in Task 5. `receiptWindow()` is defined and
used only in Task 6 Step 6. `e2e/fixtures.ts`'s `freshAccount` changes in Task 7 Step 5 and is used by
every spec — flagged in that step.

**Ordering.** Task 1 must precede 2, 3 and 7 (the alert treatment). Task 4 must precede 5 (the rise
indices are computed against the post-Task-4 DOM). Task 0 must precede everything that renders.

**Known risks.**
- `.m-shell`'s height moves from ~57px to a declared 60px. Three pixels, verified by screenshot in
  Task 4 Step 7, asserted in Task 4 Step 1.
- `<main data-surface="landing">` puts the site header inside `main`, trading the `banner` role for
  the `main` landmark. Deliberate; the page had neither, and `main` is the one that carries a skip
  target.
- `@starting-style` needs Chrome 117+. The product is Chrome and Edge only (`PRODUCT.md`), and the
  artboard already relies on it.
- `--m-rise-i` must be passed as a **string**. React appends `px` only to properties it knows, but
  the failure mode if it ever did is silent: `calc(1px * 50ms)` is invalid, the delay resolves to
  zero, and the stagger flattens with nothing in the console. Task 5 Step 1's test catches it.
- Task 0 Step 7 may find pre-existing failures in `e2e/companion.spec.ts`, written before ADR-0057.
  They are recorded as a baseline, not silently fixed.
- Task 6 changes the receipt's curve from `ease-out` to `var(--m-ease)`. Not requested by #50, but it
  is toolkit §6's one-curve rule and the token is already on `:host`.
