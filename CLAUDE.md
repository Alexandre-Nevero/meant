# MEANT

Browser extension plus web app. See `PRODUCT.md` for what it is, `apexhuman.md` for who
it is for and why it must be rebuildable, `docs/` for canonical truth.

## Design — read before touching any UI

1. **`design/tokens.css` is the contract.** Import it. Use `var(--m-*)`.
   **Never write a hex value in a component.** If a colour is missing, it belongs in
   tokens first, or it does not belong.
2. **`docs/design-toolkit.md` is the spec.** §2 the mark, §3 the companion, §6 motion,
   §9 what to refuse, §10 how it is judged.
3. **The design canvas is visual truth.** The artboards outrank both files above.
   When they disagree, the canvas is right and the docs are stale — say so, do not
   silently pick one.

## Invariants that are design decisions

- `Yes` and `Not yet` are identical in colour, weight, size, and motion.
- Quantities render on the dashboard: attended time, counts, shares, and change against the previous period (ADR-0068). Nothing renders a composite productivity score, and no figure carries a colour that grades it.
- The popup animates nothing. It is opened dozens of times a day.
- Nothing good happens on screen during a session. Positive feedback lives in the review.
  **No exception since ADR-0057** — the return-pulse died with the drift signal.
- The companion never varies with the outcome answer, and **never signals drift** (ADR-0057).
  It moves only when the user causes it to: one tap means *"this isn't the work"* (ADR-0058),
  acknowledged by a 160ms ring-collapse (600ms, static, under reduced motion). A receipt is not
  celebration.
- Away is a hatch, never a solid grey.

## Verifying UI

Static code and a clean build are not evidence. Render it and look.

```bash
node ~/.agents/skills/impeccable/scripts/detect.mjs <files|url>   # floor only: [] on a .tsx proves nothing
node ~/.agents/skills/impeccable/scripts/detect.mjs --viewport 390x844 <url>
~/.claude/skills/gstack/browse/dist/browse goto <url> && ... screenshot
```

## Decisions — `docs/adr/` is the most up-to-date information here

**ADR-0063.** Where an ADR and any other document disagree — PRD, SDD, IDEA, `PRODUCT.md`,
`apexhuman.md`, this file — **the ADR is right and the other document is stale.** Say so, then
reconcile; never silently pick one. Every change of decision is written as an ADR, one file per
decision, append-only. **A decision not in `docs/adr/` has not been made.** An ADR records a
decision already taken, never one that is proposed.

## Skill routing

- Visual world, new surface, or a redesign → `/impeccable`
- Motion decisions → `/emil-design-eng`
- Mockups and design exploration → `/design`
- Product ideas → `/office-hours` · Bugs → `/investigate` · QA → `/qa` · Ship → `/ship`
