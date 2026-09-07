import { deviceFromRequest } from '@/lib/device-auth'
import { currentUserId } from '@/lib/auth/session'
import { getReviewData } from '@/lib/review-data'

// See app/api/lists/route.ts for why this is force-dynamic and why the device token
// is tried before the Clerk session cookie.
export const dynamic = 'force-dynamic'

async function resolveUserId(req: Request): Promise<string | null> {
  const device = await deviceFromRequest(req)
  if (device) return device.user_id
  return currentUserId()
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req)
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await getReviewData(id, userId)
  if (!data) return Response.json({ error: 'not found' }, { status: 404 })

  return Response.json(data)
}
