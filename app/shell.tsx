import Link from 'next/link'
import { currentUserId } from '@/lib/auth/session'
import { signOutAction } from './auth-actions'

export interface ShellProps {
  activeSurface?: 'ledger' | 'dashboard' | 'settings' | 'sites'
}

/** The app shell — where you are, where you can go, and how to leave.
 *
 *  Reuses the landing header's composition — the mark and wordmark left,
 *  actions right. Elevated per ADR-0068 with companion pairing status,
 *  dual-surface Ledger/Dashboard navigation, and tactile Emil Kowalski micro-interactions.
 */
export async function Shell({ activeSurface }: ShellProps = {}) {
  const userId = await currentUserId()
  if (!userId) return null

  return (
    <header className="m-shell">
      <div className="m-shell-left">
        <Link className="m-shell-brand" href="/ledger" aria-label="MEANT — your sessions">
          <span className="m-mark" data-state="ended" aria-hidden="true" />
          <span className="m-shell-wordmark">MEANT</span>
        </Link>

        <nav className="m-shell-nav" aria-label="Main">
          <Link
            className={`m-shell-link ${activeSurface === 'ledger' ? 'active' : ''}`}
            href="/ledger"
          >
            Ledger
          </Link>
          <Link
            className={`m-shell-link ${activeSurface === 'dashboard' ? 'active' : ''}`}
            href="/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className={`m-shell-link ${activeSurface === 'settings' ? 'active' : ''}`}
            href="/settings"
          >
            Settings
          </Link>
        </nav>
      </div>

      <div className="m-shell-right">
        <div className="m-companion-badge" title="Companion extension is active">
          <span className="m-status-dot active" aria-hidden="true" />
          <span>Companion paired</span>
        </div>
        <form action={signOutAction}>
          <button className="m-shell-signout" type="submit">Sign out</button>
        </form>
      </div>
    </header>
  )
}
