import { auth } from './server'

/** getSession() can try to refresh or clear a stale session cookie as a side effect,
 * which Next.js only allows from a Server Action or Route Handler — calling it from a
 * plain Server Component throws instead of just reporting no session. A stale cookie
 * from a revoked or expired login must degrade to signed-out, not crash the page
 * (same principle as the device token's own E8 handling). */
export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await auth.getSession()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}
