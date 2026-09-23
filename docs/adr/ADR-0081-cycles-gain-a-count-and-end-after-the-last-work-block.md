# ADR-0081 — Cycles gain a count, and a timed session ends after its last work block

- **Date:** 2026-09-23
- **Status:** Accepted
- **Amends:** ADR-0045 — its cycle semantics only. No dial and no ticking number, unchanged.
- **Context:** Owner request 2026-09-23, "labels of time on the popup". The presets read `25/5`
  and `50/10`, fractions a first-time user has to decode, and a preset could only ever run one
  cycle (25/5 was a 30-minute session). A longer block meant custom "until I stop", which has no
  end and therefore never asks "Did you?" on its own.
- **Decision:** The presets read `25 work · 5 break` and `50 work · 10 break`. A `× N cycles`
  stepper (1–8, default 1) sits in the preset row before `custom` and applies to the presets and
  to custom "timed"; it is hidden for "until I stop" and "no cycles". A timed session's length is
  `count × work + (count − 1) × break`: **it ends after the last work block**, not after a
  trailing break, so the question arrives when the work does rather than after five minutes the
  user may have walked away from.
- **Consequences:** 25/5 ×1 is now 25 minutes, not 30 — a behaviour change for every returning
  user on a preset. A `lastChoice` saved before this ADR (no `count`) restores as count 1. The
  server stores no new column: `planned_minutes` already carries the length, and `cycle.count`
  lives only on the device. The cycle arithmetic moves to `extension/lib/cycles.js` so it is
  unit-tested rather than living inside the popup's DOM code.
- **Source:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §1; owner brainstorm 2026-09-23.
