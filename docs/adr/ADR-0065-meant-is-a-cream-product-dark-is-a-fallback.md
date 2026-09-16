# ADR-0065 — MEANT is a cream product; dark is a fallback, not a second look

**Status:** accepted · **Date:** 2026-09-16 · **Supersedes:** nothing · **Closes:** #51 part 1

## Context

`design/tokens.css:54` applies the full dark palette from `prefers-color-scheme: dark`. Nothing
anywhere sets `data-theme`, so on a dark OS — a large share of this audience — MEANT *is* dark and
the user cannot say otherwise.

Two documents said that could not happen. `docs/design-toolkit.md` §9 refuses "dark mode as the
default look" and `docs/design.md` §3.1 says "nothing renders dark by default". Both were false for
any user on a dark OS, and had been for weeks.

It renders correctly. But it arrived by inheritance rather than by choice, and it is near-black —
the exact Rize anti-reference. The question was whether MEANT is a cream product with a dark
fallback, or a product with two equal looks.

## Decision

**A cream product.** `--m-ground: #F3F1EE` is the product's ground. The dark palette is a
**fallback** for a user whose OS asks for one — correct, maintained, and never the reference. Where
the two disagree about how something should look, the cream palette is the answer and the dark one
follows it.

The `data-theme` hooks already in `tokens.css` (`:54`, `:70`) stay. They are what makes a future
explicit toggle possible without touching a single component. No toggle ships now.

## Consequences

- `docs/design-toolkit.md` §9's refusal stands, and its violation note is removed: shipping a dark
  fallback is not "dark mode as the default look".
- `docs/design.md` §3.1's "nothing renders dark by default" is **amended**, not deleted — it was
  describing an intention the code contradicted.
- Every artboard in `design/canvas/` stays cream. A dark artboard would make the fallback a
  reference, which is what this decision refuses.
- Design review judges the cream rendering first. The dark one must be correct, not equal.
- Re-opening this means shipping a `data-theme` toggle and a persistence story, and the class
  contract question (#51 part 3) would want settling first.
