// ADR-0083. Pure — no chrome.*, no Date.now(). The popup (and Plan C's "+ task") call these;
// the server never does, it only classifies into the same preset ids.
import { PRESETS } from '../blocklists.js'

export function words(text) {
  return String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** The label a person would type for a site: "instagram" for instagram.com, "ycombinator" for
 *  news.ycombinator.com, "bbc" for bbc.co.uk (a 2–3 letter second-level label like `co` is
 *  skipped). Under 3 letters it is too ambiguous to match a word ("x"), so null. */
export function siteName(domain) {
  const labels = String(domain).toLowerCase().split('.')
  if (labels.length < 2) return null
  const secondLast = labels[labels.length - 2]
  const name = labels.length > 2 && secondLast.length <= 3 ? labels[labels.length - 3] : secondLast
  return name.length >= 3 ? name : null
}

/** The first preset, in file order, with one of its keywords among the intention's words. */
export function matchPreset(intention, presets = PRESETS) {
  const found = new Set(words(intention))
  for (const [id, preset] of Object.entries(presets)) {
    if (preset.keywords.some((k) => found.has(k))) return id
  }
  return null
}

/** (standing ∪ preset.block) − preset.allow − workSites − any site the intention names. */
export function presetBlockSet({ standing, preset, workSites = [], intention = '' }) {
  const spared = new Set([...preset.allow, ...workSites])
  const named = new Set(words(intention))
  return [...new Set([...standing, ...preset.block])]
    .filter((domain) => !spared.has(domain) && !named.has(siteName(domain)))
}
