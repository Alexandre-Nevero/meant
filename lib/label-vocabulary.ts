/** ADR-0076's vocabulary, plus the transition from the tap-era one.
 *
 *  This exists because of the warning already written above KINDS in app/api/events/route.ts:
 *  flush() batches all of a session's queued events into one POST, so a value this list
 *  rejects fails the WHOLE batch — and because nothing is then marked sent, every attention
 *  and away event for that session requeues and retries forever with the same payload.
 *
 *  An installed extension keeps sending `distract` until Chrome ships the update, which is
 *  not on our schedule. So the wire accepts both and normalises on the way in; the database
 *  only ever holds the new values.
 *
 *  Remove `work` and `distract` from ACCEPTED once telemetry shows no client sending them —
 *  and not before. */
export type Label = 'focused' | 'supportive' | 'neutral' | 'drift'
export type WireLabel = Label | 'unknown'

const ALIASES: Record<string, WireLabel> = { work: 'focused', distract: 'drift' }
const CURRENT: WireLabel[] = ['focused', 'supportive', 'neutral', 'drift', 'unknown']

export const LABELS: readonly string[] = [...CURRENT, ...Object.keys(ALIASES)]

/** Returns the canonical label, or null when the value is not one we accept. */
export function normalizeLabel(value: unknown): WireLabel | null {
  if (typeof value !== 'string') return null
  if ((CURRENT as string[]).includes(value)) return value as WireLabel
  return ALIASES[value] ?? null
}
