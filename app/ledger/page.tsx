import { currentUserId } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import { toBand } from '@/lib/band'
import { Band } from '../band'
import { CompanionPet } from '../companion-pet'
import {
  formatHm,
  formatHmCompact,
  computeDailyTimeline,
  type SessionRow,
} from '@/lib/dashboard-figures'

export const dynamic = 'force-dynamic'

interface LedgerPageProps {
  searchParams?: Promise<{ date?: string }>
}

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const userId = await currentUserId()
  if (!userId) redirect('/')

  const params = searchParams ? await searchParams : {}
  const now = new Date()
  const todayString = params.date || now.toISOString().slice(0, 10)

  // Format header date: "Today · Friday, Sep 18"
  const dateObj = new Date(todayString + 'T12:00:00Z')
  const dateFormatted = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const isToday = todayString === now.toISOString().slice(0, 10)
  const headerTitle = isToday ? `Today · ${dateFormatted}` : dateFormatted
  const panelDateLabel = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase()

  // Fetch recent sessions
  const sessionsRaw = await sql`
    select s.id, s.intention, s.started_at, s.ended_at, s.outcome,
           coalesce(
             (select json_agg(json_build_object('kind', e.kind, 'domain', e.domain, 'seconds', e.seconds, 'label', e.label))
                from event e where e.session_id = s.id),
             '[]'
           ) as events
      from session s
     where s.user_id = ${userId}
     order by s.started_at desc
     limit 50`

  const sessions = sessionsRaw as unknown as SessionRow[]

  if (sessions.length === 0) {
    return (
      <div className="m-empty" data-surface="ledger">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
        <Link className="m-meta" href="/setup">Set up your sites</Link>
        <CompanionPet />
      </div>
    )
  }

  // Compute daily timeline
  const timeline = computeDailyTimeline(todayString, sessions)

  // Filter today's sessions for the list
  const todaySessions = sessions.filter(s => {
    if (!s.started_at) return false
    return new Date(s.started_at).toISOString().slice(0, 10) === todayString
  })

  const latestIntention = sessions[0]?.intention || null

  return (
    <div data-surface="ledger" className="m-dashboard">
        {/* Date Navigation Bar */}
        <div className="m-period-bar">
          <div className="m-period-left">
            <h1 className="m-period-title">{headerTitle}</h1>
          </div>

          <div className="m-period-controls">
            <div className="m-period-nav">
              <button className="m-period-btn" type="button" aria-label="Previous day" disabled>
                ‹
              </button>
              <span className="m-period-pill active">Today</span>
              <button className="m-period-btn" type="button" aria-label="Next day" disabled>
                ›
              </button>
            </div>
          </div>
        </div>

        {/* HERO: Daily Timeline (04:00 to 22:00) */}
        <section className="m-timeline-panel" aria-label="Daily Timeline">
          <div className="m-panel-head">
            <span>Daily Timeline</span>
            <span>{panelDateLabel}</span>
          </div>

          <div className="m-timeline-body">
            <div className="m-timeline-meta-row">
              <div className="m-timeline-summary">
                Today: {formatHm(timeline.totalAttendedSeconds)} focus
              </div>
              <div className="m-timeline-stats-pills">
                <span>
                  <strong>{timeline.sessionsCount}</strong> sessions logged
                </span>
                <span>•</span>
                <span>
                  <strong>{Math.round(timeline.totalAttendedSeconds / 60)} min</strong> attended
                </span>
                <span>•</span>
                <span>
                  <strong>{Math.round(timeline.totalAwaySeconds / 60)} min</strong> away
                </span>
                <span>•</span>
                <span>
                  <strong>{Math.round(timeline.totalBreakSeconds / 60)} min</strong> breaks
                </span>
              </div>
            </div>

            {/* Timeline Track with 04:00 to 22:00 window */}
            <div className="m-timeline-track-wrap" role="region" aria-label="Visual timeline track">
              {/* Subtle 2-hour interval grid guide lines */}
              <div className="m-timeline-guides" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <div key={i} className="m-timeline-guide" style={{ left: `${(i / 9) * 100}%` }} />
                ))}
              </div>

              {timeline.blocks.length === 0 ? (
                <div className="m-timeline-empty-hint">
                  <span className="m-timeline-empty-dot" aria-hidden="true" />
                  <span>No sessions recorded during this window yet</span>
                </div>
              ) : (
                timeline.blocks.map(b => {
                  const total = Math.max(1, b.attendedSeconds + b.awaySeconds + b.breakSeconds)
                  const attPct = (b.attendedSeconds / total) * 100
                  const awayPct = (b.awaySeconds / total) * 100
                  const breakPct = (b.breakSeconds / total) * 100

                  return (
                    <div
                      key={b.id}
                      className="m-timeline-block"
                      style={{
                        left: `${b.leftPercent}%`,
                        width: `${b.widthPercent}%`,
                      }}
                      title={`${b.intention} (${formatHm(b.attendedSeconds)})`}
                    >
                      {attPct > 0 && (
                        <div
                          className="m-block-attended"
                          style={{ width: `${attPct}%` }}
                        />
                      )}
                      {awayPct > 0 && (
                        <div
                          className="m-block-away"
                          style={{ width: `${awayPct}%` }}
                        />
                      )}
                      {breakPct > 0 && (
                        <div
                          className="m-block-break"
                          style={{ width: `${breakPct}%` }}
                        />
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Timeline Hour Markers */}
            <div className="m-timeline-ticks" aria-hidden="true">
              <span>04:00</span>
              <span>06:00</span>
              <span>08:00</span>
              <span>10:00</span>
              <span>12:00</span>
              <span>14:00</span>
              <span>16:00</span>
              <span>18:00</span>
              <span>20:00</span>
              <span>22:00</span>
            </div>
          </div>
        </section>

        {/* TODAY'S SESSIONS TABLE */}
        <section className="m-record-panel" aria-label="Today's Sessions">
          <div className="m-panel-head">
            <span>Today&apos;s Sessions</span>
            <span>{todaySessions.length} Completed</span>
          </div>

          <div className="m-record-list">
            {todaySessions.length === 0 ? (
              <div className="m-record-empty">
                <span className="m-record-empty-title">No sessions completed yet today</span>
                <span className="m-record-empty-sub">
                  Start a focus session in the extension to log your attention and build your daily ledger.
                </span>
              </div>
            ) : (
              todaySessions.map(s => {
                const totalSec = (s.events || []).reduce((acc, e) => acc + (e.seconds || 0), 0)
                const attSec = (s.events || [])
                  .filter(e => e.kind === 'attention')
                  .reduce((acc, e) => acc + (e.seconds || 0), 0)
                const awaySec = (s.events || [])
                  .filter(e => e.kind === 'away')
                  .reduce((acc, e) => acc + (e.seconds || 0), 0)
                const breakSec = (s.events || [])
                  .filter(e => e.kind === 'break')
                  .reduce((acc, e) => acc + (e.seconds || 0), 0)

                const total = Math.max(1, totalSec || 1)
                const attPct = (attSec / total) * 100
                const awayPct = (awaySec / total) * 100
                const breakPct = (breakSec / total) * 100

                const out = (s.outcome || 'unanswered').toLowerCase()
                const outLabel = out === 'yes' ? 'Yes' : out === 'no' ? 'Not yet' : 'Unanswered'
                const outClass = out === 'yes' ? 'yes' : out === 'no' ? 'not-yet' : 'unanswered'
                const events = (s.events || []) as Parameters<typeof toBand>[0]

                return (
                  <div key={s.id} className="m-record-row">
                    <div className="m-row-intention">
                      {s.intention || 'No intention given'}
                    </div>

                    <Band segments={toBand(events)} state={s.ended_at ? 'ended' : 'running'} />

                    <div className="m-row-outcome">
                      <span className={`m-outcome-dot ${outClass}`} aria-hidden="true" />
                      <span>{outLabel}</span>
                    </div>

                    <div className="m-row-dur">
                      {s.ended_at && s.started_at
                        ? formatHmCompact((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)
                        : 'running'}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Anchored Tomato Companion Pet */}
        <CompanionPet intention={latestIntention} />
      </div>
  )
}
