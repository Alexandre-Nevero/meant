# Sitemap

**Project:** MEANT
**Date:** 2026-08-18
**Version:** 0.2
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** 2026-09-16 (amendment 0.3 — audited against `app/`)
**Upstream:** [prd-intent.md](prd-intent.md)

> **Amendment 0.3 (2026-09-16).** Two corrections and three additions, all of them against
> shipped code rather than against another document.
>
> - **S9 is rewritten.** The companion **no longer signals drift** (ADR-0057) and the tap means
>   the opposite of what this document said: *"this isn't the work"*, not *"that was work"*
>   (ADR-0058). The disclosure claim attached to it was never built.
> - **Three surfaces were missing from a nine-screen inventory that called itself complete:**
>   **S10** `/setup` (declare work and distraction sites, ADR-0035), **S11** `/sign-in`, and the
>   **app shell** — navigation and the only sign-out in the product, added 2026-09-15.
> - **§4's route table described the product's plan, not its API.** Six routes in it do not
>   exist; five routes that exist were not in it. Marked per row.
> - **§8's permission-prompt line is void** (ADR-0061): there is no permission prompt anywhere,
>   early or late.
>
> **`docs/adr/` outranks this document** (ADR-0063).
>
> **Amendment 0.2c (2026-09-11).** S9's row described the retired gaze design and the cut
> task plan (PRD-F8, D38/ADR-0048) — corrected below to the shipped Orbit companion (ADR-0026),
> which renders as a content-script overlay, not a docked or floating browser surface (SDD Q3,
> resolved). S4/S6's "gains the plan" note below is historical — the plan those amendments
> added was cut three weeks later.
>
> **Amendment 0.2 (2026-08-28).** One new surface (S9, the companion), two amended (S4 gains the plan and the coach; S6 gains the plan), and a disclosure surface that did not exist because the product did not previously read anything.

---

## 1. Navigation Model

Two surfaces, one account.

- **The extension** is where a session is *lived*: declare, start, stop, be blocked, and be accompanied. It is a popup, a block page, and a companion surface — no navigation to speak of, by design. A user in a focus session should never be browsing an app, and must never be typing into one.
- **The web app** is where a session is *understood*: the review after it ends, the coach that speaks there, and the ledger of every session before it. **Amended 2026-09-16:** it also carries the two things a signed-in account needs and nothing else was doing — **navigation between its own surfaces, and a way to sign out**. Until 2026-09-15 the root layout was `<body>{children}</body>`: six routes linked to each other from inside page bodies, `/setup` hung off one link on the dashboard, and **no sign-out action existed at all**.

They meet at exactly two points: the pairing code, and the review tab the extension opens when a session ends.

**The companion is the only always-present surface, and it is the reason the split above holds.** It carries presence during the session so the web app never has to interrupt, and it carries no conversation, so the session never becomes a place you can talk instead of work.

---

## 2. Screen Inventory

| ID | Screen | Surface | Purpose | Serves |
|---|---|---|---|---|
| S1 | Landing | Web | The marketing page; sign-in now lives at S11. **Two open problems, noted 2026-09-16:** its *"It reads the page. It stores nothing"* section is **false since ADR-0061** — nothing is read — and the hero **asks for nothing**, pushing *Sign in* where `Landing.dc.html` specifies *Add to Chrome* (#51) | PRD-F6 |
| S2 | Pairing | Web | Show a short-lived code to paste into the extension | PRD-F6 |
| S3 | Dashboard (the ledger) | Web | Every session with its intention, duration, top domain, and outcome; completion rate at the top | PRD-F5 |
| S4 | Session review | Web | Intention and plan beside time-per-domain, away time, drift-and-returns, blocked attempts; the coach speaks here; then the outcome question | PRD-F4, F12 |
| S5 | Popup — idle | Extension | Intention field, optional duration, blocklist picker, Start | PRD-F1, PRD-F7 |
| S6 | Popup — session running | Extension | Current intention, the plan once it arrives, elapsed time, Stop | PRD-F1, F8 |
| S7 | Popup — unpaired | Extension | Field for the pairing code and a link to S2 | PRD-F6 |
| S8 | Block page | Extension | "You said you would: {intention}" plus time remaining | PRD-F2 |
| **S9** | **Companion** | **Extension** | **Rewritten 2026-09-16 (ADR-0057, ADR-0058).** Presence during a session — a 28px orbital dot, content-script overlay at `<all_urls>` (not docked, not PiP). **One state: a solid, breathing ring.** It never goes dashed and never signals drift. Hover reveals the intention; **one tap means "this isn't the work"** and writes a per-visit label (ADR-0062), acknowledged by a 0.6s ring-collapse. No plan, no steps to mark (PRD-F8 cut). ~~Tapping reveals what it reads and where it goes (V5.7)~~ — **never built, and the tap now has a different job; the disclosure surface is missing** | **PRD-F10** |
| **S10** | **Setup — your sites** | **Web** | **Added to this map 2026-09-16; shipped earlier.** Declare the sites that are work and the sites that are distraction, per ADR-0035 — the data the judge's whole narrower job depends on (`/setup`, `app/setup/page.tsx`). **Carries the most damaging open bug in the product (#42):** a failed fetch renders as "you have no sites," the page stays editable, and saving replaces the stored list wholesale | PRD-F7, ADR-0035 |
| **S11** | **Sign-in** | **Web** | **Added to this map 2026-09-16; shipped earlier.** `/sign-in` is its own route — S1 is the marketing landing, which links to it. Signed out, the app shell renders nothing, so this page and `/` keep their own header | PRD-F6 |
| **—** | **App shell** | **Web (chrome)** | **Added 2026-09-15, and not a screen.** A header on every signed-in surface: brand to `/dashboard`, links to Sessions / Sites / Extension, and **sign out**. Mounted by four route layouts, absent when signed out, no counts and no figures. **It is the one surface with no artboard** — `design/canvas/` holds seven and none shows navigation (`docs/design.md` §6, §10) | — |

**Amended in 0.2:**
- **S4** now shows the plan and which steps moved, the drift-and-return count, the coach's observations, and suggestions that each carry a button. It is also the only surface where the user may type to the coach.
- **S6** now shows the plan beneath the intention once it arrives, and shows nothing where the plan would be while `plan_state = generating`.

~~Nine screens, three of them states of the same popup.~~ **Eleven screens as of 2026-09-16**, three of them states of the same popup, plus one piece of chrome that is not a screen. Anything not on this list is not in v1. The count was wrong for weeks in the safest-looking way: the two missing screens were both *shipped*, so nothing broke — the map simply stopped describing the product.

**Deliberately absent:** any chat input on S5, S6, S8, or S9. Conversation exists on S4 and nowhere else (PRD §5). Any celebration surface during a session (I2). Any screen showing a score or a total-hours figure (IDEA §9).

---

## 3. Information Architecture

```
Web app                          Extension
  /                (S1)            popup  ──┬── unpaired      (S7)
  /sign-in         (S11)                    ├── idle          (S5)
  /pair            (S2)   ┐                 └── running       (S6)
  /dashboard       (S3)   │ ◀── default
  /setup           (S10)  ├── the app shell wraps these four
  /review/[id]     (S4)   ┘ ◀── opened by the extension when a session ends
                                   block page (S8) ◀── served on a blocked navigation
                                   companion  (S9) ◀── opens with the session, closes with it
```

*(Updated 2026-09-16. The shell is mounted by a layout on each of the four routes it wraps —
not a route group, which would have moved directories and broken the relative imports the pages
already use.)*

The dashboard is the web app's home once signed in. The review is reachable from the dashboard as well as from the extension, so a dismissed review is never lost.

---

## 4. Route Table

**Audited against `app/` on 2026-09-16.** The "Built" column is the point of the table: every row
without it was a plan this document was printing as if it were an API.

| Route | Screen | Auth | Built | Notes |
|---|---|---|---|---|
| `/` | S1 | Public | ✅ | Redirects to `/dashboard` when signed in |
| `/sign-in` | S11 | Public | ✅ | **Added to this table 2026-09-16.** Its own route; the landing links to it |
| `/pair` | S2 | Required | ✅ | Generates a code on load; code expires (see SDD §5) |
| `/dashboard` | S3 | Required | ✅ | |
| `/setup` | S10 | Required | ✅ | **Added to this table 2026-09-16.** Work and distraction sites (ADR-0035). See #42 |
| `/review/[sessionId]` | S4 | Required | ✅ | 404 if the session belongs to another account |
| `/api/auth/[...path]` | — | — | ✅ | **Added 2026-09-16.** Neon Auth's own handler (ADR-0021) |
| `/api/pair` | — | Session cookie | ✅ | Mints a pairing code |
| `/api/pair/claim` | — | Public + code | ✅ | Exchanges a code for a device token |
| `/api/device` | — | Device token | ✅ | **Added 2026-09-16.** `DELETE` — unpair this device |
| `/api/lists` | — | Device token | ✅ | **Added 2026-09-16.** `GET`/`PUT` — the declared work and distraction sites S10 edits and the extension reads (ADR-0035). `force-dynamic`, deliberately: a cached `GET` would serve a stale authorization verdict for a token that was just revoked |
| `/api/sessions` | — | Device token | ✅ | Start a session |
| `/api/sessions/:id` | — | Device token | ✅ | **Added 2026-09-16.** `PATCH` — end it |
| `/api/sessions/:id/review` | — | Device token | ✅ | **Added 2026-09-16.** `GET` — the review payload |
| `/api/sessions/:id/outcome` | — | Session cookie | ✅ | **Added 2026-09-16.** `PATCH` — the one answer |
| `/api/events` | — | Device token | ✅ | Batched attention events |
| ~~`/api/sessions/:id/plan`~~ | — | — | **Void** | PRD-F8 is cut (ADR-0048). Never built, never will be |
| ~~`/api/tasks/:id`~~ | — | — | **Void** | Same cut. There are no steps to mark |
| `/api/judge` | — | Device token | ❌ | **Specified, not built, and rewritten 2026-09-15 (ADR-0060, ADR-0061).** A *batch*, after the session, on demand — not per tab. ~~The only route that accepts page content~~: **no route accepts page content; page text and titles are never read.** SDD §4.1 |
| `/api/memory` | — | Device token | ❌ | Specified, not built. The gating cache (I4). It was marked done on a tracker in September and does not exist — `AGENTS.md`'s first tracking rule exists because of this row |
| `/api/reviews/:id/coach` | — | Session cookie | ❌ | Specified, not built. Observations and executable suggestions. Review surface only |

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

**Added to this list in 0.2:** a chat surface during a session; a companion settings panel (the companion has one tap, not a menu); a "streak" or "focus score" surface of any kind; a coach surface anywhere except S4; ~~a permission prompt at install (the broad-access prompt belongs at the moment the user enables deep judging — SDD §5.2 — never on the install screen)~~.

**Corrected 2026-09-16 (ADR-0061, ADR-0027):** the permission-prompt clause is **void**, and not because the prompt moved. **There is no permission prompt in this product at any point.** `<all_urls>` ships unconditionally in the manifest (ADR-0027, 2026-09-07), and the deep-judging tier the prompt was for no longer exists — the judge runs after the session and cannot read a page that is gone. SDD §5.2 is void in full. A surface that was designed, argued over and scheduled is simply not in the product, which is the better outcome: it was the most alarming moment in the funnel.

**Still not in the map, and worth saying while S10 exists:** `/setup` is site declaration, not a settings page. There is no profile page, no notification centre, no export, and no team view.

---

## 9. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| ~~Q1~~ | ~~Automatic review tab, or wait for a click?~~ **Automatic — an unprompted review is what makes A3 testable** | S4 | done |
| ~~Q2~~ | ~~Does S9 render in `chrome.sidePanel` or a Document Picture-in-Picture window?~~ **Answered 2026-09-01: `chrome.sidePanel`, without running the PiP spike** — then **overtaken 2026-09-05 (ADR-0026) by a third option this question never listed:** a content-script Shadow DOM overlay. The side panel was built and retired; PiP was never built. Kept as the trail, not as live input | S9 | done |
| ~~Q3~~ | ~~Is S9 shown by default, or opened by the user?~~ **Answered: opened by Start** — the substance survives the reversal, but the mechanism in the original answer does not. There is no `sidePanel.open()` and therefore no user-gesture requirement; the overlay is injected with the session. Opening on Start is still not an interruption, because the user just took the action that causes it | S9, A9 | done |
| **Q4** | **Does the app shell need an artboard, or is chrome exempt from the canvas?** Opened 2026-09-16. The shell ships; `design/canvas/Shell.dc.html` was step 1 of the work that built it and was never drawn, so a `.tsx` file currently outranks the canvas on a surface every signed-in page shows. Either draw it or record the exemption in `docs/adr/` | The shell, `docs/design.md` §1 | Alexandre |

---

## Self-Check

- [x] Every `S#` traces to a `PRD-F#` — **except the app shell, which is chrome and traces to none**
- [ ] ~~The one surface that reads page content also discloses that it does (S9)~~ **Void 2026-09-16 (ADR-0061): no surface reads page content.** Replaced by an unmet check — **nothing discloses that full visit paths are held on the device** (ADR-0059), and the tap that writes a label has no disclosure at all
- [x] No surface offers typed input during a session
- [x] Every route states its auth requirement
- [x] Cross-account access behavior is specified, not assumed
- [x] §8 lists what was deliberately left out
- [x] Registered in `docs/index.md`
