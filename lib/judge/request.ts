/** The one judge request, shared by the production route and the eval (ADR-0085), so the
 *  eval measures exactly what users get: same prompt, same schema, same model, same
 *  temperature, same parse. Pure: no fetch, no key, no `@/` import. */
import type { Case } from './corpus.ts'
import { LABELS, buildMessages, schemaFor } from './prompt.ts'

// ADR-0080. Matches the judge spike's measured (synthetic) winner.
export const JUDGE_MODEL = 'openai/gpt-oss-120b'

export function judgeRequestBody(c: Case) {
  return {
    model: JUDGE_MODEL,
    temperature: 0.1,
    messages: buildMessages(c),
    response_format: { type: 'json_schema', json_schema: schemaFor() },
  }
}

export type RawVerdict = { host: string; label: string; confidence: number }

/** The model's content string, parsed. Null when unparseable; entries outside the
 *  vocabulary are dropped, exactly as the route always did. */
export function parseVerdicts(content: unknown): RawVerdict[] | null {
  let parsed
  try {
    parsed = JSON.parse(String(content))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const out: RawVerdict[] = []
  for (const v of parsed.visits ?? []) {
    if (!(LABELS as readonly string[]).includes(v?.label)) continue
    out.push({ host: v.host, label: v.label, confidence: v.confidence })
  }
  return out
}
