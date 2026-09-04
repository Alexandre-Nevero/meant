/** Normalize user-typed site input to a bare, lowercase hostname.
 * This is the seam where user input meets hostname matching (the review's per-domain
 * lookup, the extension's future blocklist match) — a mismatch here silently breaks
 * resolution with no error, so it strips scheme, `www.`, path, and port, then rejects
 * anything left without a dot (a bare word can never be a real hostname to match against).
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // A bare `host:port` or `host/path` isn't a valid URL on its own — give it a scheme
  // so URL can parse host/port/path uniformly instead of hand-rolling that split.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  let hostname: string
  try {
    hostname = new URL(withScheme).hostname.toLowerCase()
  } catch {
    return null
  }

  const bare = hostname.startsWith('www.') ? hostname.slice(4) : hostname
  return bare.includes('.') ? bare : null
}
