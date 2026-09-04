// Each constant names the open question it provisionally answers. Changing one is a product
// decision, not a refactor.

/** flow Q3 / D26. Foreground time before a domain is judged or signalled.
 *  PROVISIONAL — Task 15's eval reports what would change at 10s / 20s / 45s. */
export const DWELL_MS = 20_000
/** N8. No companion movement in the first minute. Also D34's sentence-edit window. */
export const GRACE_MS = 60_000
/** New. Minimum spacing between two turns, so three signals cannot bunch into one minute. */
export const REFRACTORY_MS = 5 * 60_000
/** N8. */
export const SIGNAL_BUDGET = 3
export const SIGNAL_WINDOW_MS = 25 * 60_000
/** D30. CONFLICT only — a domain with taps on more than one side. One-sided resolves at n=1. */
export const MEMORY_MIN_EVIDENCE = 3
export const MEMORY_MIN_AGREEMENT = 0.8
/** PRD Q4. PROVISIONAL — Task 15 replaces this with a measured figure. */
export const CONFIDENCE_FLOOR = 0.7
/** SDD Q6 / V8. Daily per-user judgment cap.
 *  google/gemini-3.5-flash-lite at $0.30/Mtok in, $2.50/Mtok out (verified 2026-09-03).
 *  T-A input ~500 tok, output ~20 tok = $0.0002/judgment. 150/day = $0.90/month = 7.5% of a
 *  $12 subscription, against the 15% ceiling in M9/N10. */
export const DAILY_JUDGMENT_CAP = 150
/** D39. Cycle presets. `custom` is any pair; `null` cycles means one continuous block. */
export const CYCLE_PRESETS = [{ work: 25, break: 5 }, { work: 50, break: 10 }] as const
/** PRD Q5 / I6. Sessions before a cross-session pattern may be stated. Unused here (the coach is
 *  out of scope) — declared so it is decided once. */
export const PATTERN_MIN_SESSIONS = 8
