// SYNTHETIC DATA GENERATOR — not part of the original plan.
//
// Why this exists: the real chrome.storage.local path log only covered 2 sessions
// (PATH_TTL_MS had purged the rest) — far below the plan's own >=15-session floor
// for a measurable sample (Task 2 Step 4). Owner decision 2026-09-21: generate
// synthetic-but-structured sessions instead of waiting on more real usage, and
// have the generator (not a blind human) supply the answer key too. This is a
// deliberate limitation, not an oversight — it must be stated plainly in Task 8's
// findings: the same party who authored the scenarios also graded them, so the
// numbers below cannot be treated as evidence the judge generalizes to real,
// ambiguous human behaviour. It only tells us whether a small model can produce
// the LABEL VOCABULARY at all, and whether it can follow obvious cases — the
// narrower of the two questions this spike was designed to answer.
//
// Runs the real, already-tested `buildCases` from Task 3 on fabricated input, so
// the corpus this produces exercises the exact same pipeline real data would.
import { writeFileSync } from 'node:fs'
import { buildCases } from './corpus.ts'

function uuid(seed) {
  // Deterministic, not crypto-random — reruns produce the same corpus.
  const h = seed.padEnd(32, '0').slice(0, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

// Each intention names its own "focused" surface. supportive/neutral/drift pools
// are shared across intentions — the point is varying DECLARED status, not the
// pool itself.
const INTENTIONS = [
  { key: 'budget', text: 'finish the Q3 budget proposal', focusedHost: 'docs.google.com', focusedPaths: ['/document/d/1a2b3c', '/document/d/1a2b3c/edit'] },
  { key: 'bug', text: 'fix the checkout timeout bug', focusedHost: 'github.com', focusedPaths: ['/acme/checkout/pull/412', '/acme/checkout/pull/412/files'] },
  { key: 'deck', text: 'build the investor update deck', focusedHost: 'docs.google.com', focusedPaths: ['/presentation/d/9f8e7d', '/presentation/d/9f8e7d/edit'] },
  { key: 'client', text: 'reply to the client\'s scope questions', focusedHost: 'mail.google.com', focusedPaths: ['/mail/u/0/#inbox/thread-882'] },
  { key: 'onboarding', text: 'write the onboarding email sequence', focusedHost: 'docs.google.com', focusedPaths: ['/document/d/7c6d5e'] },
  { key: 'invoice', text: 'send this month\'s invoices', focusedHost: 'app.quickbooks.com', focusedPaths: ['/invoices/new', '/invoices/list'] },
  { key: 'refactor', text: 'refactor the auth middleware', focusedHost: 'github.com', focusedPaths: ['/acme/api/pull/501', '/acme/api/pull/501/files'] },
  { key: 'contract', text: 'review the vendor contract redline', focusedHost: 'docs.google.com', focusedPaths: ['/document/d/3e2f1a'] },
]

const SUPPORTIVE_POOL = [
  { host: 'chatgpt.com', paths: ['/c/9182a3'] },
  { host: 'chatgpt.com', paths: ['/c/finance-help'] },
  { host: 'perplexity.ai', paths: ['/search/vendor-terms-explained'] },
  { host: 'stackoverflow.com', paths: ['/questions/71234555/timeout-retry-pattern'] },
  { host: 'notion.so', paths: ['/acme/Style-Guide-882'] },
]

const NEUTRAL_POOL = [
  { host: 'mail.google.com', paths: ['/mail/u/0/#inbox'] },
  { host: 'calendar.google.com', paths: ['/calendar/r'] },
  { host: 'linkedin.com', paths: ['/feed/'] },
  { host: 'slack.com', paths: ['/messages/general'] },
  { host: 'zoom.us', paths: ['/j/9091'] },
]

const DRIFT_POOL = [
  { host: 'reddit.com', paths: ['/r/all'] },
  { host: 'youtube.com', paths: ['/watch?v=dQw4w9WgXcQ'] },
  { host: 'instagram.com', paths: ['/reels/'] },
  { host: 'twitter.com', paths: ['/home'] },
  { host: 'news.ycombinator.com', paths: ['/'] },
]

function pick(pool, i) {
  return pool[i % pool.length]
}

const sessions = []
const events = []
const paths = []
const groundTruth = [] // { sessionId, host, label } — the generator's own authored answer key

let sessionIndex = 0
const HOURS = [9, 11, 14, 16, 20] // spread across morning/midday/afternoon/evening/night

for (const intention of INTENTIONS) {
  for (let variant = 0; variant < 3; variant++) {
    const sid = uuid(`${intention.key}${variant}`)
    const outcome = variant === 2 ? 'no' : 'yes' // 2/3 finished, 1/3 not-yet — realistic mix
    const localHour = HOURS[sessionIndex % HOURS.length]
    const startedAt = new Date(2026, 7, 3 + sessionIndex, localHour, 0, 0).toISOString()

    // Declare roughly half the focused/drift hosts up front, leave the rest
    // residual (undeclared) — the residual is the judge's actual addressable job.
    const declareFocusedAsWork = variant % 2 === 0
    const declareDriftAsBlocked = variant % 2 === 1

    const workSites = declareFocusedAsWork ? [intention.focusedHost] : []
    const drift = pick(DRIFT_POOL, sessionIndex)
    const blockedDomains = declareDriftAsBlocked ? [drift.host] : []

    sessions.push({
      id: sid,
      intention: intention.text,
      outcome,
      started_at: startedAt,
      started_at_local_hour: localHour,
      work_sites: workSites,
      blocked_domains: blockedDomains,
    })

    // Build 3-4 visits per session: focused, supportive, neutral, drift — order
    // matters for the "order" field, so timestamps are strictly increasing.
    let t = 0
    const visits = [
      { label: 'focused', host: intention.focusedHost, paths: intention.focusedPaths, seconds: 900 + (sessionIndex % 5) * 120 },
      { label: 'supportive', host: pick(SUPPORTIVE_POOL, sessionIndex).host, paths: pick(SUPPORTIVE_POOL, sessionIndex).paths, seconds: 300 + (sessionIndex % 4) * 60 },
      { label: 'neutral', host: pick(NEUTRAL_POOL, sessionIndex).host, paths: pick(NEUTRAL_POOL, sessionIndex).paths, seconds: 90 + (sessionIndex % 3) * 30 },
      { label: 'drift', host: drift.host, paths: drift.paths, seconds: 600 + (sessionIndex % 6) * 180 },
    ]
    // Every 3rd session skips one non-focused visit, so not every session has all four.
    const skip = sessionIndex % 3 === 2 ? 1 + (sessionIndex % 3) : -1
    for (let vi = 0; vi < visits.length; vi++) {
      if (vi === skip) continue
      const v = visits[vi]
      const at = new Date(new Date(startedAt).getTime() + t * 60000).toISOString()
      t += 5 + (vi * 3)
      events.push({ session_id: sid, kind: 'attention', domain: v.host, seconds: v.seconds, at })
      for (const p of v.paths) paths.push({ sessionId: sid, host: v.host, path: p, at: Date.parse(at) })
      groundTruth.push({ sessionId: sid, host: v.host, label: v.label })
    }
    // One away + one break per session, exercising the filters Task 3 tests for.
    events.push({ session_id: sid, kind: 'away', domain: null, seconds: 180, at: new Date(new Date(startedAt).getTime() + t * 60000).toISOString() })
    events.push({ session_id: sid, kind: 'break', domain: null, seconds: 300, at: new Date(new Date(startedAt).getTime() + (t + 5) * 60000).toISOString() })

    sessionIndex++
  }
}

const cases = buildCases(sessions, events, paths)
writeFileSync('scripts/spike/fixtures/corpus.json', JSON.stringify(cases, null, 2))

// labels.jsonl in the exact shape Task 4's to-labelling.mjs produces, but with
// `label` already filled from groundTruth — see the file-header limitation note.
const truthByKey = new Map(groundTruth.map((g) => [`${g.sessionId}\u0000${g.host}`, g.label]))
const lines = []
for (const c of cases) {
  for (const v of c.visits) {
    const label = truthByKey.get(`${c.sessionId}\u0000${v.host}`) ?? null
    lines.push(JSON.stringify({
      sessionId: c.sessionId,
      intention: c.intention,
      host: v.host,
      paths: v.paths,
      seconds: v.seconds,
      declared: v.declared,
      label,
    }))
  }
}
writeFileSync('scripts/spike/fixtures/labels.jsonl', lines.join('\n') + '\n')

const byLabel = {}
for (const g of groundTruth) byLabel[g.label] = (byLabel[g.label] ?? 0) + 1
console.log(`${sessions.length} sessions, ${cases.reduce((n, c) => n + c.visits.length, 0)} visits`)
console.log('label counts:', byLabel)
const residual = cases.reduce((n, c) => n + c.visits.filter((v) => v.declared === 'none').length, 0)
const withPaths = cases.reduce((n, c) => n + c.visits.filter((v) => v.paths.length > 0).length, 0)
console.log(`residual (undeclared): ${residual}, with paths: ${withPaths}`)
