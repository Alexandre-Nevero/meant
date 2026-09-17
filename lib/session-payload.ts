/** Normalises the untrusted session-start body the extension POSTs.
 *
 *  Exists as its own module for two reasons. It is pure, so `node --test` can import it
 *  directly — `app/api/sessions/route.ts` imports '@/lib/db' and node cannot resolve the
 *  '@/' tsconfig alias. And it is the fix for a three-week silent data loss: the extension
 *  has posted workSites/blockedDomains/cycle since round 6 (`extension/sw.js:155`) and the
 *  route inserted seven columns, dropping all four — leaving `work_sites` non-empty in
 *  0 of 3,668 rows. ADR-0035's three-question design had therefore never produced data.
 */

export type StartPayload = {
  intention: string
  plannedMinutes: number | null
  blocklist: string[]
  blockedDomains: string[]
  workSites: string[]
  cycleWorkMin: number | null
  cycleBreakMin: number | null
  localHour: number | null
}

/** Client-supplied and untrusted, exactly like `body.id`. A non-array becomes an empty
 *  array rather than throwing, and every member is stringified so a nested object cannot
 *  reach the text[] columns. */
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : [])

export function normalizeStartPayload(body: Record<string, unknown>): StartPayload {
  const cycle = body.cycle as { work?: unknown; break?: unknown } | null | undefined
  return {
    intention: typeof body.intention === 'string' ? body.intention : '',
    plannedMinutes: Number.isInteger(body.plannedMinutes) ? (body.plannedMinutes as number) : null,
    blocklist: strArray(body.blocklist),
    blockedDomains: strArray(body.blockedDomains),
    workSites: strArray(body.workSites),
    // `cycle: null` is a real user choice — "no cycles" (popup.js:299) means one continuous
    // block. Null, not 0: a zero would be indistinguishable from a zero-length cycle.
    cycleWorkMin: Number.isInteger(cycle?.work) ? (cycle!.work as number) : null,
    cycleBreakMin: Number.isInteger(cycle?.break) ? (cycle!.break as number) : null,
    // Client-supplied and untrusted, exactly like the fields above. A bad value (out of
    // range, non-integer, wrong type, or missing) becomes null rather than a guess — null
    // means unknown and is excluded from the time-of-day contrast (ADR-0053), whereas
    // guessing would state a false hour. `Number.isInteger(0)` is true and 0 (midnight) is
    // a legal hour, so this cannot be a truthiness check — it must test range explicitly.
    localHour: Number.isInteger(body.localHour) && (body.localHour as number) >= 0 && (body.localHour as number) <= 23
      ? (body.localHour as number)
      : null,
  }
}
