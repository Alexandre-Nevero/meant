'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Band } from './band'
import type { Segment } from '@/lib/band'

gsap.registerPlugin(ScrollTrigger)

type StepPanel = {
  kind: 'step'
  title: string
  body: string
  sentence: string
  muted?: boolean
  segments: readonly Segment[]
}
type StatementPanel = { kind: 'statement'; title: string; body: string }
export type Panel = StepPanel | StatementPanel

/** The loop, then the two guarantees — one pinned, horizontally scrubbed sequence
 * (canvas: Landing.dc.html §beats, extended). Previously three separate sections: a
 * static 4-card row, then two standalone prose blocks the scroll-jack released into.
 * Persuade mode earns one rehearsed focal sequence over repeated section reveals
 * (impeccable animate.md) — so the two guarantees are panels 5 and 6 of the same
 * track, not their own static stops.
 *
 * Desktop and motion-allowed only: gsap.matchMedia() gates it, matching the CSS
 * breakpoint in globals.css. A narrow viewport or `prefers-reduced-motion` gets the
 * plain stacked column with no pin and no transform — the full readable state, not a
 * degraded one (ui-ux-pro-max: scroll-jacking is High-severity motion-sickness risk
 * without this fallback). */
export function ScrollStory({ panels }: { panels: readonly Panel[] }) {
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
          // A real window resize (not just this effect's own first measurement)
          // must re-run `end` AND re-resolve the tween's own function-based `x` —
          // ScrollTrigger's default resize refresh only does the former.
          invalidateOnRefresh: true,
        })

        // Fraunces finishes loading after this effect's first measurement; refresh
        // once it settles so the pin's scroll distance matches the final layout.
        document.fonts?.ready.then(() => trigger.refresh())
      })
    },
    { scope: section },
  )

  return (
    <section className="m-landing-story" ref={section}>
      <h2 className="m-landing-h2">Four steps and one sentence.</h2>
      <div className="m-landing-story-track" ref={track}>
        {panels.map((panel) =>
          panel.kind === 'step' ? (
            <div className="m-landing-panel" data-kind="step" key={panel.title}>
              <div className="m-landing-beat-chip" data-muted={panel.muted ? 'true' : undefined}>
                {panel.sentence && <p>{panel.sentence}</p>}
              </div>
              <Band segments={[...panel.segments]} />
              <p className="m-landing-panel-title">{panel.title}</p>
              <p className="m-meta">{panel.body}</p>
            </div>
          ) : (
            <div className="m-landing-panel" data-kind="statement" key={panel.title}>
              <div className="m-landing-panel-top">
                <p className="m-mark" data-state="ended" />
              </div>
              <div className="m-landing-panel-spacer" aria-hidden="true" />
              <p className="m-landing-panel-title">{panel.title}</p>
              <p className="m-meta">{panel.body}</p>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
