# design.md — MEANT

**What this file is:** the single-page entry point to MEANT's design system — where things
live, what's already decided, what's verified, and what's still a gap. It does not replace
any canonical source; it indexes and cross-checks them, and adds one thing none of them
cover: accessibility, verified against this codebase rather than asserted.

**What this file is not:** a second spec. Every color, radius, and duration below is quoted
from [`design/tokens.css`](design/tokens.css), not reinvented. Where this file and a
canonical source could ever disagree, the source wins — see the hierarchy below.

---

## 1. Hierarchy of truth

Highest to lowest. Never resolve a conflict by picking whichever is more convenient — say
which one you followed and why (`docs/dead-ends.md` has running examples).

1. **[`design/canvas/*.dc.html`](design/canvas)** — the seven artboards. Visual truth.
   Outranks every document, including this one.
2. **[`design/tokens.css`](design/tokens.css)** — every color, radius, stroke, duration,
   lifted from the artboards.
3. **[`docs/design-toolkit.md`](docs/design-toolkit.md)** — the written spec: the mark, the
   companion, verbal identity, the class contract, what to refuse, how it's judged.
4. **This file** — an index over the three above, plus verified accessibility guidance
   sourced from `ui-ux-pro-max` and cross-checked against the actual, built CSS.
5. **[`CLAUDE.md`](CLAUDE.md)** — the six invariants that are design decisions, restated
   below in §7 because they're the ones most worth not forgetting mid-task.

`docs/metaprompt-design.md` and `docs/metaprompt-build*.md` describe the superseded 0.1
build (no AI, corporate persona, four-hour clock) and are excluded from this hierarchy —
don't design from them.

---

## 2. Product design philosophy

*(PRODUCT.md, `docs/design-toolkit.md` §1)*

Warm cream paper, exact geometry, one colored family that means something. Plainspoken,
warm, exact — someone who knows you and is not managing you.

**Anti-references:** Rize (near-black, purple gradient, team surveillance), any Pomodoro
dial, progress rings, streak flames, green-means-good.

The product measures completed outcomes, never hours. Every design decision that could
turn attention into a scored, gamified metric is wrong by construction — see §7.

---

## 3. Foundations

### 3.1 Color — and whether it actually holds up

Every value below is `design/tokens.css`, quoted, not approximated. Never write a hex value
in a component — if a color is missing here, it belongs in `tokens.css` first.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--m-ground` / `--m-ground-sunk` | `#F3F1EE` / `#E9E6E2` | `#14120F` / `#0D0C0A` | Surface / the canvas behind a panel |
| `--m-ink` / `-2` / `-3` | `#14120F` / `#57534E` / `#8B8681` | `#F3F1EE` / `#B8B3AD` / `#8B8681` | Primary / prose / labels |
| `--m-rule` / `--m-edge` | `#E2DFDB` / `#C7C2BB` | `#2A2724` / `#3D3935` | Row rules / unselected chip borders |
| `--m-clay` / `-2` / `-3` | `#C75B39` / `#D68A6E` / `#E2B29E` | `#E06B44` / `#C0765C` / `#96604D` | Attention, ordered by time |

**Verified against WCAG, this session** (relative-luminance contrast, not eyeballed):

| Pair | Ratio | Verdict |
|---|---|---|
| `--m-ink` on `--m-ground` | 16.58:1 | Passes AA body text (≥4.5:1) with room to spare |
| `--m-ink-2` on `--m-ground` | 6.77:1 | Passes AA body text |
| `--m-ink-3` on `--m-ground` (light) | **3.20:1** | **Fails AA body text.** Clears the 3:1 floor for large text (≥18.66px, or ≥14px bold) and for non-text UI boundaries — but `.m-meta` ships at 13px, below that. Inherited from the committed visual world (the artboards draw labels this light on purpose); flagged here, not silently fixed. Keep `.m-meta` to short labels, never body copy, until this gets a real design call |
| `--m-ink-3` on `--m-ground` (**dark**) | **5.19:1** | Passes AA body text — dark mode is *more* accessible here than light, which is easy to miss since nothing renders dark by default |
| `--m-ink-3` on `--m-ground-sunk` (light) | 2.90:1 | Fails even the 3:1 UI-component floor. Don't put `.m-meta` on a sunk panel in light mode without re-checking |
| `--m-clay` on `--m-ground` | 3.74:1 | Fine for the band/swatches (non-text); would fail as body text — never set `--m-clay` as a text `color` |
| `--m-clay-2`, `--m-clay-3` on `--m-ground` | 2.41:1, 1.68:1 | Fail outright. These exist for fills only (the 2nd/3rd band segment), never text, never an icon stroke |

**The rule that follows from this table:** clay tints are backgrounds, never foregrounds.
`--m-ink-3` is for short labels at small size, never a paragraph.

### 3.2 Typography

| Face | Use | File |
|---|---|---|
| **Fraunces** | The user's own words, and display. `next/font` on web; `extension/fonts/fraunces.woff2` (static, weight 400 only) on the extension | `--m-display` |
| **Public Sans** | Everything else | `--m-body` |
| **Sometype Mono** | Figures, durations, counts, codes — `font-variant-numeric: tabular-nums` always | `--m-figure` |

Tracking `-0.02em` throughout, `-0.03em` at 44px and up (`--m-tracking`, `--m-tracking-tight`).
Google-hosted on web via `next/font` (self-hosted, no runtime request); local `.woff2` files
on the extension, because MV3's CSP cannot load a remote stylesheet at all.

`--m-display`/`--m-body`/`--m-figure` are redefined in `app/globals.css` *after* the
`tokens.css` import, to `var(--font-fraunces, Georgia, serif)`-style declarations — the
fallback lives **inside** the `var()` call. Writing the comma outside it (`var(--x), y, z`)
made a real bug during this build: an unresolved variable invalidates the whole property,
not just that one alternative, so every static context without `next/font`'s injection
rendered in the browser default with no visible error. See `docs/dead-ends.md`.

### 3.3 Shape and motion

Capsules, not cards — radius scales with the element (`--m-r-chip` 999px through
`--m-r-block` 56px), never a flat 8px everywhere. One easing curve,
`cubic-bezier(0.23, 1, 0.32, 1)` — a strong ease-out, never `ease-in`, never `transition:
all`. Full table in `docs/design-toolkit.md` §6; the popup gets none of it — see §6 below.

---

## 4. The mark and the companion

Full spec: `docs/design-toolkit.md` §2–3. The load-bearing fact for anyone editing
`.m-mark`: it does two visibly different jobs from one class, chosen by whether it has
children, not by a flag.

- **`.m-mark:empty`** — a small decorative brand glyph (~34×16px), drawn entirely in CSS via
  a hard-stop gradient `::after` mimicking the three-tint band. Every real call site that
  uses it (the dashboard's empty state, the review page's header glyph, the popup's idle and
  running icons) renders it self-closing, no children, ever. The block page has no mark at
  all — `BlockPage.dc.html` draws only the outline holding the sentence, nothing else, so
  `extension/blocked.js` doesn't render one either.
- **`.m-mark:not(:empty)`** — the real, data-proportional attention band. Its children reuse
  `.m-row-bar[data-kind]` (the same primitive as a per-row swatch and a plan step marker),
  sized via inline `style={{ flex }}`, never a hardcoded width.

**The companion is Orbit, not the gaze/capsule design above** — reversed 2026-09-05, after
this design system had already committed to the three-node gaze/capsule split. `PRODUCT.md`'s
companion section and `docs/prd-intent.md` §3.2 are current; `docs/dead-ends.md` records why.
The three-node table above described `extension/sidepanel.js` and a `chrome.sidePanel`
surface — **both retired.** The shipped companion is `extension/companion-overlay.js`, a
self-contained Shadow DOM injected at `<all_urls>` as a content script (not a side panel, not
built from `.m-mark`'s primitives): a 28px orbital dot, ring presence/style (never hue) tells
state, one 0.6s return-pulse plays on drift-to-focus, continuous ~1.6s breathe. Same
invariants as before, still structural not aspirational: never varies with the outcome
answer, never celebrates, never moves in the first 60 seconds, capped at 3 turn-aways per
25-minute window (`extension/sw.js#updateCompanion`).

---

## 5. The class contract

Fixed at 13 classes (`docs/design-toolkit.md` §8). Never add a 14th without checking
whether an existing class already does the job by context — `.m-row-bar` alone covers a
ledger-row swatch, a plan-step marker, *and* a band segment, differentiated only by its
`data-kind` and which ancestor it's rendered inside.

```
.m-app  .m-mark[data-state]  .m-sentence  .m-meta  .m-field  .m-btn[data-variant]
.m-answer  .m-row  .m-row-domain  .m-row-bar[data-kind]  .m-row-figure  .m-rate  .m-empty
```

`data-state` on `.m-mark`: `idle | running | drifting | ended | empty`.
`data-kind` on `.m-row-bar`: `attention-1 | attention-2 | attention-3 | away | remainder |
step-done | step-open`.

**`.m-answer` carries no `[data-answer]` selector, anywhere, on purpose.** Invariant 2 (Yes
and Not yet are byte-identical) is enforced by the CSS file's structure, not by convention —
`grep -rn "m-answer\[data-answer" app extension` returning nothing *is* the proof, every
time this file changes.

---

## 6. Surfaces reference

Every surface reads the same 13 classes at a different scale, keyed by one attribute:
`data-surface`. On the web app it sits on a wrapper inside the page (Next.js owns
`<body>` from the root layout, so a leaf page can't set an attribute on it); on the
extension, where there's no such constraint, it sits directly on `<body>`.

| `data-surface` | Where | Real width | Ticks? | Notes |
|---|---|---|---|---|
| `landing` | `app/page.tsx` | 1440 desktop fold | — | Marketing layout classes (`.m-landing-*`) are structural only, not part of the 13-class contract |
| `review` | `app/review/[id]/page.tsx` | 880px column | — | The one page with an *authored* motion moment (staggered rise, 50ms steps) |
| `ledger` | `app/dashboard/page.tsx` | 1000px column | — | Each row's band is real per-session data via `lib/band.ts`, not decoration |
| `pair` | `app/pair/page.tsx` | centered, 320px card | **No** — single scheduled `setTimeout` flips to "expired," not a countdown | |
| `popup` | `extension/popup.html` | fixed 360px | **No**, anywhere, ever | Opened dozens of times a day — see §7 |
| `block` | `extension/blocked.html` | full page | **No** | Static "N minutes left," read once |
| `companion` | `extension/companion-overlay.js` (Shadow DOM, injected at `<all_urls>`) | 28px, floats over the page | Aliveness only (breathe); ring flips ≤3×/25min | Retired the side panel and `.m-mark`'s primitives entirely — see §4's Orbit note |

---

## 7. Invariants — breaking one is a bug, not a refactor

*(`CLAUDE.md`, `docs/design-toolkit.md` §9–10, PRD §3.1)*

1. `Yes` and `Not yet` are identical in color, weight, size, and motion — structural (§5).
2. No total-hours figure, no percentage, no score, on any surface.
3. The popup animates nothing — not even a button press. `[data-surface="popup"] .m-btn {
   transition: none; }` overrides the shared press-scale rule that every other surface gets.
4. Nothing good happens on screen during a session. A return from drift turns the companion
   back silently; it's recorded and shown only in the review.
5. The companion's appearance never varies with the outcome answer.
6. Away is a hatch (`--m-away`, a `repeating-linear-gradient`), never a solid gray — a hatch
   says *unmeasured*, a gray says *another site*.

---

## 8. Accessibility — verified, not assumed

Sourced from `ui-ux-pro-max` (`--domain ux`, `--domain icons`) and cross-checked against
what's actually built. This is the section no other doc in this project covers, so it gets
the most detail. It supplements the visual contract; it never overrides it — an
accessibility fix that requires a hex value or a new visual language goes back to
`design/tokens.css` first, not straight into a component.

### Forms (the pairing code, sign-in, the popup's chip groups)

- **Error placement is inline, not summary-only.** WCAG wants each invalid field's error
  connected to it via `aria-describedby`, in addition to (not instead of) any top-level
  summary. `app/auth-form.tsx`'s per-form error paragraph is a good start; it isn't yet wired
  to the input via `aria-describedby` — a real gap, not a style choice, worth closing before
  this form sees a non-technical user who hits a wrong password.
- **Errors must be announced, not just colored.** `role="alert"` or `aria-live="polite"` on
  the error paragraph, so a screen reader user learns a submission failed without having to
  go looking. Currently absent on `AuthForm`'s error `<p>` — same gap as above, same fix.
- **The chip groups in `extension/popup.js`** (duration, blocklist) are `<button
  aria-pressed="...">` rows acting as a single-select toggle group — the right ARIA pattern
  for this shape (not native radios, which would need a fieldset/legend and change the visual
  language). Confirm the group is still operable by keyboard: each chip is a real `<button>`,
  so Tab/Enter/Space work by default; nothing in the CSS sets `outline: none`, so the
  browser's focus ring survives. Verify this by hand before shipping this doc's claim any
  further than "should work."

### Motion

- `prefers-reduced-motion: reduce` is handled in three places, deliberately not one:
  `tokens.css` zeroes the duration variables (`--m-dur-*`), `app/globals.css` and
  `extension/meant.css` each additionally kill `animation` outright (a zeroed CSS variable
  doesn't reach a keyframe's `animation-duration` the way it reaches a `transition`'s).
- Reduced motion means *fewer and gentler*, not *zero* — the companion's breathe/blink stay
  off entirely under the media query (they're sub-perceptual by design, not information), but
  an opacity-only crossfade would be fine to keep if one ever gets added here.
- The companion's own motion budget (≤3 turn-aways/25min, none in the first 60s) is itself an
  accessibility control, not just a brand decision — arousal from being watched is the risk
  this audience's work is most sensitive to (apexhuman.md, PRD invariant I2's citations).

### Icons

MEANT has exactly one icon system: the mark, drawn in CSS, never SVG-per-instance except the
single `design/mark.svg` (header logo → favicon → extension icons). There is no icon library
in this project and none should be added for the product's own chrome — a Phosphor/Heroicons
import would introduce a second visual language the toolkit explicitly refuses (`docs/design-
toolkit.md` §9: "emoji as iconography" is banned; a mismatched icon *library* is the same
mistake in a different font). If a genuine utility icon is ever needed (e.g. an external-link
glyph on the landing page's footer link), the `ui-ux-pro-max` icon-accessibility rule still
applies: decorative next to visible text → `aria-hidden="true"`; meaningful with no visible
label → a real text alternative.

### Touch and click targets

The 44×44pt / 48×48dp minimum is a **mobile app** guideline and doesn't apply here — every
MEANT surface is either a desktop web page or a desktop-Chrome extension popup/panel; the
right floor is the **web** one (24 CSS px minimum, WCAG 2.5.8, with exceptions for inline
text links). `.m-chip` (`padding: 8px 14px` at 13px type) renders at roughly 32px tall —
clears the web floor, would not clear the mobile one. Don't "fix" this by inflating the
popup's chips to 44px; that would break the 360px popup's own layout and isn't the standard
that applies to it.

### Keyboard focus

Nothing in `app/globals.css` or `extension/meant.css` removes the focus ring — verified by
grep, not assumed:

```bash
grep -rn "outline:\s*none\|outline:\s*0" app/globals.css extension/meant.css
# (no output — neither file ever disables the outline)
```

Separately, `.m-field:focus-visible` *adds* an explicit clay ring
(`outline: var(--m-stroke) solid var(--m-clay); outline-offset: 2px;`). Every button
(`.m-btn`, `.m-answer`, `.m-chip`) falls through to the browser's own default focus ring
instead — present and visible, just not yet styled to match the palette. Worth a deliberate
pass, not an accidental one.

---

## 9. Refuse

*(`docs/design-toolkit.md` §9, plus the `impeccable` craft floor's generic defaults that
apply here)* — a productivity score of any kind, a total-hours headline anywhere, green for
`Yes`, streaks/badges/flames/rings, a Pomodoro dial, confetti, a second accent color, a card
with a left-border accent, emoji as iconography, a chat input on any surface during a
session, gradients on the band, a countdown that ticks, a kicker/eyebrow above a heading, a
system font standing in for Fraunces because the real one "looks close enough."

---

## 10. Open gaps (say them, don't bury them)

Things this pass found and didn't fix, because fixing them wasn't in scope — tracked here so
they don't quietly disappear:

- `--m-ink-3` at 13px fails AA body-text contrast in light mode (§3.1). Inherited from the
  artboards; needs a real design decision (size up, or accept it's label-only forever), not a
  silent size bump in the next PR.
- `AuthForm`'s error messages aren't wired to their fields via `aria-describedby`, and aren't
  announced via `role="alert"` (§8). Small, mechanical, not yet done.
- Button focus rings are the unstyled browser default everywhere except `.m-field` (§8). Not
  broken — just not designed.
- The companion's disclosure copy ("it reads the site name…") is honest about today's
  mechanism — `sw.js#updateCompanion` checks the tab's hostname against known distraction
  categories, nothing more. `docs/index.md` D25 records that this heuristic stands in for the
  judge; when the judge ships and starts reading page content under I7, this exact copy needs
  rewriting to match the new, larger truth — not just the logic behind it.
