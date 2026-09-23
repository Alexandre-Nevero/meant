// ADR-0081. Pure — no chrome.*, no Date.now() — so the picker's arithmetic is unit-tested
// rather than living inside popup.js's DOM code.

// D39. Matches lib/thresholds.ts's CYCLE_PRESETS; the plain-JS extension can't import that TS
// module (same limitation as GRACE_MS in popup.js). Keep them identical.
export const CYCLE_PRESETS = [{ work: 25, break: 5 }, { work: 50, break: 10 }]
export const MAX_CYCLES = 8

export function clampCount(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 1
  return Math.min(MAX_CYCLES, Math.max(1, v))
}

/** A timed session ends after its LAST WORK BLOCK: n work blocks, n − 1 breaks. */
export function plannedMinutesFor({ work, break: brk, count }) {
  const c = clampCount(count)
  return c * work + (c - 1) * brk
}

/** Reconstructs the picker's starting state from a saved { plannedMinutes, cycle } choice, or
 *  the first-ever default when there is none. */
export function restoreCycle(lastChoice) {
  const fresh = { mode: '25/5', customMode: 'timed', work: 25, brk: 5, count: 1 }
  if (!lastChoice) return fresh
  const { plannedMinutes: pm, cycle: c } = lastChoice
  if (!c) return { ...fresh, mode: 'custom', customMode: 'none', work: pm ?? 25 }
  if (pm == null) return { mode: 'custom', customMode: 'open', work: c.work, brk: c.break, count: 1 }

  let count
  if (c.count == null) {
    // Saved before ADR-0081, when a timed session was exactly one work + break. Any other
    // length is an old-model shape (e.g. 50 min through two 25/5 cycles): custom, one cycle.
    if (pm !== c.work + c.break) return { mode: 'custom', customMode: 'timed', work: c.work, brk: c.break, count: 1 }
    count = 1
  } else {
    count = clampCount(c.count)
  }
  const preset = CYCLE_PRESETS.find((p) => p.work === c.work && p.break === c.break)
  return { mode: preset ? `${preset.work}/${preset.break}` : 'custom', customMode: 'timed', work: c.work, brk: c.break, count }
}
