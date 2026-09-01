import { redirect } from 'next/navigation'
import { currentUserId } from '@/lib/auth/session'
import { AuthForm } from './auth-form'
import { Band } from './band'

export const dynamic = 'force-dynamic'

const BEATS = [
  { title: 'Say it.', body: 'Type what you mean to finish. Leaving it empty is allowed, and it is counted.' },
  { title: 'Work.', body: 'Attention is recorded without you starting anything.' },
  { title: 'Get blocked.', body: 'The sites you chose show your own sentence back to you. No bypass.' },
  { title: 'Answer.', body: 'Did you? Yes or Not yet, weighted the same, forever.' },
]

const LEDGER_PREVIEW = [
  { intention: 'finish the supplier report', outcome: 'Not yet', segments: [{ kind: 'attention-1', flex: 41 }, { kind: 'attention-2', flex: 12 }, { kind: 'attention-3', flex: 9 }] },
  { intention: 'reply to the vendor thread', outcome: 'Yes', segments: [{ kind: 'attention-1', flex: 14 }, { kind: 'attention-2', flex: 3 }, { kind: 'attention-3', flex: 1 }] },
  { intention: 'read the Q3 brief properly', outcome: 'Yes', segments: [{ kind: 'attention-1', flex: 26 }, { kind: 'attention-2', flex: 5 }, { kind: 'attention-3', flex: 2 }] },
] as const

export default async function Home() {
  const userId = await currentUserId()
  if (userId) redirect('/dashboard')

  return (
    <div data-surface="landing">
      <header className="m-landing-header">
        <div className="m-landing-brand">
          <p className="m-mark" data-state="ended" />
          <p className="m-landing-wordmark">MEANT</p>
        </div>
        <a
          className="m-meta"
          href="https://github.com/ED3N-Ventures-Interns/meant#extension"
          target="_blank"
          rel="noreferrer"
        >
          Add to Chrome
        </a>
      </header>

      <section className="m-landing-hero">
        <p className="m-mark" data-state="ended" />
        <h1 className="m-rate">Eleven this month. Seven finished.</h1>
        <p className="m-landing-lede">
          MEANT asks what you mean to do, turns it into a short plan, blocks what you chose to
          avoid, and sits with you while you work. Every other focus app has to ask whether you
          were focused. This one is inside the tab, so it already knows.
        </p>
        <div className="m-landing-auth" id="auth">
          <p className="m-meta">Sign in or create an account to continue.</p>
          <AuthForm />
          <p className="m-meta">Chrome and Edge. No installer, no admin rights.</p>
        </div>
      </section>

      <section className="m-landing-beats">
        <h2 className="m-landing-h2">Four steps and one sentence.</h2>
        <div className="m-landing-beats-grid">
          {BEATS.map((beat) => (
            <div key={beat.title}>
              <p className="m-mark" data-state="ended" />
              <p className="m-landing-beat-title">{beat.title}</p>
              <p className="m-meta">{beat.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="m-landing-prose">
        <h2 className="m-landing-h2">It reads the page. It stores nothing.</h2>
        <p className="m-meta">
          To tell your work from your drift it has to read the tab you are on, once, and decide.
          What it keeps is the site name and one word: served, drifted, unclear. There is no
          column for the text, no line in a log, nothing queued for later. Not a promise — there
          is nowhere to put it.
        </p>
      </section>

      <section className="m-landing-prose">
        <h2 className="m-landing-h2">No total hours. Anywhere.</h2>
        <p className="m-meta">
          Time is evidence inside one session&rsquo;s review. It is never a headline, never a
          streak, never a score. The number that accumulates is how many things you said you
          would finish, and did.
        </p>
      </section>

      <section className="m-landing-ledger">
        {LEDGER_PREVIEW.map((row) => (
          <div className="m-row" key={row.intention}>
            <p className="m-sentence">{row.intention}</p>
            <Band segments={[...row.segments]} />
            <p className="m-meta" style={{ color: 'var(--m-ink)' }}>{row.outcome}</p>
          </div>
        ))}
        <div className="m-landing-auth">
          <a className="m-btn" data-variant="primary" href="#auth">Sign in</a>
          <p className="m-meta">Your sessions stay in your account. There is no team view.</p>
        </div>
      </section>
    </div>
  )
}
