/**
 * Pure aggregation and formatting logic for the MEANT dashboard.
 *
 * Implements the Rize-aligned layout grammar (ADR-0068):
 * - Time formatting (hours + minutes, or minutes alone)
 * - Kind totals (attention, away, breaks)
 * - Domain ranking with share percentages
 * - Period-over-period delta calculation
 * - Daily timeline positioning (04:00 to 22:00 track)
 * - Performance & fidelity metrics
 *
 * PURE LOGIC ONLY: No `@/` imports so it is directly testable with `node --test`.
 */

export interface EventRow {
  kind: string
  domain?: string | null
  seconds?: number | null
  label?: string | null
}

export interface SessionRow {
  id: string
  intention?: string | null
  outcome?: string | null
  started_at: string
  ended_at?: string | null
  /** ADR-0084. Tasks of one session share it; null on rows written before tasks existed. */
  block_id?: string | null
  events?: EventRow[]
}

/** ADR-0084. One session may be several task rows; they share block_id. */
export function sessionKey(s: { id: string; block_id?: string | null }): string {
  return s.block_id ?? s.id
}

/** Sessions, not task rows. A row with no id (callers that pass outcomes alone) counts once. */
export function countSessions(rows: { id?: string; block_id?: string | null }[]): number {
  return new Set(rows.map((s, i) => s.block_id ?? s.id ?? `#${i}`)).size
}

/** One row per session for anything drawn on a time axis: a block's tasks share one clock, so
 *  drawing them separately would stack identical bars. Intentions join; events concatenate. */
export function mergeBlocks(sessions: SessionRow[]): SessionRow[] {
  const byKey = new Map<string, SessionRow>()
  for (const s of sessions) {
    const key = sessionKey(s)
    const seen = byKey.get(key)
    if (!seen) {
      byKey.set(key, { ...s, events: s.events ? [...s.events] : s.events })
      continue
    }
    seen.intention = [seen.intention, s.intention].filter(Boolean).join(' · ')
    if (s.events) seen.events = [...(seen.events ?? []), ...s.events]
    if (s.ended_at && (!seen.ended_at || s.ended_at > seen.ended_at)) seen.ended_at = s.ended_at
  }
  return [...byKey.values()]
}

/** ADR-0084. A merged row's outcome column: a single label+dot when every task in the block
 *  agrees (including the ordinary single-task case), or a joined "N Yes · M Not yet" text when
 *  they don't — reusing the exact phrasing already shown on the Performance & Fidelity card,
 *  rather than silently picking one task's answer and hiding a real disagreement. */
export function blockOutcomeSummary(rows: { outcome?: string | null }[]): {
  mixed: boolean
  label: string
} {
  let yes = 0, no = 0, unanswered = 0
  for (const r of rows) {
    const out = (r.outcome || '').toLowerCase()
    if (out === 'yes') yes++
    else if (out === 'no') no++
    else unanswered++
  }
  const parts = [
    yes > 0 && `${yes} Yes`,
    no > 0 && `${no} Not yet`,
    unanswered > 0 && `${unanswered} Unanswered`,
  ].filter(Boolean) as string[]
  if (parts.length <= 1) {
    // Uniform (including the single-row case): return the plain label the existing single
    // dot+label rendering already expects.
    return { mixed: false, label: yes > 0 ? 'Yes' : no > 0 ? 'Not yet' : 'Unanswered' }
  }
  return { mixed: true, label: parts.join(' · ') }
}

/** Formats a second count into human-readable "X hr Y min" or "Y min" */
export function formatHm(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h > 0) {
    return `${h} hr ${m} min`
  }
  return `${m} min`
}

/** Compact format: "41h 20m" or "25m" */
export function formatHmCompact(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h > 0) {
    return `${h}h ${m < 10 ? '0' + m : m}m`
  }
  return `${m}m`
}

/** Aggregates attention, away, and break duration by kind. Ignores non-duration events like block_hit. */
export function totalsByKind(rows: EventRow[]): {
  attention: number
  away: number
  break: number
  unrecorded: number
} {
  let attention = 0
  let away = 0
  let breakSec = 0
  let unrecorded = 0

  for (const r of rows) {
    if (typeof r.seconds !== 'number' || r.seconds <= 0) continue
    if (r.kind === 'attention') attention += r.seconds
    else if (r.kind === 'away') away += r.seconds
    else if (r.kind === 'break') breakSec += r.seconds
    else if (r.kind === 'unrecorded') unrecorded += r.seconds
  }

  return {
    attention,
    away,
    break: breakSec,
    unrecorded,
  }
}

export interface DomainRank {
  domain: string
  seconds: number
  label: string
  share: number
}

/** Ranks attention domains descending by duration, with percentage share against total attention. */
export function rankDomains(rows: EventRow[], limit = 6): DomainRank[] {
  const domainMap = new Map<string, { seconds: number; label: string }>()
  let totalAttention = 0

  for (const r of rows) {
    if (!r.domain || typeof r.seconds !== 'number' || r.seconds <= 0) continue
    totalAttention += r.seconds
    const cur = domainMap.get(r.domain) ?? { seconds: 0, label: r.label || 'focused' }
    cur.seconds += r.seconds
    domainMap.set(r.domain, cur)
  }

  const sorted = Array.from(domainMap.entries())
    .map(([domain, data]) => ({
      domain,
      seconds: data.seconds,
      label: data.label,
      share: totalAttention > 0 ? Math.round((data.seconds / totalAttention) * 100) : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds)

  return sorted.slice(0, limit)
}

export interface DeltaResult {
  delta: number
  direction: 'up' | 'down' | 'flat'
}

/** Computes change between current and previous period quantities. */
export function changeAgainst(current: number, previous: number): DeltaResult {
  const delta = current - previous
  if (delta === 0) {
    return { delta: 0, direction: 'flat' }
  }
  return {
    delta,
    direction: delta > 0 ? 'up' : 'down',
  }
}

export interface PerformanceFidelity {
  sessionCount: number
  finishedCount: number
  notYetCount: number
  unansweredCount: number
  finishedPct: number
  sessionDelta: DeltaResult
  attentionDelta: DeltaResult
  avgSessionSeconds: number
  avgSessionDelta: DeltaResult
}

/** Computes overall performance and fidelity metrics. */
export function computePerformanceFidelity(
  currentSessions: { id?: string; block_id?: string | null; outcome?: string | null }[],
  prevSessionsCount = 0,
  currentAttentionSeconds = 0,
  prevAttentionSeconds = 0,
): PerformanceFidelity {
  const sessionCount = countSessions(currentSessions)
  let finishedCount = 0
  let notYetCount = 0
  let unansweredCount = 0

  for (const s of currentSessions) {
    const out = (s.outcome || '').toLowerCase()
    if (out === 'yes') finishedCount++
    else if (out === 'no') notYetCount++
    else unansweredCount++
  }

  const answered = finishedCount + notYetCount
  const finishedPct = answered > 0 ? Math.round((finishedCount / answered) * 100) : 0

  const avgSessionSeconds = sessionCount > 0 ? Math.round(currentAttentionSeconds / sessionCount) : 0
  const prevAvgSessionSeconds = prevSessionsCount > 0 ? Math.round(prevAttentionSeconds / prevSessionsCount) : 0

  return {
    sessionCount,
    finishedCount,
    notYetCount,
    unansweredCount,
    finishedPct,
    sessionDelta: changeAgainst(sessionCount, prevSessionsCount),
    attentionDelta: changeAgainst(currentAttentionSeconds, prevAttentionSeconds),
    avgSessionSeconds,
    avgSessionDelta: changeAgainst(avgSessionSeconds, prevAvgSessionSeconds),
  }
}

export interface TimelineBlock {
  id: string
  intention: string
  startedAt: string
  endedAt: string | null
  leftPercent: number
  widthPercent: number
  attendedSeconds: number
  awaySeconds: number
  breakSeconds: number
}

export interface DailyTimelineResult {
  blocks: TimelineBlock[]
  totalAttendedSeconds: number
  totalAwaySeconds: number
  totalBreakSeconds: number
  sessionsCount: number
}

/**
 * Computes positions for sessions that occurred on the specified day within a day window (default 04:00 to 22:00).
 */
export function computeDailyTimeline(
  targetDateString: string, // YYYY-MM-DD
  sessions: SessionRow[],
  dayStartHour = 4,
  dayEndHour = 22,
): DailyTimelineResult {
  const windowHours = Math.max(1, dayEndHour - dayStartHour)
  const windowSeconds = windowHours * 3600

  const blocks: TimelineBlock[] = []
  let totalAttendedSeconds = 0
  let totalAwaySeconds = 0
  let totalBreakSeconds = 0

  for (const s of mergeBlocks(sessions)) {
    if (!s.started_at) continue
    const start = new Date(s.started_at)
    if (isNaN(start.getTime())) continue

    const sDate = start.toISOString().slice(0, 10)
    if (sDate !== targetDateString) continue

    // Calculate start seconds relative to dayStartHour
    const startOfDay = new Date(start)
    startOfDay.setUTCHours(dayStartHour, 0, 0, 0)
    const offsetSeconds = (start.getTime() - startOfDay.getTime()) / 1000

    const end = s.ended_at ? new Date(s.ended_at) : new Date(start.getTime() + 1800_000)
    const durationSeconds = Math.max(300, (end.getTime() - start.getTime()) / 1000)

    const leftPercent = Math.max(0, Math.min(100, (offsetSeconds / windowSeconds) * 100))
    const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (durationSeconds / windowSeconds) * 100))

    let attended = 0
    let away = 0
    let breakSec = 0

    if (s.events && Array.isArray(s.events)) {
      for (const e of s.events) {
        if (typeof e.seconds === 'number' && e.seconds > 0) {
          if (e.kind === 'attention') attended += e.seconds
          else if (e.kind === 'away') away += e.seconds
          else if (e.kind === 'break') breakSec += e.seconds
        }
      }
    } else {
      attended = durationSeconds
    }

    totalAttendedSeconds += attended
    totalAwaySeconds += away
    totalBreakSeconds += breakSec

    blocks.push({
      id: s.id,
      intention: s.intention || 'No intention given',
      startedAt: s.started_at,
      endedAt: s.ended_at || null,
      leftPercent,
      widthPercent,
      attendedSeconds: attended,
      awaySeconds: away,
      breakSeconds: breakSec,
    })
  }

  return {
    blocks,
    totalAttendedSeconds,
    totalAwaySeconds,
    totalBreakSeconds,
    sessionsCount: blocks.length,
  }
}

export interface DayBreakdown {
  day: number
  dateString: string
  attendedSeconds: number
  awaySeconds: number
  breakSeconds: number
  totalSeconds: number
  attendedHeightPercent: number
  awayHeightPercent: number
  breakHeightPercent: number
  totalHeightPercent: number
  sessionCount: number
}

export interface MonthlyBreakdownResult {
  days: DayBreakdown[]
  totalAttendedSeconds: number
  totalAwaySeconds: number
  totalBreakSeconds: number
  totalSeconds: number
  maxDaySeconds: number
}

/**
 * Computes daily breakdown for a given month and year across sessions.
 * Scale ceiling defaults to 8 hours (28,800 seconds).
 */
export function computeMonthlyBreakdown(
  year: number,
  month: number, // 1-12
  sessions: SessionRow[],
  ceilingSeconds = 28800, // 8h
): MonthlyBreakdownResult {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days: DayBreakdown[] = []

  for (let i = 1; i <= daysInMonth; i++) {
    const padDay = i < 10 ? `0${i}` : `${i}`
    const padMonth = month < 10 ? `0${month}` : `${month}`
    days.push({
      day: i,
      dateString: `${year}-${padMonth}-${padDay}`,
      attendedSeconds: 0,
      awaySeconds: 0,
      breakSeconds: 0,
      totalSeconds: 0,
      attendedHeightPercent: 0,
      awayHeightPercent: 0,
      breakHeightPercent: 0,
      totalHeightPercent: 0,
      sessionCount: 0,
    })
  }

  let totalAttendedSeconds = 0
  let totalAwaySeconds = 0
  let totalBreakSeconds = 0

  const counted = new Set<string>() // ADR-0084: day:session pairs already counted
  for (const s of sessions) {
    if (!s.started_at) continue
    const d = new Date(s.started_at)
    if (isNaN(d.getTime())) continue

    const sYear = d.getUTCFullYear()
    const sMonth = d.getUTCMonth() + 1
    if (sYear !== year || sMonth !== month) continue

    const dayIdx = d.getUTCDate() - 1
    if (dayIdx < 0 || dayIdx >= daysInMonth) continue

    let attended = 0
    let away = 0
    let breakSec = 0

    if (s.events && Array.isArray(s.events)) {
      for (const e of s.events) {
        if (typeof e.seconds === 'number' && e.seconds > 0) {
          if (e.kind === 'attention') attended += e.seconds
          else if (e.kind === 'away') away += e.seconds
          else if (e.kind === 'break') breakSec += e.seconds
        }
      }
    } else if (s.ended_at) {
      const end = new Date(s.ended_at)
      attended = Math.max(0, (end.getTime() - d.getTime()) / 1000)
    }

    days[dayIdx].attendedSeconds += attended
    days[dayIdx].awaySeconds += away
    days[dayIdx].breakSeconds += breakSec
    const dayKey = `${dayIdx}:${sessionKey(s)}`
    if (!counted.has(dayKey)) {
      counted.add(dayKey)
      days[dayIdx].sessionCount += 1
    }

    totalAttendedSeconds += attended
    totalAwaySeconds += away
    totalBreakSeconds += breakSec
  }

  let maxDaySeconds = 0
  for (const day of days) {
    day.totalSeconds = day.attendedSeconds + day.awaySeconds + day.breakSeconds
    if (day.totalSeconds > maxDaySeconds) maxDaySeconds = day.totalSeconds

    if (day.totalSeconds > 0) {
      day.totalHeightPercent = Math.min(100, Math.max(3, (day.totalSeconds / ceilingSeconds) * 100))
      day.attendedHeightPercent = (day.attendedSeconds / day.totalSeconds) * day.totalHeightPercent
      day.awayHeightPercent = (day.awaySeconds / day.totalSeconds) * day.totalHeightPercent
      day.breakHeightPercent = (day.breakSeconds / day.totalSeconds) * day.totalHeightPercent
    }
  }

  return {
    days,
    totalAttendedSeconds,
    totalAwaySeconds,
    totalBreakSeconds,
    totalSeconds: totalAttendedSeconds + totalAwaySeconds + totalBreakSeconds,
    maxDaySeconds,
  }
}

export interface WeeklyBreakdownResult {
  days: DayBreakdown[]
  totalAttendedSeconds: number
  totalAwaySeconds: number
  totalBreakSeconds: number
  totalSeconds: number
  maxDaySeconds: number
  startDateString: string
  endDateString: string
}

/**
 * Computes daily breakdown for a 7-day week (Monday to Sunday) containing targetDate.
 */
export function computeWeeklyBreakdown(
  targetDate: Date,
  sessions: SessionRow[],
  ceilingSeconds = 28800,
): WeeklyBreakdownResult {
  const d = new Date(targetDate)
  const dayOfWeek = d.getUTCDay() // 0 is Sunday, 1 is Monday...
  const distanceToMonday = (dayOfWeek + 6) % 7
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - distanceToMonday))

  const days: DayBreakdown[] = []

  for (let i = 0; i < 7; i++) {
    const cur = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i))
    const y = cur.getUTCFullYear()
    const m = cur.getUTCMonth() + 1
    const dayNum = cur.getUTCDate()
    const padM = m < 10 ? `0${m}` : `${m}`
    const padD = dayNum < 10 ? `0${dayNum}` : `${dayNum}`
    const dateString = `${y}-${padM}-${padD}`

    days.push({
      day: i + 1,
      dateString,
      attendedSeconds: 0,
      awaySeconds: 0,
      breakSeconds: 0,
      totalSeconds: 0,
      attendedHeightPercent: 0,
      awayHeightPercent: 0,
      breakHeightPercent: 0,
      totalHeightPercent: 0,
      sessionCount: 0,
    })
  }

  const startDateString = days[0].dateString
  const endDateString = days[6].dateString

  let totalAttendedSeconds = 0
  let totalAwaySeconds = 0
  let totalBreakSeconds = 0

  const counted = new Set<string>() // ADR-0084: day:session pairs already counted
  for (const s of sessions) {
    if (!s.started_at) continue
    const d = new Date(s.started_at)
    if (isNaN(d.getTime())) continue
    const sDate = d.toISOString().slice(0, 10)
    const dayIdx = days.findIndex((day) => day.dateString === sDate)
    if (dayIdx === -1) continue

    let attended = 0
    let away = 0
    let breakSec = 0

    if (s.events && Array.isArray(s.events)) {
      for (const e of s.events) {
        if (typeof e.seconds === 'number' && e.seconds > 0) {
          if (e.kind === 'attention') attended += e.seconds
          else if (e.kind === 'away') away += e.seconds
          else if (e.kind === 'break') breakSec += e.seconds
        }
      }
    } else if (s.ended_at) {
      const end = new Date(s.ended_at)
      attended = Math.max(0, (end.getTime() - d.getTime()) / 1000)
    }

    days[dayIdx].attendedSeconds += attended
    days[dayIdx].awaySeconds += away
    days[dayIdx].breakSeconds += breakSec
    const dayKey = `${dayIdx}:${sessionKey(s)}`
    if (!counted.has(dayKey)) {
      counted.add(dayKey)
      days[dayIdx].sessionCount += 1
    }

    totalAttendedSeconds += attended
    totalAwaySeconds += away
    totalBreakSeconds += breakSec
  }

  let maxDaySeconds = 0
  for (const day of days) {
    day.totalSeconds = day.attendedSeconds + day.awaySeconds + day.breakSeconds
    if (day.totalSeconds > maxDaySeconds) maxDaySeconds = day.totalSeconds

    if (day.totalSeconds > 0) {
      day.totalHeightPercent = Math.min(100, Math.max(3, (day.totalSeconds / ceilingSeconds) * 100))
      day.attendedHeightPercent = (day.attendedSeconds / day.totalSeconds) * day.totalHeightPercent
      day.awayHeightPercent = (day.awaySeconds / day.totalSeconds) * day.totalHeightPercent
      day.breakHeightPercent = (day.breakSeconds / day.totalSeconds) * day.totalHeightPercent
    }
  }

  return {
    days,
    totalAttendedSeconds,
    totalAwaySeconds,
    totalBreakSeconds,
    totalSeconds: totalAttendedSeconds + totalAwaySeconds + totalBreakSeconds,
    maxDaySeconds,
    startDateString,
    endDateString,
  }
}

