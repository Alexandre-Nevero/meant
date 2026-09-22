// ADR-0059/ADR-0080. Paths live in chrome.storage.local and go nowhere else — this module is
// the one place they leave the device, transiently, in the body of one POST. Nothing here
// writes them back to storage or logs them.
import { post } from '../api.js'

/** Pure: pulls just the requested sessions' entries out of the full on-device log. */
export function selectPathsForSessions(pathLog, sessionIds) {
  if (!Array.isArray(pathLog)) return []
  const wanted = new Set(sessionIds)
  return pathLog.filter((entry) => wanted.has(entry.sessionId))
}

/** Gathers this device's own path-log entries for the given sessions and asks the server to
 *  analyze them. No UI calls this yet — it exists so the backend is genuinely exercisable,
 *  not just unit-tested in isolation (ADR-0080, Task 6). */
export async function analyzeSessions(sessionIds) {
  const { pathLog } = await chrome.storage.local.get('pathLog')
  const paths = selectPathsForSessions(pathLog, sessionIds)
  return post('/api/judge/analyze', { sessionIds, paths })
}
