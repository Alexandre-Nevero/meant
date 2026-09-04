import { post, apiBase } from './api.js'
import { BLOCKLISTS } from './blocklists.js'
import { advance, emptySlice, idleMode, IDLE_DETECTION_S } from './lib/attribution.js'

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
  try {
    const ruleIds = await installRules(blockedDomains)
    const s = await getSession()
    await chrome.storage.local.set({ session: { ...s, ruleIds } })
  } catch (error) {
    await endSession('stopped')
    return { ok: false, error: String(error) }
  }

  // Then tell the server. `post` queues on failure (api.js:33-40), so an offline start syncs on
  // the next flush. The missing `await` is the fire-and-forget and is deliberate.
  post('/api/sessions', { id: sessionId, intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle, startedAt })
  return { ok: true, sessionId }
}

export async function endSession(endReason) {
  const session = await getSession()
  if (!session) return { ok: false }
  try {
    await transition({ mode: session.slice?.mode ?? 'attention', domain: null })
    await flush()
    await post(`/api/sessions/${session.sessionId}`, {
      endedAt: new Date().toISOString(),
      endReason,
    }, { method: 'PATCH' })
  } finally {
    await removeAllRules()
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null, companionState: null })
    if (chrome.sidePanel) {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (tab) await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false }).catch(() => {})
    }
    // No session means no alarm to drain the queue later, so try once more now — this is
    // what lets a queued end-of-session PATCH sync without waiting for the next session.
    await flush()
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

const DRIFT_GRACE_MS = 60_000
const DRIFT_WINDOW_MS = 25 * 60_000
const DRIFT_BUDGET = 3

function isKnownDistraction(domain) {
  return domain != null && Object.values(BLOCKLISTS).some((list) => list.includes(domain))
}

function isCurrentlyBlocked(domain, blocklist) {
  return (blocklist ?? []).some((name) => (BLOCKLISTS[name] ?? []).includes(domain))
}

// The companion, without a model: a visit to a domain from any of the known distraction
// categories (design/blocklists.js) that isn't even one the user chose to block this
// session is drift they'd recognize as drift. No page content, no permission, no
// inference — this is the honest non-AI signal the judge seam (I9) will later replace.
async function updateCompanion(session, nextDomain) {
  const { companionEnabled } = await chrome.storage.local.get('companionEnabled')
  if (companionEnabled === false) return

  const now = Date.now()
  const withinGrace = now - new Date(session.startedAt).getTime() < DRIFT_GRACE_MS
  const drifting = !withinGrace && isKnownDistraction(nextDomain) && !isCurrentlyBlocked(nextDomain, session.blocklist)

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
  return next
}

chrome.idle.setDetectionInterval(IDLE_DETECTION_S)

chrome.idle.onStateChanged.addListener(async (state) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  const mode = idleMode(state, Boolean(tab?.audible))
  if (mode === null) return                       // D27: idle but still playing. Step 3b re-checks.
  await transition({ mode, domain: mode === 'attention' ? await activeDomain() : null })
})

chrome.tabs.onActivated.addListener(async () => {
  await transition({ mode: 'attention', domain: await activeDomain() })
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return
  try {
    await transition({ mode: 'attention', domain: new URL(changeInfo.url).hostname || null })
  } catch {
    await transition({ mode: 'attention', domain: null })
  }
})

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const session = await getSession()
  if (!session) return
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await transition({ mode: 'away', domain: null })
    return
  }
  await transition({ mode: 'attention', domain: await activeDomain() })
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

  await flush()

  // D27's escape hatch needs a re-check, because chrome.idle will not fire again while the
  // system stays idle. Bounded by the alarm period, which satisfies N1 (< 30s loss per gap).
  const idle = await chrome.idle.queryState(IDLE_DETECTION_S)
  if (idle !== 'active') {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    const mode = idleMode(idle, Boolean(tab?.audible))
    if (mode !== null) await transition({ mode, domain: null })
  }

  if (session.plannedMinutes != null) {
    const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
    if (elapsedMs >= session.plannedMinutes * 60_000) {
      await endSession('elapsed')
    }
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    if (message?.type === 'start') {
      const blockedDomains = message.blockedDomains ?? message.blocklist ?? []
      sendResponse(await startSession({ ...message, blockedDomains }))
    } else if (message?.type === 'stop') sendResponse(await endSession('stopped'))
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

// The tick alarm only runs during a session, so without this a queued session-end PATCH
// (e.g. the browser closed offline) would otherwise wait for the next session to sync.
chrome.runtime.onStartup.addListener(flush)
chrome.runtime.onInstalled.addListener(flush)
