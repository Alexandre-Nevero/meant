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
          I1 protects. The message never names which answer was pressed, for the same reason.

          Always mounted, never conditional. Two reasons: this paragraph is a child of the
          bottom-anchored .m-review-ask (globals.css, margin-top: auto), so mounting it only on
          failure grew the group and pushed both buttons up ~39px at the exact instant the user
          is told to press one again — and a live region that already exists when its text
          arrives is announced far more reliably than one inserted together with its text.

          role="alert" carries an implicit aria-live="assertive", so it is the whole live region
          on its own. An explicit aria-live alongside it contradicts that implicit value and
          leaves the urgency undefined across screen readers. Every other alert in the product
          is role="alert" and nothing else; this one matches. */}
      <p className="m-meta" role="alert">
        {failed ? 'That didn’t save. Answer again.' : ''}
      </p>
    </>
  )
}
