// Duplicated from lib/band.ts#EXTENSION_ID_SHAPE — the plain-JS extension can't import that
// TS module (same limitation as GRACE_MS / CYCLE_PRESETS in popup.js). Keep them identical.
const EXTENSION_ID_SHAPE = /^[a-p]{32}$/

/** tally + the still-open slice's elapsed time, as one merged tally. Read-only view: no
 *  AWAY_MIN_MS floor is applied here (that floor exists to keep junk out of the event log,
 *  not out of a display), and nothing is written back. */
export function withOpenSlice(tally, slice, at) {
  const merged = {
    attention: { ...(tally?.attention ?? {}) },
    away: tally?.away ?? 0,
    break: tally?.break ?? 0,
  }
  if (!slice) return merged
  const seconds = Math.floor(Math.max(0, at - slice.since) / 1000)
  if (seconds === 0) return merged
  if (slice.mode === 'attention' && slice.domain) {
    merged.attention[slice.domain] = (merged.attention[slice.domain] ?? 0) + seconds
  } else if (slice.mode === 'away') merged.away += seconds
  else if (slice.mode === 'break') merged.break += seconds
  return merged
}

/** Merged tally → the same `{ kind, flex }` Segment shape lib/band.ts#toBand produces, so the
 *  popup and the review draw from one vocabulary. Top three domains by seconds, ties broken by
 *  first-seen, zero-second and extension-ID-shaped domains dropped, away/break as their own
 *  segments. Never emits `remainder` — the caller owns the denominator, exactly as toBand() does. */
export function toSegments(merged) {
  const attention = Object.entries(merged.attention)
    .filter(([domain, seconds]) => seconds > 0 && !EXTENSION_ID_SHAPE.test(domain))
    // Object.entries preserves insertion order, and Array#sort is stable in every engine
    // this ships to — so an exact tie keeps first-seen order with no explicit tie-breaker.
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const segments = attention.map(([domain, seconds], i) => ({
    kind: ['attention-1', 'attention-2', 'attention-3'][i],
    domain,
    flex: seconds,
  }))
  if (merged.away > 0) segments.push({ kind: 'away', domain: null, flex: merged.away })
  if (merged.break > 0) segments.push({ kind: 'break', domain: null, flex: merged.break })
  return segments
}
