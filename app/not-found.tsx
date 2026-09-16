import Link from 'next/link'

/** #46. `review/[sessionId]/page.tsx:24` calls notFound() for a session that is not yours or
 *  not there, and Next's stock 404 is black-on-white in system fonts — the user falls out of
 *  the product at the exact moment they are already confused. */
export default function NotFound() {
  return (
    <div data-surface="not-found">
      <p className="m-mark" data-state="empty" />
      <p className="m-sentence">That isn&rsquo;t here.</p>
      <Link className="m-meta" href="/dashboard">Your sessions</Link>
    </div>
  )
}
