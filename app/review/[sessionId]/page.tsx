import { currentUserId } from '@/lib/auth/session'
import { notFound, redirect } from 'next/navigation'
import { getReviewData } from '@/lib/review-data'
import { toBand } from '@/lib/band'
import { Band } from '../../band'
import { Answer } from './answer'
import { toWords } from '@/lib/words'
import { UNRECORDED_MIN_SHARE } from '@/lib/session-time'

const TINTS = ['attention-1', 'attention-2', 'attention-3'] as const

function minutes(seconds: number) {
  return Math.round(seconds / 60)
}

export const dynamic = 'force-dynamic'

export default async function Review({ params }: { params: Promise<{ sessionId: string }> }) {
  const userId = await currentUserId()
  if (!userId) redirect('/')

  const { sessionId } = await params
  const data = await getReviewData(sessionId, userId)
  if (!data) notFound()

  // The review's authored entrance (#48). A running counter rather than hard-coded indices
  // because three of the children are conditional — a short-circuited `&&` simply never calls
  // rise(), which is exactly right: the sequence closes up rather than leaving a hole.
  let riseIndex = 0
  // String(), not the bare number: React only skips its automatic `px` suffix for properties it
  // knows, and a custom property is not one of them. `calc(1px * 50ms)` is invalid and fails
  // silently — the whole stagger would flatten to zero with nothing in the console.
  const rise = (extra = '') => ({
    className: extra ? `${extra} m-rise` : 'm-rise',
    style: { '--m-rise-i': String(riseIndex++) } as React.CSSProperties,
  })

  return (
    <div data-surface="review">
      <p {...rise('m-mark')} data-state="ended" />
      {data.intention ? (
        <>
          <p {...rise('m-meta')}>You meant to</p>
          <p {...rise('m-sentence')}>{data.intention}</p>
        </>
      ) : (
        <p {...rise('m-meta')}>You didn&apos;t say what you meant to do.</p>
      )}

      <div {...rise()}>
        <Band segments={toBand(data.rows as Parameters<typeof toBand>[0])} state={data.endedAt ? 'ended' : 'running'} />
      </div>

      <div {...rise('m-review-rows')}>
        {data.topAttention.map((row, i) => (
          <div className="m-row" key={row.domain}>
            <span className="m-row-bar" data-kind={TINTS[i]} />
            <span className="m-row-domain">{row.domain}</span>
            <span className="m-row-figure">{minutes(row.seconds)} min</span>
          </div>
        ))}

        {data.awaySeconds > 0 && (
          <div className="m-row" title="Time not measured — your screen was locked or idle, or you left the browser.">
            <span className="m-row-bar" data-kind="away" />
            <span className="m-row-domain">away</span>
            <span className="m-row-figure">{minutes(data.awaySeconds)} min</span>
          </div>
        )}
      </div>

      {data.blockedAttempts > 0 && <p {...rise('m-meta')}>{data.blockedAttempts} blocked attempts</p>}

      {/* ADR-0054. The served/not-served boundary is browser share, reported at runtime — so
          a session we only partly watched says so rather than presenting a fragment as the
          whole. Minutes, never a percentage (§3.1 bans percentages on every surface), and
          spelled as a word to match the dashboard. Gated by share, not by a fixed number of
          minutes: a fixed floor would shout on a short session and stay silent on a long one. */}
      {/* Denominator is the whole session, so it must sum EVERY duration-bearing row —
          topAttention is only the top three and would overstate the share. */}
      {data.unrecordedSeconds >
        (data.unrecordedSeconds +
          data.rows
            .filter((r) => r.kind === 'attention' || r.kind === 'away' || r.kind === 'break')
            .reduce((t, r) => t + r.seconds, 0)) *
          UNRECORDED_MIN_SHARE && (
          <p {...rise('m-meta')}>
            {toWords(minutes(data.unrecordedSeconds))} minutes of this session happened outside the
            browser. This page cannot tell you about those.
          </p>
        )}

      <div {...rise('m-review-ask')}>
        {data.outcome === 'unanswered' ? (
          <>
            <p className="m-rate">Did you?</p>
            <Answer sessionId={sessionId} />
          </>
        ) : (
          /* The one place in the whole product where positive feedback is permitted — I2 bans
             it everywhere else. It rendered as .m-meta: 13px, --m-ink-3, 3.20:1, the same
             treatment as "2 blocked attempts". The question was the largest type on the page
             and the answer to it the smallest, which inverts the peak-end of the one surface
             PRD §3.3 calls the product.
             Both branches take IDENTICAL treatment. Byte-identical buttons do not hold
             invariant 1 if the sentence after them reads warmer on one side. And the counts
             are spelled: "3 of 5" is one step from a rate, and §3.1 bans rates. */
          <p className="m-sentence">
            {data.outcome === 'yes'
              ? `Good. That's ${toWords(data.finished)} of ${toWords(data.answered)}.`
              : 'Noted. It carries over.'}
          </p>
        )}
      </div>
    </div>
  )
}
