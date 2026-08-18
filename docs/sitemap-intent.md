# Sitemap

**Project:** Intent
**Date:** 2026-08-18
**Version:** 0.1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Upstream:** [prd-intent.md](prd-intent.md)

---

## 1. Navigation Model

Two surfaces, one account.

- **The extension** is where a session is *lived*: declare, start, stop, and be blocked. It is a popup and a block page — no navigation to speak of, by design. A user in a focus session should never be browsing an app.
- **The web app** is where a session is *understood*: the review after it ends, and the ledger of every session before it.

They meet at exactly two points: the pairing code, and the review tab the extension opens when a session ends.

---

## 2. Screen Inventory

| ID | Screen | Surface | Purpose | Serves |
|---|---|---|---|---|
| S1 | Landing / sign-in | Web | Sign in or sign up. One paragraph explaining the loop | PRD-F6 |
| S2 | Pairing | Web | Show a short-lived code to paste into the extension | PRD-F6 |
| S3 | Dashboard (the ledger) | Web | Every session with its intention, duration, top domain, and outcome; completion rate at the top | PRD-F5 |
| S4 | Session review | Web | Intention beside time-per-domain, away time, blocked attempts, and the outcome question | PRD-F4 |
| S5 | Popup — idle | Extension | Intention field, optional duration, blocklist picker, Start | PRD-F1, PRD-F7 |
| S6 | Popup — session running | Extension | Current intention, elapsed time, Stop | PRD-F1 |
| S7 | Popup — unpaired | Extension | Field for the pairing code and a link to S2 | PRD-F6 |
| S8 | Block page | Extension | "You said you would: {intention}" plus time remaining | PRD-F2 |

Eight screens, three of them states of the same popup. Anything not on this list is not in v1.

---

## 3. Information Architecture

```
Web app                          Extension
  /                (S1)            popup  ──┬── unpaired      (S7)
  /pair            (S2)                     ├── idle          (S5)
  /dashboard       (S3)  ◀── default        └── running       (S6)
  /review/[id]     (S4)  ◀── opened by the extension when a session ends
                                   block page (S8) ◀── served on a blocked navigation
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

---

## 5. Access Boundaries

| Boundary | Rule |
|---|---|
| Web pages | Clerk session required for everything except `/` |
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

Settings page, profile page, blocklist management as its own screen (it lives in the popup), onboarding tour, notifications centre, export, team views. Each was considered and each loses to the four-hour budget.

---

## 9. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Does the review open automatically in a new tab, or wait for the user to click the extension? *(Provisional: automatic — an unprompted review is what makes A3 testable.)* | S4 | Alexandre |

---

## Self-Check

- [x] Every `S#` traces to a `PRD-F#`
- [x] Every route states its auth requirement
- [x] Cross-account access behavior is specified, not assumed
- [x] §8 lists what was deliberately left out
- [x] Registered in `docs/index.md`
