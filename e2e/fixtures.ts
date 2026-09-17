import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { testDatabaseUrlFrom } from '../lib/db-guard'

const EXTENSION_PATH = path.join(__dirname, '..', 'extension')

/** The one database handle for every fixture that has to look at a row directly.
 *
 *  playwright.config.ts injects DATABASE_URL through webServer.env: that reaches the Next server,
 *  not this process. So the URL is read here the same way the config reads it, through the guard
 *  that refuses any database whose name does not end in _test. Never process.env, never a
 *  connection string assembled locally — the guard is the only door.
 *
 *  Lazy, so a spec that uses neither fixture pays nothing and fails on nothing. */
const connect = () =>
  neon(testDatabaseUrlFrom(fs.readFileSync(path.join(__dirname, '..', '.env.test'), 'utf8')))
let handle: ReturnType<typeof connect> | null = null
const db = () => (handle ??= connect())

/** One session to write straight into the database. `startedAtLocalHour` is the column added by
 *  lib/migrations/005-local-hour.sql; omit it (or pass null) for the "unknown hour" case, which
 *  the time-of-day contrast must exclude rather than bucket. */
type SeedSession = {
  outcome: 'yes' | 'no' | 'unanswered'
  startedAtLocalHour?: number | null
  intention?: string
  events?: { kind: string; domain: string; seconds: number }[]
}

type Fixtures = {
  context: BrowserContext
  extensionId: string
  freshAccount: (page: Page) => Promise<{ email: string; password: string }>
  endedSession: (opts: { intention: string; events?: unknown[] }) => Promise<string>
  seededUser: (sessions: SeedSession[]) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-pw-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    })
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },

  extensionId: async ({ context, baseURL }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')

    // extension/api.js:1 defaults apiBase to http://localhost:3000 — the port this suite used
    // before #18 gave it its own server on 3100. Left unset, every write the EXTENSION makes
    // (sessions, events, pairing claims) goes to whatever is listening on :3000, which on a
    // developer's machine is `next dev` reading .env.local: production. #18's webServer.env
    // guards the page's traffic and the database; it never covered the extension, which talks
    // to an origin of its own. Seeded from the service worker so it lands before any spec runs.
    await sw.evaluate(
      (base) => new Promise<void>((r) => chrome.storage.local.set({ apiBase: base }, () => r())),
      baseURL!,
    )

    await use(sw.url().split('/')[2])
  },

  freshAccount: async ({}, use) => {
    await use(async (page: Page) => {
      const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
      const password = 'e2e-test-password-1'
      // Sign-in/sign-up lives at /sign-in, not the landing page itself — the landing
      // page (/) never carries an inline auth form.
      await page.goto('/sign-in')
      // The signup form is the second <form> on the page (Fields() is shared by both;
      // signup adds a leading Name field) — scope by the "Create an account" button
      // text rather than a brittle nth-of-type guess.
      const signupForm = page.getByRole('form', { name: 'Create an account' })
      await signupForm.getByLabel('Name').fill('E2E Test')
      await signupForm.getByLabel('Email').fill(email)
      await signupForm.getByLabel('Password').fill(password)
      await signupForm.getByRole('button', { name: 'Create an account' }).click()
      await page.waitForURL('**/dashboard')
      return { email, password }
    })
  },

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
      // Was waitForTimeout(500). startSession's creation POST (extension/sw.js:164) is
      // fire-and-forget, so the row may not exist yet — but a fixed sleep is a guess, and a
      // cold-compiling first hit outruns it. Poll the row itself.
      await expect
        .poll(async () => (await page.request.get(`/api/sessions/${sessionId}/review`)).status(), {
          timeout: 10_000,
        })
        .toBe(200)
      // The ONLY assertion anywhere on the localHour write path — extension/sw.js's POST body,
      // normalizeStartPayload, the route's INSERT, the column. normalizeStartPayload is unit
      // tested in isolation and every time-of-day e2e seeds the column with raw SQL through
      // seededUser, bypassing both the route and the extension. Delete `localHour` from either
      // end without this and all 165 unit and 94 e2e tests stay green — while the failure looks
      // exactly like the accepted "silent until eight answered sessions accumulate" state, so
      // nobody would ever notice. The hour comes from the test machine's own clock, so the
      // assertion is on the shape, not on a value.
      const [row] = await db()`select started_at_local_hour as hour from session where id = ${sessionId}`
      expect(
        Number.isInteger(row?.hour) && row.hour >= 0 && row.hour <= 23,
        `session.started_at_local_hour must be an integer 0-23; got ${JSON.stringify(row?.hour)}`,
      ).toBe(true)
      if (events.length > 0) {
        // The same API sw.js's own flush() uses — deterministic, no dependency on real timing.
        const res = await context.request.post('/api/events', {
          headers: { authorization: `Bearer ${token}` },
          data: { sessionId, events },
        })
        if (res.status() !== 200) throw new Error(`event injection failed: ${res.status()}`)
      }
      await page.evaluate(() => chrome.runtime.sendMessage({ type: 'stop' }))
      // Every call site opens its own page to look at the result — nothing reads this one
      // again. Left open, it leaked one page (and one real auth user's session) per call.
      await page.close()
      return sessionId
    })
  },

  // endedSession makes a fresh account per call, so no test using it can reach
  // PATTERN_MIN_SESSIONS sessions for ONE user — which is every test of the evidence floor.
  // This signs up and pairs once, then writes N finished sessions for that same user directly.
  seededUser: async ({ context, freshAccount }, use) => {
    const sql = db()
    await use(async (seeds) => {
      const page = await context.newPage()
      await freshAccount(page)
      // session.device_id is NOT NULL and references device(id), so a seeded row needs a real
      // device. Pairing through the API is the only thing that makes one; no extension is
      // involved, because nothing here goes through the extension's code path.
      const { code } = await (await page.request.post('/api/pair')).json()
      const { deviceId } = await (await page.request.post('/api/pair/claim', { data: { code } })).json()
      const [device] = await sql`select user_id from device where id = ${deviceId}`

      // A minute apart, ascending with the index, so `order by started_at desc` is deterministic.
      // The step compresses when the month is younger than the seeds are wide: the headline
      // counts `started_at >= date_trunc('month', now())`, which Postgres evaluates in the
      // server's timezone (UTC on Neon), so a suite run in the first few minutes of a month
      // would otherwise push its oldest rows into the previous one and quietly change every
      // count this fixture's tests assert. (The one gap left: a run that starts writing within
      // `seeds.length` MILLISECONDS of the rollover, where the step clamps to 1ms. Not worth
      // more code — the round trips above make that window unreachable.)
      const now = Date.now()
      const utc = new Date(now)
      const monthStart = Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), 1)
      const step = Math.max(1, Math.min(60_000, Math.floor((now - monthStart) / (seeds.length + 1))))

      for (const [i, seed] of seeds.entries()) {
        const startedAt = new Date(now - (seeds.length - i) * step)
        // Half a minute long normally; never longer than the step, so a compressed run cannot
        // order a session's end after the next session's start.
        const endedAt = new Date(startedAt.getTime() + Math.min(30_000, step))
        const [row] = await sql`
          insert into session (user_id, device_id, intention, started_at, ended_at, end_reason,
                               outcome, started_at_local_hour)
          values (${device.user_id}, ${deviceId}, ${seed.intention ?? `seeded session ${i + 1}`},
                  ${startedAt.toISOString()}, ${endedAt.toISOString()}, 'stopped',
                  ${seed.outcome}, ${seed.startedAtLocalHour ?? null})
          returning id`
        for (const e of seed.events ?? []) {
          await sql`
            insert into event (session_id, kind, domain, seconds, at)
            values (${row.id}, ${e.kind}, ${e.domain}, ${e.seconds}, ${startedAt.toISOString()})`
        }
      }
      return page
    })
  },
})

export { expect } from '@playwright/test'
