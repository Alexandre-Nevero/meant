import Link from 'next/link'
import { currentUserId } from '@/lib/auth/session'
import { signOutAction } from './auth-actions'

/** The app shell — where you are, where you can go, and how to leave.
 *
 *  Before this, `app/layout.tsx` was `<body>{children}</body>` and nothing else: six routes
 *  reached each other through ad-hoc links inside page bodies, `/setup` was reachable only
 *  from one link on the dashboard, and **there was no way to sign out of the product at all.**
 *
 *  It deliberately reuses the landing header's composition — the mark and wordmark left,
 *  actions right — rather than inventing a second navigation language for the same product.
 *  Signed out it renders nothing, so `/` and `/sign-in` are untouched and keep their own
 *  header. Every colour is a token, so it inverts correctly under a dark OS.
 *
 *  It stays quiet on purpose. PRD §3.3 makes the review "the product" and the one surface
 *  allowed a moment; a shell that competes with it would be the wrong shell. Hence prose-
 *  scale links rather than buttons, a hairline rule rather than a filled bar, and no counts,
 *  no score and no figures of any kind (§3.1).
 */
export async function Shell() {
  const userId = await currentUserId()
  if (!userId) return null

  return (
    <header className="m-shell">
      <Link className="m-shell-brand" href="/dashboard" aria-label="MEANT — your sessions">
        <span className="m-mark" data-state="ended" aria-hidden="true" />
        <span className="m-shell-wordmark">MEANT</span>
      </Link>

      <nav className="m-shell-nav" aria-label="Main">
        <Link className="m-meta" href="/dashboard">Sessions</Link>
        <Link className="m-meta" href="/setup">Sites</Link>
        <Link className="m-meta" href="/pair">Extension</Link>
        <form action={signOutAction}>
          <button className="m-meta m-shell-signout" type="submit">Sign out</button>
        </form>
      </nav>
    </header>
  )
}
