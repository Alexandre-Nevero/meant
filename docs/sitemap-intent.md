# Sitemap

**Project:** MEANT
**Date:** 2026-08-18
**Version:** 0.2
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** 2026-08-28
**Upstream:** [prd-intent.md](prd-intent.md)

> **Amendment 0.2 (2026-08-28).** One new surface (S9, the companion), two amended (S4 gains the plan and the coach; S6 gains the plan), and a disclosure surface that did not exist because the product did not previously read anything.

---

## 1. Navigation Model

Two surfaces, one account.

- **The extension** is where a session is *lived*: declare, start, stop, be blocked, and be accompanied. It is a popup, a block page, and a companion surface — no navigation to speak of, by design. A user in a focus session should never be browsing an app, and must never be typing into one.
- **The web app** is where a session is *understood*: the review after it ends, the coach that speaks there, and the ledger of every session before it.

They meet at exactly two points: the pairing code, and the review tab the extension opens when a session ends.

**The companion is the only always-present surface, and it is the reason the split above holds.** It carries presence during the session so the web app never has to interrupt, and it carries no conversation, so the session never becomes a place you can talk instead of work.

---

## 2. Screen Inventory

| ID | Screen | Surface | Purpose | Serves |
|---|---|---|---|---|
| S1 | Landing / sign-in | Web | Sign in or sign up. One paragraph explaining the loop | PRD-F6 |
| S2 | Pairing | Web | Show a short-lived code to paste into the extension | PRD-F6 |
| S3 | Dashboard (the ledger) | Web | Every session with its intention, duration, top domain, and outcome; completion rate at the top | PRD-F5 |
| S4 | Session review | Web | Intention and plan beside time-per-domain, away time, drift-and-returns, blocked attempts; the coach speaks here; then the outcome question | PRD-F4, F12 |
| S5 | Popup — idle | Extension | Intention field, optional duration, blocklist picker, Start | PRD-F1, PRD-F7 |
| S6 | Popup — session running | Extension | Current intention, the plan once it arrives, elapsed time, Stop | PRD-F1, F8 |
| S7 | Popup — unpaired | Extension | Field for the pairing code and a link to S2 | PRD-F6 |
| S8 | Block page | Extension | "You said you would: {intention}" plus time remaining | PRD-F2 |
| **S9** | **Companion** | **Extension** | **Presence during a session. Faces the work; turns on drift. Shows the plan with its silent marks. One tap un-marks a task or says "that was work." Tapping the companion itself reveals what it reads and where it goes (V5.7)** | **PRD-F8, F9, F10** |

**Amended in 0.2:**
- **S4** now shows the plan and which steps moved, the drift-and-return count, the coach's observations, and suggestions that each carry a button. It is also the only surface where the user may type to the coach.
- **S6** now shows the plan beneath the intention once it arrives, and shows nothing where the plan would be while `plan_state = generating`.

Nine screens, three of them states of the same popup. Anything not on this list is not in v1.

**Deliberately absent:** any chat input on S5, S6, S8, or S9. Conversation exists on S4 and nowhere else (PRD §5). Any celebration surface during a session (I2). Any screen showing a score or a total-hours figure (IDEA §9).

---

## 3. Information Architecture

```
Web app                          Extension
  /                (S1)            popup  ──┬── unpaired      (S7)
  /pair            (S2)                     ├── idle          (S5)
  /dashboard       (S3)  ◀── default        └── running       (S6)
  /review/[id]     (S4)  ◀── opened by the extension when a session ends
                                   block page (S8) ◀── served on a blocked navigation
                                   companion  (S9) ◀── opens with the session, closes with it
```

The dashboard is the web app's home once signed in. The review is reachable from the dashboard as well as from the extension, so a dismissed review is never lost.

---

## 4. Route Table

| Route | Screen | Auth | Notes |
|---|---|---|---|
| `/` | S1 | Public | Redirects to `/dashboard` when signed in |
| `/pair` | S2 | Required | Generates a code on load; code expires (see SDD §5) |
| `/dashboard` | S3 | Required | |
| `/review/[sessionId]` | S4 | Required | 404 if the session belongs to another account |
| `/api/pair` | — | Session cookie | Mints a pairing code |
| `/api/pair/claim` | — | Public + code | Exchanges a code for a device token |
| `/api/sessions` | — | Device token | Start / end a session |
| `/api/events` | — | Device token | Batched attention events |
| `/api/sessions/:id/plan` | — | Device token | Generates the plan; fire-and-forget, never blocks Start |
| `/api/tasks/:id` | — | Device token or session | Mark, un-mark, edit, remove a step |
| `/api/judge` | — | Device token | The only route that accepts page content, and it stores none of it (SDD §5.1) |
| `/api/memory` | — | Device token | The gating cache the worker reads to avoid judging a known domain |
| `/api/reviews/:id/coach` | — | Session cookie | Observations and executable suggestions. Review surface only |

---

## 5. Access Boundaries

| Boundary | Rule |
|---|---|
| Web pages | Neon Auth session required for everything except `/` |
| Extension → API | Device token in a header; a request with no valid token is rejected, never queued server-side |
| Row ownership | Every session, event, and outcome row carries a user id, and every query filters on it. There is no "shared" or "public" state anywhere in v1 |
| Cross-account access | A review or session belonging to another user returns 404, not 403 — the existence of another user's session is not disclosed |

---

## 6. Entry Points From Outside

| Entry | Lands on | Notes |
|---|---|---|
| Extension icon | S5 / S6 / S7 depending on state | The main entry, every day |
| Session end (automatic) | S4 in a new tab | The only time the product interrupts |
| Blocked navigation | S8 | Replaces the page the user tried to open |
| Direct link to the web app | S1 → S3 | |

---

## 7. Responsive and Platform Variants

Desktop Chrome and Edge, on macOS and Windows, identical. The popup is a fixed 360px. The web app should not break on a narrow window, but no mobile design work is in v1 — the product cannot function on a phone, since the extension cannot run there.

---

## 8. Not in the Map

Settings page, profile page, blocklist management as its own screen (it lives in the popup), onboarding tour, notifications centre, export, team views.

**Added to this list in 0.2:** a chat surface during a session; a companion settings panel (the companion has one tap, not a menu); a "streak" or "focus score" surface of any kind; a coach surface anywhere except S4; a permission prompt at install (the broad-access prompt belongs at the moment the user enables deep judging — SDD §5.2 — never on the install screen).

---

## 9. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| ~~Q1~~ | ~~Automatic review tab, or wait for a click?~~ **Automatic — an unprompted review is what makes A3 testable** | S4 | done |
| ~~Q2~~ | ~~Does S9 render in `chrome.sidePanel` or a Document Picture-in-Picture window?~~ **Answered: `chrome.sidePanel`, without running the PiP spike.** `sidePanel.open()` needs a user gesture the extension already has at Start; PiP's own gesture-and-dies-with-opener requirements weren't worth spending against a certain, docked alternative. The spike is recorded as unrun, not skipped silently | S9 | done |
| ~~Q3~~ | ~~Is S9 shown by default, or opened by the user?~~ **Answered: opened by Start.** `sidePanel.open()` is called from the popup's Start click handler — the only user gesture in the flow — not via a message to the service worker, which would lose it. Opening on Start is not an interruption because the user just took the action that causes it | S9, A9 | done |

---

## Self-Check

- [x] Every `S#` traces to a `PRD-F#`
- [x] The one surface that reads page content also discloses that it does (S9)
- [x] No surface offers typed input during a session
- [x] Every route states its auth requirement
- [x] Cross-account access behavior is specified, not assumed
- [x] §8 lists what was deliberately left out
- [x] Registered in `docs/index.md`
