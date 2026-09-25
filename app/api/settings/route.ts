import { requestUserId } from '@/lib/device-auth'
import { FEATURE_KEYS, getFeatureSettings, setFeatureSetting } from '@/lib/settings'

// Same reasoning as app/api/lists/route.ts: requestUserId reads the raw Request's own
// headers, which Next's static analysis does not watch the way it watches next/headers()'s
// cookies()/headers() — without this, GET could be served stale for a token just revoked.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  return Response.json(await getFeatureSettings(userId))
}

export async function PUT(req: Request) {
  const userId = await requestUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return Response.json({ error: 'bad request' }, { status: 400 })

  for (const key of FEATURE_KEYS) {
    if (typeof body[key] === 'boolean') await setFeatureSetting(userId, key, body[key])
  }

  return Response.json(await getFeatureSettings(userId))
}
