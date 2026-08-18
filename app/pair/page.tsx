'use client'

import { useEffect, useState } from 'react'

type Pairing = { code: string; expiresAt: string }

export default function Pair() {
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/pair', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setPairing)
      .catch(() => setFailed(true))
  }, [])

  if (failed) return <p className="m-meta">Sign in first, then reload this page.</p>
  if (!pairing) return <p className="m-meta">Minting a code…</p>

  return (
    <div className="m-app">
      <p className="m-meta">{pairing.code}</p>
      <p className="m-meta">
        Paste this into the extension. It expires at{' '}
        {new Date(pairing.expiresAt).toLocaleTimeString()}.
      </p>
    </div>
  )
}
