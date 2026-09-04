'use client'

import { useEffect, useState } from 'react'

type Pairing = { code: string; expiresAt: string }

export default function Pair() {
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [expired, setExpired] = useState(false)
  const [failed, setFailed] = useState(false)

  function mint() {
    setPairing(null)
    setExpired(false)
    fetch('/api/pair', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setPairing)
      .catch(() => setFailed(true))
  }

  useEffect(mint, [])

  // A single scheduled flip at the real expiry moment — not a ticking countdown
  // (toolkit §9 refuses "a countdown that ticks").
  useEffect(() => {
    if (!pairing) return
    const ms = new Date(pairing.expiresAt).getTime() - Date.now()
    if (ms <= 0) {
      setExpired(true)
      return
    }
    const timer = setTimeout(() => setExpired(true), ms)
    return () => clearTimeout(timer)
  }, [pairing])

  if (failed) {
    return (
      <div data-surface="pair">
        <p className="m-meta">
          Sign in first, then <a href="/pair">reload this page</a>.
        </p>
      </div>
    )
  }

  if (!pairing) {
    return (
      <div data-surface="pair">
        <p className="m-meta">Minting a code…</p>
      </div>
    )
  }

  if (expired) {
    return (
      <div data-surface="pair">
        <p className="m-meta">That code expired.</p>
        <button className="m-btn" data-variant="primary" onClick={mint}>
          Get another
        </button>
      </div>
    )
  }

  return (
    <div data-surface="pair">
      <p className="m-meta">Paste this into the extension.</p>
      <p className="m-sentence">{pairing.code}</p>
      <p className="m-meta">
        Expires at {new Date(pairing.expiresAt).toLocaleTimeString()}.
      </p>
      {/* The claim happens in the extension, a separate surface this tab can't observe
          without polling — so "continue" is a step the person takes once they've pasted
          the code, not an auto-redirect on a success this page has no way to detect. */}
      <a className="m-btn" data-variant="quiet" href="/setup">
        Continue to setup
      </a>
    </div>
  )
}
