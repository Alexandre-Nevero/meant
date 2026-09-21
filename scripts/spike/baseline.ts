/** What the product already knows with NO model.
 *
 *  ADR-0035 asks for work sites and distraction sites at session start, and ADR-0061 is
 *  blunt that this resolves PRD §1.2's Instagram case at declaration time, with no model:
 *  "The judge's real job is smaller" — the residual and in-site ambiguity.
 *
 *  So this is the bar. ADR-0060: if the model cannot beat free arithmetic, it does not ship.
 */
import type { Prediction } from './score.ts'

export function baselinePredictions(
  lines: { sessionId: string; host: string; declared: string }[],
): Prediction[] {
  return lines.map((l) => ({
    sessionId: l.sessionId,
    host: l.host,
    // An undeclared host gets `neutral` rather than a guess. Guessing drift on the residual
    // is precisely the false positive ADR-0057 deleted the live signal over.
    label: l.declared === 'work' ? 'focused' : l.declared === 'distraction' ? 'drift' : 'neutral',
    confidence: 1,
  }))
}
