// Pure. No chrome.*, no Date.now(). Every caller passes `at`, because the service worker dies
// after 30s idle (SDD §1) and elapsed time must always be now − storedTimestamp.

export const AWAY_MIN_MS = 15_000
export const IDLE_DETECTION_S = 60

export function emptySlice(at) {
  return { domain: null, since: at, mode: 'attention', awayCarryMs: 0 }
}

export function advance(state, next) {
  const elapsedMs = Math.max(0, next.at - state.since)
  const seconds = Math.floor(elapsedMs / 1000)
  const events = []
  let awayCarryMs = state.awayCarryMs
  const at = new Date(next.at).toISOString()

  if (state.mode === 'attention') {
    if (state.domain && seconds > 0) events.push({ kind: 'attention', domain: state.domain, seconds, at })
  } else if (state.mode === 'break') {
    // A declared break is neither work nor drift nor absence. No floor: a short break is real,
    // and the whole point of recording it is that a rest stops looking like a distraction (FP5).
    if (seconds > 0) events.push({ kind: 'break', domain: state.domain ?? null, seconds, at })
  } else if (state.mode === 'away') {
    // One alt-tab under the floor is below measurement resolution; forty are not, and crediting
    // them to the open domain is FN3.
    awayCarryMs += elapsedMs
    if (awayCarryMs >= AWAY_MIN_MS) {
      events.push({ kind: 'away', domain: null, seconds: Math.floor(awayCarryMs / 1000), at })
      awayCarryMs = 0
    }
  }

  return { events, state: { domain: next.domain ?? null, since: next.at, mode: next.mode, awayCarryMs } }
}

/** Exhaustive map from chrome.idle's three states to our three modes.
 *  `null` means "make no transition" — the one case where staying put is correct.
 *  Never returns undefined: an unmapped state must not reach advance(), whose explicit
 *  mode branches would silently drop the elapsed time. */
export function idleMode(idleState, audible) {
  if (idleState === 'active') return 'attention'
  if (idleState === 'locked') return 'away'      // a locked screen is never watching, audio or not
  if (idleState === 'idle') return audible ? null : 'away'
  return 'away'                                   // unknown future state: fail safe, never drop time
}
