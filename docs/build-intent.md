# Build Run-of-Show

**Project:** Intent
**Date:** 2026-08-18
**Version:** 0.1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Parent:** [sdd-intent.md](sdd-intent.md)

---

> **Agent Instructions**
>
> **Use when:** the four-hour build is about to start, or is running and behind schedule.
> **Requires:** [sdd-intent.md](sdd-intent.md) (schema, endpoints, invariants) and [prd-intent.md](prd-intent.md) §4 (acceptance criteria).
> **Minimum viable fill:** §2 task table and §4 cut line. §3 is read on the day.
> **Output file:** `docs/build-intent.md`
> **After the build:** record what actually happened in §5, then close the loop in IDEA §10.

---

## 1. Purpose and scope

The order to build in, what each step costs in minutes, and what gets dropped when the clock wins. This document is dead the moment the four hours end; it does not describe the product, only one sitting.

**Ground rule:** the demo path (IDEA §4) must be runnable end to end by minute 210, even if features are missing from it. Never leave the loop broken in the middle to make one link nicer.

---

## 2. Task table

| ID | Task | Minutes | Ends at | Done when |
|---|---|---|---|---|
| T1 | Provision: `vercel link`, add Neon and Clerk from the Marketplace, `vercel env pull`, apply `schema.sql` | 20 | 0:20 | Four tables exist and the app reads `DATABASE_URL` |
| T2 | Next.js + Clerk: sign-in works, `/dashboard` renders an empty state | 20 | 0:40 | You can sign in and land on the dashboard |
| T3 | Pairing: `POST /api/pair`, `/pair` page showing the code, `POST /api/pair/claim` | 20 | 1:00 | `claim` returns a token and writes a `device` row |
| T4 | Extension skeleton: manifest (`declarativeNetRequest`, `tabs`, `storage`, `alarms`), popup unpaired → paste code → token in `chrome.storage.local`, idle state | 30 | 1:30 | Popup shows the idle state after pairing |
| T5 | Session start/stop: `POST /api/sessions`, `PATCH /api/sessions/:id`, session state persisted in `chrome.storage.local` | 30 | 2:00 | A session row opens and closes with the right timestamps |
| T6 | Attention: `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged`, 30s alarm flush, `POST /api/events` | 35 | 2:35 | Switching tabs produces `event` rows with sane seconds |
| T7 | Blocking: `updateDynamicRules` on start, remove on end, block page showing the intention | 20 | 2:55 | Blocked domain is blocked during, and only during, a session |
| T8 | Review `/review/[id]`: group-by aggregation, intention, away, block hits, Yes/No | 30 | 3:25 | Answering writes `outcome` and `answered_at` |
| T9 | Dashboard: session list plus completion rate | 15 | 3:40 | Three sessions visible with their outcomes |
| T10 | Rehearse the demo twice; run T1, T2, T4, T7 from SDD §8.1 | 20 | 4:00 | Demo path runs twice with no reload |

**240 minutes, fully allocated.** There is no slack in this plan, which is why §4 exists.

---

## 3. Decisions already made — do not re-open during the build

| Thing | Decision | Where it came from |
|---|---|---|
| Blocklists | Three hardcoded arrays in the extension source. No editing UI (PRD-F7 is unscheduled) | Cut line |
| Categories | None. Domains are shown raw; nothing is classified | PRD §6 |
| Stored data | Hostname only. Never a path, query string, or title | SDD V5 |
| Timers | No `setInterval`, no in-memory elapsed counters. Compute from stored timestamps | SDD §1 |
| Migrations | `schema.sql` applied by hand | SDD §3.2 |
| Store publication | None. Loaded unpacked | PRD §9 |

Every row above is a decision that will *feel* worth revisiting at minute 150. It is not.

---

## 4. The cut line

Check the clock at each checkpoint. If you are behind, cut in this order and do not negotiate:

| If behind at | Cut | Costs you |
|---|---|---|
| 2:35 (after T6) | **T9** — the dashboard. Show the session list at the bottom of the review page instead | 15 min. The ledger still exists, just less prettily |
| 2:35, still behind | **Away tracking** (`windows.onFocusChanged`). Attribute everything to domains | 10 min. M4 becomes unmeasurable; note it in IDEA §10.3 as No data |
| 3:00 | **T7 blocking.** Demo the loop without the protection link | 20 min. The pitch loses a link, and you must say so out loud rather than let anyone assume it works |
| Any time | Styling | Whatever it takes |

**Never cut:** the intention field, the review screen, or the outcome question. Those three *are* the product; a demo without them is a worse Rize.

---

## 5. Demo script (two minutes)

1. "This is a report I have to finish today." — type *finish the supplier report*, pick a blocklist, Start.
2. Open a blocked site → block page shows your own sentence back to you.
3. Work in two or three tabs for ~40 seconds.
4. Stop → the review opens by itself.
5. Read the line that matters out loud: *"I said I'd finish the report. I spent 41 minutes in the AI chat, 12 in the document, 9 on a news site."*
6. Answer **No**.
7. Dashboard: three sessions, one completed. "Rize would tell me I focused for 62 minutes. That's the number I'm not interested in."

Rehearse steps 4–7 twice. That is where the demo actually lives.

---

## 6. After the build

| # | Action | Where it lands |
|---|---|---|
| 1 | Record what was cut and what took longer than planned | §7 below |
| 2 | Use it on real work for two weeks | Tests K1 |
| 3 | Fill IDEA §10 from the session table, not from memory | IDEA §10.2, §10.3 |
| 4 | Answer IDEA Q1 (does Session ship the full loop?) before writing any pitch | IDEA §12 |

---

## 7. What actually happened

*(empty until the build runs — fill from the clock, not from impressions)*

| Task | Planned | Actual | Note |
|---|---|---|---|
| | | | |

---

## 8. Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| B1 | Is the extension written as plain JS files, or with a bundler? *(Provisional: plain JS, no build step — a bundler config is 20 minutes you do not have.)* | T4 | Alexandre |

---

## Self-Check

- [x] Every `T#` has a minute cost and a done-when that can fail
- [x] The minutes sum to the available time, with the shortfall handled by §4 rather than by optimism
- [x] The cut line names what is never cut
- [x] Decisions already taken are listed so they are not re-litigated mid-build
- [x] Registered in `docs/index.md` §1.1, with a pointer from SDD
