'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Band } from './band'
import type { Segment } from '@/lib/band'

gsap.registerPlugin(ScrollTrigger)

type Beat = {
  title: string
  body: string
  sentence: string
  muted?: boolean
  segments: readonly Segment[]
}

/** The four beats, evolving across the loop (canvas: Landing.dc.html §beats) — pinned
 * and scrubbed horizontally, desktop and motion-allowed only. gsap.matchMedia() owns
 * the split, matching the CSS breakpoint below: a narrow viewport (≤900px) or
 * `prefers-reduced-motion` gets the plain stacked column with no pin and no transform
 * — the full readable state, not a degraded one (ui-ux-pro-max: scroll-jacking is
 * High-severity motion-sickness risk without this fallback). */
export function BeatsScroll({ beats }: { beats: readonly Beat[] }) {
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
        if (!track.current || !section.current) return

        // Read live, not once: a plain const captured at setup time goes stale the
        // moment web fonts swap and reflow the track (Fraunces vs. its fallback is a
        // real width difference) — `end` re-runs this on refresh, a captured number
        // would not. The visible window is the section's content box, not its border
        // box — subtract its own padding or the last ~96px of scroll reveals nothing.
        const distance = () => {
          if (!track.current || !section.current) return 0
          const style = getComputedStyle(section.current)
          const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
          const visibleWidth = section.current.clientWidth - paddingX
          return Math.max(0, track.current.scrollWidth - visibleWidth)
        }

        const trigger = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          pin: true,
          // The landing page's own root is `display:flex; flex-direction:column`
          // (.m-landing-* layout) — ScrollTrigger auto-disables pinSpacing when the
          // pinned element's parent is a flex container (its own source, checked:
          // node_modules/gsap/dist/ScrollTrigger.js ~line 1825), which silently
          // leaves the pin with nothing to scroll through. Force it back on.
          pinSpacing: true,
          scrub: 1,
          end: () => `+=${distance()}`,
          animation: gsap.to(track.current, { x: () => -distance(), ease: 'none' }),
        })

        // Fraunces finishes loading after this effect's first measurement; refresh
        // once it settles so the pin's scroll distance matches the final layout.
        document.fonts?.ready.then(() => trigger.refresh())
      })
    },
    { scope: section },
  )

  return (
    <section className="m-landing-beats" ref={section}>
      <h2 className="m-landing-h2">Four steps and one sentence.</h2>
      <div className="m-landing-beats-grid" ref={track}>
        {beats.map((beat) => (
          <div key={beat.title}>
            <div className="m-landing-beat-chip" data-muted={beat.muted ? 'true' : undefined}>
              {beat.sentence && <p>{beat.sentence}</p>}
            </div>
            <Band segments={[...beat.segments]} />
            <p className="m-landing-beat-title">{beat.title}</p>
            <p className="m-meta">{beat.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
