// ADR-0058 + ADR-0062 — the companion's one-tap label.
//
// ADR-0057 removed the live drift signal because there was no way to report a false
// positive, and because a false positive costs three withdrawals from the very attention
// the product exists to protect: noticing the ring changed, judging it wrong, acting to
// dismiss it — all three happening BECAUSE the product was wrong.
//
// The replacement inverts the direction. The companion stops telling the user things and
// becomes how the user tells it things. **A self-report cannot be a false positive.**
//
// One tap, one meaning: "this isn't the work." Not two, because with no live flag there is
// nothing for "this IS the work" to correct — nothing claimed otherwise — and the user
// already declared their work sites at session start (ADR-0035).

/** How close two taps on the same domain must be to count as one act. Covers a double-tap
 *  and a click that slips twice through the overlay's drag guard. One deliberate act should
 *  be one piece of evidence, or MEMORY_MIN_EVIDENCE's 3-observation threshold is meaningless. */
const DUPLICATE_TAP_MS = 2_000

/** Records the tap against the CURRENT VISIT, never against the domain forever.
 *
 *  ADR-0062: pencil, not stone. Tapping "this isn't the work" on instagram.com at 4pm must
 *  not teach the product that Instagram is always drift — PRD §1.2's defining case is exactly
 *  a domain that means opposite things at different hours. Memory forms only when the same
 *  label recurs past MEMORY_MIN_EVIDENCE (3) and MEMORY_MIN_AGREEMENT (80%).
 *
 *  ADR-0037 says an explicit tap memorises at n=1 — but that rule was written for a
 *  CORRECTION of a wrong flag, and there is no flag any more. This narrows it; it does not
 *  contradict it. */
export function labelCurrentVisit(session, domain, at) {
  if (!domain) return session
  const labels = session.labels ?? []
  const last = labels[labels.length - 1]
  if (last && last.domain === domain && at - last.at < DUPLICATE_TAP_MS) return session
  return { ...session, labels: [...labels, { domain, label: 'distract', at }] }
}

/** Shapes stored labels for POST /api/events.
 *
 *  `event.label` already exists with work|distract|neutral|unknown (ADR-0044), and `neutral`
 *  is a first-class value rather than a fallback (ADR-0047) — so this needs no migration.
 *  `seconds: 0` because a label is a point in time, not a duration; the attention rows
 *  already carry the time spent on that domain. */
export function labelsToEvents(labels) {
  if (!Array.isArray(labels)) return []
  return labels.map((l) => ({ kind: 'label', domain: l.domain, label: l.label, seconds: 0, at: l.at }))
}
