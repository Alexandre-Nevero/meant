'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Answer({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)

  async function answer(outcome: 'yes' | 'no') {
    setSending(true)
    await fetch(`/api/sessions/${sessionId}/outcome`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome }),
    })
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <button className="m-answer" data-answer="yes" disabled={sending} onClick={() => answer('yes')}>
        Yes
      </button>
      <button className="m-answer" data-answer="not-yet" disabled={sending} onClick={() => answer('no')}>
        Not yet
      </button>
    </div>
  )
}
