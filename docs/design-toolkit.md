# MEANT — Design Toolkit

**Version 0.2 · 2026-09-01 · Owner: Alexandre Andrei Nevero**
**Visual truth:** the design canvas, "MEANT Band System" · **Token file:** [`design/tokens.css`](../design/tokens.css)
**Product truth:** [PRODUCT.md](../PRODUCT.md), [context.md](../context.md)

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

**A chart cannot have gaze.** The companion keeps the primitives (capsule outline, clay fill) and stops being a chart. Everywhere else the mark still is one. This is deliberate and it is the only place it happens.

| | Settled | Drifting |
|---|---|---|
| Aperture | Narrow bar, low in the capsule, where the band sits everywhere else | Risen, opened taller, centred |
| Stroke | `--m-stroke` (1.5px) | `--m-stroke-loud` (2px) |
| Reads as | Looking at the work, alongside you | Turned to look at you |

**Aliveness is breathing and a rare blink** — a slow scale/opacity cycle at ~4.2s and a blink at ~6.7s. Sub-perceptual. It must never read as animation.

**State is gaze and posture, never an action.** Facing your work is a *posture*, not an *event* — which is how there is a positive state with no reward inside it.

**Hard rules.**
- It never varies with the outcome answer. `Yes` and `Not yet` leave it identical (I1) — otherwise it becomes a reason to lie.
- Nothing good happens on screen during a session (I2). The return, the finished step, the honest answer: all of it waits for the review.
- Motion budget: **three noticeable movements per 25 minutes, none in the first 60 seconds.** Breathing and blinking do not count. Arousal is the risk, not attention — an observer makes complex work worse, and complex work is the only kind this audience does.
- Coach, not pet. This user screen-shares with clients.
- It must read at 80–120px, and the gaze must read at that size.
- One tap on it says what it reads and where that goes. It is the consent surface, not the anaesthetic.

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

**Clay appears only in bands, swatches, and the companion's aperture.** The primary button is ink on ground. There is no second accent, and there is no blue.

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

Fixed contract with the build lane (`docs/metaprompt-build.md` §Coordination). Never rename unilaterally.

```
.m-app  .m-mark[data-state]  .m-sentence  .m-meta  .m-field  .m-btn[data-variant]
.m-answer[data-answer]  .m-row  .m-row-domain  .m-row-bar[data-kind]  .m-row-figure
.m-rate  .m-empty
```

`data-state` is `idle | running | drifting | ended | empty`. **`drifting` has been declared since 0.1 and is set nowhere in the code.** It is the companion's state, and wiring it is the smallest possible version of shipping the companion.

---

## 9. Refuse

Dark mode as the default look · a productivity score of any kind · a total-hours headline anywhere · green for `Yes` · streaks, badges, flames, rings · a Pomodoro dial · confetti · a progress ring · a second accent colour · a card with a left-border accent · emoji as iconography · a chat input on any surface during a session · any celebration while the session is running · gradients on the band · a countdown that ticks (a live clock invites waiting it out).

---

## 10. Acceptance

- [ ] Every colour comes from `design/tokens.css`; no hex in any component
- [ ] `Yes` and `Not yet` are byte-identical in every visual property
- [ ] No total-hours figure, no percentage, no score, on any surface
- [ ] The popup animates nothing
- [ ] The companion's appearance does not vary with the outcome answer
- [ ] A 25-minute screen recording shows ≤3 noticeable companion movements, none in the first 60s
- [ ] Away renders as a hatch everywhere it appears
- [ ] Every animated element has a `prefers-reduced-motion` branch
- [ ] Both themes painted explicitly; `body` has an explicit token background
- [ ] Runs at 360px (popup), 1440px (landing), and a ~320px side panel
