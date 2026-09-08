'use client'

import { useEffect, useState } from 'react'

const PHRASES = [
  'finish the supplier report',
  'reply to the vendor thread',
  'read the Q3 brief properly',
] as const

const TYPE_MS = 45
const DELETE_MS = 30
const HOLD_MS = 1800
const PAUSE_MS = 400

/** The hero's one interactive-feeling moment (landing is Persuade, seen once —
 * animations.dev framework: occasional/marketing surfaces can hold a longer,
 * looping animation, unlike the popup's zero-animation rule for something opened
 * dozens of times a day). Types the product's own first step ("Say it.") using
 * copy already shown in the ledger preview below — no new claims invented.
 * A plain setTimeout loop, not a library: a beginner rebuilding this needs
 * three numbers and a string index, not a scroll or physics engine. */
export function IntentionTyper() {
  const [text, setText] = useState<string>(PHRASES[0])
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setAnimate(true)

    let phrase = 0
    let timer: ReturnType<typeof setTimeout>

    const deleteStep = (pos: number) => {
      if (pos > 0) {
        setText(PHRASES[phrase].slice(0, pos - 1))
        timer = setTimeout(() => deleteStep(pos - 1), DELETE_MS)
      } else {
        phrase = (phrase + 1) % PHRASES.length
        timer = setTimeout(() => typeStep(0), PAUSE_MS)
      }
    }
    const typeStep = (pos: number) => {
      const full = PHRASES[phrase]
      if (pos <= full.length) {
        setText(full.slice(0, pos))
        timer = setTimeout(() => typeStep(pos + 1), TYPE_MS)
      } else {
        timer = setTimeout(() => deleteStep(full.length), HOLD_MS)
      }
    }

    timer = setTimeout(() => deleteStep(PHRASES[0].length), HOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="m-landing-typer" aria-hidden="true">
      <p>
        {text}
        {animate && <span className="m-landing-typer-cursor" />}
      </p>
    </div>
  )
}
