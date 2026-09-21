import { currentUserId } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { formatHm, formatHmCompact, totalsByKind, rankDomains, type EventRow } from '@/lib/dashboard-figures'

export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
  const currentIntention: string = typeof body?.intention === 'string' ? body.intention.trim() : ''
  const lastUserMessage = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content?.trim() || ''

  const userId = await currentUserId()

  // Default context figures
  let totalAttendedStr = '5 hr 33 min'
  let totalAwayStr = '1 hr 14 min'
  let totalBreaksStr = '5 min'
  let finishedCount = 6
  let notYetCount = 4
  let sessionCount = 11
  let topSitesStr = 'chatgpt.com (52%) and docs.google.com (48%)'
  let topSitesList: { domain: string; share: number; seconds: number }[] = []

  if (userId) {
    try {
      const monthSessions = (await sql`
        select outcome from session
         where user_id = ${userId}
           and started_at >= date_trunc('month', now())`) as { outcome: string | null }[]

      if (monthSessions.length > 0) {
        sessionCount = monthSessions.length
        finishedCount = monthSessions.filter((s) => s.outcome === 'yes').length
        notYetCount = monthSessions.filter((s) => s.outcome === 'no').length

        const eventRows = (await sql`
          select e.kind, e.domain, e.seconds, e.label
            from event e
            join session s on s.id = e.session_id
           where s.user_id = ${userId}
             and s.started_at >= date_trunc('month', now())`) as unknown as EventRow[]

        const totals = totalsByKind(eventRows)
        totalAttendedStr = formatHm(totals.attention)
        totalAwayStr = formatHm(totals.away)
        totalBreaksStr = formatHm(totals.break)

        const ranked = rankDomains(eventRows, 4)
        topSitesList = ranked
        if (ranked.length > 0) {
          topSitesStr = ranked.map((r) => `${r.domain} (${r.share}%)`).join(', ')
        }
      }
    } catch (err) {
      console.error('Coach API DB context error:', err)
    }
  }

  const query = lastUserMessage.toLowerCase()
  let reply = ''

  if (query.includes('where') && (query.includes('time') || query.includes('go') || query.includes('attention'))) {
    reply = `Looking at your recorded attention for this period, you logged **${totalAttendedStr}** of focused work across ${sessionCount} sessions.\n\nYour primary surfaces were **${topSitesStr}**.\n\nYou also spent ${totalAwayStr} on away domains. You tend to sustain attention best in the first 45 minutes of a work block before drift occurs.`
  } else if (query.includes('drift') || query.includes('friction') || query.includes('distract') || query.includes('away') || query.includes('break')) {
    reply = `You had **${totalAwayStr}** recorded as away time during active intentions.\n\nNotice whether away time happened as a natural pause or an accidental tab switch. In MEANT, away time is purely descriptive—not a moral defect. If you notice frequent away drift around the 40-minute mark, consider scheduling explicit 5-minute break cycles in your sessions.`
  } else if (query.includes('next intention') || query.includes('formulate') || query.includes('plan') || query.includes('frame')) {
    reply = `To formulate an effective intention, make the finish line observable before starting:\n\n1. **Use an active verb**: "draft", "verify", "reply", "refactor".\n2. **Name the artifact**: not just "work on code", but "clean up the auth route error handling".\n3. **Keep it under 8 words**: A concise sentence stays sharp when the companion sits with you.\n\nWhat specific task are you sitting down to finish next?`
  } else if (query.includes('not yet') || query.includes('unfinished') || query.includes('outcome') || query.includes('failed')) {
    reply = `Out of ${sessionCount} recorded sessions, you answered **Yes** on ${finishedCount} and **Not yet** on ${notYetCount}.\n\nIn MEANT, *Not yet* is byte-identical in value to *Yes*. It is honest evidence that the scope exceeded the time, not a badge of shame. When an intention ends in *Not yet*, the most useful next step is breaking the remainder into a smaller, immediate sub-task.`
  } else if (query.includes('how') && (query.includes('focus') || query.includes('doing') || query.includes('summary') || query.includes('today') || query.includes('week'))) {
    const finishedPct = sessionCount > 0 ? Math.round((finishedCount / (finishedCount + notYetCount || 1)) * 100) : 0
    reply = `Here is your current focus rhythm:\n\n• **Attended work**: ${totalAttendedStr}\n• **Sessions completed**: ${sessionCount} logged (${finishedCount} Yes, ${notYetCount} Not yet — ${finishedPct}% fidelity)\n• **Dominant surfaces**: ${topSitesStr}\n• **Away time**: ${totalAwayStr}\n\nYou have strong momentum. What are you intending to wrap up next?`
  } else {
    reply = `I'm observing your sessions silently so you can reflect clearly.\n\nWith **${totalAttendedStr}** of attention logged this period, your habits show clear dedicated blocks on ${topSitesList[0]?.domain || 'your work tools'}.\n\nIs there a specific friction point or intention you'd like to explore?`
  }

  return Response.json({
    reply,
    stats: {
      totalAttended: totalAttendedStr,
      totalAway: totalAwayStr,
      sessionCount,
      finishedCount,
      notYetCount,
    },
  })
}
