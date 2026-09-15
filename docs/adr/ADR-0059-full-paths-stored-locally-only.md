# ADR-0059 — Full paths are stored on the device only; I7 is amended

- **Date:** 2026-09-15
- **Status:** Accepted
- **Amends:** I7. Narrows **D8** (hostname only) to server-side storage.
- **Context:** `chatgpt.com` accounts for 38.7% of recorded attention and is both the tool the user works in and the rabbit hole they fall into. A hostname cannot separate those; a path often can — `chatgpt.com/c/…` versus `/gpts` versus `/codex`. The same applies to any large site.

  Storing paths server-side is release-blocking by existing rule: `lib/migrations/002-drift.sql:24` — *"Deliberately no title column and no text column. A migration adding one is the single change that turns this product into surveillance, and it is release-blocking."* And paths are **worse than titles**, not better: a title may read "Untitled document"; a path is a durable, resolvable handle to a specific private artifact — `docs.google.com/document/d/…`, `github.com/acme/unreleased-thing`, `mail.google.com/…/FMfcgz…`.
- **Decision:** **Full paths are recorded in extension local storage only. They are never written to the database.**

  "Local only" was ambiguous and the reading is fixed here: **paths live on the device and transit transiently to the model at analysis time; only the verdict persists.** The alternative reading — never leaving the device at all — would require on-device inference, which IDEA C8 puts behind ~22GB free disk and 16GB RAM, desktop only, and which `apexhuman.md` §2 already rules out by noting Apex states no RAM or disk floor.

  This is an **amendment to I7**, not a clarification. I7's shape is preserved — read in flight, persist only `{domain, verdict, confidence}` — but its implication that nothing beyond hostnames ever transits is no longer true.
- **Consequences:**
  - **The device is not a new exposure class.** The browser already stores full history; this adds nothing the machine did not hold.
  - **Local storage needs a time-based TTL, not an event-based one.** On-demand analysis (ADR-0060) may happen days later or never — free-tier users get tracking but no analysis, so their paths are never consumed at all. "Purge after analysis" would never fire for them. The number is open; the shape is decided.
  - **PRD-F15 grows.** "Forget what you know about me" must clear local path storage, or the promise is false.
  - **It is what makes ADR-0060 viable.** Post-session judging was structurally weak because the page is gone; local paths remove exactly that weakness, at a fraction of the cost of live judging.
  - `event.domain` remains hostname-only server-side, unchanged since v0.1 (D8).
- **Source:** owner decision 2026-09-14; `002-drift.sql:24`, I7, D8, IDEA C8
