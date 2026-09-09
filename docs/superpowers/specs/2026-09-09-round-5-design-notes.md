# Round 5 — design notes

**Date:** 2026-09-09 · **Surface:** extension popup (`idle`, `running`, `outcome`) · **Mode:** Operate
**Kind:** refinement of the Orbit identity. No new visual world, no new tokens beyond what
`design/tokens.css` already holds, no 14th class.

Sources read before writing this: `design/tokens.css`, `extension/tokens.css` (generated mirror),
`docs/design-toolkit.md`, `PRODUCT.md`, `extension/popup.js`, `extension/meant.css`,
`extension/sw.js`, `extension/lib/attribution.js`, `extension/api.js`, `lib/band.ts`,
`lib/review-data.ts`, `app/api/sessions/[id]/review/route.ts`, `app/api/events/route.ts`,
`app/review/[sessionId]/page.tsx`, `app/band.tsx`, `app/globals.css`,
`design/canvas/PopupRunning.dc.html`, `design/fixtures/popup-running.html`,
`docs/superpowers/plans/2026-09-04-drift-and-cycles.md` (Task 16, D42), `e2e/offline.spec.ts`.

---

## 0. Two things the orchestrating session should read first

### 0.1 The live per-site data must NOT come from a polled endpoint

The brief proposed a new/loosened endpoint plus popup polling with an offline fallback. That is
the wrong mechanism, and the plan of record already says so.

`docs/superpowers/plans/2026-09-04-drift-and-cycles.md` **D42** and **Task 16** already specify
exactly this feature, and specify it as a **local tally in `chrome.storage.local`, no network**:

> **D42 — The live band shows time by site and does not mark drift.** … it was never built
> because `popup.js` had no per-domain data. Wiring it is a local tally in `chrome.storage.local`,
> no network.

The slot is already reserved in the shipped code: `extension/sw.js:127` initialises
`session.tally = {}` and nothing ever reads or writes it. `extension/lib/tally.js` is listed in
that plan's File Structure table and does not exist yet. This is an unfinished task, not a new
one.

Why the local tally wins outright:

| | Local tally (`session.tally`) | Polling `/api/sessions/:id/review` |
|---|---|---|
| Offline | Works. No fallback needed | Needs a stale-data fallback path |
| Freshness | Current to the last slice close, plus the open slice computed at read time | Up to ~30s behind: events only leave the queue on the 30s `TICK` alarm (`sw.js:131`, `flush()`) |
| Latency on popup open | One `chrome.storage.local.get` already being made | A network round trip on a surface opened dozens of times a day |
| New code | One pure module + ~4 lines in `transition()` | Endpoint change, poll loop, cache, staleness UI, teardown |
| `PRODUCT.md` constraint | Satisfies "Nothing waits on a model… not the session start, not a block, not a page load" | Introduces a network dependency into the most-opened surface |

Verified, for the record: **`/api/sessions/[id]/review` does not gate on the session being
ended.** `getReviewData()` (`lib/review-data.ts:22-31`) selects the session by `id` + `user_id`
and aggregates `event` rows with no `ended_at` predicate; `endedAt` is returned as data, not used
as a filter. So the endpoint the brief worried about needs **no change at all** — and it is still
the right source for the *outcome* screen (item F), where the session has ended and `endSession()`
has already flushed. It is simply not the right source mid-session.

**Recommendation: drop the polling design entirely.** Section 1 specifies the tally instead.

### 0.2 `design/canvas/PopupRunning.dc.html` is stale, and must be updated by this work

`CLAUDE.md` says the canvas is visual truth and that when it disagrees with the docs I must say so
rather than silently pick. It disagrees with round 5, so I am saying so.

The artboard draws the attention band as a **separate 14px flat strip below the pill**, with a
`0.5px dashed #C7C2BB` remainder and a hatched away segment, plus a 3-step plan list that D38
already removed. Round 5 moves that band **onto the pill's own outline** and de-dashes the
remainder. Task 16 Step 1 already anticipated this ("**Artboard first** … The artboard has to
change either way").

So: the canvas is stale on this surface, round 5 is the newer instruction, and
`design/canvas/PopupRunning.dc.html` + `design/fixtures/popup-running.html` must be redrawn as
part of implementing this spec — not left disagreeing. Everything the artboard *does* still carry
authority on is preserved below: segment order (attention-1 → attention-2 → away → remainder), the
3px gap, `height: 14px` for a flat band, the planned-session denominator (its flexes read
28+9+4 measured against a 27 remainder — a **planned** total, not a phase total).

---

## 1. Live per-site attention data — `session.tally` + `extension/lib/tally.js`

No endpoint. No polling. No `setInterval`.

### 1.1 `sw.js#transition` accumulates the tally

`transition()` (`extension/sw.js:248`) already receives the closed-slice events from
`advance()`. Add accumulation beside the existing `enqueue` loop:

```js
// sw.js#transition, replacing `for (const event of events) await enqueue(session, event)`
const tally = session.tally ?? { attention: {}, away: 0, break: 0 }
for (const event of events) {
  await enqueue(session, event)
  if (event.kind === 'attention' && event.domain) {
    tally.attention[event.domain] = (tally.attention[event.domain] ?? 0) + event.seconds
  } else if (event.kind === 'away') tally.away += event.seconds
  else if (event.kind === 'break') tally.break += event.seconds
}
// …then include `tally` in the `next` object already being written:
const next = { ...session, slice: state, dwellSince, tally }
```

Exact shape, fixed:

```js
session.tally = {
  attention: { 'claude.ai': 2460, 'docs.google.com': 720 },  // seconds, insertion-ordered
  away: 360,
  break: 0,
}
```

Insertion order is load-bearing — it is the tie-breaker (§1.3). `chrome.storage.local` round-trips
plain objects preserving string-key insertion order, so this is safe.

`break` is included for completeness but is **always 0 today**: `attribution.js`'s `'break'` mode
is never driven (the comment on `cyclePhase` in `popup.js:454-457` says so explicitly). When it is
driven, it needs its own decision on the loop; §2.4 records what that decision must not be.

### 1.2 The open slice must be topped up at read time

`tally` only grows when a slice **closes**. Open the popup 40 seconds into a session on a single
tab with no tab switches and `tally` is `{}` — the loop would read as a cold start on a session
that is genuinely running. The read has to add the currently-open slice.

`extension/lib/tally.js` — pure, no `chrome.*`, no `Date.now()` (same discipline as
`attribution.js`; every caller passes `at`):

```js
// extension/lib/tally.js

// Duplicated from lib/band.ts#EXTENSION_ID_SHAPE — the plain-JS extension can't import that
// TS module (same limitation as GRACE_MS / CYCLE_PRESETS in popup.js). Keep them identical.
const EXTENSION_ID_SHAPE = /^[a-p]{32}$/

/** tally + the still-open slice's elapsed time, as one merged tally. Read-only view: no
 *  AWAY_MIN_MS floor is applied here (that floor exists to keep junk out of the event log,
 *  not out of a display), and nothing is written back. */
export function withOpenSlice(tally, slice, at) {
  const merged = {
    attention: { ...(tally?.attention ?? {}) },
    away: tally?.away ?? 0,
    break: tally?.break ?? 0,
  }
  if (!slice) return merged
  const seconds = Math.floor(Math.max(0, at - slice.since) / 1000)
  if (seconds === 0) return merged
  if (slice.mode === 'attention' && slice.domain) {
    merged.attention[slice.domain] = (merged.attention[slice.domain] ?? 0) + seconds
  } else if (slice.mode === 'away') merged.away += seconds
  else if (slice.mode === 'break') merged.break += seconds
  return merged
}
```

### 1.3 `toSegments` — one vocabulary with the review

```js
/** Merged tally → the same `{ kind, flex }` Segment shape lib/band.ts#toBand produces, so the
 *  popup and the review draw from one vocabulary. Top three domains by seconds, ties broken by
 *  first-seen, zero-second and extension-ID-shaped domains dropped, away as its own segment.
 *  Never emits `remainder` — the caller owns the denominator, exactly as toBand() does. */
export function toSegments(merged) {
  const attention = Object.entries(merged.attention)
    .filter(([domain, seconds]) => seconds > 0 && !EXTENSION_ID_SHAPE.test(domain))
    // Object.entries preserves insertion order, and Array#sort is stable in every engine
    // this ships to — so an exact tie keeps first-seen order with no explicit tie-breaker.
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const segments = attention.map(([domain, seconds], i) => ({
    kind: ['attention-1', 'attention-2', 'attention-3'][i],
    domain,
    flex: seconds,
  }))
  if (merged.away > 0) segments.push({ kind: 'away', domain: null, flex: merged.away })
  if (merged.break > 0) segments.push({ kind: 'break', domain: null, flex: merged.break })
  return segments
}
```

`domain` is carried on the segment (which `toBand` does not do) so a future running-screen legend
does not need a second pass over the tally. It is unused by this spec.

### 1.4 Unit tests (`test/tally.test.js`, `node --test`)

- top three by seconds, 4th+ dropped
- an exact tie keeps first-seen order
- a zero-second domain is dropped
- a 32-char `[a-p]` domain is dropped; `localhost` is kept (mirrors `test/band.test.js`)
- `withOpenSlice` adds an open `attention` slice to an existing domain's total
- `withOpenSlice` on a `null`-domain `attention` slice adds nothing
- `withOpenSlice` with `at` before `slice.since` adds nothing (no negative)
- `away`/`break` slices land in their own buckets, no `AWAY_MIN_MS` floor

### 1.5 What this deliberately does not do

- **No polling, no fetch, no new endpoint.** `e2e/offline.spec.ts`'s guarantee (a session that
  starts and runs with no network) extends to the loop for free. There is no stale state to
  surface, so there is no staleness UI to design.
- **No live tick.** The loop and every figure beside it are computed once, on popup open, from a
  single `chrome.storage.local.get`. `docs/design-toolkit.md` §9 refuses "a countdown that ticks
  (a live clock invites waiting it out)", and `grep -rn "setInterval" extension/` must keep
  returning nothing. `requestAnimationFrame` in `running()` is a single measurement frame, not a
  tick — it stays.
- **No drift marking on the loop** (D42, invariant I2). Time by site is descriptive: drifting
  grows it too, so there is nothing to win.

---

## 2. Item B — the loop starts at true 12 o'clock and runs clockwise

### 2.1 Where it starts today

Per the SVG 2 spec, a `<rect>`'s equivalent path is
`M (x+rx, y) H (x+width−rx) A … Z` — it **begins at `(x + rx, y)`**, i.e. on the top edge, `rx`
in from the top-left corner, and proceeds to increasing `x`, which in screen coordinates is
**clockwise**. So the brief's guess is right on both counts: the direction is already correct, and
the start is already on the top edge — just `rx` px off-centre, not at top-dead-centre.

With the shipped values (`x = y = 0.75`, `rx = ry = 26`) and the real measured pill, the start
sits **131.75px** clockwise-before top-centre on a **735.4px** perimeter — 17.9% of the loop, and
plainly visible as "it starts near the left corner".

Measured pill, for reference (360px popup − 2×20px `#root` padding; `.m-sentence` popup
`min-height: 76px`; `[data-timer-pill]` `border: 1.5px`, `box-sizing: border-box`):

| | |
|---|---|
| `pillWrap.clientWidth` / `clientHeight` | 317 / 76 |
| rect `width` / `height` at inset 0.75 | 315.5 / 74.5 |
| straight top+bottom | 2 × (315.5 − 52) = 527 |
| straight left+right | 2 × (74.5 − 52) = 45 |
| four quarter-circles | 2π × 26 = 163.36 |
| perimeter | **735.36** |
| `(x + rx)` → top-centre | 315.5/2 − 26 = **131.75** |

### 2.2 The fix: replace the two `<rect>`s with one authored `<path>` that starts at top-centre

Rotating a `<rect>`'s dash pattern with `stroke-dashoffset` works, but it puts an arc-length
constant (`W/2 − r`) between the reader and the intent, and it has to be recomputed for every
segment in §3. Authoring the path so its zero point **is** top-dead-centre removes the constant
entirely: every segment's start offset is then just its own cumulative position.

```js
// Clockwise from top-dead-centre. Same rounded-rect geometry as --m-r-field (26px), so the
// pill's shape does not change — only where the outline's zero point is and how it is painted.
function loopPath(width, height, inset, r) {
  const x = inset, y = inset
  const w = width - inset * 2, h = height - inset * 2
  const rr = Math.min(r, w / 2, h / 2)   // matches the rx/ry clamp <rect> would apply
  return [
    `M ${x + w / 2} ${y}`,
    `H ${x + w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    `H ${x + w / 2}`,
  ].join(' ')
}
```

`inset = 1` (half the 2px stroke chosen in §3.3), `r = 26`. No `Z` — the path already returns to
its start point, and a `Z` would add a zero-length close that some engines count in
`getTotalLength()`.

`L = path.getTotalLength()` on this path. Do not hand-compute `L`: the pill can wrap to two lines,
and `getTotalLength()` gives the real rendered perimeter for the real measured size — the reason
the shipped code used it in the first place.

### 2.3 Two measurement bugs to fix while in here

1. **`pillWrap.style.border = 'none'` changes the geometry it is about to measure.** Removing a
   1.5px border makes `clientWidth` jump 317 → 320, so the running pill is 3px wider than the
   idle field it replaces. Replace it with a transparent border so nothing moves:

   ```css
   /* extension/meant.css, beside the existing [data-timer-pill] rule */
   [data-timer-pill][data-loop="on"] { border-color: transparent; }
   ```
   ```js
   pillWrap.dataset.loop = 'on'   // instead of pillWrap.style.border = 'none'
   ```

2. **Measure after the display font has loaded.** Fraunces is `font-display: swap`
   (`extension/meant.css:16`), so a one-line pill can become two lines *after* the `rAF` fires,
   leaving the `viewBox` mismatched against the box. Gate the draw:

   ```js
   document.fonts.ready.then(() => requestAnimationFrame(() => drawLoop()))
   ```

   Known limitation, accepted: the loop is not redrawn if the pill resizes for any *other* reason.
   The popup is a fixed 360px surface with static content for the life of one open, so a
   `ResizeObserver` is not worth its cost. The one dynamic case — the grace-window `<input>` the
   user types into — does not change the pill's height (`min-height: 76px`, single-line input).

### 2.4 SVG element setup

```js
const svg = document.createElementNS(SVG_NS, 'svg')
svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
svg.setAttribute('aria-hidden', 'true')   // the figures beside it carry the same information
svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;'
```

One `<path>` element per segment, all sharing the identical `d`. Four to five nodes; cheaper and
clearer than `<defs>` + `<use>`, which does not inherit `stroke-dasharray` reliably.

Set paint through `.style`, not `setAttribute('stroke', …)`:

```js
p.style.fill = 'none'
p.style.stroke = 'var(--m-clay)'        // unambiguously a CSS value; var() in a presentation
p.style.strokeWidth = '2'               // attribute works in Blink but is easy to doubt
p.style.strokeLinecap = 'butt'          // round caps would eat into the 3px gaps
```

`butt` caps are deliberate: the gaps are the separator (`docs/design-toolkit.md` §2), so they must
stay exactly 3px.

---

## 3. Item C — the loop is a segmented attention band, not a two-tone split

### 3.1 What the loop's full length means

**The loop's length is the session's planned duration.** Decision 2 (§6) merges cycle and
duration, so for `25/5`, `50/10`, and a typed custom pair, one cycle *is* the session and "the
loop is the cycle" and "the loop is the session" are the same statement. This also matches the
artboard, whose flexes (28+9+4 measured against 27 remainder ≈ 68 total) read against a planned
total, not a phase.

```js
const measured = sum(all segment seconds)
let denom
if (session.plannedMinutes == null) denom = Math.max(measured, 1)   // "until I stop": no remainder
else denom = Math.max(session.plannedMinutes * 60, measured)        // overrun clamps, never overflows
```

The `Math.max(..., measured)` clamp is not cosmetic: working straight through a 30-minute cycle is
normal, and without it the segments would run past `L`.

### 3.2 What each segment is

Order clockwise from top-centre, identical to the review band's left-to-right order (so the
outcome screen's rows label the same sequence):

| # | Kind | Paint | Source |
|---|---|---|---|
| 1 | `attention-1` | `var(--m-clay)` | largest domain by seconds |
| 2 | `attention-2` | `var(--m-clay-2)` | second |
| 3 | `attention-3` | `var(--m-clay-3)` | third |
| 4 | remainder | `var(--m-edge)` | everything else, as one arc |

**Away is folded into the remainder on the loop, and is not painted.** This is a real decision and
here is the reasoning, because the obvious alternative is illegal:

- `CLAUDE.md` and `docs/design-toolkit.md` §2 make it an invariant that **"away is a hatch, never a
  solid grey"** — a hatch says *unmeasured*, not *another site*. So `--m-ink-3` solid is out.
- The hatch itself cannot survive a 2px stroke. `--m-away` is
  `repeating-linear-gradient(135deg, #8B8681 0 2px, transparent 2px 6px)`; translated to an SVG
  `<pattern>` used as stroke paint on a 2px line it renders as ~2px marks every ~5.7px — i.e. a
  dashed grey line, which is precisely what item E is removing. It would read as texture nowhere
  and as a defect everywhere.
- On a 2px outline, "unmeasured" has exactly one honest expression: not painted clay. The
  remainder arc already is that.

So the loop's remainder means **"not attributed to one of your top three sites"** — away, break,
the 4th+ domain, and unspent planned time, in one quiet arc. The running screen prints no
per-domain rows, so nothing on screen contradicts that reading. The full four-kind vocabulary —
including the hatch — lives on the **outcome** screen's 14px band (item F), where a hatch can
actually be seen. That is also the only surface where away has a figure beside it.

`break` is folded in the same way, and is 0 today. **When `'break'` mode is eventually driven, it
must not be solved by hatching a 2px stroke either** — revisit this section rather than reaching
for a pattern.

### 3.3 Stroke weight: 2px, uniform

The loop is painted at `var(--m-stroke-loud)` (2px) for **every** segment including the remainder,
up from the pill's current `var(--m-stroke)` (1.5px).

Why, stated plainly as a deviation: `--m-clay-3` (`#E2B29E`) on `--m-ground` (`#F3F1EE`) is a
~1.3:1 luminance relationship. The review band gets away with it because it is a 14px solid block;
at 1.5px the third tint simply disappears, and a segment you cannot see is worse than no segment.
2px is the smallest weight that holds three tints. `docs/design-toolkit.md` §4 lists
`--m-stroke-loud` as "block page, companion facing you"; extending it to "the outline when the
outline is carrying the band" is the same logic — the element earns weight when it carries data.

Uniform across all segments, deliberately: varying weight around one continuous outline makes the
pill look warped, and it is the same *outline*, not four elements. And it is a useful side effect
that the running pill is now visibly heavier than the idle field — the idle field is something you
type into, the running pill is something you read.

### 3.4 The exact layout algorithm

```js
const GAP = 3                    // px of path length. Matches .m-mark:not(:empty) { gap: 3px }
const MIN_ARC = 0.05 * L         // item D, §4
const MIN_DRAWN = 8              // below this a segment cannot read as a segment

// 1. shares, in path-length units
const shares = segments
  .filter((s) => s.kind.startsWith('attention'))       // away/break fold into the remainder
  .map((s) => ({ kind: s.kind, len: (s.flex / denom) * L }))
  .filter((s) => s.len >= MIN_DRAWN)                   // a 3px sliver is noise; its time falls
                                                       // into the remainder, unpainted

// 2. the floor (item D) — first segment only, never a permanent offset
if (shares.length === 0) shares.push({ kind: 'attention-1', len: MIN_ARC })   // cold start
else shares[0].len = Math.max(shares[0].len, MIN_ARC)

// 3. lay them out clockwise from 0 (= top-dead-centre), gaps carved out of each segment's tail
let cursor = 0
for (const s of shares) {
  arc(s.kind, cursor, Math.max(s.len - GAP, 2))
  cursor += s.len
}

// 4. the remainder closes the loop, leaving one final gap before wrapping back to top-centre
const remainder = L - cursor
if (remainder > GAP + MIN_DRAWN) arc('remainder', cursor, remainder - GAP)

// 5. one arc = one <path>, one dash, period exactly L so nothing double-draws or clips at the seam
function arc(kind, start, len) {
  const p = document.createElementNS(SVG_NS, 'path')
  p.setAttribute('d', d)                       // the same authored d for every segment
  p.dataset.kind = kind                        // debuggable, and greppable against .m-row-bar
  p.style.fill = 'none'
  p.style.stroke = PAINT[kind]                 // §3.2's table, as var(--m-*)
  p.style.strokeWidth = '2'
  p.style.strokeLinecap = 'butt'
  p.style.strokeDasharray = `${len} ${L - len}`      // sum === L → exactly one dash per loop
  p.style.strokeDashoffset = `${(L - start) % L}`    // positive form of -start; wraps correctly
  svg.append(p)
}
```

Why `dasharray` sums to exactly `L`: a positive `stroke-dashoffset` advances the pattern, so a
dash appears at path position `−offset ≡ L − offset`. Setting the pattern's period to `L` makes
that congruence exact, so a segment that crosses the seam wraps around instead of being clipped —
which the shipped `${len} ${perimeter}` form (period `len + perimeter`) cannot do.

Paint the segments in order and append the remainder **last**; nothing overlaps, so z-order is not
load-bearing, but appending in reading order keeps the DOM inspectable.

### 3.5 Tokens

Nothing new is needed. `extension/meant.css` `@import`s `extension/tokens.css`, the generated
mirror of `design/tokens.css`, which already defines `--m-clay`, `--m-clay-2`, `--m-clay-3`,
`--m-edge`, `--m-away`, `--m-stroke`, `--m-stroke-loud` — in both themes. `popup.js` is a normal
document, not a Shadow DOM, so it reads them directly; the `:host` redeclaration convention in
`companion-overlay.js` does not apply here and must not be copied.

**Do not touch `design/tokens.css`.** The `.m-row-bar[data-kind]` rules in `extension/meant.css`
(lines 303-307) already carry every colour this design needs and finally get a producer (item F).

---

## 4. Item D — the 5% "never render nothing" floor

`MIN_ARC = 0.05 × L`. On the measured pill that is **36.7px of a 733.4px loop** — about 40% of the
straight top edge, running right from top-centre. Unmistakably intentional; nowhere near a
two-tone progress bar.

Behaviour, precisely:

- It applies to **`shares[0]` only**, as `Math.max(shares[0].len, MIN_ARC)`. Once the largest
  domain's real share exceeds 5% (90 seconds into a 30-minute cycle) the floor is inert — it is a
  clamp, never an added offset. There is no case where real progress is displaced.
- It **eats into the remainder**, not into segments 2 and 3: the cursor advances by the floored
  length, so the remainder shrinks by exactly the amount the floor added. Total is always `L`.
- **Cold start with no attention at all** (`shares.length === 0` — a fresh session on a
  `chrome://` tab, or a first slice that has not closed and whose domain is `null`): synthesise a
  single `attention-1` arc at `MIN_ARC`. This is the case the user described as "looks broken or
  unstyled", and it is the one the floor exists for.
- Segments 2 and 3 get no floor. They are filtered at `MIN_DRAWN = 8` instead — below 8px a
  segment reads as dirt on the screen, and inflating it would be a lie about a *ranking*, which is
  the only claim the tints make.

Honesty budget, acknowledged: on a 30-minute cycle the floor can overstate the top domain by up to
90 seconds during the first 90 seconds of a session. Mitigated by there being no percentage and no
figure attached to the arc (`docs/design-toolkit.md` §9 forbids both anyway), and by the elapsed
figure beside it coming from real data. Accepted.

---

## 5. Item E — the dashed remainder becomes a solid line, and why that does not contradict item C

**The change:** delete `remainderTrack.setAttribute('stroke-dasharray', '3 3')`. The remainder is
one solid arc, `var(--m-edge)`, 2px, `butt` caps — the same weight as every other segment, so the
outline reads as one continuous shape whose *colour* changes, not as a line that keeps breaking.

**The apparent contradiction, resolved.** Item C says match the existing segmented-band
convention; that convention renders `remainder` as `border: var(--m-stroke-hair) dashed
var(--m-edge)` (`extension/meant.css:307`, `app/globals.css:309`). Three facts dissolve it:

1. **They are different objects.** On the review band, `remainder` is a 14px-tall dashed
   *rectangle* — it reads as an empty box, a container with nothing in it. The shipped popup's
   `stroke-dasharray: '3 3'` is a 3-on/3-off **hairline**, which reads as "unstyled" or "still
   loading". The user's complaint is about the second thing. A dashed box and a dotted line are not
   the same convention expressed at two sizes.
2. **There is nothing to stay consistent with.** `lib/band.ts#toBand` never emits `remainder` — its
   own comment says so ("real attention data has no unmeasured gap to reserve… it exists for static
   previews"). Grepping every producer confirms it: `remainder` appears only in
   `design/fixtures/landing.html`-style previews and the artboards. Item F does not emit it either
   (§7). So the `remainder` CSS has **zero live producers before and after this change**, and the
   loop's solid remainder creates no inconsistency with any rendered surface.
3. **The loop's remainder does not mean what the band's does.** Per §3.2 it means "not attributed
   to your top three sites" — which includes measured-but-not-top time. A dashed edge would claim
   *unmeasured*, and would be wrong.

**Therefore: leave `.m-row-bar[data-kind="remainder"]` exactly as it is** in both
`extension/meant.css` and `app/globals.css`. Changing dead CSS to resolve a contradiction that
only exists on paper is churn. If `remainder` ever gets a real producer on a band, revisit it then,
with something rendered to look at.

---

## 6. Item 2 — the progressive-disclosure duration + cycle model

### 6.1 The IA

```
┌ always visible ────────────────────────────────────┐
│  [ 25/5 ]  [ 50/10 ]      [ custom ]               │   ← one single-select, 3 chips
└────────────────────────────────────────────────────┘
┌ revealed only while `custom` is selected ──────────┐
│  work [ 25 ] / break [ 5 ]                         │   ← labelled number inputs
│  [ until I stop ]  [ no cycles ]                   │   ← at-most-one-of-two
└────────────────────────────────────────────────────┘
```

The standalone `duration` row (`25 min` / `50 min` / `until I stop`) is **deleted**. Its
`until I stop` option survives inside the reveal; `no cycles` moves there from the old 4-chip cycle
row.

### 6.2 The state model

Two variables, and no reachable ambiguous combination:

```js
mode       : '25/5' | '50/10' | 'custom'          // level 1, single-select, default per §6.5
customMode : 'timed' | 'open' | 'none'            // level 2, only meaningful while mode === 'custom'
work, brk  : number                               // the two inputs, default 25 / 5
```

Resulting `{ plannedMinutes, cycle }` — the complete truth table:

| `mode` | `customMode` | `plannedMinutes` | `cycle` | reads as |
|---|---|---|---|---|
| `25/5` | — | `30` | `{work:25, break:5}` | one 25/5 cycle, then the review |
| `50/10` | — | `60` | `{work:50, break:10}` | one 50/10 cycle, then the review |
| `custom` | `timed` | `work + brk` | `{work, break: brk}` | one custom cycle, then the review |
| `custom` | `open` | `null` | `{work, break: brk}` | cycles repeat until you stop |
| `custom` | `none` | `work` | `null` | run for exactly `work` minutes, no phases |

This answers the three open questions:

- **`until I stop`** keeps the typed pair as the cycle and sets `plannedMinutes = null`. This is
  where the old "multiple cycles inside one session" flexibility lands, exactly as the brief
  intended — the cycles just have no planned end.
- **Typing custom numbers caps the duration the same way the presets do**: `plannedMinutes =
  work + brk`. The rule is uniform — *a cycle is a session* — with one named escape hatch
  (`until I stop`). If typing a pair behaved differently from picking a pair, "custom" would mean
  two things.
- **"Run for exactly N minutes with no work/break phases" stays reachable.** Under `no cycles` the
  **work input becomes the session length** and the break input is disabled. No new control, no
  new row: the field already on screen is repurposed, and its label swaps `work` → `minutes` so it
  is not lying. This is the one combination that would otherwise have been silently retired, and
  retiring it would have been a regression (it is today's `duration=25 / cycle=none`).

Explicitly retired, and worth telling the user once: **"exactly two 25/5 cycles in one 60-minute
session"** is no longer expressible. `until I stop` gives unbounded repetition; a bounded count of
repeats does not exist. That is the flexibility the merge trades away, and the trade is the point.

### 6.3 Exact click handlers

`chipGroup()` is not the right tool for level 2 — single-select cannot express "neither pressed",
and `multi: true` cannot express "at most one". Two plain buttons and a 10-line setter is smaller
than extending `chipGroup`'s contract, and `chipGroup` is used by four other callers.

```js
// ---- level 1 ----------------------------------------------------------------
const level1 = chipGroup(
  [ { label: '25/5',  value: '25/5' },
    { label: '50/10', value: '50/10' },
    { label: 'custom', value: 'custom' } ],
  { mono: true, value: mode, onChange: (v) => { mode = v; customRow.hidden = v !== 'custom' } },
)
level1.row.dataset.chipLayout = 'paired'   // keeps the 12px gap before `custom` (§6.4)

// ---- level 2 ----------------------------------------------------------------
// `custom` stays pressed at level 1 while level 2 says WHICH custom. The two chips are
// at-most-one-of-two: clicking the pressed one returns to `timed`, the inputs' own state.
function setCustomMode(next) {
  customMode = next
  openChip.setAttribute('aria-pressed', String(next === 'open'))
  noneChip.setAttribute('aria-pressed', String(next === 'none'))
  brkInput.disabled = next === 'none'
  workLabelText.textContent = next === 'none' ? 'minutes' : 'work'
}
openChip.addEventListener('click', () => setCustomMode(customMode === 'open' ? 'timed' : 'open'))
noneChip.addEventListener('click', () => setCustomMode(customMode === 'none' ? 'timed' : 'none'))
// Typing in either field is itself a choice of `timed` — it would be a trap to let someone edit
// numbers that the pressed chip is ignoring.
workInput.addEventListener('input', () => { if (customMode === 'open') setCustomMode('timed') })
brkInput.addEventListener('input', () => { if (customMode !== 'timed') setCustomMode('timed') })
```

Note `workInput`'s guard is asymmetric on purpose: under `no cycles` the work field is the session
length and editing it must **not** leave `none`.

The picker's public getter, replacing both `duration.value` and `cycle.value` at the `Start` call
site (`popup.js:402-403`):

```js
get value() {                                  // → { plannedMinutes, cycle }
  const w = Number(workInput.value) || 25
  const b = Number(brkInput.value) || 5
  if (mode !== 'custom') {
    const [pw, pb] = mode.split('/').map(Number)
    return { plannedMinutes: pw + pb, cycle: { work: pw, break: pb } }
  }
  if (customMode === 'none') return { plannedMinutes: w, cycle: null }
  if (customMode === 'open') return { plannedMinutes: null, cycle: { work: w, break: b } }
  return { plannedMinutes: w + b, cycle: { work: w, break: b } }
}
```

`lastChoice` keeps its current shape (`{ plannedMinutes, cycle, … }`) — no storage migration.
Restoring it:

```js
function restore(lastChoice) {
  if (!lastChoice) return { mode: '25/5', customMode: 'timed', work: 25, brk: 5 }   // §6.5
  const { plannedMinutes: pm, cycle: c } = lastChoice
  if (!c) return { mode: 'custom', customMode: 'none', work: pm ?? 25, brk: 5 }
  const preset = CYCLE_PRESETS.find((p) => p.work === c.work && p.break === c.break)
  if (preset && pm === preset.work + preset.break) {
    return { mode: `${preset.work}/${preset.break}`, customMode: 'timed', work: c.work, brk: c.break }
  }
  // A preset pair with a mismatched duration is an old-model session (e.g. 50 min through two
  // 25/5 cycles). It lands in `custom`, which is exactly where the new model puts that shape.
  return { mode: 'custom', customMode: pm == null ? 'open' : 'timed', work: c.work, brk: c.break }
}
```

`cyclePresetKey()` (`popup.js:222`) is subsumed by `restore()` and should be deleted.

### 6.4 The input styling bug, fixed while in this area

`customWork` / `customBreak` currently carry `class="m-chip"` — so they inherit `cursor: pointer`
and chip padding — and have **no labels at all**. Both are real defects, and the reveal makes them
prominent.

```js
const workLabelText = el('span', null, 'work')
const workLabel = el('label', 'm-meta')
workLabel.append(workLabelText, workInput)     // wrapping <label> — implicit association, no id
```
```css
/* extension/meant.css, after the .m-chip[data-chip-role="delete"] rules */
/* Number inputs inside the cycle reveal: chip-shaped, but a text field, not a button. */
.m-chip[data-chip-role="number"] {
  width: 56px;
  cursor: text;
  font-family: var(--m-figure);
  font-size: 12px;
  text-align: center;
  color: var(--m-ink);
}
.m-chip[data-chip-role="number"]:disabled { color: var(--m-ink-3); border-color: var(--m-edge); cursor: default; }
[data-surface="popup"] [data-chip-layout="custom"] { display: flex; align-items: center; gap: 8px; }
[data-surface="popup"] [data-chip-layout="custom"] label { display: inline-flex; align-items: center; gap: 6px; }
```

`width: 56px` in CSS replaces the inline `style.width = '64px'` — no inline styles for something
this static. `data-chip-role="number"` joins the existing `data-chip-role="delete"`; no new class,
the 13-class contract holds (`docs/design-toolkit.md` §8).

Keep `[data-chip-layout="paired"]`'s `:nth-child(3) { margin-left: 12px }` rule
(`extension/meant.css:219`) — with three chips, child 3 is `custom`, so the gap now separates
*presets* from *custom*, which is precisely the grouping the reveal implies. **Update its comment**,
which currently claims the gap lands after the 2nd of 4 chips before `custom`/`no cycles`.

### 6.5 The default — resolved with the user

Today's two defaults disagree: `duration` defaults to `25` (`popup.js:359`) while `cycle` defaults
to `{work:50, break:10}` (`popup.js:363`). The merge forces one to win, and the user chose the
gentler option: **`mode` defaults to `'25/5'`** (a first-ever session's planned length becomes 30
minutes, not today's 25 or the cycle-default's 60). `restore()` (§6.3) falls back to
`{ mode: '25/5', customMode: 'timed', work: 25, brk: 5 }` when there is no `lastChoice`.

Also confirmed with the user: retiring "a bounded number of repeated cycles in one planned session"
(e.g. today's "two 25/5 cycles in one 60-minute session") is an acceptable trade for the simpler
picker. `until I stop` remains the only way to get repeated cycles, and it is now unbounded rather
than countable — this is intentional, not a gap to fill later.

---

## 7. Item F — the segmented band on the outcome screen

Insertion point: in `outcome()`, immediately **after** the intention block (`popup.js:588-592`) and
**before** the `data.topAttention` text rows (`popup.js:593-595`). The rows stay — this is additive.

```js
const TINTS = ['attention-1', 'attention-2', 'attention-3']

const bandSegments = [
  ...data.topAttention.map((r, i) => ({ kind: TINTS[i], flex: r.seconds })),
  ...(data.awaySeconds > 0 ? [{ kind: 'away', flex: data.awaySeconds }] : []),
].filter((s) => s.flex > 0)

if (bandSegments.length > 0) {
  const band = el('p', 'm-mark')
  band.dataset.state = 'ended'
  band.dataset.band = 'session'
  for (const s of bandSegments) {
    const bar = el('span', 'm-row-bar')
    bar.dataset.kind = s.kind
    bar.style.flex = String(s.flex)      // the one legitimate inline style: it IS the data
    band.append(bar)
  }
  nodes.push(band)
}
```

```css
/* extension/meant.css, after the .m-mark rules */
/* The session's attention as one full-width band, above the rows that label its swatches
 * (docs/design-toolkit.md §2, "Review: outline, then the plan, then the finished band, then
 * the rows"). data-band, not a 14th class. */
[data-surface="popup"] .m-mark[data-band="session"] { width: 100%; height: 14px; }
```

Everything else is already in place and needs no new CSS:

- `.m-mark:not(:empty)` → `display: flex; gap: 3px` — the 3px gaps of §2 of the toolkit.
- `.m-mark[data-state="ended"]:not(:empty) { border: none }` → no dashed container around a
  finished band.
- `.m-mark:not(:empty) > .m-row-bar { width: auto; height: 100%; border-radius: var(--m-r-chip) }`
  → the bars flex instead of holding their 11px row size.
- `.m-row-bar[data-kind="attention-1|-2|-3|away"]` → the paints, both themes. **This is the dead
  CSS from a prior round finally getting a producer.**

Decisions inside this:

- **`height: 14px`**, matching `design/fixtures/popup-running.html` and the artboard, not the
  popup's 11px row swatch. The band is a chart; the swatch is a bullet.
- **No `remainder` segment.** `toBand()` deliberately never emits one on real data, and
  `app/review/[sessionId]/page.tsx` renders none — the outcome screen is the same object as the
  review, at popup width, and must not invent a fifth kind the web app does not draw.
- **Away is painted here, as the hatch**, at 14px where a hatch can be seen — the invariant holds,
  and it is why §3.2 could fold away into the loop's remainder without losing it anywhere.
- Rendered only when there is at least one segment; a zero-event session shows the existing text
  and no empty strip.
- `data.topAttention` and `data.awaySeconds` come from the already-fetched
  `/api/sessions/:id/review` payload — **no second request, no new field, no server change.** The
  existing offline branch (`popup.js:572-580`) is untouched: no payload, no band.

---

## 8. Item A — the companion

No change proposed, per the brief. My own read of `extension/companion-overlay.js` found nothing
broken: the host element, Shadow DOM, 52px dot, hover pill, and the `chrome.storage.onChanged`
subscription are all intact, and the file is unchanged from the commit whose Playwright run passed.
The orphaned-content-script-after-reload explanation is consistent with the code being fine.

One thing worth noting only if the retest still fails: the overlay reacts to `session` /
`companionState` in `chrome.storage`, and `endSession()` sets both to `null`
(`sw.js:177`) — so an orphaned context that missed the write would show a stale dot rather than no
dot. "Nothing anywhere" points at injection, not state. Nothing to design.

---

## 9. The running screen's copy, after the merge

Two `.m-meta` lines exist today (`popup.js:479-481`): `${n} min elapsed` and
`${phase} — ${n} min left`. With duration merged into the cycle, "left in this cycle" and "left in
this session" are the same number for every mode except `until I stop`, so two lines say one thing.
Collapse to one, following Task 16 Step 4's shape:

| Session shape | Line |
|---|---|
| `plannedMinutes` set, work phase | `17 min · 13 min left` |
| `plannedMinutes` set, break phase | `17 min · break, 4 min left` |
| `until I stop` (`plannedMinutes == null`) | `17 min` |

A single read on popup open, from the values `cyclePhase()` already returns. Carry
`blocked.js`'s comment across so nobody helpfully adds a timer:

```js
// A single read, not a ticking clock — toolkit §9 refuses "a countdown that ticks".
```

`cyclePhase()` itself is unchanged and still needed, for the phase word and the remaining figure.
The `blocking: …` line stays as-is. **No legend is added to the loop**: on the running screen the
loop is a texture of where the time is going, not a chart to be read off — the artboard shows it
unlabelled too, and the outcome screen's rows are where the tints get named.

---

## 10. Verification

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs design/fixtures/popup-running.html \
                                                    design/fixtures/popup-idle.html
grep -rn "setInterval" extension/                 # must return nothing
grep -rn "#[0-9A-Fa-f]\{6\}" extension/popup.js   # must return nothing — no hex in a component
node --test test/tally.test.js
```

Then, loaded unpacked in a **new** tab:

1. Idle popup: three chips. `custom` reveals labelled inputs + two chips; the inputs show a text
   cursor, not a pointer. `no cycles` disables `break` and relabels `work` → `minutes`.
   `until I stop` leaves both enabled. Clicking a pressed level-2 chip returns to the inputs.
2. Start `25/5`. The loop's clay arc **begins at top-dead-centre** and runs right/clockwise. At
   t≈0 a ~5% clay arc is visible — the pill never looks bare.
3. Run across three domains, reopen the popup: three clay tints in descending order, 3px gaps, a
   solid `--m-edge` remainder, **no dashes anywhere**. Nothing animates; the figures do not move
   while the popup is open; closing and reopening updates them.
4. Go offline mid-session, reopen the popup: the loop is unchanged and correct. (This is the test
   the polling design would have failed.)
5. Stop. The outcome screen shows the 14px band between the intention and the rows, with away as a
   hatch, and the rows' swatch colours matching the band's segments left to right.
6. Both themes; `prefers-reduced-motion: reduce`.

---

## 11. Scope boundaries

Not touched, deliberately: the web app's navigation and pages; `app/review`, `app/dashboard`,
`app/page.tsx`; `lib/band.ts`; `app/globals.css`; `/api/sessions/[id]/review` and every other
endpoint; `design/tokens.css`; `extension/companion-overlay.js`; the block page; the 13-class
contract; `.m-row-bar[data-kind="remainder"]` in either stylesheet (§5).

Files this spec implies changes to:

| File | Change |
|---|---|
| `extension/lib/tally.js` | **new** — `withOpenSlice`, `toSegments` (§1) |
| `test/tally.test.js` | **new** — §1.4 |
| `extension/sw.js` | accumulate `session.tally` in `transition()` (§1.1) |
| `extension/popup.js` | the loop (§2-4), the picker (§6), the outcome band (§7), the copy (§9) |
| `extension/meant.css` | `[data-loop="on"]`, `[data-chip-role="number"]`, `[data-chip-layout="custom"]`, `.m-mark[data-band="session"]` |
| `design/canvas/PopupRunning.dc.html` | redraw: loop on the pill, no plan list, solid remainder (§0.2) |
| `design/canvas/PopupIdle.dc.html` | redraw: the two chip rows become one row plus a reveal |
| `design/fixtures/popup-running.html` | follow the artboard |
