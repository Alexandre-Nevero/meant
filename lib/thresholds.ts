/** N8. No companion movement in the first minute. Also D34's sentence-edit window. */
export const GRACE_MS = 60_000
/** D30. CONFLICT only — a domain with taps on more than one side. One-sided resolves at n=1. */
export const MEMORY_MIN_EVIDENCE = 3
export const MEMORY_MIN_AGREEMENT = 0.8
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
