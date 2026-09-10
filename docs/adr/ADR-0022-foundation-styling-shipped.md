# ADR-0022 — Foundation styling shipped (Phases 1-2 of the UI build)

- **Date:** 2026-09-01
- **Status:** Accepted
- **Context:** `design/tokens.css` and the design system existed only as intent until this point; the class contract needed a real, working implementation before any surface (companion, popup, review) could be built against it.
- **Decision:** `app/globals.css` and `extension/meant.css` implement the class contract against `design/tokens.css`. The mark is CSS states of `.m-mark`, not six SVG files — every artboard draws it with divs; the header logo is the only real SVG. `.m-mark:empty` renders the small decorative glyph; `.m-mark:not(:empty)` becomes the real proportional band (`lib/band.ts`), reusing `.m-row-bar[data-kind]` for both a row swatch and a band segment.
- **Consequences:** Some artboard-vs-doc departures were made deliberately (block page and popup no longer tick, per `docs/design-toolkit.md` §9/§6; the ledger drops duration/domain columns for one band). Full reasoning in `docs/dead-ends.md` and the build plan.
- **Source:** `docs/design-toolkit.md` §2, §6, §8, §9; plan file `you-are-building-the-elegant-deer.md`
