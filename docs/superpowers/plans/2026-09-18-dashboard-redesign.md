# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard on Rize's 2022 layout grammar, with quantitative figures (hours, counts, shares) sitting beside the existing word headline, after the owner picks one of five rendered mockups.

**Architecture:** Two gated phases. Phase 1 produces five self-contained HTML artboards under `design/canvas/explore/`, renders each to PNG, and stops for the owner to choose. Phase 2 removes the invariant lines that block the chosen direction, promotes the winner to a real `design/canvas/Ledger.dc.html` artboard, adds the aggregate query layer as pure functions in `lib/`, and rebuilds `app/dashboard/page.tsx` against it. No database migration is needed: every figure in this plan is computable from columns that already exist.

**Tech Stack:** Next.js App Router server components, `@neondatabase/serverless` via `lib/db.ts`, plain CSS custom properties in `design/tokens.css` and `app/globals.css`, Node's built-in test runner (`node --test`), Playwright for e2e.

## Global Constraints

- Phase 2 does not start until the owner names a winning mockup. That gate is the point of this plan.
- Every colour comes from `design/tokens.css`. No hex literal in any component or artboard that ships. Explore artboards in Phase 1 may inline values because they are disposable.
- Cream `--m-ground: #F3F1EE` stays the product ground unless the owner picks M3. Mockup M3 is the only artboard permitted to render dark, and only as a test of the anti-reference.
- Figures render in `--m-figure` (Sometype Mono) with `font-variant-numeric: tabular-nums`. Prose stays Public Sans, headlines stay Fraunces.
- No new database migration. Everything below reads `session`, `event`, and `event.label` as they exist after `005-local-hour.sql`.
- `toWords` (`lib/words.ts`) is kept, not deleted. The word headline stays and gains a numeric line beneath it.
- Away renders as the `--m-away` hatch wherever it appears. This survives the redesign.
- Run `npm run migrate` before any dashboard work; the dev server 500s on `started_at_local_hour` otherwise.

## What is being removed, exactly

These are the lines that block a Rize-grammar dashboard. Phase 2 Task 1 edits every one of them. Nothing else in the invariant set is touched.

| File | Line | Current text | Why it blocks |
|---|---|---|---|
| `CLAUDE.md` | 20 | No total-hours figure, no percentage, no score, on any surface. | Bans the hero figure and every share |
| `docs/design.md` | 226 | invariant 2, same sentence | Same |
| `docs/design.md` | 50 | The product measures completed outcomes, never hours. | Same |
| `docs/design.md` | 326 | §9 Refuse: a productivity score of any kind, a total-hours headline anywhere | Same |
| `docs/design.md` | 48 | anti-references list: progress rings | Blocks donuts (M2, M3, M5 only) |
| `docs/design-toolkit.md` | 188 | §9 Refuse, same list plus `a progress ring` | Same |
| `docs/design-toolkit.md` | 196 | §10 acceptance checkbox | Same |
| `AGENTS.md` | 99 | No total-hours figure, no percentage, no score, anywhere. | Same |
| `docs/prd-intent.md` | 319 | acceptance criterion asserting no total-hours figure on the dashboard | Would fail on the new surface |
| `docs/build.md` | 274 | Counts, spelled as words / hours are the metric this product demotes | Same |
| `PRODUCT.md` | 200 | Reward hours. Show a productivity score. | Same |

**The one with a real price:** `app/page.tsx:119` renders the landing headline **"No total hours. Anywhere."**, with supporting copy at `:121-124` ("It is never a headline, never a streak, never a score"). The same words are in `design/canvas/Landing.dc.html:92` and `design/fixtures/landing.html:47`. Shipping hours on the dashboard makes the acquisition page contradict the product. `PRODUCT.md:191` reduces the entire difference from Rize to one clause: *hours are its headline*. Phase 2 Task 2 rewrites the landing section; the replacement copy is a decision the owner makes, not a detail an implementer fills in.

**Not removed, because they do not block anything here:** I1 (`Yes`/`Not yet` identical), I3 (no valence), I4, I5, I7, I8, I9, the popup animating nothing, no celebration during a session, away-as-hatch. I6's evidence floor survives as written, because it gates inference and every figure added here is description (ADR-0050).

**Decided during the shotgun, not before:** ADR-0066's one-claim rule. A Rize panel grid of *descriptive* stats leaves it intact. A grid of *claims about the user*, which is what Rize's "Focus score by time of day" panel is, supersedes it. M2 keeps one inference sentence; M5 breaks the rule on purpose. Picking between them settles it.

## File structure

**Phase 1, all disposable:**
- `design/canvas/explore/fixture.js` — one shared dataset, so the five artboards are comparable
- `design/canvas/explore/m1-ledger-amplified.html` through `m5-instrument-panel.html` — self-contained, no build, no `support.js`
- `design/canvas/explore/index.html` — the five in one scrollable comparison board

**Phase 2, shipped:**
- `design/canvas/Ledger.dc.html` — replaced by the winner. The canvas is rank 1 in `docs/design.md` §1; if the code ships something the artboard does not show, the hierarchy of truth breaks again
- `design/tokens.css` — only if the winner needs a token that does not exist
- `app/globals.css` — the new surface classes
- `lib/dashboard-figures.ts` — new, pure, all aggregation shaping
- `test/dashboard-figures.test.js` — new
- `app/dashboard/page.tsx` — rewritten against the above
- `e2e/dashboard.spec.ts` — extended
- `docs/adr/ADR-0068-*.md` and the eleven doc lines above — reconciliation, so the next session does not revert this against the invariants

---

## Phase 1 — Shotgun (five mockups, then STOP)

### Task 1: The shared fixture

**Files:**
- Create: `design/canvas/explore/fixture.js`

**Interfaces:**
- Produces: a global `FIXTURE` object consumed by all five artboards. Field names below are what Tasks 2 through 6 reference verbatim.

The numbers are invented for the mockup but every one maps to a real query, listed in the comment beside it. Nothing here needs a column that does not exist.

- [ ] **Step 1: Write the fixture**

```js
// design/canvas/explore/fixture.js
// One dataset, five artboards, so the comparison is about layout and not about data.
// Every field names the query that would produce it in Phase 2.
window.FIXTURE = {
  period: { label: 'September 2026', granularity: 'month' },

  // count(*) filter (where outcome=...) from session where started_at >= date_trunc('month', now())
  sessions: 23, finished: 14, notYet: 5, unanswered: 4,

  // sum(event.seconds) group by kind, joined to session on the period
  attentionSeconds: 148800,   // 41 hr 20 min
  awaySeconds: 22320,         // 6 hr 12 min
  breakSeconds: 7500,         // 2 hr 05 min
  unrecordedSeconds: 9180,    // lib/session-time.ts computeUnrecorded, summed

  // the same three, one month back, for the change row
  prev: { attentionSeconds: 129720, sessions: 19, finished: 11 },

  // count(*) from event where kind='block_hit'
  blockHits: 31,

  // sum(seconds) group by domain where kind='attention', joined to event.label (ADR-0062)
  domains: [
    { domain: 'docs.google.com',        seconds: 33120, label: 'work'     },
    { domain: 'claude.ai',              seconds: 27660, label: 'work'     },
    { domain: 'github.com',             seconds: 18180, label: 'work'     },
    { domain: 'figma.com',              seconds: 12480, label: 'work'     },
    { domain: 'mail.google.com',        seconds:  8100, label: 'neutral'  },
    { domain: 'twitter.com',            seconds:  6240, label: 'distract' },
    { domain: 'news.ycombinator.com',   seconds:  3720, label: 'distract' },
    { domain: 'linear.app',             seconds:  3060, label: 'work'     },
    { domain: 'youtube.com',            seconds:  2400, label: 'distract' },
    { domain: 'stackoverflow.com',      seconds:  1860, label: 'unknown'  },
  ],

  // sum(seconds) group by date(started_at), split by event.label. 30 entries, index 0 = Sep 1.
  // [work, neutral, distract, away] seconds per day. Zeros are weekends and are meant to be there.
  days: [
    [12600,1800,1200,2400],[14400,900,2700,1800],[9000,1200,600,1500],[0,0,0,0],[0,0,0,0],
    [16200,1500,900,2100],[13500,2100,1800,2700],[10800,900,3600,1200],[15300,1200,600,1800],[7200,600,1200,900],
    [0,0,0,0],[0,0,0,0],[14400,1800,900,2400],[12600,900,2400,1500],[16200,1200,600,3000],
    [9900,1500,1800,1200],[11700,600,900,2100],[0,0,0,0],[0,0,0,0],[13500,1200,1500,1800],
    [15300,900,600,2400],[10800,1800,2100,1500],[12600,1200,900,2700],[8100,600,1800,900],[0,0,0,0],
    [0,0,0,0],[14400,1500,1200,2100],[16200,900,600,1800],[11700,1200,2400,1500],[9000,600,900,1200],
  ],

  // count(*) group by started_at_local_hour (ADR-0067), finished vs not. 24 entries, index = hour.
  byHour: [
    [0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[1,0],[2,0],[4,1],[3,1],[2,1],
    [0,1],[1,0],[1,2],[0,1],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],
  ],

  // the five rows already on design/canvas/Ledger.dc.html, so the record is comparable
  // across the old artboard and all five new ones. a/b/c are band flex weights.
  rows: [
    { intention: 'finish the client proposal', outcome: 'Not yet',    started: 'Sep 18, 9:12',  minutes: 68, a: 41, b: 21, c: 6 },
    { intention: 'reply to the vendor thread', outcome: 'Yes',        started: 'Sep 18, 8:04',  minutes: 18, a: 14, b: 3,  c: 1 },
    { intention: 'read the Q3 brief properly', outcome: 'Yes',        started: 'Sep 17, 15:40', minutes: 33, a: 26, b: 5,  c: 2 },
    { intention: 'No intention given',         outcome: 'Unanswered', started: 'Sep 17, 11:22', minutes: 22, a: 8,  b: 6,  c: 8 },
    { intention: 'draft the handover notes',   outcome: 'Not yet',    started: 'Sep 16, 16:05', minutes: 27, a: 19, b: 4,  c: 4 },
  ],
};

// Shared formatters. Phase 2 reimplements these in lib/, typed.
window.hm = (s) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
};
window.pct = (n, d) => Math.round((n / d) * 100);
```

- [ ] **Step 2: Verify it parses**

Run: `node -e "global.window={};require('./design/canvas/explore/fixture.js');console.log(window.FIXTURE.days.length, window.FIXTURE.byHour.length, window.hm(148800))"`
Expected: `30 24 41 hr 20 min`

- [ ] **Step 3: Commit**

```bash
git add design/canvas/explore/fixture.js
git commit -m "design(explore): one fixture dataset for the dashboard shotgun"
```

---

### Task 2: M1 — The Ledger, Amplified

**Files:**
- Create: `design/canvas/explore/m1-ledger-amplified.html`

The control. Single editorial column, no panels, no tab chrome, no period navigation. It answers the question "how formidable does this get without borrowing the grid at all?", and if it wins, Phase 2 is a quarter of the size.

**What it renders, top to bottom, at 1200px:**

1. The word headline unchanged, Fraunces 600 at 56px: `Twenty-three this month. Fourteen finished.`
2. Directly beneath, one mono line at 17px in `--m-ink-2`, hairline rule above it: `41 hr 20 min attended · 6 hr 12 min away · 31 blocked reaches`
3. A full-bleed stacked bar strip, 30 bars, 96px tall, 4px gap, built from `FIXTURE.days`. Work in `--m-clay`, neutral in `--m-clay-2`, distract in `--m-clay-3`, away in the `--m-away` hatch. No axis, no gridlines, no labels except `Sep 1` and `Sep 30` in 12px at the ends.
4. The record: rows flush, separated by a 0.5px `--m-rule` hairline and nothing else. **No flex gap between rows.** Grid is `minmax(0,1fr) 180px 96px 72px`: intention in Fraunces 20px, band, outcome right-aligned at 15px, duration right-aligned in mono 14px tabular.
5. `No intention given` keeps Fraunces 20px in `--m-ink-3`, matching the current artboard rather than dropping to 13px sans.

- [ ] **Step 1: Write the artboard**

Self-contained HTML. Inline `<style>`, one `<script src="./fixture.js">`, one build script that writes the bars and rows from `FIXTURE`. Fonts from the same Google Fonts link the existing artboards use:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Public+Sans:wght@400;500&family=Sometype+Mono:wght@400;500&display=swap">
```

Palette, inlined because this file is disposable: ground `#F3F1EE`, sunk `#E9E6E2`, ink `#14120F`, ink-2 `#57534E`, ink-3 `#8B8681`, rule `#E2DFDB`, edge `#C7C2BB`, clay `#C75B39`, clay-2 `#D68A6E`, clay-3 `#E2B29E`, away `repeating-linear-gradient(135deg,#8B8681 0 2px,transparent 2px 6px)`.

- [ ] **Step 2: Render and look**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "file://$PWD/design/canvas/explore/m1-ledger-amplified.html"
$B screenshot /tmp/m1.png
```
Then read `/tmp/m1.png`. Expected: the headline dominates, the bar strip reads as one object, the record is dense enough that five rows occupy under 350px.

- [ ] **Step 3: Commit**

```bash
git add design/canvas/explore/m1-ledger-amplified.html
git commit -m "design(explore): M1, the ledger amplified"
```

---

### Task 3: M2 — Rize grammar, cream material

**Files:**
- Create: `design/canvas/explore/m2-rize-cream.html`

The direct answer to the brief: Rize's skeleton, MEANT's skin. Every structural element below is lifted from the November 2022 screenshots.

**Structure, at 1440px:**

1. **Page header:** `Dashboard` in Fraunces 600 at 36px, with an inline segmented pill group to its right: `Overview · Attention · Sites · Sessions`. Pill group is a capsule at `--m-r-chip`, selected item gets `--m-ground-sunk` fill and full ink; unselected are `--m-ink-3`. This is Rize's `Productivity | Overview Focus Breaks Meetings` row.
2. **Period row:** `September 2026` in Fraunces 24px on the left. On the right, a `Day | Week | Month` capsule and a three-button group (`‹`, calendar glyph, `›`) in a second capsule. Rize puts these at the same baseline and so does this.
3. **Hero panel, full width:** 20px radius (`--m-r-panel`), `--m-ground-sunk` fill, 0.5px `--m-rule` border. Header strip inside it, 40px tall, uppercase 11px Public Sans 500 at `0.08em` tracking, `--m-ink-3`: `BREAKDOWN`. Body holds the 30-bar stacked chart from `FIXTURE.days`, 260px tall, with a y-axis in mono 12px marked at 0/2/4/6/8 hours and horizontal hairlines at each.
4. **Three-panel grid beneath,** `grid-template-columns: repeat(3, minmax(0,1fr))`, 24px gap, each panel styled as the hero:
   - `SITES` — ranked list from `FIXTURE.domains`, rows of `share% · domain · mini bar · duration`. Share in mono 14px left, domain in Public Sans 16px, bar a 64px track filled in clay proportional to the leader, duration in mono 14px right-aligned. Ten rows, scroll clipped. This is Rize's `WORK CATEGORIES`.
   - `WHERE THE MONTH WENT` — three rows, each a 56px clay-stroked ring showing the share, with the big percentage in Fraunces 28px inside the row beside it, the duration in mono 15px under it, and a two-line comparison block on the right: `Last month: 53%` / `Change: ↑ 6%`. Attention, away, break. This is Rize's `BREAKDOWN`.
   - `ATTENDED` — two figure blocks stacked: `41 hr 20 min` in Fraunces 600 at 40px with `Avg. per session` under it, then `1 hr 48 min` the same way. Each carries `Last month:` and `Change:` lines in 13px. This is Rize's `WORK HOURS`.
5. **One inference sentence,** the existing domain contrast, in 15px `--m-ink-2`, sitting in its own full-width bordered panel with header strip `WHAT THE RECORD SUGGESTS`. One, not two. ADR-0066 holds here.
6. **The record,** as M1's dense table, inside a panel with header strip `SESSIONS` and a date divider row per day (`Thursday, September 18` in uppercase 11px tracking-wide) above the rows for that day. Rize groups its session list under day headers; so does this.

- [ ] **Step 1: Write the artboard**

Same shell and palette as Task 2 Step 1. Rings are inline SVG `<circle>` with `stroke-dasharray`, 4px stroke, never filled, never gradient.

- [ ] **Step 2: Render and look**

```bash
$B goto "file://$PWD/design/canvas/explore/m2-rize-cream.html" && $B screenshot /tmp/m2.png
```
Expected: the panel grid reads as a system, cream survives the density, the clay family carries four distinct meanings without a second hue.

- [ ] **Step 3: Commit**

```bash
git add design/canvas/explore/m2-rize-cream.html
git commit -m "design(explore): M2, Rize grammar in cream"
```

---

### Task 4: M3 — Rize grammar, Rize material

**Files:**
- Create: `design/canvas/explore/m3-rize-literal.html`

The honest test of the anti-reference. Identical skeleton to M2, rendered the way Rize renders it: ground `#14120F`, panels `#1C1917` with no border, Public Sans throughout including the headline, figures in Public Sans 600 rather than Fraunces, and a four-hue accent set instead of one clay family. Donuts filled, not stroked.

This exists so the comparison is real. `docs/design.md:47` has called Rize an anti-reference for weeks without anyone building the thing it refuses and looking at it.

**Deviations from M2, and only these:**
- Dark palette from `design/tokens.css:73-85`, plus `--m-panel: #1C1917` which does not exist yet
- Accents: clay `#C75B39` for attention, a cool `#5B8FC7` for away, `#7C6FC7` for break, `#8B8681` for unknown. **This is the second accent colour `docs/design-toolkit.md:188` refuses.**
- Fraunces appears nowhere
- Donuts are filled arcs with a hole, matching Rize's `Top Categories`

- [ ] **Step 1: Write the artboard**
- [ ] **Step 2: Render and look**

```bash
$B goto "file://$PWD/design/canvas/explore/m3-rize-literal.html" && $B screenshot /tmp/m3.png
```

- [ ] **Step 3: Commit**

```bash
git add design/canvas/explore/m3-rize-literal.html
git commit -m "design(explore): M3, Rize grammar in Rize material"
```

---

### Task 5: M4 — Editorial broadsheet

**Files:**
- Create: `design/canvas/explore/m4-broadsheet.html`

Formidable through scale and rules rather than containers. No panels at all. A newspaper front page.

**Structure, at 1200px:**

1. **Masthead figure row.** Four cells across the full width, separated by vertical 0.5px `--m-rule` hairlines, each holding a huge mono numeral at 64px with tabular figures and a 12px uppercase label beneath: `41:20 ATTENDED` · `23 SESSIONS` · `14 FINISHED` · `31 BLOCKED`. Units in 20px beside the numeral, not inside it.
2. Below a 1.5px full-width `--m-ink` rule, the word headline at Fraunces 600 44px, left: `Twenty-three this month. Fourteen finished.`
3. **Two-column body,** `grid-template-columns: 5fr 3fr`, 64px gap, matching `m-landing-prose`:
   - Left: the 30-bar stacked chart, 200px tall, and beneath it the record as a dense hairline table with a date divider per day.
   - Right: the ranked site list as a plain hairline table, no bars, `domain / duration` only, with the distract-labelled rows carrying the hatch as a left edge rather than a colour. Under it, the one inference sentence at 17px Fraunces 400, set as a pull quote with a 1.5px left rule.
4. No tabs, no period pill, no arrows. Period changes via three plain text links: `August · September · Year`.

- [ ] **Step 1: Write the artboard**
- [ ] **Step 2: Render and look**

```bash
$B goto "file://$PWD/design/canvas/explore/m4-broadsheet.html" && $B screenshot /tmp/m4.png
```

- [ ] **Step 3: Commit**

```bash
git add design/canvas/explore/m4-broadsheet.html
git commit -m "design(explore): M4, the broadsheet"
```

---

### Task 6: M5 — Instrument panel

**Files:**
- Create: `design/canvas/explore/m5-instrument.html`

Maximum density, and the only artboard that deliberately breaks ADR-0066 by putting several claims about the user on screen at once. If it wins, that ADR is superseded in Phase 2 and the reason is on record.

**Structure, at 1440px:**

1. **Left icon rail,** 64px, `--m-ground-sunk`, five glyphs drawn as 20px SVG strokes in `--m-ink-3` with the active one in `--m-ink`. Copies Rize's rail directly.
2. **Header:** `Dashboard` + period pill + arrows, as M2.
3. **Timeline strip, full width, 120px.** The real analogue of Rize's `TIMELINE`: a 24-hour horizontal axis with each session drawn as a clay block positioned by `started_at` and sized by duration, with away segments hatched inside it. Hour ticks at 3/6/9/12/15/18/21. Built from `FIXTURE.rows`.
4. **Four-column stat grid,** 16px gap, each a compact panel:
   - `ATTENDED 41 hr 20 min` with `↑ 5 hr 18 min` beneath
   - `SESSIONS 23` with `↑ 4`
   - `FINISHED 14 of 19 answered` with a 3px clay track showing the share
   - `BLOCKED 31 reaches` with the hatch as its track
5. **Three panels beneath:** `SITES` ranked list, `BY HOUR` a 24-bar histogram from `FIXTURE.byHour` with finished in clay and not-yet in clay-3 stacked, `CLAIMS` holding **both** inference sentences, stacked, each on its own line.
6. **The record** as a compact table, 40px row pitch, columns `time · intention · band · duration · outcome`, with timestamps in mono 13px.

- [ ] **Step 1: Write the artboard**
- [ ] **Step 2: Render and look**

```bash
$B goto "file://$PWD/design/canvas/explore/m5-instrument.html" && $B screenshot /tmp/m5.png
```

- [ ] **Step 3: Commit**

```bash
git add design/canvas/explore/m5-instrument.html
git commit -m "design(explore): M5, the instrument panel"
```

---

### Task 7: The comparison board, then STOP

**Files:**
- Create: `design/canvas/explore/index.html`

- [ ] **Step 1: Build the board**

One page with five `<iframe>` elements at `width: 1440; height: 1400; transform: scale(0.42); transform-origin: top left`, laid out in a row that scrolls horizontally, each captioned `M1 The Ledger, Amplified` and so on, with a one-line statement of what each is testing.

- [ ] **Step 2: Render at two widths**

```bash
$B goto "file://$PWD/design/canvas/explore/index.html" && $B screenshot /tmp/board.png
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 "file://$PWD/design/canvas/explore/m2-rize-cream.html"
```

- [ ] **Step 3: Commit and stop**

```bash
git add design/canvas/explore/index.html
git commit -m "design(explore): the comparison board"
```

**STOP HERE.** Present the five screenshots. Ask which one ships, and name the two consequences that come with the answer:
1. Whether the landing page keeps saying "No total hours. Anywhere."
2. Whether ADR-0066's one-claim rule survives (it does for M1, M2, M4; it does not for M5).

Do not touch `app/`, `lib/`, `design/tokens.css`, or any document in `docs/` before that answer.

---

## Phase 2 — Ship the winner (gated on approval)

Written against M2, because it is the direct answer to the brief. If another mockup wins, Tasks 3 through 6 change shape but Tasks 1, 2, and 7 are identical.

### Task 1: Remove the invariant lines

**Files:**
- Modify: `CLAUDE.md:20`, `AGENTS.md:99`, `docs/design.md:48,50,226,326`, `docs/design-toolkit.md:188,196`, `docs/prd-intent.md:319`, `docs/build.md:274`, `PRODUCT.md:200`
- Create: `docs/adr/ADR-0068-the-dashboard-states-quantities.md`

- [ ] **Step 1: Write the ADR first**

It records a decision the owner has taken, per ADR-0063 rule 3. Context: the dashboard read as five floating items, the word headline carried no magnitude, and the owner chose to adopt Rize's layout grammar. Decision: the dashboard states quantities. Total attended time, session counts, per-site shares, and period-over-period change all render, with the word headline kept above them. Consequences must name, in full: that `PRODUCT.md:191`'s competitive clause no longer distinguishes the products on this axis; that the landing page's claim is being retired; that I1, I3, I6, I8, and the away hatch are untouched; and that the research in IDEA §5 C9 and C11 against reward-for-hours is not refuted by this, only overruled for a surface the user opens on purpose after the work is done.

- [ ] **Step 2: Edit the eleven lines**

Replace each with the new rule rather than deleting it, so the file still says what is true. The replacement sentence, used verbatim everywhere the old one appeared:

> Quantities render on the dashboard: attended time, counts, shares, and change against the previous period. Nothing renders a composite productivity score, and no figure carries a colour that grades it.

- [ ] **Step 3: Verify nothing still asserts the old rule**

Run: `grep -rn -E "total-hours|no percentage, no score" CLAUDE.md AGENTS.md PRODUCT.md docs --include='*.md' | grep -v docs/adr`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add -A CLAUDE.md AGENTS.md PRODUCT.md docs/
git commit -m "docs(adr): ADR-0068 - the dashboard states quantities"
```

### Task 2: The landing page stops promising what the dashboard no longer does

**Files:**
- Modify: `app/page.tsx:119-124`, `design/canvas/Landing.dc.html:92`, `design/fixtures/landing.html:47`

- [ ] **Step 1: Get the replacement copy from the owner.** The headline is acquisition copy on the one surface `PRODUCT.md` calls Persuade. An implementer must not invent it.
- [ ] **Step 2: Apply the same words to all three files.** The artboard, the fixture, and the page must not disagree.
- [ ] **Step 3: Run `npm run build` and confirm it passes. Commit.**

### Task 3: The aggregate layer, as pure functions

**Files:**
- Create: `lib/dashboard-figures.ts`
- Create: `test/dashboard-figures.test.js`

**Interfaces:**
- Consumes: raw rows shaped like the existing queries in `app/dashboard/page.tsx:19-29` and `:54-65`.
- Produces: `formatHm(seconds: number): string`, `totalsByKind(rows): {attention, away, break}`, `rankDomains(rows): {domain, seconds, label, share}[]`, `daySeries(rows, from, to): {date, work, neutral, distract, away}[]`, `changeAgainst(current, previous): {delta: number, direction: 'up'|'down'|'flat'}`.

Pure, no SQL, no Date.now(). Every function takes its clock or range as an argument, which is what made `answerableBacklog` testable.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatHm, totalsByKind, rankDomains, changeAgainst } from '../lib/dashboard-figures.ts'

test('formatHm drops the hour when there is none', () => {
  assert.equal(formatHm(0), '0 min')
  assert.equal(formatHm(1500), '25 min')
  assert.equal(formatHm(3600), '1 hr 0 min')
  assert.equal(formatHm(148800), '41 hr 20 min')
})

test('totalsByKind ignores block_hit, which has null seconds', () => {
  const rows = [
    { kind: 'attention', seconds: 600 }, { kind: 'away', seconds: 300 },
    { kind: 'break', seconds: 120 }, { kind: 'block_hit', seconds: null },
  ]
  assert.deepEqual(totalsByKind(rows), { attention: 600, away: 300, break: 120 })
})

test('rankDomains sorts by seconds and shares sum to 100 or less', () => {
  const out = rankDomains([
    { domain: 'a.com', seconds: 300, label: 'work' },
    { domain: 'b.com', seconds: 700, label: 'distract' },
  ])
  assert.equal(out[0].domain, 'b.com')
  assert.equal(out[0].share, 70)
  assert.ok(out.reduce((t, d) => t + d.share, 0) <= 100)
})

test('changeAgainst reports flat rather than a zero-percent rise', () => {
  assert.deepEqual(changeAgainst(100, 100), { delta: 0, direction: 'flat' })
  assert.deepEqual(changeAgainst(0, 100), { delta: -100, direction: 'down' })
})

test('changeAgainst does not divide by zero on a first month', () => {
  assert.deepEqual(changeAgainst(500, 0), { delta: 500, direction: 'up' })
})
```

- [ ] **Step 2: Run them and watch every one fail**

Run: `node --test test/dashboard-figures.test.js`
Expected: FAIL, `Cannot find module '../lib/dashboard-figures.ts'`

- [ ] **Step 3: Write the minimal implementation.** Each function does exactly what its test asserts. `rankDomains` computes share against the sum of the rows it was handed, not against wall clock. `changeAgainst` returns the absolute delta when the previous period is zero, never a percentage.
- [ ] **Step 4: Run the tests and watch them pass.** Then `npx tsc --noEmit`.
- [ ] **Step 5: Commit.**

```bash
git add lib/dashboard-figures.ts test/dashboard-figures.test.js
git commit -m "feat(lib): the dashboard's aggregate layer, as pure functions"
```

### Task 4: The queries

**Files:**
- Modify: `app/dashboard/page.tsx:19-125`

Six queries, all bounded by the selected period, replacing the four that are there.

- [ ] **Step 1: Bound the contrast query.** `page.tsx:54-65` currently selects every attention event the user has ever produced, with no date bound and no limit, on a `force-dynamic` render. Add `and s.started_at >= ${from}` and `and s.started_at < ${to}`. This is a defect the redesign inherits and must not carry forward.
- [ ] **Step 2: Bound the session list.** Replace `limit 50` at `:29` with the same period bounds, so the record under the headline is the month the headline counts.
- [ ] **Step 3: Add the four aggregates.** Totals by kind, domain ranks, the day series, and the previous period's totals. Each is one grouped query. The day series groups on `date(s.started_at)`, not on `e.at`, so a session that crosses midnight lands on the day it started, matching the headline's own `date_trunc`.
- [ ] **Step 4: Verify against a seeded user.** Run the existing e2e seed and assert the hero figure equals the sum of the seeded event seconds.
- [ ] **Step 5: Commit.**

### Task 5: The surface classes

**Files:**
- Modify: `app/globals.css`, `design/tokens.css` if a token is missing

New structural family `.m-panel`, `.m-panel-head`, `.m-stat`, `.m-period`, `.m-seg`, on the `.m-ledger-*` and `.m-review-*` precedent. `--m-ground-sunk` and `--m-r-panel` already exist in `design/tokens.css:10,35` and have never been used; the panel is what they were defined for.

- [ ] **Step 1: Write the CSS.** No hex literals. The panel is `--m-ground-sunk` at `--m-r-panel` with a `--m-stroke-hair` `--m-rule` border.
- [ ] **Step 2: Fix the row density.** `[data-surface="ledger"]` at `app/globals.css:88` sets `gap: 24px` on a flex column that holds every row, which is why five rows occupy 432px against the artboard's 335px. Wrap the record in its own container at `gap: 0` and keep the outer gap at the artboard's 44px, matching `[data-surface="landing"] .m-landing-ledger` at `:686`.
- [ ] **Step 3: Give the outcome cell its column.** `page.tsx:193` renders it as `.m-meta` at 13px left-aligned; the artboard has it 15px right-aligned. Fix both the class and `app/globals.css:804`, which styles `.m-row-figure` inside a ledger row that has never contained one.
- [ ] **Step 4: Give the band an accessible name.** `<Band>` at `page.tsx:192` has none, so the whole attention record is invisible to a screen reader. Add `role="img"` and an `aria-label` naming the split in words.
- [ ] **Step 5: Render at 1440 and 390 and look.** Commit.

### Task 6: Rebuild the page

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Compose the winner's structure** from Tasks 3 through 5. The word headline stays; the quantitative line goes beneath it.
- [ ] **Step 2: Handle the empty and first-week states.** A user with no previous month gets no change row rather than `↑ 100%`. A user with fewer than `PATTERN_MIN_SESSIONS` answered sessions gets no inference sentence, unchanged from today.
- [ ] **Step 3: Render the real page against a seeded user and look.** Static code and a clean build are not evidence.
- [ ] **Step 4: Commit.**

### Task 7: Promote the artboard and reconcile

**Files:**
- Modify: `design/canvas/Ledger.dc.html`, `design/fixtures/ledger.html`, `docs/design.md` §5 and §6, `docs/design-toolkit.md` §8

- [ ] **Step 1: Replace `Ledger.dc.html` with the winner,** converted to the `<x-dc>` / `DCLogic` format the other artboards use. The canvas is rank 1 in the hierarchy of truth; if it still shows the old surface, the next design review judges against a page that no longer exists.
- [ ] **Step 2: Refresh `design/fixtures/ledger.html`,** which predates the actions block and the inference sentence and therefore cannot show the defect ADR-0066 was written about.
- [ ] **Step 3: Declare the new classes** in `docs/design.md` §5 and `docs/design-toolkit.md` §8, and state plainly that the count is now higher again. The 13-versus-15 question stays open; this does not pretend to close it.
- [ ] **Step 4: Run everything.**

```bash
node --test test/ && npx tsc --noEmit && npx playwright test e2e/dashboard.spec.ts
```

- [ ] **Step 5: Commit.**

---

## Self-review

**Spec coverage.** Five mockups before code: Tasks 1 through 7 of Phase 1, with an explicit stop. Rize layout copied: M2 and M5 carry all nine of its structural elements (icon rail, title-plus-tabs, period row, hero panel, panel grid, uppercase strip labels, huge-numeral stats, ranked list with bars, period-over-period change). Quantitative headline beside the word headline: M1 step 2, M2 item 4, M4 item 1. Invariants removed: Phase 2 Task 1, eleven lines named with file and line. Total hours or sessions: `FIXTURE.attentionSeconds` and `FIXTURE.sessions`, rendered in every mockup.

**Placeholders.** None. Every figure in the fixture is a literal. Two things are deliberately left to the owner and both say so: which mockup wins, and the landing page's replacement headline. Neither is a detail an implementer could invent correctly.

**Type consistency.** `formatHm`, `totalsByKind`, `rankDomains`, `daySeries`, `changeAgainst` are named identically in the interface block, the tests, and Task 4. The fixture's `hm` is the throwaway ancestor of `formatHm` and the plan says so.

**Known risk.** Phase 2 Task 4 step 3 assumes `event.label` is populated. `002-drift.sql` added the column and ADR-0062 writes it per visit, but a user whose sessions predate that migration has null labels on every row, which collapses the stacked day chart to one colour. Handle null as `unknown` and render it in `--m-ink-3`, never as work.
