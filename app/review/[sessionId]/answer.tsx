'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Answer({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function answer(outcome: 'yes' | 'no') {
    setSending(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/outcome`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome }),
      })
      // #47. This was unchecked, so a failure left both buttons disabled forever with no
      // message: the user answered, nothing was recorded, and the interface showed neither.
      if (!res.ok) throw new Error(String(res.status))
      router.refresh()
    } catch {
      setSending(false)
      setFailed(true)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 14 }}>
        <button className="m-answer" data-answer="yes" disabled={sending} onClick={() => answer('yes')}>
          Yes
        </button>
        <button className="m-answer" data-answer="not-yet" disabled={sending} onClick={() => answer('no')}>
          Not yet
        </button>
      </div>
      {/* The retry is the same two buttons — a third control here would break the symmetry
          I1 protects. The message never names which answer was pressed, for the same reason. */}
      {failed && <p className="m-meta" role="alert">That didn&rsquo;t save. Answer again.</p>}
    </>
  )
}
