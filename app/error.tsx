'use client'

/** #46. Before this, a DB failure on the dashboard (app/dashboard/page.tsx:17, an unguarded
 *  `sql` call) threw straight through to Next's stock error page. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main data-surface="not-found">
      <p className="m-mark" data-state="empty" />
      <p className="m-sentence">This page didn&rsquo;t load.</p>
      <p className="m-meta" role="alert">Nothing you have recorded was changed.</p>
      <button className="m-btn" data-variant="quiet" onClick={reset}>Try again</button>
    </main>
  )
}
