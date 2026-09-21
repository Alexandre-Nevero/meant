/** Splits by SESSION, deterministically.
 *
 *  ADR-0071: visits inside one session share an intention and are not independent, so a
 *  visit-level split leaks the answer across the boundary and inflates the held-out number.
 *
 *  Deterministic because a re-run that reshuffles lets a prompt be tuned against a moving
 *  test set, which is the most comfortable way to get a wrong answer. The hash is a plain
 *  FNV-1a over the session id — no seeding, no dependency, same result forever.
 */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function splitBySession<T extends { sessionId: string }>(
  rows: T[],
  devShare: number,
): { dev: T[]; test: T[] } {
  const ids = [...new Set(rows.map((r) => r.sessionId))].sort((a, b) => hash(a) - hash(b))
  const devIds = new Set(ids.slice(0, Math.round(ids.length * devShare)))
  return {
    dev: rows.filter((r) => devIds.has(r.sessionId)),
    test: rows.filter((r) => !devIds.has(r.sessionId)),
  }
}
