import { test as base, expect } from './fixtures'
import { chromium, type Page, type BrowserContext, type Route } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

// ADR-0086: "try the judge" lives in the popup's outcome view, behind JUDGE_RENDERS, which
// is false because the judge failed its eval. The shipped extension must never show it; the UI
// behind the switch is tested on a throwaway copy with the one boolean flipped. The analyze
// route is mocked: no model runs here, and the mock is the only source of verdicts.

const SHOTS = process.env.JUDGE_SHOTS // optional: a directory to write state screenshots to

const judgeOn = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-ext-judge-'))
    fs.cpSync(path.join(__dirname, '..', 'extension'), extDir, { recursive: true })
    const view = path.join(extDir, 'lib', 'judge-view.js')
    const source = fs.readFileSync(view, 'utf8')
    if (!source.includes('export const JUDGE_RENDERS = false')) throw new Error('JUDGE_RENDERS line moved')
    fs.writeFileSync(view, source.replace('export const JUDGE_RENDERS = false', 'export const JUDGE_RENDERS = true'))
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meant-pw-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    })
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
    fs.rmSync(extDir, { recursive: true, force: true })
  },
})

async function pairPopup(page: Page, extensionId: string) {
  const { code } = await (await page.request.post('/api/pair')).json()
  const { token, deviceId } = await (await page.request.post('/api/pair/claim', { data: { code } })).json()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await page.evaluate(({ token, deviceId }) => new Promise<void>((r) => chrome.storage.local.set({ token, deviceId }, () => r())), { token, deviceId })
  await page.reload()
}
const send = (page: Page, message: object) => page.evaluate((m) => chrome.runtime.sendMessage(m), message) as Promise<any>
const storage = (page: Page, key: string) =>
  page.evaluate((k) => new Promise<any>((r) => chrome.storage.local.get(k, (v: any) => r(v[k] ?? null))), key)
const setStorage = (page: Page, value: object) =>
  page.evaluate((v) => new Promise<void>((r) => chrome.storage.local.set(v, () => r())), value)
const START = { plannedMinutes: 60, blockedDomains: [], blocklists: [], workSites: [], cycle: null }

/** Start, optionally add tasks, stop; returns every task's session id once each row has ended. */
async function endedBlock(page: Page, intentions: string[]) {
  const first = await send(page, { type: 'start', intention: intentions[0], ...START })
  const ids = [first.sessionId]
  for (const intention of intentions.slice(1)) {
    ids.push((await send(page, { type: 'add-task', intention, blockedDomains: [], workSites: [] })).sessionId)
  }
  await send(page, { type: 'stop' })
  for (const id of ids) {
    await expect
      .poll(async () => (await (await page.request.get(`/api/sessions/${id}/review`)).json()).endedAt ?? null, { timeout: 10_000 })
      .not.toBeNull()
  }
  await page.reload()
  await expect(page.getByRole('button', { name: 'Yes' }).first()).toBeVisible()
  return ids
}

async function answerAll(page: Page) {
  for (;;) {
    const yes = page.getByRole('button', { name: 'Yes' })
    const n = await yes.count()
    if (n === 0) break
    await yes.first().click()
    await expect(yes).toHaveCount(n - 1)
  }
}

type Mode = 'rows' | 'nothing' | 'cap' | 'error' | 'offline'
function mockAnalyze(context: BrowserContext) {
  const state = { mode: 'rows' as Mode, calls: [] as any[] }
  return context.route('**/api/judge/analyze', async (route: Route) => {
    const body = route.request().postDataJSON()
    state.calls.push(body)
    const ids: string[] = body.sessionIds
    if (state.mode === 'offline') return route.abort('internetdisconnected')
    if (state.mode === 'cap') return route.fulfill({ status: 429, json: { error: 'daily analysis limit reached (10)' } })
    if (state.mode === 'error') return route.fulfill({ status: 502, json: { error: 'the judge got no usable verdicts back' } })
    const verdicts = state.mode === 'nothing'
      ? ids.map((sessionId) => ({ sessionId, host: 'reddit.com', label: 'unknown', confidence: 0.4 }))
      : ids.flatMap((sessionId, i) => [
          { sessionId, host: i === 0 ? 'docs.google.com' : 'scholar.google.com', label: i === 0 ? 'focused' : 'supportive', confidence: 0.9 },
          { sessionId, host: 'reddit.com', label: 'unknown', confidence: 0.4 },
        ])
    return route.fulfill({ status: 200, json: { analysisId: 'a1', verdicts } })
  }).then(() => state)
}

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `judge-${name}.png`), fullPage: true })
}

base('the shipped extension never offers the judge (ADR-0086)', async ({ context, extensionId, freshAccount }) => {
  const page = await context.newPage()
  await freshAccount(page)
  await pairPopup(page, extensionId)
  await endedBlock(page, ['write the grant report'])
  await answerAll(page)
  await expect(page.getByText(/Good\. That's \d+ of \d+\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try the judge' })).toHaveCount(0)
})

judgeOn('behind the switch: rows, frozen reopen, nothing, cap, error, offline, switched off, many tasks', async ({ context, extensionId, freshAccount }) => {
  judgeOn.setTimeout(120_000) // one account walked through every state, to keep auth users few
  const mock = await mockAnalyze(context)
  const page = await context.newPage()
  await page.setViewportSize({ width: 400, height: 900 })
  await freshAccount(page)
  await pairPopup(page, extensionId)

  const [id] = await endedBlock(page, ['write the grant report'])
  await expect(page.getByText('Did you?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try the judge' })).toHaveCount(0) // unanswered: not judgeable
  await answerAll(page)
  await shot(page, 'offered')

  // Rows: a verdict renders as host · label; `unknown` renders nothing (ADR-0037).
  await page.getByRole('button', { name: 'Try the judge' }).click()
  await expect(page.getByText('docs.google.com · focused')).toBeVisible()
  await expect(page.getByText('reddit.com')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try the judge' })).toHaveCount(0)
  expect(mock.calls.at(-1).sessionIds).toEqual([id])
  expect(Array.isArray(mock.calls.at(-1).paths)).toBe(true)
  await shot(page, 'rows')

  // Reopen: the same analysis shows again without a click (ADR-0077: the route returns it frozen).
  const before = mock.calls.length
  await page.reload()
  await expect(page.getByText('docs.google.com · focused')).toBeVisible()
  expect(mock.calls.length).toBe(before + 1)

  const fresh = async (mode: Mode) => {
    mock.mode = mode
    await page.evaluate(() => new Promise<void>((r) => chrome.storage.local.remove('lastJudged', () => r())))
    await page.reload()
    await page.getByRole('button', { name: 'Try the judge' }).click()
  }

  await fresh('nothing')
  await expect(page.getByText('Nothing the judge is sure of.')).toBeVisible()
  await shot(page, 'nothing')

  await fresh('cap')
  await expect(page.getByText("That's today's analyses. Try again tomorrow.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try the judge' })).toHaveCount(0)
  await shot(page, 'cap')

  await fresh('error')
  await expect(page.getByText("The judge didn't answer. Try again in a moment.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try the judge' })).toBeEnabled()
  await shot(page, 'error')

  await fresh('offline')
  await expect(page.getByText("Can't reach it right now.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try the judge' })).toBeEnabled()
  expect(await storage(page, 'queue')).toBeNull() // an analysis is never queued for later, paths least of all
  await shot(page, 'offline')

  // The settings switch writes judgeEnabled: false; absent means on.
  await setStorage(page, { judgeEnabled: false })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try the judge' })).toHaveCount(0)
  await page.evaluate(() => new Promise<void>((r) => chrome.storage.local.remove('judgeEnabled', () => r())))

  // ADR-0084: one block, several tasks, one analysis for all of them, rows under each task.
  await page.getByRole('button', { name: 'Done' }).click()
  mock.mode = 'rows'
  const ids = await endedBlock(page, ['write the letter', 'research sources'])
  await answerAll(page)
  await page.getByRole('button', { name: 'Try the judge' }).click()
  await expect(page.getByText('For "write the letter":')).toBeVisible()
  await expect(page.getByText('For "research sources":')).toBeVisible()
  await expect(page.getByText('docs.google.com · focused')).toBeVisible()
  await expect(page.getByText('scholar.google.com · supportive')).toBeVisible()
  expect([...mock.calls.at(-1).sessionIds].sort()).toEqual([...ids].sort())
  await shot(page, 'many')
})
