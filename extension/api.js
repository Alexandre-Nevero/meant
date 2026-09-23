const DEFAULT_API_BASE = 'http://localhost:3000'

export async function apiBase() {
  const stored = await chrome.storage.local.get('apiBase')
  if (stored.apiBase) return stored.apiBase
  await chrome.storage.local.set({ apiBase: DEFAULT_API_BASE })
  return DEFAULT_API_BASE
}

export async function get(path) {
  const base = await apiBase()
  const { token } = await chrome.storage.local.get('token')
  try {
    const res = await fetch(base + path, {
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    })
    if (res.status === 401 && token) {
      await chrome.storage.local.set({
        token: null,
        deviceId: null,
        session: null,
        pendingReview: null,
        unpairedReason: 'This device was disconnected from your account. Pair again.',
      })
      await chrome.action.setBadgeText({ text: '' }) // ADR-0082: no question is waiting any more
    }
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
    // A device token the server no longer accepts (revoked, or never valid) must not
    // fail silently (E8) — drop it and any session so the next popup open shows why.
    if (res.status === 401 && token) {
      await chrome.storage.local.set({
        token: null,
        deviceId: null,
        session: null,
        pendingReview: null,
        unpairedReason: 'This device was disconnected from your account. Pair again.',
      })
      await chrome.action.setBadgeText({ text: '' }) // ADR-0082: no question is waiting any more
    }
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
