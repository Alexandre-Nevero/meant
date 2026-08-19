# Session Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A session with a declared intention starts, blocks the chosen sites, records where attention went without being asked, and ends cleanly — leaving real rows behind for prompt 4's review.

**Architecture:** The popup sends `start`/`stop` messages and renders from storage; the service worker owns the whole lifecycle and keeps every byte of state in `chrome.storage.local`. Elapsed time is always computed from a stored timestamp. Three device-token API routes persist sessions and events.

**Tech Stack:** MV3 extension, plain ES modules, no bundler · Next.js 16.3.1 App Router · `@neondatabase/serverless` raw SQL · Clerk (untouched this build).

## Global Constraints

- **INV-1 — no in-memory state in the service worker.** It is killed after ~30s idle. Elapsed time is `now − storedTimestamp`, never accumulated. **No `setInterval` or `setTimeout` in `sw.js`, ever.** A display-only `setInterval` in `popup.js` or `blocked.js` that recomputes from `startedAt` is permitted — those are pages, not the worker.
- **INV-2 — hostname only.** `new URL(tab.url).hostname` and nothing else. No path, query string, or page title in any payload, column, or log.
- **INV-3 — block rules die with their session, on every path including errors and recovery.** Rule removal belongs in a `finally`. A rule outliving its session is release-blocking.
- **INV-4** — no new dependency, no framework, no ORM, no bundler.
- **INV-5** — `host_permissions` per blocklist domain. Never `<all_urls>`.
- **INV-6** — every query filters on `user_id` (or the owning device); another user's row 404s, never 403s.
- **Every device-token route calls `deviceFromRequest` first and returns 401 before reading the body.**
- **NO test framework** (build.md §1). Verification is real command output and real browser observation. Do not add a test runner.
- **Class vocabulary**, fixed, shared with a parallel design session: `.m-app`, `.m-mark[data-state]` (idle|running|drifting|ended|empty), `.m-sentence` (the user's intention, and nothing else), `.m-meta`, `.m-field`, `.m-btn[data-variant]` (primary|quiet), `.m-empty`. Never invent or rename one. No `style` attribute, no hardcoded color, no CSS file — `design/**` and `app/globals.css` are another session's lane.
- **User text is text** — `textContent`, never `innerHTML`.
- **Never paste a credential into a report or a doc.** Device tokens, connection strings, and Clerk keys are redacted to their shape (`token: <32-byte base64url string>`), never their value. Build 2 leaked a token fragment into `docs/build.md` this way.
- **Storage keys** are exactly `token`, `apiBase`, `deviceId`, `session`, `queue`. The session shape is `{ sessionId, intention, startedAt, plannedMinutes, currentDomain, currentSince, unfocusedSince, ruleIds }`.
- **Blocklists** (PRD Q1, decided): social = x.com, twitter.com, facebook.com, instagram.com, reddit.com, linkedin.com, tiktok.com · video = youtube.com, twitch.tv, netflix.com · news = news.ycombinator.com, bbc.co.uk, cnn.com, theguardian.com.

---

### Task 1: Device auth and the three session/event routes

**Files:**
- Create: `lib/device-auth.ts`
- Create: `app/api/sessions/route.ts`
- Create: `app/api/sessions/[id]/route.ts`
- Modify: `app/api/events/route.ts` (currently a 401 stub from build 1 — replace it)

**Interfaces:**
- Consumes: `sql` from `@/lib/db`.
- Produces: `deviceFromRequest(req)` → `{ id, user_id } | null`. `POST /api/sessions` → `{ sessionId }`. `PATCH /api/sessions/:id` → `{ ok: true }`. `POST /api/events` → `{ accepted: number }`. Task 3 and Task 4 call all three from the worker.

Route handlers in Next 16 take params as a Promise: `{ params }: { params: Promise<{ id: string }> }`.

- [ ] **Step 1: Write `lib/device-auth.ts`**

```ts
import { createHash } from 'node:crypto'
import { sql } from '@/lib/db'

export async function deviceFromRequest(req: Request) {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const hash = createHash('sha256').update(header.slice(7)).digest('hex')
  const [device] = await sql`select id, user_id from device where token_hash = ${hash}`
  return device ?? null
}
```

- [ ] **Step 2: Write `app/api/sessions/route.ts`**

An empty intention is legal and is stored as `''` (US-01, A2) — do not reject it, do not coerce it to null.

```ts
import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.startedAt !== 'string') {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  const intention = typeof body.intention === 'string' ? body.intention : ''
  const plannedMinutes = Number.isInteger(body.plannedMinutes) ? body.plannedMinutes : null
  const blocklist = Array.isArray(body.blocklist) ? body.blocklist.map(String) : []

  const [session] = await sql`
    insert into session (user_id, device_id, intention, planned_minutes, blocklist, started_at)
    values (${device.user_id}, ${device.id}, ${intention}, ${plannedMinutes}, ${blocklist}, ${body.startedAt})
    returning id`

  return Response.json({ sessionId: session.id })
}
```

- [ ] **Step 3: Write `app/api/sessions/[id]/route.ts`**

Ownership is in the `where` clause, so another device's session returns 404 and never 403 (INV-6).

```ts
import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

const END_REASONS = ['stopped', 'elapsed', 'superseded', 'recovered']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body.endedAt !== 'string' || !END_REASONS.includes(body.endReason)) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  const updated = await sql`
    update session set ended_at = ${body.endedAt}, end_reason = ${body.endReason}
     where id = ${id} and device_id = ${device.id} and user_id = ${device.user_id}
       and ended_at is null
     returning id`
  if (updated.length === 0) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Replace `app/api/events/route.ts`**

The domain check is INV-2 enforced at the boundary. Reject the whole batch on a bad domain rather than silently dropping one row — a silent drop hides the bug that produced it.

```ts
import { deviceFromRequest } from '@/lib/device-auth'
import { sql } from '@/lib/db'

const KINDS = ['attention', 'away', 'block_hit']

export async function POST(req: Request) {
  const device = await deviceFromRequest(req)
  if (!device) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const events = Array.isArray(body?.events) ? body.events : null
  if (!body || typeof body.sessionId !== 'string' || !events) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  for (const e of events) {
    if (!KINDS.includes(e?.kind)) return Response.json({ error: 'bad kind' }, { status: 400 })
    if (e.domain != null && (typeof e.domain !== 'string' || /[/?#]/.test(e.domain))) {
      return Response.json({ error: 'domain must be a hostname' }, { status: 400 })
    }
    if (typeof e.at !== 'string') return Response.json({ error: 'bad timestamp' }, { status: 400 })
  }

  const owned = await sql`
    select id from session where id = ${body.sessionId} and user_id = ${device.user_id}`
  if (owned.length === 0) return Response.json({ error: 'not found' }, { status: 404 })

  if (events.length > 0) {
    await sql`
      insert into event (session_id, kind, domain, seconds, at)
      select ${body.sessionId}::uuid, k, d, s, a
        from unnest(
          ${events.map((e: { kind: string }) => e.kind)}::text[],
          ${events.map((e: { domain?: string | null }) => e.domain ?? null)}::text[],
          ${events.map((e: { seconds?: number | null }) => e.seconds ?? null)}::int[],
          ${events.map((e: { at: string }) => e.at)}::timestamptz[]
        ) as t(k, d, s, a)`
  }

  return Response.json({ accepted: events.length })
}
```

- [ ] **Step 5: Verify auth-before-body on every route**

Run, with the dev server on :3000:

```bash
for r in "POST /api/sessions" "POST /api/events"; do
  m=${r% *}; p=${r#* }
  curl -s -o /dev/null -w "$p no-auth:%{http_code}\n" -X $m localhost:3000$p \
    -H 'content-type: application/json' -d 'not even json'
done
curl -s -o /dev/null -w "sessions/:id no-auth:%{http_code}\n" -X PATCH \
  localhost:3000/api/sessions/00000000-0000-0000-0000-000000000000 \
  -H 'content-type: application/json' -d '{}'
```

Expected: `401` on all three, with a malformed body — proving the credential is checked before the body is read.

- [ ] **Step 6: Verify the full row path with a real device token**

Mint a token by seeding a pairing code and claiming it, then drive all three routes. Run:

```bash
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
sql\`insert into pairing_code (code, user_id, expires_at) values ('LOOP23', 'user_loop_check', now() + interval '10 minutes')\`.then(() => console.log('seeded'))
"
TOKEN=$(curl -s -X POST localhost:3000/api/pair/claim -H 'content-type: application/json' -d '{"code":"LOOP23"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
SID=$(curl -s -X POST localhost:3000/api/sessions -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"intention":"","plannedMinutes":25,"blocklist":["x.com"],"startedAt":"2026-08-19T10:00:00Z"}' | sed 's/.*"sessionId":"\([^"]*\)".*/\1/')
echo "session=$SID"
curl -s -X POST localhost:3000/api/events -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"events\":[{\"kind\":\"attention\",\"domain\":\"claude.ai\",\"seconds\":61,\"at\":\"2026-08-19T10:01:00Z\"},{\"kind\":\"away\",\"domain\":null,\"seconds\":90,\"at\":\"2026-08-19T10:02:00Z\"}]}"; echo
curl -s -X POST localhost:3000/api/events -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"sessionId\":\"$SID\",\"events\":[{\"kind\":\"attention\",\"domain\":\"claude.ai/chat/8f2\",\"seconds\":5,\"at\":\"2026-08-19T10:03:00Z\"}]}"; echo
curl -s -X PATCH localhost:3000/api/sessions/$SID -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"endedAt":"2026-08-19T10:25:00Z","endReason":"stopped"}'; echo
```

Expected, in order: `{"accepted":2}` · a 400 whose message names the hostname rule (this is INV-2 at the boundary, and the row must NOT be inserted) · `{"ok":true}`.

- [ ] **Step 7: Confirm the rows, then clean up**

```bash
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
;(async () => {
  console.log(await sql\`select kind, domain, seconds from event where session_id in (select id from session where user_id = 'user_loop_check') order by at\`)
  console.log(await sql\`select intention, end_reason, planned_minutes from session where user_id = 'user_loop_check'\`)
  await sql\`delete from session where user_id = 'user_loop_check'\`
  await sql\`delete from device where user_id = 'user_loop_check'\`
  await sql\`delete from pairing_code where user_id = 'user_loop_check'\`
  console.log('cleaned')
})()
"
```

Expected: exactly two event rows (no third from the rejected batch), `intention` an empty string, `end_reason` `stopped`. Paste this output into the report.

- [ ] **Step 8: Commit**

```bash
npx tsc --noEmit
git add lib/device-auth.ts app/api/sessions app/api/events
git commit -m "feat: device auth, session start/stop, event ingest"
```

---

### Task 2: Blocklists and the block page

**Files:**
- Create: `extension/blocklists.js`
- Create: `extension/blocked.html`
- Create: `extension/blocked.js`
- Modify: `extension/manifest.json`

**Interfaces:**
- Consumes: `post` from `./api.js`.
- Produces: `BLOCKLISTS` from `extension/blocklists.js` — `{ social: string[], video: string[], news: string[] }`. Task 5 imports it to build rules. `blocked.html?d=<hostname>` is the redirect target.

This task shares no file with Tasks 3–5, so it can run alongside them.

- [ ] **Step 1: Write `extension/blocklists.js`**

```js
export const BLOCKLISTS = {
  social: ['x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'reddit.com', 'linkedin.com', 'tiktok.com'],
  video: ['youtube.com', 'twitch.tv', 'netflix.com'],
  news: ['news.ycombinator.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com'],
}

export const ALL_DOMAINS = Object.values(BLOCKLISTS).flat()
```

- [ ] **Step 2: Add host permissions and web-accessible resources to `extension/manifest.json`**

A `redirect` action is an unsafe rule: it needs host permissions for the request URL, and the redirect target must be web-accessible to the site being redirected. Keep `http://localhost:3000/*` — it is the API origin from build 2. List every blocklist domain and nothing more (INV-5).

```json
{
  "manifest_version": 3,
  "name": "MEANT",
  "version": "0.1.0",
  "permissions": ["declarativeNetRequest", "tabs", "storage", "alarms"],
  "host_permissions": [
    "http://localhost:3000/*",
    "*://*.x.com/*", "*://*.twitter.com/*", "*://*.facebook.com/*", "*://*.instagram.com/*",
    "*://*.reddit.com/*", "*://*.linkedin.com/*", "*://*.tiktok.com/*",
    "*://*.youtube.com/*", "*://*.twitch.tv/*", "*://*.netflix.com/*",
    "*://*.news.ycombinator.com/*", "*://*.bbc.co.uk/*", "*://*.cnn.com/*", "*://*.theguardian.com/*"
  ],
  "web_accessible_resources": [
    {
      "resources": ["blocked.html"],
      "matches": [
        "*://*.x.com/*", "*://*.twitter.com/*", "*://*.facebook.com/*", "*://*.instagram.com/*",
        "*://*.reddit.com/*", "*://*.linkedin.com/*", "*://*.tiktok.com/*",
        "*://*.youtube.com/*", "*://*.twitch.tv/*", "*://*.netflix.com/*",
        "*://*.news.ycombinator.com/*", "*://*.bbc.co.uk/*", "*://*.cnn.com/*", "*://*.theguardian.com/*"
      ]
    }
  ],
  "background": { "service_worker": "sw.js", "type": "module" },
  "action": { "default_popup": "popup.html" }
}
```

- [ ] **Step 3: Write `extension/blocked.html`**

```html
<!doctype html>
<meta charset="utf-8" />
<title>MEANT</title>
<link rel="stylesheet" href="popup.css" />
<body class="m-app">
  <main id="root"></main>
  <script type="module" src="blocked.js"></script>
</body>
```

- [ ] **Step 4: Write `extension/blocked.js`**

There is no bypass control, no "five more minutes", no dismiss (SDD-C3). The countdown is display-only and recomputes from `startedAt` on every tick, so it never holds elapsed time in a variable.

```js
import { post } from './api.js'

const root = document.getElementById('root')
const domain = new URLSearchParams(location.search).get('d')

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function remainingText(session) {
  const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
  if (session.plannedMinutes == null) {
    return `${Math.floor(elapsedMs / 60000)} minutes in`
  }
  const leftMs = Math.max(0, session.plannedMinutes * 60000 - elapsedMs)
  return `${Math.ceil(leftMs / 60000)} minutes left`
}

async function render() {
  const { session } = await chrome.storage.local.get('session')
  if (!session) {
    root.replaceChildren(el('p', 'm-meta', 'No session is running.'))
    return
  }
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'
  root.replaceChildren(
    mark,
    el('p', 'm-meta', 'You said you would:'),
    el('p', 'm-sentence', session.intention),
    el('p', 'm-meta', remainingText(session)),
  )
}

async function recordHit() {
  const { session } = await chrome.storage.local.get('session')
  if (!session || !domain) return
  await post('/api/events', {
    sessionId: session.sessionId,
    events: [{ kind: 'block_hit', domain, seconds: null, at: new Date().toISOString() }],
  })
}

render()
recordHit()
setInterval(render, 1000)
```

- [ ] **Step 5: Verify syntax and manifest validity**

```bash
node --check extension/blocked.js
python3 -c "import json; m=json.load(open('extension/manifest.json')); print(len(m['host_permissions']), 'host permissions'); print('all_urls' in json.dumps(m))"
node --check extension/blocklists.js
```

Expected: no syntax errors, 15 host permissions (14 blocklist domains + localhost), and `False` for the `all_urls` check.

- [ ] **Step 6: Commit**

```bash
git add extension/blocklists.js extension/blocked.html extension/blocked.js extension/manifest.json
git commit -m "feat: blocklists, block page, per-domain host permissions"
```

---

### Task 3: Session start and stop in the worker

**Files:**
- Modify: `extension/sw.js` (currently a one-line placeholder — this task gives it its contents)
- Modify: `extension/popup.js` (idle state gains the intention field, duration, blocklist choice, and Start; running state gains Stop)

**Interfaces:**
- Consumes: `post`, `apiBase` from `./api.js`; `POST /api/sessions` and `PATCH /api/sessions/:id` from Task 1.
- Produces: the message contract `{ type: 'start', intention, plannedMinutes, blocklist }` and `{ type: 'stop' }`; the `session` storage key. Task 4 adds attribution to the same worker; Task 5 adds rules.

**INV-1 is the whole of this task.** No `setInterval`, no `setTimeout`, no module-level mutable state in `sw.js`. The popup's 1-second display tick is fine — it recomputes from `startedAt`.

- [ ] **Step 1: Write `extension/sw.js`**

`ruleIds` is written as an empty array here and filled by Task 5. Recovery binds to `chrome.runtime.onStartup` **only** — the worker wakes constantly, and running recovery on wake would end a live session every 30 seconds.

```js
import { post } from './api.js'

const TICK = 'meant-tick'

export async function getSession() {
  const { session } = await chrome.storage.local.get('session')
  return session ?? null
}

async function activeDomain() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.url) return null
  try {
    return new URL(tab.url).hostname || null
  } catch {
    return null
  }
}

export async function startSession({ intention, plannedMinutes, blocklist }) {
  const open = await getSession()
  if (open) await endSession('superseded')

  const startedAt = new Date().toISOString()
  const res = await post('/api/sessions', { intention, plannedMinutes, blocklist, startedAt })
  if (!res.ok) return { ok: false, offline: Boolean(res.offline) }

  await chrome.storage.local.set({
    session: {
      sessionId: res.data.sessionId,
      intention,
      startedAt,
      plannedMinutes,
      currentDomain: await activeDomain(),
      currentSince: Date.now(),
      unfocusedSince: null,
      ruleIds: [],
    },
  })
  await chrome.alarms.create(TICK, { periodInMinutes: 0.5 })
  return { ok: true }
}

export async function endSession(endReason) {
  const session = await getSession()
  if (!session) return { ok: false }
  try {
    await post(`/api/sessions/${session.sessionId}`, {
      endedAt: new Date().toISOString(),
      endReason,
    }, { method: 'PATCH' })
  } finally {
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null })
  }
  return { ok: true }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message?.type === 'start') sendResponse(await startSession(message))
    else if (message?.type === 'stop') sendResponse(await endSession('stopped'))
    else sendResponse({ ok: false })
  })()
  return true
})

chrome.runtime.onStartup.addListener(async () => {
  const session = await getSession()
  if (session) await endSession('recovered')
})
```

- [ ] **Step 2: Rewrite the popup's idle and running states in `extension/popup.js`**

Keep `unpaired()`, `claim()`, `el()`, `show()`, and `render()`'s dispatch exactly as they are. Replace only the `idle()` and `running()` functions, and add the two helpers below. Use only the fixed class vocabulary.

```js
function idle() {
  const field = el('input', 'm-field')
  field.placeholder = 'What will you finish?'

  const duration = el('select', 'm-field')
  for (const [label, value] of [['25 minutes', '25'], ['50 minutes', '50'], ['Until I stop', '']]) {
    const option = el('option', null, label)
    option.value = value
    duration.append(option)
  }

  const list = el('select', 'm-field')
  for (const name of ['social', 'video', 'news']) {
    const option = el('option', null, name)
    option.value = name
    list.append(option)
  }

  const start = el('button', 'm-btn', 'Start')
  start.dataset.variant = 'primary'
  start.addEventListener('click', async () => {
    start.disabled = true
    const res = await chrome.runtime.sendMessage({
      type: 'start',
      intention: field.value,
      plannedMinutes: duration.value ? Number(duration.value) : null,
      blocklist: list.value,
    })
    if (!res?.ok) {
      start.disabled = false
      show(...idleNodes(field, duration, list, start),
        el('p', 'm-meta', res?.offline ? 'No connection. A session needs one to start.' : 'Could not start.'))
      return
    }
    render()
  })

  show(...idleNodes(field, duration, list, start))
}

function idleNodes(field, duration, list, start) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'idle'
  return [mark, field, duration, list, start]
}

function running(session) {
  const mark = el('p', 'm-mark', '')
  mark.dataset.state = 'running'

  const elapsed = el('p', 'm-meta', '')
  const paint = () => {
    const minutes = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000)
    elapsed.textContent = `${minutes} min elapsed`
  }
  paint()
  setInterval(paint, 1000)

  const stop = el('button', 'm-btn', 'Stop')
  stop.dataset.variant = 'quiet'
  stop.addEventListener('click', async () => {
    stop.disabled = true
    await chrome.runtime.sendMessage({ type: 'stop' })
    render()
  })

  show(mark, el('p', 'm-sentence', session.intention), elapsed, stop)
}
```

- [ ] **Step 3: Verify no timer or module state leaked into the worker**

```bash
node --check extension/sw.js && node --check extension/popup.js
grep -nE 'setInterval|setTimeout|^let |^var ' extension/sw.js || echo "sw.js clean: no timers, no module-level mutable state"
```

Expected: both files parse, and the grep prints the "clean" line. A hit in `sw.js` is an INV-1 violation — fix it, do not explain it.

- [ ] **Step 4: Commit**

```bash
git add extension/sw.js extension/popup.js
git commit -m "feat: session start and stop, popup start and stop controls"
```

---

### Task 4: Attention recording and the flush

**Files:**
- Modify: `extension/sw.js`

**Interfaces:**
- Consumes: `getSession`, `endSession` from Task 3; `post` from `./api.js`; `POST /api/events` from Task 1.
- Produces: `attribute(nextDomain)` and `flush()`, both called by Task 5's paths as well.

Events are buffered in the existing top-level `queue` as `/api/events` records, and the flush coalesces them into one request. There is no sixth storage key.

- [ ] **Step 1: Add attribution to `extension/sw.js`**

`enqueue` re-reads `queue` immediately before writing it, because `chrome.storage.local` read-modify-write is not atomic.

```js
const AWAY_THRESHOLD_MS = 60_000

async function enqueue(session, event) {
  const { queue = [] } = await chrome.storage.local.get('queue')
  queue.push({
    method: 'POST',
    path: '/api/events',
    body: { sessionId: session.sessionId, events: [event] },
    at: new Date().toISOString(),
  })
  await chrome.storage.local.set({ queue })
}

export async function attribute(nextDomain) {
  const session = await getSession()
  if (!session) return

  const now = Date.now()
  const seconds = Math.round((now - session.currentSince) / 1000)
  if (session.currentDomain && seconds > 0) {
    await enqueue(session, {
      kind: 'attention',
      domain: session.currentDomain,
      seconds,
      at: new Date(now).toISOString(),
    })
  }
  await chrome.storage.local.set({
    session: { ...session, currentDomain: nextDomain, currentSince: now },
  })
}

// A gap over 60s becomes `away` and resets the clock. A shorter gap is left alone,
// so a quick alt-tab stays attributed to the domain that was open (US-03).
async function settleFocus() {
  const session = await getSession()
  if (!session?.unfocusedSince) return

  const now = Date.now()
  const gap = now - session.unfocusedSince
  if (gap > AWAY_THRESHOLD_MS) {
    await enqueue(session, {
      kind: 'away',
      domain: null,
      seconds: Math.round(gap / 1000),
      at: new Date(now).toISOString(),
    })
    await chrome.storage.local.set({
      session: { ...session, unfocusedSince: null, currentSince: now },
    })
    return
  }
  await chrome.storage.local.set({ session: { ...session, unfocusedSince: null } })
}

chrome.tabs.onActivated.addListener(async () => {
  await attribute(await activeDomain())
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return
  try {
    await attribute(new URL(changeInfo.url).hostname || null)
  } catch {
    await attribute(null)
  }
})

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const session = await getSession()
  if (!session) return
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (!session.unfocusedSince) {
      await chrome.storage.local.set({ session: { ...session, unfocusedSince: Date.now() } })
    }
    return
  }
  await settleFocus()
  await attribute(await activeDomain())
})
```

- [ ] **Step 2: Add the flush and the alarm handler to `extension/sw.js`**

The flush is the only writer that shrinks the queue, and it re-reads before writing. Records are only dropped once the request that carried them succeeded.

```js
export async function flush() {
  const { queue = [] } = await chrome.storage.local.get('queue')
  if (queue.length === 0) return

  const events = queue.filter((r) => r.path === '/api/events')
  const others = queue.filter((r) => r.path !== '/api/events')

  const sent = []
  if (events.length > 0) {
    const bySession = new Map()
    for (const record of events) {
      const list = bySession.get(record.body.sessionId) ?? []
      list.push(...record.body.events)
      bySession.set(record.body.sessionId, list)
    }
    for (const [sessionId, batch] of bySession) {
      const res = await post('/api/events', { sessionId, events: batch }, { queue: false })
      if (res.ok) sent.push(...events.filter((r) => r.body.sessionId === sessionId))
    }
  }

  for (const record of others) {
    const res = await post(record.path, record.body, { method: record.method, queue: false })
    if (res.ok) sent.push(record)
  }

  const { queue: current = [] } = await chrome.storage.local.get('queue')
  await chrome.storage.local.set({ queue: current.filter((r) => !sent.includes(r)) })
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TICK) return
  const session = await getSession()
  if (!session) return

  await settleFocus()
  await flush()

  if (session.plannedMinutes != null) {
    const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
    if (elapsedMs >= session.plannedMinutes * 60_000) {
      await attribute(null)
      await flush()
      await endSession('elapsed')
    }
  }
})
```

- [ ] **Step 3: Flush the final segment when a session ends**

In `endSession`, before the `PATCH`, close the open segment and flush so the last stretch of attention is not lost:

```js
export async function endSession(endReason) {
  const session = await getSession()
  if (!session) return { ok: false }
  try {
    await attribute(null)
    await flush()
    await post(`/api/sessions/${session.sessionId}`, {
      endedAt: new Date().toISOString(),
      endReason,
    }, { method: 'PATCH' })
  } finally {
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null })
  }
  return { ok: true }
}
```

- [ ] **Step 4: Verify INV-1 still holds and the file parses**

```bash
node --check extension/sw.js
grep -nE 'setInterval|setTimeout' extension/sw.js || echo "no timers in sw.js"
grep -c 'chrome.storage.local.get' extension/sw.js
```

Expected: parses, no timers, and every read of session state goes through storage.

- [ ] **Step 5: Commit**

```bash
git add extension/sw.js
git commit -m "feat: attention attribution, away detection, batched flush"
```

---

### Task 5: Block rules that die with the session

**Files:**
- Modify: `extension/sw.js`

**Interfaces:**
- Consumes: `BLOCKLISTS` from `./blocklists.js` (Task 2); `getSession`, `startSession`, `endSession` from Tasks 3–4.
- Produces: nothing new — this closes the loop.

**INV-3 is the whole of this task.** A rule that outlives its session is release-blocking, not a bug to file. Removal goes in a `finally`, and recovery clears every dynamic rule rather than only the recorded ids — a crash between minting ids and storing them would otherwise strand rules nothing knows about.

- [ ] **Step 1: Add rule installation to `extension/sw.js`**

```js
import { BLOCKLISTS } from './blocklists.js'

const RULE_ID_BASE = 1000

async function installRules(listName) {
  const domains = BLOCKLISTS[listName] ?? []
  if (domains.length === 0) return []

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
  return domains.map((_, i) => RULE_ID_BASE + i)
}

async function removeAllRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules()
  if (existing.length === 0) return
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
  })
}
```

- [ ] **Step 2: Wire installation into `startSession`**

After the session is stored, install the rules and record their ids. If installation throws, end the session rather than leaving a session with no protection it claims to have:

```js
  await chrome.alarms.create(TICK, { periodInMinutes: 0.5 })

  try {
    const ruleIds = await installRules(blocklist)
    const stored = await getSession()
    await chrome.storage.local.set({ session: { ...stored, ruleIds } })
  } catch (error) {
    await endSession('stopped')
    return { ok: false, error: String(error) }
  }
  return { ok: true }
```

- [ ] **Step 3: Wire removal into `endSession`'s `finally`**

Removal must run whether the flush threw, the PATCH 404'd, or the network is gone:

```js
  } finally {
    await removeAllRules()
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null })
  }
```

- [ ] **Step 4: Clear stranded rules on startup and install**

```js
chrome.runtime.onInstalled.addListener(async () => {
  await removeAllRules()
})
```

And in the existing `onStartup` handler, clear rules even when no session is found:

```js
chrome.runtime.onStartup.addListener(async () => {
  const session = await getSession()
  if (session) await endSession('recovered')
  else await removeAllRules()
})
```

- [ ] **Step 5: Verify**

```bash
node --check extension/sw.js
grep -n 'removeAllRules' extension/sw.js
```

Expected: parses, and `removeAllRules` appears in `endSession`'s `finally`, in `onInstalled`, and in `onStartup`. If it appears only on the happy path, INV-3 is broken.

- [ ] **Step 6: Commit**

```bash
git add extension/sw.js
git commit -m "feat: block rules install on start and die with the session"
```

---

### Task 6: Record the amendments

**Files:**
- Modify: `docs/build.md` (§5, §6 TASK-005/006/007, §7.2, §10, §11)

- [ ] **Step 1: Amend §7.2's session shape**

Add `unfocusedSince: number | null` to the `session` row, and say why in one clause: focus loss has to be timed without discarding the domain the time belongs to.

- [ ] **Step 2: Amend §6 TASK-007**

The redirect target is `redirect.url` = `chrome.runtime.getURL('blocked.html?d=<hostname>')`, not `extensionPath`, so the block page can record `block_hit` (EV5) with the attempted hostname. `redirect.url` is documented to take a full URL; `extensionPath`'s query-string support is not. Hostname only, so INV-2 holds.

- [ ] **Step 3: Amend §6 TASK-006**

Events buffer in the existing top-level `queue` as `/api/events` records; the flush coalesces every event record for a session into one request and replays the rest in order.

- [ ] **Step 4: Amend §5 and §6 TASK-005**

TASK-005's write scope adds `extension/popup.js` — a session cannot start without a Start control. Flip TASK-005, TASK-006, TASK-007 to done and TASK-008 to ready once Tasks 1–5 are verified.

- [ ] **Step 5: Add the §11 rows and answer PRD Q1**

One row per amendment above, plus one recording the three blocklists as the answer to PRD Q1 (social / video / news, 14 domains), and one recording the known limitation: starting a session requires the network, because the server mints the session id.

- [ ] **Step 6: Fill §10 with evidence that was actually produced**

Fact-only. The browser checks (T1, T2, T3, T4, T6) are human-only — record them as outstanding, never as passing, until a human runs them.

- [ ] **Step 7: Commit**

```bash
git add docs/build.md
git commit -m "docs: record session-loop amendments and PRD Q1"
```

---

## Self-Review

- **Spec coverage:** device auth + three routes (T1), blocklists/block page/manifest (T2), start-stop + popup controls (T3), attribution/away/flush (T4), rules that die with the session (T5), amendments (T6).
- **Placeholders:** none — every code step carries the code to write.
- **Type consistency:** `getSession`/`attribute`/`flush`/`endSession`/`startSession` are defined in Task 3 or 4 and re-used by name in Tasks 4 and 5. `post(path, body, opts)` matches build 2's shipped signature, including `{ queue: false }` and `{ method: 'PATCH' }`.
- **Out of scope, deliberately:** the review page, the outcome question, the dashboard ledger, offline session start.
