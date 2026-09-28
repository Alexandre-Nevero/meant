// ADR-0087. The extension can't be reached by the web (ADR-0042 refused
// externally_connectable), so it pulls: GET /api/device (device-token auth) returns
// { settings: {companion, judge, coach}, forgetAt }, and this module turns that into the
// chrome.storage.local patch sw.js, popup.js's render() hook, and companion-overlay.js all
// read. companionEnabled/judgeEnabled/coachEnabled are a contract — another agent's code
// reads judgeEnabled directly — so this is the one place that name is written.
import { get } from '../api.js'
import { purgeBefore } from './path-log.js'

/** Pure: a GET /api/device response body -> the exact boolean patch to write. Absent =
 *  on (ADR-0087), so a missing/malformed settings object defaults every feature on rather
 *  than accidentally turning one off. */
export function settingsPatch(body) {
  const settings = body?.settings ?? {}
  return {
    companionEnabled: settings.companion !== false,
    judgeEnabled: settings.judge !== false,
    coachEnabled: settings.coach !== false,
  }
}

/** Pure: forgetAt as the server sends it (an ISO string, or null/absent if the user has
 *  never asked to forget anything) -> epoch ms, or null. */
export function forgetAtMs(value) {
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** Pulls this device's settings and applies them. Called fire-and-forget from sw.js at
 *  startup and from popup.js's render() — never awaited there, so a slow or offline
 *  server can never delay the popup's own render (it animates nothing and opens dozens
 *  of times a day). Not unit-tested past this point: it is a thin chrome.storage/fetch
 *  wire-up over the two pure functions above, which are. */
export async function syncDeviceSettings() {
  // Unpaired devices have nothing to pull (GET /api/device is device-token auth only, so
  // this would just 401) — skip before touching api.js's apiBase() at all. This also keeps
  // a freshly installed/unpaired extension from writing its default apiBase the instant it
  // loads, which used to race an e2e fixture's own apiBase override (both are plain
  // read-then-write against the same storage key, and the fixture wants the last word).
  const { token } = await chrome.storage.local.get('token')
  if (!token) return

  const res = await get('/api/device')
  if (!res.ok || !res.data) return

  await chrome.storage.local.set(settingsPatch(res.data))

  const nextForgetAt = forgetAtMs(res.data.forgetAt)
  if (nextForgetAt === null) return

  const { forgetAt: storedForgetAt, pathLog } = await chrome.storage.local.get(['forgetAt', 'pathLog'])
  if (typeof storedForgetAt === 'number' && storedForgetAt >= nextForgetAt) return

  await chrome.storage.local.set({ forgetAt: nextForgetAt, pathLog: purgeBefore(pathLog, nextForgetAt) })
}
