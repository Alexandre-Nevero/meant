import { Fragment } from 'react'
import { currentUserId } from '@/lib/auth/session'
import { Band } from './band'
import { IntentionTyper } from './intention-typer'
import type { Segment } from '@/lib/band'

export const dynamic = 'force-dynamic'

// The mark evolving across the loop (canvas: Landing.dc.html §beats), not four
// matching cards — each step's chip and band are a step further along than the last.
const STEPS: readonly {
  title: string
  body: string
  sentence: string
  segments: readonly Segment[]
}[] = [
  {
    title: 'Say it.',
    body: 'Type what you mean to finish. Leaving it empty is allowed, and it is counted.',
    sentence: 'finish the supplier report',
    segments: [{ kind: 'remainder', flex: 1 }],
  },
  {
    title: 'Work.',
    body: 'Attention is recorded without you starting anything.',
    sentence: 'finish the supplier report',
    segments: [{ kind: 'attention-1', flex: 20 }, { kind: 'attention-2', flex: 6 }, { kind: 'attention-3', flex: 2 }],
  },
  {
    title: 'Get blocked.',
    body: 'The sites you chose show your own sentence back to you. No bypass.',
    sentence: 'finish the supplier report',
    segments: [{ kind: 'attention-1', flex: 30 }, { kind: 'attention-2', flex: 8 }, { kind: 'attention-3', flex: 3 }],
  },
  {
    title: 'Answer.',
    body: 'Did you? Yes or Not yet, weighted the same, forever.',
    sentence: 'finish the supplier report',
    segments: [{ kind: 'attention-1', flex: 41 }, { kind: 'attention-2', flex: 12 }, { kind: 'attention-3', flex: 9 }],
  },
] as const

const LEDGER_PREVIEW = [
  { intention: 'finish the supplier report', outcome: 'Not yet', segments: [{ kind: 'attention-1', flex: 41 }, { kind: 'attention-2', flex: 12 }, { kind: 'attention-3', flex: 9 }] },
  { intention: 'reply to the vendor thread', outcome: 'Yes', segments: [{ kind: 'attention-1', flex: 14 }, { kind: 'attention-2', flex: 3 }, { kind: 'attention-3', flex: 1 }] },
  { intention: 'read the Q3 brief properly', outcome: 'Yes', segments: [{ kind: 'attention-1', flex: 26 }, { kind: 'attention-2', flex: 5 }, { kind: 'attention-3', flex: 2 }] },
] as const

export default async function Home() {
  const userId = await currentUserId()
  // No forced redirect for a signed-in visitor (E7 — the landing page must always
  // render): every auth-dependent CTA below swaps its own label/target instead.
  const signedInHref = '/dashboard'
  const signedInLabel = 'Go to your dashboard'

  return (
    <main data-surface="landing">
      <header className="m-landing-header">
        <div className="m-landing-brand">
          <p className="m-mark" data-state="ended" />
          <p className="m-landing-wordmark">MEANT</p>
        </div>
        <div className="m-landing-nav-actions">
          <a
            className="m-btn m-landing-nav-secondary"
            data-variant="quiet"
            href="https://github.com/ED3N-Ventures-Interns/meant#extension"
            target="_blank"
            rel="noreferrer"
          >
            Add to Chrome
          </a>
          <a className="m-btn" data-variant="primary" href={userId ? signedInHref : '/sign-in'}>
            {userId ? signedInLabel : 'Sign in'}
          </a>
        </div>
      </header>

      <section className="m-landing-hero">
        <IntentionTyper />
        <h1 className="m-rate">Eleven this month. Seven finished.</h1>
        <p className="m-landing-lede">Say what you mean. It knows if you did.</p>
      </section>

      <section className="m-landing-beats">
        <h2 className="m-landing-h2">Four steps and one sentence.</h2>
        <div className="m-landing-beats-grid">
          {STEPS.map((step, i) => (
            <Fragment key={step.title}>
              {i > 0 && (
                <svg className="m-landing-beat-arrow" width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
                  <path d="M0.5 5H15M15 5L10.5 1M15 5L10.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <div className="m-landing-beat" data-index={i}>
                <div className="m-landing-beat-chip">
                  {step.sentence && <p>{step.sentence}</p>}
                </div>
                <Band segments={[...step.segments]} />
                <p className="m-landing-beat-title">{step.title}</p>
                <p className="m-meta">{step.body}</p>
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      <section className="m-landing-prose">
        <h2 className="m-landing-h2">It reads the page. It stores nothing.</h2>
        <p>
          To tell your work from your drift it has to read the tab you are on, once, and decide.
          What it keeps is the site name and one word: served, drifted, unclear. There is no
          column for the text, no line in a log, nothing queued for later. Not a promise — there
          is nowhere to put it.
        </p>
      </section>

      <section className="m-landing-prose">
        <h2 className="m-landing-h2">No productivity score. Anywhere.</h2>
        <p>
          Time is evidence of where your attention went. It is never a score, never a
          streak, never a grade. The number that accumulates is how many things you said you
          would finish, and did.
        </p>
      </section>

      <section className="m-landing-ledger">
        <p className="m-meta m-landing-ledger-caption">
          The band is the attention: a session&rsquo;s top domains, by time.
        </p>
        {LEDGER_PREVIEW.map((row) => (
          <div className="m-row" key={row.intention}>
            <p className="m-sentence">{row.intention}</p>
            <Band segments={[...row.segments]} />
            <p className="m-meta" style={{ color: 'var(--m-ink)' }}>{row.outcome}</p>
          </div>
        ))}
        <div className="m-landing-auth">
          <a className="m-btn" data-variant="primary" href={userId ? signedInHref : '/sign-in'}>
            {userId ? signedInLabel : 'Sign in'}
          </a>
          <p className="m-meta">Your sessions stay in your account. There is no team view.</p>
        </div>
      </section>
    </main>
  )
}
