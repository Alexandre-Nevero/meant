const DEFAULT_API_BASE = 'http://localhost:3000'

export async function apiBase() {
  const stored = await chrome.storage.local.get('apiBase')
  if (stored.apiBase) return stored.apiBase
  await chrome.storage.local.set({ apiBase: DEFAULT_API_BASE })
  return DEFAULT_API_BASE
}

// A device token the server no longer accepts (revoked, or the account behind it was
// deleted — ADR-0087, issue #20) must not fail silently (E8) — drop it and every other
// piece of per-account local state, so the next popup open shows why instead of quietly
// carrying a stranger's browsing history, queued writes, or last-typed intention into
// whatever gets paired next. `pathLog`/`queue`/`lastChoice` are cleared here for the same
// reason `session`/`block`/`pendingReview` already were: none of it belongs to nobody.
async function clearAccountState() {
  await chrome.storage.local.set({
    token: null,
    deviceId: null,
    session: null, block: null,
    pendingReview: null,
    pathLog: [], queue: [], lastChoice: null,
    unpairedReason: 'This device was disconnected from your account. Pair again.',
  })
  await chrome.action.setBadgeText({ text: '' }) // ADR-0082: no question is waiting any more
}

export async function get(path) {
  const base = await apiBase()
  const { token } = await chrome.storage.local.get('token')
  try {
    const res = await fetch(base + path, {
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    })
    if (res.status === 401 && token) await clearAccountState()
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch {
    return { ok: false, offline: true }
  }
}

export async function post(path, body, { method = 'POST', queue: shouldQueue = true } = {}) {
  const base = await apiBase()
  const { token } = await chrome.storage.local.get('token')
  try {
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    if (res.status === 401 && token) await clearAccountState()
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch {
    if (shouldQueue) {
      const { queue = [] } = await chrome.storage.local.get('queue')
      queue.push({ method, path, body, at: new Date().toISOString() })
      await chrome.storage.local.set({ queue })
    }
    return { ok: false, offline: true, queued: shouldQueue }
  }
}
