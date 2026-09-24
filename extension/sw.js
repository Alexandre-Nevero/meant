import { post, apiBase } from './api.js'
import { BLOCKLISTS } from './blocklists.js'
import { advance, emptySlice, idleMode, IDLE_DETECTION_S } from './lib/attribution.js'
import { appendVisit, purgeExpired } from './lib/path-log.js'
import { labelCurrentVisit, labelsToEvents } from './lib/visit-label.js'
import { MAX_TASKS, addTask, switchTask, closingEvents } from './lib/block.js'

const TICK = 'meant-tick'
const RULE_ID_BASE = 1000

// A storage race guard. transition() (and everything it's nested inside — endSession,
// addTaskToSession, switchToTask, recordNotTheWork) does an unguarded read-modify-write of
// the `session`/`block` storage keys. Two top-level listener callbacks running their bodies
// concurrently can interleave those reads and writes and silently drop one's update — worse
// since ADR-0084, because addTaskToSession/switchToTask's own rule swap can itself trigger a
// tabs.onUpdated event (the blocked.html redirect) whose transition() call races the very
// function that triggered it. serialized() queues entry points onto one promise chain so
// only one is ever running at a time. Wrap ONLY the outermost listener callbacks below —
// never transition() or any other helper — or a nested call would await a chain link that
// is itself waiting on the outer call, and deadlock.
let chain = Promise.resolve()
function serialized(fn) {
  const result = chain.then(fn, fn)
  chain = result.catch(() => {})
  return result
}

async function installRules(listNames) {
  const domains = [...new Set((listNames ?? []).flatMap((name) => BLOCKLISTS[name] ?? [name]))]
  if (domains.length === 0) return { ruleIds: [], domains: [] }

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
  return { ruleIds: domains.map((_, i) => RULE_ID_BASE + i), domains }
}

async function removeAllRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules()
  if (existing.length === 0) return
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
  })
}

// declarativeNetRequest only intercepts NEW navigation requests — a tab already loaded on a
// domain that just became blocked keeps working until it happens to navigate again. Sweep
// every open tab once, right after the rules install, so "Start" is honest immediately.
async function sweepOpenTabs(domains) {
  if (domains.length === 0) return
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue
    const hostname = safeHostname(tab.url)
    if (hostname && domains.includes(hostname)) {
      const url = chrome.runtime.getURL(`blocked.html?d=${encodeURIComponent(hostname)}`)
      chrome.tabs.update(tab.id, { url }).catch(() => {})
    }
  }
}

// The forward sweep (sweepOpenTabs, above) redirects an already-open tab to blocked.html
// the moment a domain becomes blocked. This is the inverse, run when a session ends: a
// tab sitting on blocked.html for a domain THIS session blocked has nothing that
// navigates it back on its own — declarativeNetRequest only intercepts NEW navigation
// attempts, so removing the rule (removeAllRules, called right before this) never
// un-redirects a tab that's already redirected. Scoped to this session's own
// blockedDomains only — a stale blocked.html tab left over from an earlier,
// already-ended session must not get swept by a DIFFERENT session's own end.
async function sweepBlockedTabsBack(domains) {
  if (!domains || domains.length === 0) return
  const blockedUrlPrefix = chrome.runtime.getURL('blocked.html')
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !tab.url.startsWith(blockedUrlPrefix)) continue
    const blockedDomain = new URL(tab.url).searchParams.get('d')
    if (blockedDomain && domains.includes(blockedDomain)) {
      chrome.tabs.update(tab.id, { url: `https://${blockedDomain}` }).catch(() => {})
    }
  }
}

export async function getSession() {
  const { session } = await chrome.storage.local.get('session')
  return session ?? null
}

async function getBlock() {
  const { block } = await chrome.storage.local.get('block')
  return block ?? null
}

// ADR-0084. Blocks follow the active task: lift the rules, send the old task's blocked tabs back
// (only those the new task does not also block), then lay the new task's rules and sweep.
// Same order as endSession, and for the same reason: a rule still installed during the
// sweep-back would redirect that navigation straight back to blocked.html.
async function swapRules(fromDomains, toDomains) {
  await removeAllRules()
  await sweepBlockedTabsBack((fromDomains ?? []).filter((d) => !(toDomains ?? []).includes(d)))
  const { ruleIds, domains } = await installRules(toDomains)
  await sweepOpenTabs(domains)
  return ruleIds
}

// Strips `www.` so a tracked visit matches the same bare form the user configures
// everywhere else (setup, the popup's site chips) — `new URL().hostname` alone
// left `www.facebook.com` on the review page next to a configured `facebook.com`,
// looking like two different sites. Unlike normalizeDomain (extension/lib/
// normalize-domain.js), this never rejects a no-dot hostname: a visited tab's
// hostname (e.g. `localhost`) is already valid, not user-typed free text.
//
// Only http/https are real, trackable sites — a chrome-extension:// URL (the
// popup itself, blocked.html) parses fine and its "hostname" is just the
// extension's own random-looking ID, which must never be attributed time as if
// it were a site the user visited.
function bareHostname(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const hostname = parsed.hostname.toLowerCase()
  return (hostname.startsWith('www.') ? hostname.slice(4) : hostname) || null
}

// bareHostname throws on an unparseable URL (e.g. chrome://, about:blank) — every call
// site just wants the bare hostname or null, never the exception. One shared guard
// instead of each site repeating its own try/catch.
function safeHostname(url) {
  try {
    return bareHostname(url)
  } catch {
    return null
  }
}

/** The active tab's bare hostname AND its full URL. The URL never leaves the device
 *  (ADR-0059) — it is handed to transition() only so the on-device path log can record
 *  which part of a site this was. `event.domain` still receives the hostname alone. */
async function activeTarget() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.url) return { domain: null, url: null }
  return { domain: safeHostname(tab.url), url: tab.url }
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
      ruleIds: [], signals: [], corrected: [], judged: {},
      labels: [],                                   // ADR-0058: the companion's one-tap labels
      tally: { attention: {}, away: 0, break: 0 },
      blockId: sessionId, lockFrom: startedAt,      // ADR-0084: a new session is a block of one
    },
    block: { id: sessionId, tasks: [] },
    companionState: 'settled',
  })
  await chrome.alarms.create(TICK, { periodInMinutes: 0.5 })
  // Seed the slice with whatever tab is ALREADY focused right now — without this, an
  // already-active tab gets zero attention time until some other event (tab switch,
  // URL update, window focus change, or a 30s alarm tick) happens to fire next, which
  // may never happen if the user just stays on the same tab. The url goes too (ADR-0059),
  // or the very first page of every session would be the one page with no path recorded.
  const seed = await activeTarget()
  await transition({ mode: 'attention', domain: seed.domain, url: seed.url })
  try {
    const { ruleIds, domains } = await installRules(blockedDomains)
    const s = await getSession()
    await chrome.storage.local.set({ session: { ...s, ruleIds } })
    await sweepOpenTabs(domains)
  } catch (error) {
    console.error('startSession: installRules failed', error)
    // Distinct from 'stopped'/'elapsed': this session never actually ran (and was never
    // POSTed, since that fire-and-forget happens after this try/catch) — its GET would
    // always 404, so it must never earn a pendingReview marker either. endSession's own
    // `endReason === 'stopped' || endReason === 'elapsed'` check is what gates that.
    await endSession('start-failed')
    return { ok: false, error: String(error) }
  }

  // Then tell the server. `post` queues on failure (api.js:33-40), so an offline start syncs on
  // the next flush. The missing `await` is the fire-and-forget and is deliberate.
  // localHour comes from the SAME `now` that produced startedAt — reading the clock again
  // here could let the two disagree (e.g. across a midnight rollover mid-function).
  const localHour = new Date(now).getHours()
  post('/api/sessions', { id: sessionId, intention, plannedMinutes, blockedDomains, blocklists, workSites, cycle, startedAt, localHour, blockId: sessionId })
  return { ok: true, sessionId }
}

/** ADR-0084. A new intention becomes the active task; the current one is parked. Rules swap
 *  FIRST, so a failed swap aborts with nothing else changed (and the old rules restored). */
export async function addTaskToSession({ intention, blockedDomains = [], workSites = [] }) {
  const current = await getSession()
  const block = await getBlock()
  if (!current || !block) return { ok: false, error: 'no-session' }
  if (1 + block.tasks.length >= MAX_TASKS) return { ok: false, error: 'max-tasks' }

  let ruleIds
  try {
    ruleIds = await swapRules(current.blockedDomains, blockedDomains)
  } catch (error) {
    console.error('addTaskToSession: rules failed', error instanceof Error ? error.name : 'unknown')
    await swapRules(blockedDomains, current.blockedDomains).catch(() => {})
    return { ok: false, error: 'rules' }
  }

  const now = Date.now()
  const closed = (await transition({ mode: current.slice?.mode ?? 'attention', domain: null, at: now })) ?? current
  const sessionId = crypto.randomUUID()
  const task = {
    sessionId, intention, startedAt: current.startedAt, plannedMinutes: current.plannedMinutes,
    blockedDomains, blocklists: [], workSites, cycle: current.cycle,
    slice: emptySlice(now), dwellSince: now, visitSeq: 0,
    ruleIds, signals: [], corrected: [], judged: {},
    labels: [],
    tally: { attention: {}, away: 0, break: 0 },
    blockId: block.id, lockFrom: new Date(now).toISOString(),
  }
  const next = addTask(block, closed, task, now)
  await chrome.storage.local.set({ session: next.active, block: next.block })
  if (next.paused) await enqueue(next.active, next.paused)
  const seed = await activeTarget()
  await transition({ mode: 'attention', domain: seed.domain, url: seed.url })
  // AWAITED, unlike startSession's fire-and-forget: a Stop pressed right after "+ task" would
  // otherwise PATCH this row's end before its insert lands, and a 404 PATCH is never queued —
  // the task would stay open forever. Offline, post() queues it and returns at once, and flush()
  // replays the queue in order (this insert before that PATCH). The row shares the block's
  // clock: same started_at, same hour (ADR-0067's hour is the block's).
  await post('/api/sessions', {
    id: sessionId, intention, plannedMinutes: current.plannedMinutes, blockedDomains, blocklists: [],
    workSites, cycle: current.cycle, startedAt: current.startedAt,
    localHour: new Date(current.startedAt).getHours(), blockId: block.id,
  })
  return { ok: true, sessionId }
}

/** ADR-0084. One tap from one task to another; rules swap first, exactly as above. */
export async function switchToTask(targetId) {
  const current = await getSession()
  const block = await getBlock()
  const target = block?.tasks.find((t) => t.sessionId === targetId)
  if (!current || !target) return { ok: false, error: 'no-task' }

  let ruleIds
  try {
    ruleIds = await swapRules(current.blockedDomains, target.blockedDomains)
  } catch (error) {
    console.error('switchToTask: rules failed', error instanceof Error ? error.name : 'unknown')
    await swapRules(target.blockedDomains, current.blockedDomains).catch(() => {})
    return { ok: false, error: 'rules' }
  }

  const now = Date.now()
  const closed = (await transition({ mode: current.slice?.mode ?? 'attention', domain: null, at: now })) ?? current
  const next = switchTask(block, closed, targetId, now)
  await chrome.storage.local.set({ session: { ...next.active, ruleIds }, block: next.block })
  if (next.paused) await enqueue(next.active, next.paused)
  const seed = await activeTarget()
  await transition({ mode: 'attention', domain: seed.domain, url: seed.url })
  return { ok: true }
}

/** ADR-0082. Opens the popup to ask "Did you?" — at an elapsed end, and again on the next
 *  window focus if Chrome had no focused window to open it into. No user gesture needed since
 *  Chrome 127; the only failure is "no active browser window", which leaves askPending set. */
async function askOutcome() {
  const { pendingReview, askPending } = await chrome.storage.local.get(['pendingReview', 'askPending'])
  if (!pendingReview || !askPending) return
  try {
    await chrome.action.openPopup()
    await chrome.storage.local.set({ askPending: false })
  } catch {
    // The user is in another app. onFocusChanged below tries again when they come back.
  }
}
self.askOutcome = askOutcome

export async function endSession(endReason) {
  const session = await getSession()
  if (!session) return { ok: false }
  const block = await getBlock()
  const parked = block?.tasks ?? []
  const endedAt = new Date().toISOString()
  try {
    await transition({ mode: session.slice?.mode ?? 'attention', domain: null })
    // ADR-0084: each parked task's last stretch of inactivity, then every row ends together.
    // Skipped on 'recovered': that stretch spans the time the browser was actually closed, which
    // was NOT observed as "on another task" — it's unrecorded, same as it always was for the
    // active task. Attributing it as paused would hide the real gap behind a false attribution.
    if (endReason !== 'recovered') {
      for (const { sessionId, event } of closingEvents(block, Date.parse(endedAt))) {
        await enqueue({ sessionId }, event)
      }
    }
    await flush()
    for (const id of [session.sessionId, ...parked.map((t) => t.sessionId)]) {
      await post(`/api/sessions/${id}`, { endedAt, endReason }, { method: 'PATCH' })
    }
  } finally {
    // removeAllRules() must run BEFORE the sweep: declarativeNetRequest intercepts the
    // sweep's own tabs.update navigation just like any other new navigation attempt — if
    // the block rule is still installed at that instant, the sweep's navigation to the
    // real site gets redirected right back to blocked.html (the exact same URL, so it
    // looks like nothing happened). Removing the rule first closes that race.
    await removeAllRules()
    // A parked task's rules are already lifted, but a tab can still sit on its blocked.html.
    await sweepBlockedTabsBack([...new Set([session, ...parked].flatMap((t) => t.blockedDomains ?? []))])
    await chrome.alarms.clear(TICK)
    await chrome.storage.local.set({ session: null, block: null, companionState: null })
    // No session means no alarm to drain the queue later, so try once more now — this is
    // what lets a queued end-of-session PATCH sync without waiting for the next session.
    await flush()
  }

  if (endReason === 'stopped' || endReason === 'elapsed') {
    await chrome.storage.local.set({
      pendingReview: { sessionId: session.sessionId, sessionIds: [session.sessionId, ...parked.map((t) => t.sessionId)] },
    })
    await chrome.action.setBadgeText({ text: '?' }) // ADR-0082: until the popup's Done
  }
  // Only an elapsed end asks by itself: after 'stopped' the popup is already open on the question.
  if (endReason === 'elapsed') {
    await chrome.storage.local.set({ askPending: true })
    await askOutcome()
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

async function transition({ mode, domain, url = null, at = Date.now() }) {
  const session = await getSession()
  if (!session) return

  // ADR-0059: the path goes to chrome.storage.local and nowhere else. Deliberately BEFORE
  // the early returns below so a visit is recorded even on a tick that produces no event.
  if (mode === 'attention' && url) {
    const { pathLog } = await chrome.storage.local.get('pathLog')
    const next = appendVisit(pathLog, { url, at, sessionId: session.sessionId })
    if (next !== pathLog) await chrome.storage.local.set({ pathLog: next })
  }
  const prior = session.slice ?? emptySlice(new Date(session.startedAt).getTime())
  const { events, state } = advance(prior, { at, mode, domain })
  // Known limitation: this read-modify-write is a lost-update race if two transition() calls
  // overlap (e.g. a tab switch racing the 30s tick alarm) — the later write can silently drop
  // an earlier call's tally increment. Harmless for slice/dwellSince (last-write-wins state)
  // but tally is an accumulator, so a lost update means permanently undercounted seconds.
  // Not fixed here — recorded so it isn't rediscovered from scratch.
  const tally = session.tally?.attention ? session.tally : { attention: {}, away: 0, break: 0 }
  for (const event of events) {
    await enqueue(session, event)
    if (event.kind === 'attention' && event.domain) {
      tally.attention[event.domain] = (tally.attention[event.domain] ?? 0) + event.seconds
    } else if (event.kind === 'away') tally.away += event.seconds
    else if (event.kind === 'break') tally.break += event.seconds
  }
  // dwellSince survives service-worker death because it lives in storage.
  const dwellSince = state.domain && state.domain === prior.domain ? (session.dwellSince ?? at) : at
  const next = { ...session, slice: state, dwellSince, tally }
  await chrome.storage.local.set({ session: next })
  return next
}

chrome.idle.setDetectionInterval(IDLE_DETECTION_S)

chrome.idle.onStateChanged.addListener(async (state) => {
  return serialized(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    const mode = idleMode(state, Boolean(tab?.audible))
    if (mode === null) return                       // D27: idle but still playing. Step 3b re-checks.
    const target = mode === 'attention' ? await activeTarget() : { domain: null, url: null }
    await transition({ mode, domain: target.domain, url: target.url })
  })
})

chrome.tabs.onActivated.addListener(async () => {
  return serialized(async () => {
    const { domain, url } = await activeTarget()
    await transition({ mode: 'attention', domain, url })
  })
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  return serialized(async () => {
    if (!changeInfo.url || !tab.active) return
    await transition({ mode: 'attention', domain: safeHostname(changeInfo.url), url: changeInfo.url })
  })
})

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  return serialized(async () => {
    const session = await getSession()
    if (!session) return
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await transition({ mode: 'away', domain: null })
      return
    }
    const { domain, url } = await activeTarget()
    await transition({ mode: 'attention', domain, url })
  })
})

// ADR-0082. A second listener, not a branch in the one above: that one returns early when no
// session is running, which is exactly when an elapsed session's question is waiting.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) askOutcome()
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
  return serialized(async () => {
    if (alarm.name !== TICK) return
    const session = await getSession()
    if (!session) return

    await flush()

    // ADR-0059's TTL. The only thing bounding the on-device path log for a user who never
    // runs an analysis, which is every free-tier user by design. Write only when something
    // actually expired, so the common case costs one read and no write.
    const { pathLog } = await chrome.storage.local.get('pathLog')
    if (Array.isArray(pathLog) && pathLog.length > 0) {
      const kept = purgeExpired(pathLog, Date.now())
      if (kept.length !== pathLog.length) await chrome.storage.local.set({ pathLog: kept })
    }

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
})

/** ADR-0058. The companion's one tap: "this isn't the work."
 *
 *  A self-report cannot be a false positive, which is why this replaces the live drift
 *  signal ADR-0057 removed rather than fixing it. The label lands on the CURRENT VISIT
 *  (ADR-0062 — pencil, not stone); memory forms only when it recurs past
 *  MEMORY_MIN_EVIDENCE / MEMORY_MIN_AGREEMENT, never at n=1. */
async function recordNotTheWork() {
  const session = await getSession()
  if (!session) return { ok: false, reason: 'no-session' }

  const domain = (await activeTarget()).domain
  const next = labelCurrentVisit(session, domain, Date.now())
  // Unchanged means the tap was a no-op — no domain, or a duplicate inside the tap window.
  // Don't write, and don't enqueue an event the server would have to de-duplicate.
  if (next === session) return { ok: true, recorded: false }

  await chrome.storage.local.set({ session: next })
  const [event] = labelsToEvents(next.labels.slice(-1))
  await enqueue(next, event)
  return { ok: true, recorded: true, domain }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only the inner async work queues on the mutex — sendResponse's Promise-keeping `return
  // true` below must fire synchronously, before serialized()'s fn has even started, or Chrome
  // would tear the message channel down before this message's turn in the queue arrives.
  serialized(async () => {
    if (message?.type === 'start') {
      const blockedDomains = message.blockedDomains ?? message.blocklist ?? []
      sendResponse(await startSession({ ...message, blockedDomains }))
    } else if (message?.type === 'stop') sendResponse(await endSession('stopped'))
    else if (message?.type === 'not-the-work') sendResponse(await recordNotTheWork())
    else if (message?.type === 'add-task') sendResponse(await addTaskToSession(message))
    else if (message?.type === 'switch-task') sendResponse(await switchToTask(message.sessionId))
    else if (message?.type === 'open-meant') {
      ;(async () => {
        if (chrome.action?.openPopup) {
          try {
            await chrome.action.openPopup()
            return
          } catch {}
        }
        const base = await apiBase()
        await chrome.tabs.create({ url: `${base}/dashboard` }).catch(() => {})
      })()
      sendResponse({ ok: true })
    } else sendResponse({ ok: false })
  })
  return true
})

// Confirmed empirically (not assumed): for an unpacked extension, Chromium fires
// onInstalled (reason 'update') on every relaunch, never onStartup — the official docs
// don't state this explicitly for the browser-restart case, only for chrome.runtime.reload().
// A real user's own "Load unpacked" install may behave differently (unverified — that
// specific case needs a human, not Playwright); rather than gamble on which event actually
// fires for them, both listeners run the same recovery so a live session can never leak
// regardless of which one Chromium chooses.
async function recoverStaleSession() {
  return serialized(async () => {
    const session = await getSession()
    if (session) await endSession('recovered')
    else {
      await removeAllRules()
      await chrome.storage.local.set({ block: null }) // ADR-0084: never a block without its active task
    }
  })
}

chrome.runtime.onInstalled.addListener(recoverStaleSession)
chrome.runtime.onStartup.addListener(recoverStaleSession)

/** ADR-0082. The badge is only ever SET inside endSession; nothing re-applies it after a
 *  service-worker restart or extension update. Wired to both onInstalled and onStartup for
 *  the same reason recoverStaleSession above is: an unpacked extension's relaunch behaviour
 *  isn't guaranteed to fire one over the other. Idempotent either way. */
async function resyncBadge() {
  const { pendingReview } = await chrome.storage.local.get('pendingReview')
  await chrome.action.setBadgeText({ text: pendingReview ? '?' : '' })
}
chrome.runtime.onInstalled.addListener(resyncBadge)
chrome.runtime.onStartup.addListener(resyncBadge)

// The tick alarm only runs during a session, so without this a queued session-end PATCH
// (e.g. the browser closed offline) would otherwise wait for the next session to sync.
chrome.runtime.onStartup.addListener(flush)
chrome.runtime.onInstalled.addListener(flush)

// content_scripts only runs declaratively on a tab's own (re)load — it never re-fires for
// a tab that was already open when the extension was reloaded/updated, or across a browser
// restart, leaving that tab's companion orphaned until the user manually refreshes it. This
// walks every open http(s) tab and re-injects the same content script chrome would have run
// declaratively, recovering it without the user doing anything.
async function reinjectCompanion() {
  // I9's companion seam. This check used to live in updateCompanion(), which ADR-0057
  // deleted — and it was that function's ONLY reader, so without moving it here the
  // companion would have lost its off-switch entirely. The switch belongs at the
  // injection point anyway: turning the companion off should mean not mounting it,
  // not mounting a companion that declines to react.
  const { companionEnabled } = await chrome.storage.local.get('companionEnabled')
  if (companionEnabled === false) return

  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue
    // Only http(s) — chrome://, the Chrome Web Store, and other extensions' pages
    // reject scripting injection outright; skip them rather than let each one throw.
    if (!/^https?:\/\//.test(tab.url)) continue
    try {
      const parsedUrl = new URL(tab.url)
      const host = parsedUrl.hostname.toLowerCase()
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === 'meant.app' ||
        host.endsWith('.meant.app') ||
        host.includes('meant-')
      ) {
        // MEANT web app has native companion actor; remove any stray overlay and skip
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.querySelector('[data-meant-companion]')?.remove(),
        })
        continue
      }
    } catch {}
    try {
      // This function only ever runs from onInstalled/onStartup — i.e. only at the
      // moment a brand-new extension instance is starting. Any [data-meant-companion]
      // host already in a tab's DOM at that exact moment can only be a leftover from a
      // PREVIOUS, now-dead instance: an extension reload kills the old instance's
      // chrome.* access but does not touch the DOM it already built, so a zombie host
      // can sit there, inert, forever. Clear it first so the real injection below isn't
      // blocked by companion-overlay.js's own already-mounted guard — that guard exists
      // to protect a different race (this same reinject landing around the same moment
      // as a declarative content_scripts injection), not to protect a stale element
      // from a prior instance. Worst case if both races overlap: whichever injection
      // runs second sees the other's freshly-mounted host and bails via that guard —
      // one harmless remount flicker, never two permanent hosts.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.querySelector('[data-meant-companion]')?.remove(),
      })
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['companion-overlay.js'] })
    } catch {
      // A tab can still reject injection for reasons outside our control — it navigated
      // away between the query and the injection attempt, or another genuine
      // executeScript rejection — skip it, don't let one tab's failure stop the rest.
    }
  }
}
self.reinjectCompanion = reinjectCompanion
chrome.runtime.onInstalled.addListener(reinjectCompanion)
chrome.runtime.onStartup.addListener(reinjectCompanion)

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.companionEnabled?.newValue === true) {
    reinjectCompanion().catch(() => {})
  }
})
