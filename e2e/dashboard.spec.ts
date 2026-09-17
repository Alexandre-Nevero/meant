import { test, expect } from './fixtures'

test('the dashboard ledger has the approved max-width, not full viewport width', async ({ context, freshAccount }) => {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1600, height: 900 })
  await freshAccount(page)
  await page.goto('/dashboard')

  const ledger = page.locator('[data-surface="ledger"]')
  const box = await ledger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeLessThanOrEqual(1000)
})

/** Answered sessions that all started in the same part of the day, so the contrast has exactly
 *  one winner and its `sessions` count is the length of this array — which is what the I6 gate
 *  reads. Anything vaguer would leave the floor tests below unable to fail. */
const answeredAt = (hour: number, outcomes: ('yes' | 'no')[]) =>
  outcomes.map((outcome) => ({ outcome, startedAtLocalHour: hour }))

// The actions block. Description, not inference — no evidence floor applies (ADR-0050), so it
// must appear for a single unanswered session, not wait for eight.
test('one unanswered session is enough to raise an action, and it links to the review', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'unanswered on purpose' })
  const page = await context.newPage()
  await page.goto('/dashboard')

  const actions = page.locator('.m-ledger-actions')
  await expect(actions).toBeVisible()
  await expect(actions.getByRole('link', { name: /unanswered on purpose/ })).toHaveAttribute(
    'href', `/review/${sessionId}`,
  )
})

// The cap is a design decision (docs/design-toolkit.md §9 — a backlog that fills the screen is a
// guilt ledger) and nothing else in the suite would notice it going away, because the record
// below carries every session either way. Asserts what is rendered, not that the block exists.
test('the actions block counts the whole backlog but lists at most three of it', async ({ seededUser }) => {
  const page = await seededUser([
    { outcome: 'unanswered', intention: 'oldest open question' },
    { outcome: 'unanswered', intention: 'second open question' },
    { outcome: 'unanswered', intention: 'third open question' },
    { outcome: 'unanswered', intention: 'newest open question' },
  ])
  await page.goto('/dashboard')

  const actions = page.locator('.m-ledger-actions')
  await expect(actions.locator('.m-meta')).toHaveText('four sessions are still unanswered.')
  await expect(actions.locator('.m-sentence')).toHaveCount(3)
  // Oldest first, so the newest is the one that falls off the end.
  await expect(actions.getByText('newest open question')).toHaveCount(0)

  // Geometry, not existence. Without these the whole .m-ledger-actions CSS block can be deleted
  // and every test in this file stays green, while the links silently collapse to the body
  // default — the 34x16 attention band of the previous branch, in a new place.
  await expect(actions).toHaveCSS('row-gap', '10px')
  await expect(actions.locator('.m-sentence').first()).toHaveCSS('font-size', '20px')

  // Below 700px the actions block must step down WITH the record, never above it: these three
  // sentences are repeated verbatim as the first rows of the list below, and a shortcut
  // rendering larger than the record it points at is a hierarchy error.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(actions.locator('.m-sentence').first()).toHaveCSS('font-size', '18px')
  await expect(page.locator('[data-surface="ledger"] .m-row .m-sentence').first()).toHaveCSS(
    'font-size', '18px',
  )
})

// PRD US-11: below the threshold, render NOTHING. Not a hedge, not a partial pattern. Seven
// answered sessions — one short of PATTERN_MIN_SESSIONS, both arms present, one clear winning
// part of day — so the only thing keeping the sentence off this page is the gate itself.
test('no pattern sentence appears one session below the evidence floor', async ({ seededUser }) => {
  const page = await seededUser(answeredAt(9, ['yes', 'yes', 'yes', 'yes', 'no', 'no', 'no']))
  await page.goto('/dashboard')

  await expect(page.locator('.m-ledger-pattern')).toHaveCount(0)
  // And the surface is not empty — the record is always free and always shown (ADR-0060).
  await expect(page.locator('[data-surface="ledger"] .m-row')).not.toHaveCount(0)
})

// The falsifier for the test above: without it, toHaveCount(0) passes on a class nothing ever
// renders — the landing.spec.ts defect of the previous branch. Asserts the sentence the seeded
// rows actually imply, so a gate that opens on the wrong arithmetic fails here, loudly, rather
// than passing on the presence of a <p>.
test('at the evidence floor the pattern sentence appears and says what the rows say', async ({ seededUser }) => {
  const page = await seededUser([
    ...answeredAt(9, ['yes', 'yes', 'yes', 'yes', 'yes', 'no', 'no', 'no']),
    // An answered session whose local hour is unknown (ADR-0053): it must stay out of the named
    // part's arithmetic entirely rather than be bucketed or assumed — so the sentence below is
    // still five and three, not five and four.
    { outcome: 'no' as const, startedAtLocalHour: null },
  ])
  await page.goto('/dashboard')

  await expect(page.locator('.m-ledger-pattern')).toHaveText(
    'Of the sessions you started in the morning, five finished and three did not.',
  )
})

// §3.1 bans these outright, and this is the surface most likely to grow one by accident.
test('the ledger shows no percentage, no score and no hours headline', async ({ context, endedSession }) => {
  await endedSession({
    intention: 'no metrics here',
    events: [{ kind: 'attention', domain: 'chatgpt.com', seconds: 3600, at: new Date().toISOString() }],
  })
  const page = await context.newPage()
  await page.goto('/dashboard')
  const text = await page.locator('[data-surface="ledger"]').innerText()

  expect(text).not.toMatch(/\d+\s*%/)
  expect(text).not.toMatch(/\bscore\b/i)
  // "3 hrs", "3 hours", "3h" — a total-hours figure in any spelling.
  expect(text).not.toMatch(/\b\d+(\.\d+)?\s*(h|hr|hrs|hours)\b/i)
})
