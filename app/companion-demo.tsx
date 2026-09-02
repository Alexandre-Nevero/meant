'use client'

import { useEffect, useState } from 'react'

const SETTLED_MS = 6000
const DRIFTING_MS = 3000

/** The hero's one focal moment (impeccable animate.md) — not a mockup of the
 * companion, the real gaze primitive (extension/meant.css), driven by a demo timer
 * instead of real session events. Cycles settled → drifting → settled so a first-time
 * visitor sees the actual mechanic the product is built on, not a still screenshot of
 * it. Never varies in colour (I1) — only posture, exactly like the real thing. */
export function CompanionDemo() {
  const [state, setState] = useState<'settled' | 'drifting'>('settled')

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let timer: ReturnType<typeof setTimeout>
    const cycle = (next: 'settled' | 'drifting') => {
      setState(next)
      timer = setTimeout(() => cycle(next === 'settled' ? 'drifting' : 'settled'), next === 'settled' ? SETTLED_MS : DRIFTING_MS)
    }
    timer = setTimeout(() => cycle('drifting'), SETTLED_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="m-companion-capsule" data-state={state} aria-hidden="true">
      <div className="m-companion-gaze">
        <div className="m-companion-aperture" />
      </div>
    </div>
  )
}
