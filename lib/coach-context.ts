/** Turns real session/event rows into the ONLY data the coach is allowed to speak from.
 *
 *  ADR-0079: the coach's predecessor fabricated figures ('5 hr 33 min', sessionCount = 11)
 *  whenever its database lookup found nothing, and presented them as the user's real record.
 *  `hasData: false` is the honest alternative — the caller must render it as "no data yet",
 *  never paper over it with a plausible-looking number.
 */
import { totalsByKind, rankDomains, formatHm, type EventRow } from './dashboard-figures.ts'

export type CoachTopSite = { domain: string; share: number }
export type CoachContext = {
  hasData: boolean
  totalAttended: string
  totalAway: string
  sessionCount: number
  finishedCount: number
  notYetCount: number
  topSites: CoachTopSite[]
}

export function buildCoachContext(
  sessions: { outcome: string | null }[],
  events: EventRow[],
): CoachContext {
  if (sessions.length === 0) {
    return {
      hasData: false,
      totalAttended: '',
      totalAway: '',
      sessionCount: 0,
      finishedCount: 0,
      notYetCount: 0,
      topSites: [],
    }
  }

  const totals = totalsByKind(events)
  const ranked = rankDomains(events, 4)

  return {
    hasData: true,
    totalAttended: formatHm(totals.attention),
    totalAway: formatHm(totals.away),
    sessionCount: sessions.length,
    finishedCount: sessions.filter((s) => s.outcome === 'yes').length,
    notYetCount: sessions.filter((s) => s.outcome === 'no').length,
    topSites: ranked.map((r) => ({ domain: r.domain, share: r.share })),
  }
}
