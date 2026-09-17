import { currentUserId } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sql } from '@/lib/db'
import { toBand } from '@/lib/band'
import { toWords } from '@/lib/words'
import { Band } from '../band'
import { contrastByOutcome } from '@/lib/attention-contrast'
import { contrastByPartOfDay } from '@/lib/time-of-day'
import { answerableBacklog } from '@/lib/unanswered'
import { PATTERN_MIN_SESSIONS } from '@/lib/thresholds'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const userId = await currentUserId()
  if (!userId) redirect('/')

  const sessions = await sql`
    select s.id, s.intention, s.ended_at, s.outcome,
           coalesce(
             (select json_agg(json_build_object('kind', e.kind, 'domain', e.domain, 'seconds', e.seconds))
                from event e where e.session_id = s.id),
             '[]'
           ) as events
      from session s
     where s.user_id = ${userId}
     order by s.started_at desc
     limit 50`

  if (sessions.length === 0) {
    return (
      <div className="m-empty" data-surface="ledger">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
        <Link className="m-meta" href="/setup">Set up your sites</Link>
      </div>
    )
  }

  const [counts] = await sql`
    select
      count(*) filter (where outcome = 'yes')::int as finished,
      count(*) filter (where outcome in ('yes', 'no'))::int as answered
    from session
    where user_id = ${userId} and started_at >= date_trunc('month', now())`

  // ADR-0060: build the arithmetic before the judge. No model, no page text, no cost — and
  // the baseline any future judge has to beat. ADR-0051 permits reasoning FROM the outcome
  // answer; it forbids valence, not use.
  // sessionId is required, not incidental: contrastByOutcome folds to one total per
  // (domain, session) before averaging. Without it, `sessions` counts event rows and the
  // I6 evidence gate fires on far less evidence than it reports.
  const contrastRows = (await sql`
    select e.domain, e.seconds, s.outcome, s.id as "sessionId"
      from event e join session s on s.id = e.session_id
     where s.user_id = ${userId}
       and e.kind = 'attention'
       and e.domain is not null
       and s.outcome in ('yes', 'no')`) as {
    domain: string
    seconds: number
    outcome: string
    sessionId: string
  }[]
  const contrasts = contrastByOutcome(contrastRows)

  // Task 1's contrast needs an hour already local to the user: the extension stores it on the
  // session row at start, from its own clock. Null means unknown — a session recorded before the
  // column existed, or a client that sent something that was not an integer 0-23 — and is
  // excluded rather than guessed at (ADR-0053). There is no `at time zone` here deliberately:
  // a bare extract(hour) buckets in UTC and would state a confident regularity about the person
  // that is an artefact of server geography.
  const partRows = (await sql`
    select s.started_at_local_hour as "startedAtLocalHour", s.outcome
      from session s
     where s.user_id = ${userId}
       and s.outcome in ('yes', 'no')
       and s.started_at_local_hour is not null`) as {
    startedAtLocalHour: number
    outcome: string
  }[]
  const partsOfDay = contrastByPartOfDay(partRows)

  // ADR-0066: at most ONE inference sentence renders. Both contrasts are still computed — the
  // arithmetic is free and the losing one is what the winner is measured against — but only the
  // claim resting on MORE answered sessions is stated, ties going to the domain contrast. The
  // two gaps are not commensurable (seconds against session counts), so evidence is the only
  // comparison that invents nothing. Description below — the headline, the actions block, the
  // record — is unbounded and ungated (ADR-0050); this rule governs claims about the user only.
  //
  // The FIRST entry that clears the floor, in both cases — never the widest gap alone. Both
  // contrasts rank by gap size and a wide gap is often the thinnest evidence, so gating on the
  // top entry let a two-session claim veto an eight-session one: neither sentence rendered, and
  // under ADR-0066 the surviving claim took the slot without competing. The floor belongs here,
  // the ranking belongs in the two modules.
  const domainClaim = contrasts.find((c) => c.sessions >= PATTERN_MIN_SESSIONS) ?? null
  const partClaim = partsOfDay.find((p) => p.sessions >= PATTERN_MIN_SESSIONS) ?? null
  const showPart = partClaim !== null && (domainClaim === null || partClaim.sessions > domainClaim.sessions)
  const showDomain = domainClaim !== null && !showPart

  // Reuses the rows already fetched above — the backlog is a view of the record, not a
  // second question to the database.
  const backlog = answerableBacklog(
    sessions.map((s) => ({
      id: s.id as string,
      outcome: s.outcome as string,
      endedAt: s.ended_at ? new Date(s.ended_at as string).toISOString() : null,
      intention: s.intention as string,
    })),
    new Date(),
  )

  return (
    <div data-surface="ledger">
      <h1 className="m-rate">
        {toWords(counts.answered)} this month. {toWords(counts.finished)} finished.
      </h1>

      {backlog.length > 0 && (
        <div className="m-ledger-actions">
          {/* Description, not inference — no evidence floor (ADR-0050), so one unanswered
              session is enough and it does not wait for eight. No valence (I3): an unanswered
              session is a question still open, never a failure. Three at most — the list below
              already carries every session, and a backlog that fills the screen is the guilt
              ledger docs/design-toolkit.md §9 refuses. Lowercase in BOTH branches (ADR-0066):
              the headline directly above renders `eight this month. five finished.` from the
              same toWords, and the two branches shipped disagreeing with each other. */}
          <p className="m-meta">
            {backlog.length === 1
              ? 'one session is still unanswered.'
              : `${toWords(backlog.length)} sessions are still unanswered.`}
          </p>
          {backlog.slice(0, 3).map((s) => (
            <Link className="m-sentence" key={s.id} href={`/review/${s.id}`}>
              {s.intention || 'No intention given'}
            </Link>
          ))}
        </div>
      )}

      {/* A claim about the USER, so I6's evidence floor applies — ADR-0050 removed the floor
          from description, never from inference. Below the threshold this renders nothing at
          all, and does not hedge a partial pattern (PRD US-11). Minutes spelled as words; no
          rate, no percentage, no score (§3.1). */}
      {showDomain && domainClaim && (
        <p className="m-meta m-ledger-pattern">
          The sessions you finished averaged {toWords(Math.round(domainClaim.finishedAvgSeconds / 60))}{' '}
          minutes on {domainClaim.domain}. The ones you did not averaged{' '}
          {toWords(Math.round(domainClaim.unfinishedAvgSeconds / 60))}.
        </p>
      )}

      {/* The same claim-about-the-user, so the same gate — and the same single slot, which it
          takes only by resting on strictly more answered sessions (ADR-0066). Counted on the
          named part's own answered sessions, never the whole day. Grammar deliberately parallel
          to its sibling above, because at most one of the two ever renders and the surface must
          sound the same either way. Counts as words, no rate, no percentage, no score (§3.1);
          no valence on either answer (I3 / ADR-0051). */}
      {showPart && partClaim && (
        <p className="m-meta m-ledger-pattern">
          Of the sessions you started in the {partClaim.part}, {toWords(partClaim.finished)}{' '}
          finished and {toWords(partClaim.unfinished)} did not.
        </p>
      )}
      <Link className="m-meta" href="/setup">Set up your sites</Link>

      {sessions.map((s) => (
        <div className="m-row" key={s.id}>
          {s.intention ? (
            <Link className="m-sentence" href={`/review/${s.id}`}>
              {s.intention}
            </Link>
          ) : (
            <Link className="m-meta" href={`/review/${s.id}`}>
              No intention given
            </Link>
          )}
          <Band segments={toBand(s.events as Parameters<typeof toBand>[0])} state={s.ended_at ? 'ended' : 'running'} />
          <p className="m-meta" style={{ color: s.outcome === 'unanswered' ? undefined : 'var(--m-ink)' }}>
            {s.outcome === 'yes' ? 'Yes' : s.outcome === 'no' ? 'Not yet' : 'Unanswered'}
          </p>
        </div>
      ))}
    </div>
  )
}
