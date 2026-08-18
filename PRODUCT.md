# PRODUCT.md — MEANT

> Derived from `docs/` (idea, prd, sitemap, flow, sdd, build), not from a fresh interview. Every line traces to a doc; nothing here is invented. Canonical product truth stays in `docs/`.

**Name:** MEANT. (Working name "Intent" was retired 2026-08-18: "Intent — Focus" already ships on the App Store.)

**One line:** A browser extension and web app that makes you say what you intend to finish, blocks what you chose to avoid, records where your attention actually went, and ends by asking whether you finished it.

**Primary user:** A browser-native worker. Defined by behavior, not job title: anyone whose workday is browser plus AI chat. Concretely, a non-technical corporate administrator writing reports with an AI assistant, on a managed laptop with no admin rights.

**The pain moment:** End of a work block, asked "did you finish it?", answering "I was working on it."

**The one thing:** The end-of-session review. Declared intention beside recorded attention, then one question.

**What the product measures:** Completed outcomes, not hours. Hours appear only as evidence inside a single session's review, never as a headline.

**Platforms:** Chrome and Edge extension (macOS and Windows, identical) plus a Next.js web app on Vercel with Clerk sign-in and Neon Postgres.

**Constraints that shape design:**
- Four hours of build time, one builder. Cut line in `docs/build-intent.md`.
- Three of five external services allocated. No analytics service, no UI kit, no icon package.
- Hostname only. Never a full URL, never a page title. The design must never imply the product knows more than it does.
- No OS permissions, no installer, no admin rights.

**Surfaces:**

| Surface | Mode | Seen |
|---|---|---|
| Extension popup (idle / running / unpaired) | Operate | Dozens of times a day |
| Block page | Operate | A few times a day, at a moment of friction |
| Session review | Operate | Once per session |
| Dashboard ledger | Operate | Daily |
| Landing page | Persuade | Once |

**Competitive truth:** Rize measures and shows hours. Freedom blocks and never reports back. Session does the loop on Apple platforms and asks what you *learned*. MEANT asks whether you *finished*, and that answer accumulates.

**What the product must never do:** reward hours, celebrate one answer over the other, moralize about a bad afternoon, or display anything an employer would want.
