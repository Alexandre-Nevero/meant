import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'

export default async function Dashboard() {
  const { userId } = await auth()
  if (!userId) redirect('/')

  const sessions = await sql`select 1 from session where user_id = ${userId} limit 1`

  if (sessions.length === 0) {
    return (
      <div className="m-empty">
        <p className="m-mark" data-state="empty" />
        <p className="m-meta">Nothing here yet. Finish something and it will be.</p>
      </div>
    )
  }

  // TASK-009 fills in the non-empty ledger view.
  return null
}
