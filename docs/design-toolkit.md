# MEANT — Design Toolkit

**Version 0.2 · 2026-09-01 · Owner: Alexandre Andrei Nevero**
**Visual truth:** the design canvas, "MEANT Band System" · **Token file:** [`design/tokens.css`](../design/tokens.css)
**Product truth:** [PRODUCT.md](../PRODUCT.md), [apexhuman.md](../apexhuman.md)

> **Amendment 0.2a (2026-09-16).** §3 described a companion that has not existed since
> 2026-09-05 and a signal that was deleted on 2026-09-15. The gaze/posture table below is
> **void** — the shipped companion is a 28px orbital dot (ADR-0026) that **no longer signals
> drift at all** (ADR-0057) and instead **accepts one tap meaning "this isn't the work"**
> (ADR-0058). Corrected in place at §3, §8 and §10, marked rather than rewritten so the
> reasoning survives. §9's refusal of "dark mode as the default look" **stands, settled
> 2026-09-16 (ADR-0065):** the shipped token file is a fallback, not a contradiction.
> **`docs/adr/` outranks this document** (ADR-0063).
>
> **0.1 is superseded, and not by a small margin.** Version 0.1 §3 specified the mark as *two cumulative lines, blue and clay, from a shared origin, that never cross* — a slopegraph. What was actually built and chosen is **an outline that holds the sentence plus a segment band that carries the attention**, with **no blue anywhere**. The canvas won; a spec that loses to its own execution is stale, not authoritative. Everything below is derived from the shipped artboards. `design/tokens.css` is generated from the same source and is what code imports.

---

## 1. The world

Warm cream paper, exact geometry, one colored family that means something. Nothing dark, nothing clinical, nothing that reads as a dashboard built for someone's manager.

**Personality:** plainspoken, warm, exact. Someone who knows you and is not managing you.

**Anti-references:** Rize (near-black, purple gradient, team surveillance). Any Pomodoro dial. Progress rings. Streak flames. Green-means-good.

---

## 2. The mark

Two elements, and every surface is a different arrangement of them.

| Element | What it is | What it means |
|---|---|---|
| **The outline** | A capsule, ink stroke, no fill, radius scaled to its size | The sentence. What you said you would finish |
| **The band** | Segments in clay tints, 3-4px gaps, ordered by time | The attention. Where it actually went |

| Surface | Arrangement |
|---|---|
| Popup, idle | The outline **is** the input. Empty, with a caret |
| Popup, running | Outline holds the sentence; a thin band grows beneath it; the remainder is a dashed edge |
| Block page | The outline at full page size. Nothing else competes |
| Review | Outline, then the plan, then the finished band, then the rows |
| Ledger | The band alone, one per row. The outline is gone; the sentence is plain text |
| Landing | The outline empty above a band that draws once, 900ms |

**Rules.** Gaps do the separating, so the tints never carry contrast they cannot hold. Away is a **hatch**, never a solid grey — a hatch says *unmeasured*, not *another site*. Rows repeat the swatch, so the band never needs inline labels. Three clay tints, never four.

---

## 3. The companion — the one fork taken

> **VOID below the rule, 2026-09-16.** Everything in the three-row table and the two paragraphs
> after it describes the **gaze/capsule** companion, replaced by the Orbit dot on 2026-09-05
> (ADR-0026) and never built. The *Drifting* column is void twice over: ADR-0057 removed live
> drift signalling from the product entirely. Kept, struck, because the fork it records — why the
> companion stopped being a chart — is still the reason the companion is not made of `.m-mark`.
> **What ships is in `docs/design.md` §4 and PRD §3.2.**

**~~A chart cannot have gaze.~~** The companion keeps the primitives (capsule outline, clay fill) and stops being a chart. Everywhere else the mark still is one. This is deliberate and it is the only place it happens. *(The half that survived: it is a separate surface, `extension/companion-overlay.js`, built from nothing the rest of the system uses.)*

| ~~Settled~~ | ~~Drifting~~ — **void, ADR-0057** |
|---|---|
| ~~Aperture: narrow bar, low in the capsule~~ | ~~Risen, opened taller, centred~~ |
| ~~Stroke `--m-stroke` (1.5px)~~ | ~~`--m-stroke-loud` (2px)~~ |
| ~~Reads as: looking at the work~~ | ~~Turned to look at you~~ |

**What replaced it.** One state while a session runs: a **solid ring, breathing** (~1.6s continuous scale/opacity on the dot — the ~4.2s breathe and ~6.7s blink above were the gaze design's). Sub-perceptual. It must never read as animation.

**State is presence, and the only event is the user's.** The companion signals nothing and decides nothing on screen. It reveals the intention on hover, and **one tap says "this isn't the work"** (ADR-0058), acknowledged by a 0.6s ring-collapse — the motion ADR-0026 wrote for a return from drift, reused for a receipt. Feedback for an action the user chose is not a reward for behaviour the product graded, which is how there is still a positive state with no reward inside it.

**Hard rules.**
- It never varies with the outcome answer. `Yes` and `Not yet` leave it identical (I1) — otherwise it becomes a reason to lie.
- Nothing good happens on screen during a session (I2). The return, the finished step, the honest answer: all of it waits for the review.
- ~~Motion budget: **three noticeable movements per 25 minutes, none in the first 60 seconds.**~~ **Void as a live rule, 2026-09-16 (ADR-0057)** — it bounded a signal that no longer fires. The reasoning stands and is now enforced structurally instead: arousal is the risk, not attention, so **the product initiates no motion at all.** Only a user action may move the companion.
- Coach, not pet. This user screen-shares with clients.
- ~~It must read at 80–120px, and the gaze must read at that size.~~ **Void (ADR-0026)** — it ships at 28px and has no gaze. It must read as *presence* at that size, which is a different test.
- ~~One tap on it says what it reads and where that goes.~~ **Corrected 2026-09-16 (ADR-0058):** the tap is now the user's **input** — *"this isn't the work"* — not a disclosure control. It was never built as disclosure; hover reveals the intention instead. **The consent surface is therefore missing, not moved**, and the product now reads on-device paths (ADR-0059), which needs disclosing more than hostnames did. See `docs/design.md` §10.

---

## 4. Color

Every value lives in `design/tokens.css`. Never hardcode a hex in a component.

| Token | Light | Role |
|---|---|---|
| `--m-ground` / `--m-ground-sunk` | `#F3F1EE` / `#E9E6E2` | Surface / the canvas behind a panel |
| `--m-ink` / `--m-ink-2` / `--m-ink-3` | `#14120F` / `#57534E` / `#8B8681` | Primary / prose / labels and away |
| `--m-rule` / `--m-edge` | `#E2DFDB` / `#C7C2BB` | Row rules / unselected chips |
| `--m-clay` / `-2` / `-3` | `#C75B39` / `#D68A6E` / `#E2B29E` | Attention, ordered by time |
| `--m-away` | hatch | Unmeasured |

**Clay appears only in bands, swatches, and the companion's ring** ("aperture" was the gaze design's; corrected 2026-09-16). The primary button is ink on ground. There is no second accent, and there is no blue.

---

## 5. Typography

| Face | Use |
|---|---|
| **Fraunces** | The sentence, and display. Only ever the user's own words or a headline |
| **Public Sans** | Everything else |
| **Sometype Mono** | Figures, durations, counts. `font-variant-numeric: tabular-nums` always |

Tracking `-0.02em` throughout; `-0.03em` at 44px and up. Google-hosted only — the one font host the artifact CSP admits.

---

## 6. Motion

One curve: `cubic-bezier(0.23, 1, 0.32, 1)`. Never `ease-in`. Never `transition: all`.

| Moment | Duration | Notes |
|---|---|---|
| Press | 160ms | `scale(0.97)` on `:active` for anything pressable |
| Block page | 240ms | Settles once from 8px with a 3px blur |
| Review | 280ms | The one authored moment: label, outline, plan, band, rows staggered 50ms |
| Landing mark | 900ms | Draws once on load |
| **Popup** | **none** | Opened dozens of times a day. Animation makes it feel slow |

Never animate from `scale(0)` — start at `0.95` with opacity. `@starting-style` for entry. Every animated element honours `prefers-reduced-motion`.

---

## 7. Verbal identity

Second person, present tense, lowercase for the user's own words. The product never says the afternoon was good when it was not.

| Say | Never |
|---|---|
| "You meant to" | "Your goal" |
| "Did you?" | "Mark as complete" |
| "Not yet" | "Failed", "Missed" |
| "away" | "Idle", "Unproductive" |
| "Drifted twice, back within ninety seconds both times" | "78% focus score" |

`Yes` and `Not yet` are identical in colour, weight, size, and motion. A green tint on `Yes` turns the honest answer into a punishment.

---

## 8. Class vocabulary

Fixed at 13 classes. Never rename or add a 14th unilaterally — see `docs/design.md` §5 for the
enforced version of this contract, which this section restates.

```
.m-app  .m-mark[data-state]  .m-sentence  .m-meta  .m-field  .m-btn[data-variant]
.m-answer  .m-row  .m-row-domain  .m-row-bar[data-kind]  .m-row-figure
.m-rate  .m-empty
```

**Corrected 2026-09-11:** `.m-answer` carries no `[data-answer]` selector, anywhere, on
purpose — Invariant 2 (`Yes`/`Not yet` byte-identical) is enforced by the CSS file's
structure, not by a selector that could vary per answer. `grep -rn "m-answer\[data-answer"
app extension` returning nothing is the proof; this section previously listed
`.m-answer[data-answer]` as if it were part of the contract, which contradicted that
invariant.

`data-state` is `idle | running | drifting | ended | empty`. **Corrected 2026-09-11:**
`drifting` was wired — `extension/sw.js`'s mechanical drift signal set it (`docs/index.md`
D25, `docs/adr/ADR-0025`); this section previously said it was "set nowhere in the code,"
true only through 2026-09-01. **Corrected again 2026-09-16 (ADR-0057): nothing sets `drifting`
any more.** The signal that wrote it is gone, and the companion is a separate Shadow DOM surface
that never used `.m-mark` in the first place. The value stays in the enum as a deliberate hole —
removing it from the contract is a decision nobody has recorded — but a surface rendering
`data-state="drifting"` today is rendering a state the product cannot enter.

**Counted against the code, 2026-09-16: the file defines 15, not 13.** `.m-chip` and `.m-chip-row`
ship in the popup and are not in the list above, and `.m-landing-*`, `.m-rise`, `.m-shell-*`,
`.m-review-*` (the review's row and question groups, added on `bugfix-seven`) and `.m-ledger-*`
(the dashboard's shortcut group and its one inference sentence, added on `dashboard-arithmetic`,
ADR-0066) exist as structural families outside it. See `docs/design.md` §5 — the number and the
code have to be reconciled by a decision, not by editing this line. **`.m-ledger-*` is structural,
not vocabulary, on the same argument as every family before it, and declaring it settles nothing
about 13 or 15.**

---

## 9. Refuse

> **Settled 2026-09-16 (ADR-0065).** MEANT is a cream product; the dark palette at
> `design/tokens.css:54` is a *fallback* for a user whose OS asks for one, not a second look.
> Shipping a correct fallback is not "dark mode as the default look" — the refusal below stands.

Dark mode as the default look · a productivity score of any kind · a total-hours headline anywhere · green for `Yes` · streaks, badges, flames, rings · a Pomodoro dial · confetti · a progress ring · a second accent colour · a card with a left-border accent · emoji as iconography · a chat input on any surface during a session · any celebration while the session is running · gradients on the band · a countdown that ticks (a live clock invites waiting it out).

---

## 10. Acceptance

- [ ] Every colour comes from `design/tokens.css`; no hex in any component
- [ ] `Yes` and `Not yet` are byte-identical in every visual property
- [ ] No total-hours figure, no percentage, no score, on any surface
- [ ] The popup animates nothing
- [ ] The companion's appearance does not vary with the outcome answer
- [ ] ~~A 25-minute screen recording shows ≤3 noticeable companion movements, none in the first 60s~~ **Replaced 2026-09-16 (ADR-0057):** a 25-minute screen recording shows **no companion movement the user did not cause** — the breathe excepted
- [ ] Away renders as a hatch everywhere it appears
- [ ] Every animated element has a `prefers-reduced-motion` branch
- [ ] Both themes painted explicitly; `body` has an explicit token background
- [ ] Runs at 360px (popup), 1440px (landing), 390px (the narrow web breakpoint the ledger and shell ship). ~~a ~320px side panel~~ — **void (ADR-0026)**, there is no side panel
