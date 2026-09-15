// 'remainder' is never produced by toBand() below (real attention data has no unmeasured
// gap to reserve) — it exists for static previews (landing) that need to show "nothing
// recorded yet" as the dashed edge .m-row-bar already renders for that kind.
export type Segment = { kind: 'attention-1' | 'attention-2' | 'attention-3' | 'away' | 'remainder'; flex: number }

// Chrome extension IDs are exactly 32 characters, entirely within a-p (the charset
// Chrome uses to encode them) — this can end up recorded as a tracked "domain" if an
// older build's protocol filter (extension/sw.js's safeHostname) was ever bypassed, or
// from historical data recorded before that filter existed. A blanket "must contain a
// dot" rule would be wrong here: this codebase has real, legitimate dotless tracked
// domains (localhost) that must not be excluded — this targets the specific
// extension-ID shape instead.
export const EXTENSION_ID_SHAPE = /^[a-p]{32}$/

/** Attention rows for one session → band segments: top 3 domains by time, then away.
 * Takes the raw shape `sql` returns (untyped rows), not a declared row type. */
export function toBand(rows: { kind: string; domain?: string | null; seconds: number }[]): Segment[] {
  const attention = rows
    .filter((r) => r.kind === 'attention' && r.domain && !EXTENSION_ID_SHAPE.test(r.domain))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 3)
  const away = rows.filter((r) => r.kind === 'away').reduce((sum, r) => sum + r.seconds, 0)

  const segments: Segment[] = attention.map((r, i) => ({
    kind: (['attention-1', 'attention-2', 'attention-3'] as const)[i],
    flex: r.seconds,
  }))
  if (away > 0) segments.push({ kind: 'away', flex: away })
  const measured = segments.filter((s) => s.flex > 0)
  // Never return an empty list. A childless .m-mark matches the :empty decorative-glyph rule
  // and the ledger stretches it to the full column with no :not(:empty) guard, so "we
  // recorded nothing" rendered as the fullest band on the page — more confident than a
  // session with real work in it. `remainder` is the dashed empty strip and exists for
  // exactly this case, so this needs no new class, colour or CSS.
  return measured.length > 0 ? measured : [{ kind: 'remainder', flex: 1 }]
}
