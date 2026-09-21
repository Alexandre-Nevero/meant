import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatHm,
  totalsByKind,
  rankDomains,
  changeAgainst,
  computePerformanceFidelity,
  computeDailyTimeline,
  computeMonthlyBreakdown,
  computeWeeklyBreakdown,
} from '../lib/dashboard-figures.ts'

test('formatHm drops the hour when there is none', () => {
  assert.equal(formatHm(0), '0 min')
  assert.equal(formatHm(1500), '25 min')
  assert.equal(formatHm(3600), '1 hr 0 min')
  assert.equal(formatHm(148800), '41 hr 20 min')
})

test('totalsByKind ignores block_hit, which has null seconds', () => {
  const rows = [
    { kind: 'attention', seconds: 600 },
    { kind: 'away', seconds: 300 },
    { kind: 'break', seconds: 120 },
    { kind: 'block_hit', seconds: null },
  ]
  assert.deepEqual(totalsByKind(rows), {
    attention: 600,
    away: 300,
    break: 120,
    unrecorded: 0,
  })
})

test('rankDomains sorts by seconds and shares sum to 100 or less', () => {
  const out = rankDomains([
    { domain: 'a.com', seconds: 300, label: 'work' },
    { domain: 'b.com', seconds: 700, label: 'distract' },
  ])
  assert.equal(out[0].domain, 'b.com')
  assert.equal(out[0].share, 70)
  assert.ok(out.reduce((t, d) => t + d.share, 0) <= 100)
})

test('changeAgainst reports flat rather than a zero-percent rise', () => {
  assert.deepEqual(changeAgainst(100, 100), { delta: 0, direction: 'flat' })
  assert.deepEqual(changeAgainst(0, 100), { delta: -100, direction: 'down' })
})

test('changeAgainst does not divide by zero on a first month', () => {
  assert.deepEqual(changeAgainst(500, 0), { delta: 500, direction: 'up' })
})

test('computePerformanceFidelity aggregates session counts and outcome rates', () => {
  const sessions = [
    { outcome: 'yes' },
    { outcome: 'yes' },
    { outcome: 'no' },
    { outcome: 'unanswered' },
  ]
  const perf = computePerformanceFidelity(sessions, 3, 7200, 3600)
  assert.equal(perf.sessionCount, 4)
  assert.equal(perf.finishedCount, 2)
  assert.equal(perf.notYetCount, 1)
  assert.equal(perf.unansweredCount, 1)
  assert.equal(perf.finishedPct, 67)
  assert.equal(perf.sessionDelta.delta, 1)
  assert.equal(perf.sessionDelta.direction, 'up')
})

test('computeDailyTimeline positions today sessions within the day window', () => {
  const sessions = [
    {
      id: 's1',
      intention: 'code review',
      started_at: '2026-09-18T08:00:00.000Z',
      ended_at: '2026-09-18T09:00:00.000Z',
      events: [
        { kind: 'attention', seconds: 2700 },
        { kind: 'away', seconds: 900 },
      ],
    },
  ]
  const timeline = computeDailyTimeline('2026-09-18', sessions, 4, 22)
  assert.equal(timeline.blocks.length, 1)
  assert.ok(timeline.blocks[0].leftPercent > 20 && timeline.blocks[0].leftPercent < 30)
  assert.ok(timeline.blocks[0].widthPercent > 0)
  assert.equal(timeline.blocks[0].attendedSeconds, 2700)
  assert.equal(timeline.blocks[0].awaySeconds, 900)
})

test('computeMonthlyBreakdown groups session attention by day of the month', () => {
  const sessions = [
    {
      id: 's1',
      started_at: '2026-09-01T10:00:00.000Z',
      ended_at: '2026-09-01T12:00:00.000Z',
      events: [
        { kind: 'attention', seconds: 5400 },
        { kind: 'away', seconds: 1800 },
      ],
    },
    {
      id: 's2',
      started_at: '2026-09-15T14:00:00.000Z',
      ended_at: '2026-09-15T15:00:00.000Z',
      events: [
        { kind: 'attention', seconds: 3600 },
      ],
    },
  ]
  const breakdown = computeMonthlyBreakdown(2026, 9, sessions)
  assert.equal(breakdown.days.length, 30) // September has 30 days
  assert.equal(breakdown.days[0].day, 1)
  assert.equal(breakdown.days[0].attendedSeconds, 5400)
  assert.equal(breakdown.days[0].awaySeconds, 1800)
  assert.equal(breakdown.days[14].day, 15)
  assert.equal(breakdown.days[14].attendedSeconds, 3600)
  assert.equal(breakdown.days[1].attendedSeconds, 0)
  assert.equal(breakdown.totalAttendedSeconds, 9000)
})

test('computeWeeklyBreakdown groups session attention by day of the week', () => {
  const sessions = [
    {
      id: 's1',
      started_at: '2026-09-15T10:00:00.000Z',
      ended_at: '2026-09-15T12:00:00.000Z',
      events: [
        { kind: 'attention', seconds: 5400 },
        { kind: 'away', seconds: 1800 },
      ],
    },
    {
      id: 's2',
      started_at: '2026-09-16T14:00:00.000Z',
      ended_at: '2026-09-16T15:00:00.000Z',
      events: [
        { kind: 'attention', seconds: 3600 },
      ],
    },
  ]
  const breakdown = computeWeeklyBreakdown(new Date('2026-09-18T12:00:00Z'), sessions)
  assert.equal(breakdown.days.length, 7)
  assert.equal(breakdown.totalAttendedSeconds, 9000)
  assert.equal(breakdown.totalAwaySeconds, 1800)
})

