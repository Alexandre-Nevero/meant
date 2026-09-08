import { normalizeDomain } from './normalize-domain.js'
import { SITE_ALIASES } from './site-aliases.js'

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// A single, unambiguous close match counts as confident. A tie between two equally-close
// keys, or nothing close enough, does not — never guess between two plausible corrections.
function confidentSuggestion(token) {
  const threshold = token.length <= 4 ? 1 : 2
  let best = null
  let bestDistance = Infinity
  let tie = false
  for (const key of Object.keys(SITE_ALIASES)) {
    const d = levenshtein(token, key)
    if (d < bestDistance) {
      bestDistance = d
      best = key
      tie = false
    } else if (d === bestDistance) {
      tie = true
    }
  }
  if (tie || bestDistance > threshold) return null
  return best
}

function resolveToken(token) {
  const lower = token.trim().toLowerCase()
  if (lower.includes('.')) {
    const domain = normalizeDomain(lower)
    return domain ? { ok: true, domain } : { ok: false, badToken: token }
  }
  if (SITE_ALIASES[lower]) return { ok: true, domain: SITE_ALIASES[lower] }
  const suggestion = confidentSuggestion(lower)
  return { ok: false, badToken: token, suggestion: suggestion ?? undefined }
}

// Atomic: every token must resolve, or nothing is added — a single bad word in a phrase
// must never silently drop the other, valid words, nor silently add the good ones while
// hiding that one word failed.
export function resolveSitePhrase(text) {
  const tokens = text
    .split(/,| and /i)
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return { ok: false, badToken: '', badIndex: -1 }

  const domains = []
  for (let i = 0; i < tokens.length; i++) {
    const result = resolveToken(tokens[i])
    if (!result.ok) return { ok: false, badToken: result.badToken, badIndex: i, suggestion: result.suggestion }
    if (!domains.includes(result.domain)) domains.push(result.domain)
  }
  return { ok: true, domains }
}
