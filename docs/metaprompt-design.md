# Metaprompt — DESIGN session

> Paste this whole file as your first message in a fresh Claude Code session, or run
> `claude "$(cat docs/metaprompt-design.md)"`. It is written to be the entire prompt.

---

You are designing MEANT: a browser extension and web app that makes someone say what they intend to finish, blocks what they chose to avoid, records where their attention actually went, and ends by asking whether they finished it. The number that accumulates is completed outcomes, never hours.

**Read first, in this order, and do not design from memory:**
1. `docs/design-toolkit.md` — the committed visual world. It is a specification, not a suggestion. It contains no assets on purpose; you are producing them.
2. `PRODUCT.md` — product context.
3. `docs/prd-intent.md` §3 and §4, `docs/sitemap-intent.md`, `docs/flow-intent.md` — what each surface has to do.

**Skills to invoke, in this order.** Invoke them, do not paraphrase them from memory:
- `impeccable` — this is a new visual world, so run its `new-work` path. Load `reference/craft-floor.md` before writing any UI code and honor its bans.
- `emil-design-eng` — every motion decision goes through its frequency table and easing rules. The toolkit's §7 already encodes them; the skill is how you get the rest right.
- `apple-design` — only for the gesture and interruptibility questions on the review card, if you add any.
- `dataviz` — the mark is a real chart, not a logo shaped like one. Before touching color, run its validator on any pair you are tempted to change: `node <dataviz-skill>/scripts/validate_palette.js "#hex,#hex" --mode light`. The committed pair already passes; three earlier candidates failed, so do not re-pick by eye.
- `design-review` — run it against your own output before you call anything finished.
- `humanizer` — on every string you write.

**What to produce**, into `design/`:

| # | Artifact | Notes |
|---|---|---|
| 1 | `tokens.css` | Every value in toolkit §4–§7 as named custom properties. Light on bare `:root`; dark under both `@media (prefers-color-scheme: dark)` scoped to `:root:not([data-theme="light"])` and `:root[data-theme="dark"]`. No nested at-rules inside a selector block |
| 2 | `mark.svg` plus the five state variants | Toolkit §3. Colors reference the tokens with literal hex fallbacks so the file works standalone as an `<img>` |
| 3 | `logo.svg`, `logo-reversed.svg`, `favicon.svg` | Lockup rules in §3.4 |
| 4 | `surfaces/*.html` | Static, self-contained mockups of popup idle, popup running, popup unpaired, block page, review, dashboard, landing hero. Real copy from §8, real numbers from §9's sample session, no lorem, no placeholder boxes |
| 5 | `mark-sheet.html` | Five states, sizes at 16 / 24 / 40 / 120 / 320, lockup, favicon, misuse |

**Hard constraints:**
- Google-hosted fonts only (Fraunces, Public Sans, Sometype Mono). No other network requests. These files must render offline.
- Clay and blue appear only in marks and data bars. The primary button is ink on ground.
- `Yes` and `Not yet` are identical in color, weight, size, and motion. If you find yourself adding a green tint to `Yes`, stop: that turns the honest answer into a punishment.
- No total-hours figure as a headline on any surface.
- Everything in toolkit §12 is banned, including in ways you invent.

**How to work:**
1. Build the token set and the mark first. Nothing else can be right until those are.
2. Build all seven surfaces before polishing any of them. A half-polished set hides which composition is wrong.
3. Then inspect **once**, in a single batched round: open the files in a browser, screenshot desktop and the 360 popup together, and list every defect at once. Fix them in one pass. Confirm with at most one more round, then stop. Do not loop.
4. Run impeccable's mechanical detector over the finished HTML: `node ~/.agents/skills/impeccable/scripts/detect.mjs --json design/surfaces/*.html`. Act on findings; do not re-audit by eye.
5. Gate on toolkit §11. Every line true, or the artifact is not done. Report any line you cannot make true and why, rather than quietly dropping it.

**Coordination — a build session is running in parallel in the same repo.** Read `docs/metaprompt-build.md` §Coordination and honor it exactly:
- You own `design/**` and `app/globals.css`. You touch nothing else.
- The build session writes semantic markup using the agreed class names. Your styling targets those names. Do not rename them; if one is wrong, say so and wait.
- Never edit route handlers, `lib/**`, `extension/*.js`, or anything under `docs/`.

**Report at the end:** what you produced, which acceptance lines are green, which are not and why, and every place the toolkit was ambiguous enough that you had to decide. Those decisions get written back into `docs/design-toolkit.md` by the human, not by you.
