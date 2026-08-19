import { post, apiBase } from './api.js'
import { BLOCKLISTS } from './blocklists.js'

const TICK = 'meant-tick'
const RULE_ID_BASE = 1000

async function installRules(listNames) {
  const domains = [...new Set((listNames ?? []).flatMap((name) => BLOCKLISTS[name] ?? []))]
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

  try {
    const ruleIds = await installRules(blocklist)
    const stored = await getSession()
    await chrome.storage.local.set({ session: { ...stored, ruleIds } })
  } catch (error) {
    await endSession('stopped')
    return { ok: false, error: String(error) }
  }
  return { ok: true }
}

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
}

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

export async function flush() {
  const { queue = [] } = await chrome.storage.local.get('queue')
  if (queue.length === 0) return

  const events = queue.filter((r) => r.path === '/api/events')
  const others = queue.filter((r) => r.path !== '/api/events')

  const sentAt = new Set()
  if (events.length > 0) {
    const bySession = new Map()
    for (const record of events) {
      const list = bySession.get(record.body.sessionId) ?? []
      list.push(...record.body.events)
      bySession.set(record.body.sessionId, list)
    }
    for (const [sessionId, batch] of bySession) {
      const res = await post('/api/events', { sessionId, events: batch }, { queue: false })
      if (res.ok) {
        for (const r of events) if (r.body.sessionId === sessionId) sentAt.add(r.at)
      }
    }
  }

  for (const record of others) {
    const res = await post(record.path, record.body, { method: record.method, queue: false })
    if (res.ok) sentAt.add(record.at)
  }

  const { queue: current = [] } = await chrome.storage.local.get('queue')
  await chrome.storage.local.set({ queue: current.filter((r) => !sentAt.has(r.at)) })
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
      await endSession('elapsed')
    }
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message?.type === 'start') sendResponse(await startSession(message))
    else if (message?.type === 'stop') sendResponse(await endSession('stopped'))
    else sendResponse({ ok: false })
  })()
  return true
})

chrome.runtime.onInstalled.addListener(async () => {
  await removeAllRules()
})

chrome.runtime.onStartup.addListener(async () => {
  const session = await getSession()
  if (session) await endSession('recovered')
  else await removeAllRules()
})
