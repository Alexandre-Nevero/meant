# Extension Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The extension holds a device token attributable to a real Clerk account, and every request it makes survives being offline.

**Architecture:** `/pair` (Clerk session) mints a 6-character code; the popup posts it to a public claim route that claims atomically and returns a token exactly once; the token lives in `chrome.storage.local` and `api.js` attaches it to every later request, queueing the payload on network failure instead of throwing.

**Tech Stack:** Next.js 16.3.1 App Router · `@clerk/nextjs` 7 · `@neondatabase/serverless` (raw SQL) · MV3 extension, plain ES modules, no bundler.

## Global Constraints

- **No test framework.** build.md §1: v1 is verified by the manual matrix in §8. Every task ends with a runnable command whose output is the evidence — `curl`, a SQL read, or a devtools observation. Do not add a test runner.
- **INV-2 hostname only.** No path, query string, or page title in any payload or column.
- **INV-4** — no fourth external service, no ORM, no framework, no bundler, no UI kit.
- **INV-5** — host permissions stay narrow. `http://localhost:3000/*` only. Never `<all_urls>`.
- **INV-6** — every query filters on `user_id`; another user's row 404s, never 403s.
- **SDD V1** — device token is 32 random bytes base64url, stored as sha256 hex, transmitted exactly once at claim.
- **SDD V2** — code alphabet is exactly `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 6 chars, 10-minute expiry, single use, atomic claim verified by affected row count.
- **Lane** — `design/**`, `app/globals.css`, and extension CSS belong to the design session. Never write them. No `style` attribute, no hardcoded color.
- **Class vocabulary** — only `.m-app`, `.m-mark[data-state]`, `.m-sentence`, `.m-meta`, `.m-field`, `.m-btn[data-variant]`, `.m-empty`. Never invent a name.
- **File list** — build.md §3 caps the repo. Create only files this plan names.
- **User text is text.** Render intention and code with `textContent`, never `innerHTML`.

---

### Task 1: Pairing API

**Files:**
- Create: `app/api/pair/route.ts`
- Create: `app/api/pair/claim/route.ts`

**Interfaces:**
- Consumes: `sql` from `@/lib/db` (the single export, a tagged-template query function).
- Produces: `POST /api/pair` → `{ code: string, expiresAt: string }` · `POST /api/pair/claim` → `{ deviceId: string, token: string }` or 401 `{ error: string }`. Task 3's `api.js` calls the claim route.

- [ ] **Step 1: Write `app/api/pair/route.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { sql } from '@/lib/db'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// 256 % 32 === 0, so the modulo is unbiased.
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  for (let i = 0; i < 3; i++) {
    const rows = await sql`
      insert into pairing_code (code, user_id, expires_at)
      values (${newCode()}, ${userId}, now() + interval '10 minutes')
      on conflict (code) do nothing
      returning code, expires_at`
    if (rows.length) {
      return Response.json({ code: rows[0].code, expiresAt: rows[0].expires_at })
    }
  }
  return Response.json({ error: 'could not mint a code' }, { status: 500 })
}
```

- [ ] **Step 2: Write `app/api/pair/claim/route.ts`**

The `returning` row count is the affected row count — nothing is inferred, and the claim reads no Clerk session.

```ts
import { createHash, randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : null
  if (!code) return Response.json({ error: 'bad request' }, { status: 400 })

  const claimed = await sql`
    update pairing_code set claimed_at = now()
     where code = ${code} and claimed_at is null and expires_at > now()
     returning user_id`
  if (claimed.length === 0) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const [device] = await sql`
    insert into device (user_id, token_hash)
    values (${claimed[0].user_id}, ${tokenHash})
    returning id`

  return Response.json({ deviceId: device.id, token })
}
```

- [ ] **Step 3: Verify the claim route rejects garbage without a Clerk session**

Run (dev server on :3000):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/pair/claim \
  -H 'content-type: application/json' -d '{"code":"ZZZZZZ"}'
```

Expected: `401`. An HTML redirect here means the proxy matcher regressed — stop and report.

- [ ] **Step 4: Verify a real code claims once and only once**

Mint a row directly, then claim it twice. Run:

```bash
node -e "
const {neon}=require('@neondatabase/serverless');
require('fs').readFileSync('.env.local','utf8').split('\n').filter(l=>l.startsWith('DATABASE_URL=')).forEach(l=>process.env.DATABASE_URL=l.slice(13).replace(/^\"|\"$/g,''));
const sql=neon(process.env.DATABASE_URL);
sql\`insert into pairing_code (code,user_id,expires_at) values ('TEST23','user_plan_check',now()+interval '10 minutes')\`.then(()=>console.log('seeded'));
"
curl -s -X POST localhost:3000/api/pair/claim -H 'content-type: application/json' -d '{"code":"TEST23"}'
curl -s -X POST localhost:3000/api/pair/claim -H 'content-type: application/json' -d '{"code":"TEST23"}'
```

Expected: first prints `{"deviceId":"…","token":"…"}`, second prints `{"error":"unauthorized"}`. Record both lines in the task report.

- [ ] **Step 5: Commit**

```bash
git add app/api/pair
git commit -m "feat: pairing code mint and atomic claim"
```

---

### Task 2: Pairing page

**Files:**
- Create: `app/pair/page.tsx`

**Interfaces:**
- Consumes: `POST /api/pair` from Task 1.
- Produces: nothing for later tasks. The popup links here by URL.

Auth is enforced at the resource, not the page: the route returns 401 when signed out and the page says so. This is the Clerk-recommended pattern and keeps `/pair` to one file.

- [ ] **Step 1: Write `app/pair/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

type Pairing = { code: string; expiresAt: string }

export default function Pair() {
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/pair', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setPairing)
      .catch(() => setFailed(true))
  }, [])

  if (failed) return <p className="m-meta">Sign in first, then reload this page.</p>
  if (!pairing) return <p className="m-meta">Minting a code…</p>

  return (
    <div className="m-app">
      <p className="m-sentence">{pairing.code}</p>
      <p className="m-meta">
        Paste this into the extension. It expires at{' '}
        {new Date(pairing.expiresAt).toLocaleTimeString()}.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify signed in**

Run `npm run dev`, sign in, open `http://localhost:3000/pair`. Expected: six characters from the alphabet and a stated expiry roughly ten minutes out (US-06).

- [ ] **Step 3: Verify signed out**

Open `/pair` in a private window. Expected: "Sign in first" — not a crash, not a code.

- [ ] **Step 4: Commit**

```bash
git add app/pair
git commit -m "feat: pairing page shows a code with its expiry"
```

---

### Task 3: Extension skeleton and pairing

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/api.js`
- Create: `extension/popup.html`
- Create: `extension/popup.js`
- Create: `extension/sw.js`

**Interfaces:**
- Consumes: `POST /api/pair/claim` from Task 1.
- Produces: `post(path, body)` from `extension/api.js`, returning `{ ok, status, data }` on a completed request or `{ ok: false, queued: true }` when the network failed. TASK-005 and TASK-006 build on this and on the storage keys `token`, `apiBase`, `session`, `queue`.

- [ ] **Step 1: Write `extension/manifest.json`**

`host_permissions` is required *now*: MV3 blocks cross-origin fetch from extension pages and workers without it, so pairing cannot work at all otherwise. Blocklist domains join it in TASK-007.

```json
{
  "manifest_version": 3,
  "name": "MEANT",
  "version": "0.1.0",
  "permissions": ["declarativeNetRequest", "tabs", "storage", "alarms"],
  "host_permissions": ["http://localhost:3000/*"],
  "background": { "service_worker": "sw.js", "type": "module" },
  "action": { "default_popup": "popup.html" }
}
```

- [ ] **Step 2: Write `extension/sw.js`**

The manifest will not load without the file. TASK-005 owns its contents.

```js
// TASK-005 owns this worker. Empty on purpose — no in-memory state ever lives here (INV-1).
```

- [ ] **Step 3: Write `extension/api.js`**

Only a thrown fetch (no network) queues. An HTTP error is returned to the caller with its status, because a 401 is an answer, not an outage.

```js
const DEFAULT_API_BASE = 'http://localhost:3000'

export async function apiBase() {
  const stored = await chrome.storage.local.get('apiBase')
  if (stored.apiBase) return stored.apiBase
  await chrome.storage.local.set({ apiBase: DEFAULT_API_BASE })
  return DEFAULT_API_BASE
}

export async function post(path, body) {
  const base = await apiBase()
  const { token } = await chrome.storage.local.get('token')
  try {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch {
    const { queue = [] } = await chrome.storage.local.get('queue')
    queue.push({ path, body, at: new Date().toISOString() })
    await chrome.storage.local.set({ queue })
    return { ok: false, queued: true }
  }
}
```

- [ ] **Step 4: Write `extension/popup.html`**

The stylesheet link is deliberate: `extension/popup.css` belongs to the design session, which cannot edit this file. Until they land it the popup 404s the stylesheet and renders unstyled — expected, not a defect.

```html
<!doctype html>
<meta charset="utf-8" />
<title>MEANT</title>
<link rel="stylesheet" href="popup.css" />
<body class="m-app">
  <main id="root"></main>
  <script type="module" src="popup.js"></script>
</body>
```

- [ ] **Step 5: Write `extension/popup.js`**

Three states read from storage. Idle and running are skeletons — TASK-005 wires Start and Stop; do not add session logic here.

```js
import { post, apiBase } from './api.js'

const root = document.getElementById('root')

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function show(...nodes) {
  root.replaceChildren(...nodes)
}

function unpaired(message) {
  const field = el('input', 'm-field')
  field.placeholder = 'Pairing code'
  field.maxLength = 6

  const button = el('button', 'm-btn', 'Pair')
  button.dataset.variant = 'primary'
  button.addEventListener('click', () => claim(field.value))

  const link = el('button', 'm-btn', 'Get a code')
  link.dataset.variant = 'quiet'
  link.addEventListener('click', async () => {
    chrome.tabs.create({ url: (await apiBase()) + '/pair' })
  })

  const nodes = [el('p', 'm-meta', 'Connect this browser to your account.'), field, button, link]
  if (message) nodes.push(el('p', 'm-meta', message))
  show(...nodes)
}

async function claim(value) {
  const code = value.trim().toUpperCase()
  if (code.length !== 6) return unpaired('A code is six characters.')

  const res = await post('/api/pair/claim', { code })
  if (res.queued) return unpaired('No connection. Try again when you are back online.')
  if (!res.ok) return unpaired('That code is wrong, expired, or already used.')

  await chrome.storage.local.set({ token: res.data.token, deviceId: res.data.deviceId })
  render()
}

function idle() {
  show(
    el('p', 'm-mark', ''),
    el('p', 'm-meta', 'Paired. Declaring an intention arrives in the next step.'),
  )
  root.firstChild.dataset.state = 'idle'
}

function running(session) {
  show(
    el('p', 'm-sentence', session.intention),
    el('p', 'm-meta', `Started ${new Date(session.startedAt).toLocaleTimeString()}`),
  )
}

async function render() {
  const { token, session } = await chrome.storage.local.get(['token', 'session'])
  if (!token) return unpaired()
  if (session) return running(session)
  idle()
}

render()
```

- [ ] **Step 6: Load the extension and pair for real**

`chrome://extensions` → Developer mode → Load unpacked → `extension/`. With the dev server running and a code from `/pair`, paste it into the popup.

Expected: the popup flips to the idle state. Then confirm the row is attributed to the real account:

```bash
node -e "
const {neon}=require('@neondatabase/serverless');
require('fs').readFileSync('.env.local','utf8').split('\n').filter(l=>l.startsWith('DATABASE_URL=')).forEach(l=>process.env.DATABASE_URL=l.slice(13).replace(/^\"|\"$/g,''));
neon(process.env.DATABASE_URL)\`select user_id, left(token_hash,8) from device order by created_at desc limit 1\`.then(r=>console.log(r));
"
```

Expected: a `user_…` id matching the signed-in Clerk user, and a hash prefix — never a plaintext token.

If the fetch fails with a CORS or blocked-request error despite `host_permissions`, do not widen the permission. Report it; the fallback is an `OPTIONS` handler plus `Access-Control-Allow-Origin` on the claim route.

- [ ] **Step 7: Verify the offline queue**

Open the popup, right-click → Inspect, Network tab → Offline. In the popup console:

```js
const { post } = await import('./api.js')
await post('/api/events', { sessionId: 'probe', events: [] })
await chrome.storage.local.get('queue')
```

Expected: the call **resolves** with `{ ok: false, queued: true }` — it must not throw — and `queue` holds one `{ path, body, at }` record. Paste both outputs into the report.

- [ ] **Step 8: Commit**

```bash
git add extension
git commit -m "feat: MV3 extension skeleton, pairing popup, offline-tolerant api"
```

---

### Task 4: Record the two amendments and the run evidence

**Files:**
- Modify: `docs/build.md` §5, §7.2, §10, §11
- Modify: `docs/build-intent.md` §7

Documentation is not decoration here: build.md §8 states that when this file and another doc disagree, this file is wrong and gets fixed rather than diverging in code.

- [ ] **Step 1: Amend §7.2's `queue` row**

Change the `queue` shape to `Array<{ path, body, at }>` and note that TASK-006's flush replays records verbatim.

- [ ] **Step 2: Add two rows to §11**

One line each, with the reason:
- Host permission for `http://localhost:3000/*` moved from TASK-007 to TASK-004, because MV3 blocks cross-origin fetch from extension pages without it, so pairing cannot work at all. INV-5 intact: the ban is `<all_urls>`, not the extension's own backend. The prod origin joins when a deployment exists.
- `queue` holds `{ path, body, at }` records rather than raw events, because a generic `post()` cannot queue two shapes and an offline `POST /api/sessions` would otherwise have nowhere to go.

- [ ] **Step 3: Flip §5 statuses**

TASK-003 and TASK-004 → done. TASK-005 → ready.

- [ ] **Step 4: Fill §10 run evidence and build-intent §7**

Fact rows only, from the command output of Tasks 1 and 3: the double-claim 401, the `device` row's `user_id`, the queued record. Actual minutes for T3 and T4 in `build-intent.md` §7.

- [ ] **Step 5: Commit**

```bash
git add docs/build.md docs/build-intent.md
git commit -m "docs: record pairing amendments and run evidence"
```

---

## Self-Review

- **Spec coverage:** mint (T1), atomic claim + token (T1), pairing page (T2), manifest/api/popup/sw (T3), both amendments (T4), all three done-when checks (T1 step 4, T3 step 6, T3 step 7).
- **Placeholders:** none — every code step carries its file's full contents.
- **Type consistency:** `post()` returns `{ ok, status, data }` or `{ ok, queued }` in Task 3 and is consumed only there; claim returns `{ deviceId, token }` in Task 1 and is read as `res.data.token` / `res.data.deviceId` in Task 3.
- **Out of scope, deliberately:** session start/stop, attention events, blocking, unpair, device labels.
