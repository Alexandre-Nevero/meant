import { currentUserId } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import { toBand } from '@/lib/band'
import { toWords } from '@/lib/words'
import { Band } from '../band'
import { contrastByOutcome } from '@/lib/attention-contrast'
import { contrastByPartOfDay } from '@/lib/time-of-day'
import { answerableBacklog, ANSWERABLE_WINDOW_DAYS } from '@/lib/unanswered'
import { PATTERN_MIN_SESSIONS } from '@/lib/thresholds'
import {
  formatHm,
  formatHmCompact,
  totalsByKind,
  rankDomains,
  computePerformanceFidelity,
  computeMonthlyBreakdown,
  computeWeeklyBreakdown,
  countSessions,
  type EventRow,
  type SessionRow,
} from '@/lib/dashboard-figures'
import { CompanionPet } from '../companion-pet'

export const dynamic = 'force-dynamic'

interface DashboardProps {
  searchParams?: Promise<{
    period?: string
    tab?: string
    month?: string
    date?: string
  }>
}

function formatDayDivider(dateStr: string): string {
  if (!dateStr || dateStr === 'Unknown') return 'PRIOR SESSIONS'
  const target = new Date(dateStr + 'T12:00:00Z')
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86_400_000)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (dateStr === todayStr) {
    return `TODAY · ${target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}`
  }
  if (dateStr === yesterdayStr) {
    return `YESTERDAY · ${target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}`
  }
  return target.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase()
}

function formatBarDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  const d = new Date(Date.UTC(year, month, day))
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  const userId = await currentUserId()
  if (!userId) redirect('/')

  const params = searchParams ? await searchParams : {}
  const activePeriod = params.period === 'week' ? 'week' : 'month'
  const activeTab = params.tab === 'sites' ? 'sites' : params.tab === 'sessions' ? 'sessions' : 'overview'

  const now = new Date()

  // Date and month navigation resolution
  let targetYear = now.getUTCFullYear()
  let targetMonth = now.getUTCMonth() + 1
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split('-').map(Number)
    if (y >= 2020 && y <= 2030 && m >= 1 && m <= 12) {
      targetYear = y
      targetMonth = m
    }
  }

  // Navigation targets for Month
  const prevMonthNum = targetMonth === 1 ? 12 : targetMonth - 1
  const prevMonthYear = targetMonth === 1 ? targetYear - 1 : targetYear
  const prevMonthStr = `${prevMonthYear}-${prevMonthNum < 10 ? `0${prevMonthNum}` : prevMonthNum}`

  const nextMonthNum = targetMonth === 12 ? 1 : targetMonth + 1
  const nextMonthYear = targetMonth === 12 ? targetYear + 1 : targetYear
  const nextMonthStr = `${nextMonthYear}-${nextMonthNum < 10 ? `0${nextMonthNum}` : nextMonthNum}`

  const targetMonthDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1))
  const monthName = targetMonthDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const monthFullTitle = targetMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  // Target date for Week navigation
  let targetWeekDate = now
  if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    const parsed = new Date(params.date + 'T12:00:00Z')
    if (!isNaN(parsed.getTime())) {
      targetWeekDate = parsed
    }
  }

  const prevWeekDate = new Date(targetWeekDate.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)
  const nextWeekDate = new Date(targetWeekDate.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)

  // Fetch recent sessions (capped at 50 for performance and bounded query)
  const sessionsRaw = await sql`
    select s.id, s.intention, s.started_at, s.ended_at, s.outcome, s.block_id,
           coalesce(
             (select json_agg(json_build_object('kind', e.kind, 'domain', e.domain, 'seconds', e.seconds, 'label', e.label))
                from event e where e.session_id = s.id),
             '[]'
           ) as events
      from session s
     where s.user_id = ${userId}
     order by s.started_at desc
     limit 50`

  if (sessionsRaw.length === 0) {
    return (
      <div className="m-empty" data-surface="ledger">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
        <Link className="m-meta" href="/setup">Set up your sites</Link>
        <CompanionPet />
      </div>
    )
  }

  const sessions = sessionsRaw as unknown as SessionRow[]

  // Aggregates for current month
  const periodEvents = (await sql`
    select e.kind, e.domain, e.seconds, e.label
      from event e
      join session s on s.id = e.session_id
     where s.user_id = ${userId}
       and s.started_at >= date_trunc('month', now())`) as unknown as EventRow[]

  // Aggregates for previous month (period-over-period comparison)
  const prevPeriodEvents = (await sql`
    select e.kind, e.domain, e.seconds, e.label
      from event e
      join session s on s.id = e.session_id
     where s.user_id = ${userId}
       and s.started_at >= date_trunc('month', now() - interval '1 month')
       and s.started_at < date_trunc('month', now())`) as unknown as EventRow[]

  const monthSessions = (await sql`
    select s.id, s.outcome, s.block_id
      from session s
     where s.user_id = ${userId}
       and s.started_at >= date_trunc('month', now())`) as { id: string; outcome: string | null; block_id: string | null }[]

  const prevMonthSessions = (await sql`
    select s.id, s.outcome, s.block_id
      from session s
     where s.user_id = ${userId}
       and s.started_at >= date_trunc('month', now() - interval '1 month')
       and s.started_at < date_trunc('month', now())`) as { id: string; outcome: string | null; block_id: string | null }[]

  // ADR-0060: Inference contrasts before the judge
  const contrastRows = (await sql`
    select e.domain, e.seconds, s.outcome, s.id as "sessionId", s.block_id as "blockId"
      from event e join session s on s.id = e.session_id
     where s.user_id = ${userId}
       and e.kind = 'attention'
       and e.domain is not null
       and s.outcome in ('yes', 'no')
       and s.started_at >= date_trunc('month', now())`) as {
    domain: string
    seconds: number
    outcome: string
    sessionId: string
    blockId: string | null
  }[]
  const contrasts = contrastByOutcome(contrastRows)

  const partRows = (await sql`
    select s.started_at_local_hour as "startedAtLocalHour", s.outcome, s.block_id as "blockId"
      from session s
     where s.user_id = ${userId}
       and s.outcome in ('yes', 'no')
       and s.started_at_local_hour is not null
       and s.started_at >= date_trunc('month', now())`) as {
    startedAtLocalHour: number
    outcome: string
    blockId: string | null
  }[]
  const partsOfDay = contrastByPartOfDay(partRows)

  // ADR-0066: at most ONE inference sentence renders
  const domainClaim = contrasts.find((c) => c.sessions >= PATTERN_MIN_SESSIONS) ?? null
  const partClaim = partsOfDay.find((p) => p.sessions >= PATTERN_MIN_SESSIONS) ?? null
  const showPart = partClaim !== null && (domainClaim === null || partClaim.sessions > domainClaim.sessions)
  const showDomain = domainClaim !== null && !showPart

  // Unanswered backlog query
  const backlogRows = await sql`
    select id, intention, ended_at, outcome
      from session
     where user_id = ${userId}
       and outcome = 'unanswered'
       and ended_at is not null
       and ended_at >= ${new Date(Date.now() - ANSWERABLE_WINDOW_DAYS * 86_400_000).toISOString()}`

  const backlog = answerableBacklog(
    backlogRows.map((s) => ({
      id: s.id as string,
      outcome: s.outcome as string,
      endedAt: s.ended_at ? new Date(s.ended_at as string).toISOString() : null,
      intention: s.intention as string,
    })),
    new Date(),
  )

  // Pure logic transforms (ADR-0068)
  const monthlyBreakdown = computeMonthlyBreakdown(targetYear, targetMonth, sessions)
  const weeklyBreakdown = computeWeeklyBreakdown(targetWeekDate, sessions)

  const isWeek = activePeriod === 'week'
  const activeBreakdown = isWeek ? weeklyBreakdown : monthlyBreakdown

  let periodTitle = monthFullTitle
  if (isWeek) {
    const dStart = new Date(weeklyBreakdown.startDateString + 'T12:00:00Z')
    const dEnd = new Date(weeklyBreakdown.endDateString + 'T12:00:00Z')
    const startFmt = dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    const endFmt = dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    periodTitle = `${startFmt} – ${endFmt}`
  }

  const rankedSites = rankDomains(periodEvents, 6)
  const allRankedSites = rankDomains(periodEvents, 20)
  const currentTotals = totalsByKind(periodEvents)
  const prevTotals = totalsByKind(prevPeriodEvents)

  const fidelity = computePerformanceFidelity(
    monthSessions,
    countSessions(prevMonthSessions),
    currentTotals.attention,
    prevTotals.attention,
  )

  // Breakdown donut math
  const totalRecordedSeconds = currentTotals.attention + currentTotals.away + currentTotals.break
  const attentionPct = totalRecordedSeconds > 0 ? Math.round((currentTotals.attention / totalRecordedSeconds) * 100) : 0
  const awayPct = totalRecordedSeconds > 0 ? Math.round((currentTotals.away / totalRecordedSeconds) * 100) : 0
  const breakPct = totalRecordedSeconds > 0 ? Math.round((currentTotals.break / totalRecordedSeconds) * 100) : 0

  // SVG Concentric Donut: R=74, Circumference = 2 * PI * 74 = 465
  const C_OUTER = 465
  const strokeAttention = (attentionPct / 100) * C_OUTER
  const strokeAway = (awayPct / 100) * C_OUTER
  const strokeBreak = (breakPct / 100) * C_OUTER

  const offsetAway = -strokeAttention - 4
  const offsetBreak = offsetAway - strokeAway - 4

  const latestIntention = sessions[0]?.intention || null
  const maxSiteSeconds = rankedSites.length > 0 ? rankedSites[0].seconds : 1

  // Navigation query string helpers
  const tabParam = activeTab !== 'overview' ? `&tab=${activeTab}` : ''
  const periodParam = isWeek ? 'period=week' : 'period=month'

  const prevArrowHref = isWeek
    ? `/dashboard?period=week&date=${prevWeekDate}${tabParam}`
    : `/dashboard?period=month&month=${prevMonthStr}${tabParam}`

  const nextArrowHref = isWeek
    ? `/dashboard?period=week&date=${nextWeekDate}${tabParam}`
    : `/dashboard?period=month&month=${nextMonthStr}${tabParam}`

  const todayArrowHref = `/dashboard?${periodParam}${tabParam}`

  // Group sessions by date for chronological display
  const groupedSessions = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    const dStr = (s.started_at as unknown) instanceof Date
      ? ((s.started_at as unknown) as Date).toISOString().slice(0, 10)
      : typeof s.started_at === 'string'
        ? s.started_at.slice(0, 10)
        : 'Unknown'
    if (!groupedSessions.has(dStr)) {
      groupedSessions.set(dStr, [])
    }
    groupedSessions.get(dStr)!.push(s)
  }

  return (
    <div data-surface="ledger" data-surface-mode="dashboard" className="m-dashboard">
      {/* 1. Period Toolbar (Rize Aligned) */}
      <section className="m-period-bar">
        <div className="m-period-left">
          <h1 className="m-period-title">{periodTitle}</h1>
          <div className="m-view-pills">
            <Link
              className={`m-pill ${activeTab === 'overview' ? 'active' : ''}`}
              data-active={activeTab === 'overview'}
              href={`/dashboard?${periodParam}${isWeek && params.date ? `&date=${params.date}` : ''}${!isWeek && params.month ? `&month=${params.month}` : ''}&tab=overview`}
            >
              Overview
            </Link>
            <Link
              className={`m-pill ${activeTab === 'sites' ? 'active' : ''}`}
              data-active={activeTab === 'sites'}
              href={`/dashboard?${periodParam}${isWeek && params.date ? `&date=${params.date}` : ''}${!isWeek && params.month ? `&month=${params.month}` : ''}&tab=sites`}
            >
              Sites
            </Link>
            <Link
              className={`m-pill ${activeTab === 'sessions' ? 'active' : ''}`}
              data-active={activeTab === 'sessions'}
              href={`/dashboard?${periodParam}${isWeek && params.date ? `&date=${params.date}` : ''}${!isWeek && params.month ? `&month=${params.month}` : ''}&tab=sessions`}
            >
              Sessions
            </Link>
          </div>
        </div>

        <div className="m-period-controls">
          <div className="m-period-capsule">
            <Link className="m-period-btn" href="/ledger">Day</Link>
            <Link
              className="m-period-btn"
              data-active={activePeriod === 'week'}
              href={`/dashboard?period=week${tabParam}`}
            >
              Week
            </Link>
            <Link
              className="m-period-btn"
              data-active={activePeriod === 'month'}
              href={`/dashboard?period=month${tabParam}`}
            >
              Month
            </Link>
          </div>
          <div className="m-nav-arrows">
            <Link className="m-nav-arrow" href={prevArrowHref} aria-label="Previous period">&lsaquo;</Link>
            <Link className="m-nav-arrow" href={todayArrowHref}>Today</Link>
            <Link className="m-nav-arrow" href={nextArrowHref} aria-label="Next period">&rsaquo;</Link>
          </div>
        </div>
      </section>

      {/* 2. HERO: Monthly or Weekly Breakdown Stacked Bars */}
      <section className="m-breakdown-panel" aria-label="Breakdown Chart">
        <div className="m-panel-head">
          <span>Breakdown</span>
          <span>
            <span className="m-breakdown-period-label">{periodTitle.toUpperCase()} &middot; </span>
            {formatHmCompact(activeBreakdown.totalAttendedSeconds)} TOTAL
          </span>
        </div>

        <div className="m-breakdown-chart-wrap">
          <div className="m-chart-container">
            {/* Y-Axis scale */}
            <div className="m-y-axis" aria-hidden="true">
              <span>8h</span>
              <span>6h</span>
              <span>4h</span>
              <span>2h</span>
              <span>0h</span>
            </div>

            {/* Horizontal dashed gridlines */}
            <div className="m-gridlines" aria-hidden="true">
              <div className="m-gridline" />
              <div className="m-gridline" />
              <div className="m-gridline" />
              <div className="m-gridline" />
              <div className="m-gridline" />
            </div>

            {/* Grouped bars */}
            <div className="m-bars-row">
              {activeBreakdown.days.map((d, idx) => {
                const isLeftEdge = idx < 4
                const isRightEdge = idx >= activeBreakdown.days.length - 4
                const alignClass = isLeftEdge ? 'm-tip-align-left' : isRightEdge ? 'm-tip-align-right' : 'm-tip-align-center'

                return (
                  <div
                    key={d.dateString}
                    className={`m-day-group ${alignClass}`}
                    data-day={d.day}
                    tabIndex={0}
                    aria-label={`${formatBarDate(d.dateString)}: ${formatHm(d.attendedSeconds)} focus`}
                  >
                    <div
                      className="m-day-bar-wrap"
                      style={{
                        height: d.totalSeconds > 0 ? `${d.totalHeightPercent}%` : '6px',
                        maxWidth: isWeek ? 36 : 24,
                      }}
                    >
                      {/* Interactive Tooltip Card on Hover */}
                      <div className="m-bar-tooltip" role="tooltip" aria-hidden="true">
                        <div className="m-tooltip-header">
                          <span className="m-tooltip-date">{formatBarDate(d.dateString)}</span>
                          {d.sessionCount > 0 && (
                            <span className="m-tooltip-badge">
                              {d.sessionCount} {d.sessionCount === 1 ? 'session' : 'sessions'}
                            </span>
                          )}
                        </div>

                        {d.totalSeconds > 0 ? (
                          <>
                            <div className="m-tooltip-divider" />
                            <div className="m-tooltip-metrics">
                              <div className="m-tooltip-row m-row-attended">
                                <div className="m-tooltip-row-left">
                                  <span className="m-tooltip-dot m-dot-attended" />
                                  <span className="m-tooltip-label">Attended</span>
                                </div>
                                <span className="m-tooltip-val">{formatHm(d.attendedSeconds)}</span>
                              </div>
                              {d.awaySeconds > 0 && (
                                <div className="m-tooltip-row m-row-away">
                                  <div className="m-tooltip-row-left">
                                    <span className="m-tooltip-dot m-dot-away" />
                                    <span className="m-tooltip-label">Away</span>
                                  </div>
                                  <span className="m-tooltip-val">{formatHm(d.awaySeconds)}</span>
                                </div>
                              )}
                              {d.breakSeconds > 0 && (
                                <div className="m-tooltip-row m-row-break">
                                  <div className="m-tooltip-row-left">
                                    <span className="m-tooltip-dot m-dot-break" />
                                    <span className="m-tooltip-label">Breaks</span>
                                  </div>
                                  <span className="m-tooltip-val">{formatHm(d.breakSeconds)}</span>
                                </div>
                              )}
                            </div>
                            <div className="m-tooltip-footer">
                              <span>Total focus</span>
                              <span>{formatHm(d.totalSeconds)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="m-tooltip-empty">No activity recorded</div>
                        )}
                      </div>

                      {d.totalSeconds > 0 ? (
                        <div className="m-bar-stack">
                          {d.attendedSeconds > 0 && (
                            <div
                              className="m-bar-seg m-bar-seg-attended"
                              style={{
                                height: `${(d.attendedSeconds / d.totalSeconds) * 100}%`,
                              }}
                              title={`Attended: ${formatHm(d.attendedSeconds)} (${Math.round((d.attendedSeconds / d.totalSeconds) * 100)}%)`}
                            />
                          )}
                          {d.awaySeconds > 0 && (
                            <div
                              className="m-bar-seg m-bar-seg-away"
                              style={{
                                height: `${(d.awaySeconds / d.totalSeconds) * 100}%`,
                              }}
                              title={`Away: ${formatHm(d.awaySeconds)} (${Math.round((d.awaySeconds / d.totalSeconds) * 100)}%)`}
                            />
                          )}
                          {d.breakSeconds > 0 && (
                            <div
                              className="m-bar-seg m-bar-seg-break"
                              style={{
                                height: `${(d.breakSeconds / d.totalSeconds) * 100}%`,
                              }}
                              title={`Breaks: ${formatHm(d.breakSeconds)} (${Math.round((d.breakSeconds / d.totalSeconds) * 100)}%)`}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="m-bar-empty" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* X-Axis day labels */}
          <div className="m-chart-x-axis" aria-hidden="true">
            {isWeek ? (
              ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, i) => {
                const dayNum = weeklyBreakdown.days[i]?.dateString.slice(8)
                return <span key={dayName}>{dayName} {dayNum}</span>
              })
            ) : (
              <>
                <span>{monthName} 1</span>
                <span>{monthName} 7</span>
                <span>{monthName} 14</span>
                <span>{monthName} 21</span>
                <span>{monthName} {monthlyBreakdown.days.length}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* VIEW: OVERVIEW (Default) */}
      {activeTab === 'overview' && (
        <>
          {/* 3. Three-Column Metric Grid */}
          <section className="m-stats-grid">
            {/* Column 1: Top Sites */}
            <div className="m-panel">
              <div className="m-panel-head">
                <span>Top Sites</span>
                <span>{formatHmCompact(currentTotals.attention)} Total</span>
              </div>
              <div className="m-panel-body">
                <div className="m-sites-list">
                  {rankedSites.length === 0 ? (
                    <div style={{ color: 'var(--m-ink-3)', fontSize: 13, padding: '12px 0' }}>
                      No site activity recorded yet.
                    </div>
                  ) : (
                    rankedSites.map((s) => (
                      <div className="m-site-row" key={s.domain}>
                        <span className="m-site-pct">{s.share}%</span>
                        <span className="m-site-domain" title={s.domain}>{s.domain}</span>
                        <div className="m-site-bar-track">
                          <div
                            className="m-site-bar-fill"
                            style={{ width: `${Math.max(6, Math.min(100, Math.round((s.seconds / maxSiteSeconds) * 100)))}%` }}
                          />
                        </div>
                        <span className="m-site-time">{formatHmCompact(s.seconds)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: Attention Breakdown (Concentric Donut SVG) */}
            <div className="m-panel">
              <div className="m-panel-head">
                <span>Attention Breakdown</span>
                <span>{activePeriod.toUpperCase()}</span>
              </div>
              <div className="m-panel-body">
                <div className="m-donut-container">
                  <div className="m-donut-visual">
                    <svg className="m-donut-svg" viewBox="0 0 180 180">
                      <circle cx="90" cy="90" r="74" fill="none" stroke="var(--m-ground-sunk)" strokeWidth="12" />
                      {attentionPct > 0 && (
                        <circle
                          cx="90"
                          cy="90"
                          r="74"
                          fill="none"
                          stroke="var(--m-clay)"
                          strokeWidth="12"
                          strokeDasharray={`${strokeAttention} ${C_OUTER}`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                        />
                      )}
                      {awayPct > 0 && (
                        <circle
                          cx="90"
                          cy="90"
                          r="74"
                          fill="none"
                          stroke="var(--m-ink-3)"
                          strokeWidth="12"
                          strokeDasharray={`${strokeAway} ${C_OUTER}`}
                          strokeDashoffset={`${offsetAway}`}
                          strokeLinecap="round"
                        />
                      )}
                      {breakPct > 0 && (
                        <circle
                          cx="90"
                          cy="90"
                          r="74"
                          fill="none"
                          stroke="var(--m-clay-2)"
                          strokeWidth="12"
                          strokeDasharray={`${strokeBreak} ${C_OUTER}`}
                          strokeDashoffset={`${offsetBreak}`}
                          strokeLinecap="round"
                        />
                      )}

                      {/* Inner Ring - Precision Segmented Ring */}
                      <circle cx="90" cy="90" r="56" fill="none" stroke="var(--m-ground-sunk)" strokeWidth="8" />
                      <circle
                        cx="90"
                        cy="90"
                        r="56"
                        fill="none"
                        stroke="var(--m-clay)"
                        strokeWidth="8"
                        strokeDasharray="160 352"
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="90"
                        cy="90"
                        r="56"
                        fill="none"
                        stroke="var(--m-clay-2)"
                        strokeWidth="8"
                        strokeDasharray="80 352"
                        strokeDashoffset="-164"
                      />
                      <circle
                        cx="90"
                        cy="90"
                        r="56"
                        fill="none"
                        stroke="var(--m-clay-3)"
                        strokeWidth="8"
                        strokeDasharray="45 352"
                        strokeDashoffset="-248"
                      />
                    </svg>

                    <div className="m-donut-center-info">
                      <span className="m-donut-center-val">{formatHmCompact(currentTotals.attention)}</span>
                      <span className="m-donut-center-label">Attention</span>
                    </div>
                  </div>

                  {/* Legend with deltas */}
                  <div className="m-donut-legend">
                    <div className="m-legend-row">
                      <div className="m-legend-label-group">
                        <span className="m-legend-dot" style={{ background: 'var(--m-clay)' }} />
                        <span>{attentionPct}% Attention</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className="m-legend-val">{formatHmCompact(currentTotals.attention)}</span>
                        <span className="m-legend-delta m-delta-up">&uarr; {fidelity.attentionDelta.delta > 0 ? formatHmCompact(fidelity.attentionDelta.delta) : '0m'}</span>
                      </div>
                    </div>
                    <div className="m-legend-row">
                      <div className="m-legend-label-group">
                        <span className="m-legend-dot" style={{ background: 'var(--m-ink-3)' }} />
                        <span>{awayPct}% Away</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className="m-legend-val">{formatHmCompact(currentTotals.away)}</span>
                        <span className="m-legend-delta m-delta-down">&darr; 3%</span>
                      </div>
                    </div>
                    <div className="m-legend-row">
                      <div className="m-legend-label-group">
                        <span className="m-legend-dot" style={{ background: 'var(--m-clay-2)' }} />
                        <span>{breakPct}% Breaks</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span className="m-legend-val">{formatHmCompact(currentTotals.break)}</span>
                        <span className="m-legend-delta m-delta-down">&darr; 1%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Performance & Fidelity */}
            <div className="m-panel">
              <div className="m-panel-head">
                <span>Performance & Fidelity</span>
                <span>{activePeriod === 'week' ? '7 Days' : '30 Days'}</span>
              </div>
              <div className="m-panel-body">
                <div className="m-attended-body">
                  <div className="m-metric-group">
                    <div className="m-metric-top-row">
                      <h3 className="m-metric-val">{formatHm(currentTotals.attention)}</h3>
                      <span className={`m-metric-delta ${fidelity.attentionDelta.direction === 'up' ? 'm-delta-up' : 'm-delta-down'}`}>
                        {fidelity.attentionDelta.direction === 'up' ? '↑' : '↓'} {formatHm(Math.abs(fidelity.attentionDelta.delta))}
                      </span>
                    </div>
                    <span className="m-metric-sub">Total focus recorded &middot; Prev {formatHm(prevTotals.attention)}</span>
                  </div>

                  <div className="m-metric-divider" />

                  <div className="m-metric-group">
                    <div className="m-metric-top-row">
                      <h3 className="m-metric-val">{formatHm(fidelity.avgSessionSeconds)}</h3>
                      <span className={`m-metric-delta ${fidelity.avgSessionDelta.direction === 'up' ? 'm-delta-up' : 'm-delta-down'}`}>
                        {fidelity.avgSessionDelta.direction === 'up' ? '↑' : '↓'} {formatHm(Math.abs(fidelity.avgSessionDelta.delta))}
                      </span>
                    </div>
                    <span className="m-metric-sub">Average per session &middot; Prev period</span>
                  </div>

                  <div className="m-metric-divider" />

                  <div className="m-metric-group">
                    <div className="m-metric-top-row">
                      <h3 className="m-metric-val">{fidelity.sessionCount} sessions</h3>
                      <span className={`m-metric-delta ${fidelity.sessionDelta.direction === 'up' ? 'm-delta-up' : 'm-delta-down'}`}>
                        {fidelity.sessionDelta.direction === 'up' ? '↑' : '↓'} {Math.abs(fidelity.sessionDelta.delta)} sessions
                      </span>
                    </div>
                    <span className="m-metric-sub">Completed intentions logged</span>
                  </div>

                  <div className="m-metric-divider" />

                  <div className="m-metric-group">
                    <div className="m-metric-top-row">
                      <h3 className="m-metric-val">{fidelity.finishedPct}% finished</h3>
                      <span className="m-metric-delta">{fidelity.finishedCount} Yes &middot; {fidelity.notYetCount} Not yet</span>
                    </div>
                    <span className="m-metric-sub">Outcome fidelity &middot; {fidelity.unansweredCount} unanswered</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Single Inference Sentence (ADR-0066) */}
          {showDomain && domainClaim && (
            <div className="m-inference-callout">
              <span className="m-mark" data-state="ended" aria-hidden="true" />
              <p className="m-ledger-pattern">
                The sessions you finished averaged {toWords(Math.round(domainClaim.finishedAvgSeconds / 60))}{' '}
                minutes on {domainClaim.domain}. The ones you did not averaged{' '}
                {toWords(Math.round(domainClaim.unfinishedAvgSeconds / 60))}.
              </p>
            </div>
          )}

          {showPart && partClaim && (
            <div className="m-inference-callout">
              <span className="m-mark" data-state="ended" aria-hidden="true" />
              <p className="m-ledger-pattern">
                Of the sessions you started in the {partClaim.part}, {toWords(partClaim.finished)}{' '}
                finished and {toWords(partClaim.unfinished)} did not.
              </p>
            </div>
          )}
        </>
      )}

      {/* VIEW: SITES TAB */}
      {activeTab === 'sites' && (
        <section className="m-sites-table-panel" aria-label="All Sites Breakdown">
          <div className="m-panel-head">
            <span>All Visited Sites</span>
            <span>{allRankedSites.length} Domains &middot; {formatHmCompact(currentTotals.attention)} Total</span>
          </div>

          {allRankedSites.length === 0 ? (
            <div style={{ padding: '32px 24px', color: 'var(--m-ink-3)', textAlign: 'center' }}>
              No visited sites recorded for this period.
            </div>
          ) : (
            allRankedSites.map((s, idx) => (
              <div className="m-sites-table-row" key={s.domain}>
                <span className="m-site-pct">#{idx + 1}</span>
                <span className="m-site-domain" style={{ fontSize: 14, fontWeight: 600 }}>{s.domain}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="m-site-bar-track" style={{ flex: 1 }}>
                    <div
                      className="m-site-bar-fill"
                      style={{ width: `${Math.max(6, Math.min(100, Math.round((s.seconds / maxSiteSeconds) * 100)))}%` }}
                    />
                  </div>
                  <span className="m-site-pct" style={{ width: 32, textAlign: 'right' }}>{s.share}%</span>
                </div>
                <span className="m-site-time" style={{ fontSize: 13, fontWeight: 500 }}>{formatHmCompact(s.seconds)}</span>
              </div>
            ))
          )}
        </section>
      )}

      {/* VIEW: SESSIONS TAB OR OVERVIEW (Session Record Ledger) */}
      {(activeTab === 'overview' || activeTab === 'sessions') && (
        <section className="m-record-panel" aria-label="Session Record Ledger">
          <div className="m-panel-head">
            <span>Session Record</span>
            <span>{activeTab === 'sessions' ? 'Full Archive' : 'Recent Activity'}</span>
          </div>

          {/* Unanswered actions backlog (ADR-0050) */}
          {backlog.length > 0 && (
            <div
              className="m-ledger-actions"
              style={{
                padding: '16px 20px',
                borderBottom: 'var(--m-stroke-hair) solid var(--m-rule)',
                background: 'var(--m-ground-sunk)',
              }}
            >
              <p className="m-meta" style={{ fontWeight: 600, color: 'var(--m-ink)' }}>
                {backlog.length === 1
                  ? 'one session is still unanswered.'
                  : `${toWords(backlog.length)} sessions are still unanswered.`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {backlog.slice(0, 3).map((s) => (
                  <Link className="m-sentence" key={s.id} href={`/review/${s.id}`}>
                    {s.intention || 'No intention given'}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {Array.from(groupedSessions.entries()).map(([dateStr, daySessions]) => (
            <div key={dateStr}>
              <div className="m-day-divider">{formatDayDivider(dateStr)}</div>
              {daySessions.map((s) => {
                const events = (s.events || []) as Parameters<typeof toBand>[0]
                return (
                  <div className="m-row m-record-row" key={s.id}>
                    {s.intention ? (
                      <Link className="m-sentence m-row-intention" href={`/review/${s.id}`}>
                        {s.intention}
                      </Link>
                    ) : (
                      <Link className="m-meta m-row-intention" href={`/review/${s.id}`}>
                        No intention given
                      </Link>
                    )}
                    <Band segments={toBand(events)} state={s.ended_at ? 'ended' : 'running'} />
                    <div className="m-row-outcome">
                      <span className={`m-outcome-dot ${s.outcome === 'yes' ? 'yes' : s.outcome === 'no' ? 'not-yet' : 'unanswered'}`} />
                      <span className="m-meta" style={{ color: s.outcome === 'unanswered' ? undefined : 'var(--m-ink)' }}>
                        {s.outcome === 'yes' ? 'Yes' : s.outcome === 'no' ? 'Not yet' : 'Unanswered'}
                      </span>
                    </div>
                    <div className="m-row-dur m-row-figure">
                      {s.ended_at && s.started_at
                        ? formatHmCompact((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)
                        : 'running'}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </section>
      )}

      {/* Floating Tomato Companion Pet */}
      <CompanionPet intention={latestIntention} />
    </div>
  )
}
