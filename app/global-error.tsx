'use client'

import './globals.css'

/** #46. The root layout itself failing. next/font's CSS variables are declared on <html> by
 *  app/layout.tsx, which this file replaces — so --m-display/--m-body fall back to the Georgia
 *  and system-ui tails already declared in globals.css:6-8. Correct by construction, not by
 *  accident: this page is a crash screen, and re-invoking three font loaders to dress it would
 *  be the wrong trade. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="m-app">
        <div data-surface="not-found">
          <p className="m-mark" data-state="empty" />
          <p className="m-sentence">Something broke.</p>
          <button className="m-btn" data-variant="quiet" onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
