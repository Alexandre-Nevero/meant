import type { ReviewRow } from '@/lib/review-data'

/** Below this share of the session, unrecorded time is noise and is not rendered. A FIXED
 *  floor would shout on a ten-minute session and stay silent on a four-hour one. */
export const UNRECORDED_MIN_SHARE = 0.2

/** Wall clock minus everything the product actually watched.
 *
 *  ADR-0054 moved the served/not-served boundary from job title to BROWSER SHARE, reported
 *  at runtime. IDEA §9's warning was never really about titles — it is that v1 "would see a
 *  fraction of their day and be confidently wrong about the rest." So the product stops
 *  being confident about what it did not watch: a developer whose day is pull requests and
 *  docs is fully served, and one who spent four hours in an IDE is told plainly that we
 *  watched twenty minutes. The user self-qualifies inside one session, on evidence.
 *
 *  Floors at zero: clock skew between the extension's timestamps and the server's must never
 *  surface to a user as "-4 minutes". */
export function computeUnrecorded(
  startedAt: string,
  endedAt: string | null,
  rows: ReviewRow[],
): number {
  if (!endedAt) return 0
  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  const wall = Math.round((end - start) / 1000)
  // Only kinds that carry real duration. block_hit rows have no dwell — the block prevented it.
  const accounted = rows
    // 'paused' (ADR-0084): time on the session's other task was watched, just not for this row.
    .filter((r) => r.kind === 'attention' || r.kind === 'away' || r.kind === 'break' || r.kind === 'paused')
    .reduce((total, r) => total + r.seconds, 0)
  return Math.max(0, wall - accounted)
}
