/** The actions block. The one idea from Rize's 2022 Home view that transfers intact — "a summary
 *  of your day and a list of any actions you need to take" — with an action that is real here.
 *
 *  An unanswered session is a hole in `session.outcome`, the column the ledger headline, both
 *  contrasts, and every later inference are computed from. A user with twenty unanswered sessions
 *  has a ledger that cannot say anything about them.
 *
 *  This is DESCRIPTION, not inference: it shows the user their own rows, so I6 imposes no floor
 *  (ADR-0050). It carries no valence (I3, ADR-0051) — an unanswered session is a question still
 *  open, never a failure — and it must never say why a session went unanswered, which would be an
 *  inference about the person and is gated. */

/** Past this, the honest answer is that nobody remembers. A backlog that only grows is a guilt
 *  ledger, and docs/design-toolkit.md §9 refuses that shape of thing. */
export const ANSWERABLE_WINDOW_DAYS = 14

export type BacklogRow = {
  id: string
  outcome: string
  /** null while the session is still running. */
  endedAt: string | null
  intention: string
}

export function answerableBacklog(rows: BacklogRow[], now: Date): BacklogRow[] {
  const floor = now.getTime() - ANSWERABLE_WINDOW_DAYS * 86_400_000
  return rows
    // A running session cannot be answered — "did you finish it" is incoherent mid-session.
    .filter((r) => r.outcome === 'unanswered' && r.endedAt !== null)
    .filter((r) => new Date(r.endedAt!).getTime() >= floor)
    // Oldest first: the one most likely to be forgotten is the one worth asking about.
    .sort((a, b) => new Date(a.endedAt!).getTime() - new Date(b.endedAt!).getTime())
}
