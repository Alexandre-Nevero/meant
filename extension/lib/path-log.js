// ADR-0059 — the on-device path log.
//
// Full paths live HERE and only here: chrome.storage.local, on the user's own machine.
// They are never written to Postgres. `lib/migrations/002-drift.sql:24` is why:
//
//   "Deliberately no title column and no text column. A migration adding one is the
//    single change that turns this product into surveillance, and it is release-blocking."
//
// Paths are WORSE than titles, not better. A title may read "Untitled document"; a path is
// a durable, resolvable handle to a specific private artifact — docs.google.com/document/d/…,
// github.com/acme/unreleased-thing. The browser already stores full history, so keeping them
// on the device adds no new exposure class. The NETWORK boundary is the one that matters, and
// it is held by never inserting these into any table.
//
// They exist so the batched post-session judge (ADR-0060) can tell one area of a large site
// from another — chatgpt.com/c/… (a conversation) from /gpts — which matters because
// chatgpt.com is 38.7% of all recorded attention and is both the tool and the rabbit hole.

/** 30 days. Time-based on purpose: an on-demand analysis may run days later or never — a
 *  free-tier user gets tracking and no analysis at all — so an event-based purge ("delete
 *  once analysed") would never fire for them and the log would grow without bound. */
export const PATH_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Appends one visit. Returns a NEW array; never mutates, because the caller round-trips
 *  this through chrome.storage.local and a mutated reference would hide the write. */
export function appendVisit(log, { url, at, sessionId }) {
  const entries = Array.isArray(log) ? log : []
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return entries // chrome://, about:blank, garbage — not a page we can or should log
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return entries

  // Match bareHostname() (sw.js:89), which strips www. before writing event.domain. If these
  // disagreed, every www-prefixed site would look like two hosts to the judge — the same
  // facebook.com / www.facebook.com double-count already sitting in historical event rows.
  const host = parsed.hostname.replace(/^www\./, '')

  // Only the pathname. Never search, never hash: a query string carries search terms and
  // tokens, and the path alone is enough to separate areas of a site.
  const path = parsed.pathname

  // transition() fires on tab activation, URL update AND the 30s tick, so sitting still on
  // one page would otherwise append the same entry over and over.
  const last = entries[entries.length - 1]
  if (last && last.sessionId === sessionId && last.host === host && last.path === path) return entries

  return [...entries, { sessionId, host, path, at }]
}

/** Drops entries older than the TTL. Called from the 30s tick, so it is the only thing
 *  keeping the log bounded for a user who never runs an analysis. */
export function purgeExpired(log, now, ttlMs = PATH_TTL_MS) {
  if (!Array.isArray(log)) return []
  return log.filter((entry) => now - entry.at < ttlMs)
}

/** ADR-0087, issue #20. "Forget what you know about me" (POST /api/me/forget) moves the
 *  server's forgetAt forward; the device applies it by dropping any path recorded before
 *  that moment. `forgetAt` is epoch ms, the same unit as `entry.at` — `null`/`undefined`
 *  means the user has never asked to forget anything, so nothing is dropped. */
export function purgeBefore(log, forgetAt) {
  if (!Array.isArray(log)) return []
  if (typeof forgetAt !== 'number' || !Number.isFinite(forgetAt)) return log
  return log.filter((entry) => entry.at >= forgetAt)
}
