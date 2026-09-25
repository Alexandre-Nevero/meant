import { sql } from '@/lib/db'
import { settingIsOn } from './settings-value.ts'

// ADR-0087. Companion/judge/coach are on/off switches, stored in the existing `memory`
// table as kind='setting', key='companion'|'judge'|'coach', value 'on'|'off'. No migration:
// memory already has `unique (user_id, kind, key)`.

export type FeatureKey = 'companion' | 'judge' | 'coach'
export const FEATURE_KEYS: FeatureKey[] = ['companion', 'judge', 'coach']
export type FeatureSettings = Record<FeatureKey, boolean>

export async function getFeatureSettings(userId: string): Promise<FeatureSettings> {
  const rows = (await sql`
    select key, value from memory
     where user_id = ${userId} and kind = 'setting' and key = any(${FEATURE_KEYS})`) as
    { key: string; value: unknown }[]
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    companion: settingIsOn(byKey.companion),
    judge: settingIsOn(byKey.judge),
    coach: settingIsOn(byKey.coach),
  }
}

export async function setFeatureSetting(userId: string, key: FeatureKey, on: boolean) {
  await sql`
    insert into memory (user_id, kind, key, value)
    values (${userId}, 'setting', ${key}, ${JSON.stringify(on ? 'on' : 'off')}::jsonb)
    on conflict (user_id, kind, key) do update set value = excluded.value, updated_at = now()`
}

/** ISO string, or null if the user has never asked to forget anything (POST /api/me/forget
 *  is the only writer). */
export async function getForgetAt(userId: string): Promise<string | null> {
  const [row] = (await sql`
    select value from memory where user_id = ${userId} and kind = 'setting' and key = 'forget_at'`) as
    { value: unknown }[]
  return typeof row?.value === 'string' ? row.value : null
}
