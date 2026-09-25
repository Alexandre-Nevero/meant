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
 *  analyze them. Called by the popup's "try the judge" (ADR-0086), behind JUDGE_RENDERS.
 *
 *  Never queued offline: post()'s offline queue would park the PATHS in chrome.storage and
 *  replay an analysis nobody is waiting for. Offline is simply a failed ask. */
export async function analyzeSessions(sessionIds) {
  const { pathLog } = await chrome.storage.local.get('pathLog')
  const paths = selectPathsForSessions(pathLog, sessionIds)
  return post('/api/judge/analyze', { sessionIds, paths }, { queue: false })
}
