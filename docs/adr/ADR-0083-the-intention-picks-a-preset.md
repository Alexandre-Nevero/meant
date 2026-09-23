# ADR-0083 — The intention picks a blocking preset: keyword first, AI only as a fallback classifier

- **Date:** 2026-09-23
- **Status:** Accepted
- **Settles:** ADR-0046, Proposed and never accepted ("AI may only carve domains out of the block
  set, never add blocks"). This ADR takes the opposite position for one narrow case: a preset may
  add blocks, and the AI may choose which preset.
- **Context:** Owner request 2026-09-23: "blocked site presets so users are blocked on those
  depending on the intention." Blocking has only ever come from the domains a user picks per
  session. The intention text was shown on the block page and used nowhere else. Three preset
  groups have sat in `extension/blocklists.js` since August, read by nothing.
- **Decision:** Four fixed presets — writing, research, study, admin — live in
  `extension/blocklists.js`, a provided file (T3) that nobody edits through UI.
  - **Keyword match first.** Whole words, English only, first preset in file order wins.
  - **AI only as a fallback, and only as a classifier.** When no keyword matches, the AI (Groq,
    `openai/gpt-oss-20b`, strict structured output) picks one preset id or `none`. It can never
    name a domain.
  - **The block set** = (the user's standing distract list ∪ the preset's sites) − the preset's
    allowed sites − the session's selected work sites − any site the intention names by its site
    name. The last rule protects the product's defining case: "schedule instagram posts" matches
    `admin` but must not block Instagram.
  - **A preset only pre-fills chips.** The first manual toggle freezes them, Start never waits,
    and a late answer is discarded.
- **Consequences:** The intention now reaches Groq when no keyword matches: zero retention per
  ADR-0072, and the same text already sits in `session.intention`. The classifier uses a model
  string no other feature uses, so neither `DAILY_COACH_TURNS` nor `DAILY_ANALYSIS_CAP` (both filter
  on `openai/gpt-oss-120b`) can count its calls. It gets its own daily cap, which is cost control,
  not a paywall (ADR-0075). Non-English intentions reach only the AI path. A preset never writes to
  the standing lists.
- **Source:** `docs/superpowers/specs/2026-09-23-five-asks-design.md` §3; owner brainstorm 2026-09-23.
