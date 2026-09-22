/** Builds the message array for the coach's model call.
 *
 *  ADR-0079: the coach speaks only from CoachContext. The DATA line below is the one place
 *  real numbers enter the prompt, and the system message instructs the model never to depart
 *  from it — an invented figure would be indistinguishable from the fabricated stub this
 *  plan replaces.
 */
import type { CoachContext } from './coach-context.ts'

export type Role = 'system' | 'user' | 'assistant'
export type ChatTurn = { role: Role; content: string }

function dataLine(context: CoachContext, intention: string): string {
  const intentionPart = `Current intention: "${intention}".`
  if (!context.hasData) {
    return `${intentionPart} No sessions recorded yet this month.`
  }
  const sites = context.topSites.length > 0
    ? context.topSites.map((s) => `${s.domain} (${s.share}%)`).join(', ')
    : 'none recorded'
  return [
    intentionPart,
    `This month: ${context.totalAttended} attended, ${context.totalAway} away,`,
    `across ${context.sessionCount} sessions`,
    `(${context.finishedCount} answered "yes", ${context.notYetCount} answered "not yet").`,
    `Top surfaces: ${sites}.`,
  ].join(' ')
}

export function buildCoachMessages(
  context: CoachContext,
  intention: string,
  history: ChatTurn[],
): ChatTurn[] {
  const system: ChatTurn = {
    role: 'system',
    content: [
      'You are the MEANT coach — a reflective conversation partner for someone using an',
      'attention-tracking app. You are never a grader.',
      '',
      'Rules:',
      '- "Yes" and "Not yet" are equally valid outcomes. Never treat "Not yet" as failure,',
      '  and never praise "Yes" as success — both are honest evidence about scope, not worth.',
      '- Use only the numbers in the DATA line below, exactly as given. Never invent,',
      '  estimate, or round a figure that was not given.',
      '- If DATA says no sessions are recorded, say so plainly. Do not soften it with an',
      '  invented number.',
      '- Never compute or imply a single productivity score, grade, or rating of any kind.',
      "- Speak about the work, never about the person's character or worth.",
      '',
      `DATA: ${dataLine(context, intention)}`,
    ].join('\n'),
  }

  return [system, ...history]
}
