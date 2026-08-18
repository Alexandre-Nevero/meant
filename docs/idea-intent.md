# Idea Brief

**Project:** Intent
**Date:** 2026-08-18
**Version:** 0.1
**Cycle:** 1
**Owner:** Alexandre Andrei Nevero
**Status:** Draft
**Last reconciled:** N/A (not yet reconciled with reality)
**Downstream:** [prd-intent.md](prd-intent.md)
**Loop closes from:** [flow-intent.md](flow-intent.md) §6 events → [prd-intent.md](prd-intent.md) §8 metrics → §10 below

> **Working name is dead.** "Intent — Focus" already ships on the App Store as a blocker app (checked 2026-08-18). A new name is being chosen from the branding directions; renaming costs one search-and-replace across `docs/` while Status is Draft.

---

## 1. The Spark

| # | Field | Answer |
|---|---|---|
| 1 | One line: what it is, who it is for | A browser extension plus dashboard that makes you say what you intend to finish, blocks what you chose to avoid while you work, records where your attention actually went, and ends by asking whether you finished it — for people whose entire workday happens inside a browser. |
| 2 | The problem, as something that happens | Tuesday 2:10pm. A business administrator opens Chrome to draft a supplier report with an AI chat tool. At 3:20pm there are fourteen tabs open, two of them the report. She cannot say whether the report moved, and the tab count is the only evidence of the last seventy minutes. |
| 3 | Named primary user | A non-technical corporate business administrator whose work — reports, coordination, documents — happens in a browser, increasingly with AI chat as the tool she builds with. Defined by behavior, not job title: anyone whose workday is browser plus AI chat. The builder is in the same behavior class, which is why daily dogfooding is possible. |
| 4 | Pain moment: where and when they feel it | At the end of a work block, when asked (by herself, a manager, or a standup) "did you finish it?" and the honest answer is "I was working on it." Then again the next morning, when the same task is still open. |
| 5 | The insight: why now, why possible | For a browser-native worker the browser *is* the workstation, so one extension can observe all three signals at once — the intention, the enforcement, and the actual attention — with no OS permissions, no admin rights, and no installer. Existing tools split those signals across separate products because they were designed for a desktop-centric workday: Rize needs Accessibility plus Screen Recording plus Automation to reconstruct from outside what the browser already knows from inside. |
| 6 | If we ship only one thing | The end-of-session review that puts the declared intention next to the recorded attention and asks one question: did you finish it? |

**Working name:** Intent
**Slug:** `intent`

---

## 2. The Problem

**Who has it:** Browser-native knowledge workers — corporate administrators, coordinators, analysts, and AI-assisted builders — who have no compiler, no ticket, and no artifact that proves a work block produced anything.

**A specific instance:** The supplier-report block above. Three of the fourteen tabs were the AI chat used to draft the report; four were a news site opened during a slow model response; the rest were search results from a question that stopped being relevant twenty minutes in. Nothing in her tooling can separate the three of those from the eleven.

**How often:** Two to four work blocks a day, every working day.

**What it costs them:** Not primarily hours. It costs the ability to answer "did today work?" — so the next day is planned on feelings instead of evidence, and the same task slips repeatedly without anyone being able to name why.

**What they do today instead:** Willpower and tab discipline. A Pomodoro timer that measures elapsed minutes and nothing else. Occasionally a site blocker installed after a bad week and uninstalled within a fortnight. A to-do list where the item stays unchecked with no record of why.

**Why the workaround is not enough:** Each covers exactly one link of the chain. A timer knows duration but not intention or outcome. A blocker knows what was forbidden but not what was accomplished. A to-do list knows the outcome but nothing about the attention that did or did not go into it. No two of them share a session.

**Who else has tried to solve it:** Freedom (blocking, no measurement, no outcome). Rize (measurement, no intention, no protection; and hours are its headline number). Session, macOS/iOS only, is the closest — it does combine intention, blocking, and a post-session prompt — but it is desktop-scoped and Apple-only, so it cannot see inside the browser where this user's whole day happens. The graveyard is large and consists mostly of blockers people uninstall.

---

## 3. Why Now

Two things changed. AI chat tools moved *building* into the browser for people who do not code, so a non-technical worker's productive surface and their distraction surface are now the same surface — indistinguishable to any OS-level observer, and separable only by knowing what the person set out to do. Meanwhile Manifest V3 gave extensions runtime-mutable blocking rules, so protection no longer requires a network extension, a driver, or admin rights.

**What was blocking this before:** Enforcement and observation lived at the OS layer, which meant an installer, elevated privileges, and — on macOS — Screen Recording and Accessibility prompts. Corporate managed endpoints commonly deny exactly those, so the users who most need this could not install it.

**What unblocked it:** `declarativeNetRequest.updateDynamicRules` for enforcement and the `tabs` API for observation, both inside a normal extension install, on both macOS and Windows, with no admin rights.

**How long the window stays open:** No hard window. Any incumbent could ship a browser extension; none has, because each would have to abandon the layer their existing product is built on.

---

## 4. The One Thing

**Minimum demonstrable value:** A session review that shows "you said you would finish the supplier report; you spent 41 minutes in the AI chat, 12 in the document, 9 on a news site; did you finish it?" — and a history where the answer to that question, not the hours, is the number that accumulates.

**How we would show it in two minutes:** Install → type "finish the supplier report", choose a blocklist, start a 25-minute session → open a blocked site, get the block page showing the intention back → work → session ends → review screen: intention beside actual time per site → answer "did you finish it?" → history shows three sessions, two completed.

**What has to be true for that to work:** The user's work is genuinely inside the browser. They will type one sentence before working. "Did you finish it?" is answerable as yes or no for their real work.

**What we are deliberately not building first:** Calibration (predicting from your own history how long a task class actually takes you) and the reward layer — both cut from v1 in the design session of 2026-08-18, because both need weeks of accumulated data before they can say anything true. Also not first: desktop/OS-level tracking, app blocking, scheduled sessions, Locked Mode, multi-device sync, teams, any AI classification.

**Hard constraints on v1 (from the build context, not the product):** Buildable by a strong student in a four-hour course. At most five external services. Chrome/Edge extension plus a small web app with real sign-in and a database.

---

## 5. Load-Bearing Claims

| # | Claim | Label | Source | Checked on | If wrong |
|---|---|---|---|---|---|
| C1 | An MV3 extension can add and remove blocking rules at runtime via `declarativeNetRequest.updateDynamicRules`; the `declarativeNetRequest` permission covers block rules without full host access. Limits are far above our needs (30,000 safe rules). | Verified | developer.chrome.com — declarativeNetRequest reference | 2026-08-18 | Blocking falls back to content-script redirects: slower, uglier, and easier to bypass. |
| C2 | Reading a tab's URL requires the `tabs` permission or host permissions; `tabs.onActivated` and `tabs.onUpdated` are the events that signal attention changes. | Verified | developer.chrome.com — chrome.tabs reference | 2026-08-18 | The passive-tracking link of the loop does not exist and the product collapses to a blocker. |
| C3 | An MV3 service worker is terminated after 30 seconds of inactivity; `chrome.alarms` has a 30-second minimum period. A running session timer therefore cannot live in memory — it must be persisted and reconstructed from timestamps. | Verified | developer.chrome.com — service worker lifecycle | 2026-08-18 | Timing code is simpler than planned; no downside. |
| C4 | Rize requires Accessibility plus Screen Recording, and Automation or a browser extension, to capture window titles and URLs on macOS. | Verified | docs.rize.io — Tracking Websites | 2026-08-18 | The "no permission prompts" advantage over incumbents shrinks. |
| C5 | Corporate managed endpoints commonly deny local admin rights, preventing installation of desktop agents, drivers, and system extensions. | Unverified; needs check | Mechanism documented (Intune EPM, Autopilot standard-user profiles); no adoption figure retrieved | 2026-08-18 | A desktop app becomes viable for the persona, weakening the case for browser-only — but not the case for browser-first. |
| C6 | Session (stayinsession.com) ships intention + blocking + a post-session review, macOS/iOS only. Its own site: "State your focus / Start your session", "blocking apps and websites that distract you", and a review that "asks you what you have learned after the session has ended". | **Verified** | stayinsession.com, homepage captured and read | 2026-08-18 | — |
| C7 | Roughly 70% of people miss deadlines they set for themselves, often by a factor of two (planning fallacy). | Unverified; needs check | Secondary summaries retrieved; primary study (Buehler et al., 1994) not read | 2026-08-18 | The cold-start prior for calibration is wrong — deferred impact, since calibration is cut from v1. |

---

## 6. Assumptions

| ID | Assumption | Confidence | If it is wrong | How we would find out | Tested by |
|---|---|---|---|---|---|
| A1 | The target user's working day is overwhelmingly inside the browser, so an extension sees most of their attention. | High | The recorded timeline is a fragment and every comparison in the review is misleading | More than ~2h/day recorded with the browser unfocused | Away-time recorded via window focus events |
| A2 | People will type one sentence of intention before starting work, and keep doing it. | Medium | The loop has no left-hand side; the product degrades to a tracker | Under 50% of sessions started with a non-empty intention after week 1 | Session records with empty intention |
| A3 | "Did you finish it?" is answerable as yes/no for this user's real work. | Medium | The outcome ledger — the entire thesis — cannot be built on this question | More than 30% of reviews skipped or answered ambiguously | Review completion rate |
| A4 | Blocking a small chosen list inside the browser is enough protection; users do not simply switch to another browser or their phone. | Low | Protection is theater and the "protected" column of the review is a lie | Sessions where a blocked attempt is followed by a gap in recorded activity | Blocked-attempt count vs away time |
| A5 | Requiring sign-in before the first session does not kill adoption for the demo audience. | Medium | The funnel dies before anyone sees the loop | Installs that never produce a first session | Install-to-first-session rate |
| A6 | The intention→outcome link reads as a different product, not as a lighter Rize. | Medium | The portfolio pitch fails even if the build succeeds | First demo audience describes it as "Rize but simpler" | Demo feedback, verbatim |

**The one we would be most embarrassed to be wrong about:** A3. Every claim this product makes about outcomes over hours rests on the outcome question being answerable, and it is the least tested thing here.

**Assumptions we are accepting without a test:** A4 in v1 — measuring browser-switching from inside one browser is close to impossible, and the four-hour budget does not stretch to it. Accepted knowingly; revisit when protection stops being a demo feature.

---

## 7. Signals and Kill Criteria

**Early signals of life:**

| Signal | Threshold | By when | Measured by |
|---|---|---|---|
| Builder uses it on real work, unprompted | 10 sessions with real intentions | 2026-09-01 | Session count |
| Review tells someone something they did not know | 3 of 5 test users say so, unprompted | 2026-09-15 | Verbatim feedback |
| Intention step survives contact | ≥70% of sessions have a non-empty intention | 2026-09-15 | Session records |

**Kill criteria:**

| # | Condition | Measured by | Decision if true |
|---|---|---|---|
| K1 | The builder stops using it within two weeks of v1 | Session count by date | Stop — if the loop is not worth 20 seconds to its author, it is not worth a stranger's |
| K2 | Over 50% of sessions are started with an empty intention | Session records | Pivot — the declaration is friction, not value; the product becomes a tracker with a review |
| K3 | Review completion under 50% | Review records | Pivot — the outcome question is not answerable as posed; rethink it before building anything on top |

**Who calls it:** Alexandre Andrei Nevero.
**When we look:** 2026-09-15.

---

## 8. Foundation Gate Verdict

| | |
|---|---|
| Run on | 2026-08-18 |
| Cycle | 1 |
| Verdict | PROCEED WITH FIXES |
| Fields that failed | None — all six §1 fields are concrete |
| Contradicted claims | None |
| Carried forward as TBD | Hosting / database / auth provider selection → SDD §2 (must stay within the five-integration budget). Blocklist source and default lists → PRD. Away-time definition (what counts as "not in the browser") → SDD §3. |
| Blocking questions | None |

**Why FIXES rather than a clean PROCEED:** C5 and C6 are unverified and both shape positioning — C6 in particular determines whether the competitive claim in §2 holds. Neither blocks the build; both must be checked before the pitch is written.

---

## 9. What This Is Not

| Not this | Why not | Revisit when |
|---|---|---|
| Employee monitoring | The data is for the person who generated it. It is never sold, shared, or made visible to an employer | Never |
| A timesheet / billable-hours tool | Hours are the metric this product exists to demote | Never |
| An OS-level blocker | Requires admin rights the target user does not have, and weeks of signing work the build context does not have | The browser-only version proves the loop and a desktop layer is the obvious next constraint |
| A screenshot or keystroke recorder | Metadata only — URL, title, timestamps. Nothing else, ever | Never |
| A team or manager dashboard | Changes who the data serves, which changes the product | Never (as currently framed) |

**Not for:** People whose work is mostly outside a browser — designers in native tools, developers in an IDE, anyone in a terminal. v1 would see a fraction of their day and lie to them about the rest.

---

## 10. The Return Loop

Empty until v1 ships. Expected, not a gap.

---

## 11. Cycle Log

| Cycle | Opened | Gate verdict | Shipped | Closed | Decision | Headline learning |
|---|---|---|---|---|---|---|
| 1 | 2026-08-18 | PROCEED WITH FIXES | not yet | open | pending | pending |

---

## 12. Open Questions

| # | Question | Blocks | Owner | Needed by |
|---|---|---|---|---|
| ~~Q1~~ | ~~Does Session ship the full loop?~~ **Answered 2026-08-18: yes, on Apple platforms.** Its review asks what you *learned* (reflective journaling); ours asks whether you *finished* (binary, and it accumulates). Remaining differentiation: binary outcome ledger over reflection · browser-native attention data over desktop-scoped · Chrome/Edge on Windows and macOS over Apple-only. | Positioning | Alexandre | done |
| Q2 | Which hosting / database / auth providers, within the five-integration budget? | SDD §2, and the four-hour schedule | Alexandre | Before the build |
| Q3 | Where do default blocklists come from — hand-written, or user-built on first run? | PRD, and roughly 20 minutes of the build | Alexandre | Before the build |
| Q4 | What counts as "away" when the browser loses focus, and is away time shown in the review? | SDD §3, USER-FLOW | Alexandre | Before the build |

---

## Self-Check

**Outbound (before writing the PRD):**

- [x] §1 all six fields are concrete; none is a category, a slogan, or empty
- [x] §1 field 3 names a role in a context, specific enough to find one person this week
- [x] §1 field 5 says something the problem statement does not already say
- [x] §1 field 6 is one thing
- [x] §2 describes one specific instance of the problem, not a category of instances
- [x] §2 names what people do today instead
- [x] §4 the minimum demonstrable value could be shown in two minutes
- [x] §5 no claim is labeled Verified without a source that was actually retrieved
- [x] §5 every Unverified claim the build depends on appears in §6 as an assumption or in §12 as an open question (C5 → §9 scope decision; C6 → Q1; C7 → deferred with calibration)
- [x] §6 every `A#` names a falsifier and a way to find out
- [x] §6 the riskiest assumption is named (A3)
- [x] §7 every kill criterion has a measurable signal behind it and a named decider
- [x] §8 gate verdict recorded, with the date and the cycle
- [x] §8 verdict is not DO NOT BUILD YET, so downstream documents may be written

**Always:**

- [x] Registered in `docs/index.md` with matching version, status, and cycle
