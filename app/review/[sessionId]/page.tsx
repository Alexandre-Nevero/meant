import { currentUserId } from '@/lib/auth/session'
import { notFound, redirect } from 'next/navigation'
import { getReviewData } from '@/lib/review-data'
import { toBand } from '@/lib/band'
import { Band } from '../../band'
import { Answer } from './answer'

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

  return (
    <div data-surface="review">
      <p className="m-mark" data-state="ended" />
      {data.intention ? (
        <>
          <p className="m-meta">You meant to</p>
          <p className="m-sentence">{data.intention}</p>
        </>
      ) : (
        <p className="m-meta">You didn&apos;t say what you meant to do.</p>
      )}

      <Band segments={toBand(data.rows as Parameters<typeof toBand>[0])} state={data.endedAt ? 'ended' : 'running'} />

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

      {data.blockedAttempts > 0 && <p className="m-meta">{data.blockedAttempts} blocked attempts</p>}

      {data.outcome === 'unanswered' ? (
        <>
          <p className="m-rate">Did you?</p>
          <Answer sessionId={sessionId} />
        </>
      ) : (
        <p className="m-meta">
          {data.outcome === 'yes'
            ? `Good. That's ${data.finished} of ${data.answered}.`
            : 'Noted. It carries over.'}
        </p>
      )}
    </div>
  )
}
