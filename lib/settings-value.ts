// ADR-0087. companion/judge/coach are stored as `memory` rows: kind='setting',
// key='companion'|'judge'|'coach', value 'on'|'off'. A row that was never written means
// on — a user who never opens Settings keeps every feature, and only an explicit 'off'
// turns one off. No `@/` import here so `node --test` can load it directly.

/** `value` is a memory row's jsonb `value` column, read back as a plain JS value by the
 *  driver — for a setting row that is always the bare string 'on' or 'off', or `undefined`
 *  when no row exists yet. Anything other than the literal 'off' is on, on purpose: a
 *  future/unexpected stored value must never silently gate a feature closed. */
export function settingIsOn(value: unknown): boolean {
  return value !== 'off'
}
