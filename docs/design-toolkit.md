# MEANT — Design Toolkit

**Version 0.1 · 2026-08-18 · Owner: Alexandre Andrei Nevero**
**Product truth:** [PRODUCT.md](../PRODUCT.md) and [docs/](.) · **Status:** committed

> This is a specification, not a set of assets. It contains no CSS, no SVG, and no code on purpose. Everything here is precise enough to generate from. The generator produces the artifacts; §10 lists exactly which ones and how they will be judged.

---

## 1. Foundations

| | |
|---|---|
| **Name** | MEANT |
| **What it is** | A browser extension and web app that makes you say what you intend to finish, blocks what you chose to avoid, records where your attention went, and ends by asking whether you finished it |
| **Who it is for** | A browser-native worker. A non-technical corporate administrator writing reports with an AI assistant, on a locked-down laptop. Not a developer, not a productivity hobbyist |
| **What it measures** | Completed outcomes. Hours appear only as evidence inside one session, never as a headline |
| **Position** | Rize measures and shows hours. Freedom blocks and never reports back. Session does the loop on Apple platforms and asks what you *learned*. MEANT asks whether you *finished*, and that answer accumulates |
| **Personality** | Plainspoken, warm, exact. A person who knows you and is not managing you |
| **The governing line** | **The goal is one line.** When attention matches intention, the two marks become a single stroke |

**Promise:** you will know whether the afternoon produced the thing it was for.
**Anti-promise:** the product never says the afternoon was good when it was not.

---

## 2. The world

Warm cream paper, exact geometry, two colored lines that mean something. Freedom's warmth (light ground, serif display, second person, one saturated accent) carrying Byrne's rigor (colored geometry doing the work that letters and numbers would otherwise do). Nothing dark, nothing clinical, nothing that reads as a dashboard built for someone's manager.

### References and what each is for

| Reference | What we take |
|---|---|
| Ibry / Marey graphical train schedule, 1878 (edwardtufte.com/notebook/graphical-timetables) | Lines from a shared origin whose slope is the meaning and whose gap is the story. The mark's direct ancestor |
| Oliver Byrne's Euclid, 1847 (c82.net/euclid) | Colored geometry replacing letters, on buff paper. Saturated primaries, warm ground, zero ornament |
| Tufte's slopegraph | Two states, one connector, no axis furniture |
| Visit Nordkyn, Neue Design Studio, 2010 (neue.no/work/visit-nordkyn) | An identity generated from live data, with a generator that renders the mark for a given moment |
| Dear Data, Lupi and Posavec | Personal data drawn warmly, without a dashboard |
| Sonner and Vaul, Emil Kowalski | Motion craft: transitions over keyframes, interruptibility, restraint at high frequency |

**Anti-references:** Rize (near-black, purple gradient, team surveillance). Any Pomodoro dial. Progress rings. Streak flames. Green-means-good.

---

## 3. The mark

### 3.1 What it is
Two cumulative lines over the length of one session, from a shared origin at bottom-left.

- **Intended** (blue): `y = x`. Every minute you sat down for. Straight. Always the upper line.
- **Actual** (clay): cumulative on-task minutes. Rises at the same rate while on task, flattens during drift.

The lines converge or diverge and **never cross**. The vertical distance at the right edge is the session's one number.

### 3.2 Construction rules
- Aspect ratio 3:2. Origin at bottom-left, inset from the edge by one stroke width times four.
- Stroke: 2 units at any rendered size below 64px; 3 units above 240px. Round caps and joins.
- The intended line runs corner to corner. The actual line leaves it once and never returns above it.
- The gap is unfilled at logo sizes. In the review it may take a 6% tint of the actual color. Never a gradient.
- Never rotate, stretch, outline, add a third line, place in a container, or use as a loading spinner.

### 3.3 States

| State | What the mark shows |
|---|---|
| Idle | The logo sample at 40% opacity |
| Running, on task | One line. Clay sits on blue and extends with it |
| Running, drifting | Clay flattens in real time, gap opens |
| Ended | Frozen at final geometry, gap labeled once |
| Empty | Blue line alone, faint. Nothing invented |

### 3.4 The logo
The mark at an honest sample: clay tracks blue for the first third, then falls slightly behind. Not a perfect session (smug), not a disaster (self-defeating).

**Lockup:** mark, gap of half the mark's height, then `MEANT` set in the display face at 600 weight, tracking `0.02em`, cap height matched to the mark's height. Horizontal only, never stacked.

**Favicon:** the mark alone. It survives 16px because it is two strokes and nothing else. That is the whole reason this direction beat the typographic one.

---

## 4. Color

The two data colors are validated against six checks (lightness band, chroma floor, colorblind separation, normal-vision floor, contrast) in both modes. **Do not substitute by eye.** Three earlier candidates failed: clay with sage reads gray and separates at only ΔE 6.9 for deuteranopes; clay with olive separates at ΔE 1.9, which is invisible.

| Role | Light | Dark |
|---|---|---|
| Intended | `#2F5FA8` | `#788FE0` |
| Actual | `#C75B39` | `#D4704B` |
| Ground | `#FDF8F0` | `#17140F` |
| Raised | `#FFFCF6` | `#201C16` |
| Ink | `#241F1B` | `#F5EFE4` |
| Ink secondary | `#5C544C` | `#B6ADA0` |
| Ink muted | `#8B8177` | `#8A8176` |
| Rule | `#E6DDD0` | `#332D25` |

Worst-case colorblind separation for the data pair: ΔE 19.5 light, 21.5 dark. Both far above the ΔE 8 target.

**Rules**
- Clay and blue are **reserved for the two data roles.** Never a button, link, border, or decoration. Clay on screen always means "what actually happened".
- The primary button is ink on ground. The loudest color in the product belongs to the data, not the UI.
- `Yes` and `Not yet` share one color, weight, and size. There is no green and no red in this product.
- No gradients anywhere.
- Secondary ink is warmed from the ground's hue, never neutral gray.

---

## 5. Typography

| Role | Face | Treatment |
|---|---|---|
| Display | Fraunces, 600, opsz 72, SOFT 40 | 36–60px, tracking `-0.02em`, at most one italic word per headline |
| **The user's own sentence** | Fraunces, 400, opsz 24 | 20px popup · 44px block page · 28px review |
| Interface | Public Sans | 15px body, 13px labels, 1.5 line height |
| Figures | Sometype Mono, tabular | 13–15px. Measurement only, never a "technical" costume |

Scale: 13 · 15 · 18 · 22 · 28 · 36 · 44 · 60. Nothing between. Measure caps at 68ch. More space above a heading than below it.

**The one typographic decision that carries the brand:** the user's sentence is always set in the display face, because in this product their words *are* the headline.

---

## 6. Layout, shape, depth

- Space scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
- Radius: 14 on cards and the popup body, 8 on inputs, full round on small pills only.
- Elevation is declared **once** per element, by shadow, never shadow plus border. Real offset, soft blur, warm-tinted, never a zero-offset halo.
- Rules separate, shadows lift. Not both on one element.
- Popup is a fixed 360 wide. Web surfaces are a single centered column, max 720, with the mark allowed to break wider.

---

## 7. Motion

Frequency decides whether a thing animates at all.

| Moment | Frequency | Spec |
|---|---|---|
| Popup open | Dozens/day | **None.** Present on first paint |
| Popup state change | Several/day | Crossfade 160ms, no movement |
| Block page enter | A few/day | Opacity, 8px rise, 3px blur to zero, 240ms strong ease-out |
| Mark extending live | Continuous | Linear, CSS only, off the main thread |
| Review open | Once/session | Sentence first, then rows staggered 50ms |
| Any press | Constant | Scale to 0.97, 160ms ease-out |
| Any exit | — | Faster than its entrance, 120–160ms |

Easing: strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for entrances, `cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement, `cubic-bezier(0.4, 0, 0.2, 1)` for color.

**Rules that outrank taste:** transitions not keyframes for anything retriggerable · never `scale(0)`, entrances begin at 0.95 with opacity · never `ease-in` on UI · never `transition: all` · only transform, opacity, filter, clip-path · reduced motion renders the mark static with its number and keeps crossfades · hover effects gated behind a fine-pointer query.

**Both answer buttons animate identically.** The moment one is celebrated, the other becomes punishment and the honest answer stops being safe to give.

**One authored moment** in the whole product: the review's arrival. Everywhere else, restraint.

---

## 8. Verbal identity

Second person, present tense, short sentences.

| Where | Say | Never |
|---|---|---|
| Popup idle | `What do you mean to do?` | "Enter your task" |
| Popup running | `Started. 68 minutes so far.` | "Focus session initiated" |
| Block page | the sentence, then `That's still true.` | "Stay focused!" · "Access denied" |
| Review opening | `You meant to finish the supplier report.` | "Session summary" |
| The question | `Did you?` | "Mark as complete?" |
| After Yes | `Good. That's 7 of 11.` | "Amazing work!" |
| After Not yet | `Noted. It carries over.` | "Better luck next time" |
| Empty state | `Nothing here yet. Finish something and it will be.` | "No data available" |
| Landing headline | `You meant to finish it.` | anything with "productivity" in it |

**Forbidden after `Not yet`:** encouragement, unrequested explanation of where the time went, any word implying failure, any exclamation mark. Evidence is shown when asked, never as a rebuttal.

Numbers are never softened. The words around them always are.

---

## 9. Applications

| Surface | Mode | Composition |
|---|---|---|
| Popup, 360 wide | Operate | Mark at 40% · display-face input with a live cursor and no placeholder chrome · duration chip · blocklist chip · full-width ink Start. No logo, no nav, no settings gear |
| Popup, running | Operate | Live mark · sentence at 20px · elapsed in mono · quiet Stop |
| Block page | Operate | Ground fills. Live mark at 320 wide · sentence at 44px · one secondary line. No countdown, no logo, no dismiss, no "are you sure". Calm, not alarming: a closed door, not a siren |
| Review | Operate | Sentence 28px · frozen mark full width, gap labeled once · rows of domain, 2-unit clay bar, mono figure, away hatched not colored · the question in display face · two identical buttons |
| Dashboard | Operate | Completion rate as the only headline number · rows of sentence, a 72px mark drawn from that session's real geometry, and the outcome as a word. **No total-hours number anywhere** |
| Landing | Persuade | Cream ground · the mark as the hero object, animating once · display headline in second person · pill CTA · one colored band as a section break. No stock photography |

### Sample session — use these values on every surface so they agree

```
intention   finish the supplier report
elapsed     68 min
on task     53 min      claude.ai 41 · docs.google.com 12
drift       15 min      news site 9 · away 6
gap label   off by 15 min
blocked     2 attempts
outcome     Not yet
ledger      7 of 11 finished
```

---

## 10. Asset manifest — what a generator must produce

| # | Asset | Spec |
|---|---|---|
| 1 | Mark, five states | §3.3, as vector, 3:2 |
| 2 | Logo lockup | Horizontal, plus a reversed version for dark ground |
| 3 | Favicon | Mark alone, legible at 16px |
| 4 | Token set | Every value in §4, §5, §6, §7 as named tokens, light and dark |
| 5 | Popup, three states | Idle, running, unpaired. 360 wide |
| 6 | Block page | 1440 × 900 |
| 7 | Review | 1440 × 1100 |
| 8 | Dashboard | 1440 × 1100 |
| 9 | Landing hero | 1440 × 1600 |
| 10 | Mark system sheet | Five states, sizes at 16 / 24 / 40 / 120 / 320, lockup, favicon, misuse |

---

## 11. Acceptance checklist

A generated artifact ships only if every line is true.

- [ ] The two data colors appear **only** in marks and data bars, never in a control
- [ ] `Yes` and `Not yet` are identical in color, weight, size, and motion
- [ ] No total-hours figure is presented as a headline on any surface
- [ ] The user's sentence is in the display face on every surface it appears
- [ ] The mark's two lines never cross, and the intended line is always the upper one
- [ ] Body text reaches 4.5:1 against its ground in both modes
- [ ] Elevation is declared once per element, never shadow plus border
- [ ] The popup has no entrance animation
- [ ] Reduced motion renders the mark static with its number
- [ ] Nothing on the block page offers a bypass
- [ ] Empty states say what will appear, not "no data"
- [ ] Nothing in §12 appears anywhere

---

## 12. Refuse

Dark UI as default · a Pomodoro dial · progress rings · streaks · celebratory motion · green-good and red-bad · gradient text · glass · stock photography · emoji standing in for icons · sketch-style illustration · grain filters · same-size feature-card grids · an eyebrow above a heading · section numbers · a colored left border · hard offset shadows · monospace as decoration · hero-metric templates · any total-hours number as a headline.
