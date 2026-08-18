const DEFAULT_API_BASE = 'http://localhost:3000'

export async function apiBase() {
  const stored = await chrome.storage.local.get('apiBase')
  if (stored.apiBase) return stored.apiBase
  await chrome.storage.local.set({ apiBase: DEFAULT_API_BASE })
  return DEFAULT_API_BASE
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
