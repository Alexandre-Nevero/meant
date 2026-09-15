# ADR-0045 — Cycles ship; a dial and a ticking countdown do not

- **Date:** 2026-09-04
- **Status:** Accepted
- **Context:** `docs/design-toolkit.md` §9 refuses "a Pomodoro dial" and "a countdown that ticks (a live clock invites waiting it out)." That refusal targets the graphic and the live ticking — not the underlying concept of a work/break interval.
- **Decision:** Cycles ship as: adjustable work/break lengths, blocking staying active while only the labelling pauses during a break, a static single-read figure in the popup (recomputed on natural re-render, never a live tick — see ADR-0028/round 6), and a toolbar badge for the phase boundary. No animated dial, no live numbers anywhere.
- **Consequences:** Delivers the practical value of Pomodoro-style cycles while staying inside the product's explicit refusal of dials and countdowns.
- **Source:** `docs/superpowers/plans/2026-09-04-drift-and-cycles.md` ("D39"), `lib/thresholds.ts` (`CYCLE_PRESETS`)
