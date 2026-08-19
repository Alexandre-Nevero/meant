# Review and Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A finished session shows the intention beside where the time actually went, asks one question, and accumulates into a ledger counted in outcomes rather than hours.

**Architecture:** The review is a server component running one `group by kind, domain`; a small client component owns the two answer buttons and calls `PATCH /api/sessions/:id/outcome` with the Clerk session. The dashboard is a second server component with one query plus a counts query. The extension opens the review when a session ends.

**Tech Stack:** Next.js 16.3.1 App Router · `@clerk/nextjs` 7 · `@neondatabase/serverless` raw SQL · MV3 extension, plain ES modules.

## Global Constraints

- **`Yes` and `Not yet` are identical** — same element, same classes, same behavior, differing only in `data-answer`. No colour, weight, size, ordering emphasis, icon, or animation distinguishes them. No celebration on either. This is the product's argument, not styling.
- **Never force an answer.** Dismissal leaves `outcome = 'unanswered'` (E5, A3).
- **No total-hours figure as a headline anywhere.** Per-session duration is required by US-05 and is fine. An aggregate hours number is not.
- **Nothing after `Not yet` may encourage, explain where the time went, imply failure, or use an exclamation mark** (design-toolkit §8).
- **INV-6** — every query filters on the Clerk `user_id`. Another user's row returns 404, never 403.
- **Copy is verbatim from design-toolkit §8.** `Did you?` · `Yes` · `Not yet` · `Good. That's N of M.` · `Noted. It carries over.` · `Nothing here yet. Finish something and it will be.` Do not improve, expand, or re-voice these.
- **NO test framework** (build.md §1). Verification is real command output and real browser observation.
- **Class vocabulary**, fixed, shared with a parallel design session: `.m-app`, `.m-mark[data-state]` (idle|running|drifting|ended|empty), `.m-sentence` (the user's intention, and nothing else), `.m-meta`, `.m-field`, `.m-btn[data-variant]`, `.m-answer[data-answer]` (yes|not-yet), `.m-row`, `.m-row-domain`, `.m-row-bar[data-kind]` (attention|away), `.m-row-figure`, `.m-rate`, `.m-empty`. Never invent or rename one.
- **No `style` attribute, no hardcoded colour, no CSS file.** `design/**` and `app/globals.css` are another session's lane and are still empty — every surface renders unstyled. That is expected and is not a defect to fix.
- **User text is text** — JSX auto-escapes; never `dangerouslySetInnerHTML`.
- **Never paste a credential into a report or a doc.** Redact to shape, never value.

---

### Task 1: The review and the outcome

**Files:**
- Create: `app/api/sessions/[id]/outcome/route.ts`
- Create: `app/review/[sessionId]/page.tsx`
- Create: `app/review/[sessionId]/answer.tsx`

**Interfaces:**
- Consumes: `sql` from `@/lib/db`; `auth` from `@clerk/nextjs/server`.
- Produces: `PATCH /api/sessions/:id/outcome` → `{ ok: true }` | 400 | 401 | 404. Task 3's `sw.js` opens `/review/<sessionId>`.

`/api/sessions/:id/outcome` is inside the Clerk proxy matcher (verified in build 2 — `api/sessions/[^/]+$` cannot span the extra slash), so `auth()` has context there. Do not touch `proxy.ts`.

- [ ] **Step 1: Write `app/api/sessions/[id]/outcome/route.ts`**

The UUID guard matters: without it a junk id reaches Postgres, raises `22P02`, and returns a 500 that tells an attacker the id was malformed rather than simply not theirs.

```ts
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
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

- [ ] **Step 2: Write `app/review/[sessionId]/answer.tsx`**

Both buttons are the same element with the same class. The only difference is `data-answer` and the label. Do not add a variant, an icon, an ordering hint, or a disabled-state difference between them.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Answer({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)

  async function answer(outcome: 'yes' | 'no') {
    setSending(true)
    await fetch(`/api/sessions/${sessionId}/outcome`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome }),
    })
    router.refresh()
  }

  return (
    <div className="m-row">
      <button className="m-answer" data-answer="yes" disabled={sending} onClick={() => answer('yes')}>
        Yes
      </button>
      <button className="m-answer" data-answer="not-yet" disabled={sending} onClick={() => answer('no')}>
        Not yet
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write `app/review/[sessionId]/page.tsx`**

One `group by kind, domain` produces every row. The gap label is total away time — categories were cut, so an on-task/drift split cannot be computed honestly.

```tsx
import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { Answer } from './answer'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function minutes(seconds: number) {
  return Math.round(seconds / 60)
}

export default async function Review({ params }: { params: Promise<{ sessionId: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const { sessionId } = await params
  if (!UUID.test(sessionId)) notFound()

  const [session] = await sql`
    select id, intention, outcome, started_at, ended_at
      from session where id = ${sessionId} and user_id = ${userId}`
  if (!session) notFound()

  const rows = await sql`
    select kind, domain, coalesce(sum(seconds), 0)::int as seconds, count(*)::int as hits
      from event where session_id = ${sessionId}
     group by kind, domain
     order by seconds desc`

  const attention = rows.filter((r) => r.kind === 'attention' && r.domain)
  const awaySeconds = rows
    .filter((r) => r.kind === 'away')
    .reduce((total, r) => total + r.seconds, 0)
  const blocked = rows
    .filter((r) => r.kind === 'block_hit')
    .reduce((total, r) => total + r.hits, 0)

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session where user_id = ${userId}`

  return (
    <>
      <p className="m-mark" data-state="ended" />
      {session.intention ? (
        <>
          <p className="m-meta">You meant to</p>
          <p className="m-sentence">{session.intention}</p>
        </>
      ) : (
        <p className="m-meta">You didn&apos;t say what you meant to do.</p>
      )}

      {attention.map((row) => (
        <div className="m-row" key={row.domain}>
          <span className="m-row-domain">{row.domain}</span>
          <span className="m-row-bar" data-kind="attention" />
          <span className="m-row-figure">{minutes(row.seconds)} min</span>
        </div>
      ))}

      {awaySeconds > 0 && (
        <div className="m-row">
          <span className="m-row-domain">away</span>
          <span className="m-row-bar" data-kind="away" />
          <span className="m-row-figure">{minutes(awaySeconds)} min</span>
        </div>
      )}

      <p className="m-meta">off by {minutes(awaySeconds)} min</p>
      {blocked > 0 && <p className="m-meta">{blocked} blocked attempts</p>}

      {session.outcome === 'unanswered' ? (
        <>
          <p className="m-meta">Did you?</p>
          <Answer sessionId={session.id} />
        </>
      ) : (
        <p className="m-meta">
          {session.outcome === 'yes'
            ? `Good. That's ${counts.finished} of ${counts.answered}.`
            : 'Noted. It carries over.'}
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 4: Verify ownership and the malformed-id guard**

Seed a session owned by a different user, then confirm both failure shapes. Run:

```bash
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
;(async () => {
  const [d] = await sql\`insert into device (user_id, token_hash) values ('user_someone_else','hash_review_check') returning id\`
  const [s] = await sql\`insert into session (user_id, device_id, intention, started_at) values ('user_someone_else', \${d.id}, 'not yours', now()) returning id\`
  console.log('foreign session:', s.id)
})()
"
```

Then, signed in as yourself in the browser, open `/review/<that id>` and `/review/not-a-uuid`.
Expected: **404 for both**, never 403, never a 500 stack. Record the foreign session id in the report — a human runs the browser half, so state plainly that you did not.

- [ ] **Step 5: Verify the outcome route end to end**

```bash
curl -s -o /dev/null -w 'no-clerk-session:%{http_code}\n' -X PATCH \
  localhost:3000/api/sessions/00000000-0000-0000-0000-000000000000/outcome \
  -H 'content-type: application/json' -d '{"outcome":"yes"}'
```

Expected: `401` — proving the route is inside the Clerk matcher and the extension can never write an outcome.

- [ ] **Step 6: Clean up the seeded rows**

```bash
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
;(async () => {
  await sql\`delete from session where user_id = 'user_someone_else'\`
  await sql\`delete from device where user_id = 'user_someone_else'\`
  console.log('cleaned')
})()
"
```

Leave the rows in place ONLY if the human has not yet run the browser 404 check; say which you did in the report.

- [ ] **Step 7: Commit**

```bash
npx tsc --noEmit
git add app/review app/api/sessions/\[id\]/outcome
git commit -m "feat: session review with per-domain rows and the outcome question"
```

---

### Task 2: The ledger

**Files:**
- Modify: `app/dashboard/page.tsx` (currently build 1's empty-state-only page)

**Interfaces:**
- Consumes: `sql`, `auth`. Produces nothing other tasks read.

The empty state's string is already correct and comes from design-toolkit §8 — keep it exactly as it is.

- [ ] **Step 1: Rewrite `app/dashboard/page.tsx`**

Completion rate is the only headline. There is no total-hours figure, and adding one later is a spec violation, not a feature.

```tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'

function durationMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) return null
  return Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
}

export default async function Dashboard() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const sessions = await sql`
    select s.id, s.intention, s.started_at, s.ended_at, s.outcome,
           (select e.domain from event e
             where e.session_id = s.id and e.kind = 'attention' and e.domain is not null
             group by e.domain order by sum(e.seconds) desc limit 1) as top_domain
      from session s
     where s.user_id = ${userId}
     order by s.started_at desc
     limit 50`

  if (sessions.length === 0) {
    return (
      <div className="m-empty">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
      </div>
    )
  }

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session where user_id = ${userId}`

  return (
    <>
      <p className="m-rate">{counts.finished} of {counts.answered} finished</p>

      {sessions.map((session) => {
        const minutes = durationMinutes(session.started_at, session.ended_at)
        return (
          <div className="m-row" key={session.id}>
            <p className="m-mark" data-state="ended" />
            {session.intention ? (
              <Link className="m-sentence" href={`/review/${session.id}`}>
                {session.intention}
              </Link>
            ) : (
              <Link className="m-meta" href={`/review/${session.id}`}>
                No intention given
              </Link>
            )}
            <span className="m-meta">{minutes == null ? 'running' : `${minutes} min`}</span>
            <span className="m-row-domain">{session.top_domain ?? '—'}</span>
            <span className="m-meta">
              {session.outcome === 'yes' ? 'Yes' : session.outcome === 'no' ? 'Not yet' : 'Unanswered'}
            </span>
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Verify the rate arithmetic against real rows**

```bash
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
sql\`select outcome, count(*)::int from session group by outcome\`.then(r => console.log(r))
"
```

Expected: the dashboard's `N of M` matches `yes` over (`yes` + `no`) for your user, with `unanswered` excluded from the denominator. Paste both the query output and what the page rendered.

- [ ] **Step 3: Verify no hours headline crept in**

```bash
grep -niE 'total|hours|hrs' app/dashboard/page.tsx || echo "no hours figure in the ledger"
```

Expected: the "no hours figure" line. A hit means PRD-F5 was violated.

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit
git add app/dashboard/page.tsx
git commit -m "feat: ledger counted in outcomes, not hours"
```

---

### Task 3: The extension opens the review

**Files:**
- Modify: `extension/sw.js`

**Interfaces:**
- Consumes: `apiBase` from `./api.js` (already exported); `endSession` as it stands today.
- Produces: nothing.

**INV-3 is not to be disturbed.** The tab opens *after* the existing `finally` has removed rules, cleared the alarm, and cleared storage — never before, and never inside the `finally`.

- [ ] **Step 1: Import `apiBase` alongside `post` in `extension/sw.js`**

```js
import { post, apiBase } from './api.js'
```

- [ ] **Step 2: Open the review after cleanup in `endSession`**

A `recovered` session ends during browser startup and a `superseded` one ends because another just began — opening tabs then is noise, not a review.

```js
  } finally {
    await removeAllRules()
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null })
  }

  if (endReason === 'stopped' || endReason === 'elapsed') {
    try {
      const base = await apiBase()
      await chrome.tabs.create({ url: `${base}/review/${session.sessionId}` })
    } catch {
      // A failed tab open must not make a cleanly ended session look failed.
    }
  }

  return { ok: true }
```

- [ ] **Step 3: Verify INV-1 and INV-3 still hold**

```bash
node --check extension/sw.js
grep -nE 'setInterval|setTimeout' extension/sw.js || echo "no timers in sw.js"
grep -n -A4 'finally' extension/sw.js
```

Expected: parses; no timers; `removeAllRules()` still the first statement in the `finally`, with `chrome.tabs.create` outside it.

- [ ] **Step 4: Commit**

```bash
git add extension/sw.js
git commit -m "feat: open the review when a session ends"
```

---

### Task 4: Close the build

**Files:**
- Modify: `docs/build.md` (§3, §5, §10, §11)
- Modify: `docs/build-intent.md` (§7)

- [ ] **Step 1: Record the two amendments in §11**

- `app/review/[sessionId]/answer.tsx` joins §3's file list: the two answer buttons need a client boundary, and the page stays a server component.
- `sw.js` opens the review for `stopped` and `elapsed` only — a `recovered` session ends during browser startup and a `superseded` one because another just began. The tab opens after cleanup, so INV-3 is untouched.
- The review's gap label is total away time. §9's sample derives it from an on-task/drift split, but build-intent §3 cut categories, so that split cannot be computed honestly. `away` is a recorded event kind, not a judgment about a domain.
- `You didn't say what you meant to do.` is invented copy for the empty-intention case, in design-toolkit §8's voice, flagged for the design session to ratify. US-01 makes empty intentions legal and A2 needs them counted.

- [ ] **Step 2: Add `app/review/[sessionId]/answer.tsx` to §3's repo layout**

Update the file count sentence beneath the tree if it names a number.

- [ ] **Step 3: Flip §5 statuses**

TASK-008 and TASK-009 to done once Tasks 1–3 are verified. TASK-010 stays open until the human has run the release-blocking checks.

- [ ] **Step 4: Fill §10 with facts only**

The 401 checks, the SQL outputs, and the greps are real evidence. **T1, T2, T4, T7 and the demo rehearsal are human-only and must be recorded as outstanding, never as passing, until a human runs them.**

- [ ] **Step 5: Record cuts in build-intent §7**

Every cut with what it cost. If nothing was cut, say that. Do not invent hand-timed minutes for an agent-assisted build — state how it actually ran, as the earlier rows do.

- [ ] **Step 6: Commit**

```bash
git add docs/build.md docs/build-intent.md
git commit -m "docs: close the build, record review and ledger amendments"
```

---

## The human checklist (TASK-010 — nobody here can run these)

No agent in this session has a browser or a Clerk session. These four are release-blocking and each needs a person:

| # | Check | How | Pass |
|---|---|---|---|
| T1 | Rules install | Start a session with the `video` list, open youtube.com | Block page shows your own sentence back to you |
| T2 | Every rule removed | Stop, reopen youtube.com; then in the worker console `await chrome.declarativeNetRequest.getDynamicRules()` | Page loads normally; the array is empty |
| T4 | Worker death loses nothing | `chrome://serviceworker-internals` → Stop, wait 60s, switch tabs, reopen the popup | Session still running, elapsed still climbing |
| T7 | Cross-account isolation | Open `/review/<the foreign session id from Task 1 Step 4>` while signed in as yourself | 404 — not 403, not a stack trace |

Then the demo script in build-intent §5, twice, with no reload.

Two conditions to expect and not mistake for defects: every surface is unstyled until the design session lands `design/tokens.css`, `app/globals.css`, and `extension/popup.css`; and the dev server must be `localhost:3000`, not `127.0.0.1:3000`, or the extension's host permission will not match.

## Self-Review

- **Spec coverage:** outcome route + review page + answer boundary (T1), ledger with completion rate and no hours headline (T2), review tab on session end (T3), amendments and close-out (T4), release-blocking checks (human checklist).
- **Placeholders:** none — every code step carries the file's contents.
- **Type consistency:** `PATCH /api/sessions/:id/outcome` takes `{ outcome: 'yes' | 'no' }` in Task 1 and is called with exactly that in `answer.tsx`. `counts.finished` / `counts.answered` are the same shape in the review and the ledger.
- **Out of scope:** editing the blocklist, account deletion, multi-device, anything in `design/**`.
