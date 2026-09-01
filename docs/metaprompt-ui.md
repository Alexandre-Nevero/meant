# Metaprompt — UI/UX build

> Paste this whole file as the first message in a fresh Claude Code session, or run
> `claude "$(cat docs/metaprompt-ui.md)"`.
>
> **Supersedes `docs/metaprompt-design.md` and `docs/metaprompt-build*.md`,** which describe
> the 0.1 build (no AI, corporate persona, four-hour clock) and will mislead you. Do not run them.

---

You are building the interface for **MEANT**: a Chrome/Edge MV3 extension plus a Next.js web app. It makes someone say what they mean to finish, turns it into a short plan, blocks what they chose to avoid, watches alongside them and notices when they drift, and ends by asking whether they finished it.

**The situation you are walking into.** The design is finished and the product is unstyled. There is a committed visual world — seven artboards, a token file, a written toolkit — and `app/globals.css` does not exist. The markup carries the class contract and nothing styles it. MEANT currently renders as browser-default HTML.

Your job is to close that gap and then build the surfaces nobody has drawn.

---

## Read first, in this order. Do not design from memory.

1. **`design/canvas/*.dc.html`** — seven artboards. **This is visual truth and it outranks every other file.** Landing, Main (the review), Ledger, PopupIdle, PopupRunning, BlockPage, Companion. Open them in a browser before you write a line.
2. **`design/tokens.css`** — every colour, radius, stroke, duration. Lifted from the artboards.
3. **`docs/design-toolkit.md`** — §2 the mark, §3 the companion, §6 motion, §9 refuse, §10 acceptance.
4. **`CLAUDE.md`** — the six invariants that are design decisions.
5. **`docs/prd-intent.md`** §3.1 (I1–I9) and §4 (acceptance criteria), **`docs/sitemap-intent.md`** (S1–S9), **`docs/flow-intent.md`** (edge cases E1–E12).
6. **`context.md`** §5–§7 — why this must stay rebuildable, and why it gets filmed.

When the artboards and a doc disagree, the artboards are right and the doc is stale. **Say so; do not silently pick one.**

---

## Skills

Invoke, do not paraphrase from memory.

| Skill | When | Scope |
|---|---|---|
| `ui-ux-pro-max` | Accessibility rules, icon lookup, font metrics, motion presets, chart specs | **`--domain ux · icons · google-fonts · gsap · charts` ONLY** |
| `emil-design-eng` | **Every** motion decision, without exception | Frequency table, easing, duration, interruptibility |
| `impeccable` | Any surface you are designing rather than transcribing | Load `reference/craft-floor.md` before editing UI |
| `apple-design` | The companion's presence and the side panel only | Gesture, material, restraint |
| `chrome-extensions` | Side panel, MV3 CSS, extension surfaces | |
| `vercel:nextjs` | App Router specifics. Do not write route handlers from memory | |
| `verification-before-completion` | Before any claim that something works | |
| `systematic-debugging` | The moment anything behaves unexpectedly. No guess-patching | |

### The one hard rule about `ui-ux-pro-max`

**Use its data. Never its taste.**

It is a searchable database — 119 UX guidelines, 105 icons, 74 font pairings, 192 palettes, 79 styles. The guidelines and icons are orthogonal to aesthetics and genuinely useful. The palettes and styles are not: MEANT has a committed visual world that took two rounds to reconcile, and its top style hit for this product is Swiss minimalism — `border-radius: 0`, monochrome, no shadow — which is the exact opposite of MEANT's capsules and clay.

```bash
S=~/.agents/skills/ui-ux-pro-max
python3 $S/scripts/search.py "<query>" --domain ux --max-results 5      # yes
python3 $S/scripts/search.py "<query>" --domain icons --max-results 5   # yes
python3 $S/scripts/search.py "<query>" --domain style                   # NO
python3 $S/scripts/search.py "<query>" --domain color                   # NO
python3 $S/scripts/search.py "<query>" --design-system                  # NO
```

Every colour, radius, duration and font already exists in `design/tokens.css`. **If a value is not in that file, it does not go in a component — it goes in the token file first, or it does not exist.**

---

## Invariants — breaking one is a bug, not a refactor

1. **No hex in any component.** `var(--m-*)` only.
2. `Yes` and `Not yet` are **byte-identical** in colour, weight, size, and motion. A green tint on `Yes` turns the honest answer into a punishment.
3. **No total-hours figure, no percentage, no score, on any surface.**
4. **The popup animates nothing.** It is opened dozens of times a day.
5. **Nothing good happens on screen during a session.** Every positive event — a finished step, a return from drift — waits for the review.
6. **The companion's appearance never varies with the outcome answer.**
7. **Companion motion budget:** ≤3 noticeable movements per 25 minutes, none in the first 60 seconds. Breathing and blinking do not count.
8. Away is a **hatch**, never a solid grey.
9. `<all_urls>` never in `host_permissions`. `optional_host_permissions` only, requested at the moment the user enables deep judging.
10. **Every feature above the mechanical loop is independently removable** (I9). Judge off, companion off, memory off, coach off — the product still runs and is still worth using. Exercise each seam; do not assert it.

---

## Phases — sequenced by dependency, not by a clock

There is **no time limit on this build**. The constraint is that a non-technical student must be able to rebuild a defined subset in 4–8 hours (`context.md` §6). That means: no decision points left implicit, every step producing a visible change on screen, and no step that blocks the steps after it.

### Phase 1 — Foundation. Nothing else counts until this is done.
- `app/globals.css` — imports `design/tokens.css`, styles all thirteen `.m-*` classes.
- `extension/*.css` — same tokens, no build step, no bundler.
- `design/mark.svg` plus its five state variants: `idle · running · drifting · ended · empty`.
- **Done when:** `/dashboard`, `/review/[id]`, the popup and the block page are visually indistinguishable from their artboards, side by side, in a browser.

### Phase 2 — The path nobody designed, which everybody sees first.
Popup unpaired (S7) → pairing (S2) → empty ledger → error states (expired code, offline, gateway down E9, revoked token E8).
- **Done when:** a fresh install reaches a first review without meeting one unstyled or undesigned screen.

### Phase 3 — The companion.
`.m-mark[data-state="drifting"]` has been in the class contract since 0.1 and is **set nowhere in the code.** Wiring it is the smallest possible version of shipping the companion.
- Gaze: settled → aperture low, aligned with the band. Drifting → aperture risen, opened, stroke 1.5px → 2px. One move.
- Aliveness: breathe ~4.2s, blink ~6.7s. Sub-perceptual. Must never read as animation.
- Surface: `chrome.sidePanel` (certain) — Document Picture-in-Picture is a 30-minute spike, not a commitment. **Never `<all_urls>`.**
- Must read at 80–120px, and the gaze must read at that size.
- **Done when:** a 25-minute screen recording shows ≤3 noticeable movements, none in the first 60s, and none on any positive event.

### Phase 4 — The 0.2 surfaces.
Plan editing (US-07) · un-mark a step, which is also the training-label path (US-10) · the coach in the review, the only place typing is allowed anywhere (PRD-F12) · memory patterns **and their silence below the evidence threshold, which is the harder design** (I6) · the disclosure (one tap → what it reads, where it goes) · **the permission moment** (SDD §5.2).

> **Before designing the permission moment, check SDD Q8.** If hostname + page title alone clears the precision floor, tier T-B never ships and this screen never has to exist. Half a day of labelling can delete the hardest design problem in the product. Do that first.

### Phase 5 — The passes that are always skipped.
Narrow width for the web app · the companion at ~320px · **dark mode, which `design/tokens.css` defines and not one artboard proves** · `prefers-reduced-motion` on every animated element · keyboard and focus-visible throughout.

---

## Method

- **Build all the surfaces in a phase, then inspect once.** Batched round: desktop and narrow together, light and dark together. List every defect at once, fix in one pass, confirm with at most one more round, then stop. Do not loop — open-ended self-QA does worse what the review gates do better.
- **Render it and look. Every time.** A clean `tsc` is not evidence.

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs <files|url>
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <url>
~/.claude/skills/gstack/browse/dist/browse goto <url>
```

- The detector flags **Fraunces as an overused font**. The brief pins it deliberately. **The brief wins — do not change the typeface.**
- **Every step must produce a visible change on screen.** This build gets filmed and rebuilt by beginners; console output is bad television and worse teaching.
- Keep a running log of every dead end. It becomes the manual's troubleshooting chapter and it cannot be reconstructed afterwards.

## Review gates — gstack

| Gate | When |
|---|---|
| `/plan-design-review` | After you write the plan, before you build |
| `/plan-eng-review` | Same point. Locks the architecture |
| `/design-review` | After each phase, against the running app |
| `/qa` | After Phase 3 and Phase 4 |
| `/ship` | Only when the definition of done is met |

## Definition of done

- Every surface matches its artboard side by side, in a browser, light and dark.
- No hex literal in any component. `grep -rn "#[0-9a-fA-F]\{6\}" app extension --include=*.tsx --include=*.js` returns nothing outside `globals.css` and the mark SVGs.
- `Yes` and `Not yet` differ in no visual property. Verified by inspection, not by intent.
- No hours figure, no percentage, no score, anywhere.
- The popup runs no animation.
- Each of the four seams (judge, companion, memory, coach) switched off in turn, product still usable each time.
- 25-minute recording: companion moves ≤3 times, never in the first minute, never on a positive event.
- `npx tsc --noEmit` and `npm run build` clean.
- Every dead end recorded.

**Report exactly what works, what is stubbed, and what is missing.** If an artboard and a doc disagreed, say which you followed and why. Do not describe a partially styled surface as done.
