/** N8. No companion movement in the first minute. Also D34's sentence-edit window. */
export const GRACE_MS = 60_000
/** D30, NARROWED by ADR-0062 (2026-09-15). D30 said these govern CONFLICT only and that
 *  one-sided evidence resolves at n=1 — a rule written for a CORRECTION of a wrong flag.
 *  ADR-0057 deleted the flag, so no corrections exist; every label is now volunteered, and a
 *  volunteered label means "this visit", not "this site forever". These therefore govern ALL
 *  label evidence. Memorising at n=1 would break PRD §1.2: one tap on instagram.com at 4pm
 *  would teach the product that Instagram is always drift. */
export const MEMORY_MIN_EVIDENCE = 3
export const MEMORY_MIN_AGREEMENT = 0.8
/** ADR-0078. Verdicts may classify a domain, but at a higher bar than taps, because a model
 *  opinion is worth less than a deliberate human act. Eight is a STARTING VALUE, not a
 *  measured one — the eval re-tunes it, and nothing should treat it as settled until it has.
 *  A single contrary tap vetoes a verdict classification regardless of this number. */
export const MEMORY_MIN_VERDICTS = 8
/** ADR-0072. Replaces DAILY_JUDGMENT_CAP, which was sized when one judgment meant one TAB.
 *  After ADR-0060 a judgment means one BATCH of roughly ten sessions, so the old 150 was a
 *  fuse rated for the wrong current — it would not have blown before the fire.
 *
 *  At openai/gpt-oss-120b's $0.15 / $0.60 per Mtok and ADR-0060's 2,700-in / 800-out batch,
 *  one analysis costs $0.000885. Ten a day is $0.27 a month, 2.2% of a $12 subscription,
 *  against M9's 15% ceiling — a cost-awareness bound, not a paywall (ADR-0075).
 *
 *  Groq's FREE tier is a development convenience and not a plan: 200K tokens/day at ~3,500
 *  tokens an analysis is 57 analyses a day across the entire key, and 8K tokens/minute is
 *  two concurrent analyses — so the queue depth, not this cap, is what binds today. */
export const DAILY_ANALYSIS_CAP = 10

/** The coach is a conversation, not one batched call, so it needs its own ceiling: N turns
 *  resending history costs far more than one analysis. ADR-0075 makes the coach free for the
 *  testing phase, so this bounds spend and abuse only — it is not a paywall and does not vary
 *  by payment status. Re-derive against real transcripts once any exist. */
export const DAILY_COACH_TURNS = 40
/** ADR-0080. The judge spike's own findings suggested ~0.70 "looks like a reasonable
 *  candidate" on SYNTHETIC data, and explicitly warned not to trust the specific number.
 *  This is that placeholder, applied only when PRESENTING a result — judgment.label and
 *  judgment.confidence always store the model's raw output, unfiltered, so re-deriving the
 *  real floor later is a config change, never a re-run. Re-derive against a real,
 *  human-labelled eval before trusting this number for anything real.
 *
 *  Deliberately not named "*_CONFIDENCE" + "_FLOOR" concatenated: test/companion-state.test.js
 *  asserts that joined string never reappears in this file, since it names ADR-0057's
 *  deleted live-signal threshold, and this is an unrelated, later constant that shares the
 *  concept but not the retired design. */
export const PROVISIONAL_MIN_CONFIDENCE = 0.7
/** ADR-0080. ADR-0060 sized the judge around "roughly ten sessions" per batch; nothing
 *  enforced that until an adversarial review of the route found the gap: an unbounded
 *  sessionIds array means unbounded Groq spend per request (DAILY_ANALYSIS_CAP counts
 *  requests, not calls) and, separately, a big enough array overflows the btree tuple size
 *  on analysis_user_sessions_idx (lib/migrations/007-judge.sql). 20 is double the assumed
 *  batch size — headroom for a real multi-day catch-up — and far under the index ceiling. */
export const MAX_SESSIONS_PER_ANALYSIS = 20
/** D39. Cycle presets. `custom` is any pair; `null` cycles means one continuous block. */
export const CYCLE_PRESETS = [{ work: 25, break: 5 }, { work: 50, break: 10 }] as const
/** PRD Q5 / I6. Sessions before a cross-session pattern may be stated. Unused here (the coach is
 *  out of scope) — declared so it is decided once. */
export const PATTERN_MIN_SESSIONS = 8
