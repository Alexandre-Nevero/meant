# UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the defects a two-assessment design critique found in the web app — starting with two that fabricate or destroy data, then the review's inverted peak-end, then the failure states that drop the user out of the visual world.

**Architecture:** This is **refinement, not redesign**. The visual identity, the verbal identity and the class contract all stay. Almost every fix below is a deletion, a guard, or restoring something an artboard already specifies — the largest new file is twelve lines. Where the artboards and the code disagree, **the artboards win** (`CLAUDE.md`).

**Tech Stack:** Next.js App Router (TypeScript), `app/globals.css`, `design/tokens.css`, artboards in `design/canvas/*.dc.html`.

## Provenance

Two isolated sub-agents, per the `impeccable` critique protocol: **Assessment A** (design review, source + live browser) and **Assessment B** (detector + mechanical evidence), synthesized here. Not a degraded run.

**One correction to the record.** An earlier note in this session reported the detector returning `[]` as evidence the mechanical floor was met. Assessment B sanity-checked it against a synthetic file containing `#ff0000`, 10px type and `transition: all 0.3s` and got `[]` again, then read the detector source: for non-full-page `.tsx` files most rules never execute. **`[]` meant the tool does not inspect these files.** Every mechanical claim below comes from grep, the browser, or a read of the source.

## Global Constraints

- **`design/tokens.css` is the contract. Never write a hex value in a component** (`CLAUDE.md`). Verified currently clean: zero hex in `app/**/*.tsx`.
- **The class contract is frozen at 13** (`docs/design.md` §5). No task below adds a class.
- **No total-hours figure, no percentage, no score, on any surface.** Counts are spelled as words.
- **`Yes` and `Not yet` stay byte-identical** in every visual property. The proof is structural: `grep -rn "m-answer\[data-answer" app extension` returns nothing, and must keep returning nothing.
- **Refuse list** (`docs/design-toolkit.md` §9): no score, no hours headline, no green for `Yes`, no streaks or badges or rings, no confetti, no second accent colour, no emoji as iconography, no ticking countdown.
- **Clay is banned as a text colour** at 3.74:1 (`docs/design.md` §3.1). Colour cannot carry an error state here — weight, position and announcement must.
- **Verify by rendering, not by building** (`CLAUDE.md`). A clean `tsc` is not evidence.
- **Never add AI attribution to a commit** (`GLOBAL.md`).

---

### Task 1: Stop the ledger drawing attention that was never recorded

**Severity: highest.** The daily surface invents data, and it invents it *confidently* — a session that recorded nothing renders a fuller band than one that recorded something.

**Verified mechanism:**
1. `lib/band.ts:29` — `toBand()` ends `.filter((s) => s.flex > 0)`, so a session with no events returns `[]`.
2. `app/dashboard/page.tsx:88` renders `<Band segments={[]} />`, a **childless** `.m-mark`.
3. `app/globals.css:52` — `.m-mark:empty[data-state="ended"]::after` paints the decorative brand glyph.
4. `app/globals.css:92` — `[data-surface="ledger"] .m-row .m-mark { width: 100% }`, **with no `:not(:empty)` guard**, stretches that glyph across the whole 180px column.

For a product whose landing page says *"It reads the page. It stores nothing."* and whose whole claim is that it already knows, drawing invented attention on the surface seen daily is the worst available bug.

**Files:**
- Modify: `lib/band.ts:29`
- Modify: `test/band.test.js`

**Interfaces:**
- `toBand()` keeps its signature. It returns `[{ kind: 'remainder', flex: 1 }]` instead of `[]` when nothing was recorded. `remainder` already exists for exactly this (`lib/band.ts:1-3`: *"it exists for static previews that need to show 'nothing recorded yet'"*) and already renders as the dashed empty strip. **No new class, no new colour, no CSS change.**

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/band.test.js
test('a session that recorded nothing renders the dashed remainder, not an empty band', () => {
  // An empty segment list produces a CHILDLESS .m-mark, which matches
  // .m-mark:empty[data-state="ended"]::after (globals.css:52) and paints the decorative
  // brand glyph — then [data-surface="ledger"] .m-row .m-mark (globals.css:92) stretches
  // it to the full column with no :not(:empty) guard. The result is a full, confident band
  // for a session with no data at all.
  const segments = toBand([])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].kind, 'remainder')
})

test('a session whose only rows are zero-length still renders the remainder', () => {
  const segments = toBand([{ kind: 'attention', domain: 'a.com', seconds: 0 }])
  assert.equal(segments[0].kind, 'remainder')
})

test('a session with real attention is unchanged', () => {
  const segments = toBand([{ kind: 'attention', domain: 'a.com', seconds: 60 }])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].kind, 'attention-1')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- test/band.test.js`
Expected: FAIL — `toBand([])` currently returns `[]`, so `segments.length` is 0.

- [ ] **Step 3: Implement**

In `lib/band.ts`, replace the final `return segments.filter((s) => s.flex > 0)` with:

```typescript
  const measured = segments.filter((s) => s.flex > 0)
  // Never return an empty list. A childless .m-mark matches the :empty decorative-glyph
  // rule (globals.css:52) and the ledger stretches it to the full column (globals.css:92),
  // so "we recorded nothing" would render as a full, confident band — more substantial
  // than a real one. `remainder` is the dashed empty strip and exists for exactly this.
  return measured.length > 0 ? measured : [{ kind: 'remainder', flex: 1 }]
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, including the existing band tests.

- [ ] **Step 5: Verify by rendering**

The dashboard needs a session with zero events. Seed one against the **test** database, then:

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <dashboard-url>
```
Expected: the zero-event row shows the dashed remainder strip, visibly *less* substantial than a recorded row. Look at it; a passing test does not prove this one.

- [ ] **Step 6: Commit**

```bash
git add lib/band.ts test/band.test.js
git commit -m "fix(ledger): stop drawing attention that was never recorded

toBand returned [] for a session with no events, which renders a childless
.m-mark. That matches the :empty decorative-glyph rule and the ledger stretches
it to the full column with no :not(:empty) guard, so a session that recorded
nothing drew a fuller band than one that recorded something.

Returns the dashed remainder instead. It already exists for exactly this case,
so no new class, colour or CSS."
```

---

### Task 2: Give the review's ending the standing the question had

**The peak-end is inverted.** `app/review/[sessionId]/page.tsx:83-88` renders the post-answer line as `.m-meta` — 13px, `--m-ink-3`, **3.20:1 contrast, the lightest style in the system**, identical in treatment to "2 blocked attempts".

The review is *the product* (PRD §3.3) and this is the **only place in the entire product where positive feedback is permitted** — everywhere else it is banned outright by I2. It currently renders in the disabled-text colour, at the bottom of the page, smaller than everything above it. The question is the largest type on the page; the answer to it is the smallest.

It also says "That's 3 of 5" in digits, while `toWords` is imported at line 7 and unused in that string. **"3 of 5" is one step from a rate**, and §3.1 bans rates.

**Files:**
- Modify: `app/review/[sessionId]/page.tsx:83-88`

- [ ] **Step 1: Read both branches and confirm they are treated identically**

Run: `sed -n '80,92p' "app/review/[sessionId]/page.tsx"`

Both the `yes` and the `not yet` branch must end at **exactly** the same size, weight and colour. If one reads as warmer than the other, invariant I1's spirit has leaked past the buttons into the copy — the buttons being byte-identical is not sufficient if the sentence after them is not.

- [ ] **Step 2: Promote both branches to prose scale**

Render the post-answer line at the review's prose scale in `--m-ink`, not `.m-meta`. Use an existing class — `.m-sentence` is the prose primitive and adding a class is forbidden.

Spell the counts: `{toWords(data.finished)} of {toWords(data.answered)}`, matching the dashboard.

- [ ] **Step 3: Verify the invariant still holds structurally**

```bash
grep -rn "m-answer\[data-answer" app extension
```
Expected: **no output.** `docs/design.md` §5 names this grep as the proof of invariant 2, every time the file changes.

- [ ] **Step 4: Verify by rendering, both branches**

Render a `yes` review and a `not yet` review at 1440 and 390. Screenshot both and put them side by side. Expected: the two endings are indistinguishable in weight, size and colour, and both are unmistakably more present than "2 blocked attempts".

- [ ] **Step 5: Commit**

```bash
git add "app/review/[sessionId]/page.tsx"
git commit -m "fix(review): give the ending the standing the question had

The one place positive feedback is permitted rendered in .m-meta - 13px,
--m-ink-3, 3.20:1, the same treatment as '2 blocked attempts'. The question was
the largest type on the page and the answer to it the smallest.

Counts are spelled now. 'That's 3 of 5' is one step from a rate, and 3.1 bans
rates. Both branches get identical treatment: byte-identical buttons do not hold
invariant 1 if the sentence after them reads warmer on one side."
```

---

### Task 3: Restore the review's spatial staging, which the artboard already specifies

`design/canvas/Main.dc.html:23,59` gives the review an **880px column** and puts the question and answers in their own container with **`margin-top: auto`** — the moment is staged at the end of the column with its own space.

`app/globals.css:98-105` ships a flat 1000px column with a uniform `gap: 24px`. So "Did you?" — the highest-stakes moment in the product — arrives 24px below a grey caveat sentence, in the same rhythm as everything above it, and the answer buttons stretch to roughly 420px each.

**The artboards outrank the CSS** (`CLAUDE.md`). The artboard staged the moment; the code lists it.

**Files:**
- Modify: `app/globals.css:98-105`
- Modify: `app/review/[sessionId]/answer.tsx:21` (the existing inline flex wrapper moves up to include the question)

- [ ] **Step 1: Read the artboard first, not the CSS**

Run: `sed -n '15,65p' design/canvas/Main.dc.html`
Take the column width, the container, and the `margin-top` from there. Do not invent spacing.

- [ ] **Step 2: Apply**

`[data-surface="review"] { max-width: 880px }`, and wrap `.m-rate` plus the answer row in the existing flex container at the end of the column with its own space. **No new class** — the wrapper already exists in `answer.tsx:21`.

- [ ] **Step 3: Verify by rendering against the artboard**

Open `design/canvas/Main.dc.html` and the rendered review side by side at 1440. Expected: the question sits apart from the rows above it, and the answer buttons are no longer stretched to ~420px.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css "app/review/[sessionId]/answer.tsx"
git commit -m "fix(review): stage the question instead of listing it

Main.dc.html gives the review an 880px column and puts the question and answers
in their own container with margin-top:auto. The CSS shipped a flat 1000px column
with a uniform 24px gap, so the highest-stakes moment in the product arrived in
the same rhythm as a grey caveat and the buttons stretched to ~420px.

The artboards outrank the CSS when they disagree."
```

---

### Task 4: Stop failure dropping the user out of the visual world

There is **no `error.tsx`, no `not-found.tsx` and no `global-error.tsx` anywhere under `app/`** — verified. `app/review/[sessionId]/page.tsx:24` calls `notFound()`, which lands on Next's stock black-on-white 404 in system fonts. A database failure on the dashboard does the same.

Separately, in-product errors are **indistinguishable from hints**: `app/auth-form.tsx:26,37` render a failed sign-in as `.m-meta` — the same grey as the word "or" — with no `role="alert"` and no `aria-describedby`. `docs/design.md` §10 already lists this as an open gap.

**Files:**
- Create: `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`
- Modify: `app/auth-form.tsx:26,37`

- [ ] **Step 1: Build the three files from existing primitives**

Each reuses `.m-empty` + `.m-mark data-state="empty"` + one line in the product's voice. **No new class, no new colour.** Keep the copy plain and non-apologetic — §9 refuses moralising, and that applies to the product's tone about itself too.

`error.tsx` and `global-error.tsx` are Client Components and take `{ error, reset }`; wire `reset` to a `.m-btn`. `global-error.tsx` must render its own `<html>` and `<body>` — it replaces the root layout.

- [ ] **Step 2: Promote error text and announce it**

In `app/auth-form.tsx`, error text moves to `--m-ink` and gains `role="alert"`, with `aria-describedby` linking it to the input. **Colour cannot carry this** — clay is banned as a text colour at 3.74:1 — so weight, position and announcement must. That constraint produces the better result anyway: a screen-reader user gets told, which a colour change never does.

- [ ] **Step 3: Verify by rendering each state**

Visit a bad session id, force a thrown error, and submit a failed sign-in. Expected: all three stay inside the visual world, and the sign-in error is announced and visibly not a hint.

- [ ] **Step 4: Commit**

```bash
git add app/not-found.tsx app/error.tsx app/global-error.tsx app/auth-form.tsx
git commit -m "feat(web): keep failure inside the visual world

No error.tsx, not-found.tsx or global-error.tsx existed, so a bad session id
dropped the user onto Next's stock 404 in system fonts. In-product errors were
styled .m-meta - the same grey as the word 'or' - with no role=alert.

Colour cannot carry an error here: clay is banned as a text colour at 3.74:1. So
weight, position and announcement carry it, which tells a screen-reader user
something a colour change never would."
```

---

### Task 5: Stop the review silently losing the outcome answer

`app/review/[sessionId]/answer.tsx:12-17` PATCHes the outcome and **never checks `res.ok`**. On failure both buttons are left permanently disabled, with no message and no retry. The user answered; nothing was recorded; the interface shows neither.

This is the single most important write in the product — `session.outcome` is the column the entire ledger accumulates, and ADR-0051 makes it the coach's primary input.

**Files:**
- Modify: `app/review/[sessionId]/answer.tsx:12-17`

- [ ] **Step 1: Check the response and keep the buttons usable on failure**

Re-enable both buttons, surface one plain line with `role="alert"` in `--m-ink`, and let the user tap again. The retry must be the same two buttons — introducing a third control here would break the two-option symmetry that invariant I1 protects.

- [ ] **Step 2: Verify by rendering**

Throttle the network to offline, answer, and watch. Expected: a visible, announced failure; both buttons live; a second tap succeeds once back online.

- [ ] **Step 3: Commit**

```bash
git add "app/review/[sessionId]/answer.tsx"
git commit -m "fix(review): stop silently losing the outcome answer

The PATCH never checked res.ok. A failed write left both buttons permanently
disabled with no message and no retry - the user answered, nothing was recorded,
and the interface showed neither.

session.outcome is the column the whole ledger accumulates and the coach's
primary input. Retry is the same two buttons; a third control here would break
the symmetry invariant 1 protects."
```

---

### Task 6: The motion the docs claim and the code does not have

`docs/design.md` §6 calls the review *"the one page with an **authored** motion moment (staggered rise, 50ms steps)"*. `docs/design-toolkit.md` §6 specifies it. `design/canvas/Main.dc.html:14-20,25-59` implements it with 0/60/120/180…500ms delays.

**`.m-rise` is defined at `app/globals.css:596-605` and used nowhere** — verified across `app` and `extension` by both assessments. The shipped review has zero motion. The codebase currently claims a moment it does not have.

Either wire it or amend both docs. **The artboard wins**, so wire it.

**Files:**
- Modify: `app/review/[sessionId]/page.tsx`
- Verify: `app/globals.css:596-605` (`.m-rise` and its reduced-motion branch at `:603`)

- [ ] **Step 1: Read the artboard's stagger and copy its timings**

Run: `sed -n '14,60p' design/canvas/Main.dc.html`
Take the delays from there rather than inventing them.

- [ ] **Step 2: Apply `.m-rise` to the review's rows in document order**

- [ ] **Step 3: Check it against the motion rules before accepting it**

The review is seen **once per session** — Emil's frequency table puts that in "occasional", where a standard animation is appropriate. Entering elements take **ease-out**, never ease-in. Total stagger must stay under ~500ms or the page feels like it is assembling itself while the user waits.

Confirm `app/globals.css:603` already zeroes it under `prefers-reduced-motion`. **A staggered entrance with no reduced-motion branch is a vestibular trigger**, and this one is on the product's most important page.

- [ ] **Step 4: Verify by rendering, twice**

Once normally, once with reduced motion forced. Expected: a calm staggered entrance; with reduced motion, everything present immediately and nothing moving.

- [ ] **Step 5: Commit**

```bash
git add "app/review/[sessionId]/page.tsx"
git commit -m "feat(review): wire the authored motion moment the docs already claim

design.md 6 calls the review 'the one page with an authored motion moment' and
the toolkit specifies it; Main.dc.html implements it with 0-500ms delays. .m-rise
was defined in globals.css and used nowhere, so the shipped review had no motion
and the docs described something that did not exist.

Timings come from the artboard rather than being invented. The reduced-motion
branch already existed and is verified, not assumed - a staggered entrance
without one is a vestibular trigger, on the product's most important page."
```

---

### Task 7: Accessibility floor — labels, landmarks, metadata

Measured, not estimated, across `app/**/*.tsx`: **`<label>` = 0. `alt=` = 0. `aria-*` = 3 in the entire app. `<main>` = 0. `<nav>` = 0.**

- **Sign-in has five inputs and no labels.** Two of them share the placeholder "Email" and there are no headings to say which form is which. Placeholder contrast is **3.20:1 at 15px**, under the 4.5:1 floor. Placeholder-as-label is a named anti-pattern: the label disappears exactly when the user is typing and needs it.
- **No landmarks anywhere**, so there is no skip target and no structural navigation.
- **`app/layout.tsx:21-23` sets `title: 'meant'` and nothing else.** No description, no OG tags, no `metadataBase`. A shared link previews as the word "meant" and a bare URL — on a product whose landing page is its only persuasion surface.

**Files:**
- Modify: `app/auth-form.tsx`, `app/setup/page.tsx`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Real labels on every input**

A visible `<label>` where the design allows, `aria-label` where it does not. On setup the question already exists as a sibling `<p className="m-sentence">` (`:35`) — connect it with `aria-labelledby` rather than duplicating the text.

- [ ] **Step 2: Landmarks**

`<main>` on each page's root; `<nav>` on the landing header (`app/page.tsx:58`). *(Note: `m-landing-header` is used there and **defined nowhere** in `globals.css` — resolve that in the same pass.)*

- [ ] **Step 3: Metadata**

Description, OG and Twitter tags, `metadataBase`, and a per-surface title. The copy must come from the landing's existing prose — it is the strongest writing in the product; do not invent a new value proposition here.

- [ ] **Step 4: Verify**

```bash
grep -rn "<main\|<nav" app --include=*.tsx
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <landing-url>
```
Then tab through sign-in with a screen reader and confirm each field announces distinctly.

- [ ] **Step 5: Commit**

```bash
git add app/auth-form.tsx app/setup/page.tsx app/layout.tsx app/page.tsx
git commit -m "fix(a11y): labels, landmarks and metadata

Measured across app/**/*.tsx: zero <label>, zero <main>, zero <nav>, three aria-*
attributes total. Sign-in had five unlabelled inputs, two sharing the placeholder
'Email', at 3.20:1 placeholder contrast - and a placeholder disappears exactly
when the user is typing and needs it.

layout.tsx set title:'meant' and nothing else, so a shared link previewed as one
word and a bare URL. Description copy is taken from the landing's existing prose
rather than invented."
```

---

## Deliberately not in this plan

**Three findings are decisions, not defects, and belong to the owner:**

1. **Dark mode was inherited, not chosen.** `design/tokens.css:54-68` applies a dark palette from `prefers-color-scheme` with no `data-theme` anywhere. `docs/design-toolkit.md` §9 refuses *"dark mode as the default look"* and `docs/design.md` §3.1 says *"nothing renders dark by default"* — both false for any user on a dark OS, which is a large share of this audience. The dark rendering holds up. But it arrived by inheritance rather than decision, and it is near-black, the exact Rize anti-reference.
2. **The landing hero asks for nothing.** `Landing.dc.html:49,53-55` puts the mechanism paragraph, a primary "Add to Chrome", and "Chrome and Edge. No installer, no admin rights." in the hero. What ships is typer + headline + a seven-word lede and **no CTA** — `globals.css:441` styles `.m-landing-hero > .m-landing-auth` for a button that is never rendered. Priority is also inverted: "Add to Chrome" ships `data-variant="quiet"` pointing at a GitHub readme while "Sign in" takes the primary fill. **A visitor to a browser-extension product is asked to create an account before they have the thing.** Restoring the artboard is a content decision.
3. **The class contract says 13 and the code ships 15** — `.m-chip` and `.m-chip-row` are not in the frozen set. Either they earned their place and §5 is stale, or they are a violation. One honest line in §5 beats the three separate carve-out comments that exist now.

**Two findings are already-reasoned positions and must not be "fixed":**

- **Touch targets.** `docs/design.md` §8 rejects the 44px mobile floor with a stated rationale — every surface is desktop web or a desktop Chrome popup, so WCAG 2.5.8's **24px** applies. `.m-chip` at ~32px clears it, and the doc explicitly warns against inflating the popup's chips.
- **Focus rings.** `.m-btn`, `.m-answer` and `.m-chip` fall through to the browser default — documented as *"present and visible, just not yet styled to match the palette. Worth a deliberate pass, not an accidental one."* That pass is worth scheduling; it is not a defect to patch mid-task.

**Already filed separately:** #42, the setup page's data-loss path.

## Self-review checklist

- [ ] No task adds a CSS class — the contract is frozen at 13
- [ ] No task introduces a hex value
- [ ] Tasks 2 and 5 preserve `Yes`/`Not yet` symmetry in copy as well as in CSS
- [ ] Every UI task ends in a **render** check, not a build check
- [ ] Task 6 confirms the reduced-motion branch rather than assuming it
- [ ] Tasks 1, 2 and 3 take their values from the artboard, not from invention
- [ ] No commit message contains AI attribution
