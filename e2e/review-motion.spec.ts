import { test, expect } from './fixtures'

const ONE_ROW = [{ kind: 'attention', domain: 'chatgpt.com', seconds: 90, at: new Date().toISOString() }]

// #48. .m-rise was defined at globals.css:596 and used nowhere.
test('the review staggers its entrance, 50ms a step', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'motion test', events: ONE_ROW })
  const page = await context.newPage()
  await page.goto(`/review/${sessionId}`)

  const risers = page.locator('[data-surface="review"] .m-rise')
  expect(await risers.count()).toBeGreaterThanOrEqual(5)

  const delays = await risers.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).transitionDelay),
  )
  expect(delays[0]).toBe('0s')
  expect(delays[1]).toBe('0.05s')
  expect(delays[2]).toBe('0.1s')
  // Strictly increasing, so nothing shares a step.
  const ms = delays.map((d) => parseFloat(d) * 1000)
  expect(ms.every((v, i) => i === 0 || v > ms[i - 1])).toBe(true)

  // The ask group is last, so the question is the last thing to arrive.
  const askDelay = await page.locator('.m-review-ask').evaluate((el) => getComputedStyle(el).transitionDelay)
  expect(parseFloat(askDelay) * 1000).toBe(Math.max(...ms))
})

// Wrapping <Band> in a rise div (#48) made it a grandchild of [data-surface="review"] instead of
// a direct child, so globals.css:157's `> .m-mark:not(:empty)` selector stopped matching and the
// band fell back to the 34x16 decorative-glyph size instead of the full-width 100%x32 bar.
test('the combined band still renders full-width, wrapped or not', async ({ context, endedSession }) => {
  const sessionId = await endedSession({ intention: 'band width test', events: ONE_ROW })
  const page = await context.newPage()
  await page.goto(`/review/${sessionId}`)

  const band = page.locator('[data-surface="review"] .m-mark:not(:empty)')
  const box = await band.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBe(32)
  // Far larger than the 34px glyph fallback — a real full-width bar, not the decorative glyph.
  expect(box!.width).toBeGreaterThan(200)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a staggered entrance is a vestibular trigger, so there is none', async ({ context, endedSession }) => {
    const sessionId = await endedSession({ intention: 'reduced motion test', events: ONE_ROW })
    const page = await context.newPage()
    await page.goto(`/review/${sessionId}`)

    const sentence = page.locator('[data-surface="review"] .m-sentence').first()
    await expect(sentence).toBeVisible()
    expect(await sentence.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s')
    expect(await sentence.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  })
})
