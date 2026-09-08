// Extension-side duplicate of lib/domains.ts's normalizeDomain — same cross-import wall as
// GRACE_MS/CYCLE_PRESETS in popup.js (the plain-JS extension can't import that TS module).
// Keep this in sync with lib/domains.ts by hand; test/normalize-domain.test.js covers the TS
// original, test/extension-normalize-domain.test.js covers this copy with the same cases.
//
// Normalize user-typed site input to a bare, lowercase hostname. This is the seam where user
// input meets hostname matching — here, specifically, extension/sw.js's declarativeNetRequest
// `requestDomains` (which rejects a scheme/path-polluted entry, and can reject the whole rule
// batch with it) and activeDomain()'s tab-hostname comparison (which a scheme/path-polluted
// entry could never match anyway). Strips scheme, `www.`, path, and port, then rejects anything
// left without a dot (a bare word can never be a real hostname to match against).
export function normalizeDomain(input) {
  const trimmed = input.trim()
  if (!trimmed) return null

  // A bare `host:port` or `host/path` isn't a valid URL on its own — give it a scheme so URL
  // can parse host/port/path uniformly instead of hand-rolling that split.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  let hostname
  try {
    hostname = new URL(withScheme).hostname.toLowerCase()
  } catch {
    return null
  }

  const bare = hostname.startsWith('www.') ? hostname.slice(4) : hostname
  return bare.includes('.') ? bare : null
}
