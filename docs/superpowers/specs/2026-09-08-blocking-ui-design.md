# Design — Blocking UI: the interstitial's missing referent, and the popup's mismatched label

**Date:** 2026-09-08 · **Traces to:** Task 11 (design pass ahead of Task 12's implementation).
Refines two existing surfaces — `extension/blocked.html`/`blocked.js` and the popup's
blocklist chip group in `extension/popup.js` — no new surface, no new visual world.

## Problem

**1. The block interstitial never names what it blocked.** `chrome.declarativeNetRequest`
redirects the whole tab to `blocked.html?d=<domain>` (`extension/sw.js:20,46`) — the address
bar now reads the extension's own URL, and `d` is read into JS (`blocked.js:4`) but never
rendered. Today's page shows exactly three things: the user's intention (`.m-sentence`),
"That's still true." (`.m-meta`), and time left (`.m-row-figure`). A user who lands here
without having consciously typed the blocked URL a second ago — a stale tab, a link click, a
bookmark — has no on-screen confirmation of *what* just got blocked. `design/canvas/
BlockPage.dc.html`, the visual-truth artboard, also never names a domain — but the artboard
only had to render one clean demo screen, not resolve this ambiguity for a real session. This
design deviates from the canvas on that one point, deliberately, using only the surface's
existing classes and tokens (no new visual language) — flagged here per DESIGN.md's
hierarchy-of-truth rule that a departure from canvas must be stated, not silently made.

**2. The popup's "blocking N" label doesn't match its own sibling label, and doesn't match
itself across states.** In the idle popup, the blocklist chip group is headed by a live count,
`blocking ${blockedValues.length}` (`popup.js:345`), updated on every chip add/remove
(`popup.js:351`). Its paired group directly above it — the work-sites chips — is headed by a
plain descriptive label, `where it happens` (`popup.js:359`), no count. The same visual
cluster (`data-chip-layout="cluster"`, `popup.js:363-365`, built specifically so the two
groups "read as one related cluster") uses two different label grammars for two structurally
identical groups. Separately, the *running*-state popup renders the same underlying concept —
which domains are blocked — as a joined list, `blocking: ${session.blockedDomains.join(', ')}`
(`popup.js:468`), not a count. Same idea, two different shapes, in two screens of the same
popup.

## Flow

Interstitial (no new flow — same render path, richer output):

```
declarativeNetRequest redirects -> blocked.html?d=<domain> loads
  -> render() reads chrome.storage.local session
     no session -> unchanged: "No session is running." (early return, no footer)
     session exists -> .m-sentence (intention, unchanged)
                        .m-meta "That's still true." (unchanged)
                        .m-row-figure: "<domain> — <remaining-or-elapsed text>" (changed —
                          today this line is remaining-time text alone)
```

Popup idle state (no new flow — same chip-group construction, static label instead of a
live-updating one):

```
idle() builds blockGroup
  -> label text is the literal string "what to block" (was: template-computed count)
  -> no onChange side effect needed for the label anymore (removed)
  -> chip row itself is unchanged: same chipGroup(), same add/remove/dedup behavior
```

## Components

| Unit | Does | Does not |
|---|---|---|
| `extension/blocked.js` (`remainingText`) | Renamed in effect to build the full footer string: `${domain} — ${timeText}`, where `timeText` is the existing "N minutes left" / "N minutes in" logic, unchanged. Reads `domain` from the existing `URLSearchParams` (already parsed at module scope, `blocked.js:4`). Falls back to `timeText` alone if `domain` is falsy (defensive — this page is only ever opened with `?d=`, but a bare/manual load shouldn't crash or print `"undefined — ..."`). | Add a fourth DOM node, a new class, a new color, or any motion. Still exactly the three elements the surface renders today: `.m-sentence`, `.m-meta`, `.m-row-figure`. |
| `extension/blocked.js` (`render`) | Unchanged shape — same three `el(...)` calls, same early-return "no session" path. Only the string passed to the `.m-row-figure` node changes. | Change what happens when there's no session, add a heading, add a mark, add a link, or add any interactive control. `BlockPage.dc.html`'s "just the outline holding the sentence" framing still holds — this adds one fact to an existing line, not a new element. |
| `extension/popup.js` (`idle`, blockGroup) | Replace the `blockingLabel` text with the literal `'what to block'`. Delete the `onChange` handler that rewrote its text (`popup.js:351`) since the label no longer varies. `chipGroup(...)`'s own behavior, the chip row, add/remove, and `onRemove` (still needed for `removeFromList('distract', domain)`) are all unchanged. | Touch `workSites`'s `where it happens` label (already correct — this brings the other label in line with it, not vice versa). Touch the running-state summary line (`popup.js:468`, `blocking: x, y, z`) — that line already communicates a real list clearly and serves a different job (a status readout, not an input-group header); left as-is, see Out of scope. |

## Contracts

**Interstitial footer string, exact shape:**
`` `${domain} — ${remainingOrElapsedText}` ``
- Planned session: `instagram.com — 27 minutes left`
- Open-ended ("until I stop") session: `instagram.com — 12 minutes in`
- No `domain` (defensive fallback only): `27 minutes left` — never prints `undefined`,
  never a raw empty string with a dangling `— `.

**Placement, unchanged:** the domain fact is folded into the existing bottom-most,
lowest-emphasis line (`.m-row-figure`: 14px, mono, `--m-ink-3`) — it does not become a new
first line or a new heading. The reasoning is deliberate, not incidental: the sentence the
user wrote stays the first and largest thing on the page (44px `.m-sentence`, unchanged), and
"That's still true." stays the first reassurance. Naming the blocked site is real information
the user needs, but it is not the thing this page leads with — leading with it would read as
calling out the temptation instead of restating the intention, which is exactly what §7's
"You meant to" over "Your goal" register refuses. Demoting it to the same muted, factual
register as "27 minutes left" keeps it informational, not accusatory — and repeat visits to
the same blocked domain within one session render the identical muted line each time, never
escalating in size, color, or wording.

**No new class, no new color, no new motion.** `.m-row-figure`'s existing rule
(`[data-surface="block"] .m-row-figure { font-size: 14px; color: var(--m-ink-3); }`) applies
unchanged — a longer string in an existing node, nothing else. Verified against §9's refusals
before finalizing: no score/percentage/hours, no color change on the domain text, no icon, no
countdown-that-ticks (still a single read on load, per the existing comment at
`blocked.js:22`), no shaming adjective anywhere in the string.

**Popup label, exact string:** the idle-state blocklist group header is the literal string
`what to block`, matching `where it happens` in tense, register, and the absence of a number —
both are now static, lowercase, present-tense phrases naming what the group below them is for,
not a live count of it. `el('p', 'm-meta', 'what to block')` replaces
`` el('p', 'm-meta', `blocking ${blockedValues.length}`) ``; delete the `onChange` arm that
wrote to `blockingLabel.textContent` (`popup.js:351`) — `onRemove` on the same `chipGroup` call
stays, since it still drives `removeFromList('distract', domain)`.

## Out of scope

- Rewording the running-state summary line (`blocking: ${session.blockedDomains.join(', ')}`,
  `popup.js:468`). It already reads as a clear, factual list and does a different job (a status
  readout for an already-started session, not an input-group header being configured) — no
  inconsistency was found there worth a rewrite, only in the idle-state label against its own
  sibling.
- Any affordance to leave the block page (a "go back" link/button). The browser's own back
  button already returns to whatever was open before the blocked navigation; adding a second,
  in-page escape hatch is a new interactive element this page has never had and isn't what
  either gap above is about.
- Growing the block page's information beyond the one added fact (e.g., a "why is this
  blocked" explainer, or a link to change the blocklist). Out of scope for this pass — the
  ask was to close the "what got blocked" gap and the label mismatch, not redesign the page.
- Touching `design/canvas/BlockPage.dc.html` itself. The artboard is visual truth for what it
  depicts; this document records a reasoned, narrow deviation from it rather than editing the
  canvas file, since editing canvas is a design-authority action outside a "refine two existing
  surfaces" task.
