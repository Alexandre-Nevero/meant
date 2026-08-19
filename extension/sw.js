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
