'use client'

import { useRef, type ReactNode } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Each row's band draws itself in as it scrolls into view — its segments scale from
 * their own left edge, in the order they're already drawn in (time-ordered), the way
 * the number they represent actually accumulated. Not a generic fade-and-rise: the
 * band growing IS the content here (it's a chart, per the toolkit), so revealing it
 * by growing is the specific idea, not decoration (impeccable animate.md — "a generic
 * fade-and-rise... is not a thesis"). The row itself gets only a brief, subordinate
 * settle (`--m-dur-rise`, the product's own token) so its text doesn't just sit inert
 * while its own numbers animate beside it. */
export function LedgerReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!root.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const rows = root.current.querySelectorAll<HTMLElement>('.m-row')
      rows.forEach((row, i) => {
        const bars = row.querySelectorAll<HTMLElement>('.m-row-bar')
        const tl = gsap.timeline({
          delay: i * 0.05, // design-toolkit.md §6's documented row stagger
          scrollTrigger: { trigger: row, start: 'top 88%', toggleActions: 'play none none reverse' },
        })
        tl.from(row, { opacity: 0, y: 6, duration: 0.28, ease: 'expo.out' })
        if (bars.length) tl.from(bars, { scaleX: 0, duration: 0.22, ease: 'expo.out', stagger: 0.04 }, '-=0.16')
      })
    },
    { scope: root },
  )

  return (
    <div className="m-landing-ledger-rows" ref={root}>
      {children}
    </div>
  )
}
