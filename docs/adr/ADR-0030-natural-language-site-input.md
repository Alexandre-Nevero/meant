# ADR-0030 — Natural-language phrase resolution for the popup's site chip fields

- **Date:** 2026-09-07
- **Status:** Accepted (already shipped)
- **Context:** Both chip fields (work-sites, blocklist) accepted exactly one fully-qualified domain per Enter press. A user wanting to track "docs, gmail, and chatgpt" had to know and type three literal domains one at a time — real, reported friction, not hypothetical.
- **Options considered:**
  1. LLM-based resolution — rejected: adds latency, cost, and a network dependency that breaks the popup's local-first/offline-start guarantee for what should be a single synchronous step.
  2. A curated alias dictionary + deterministic typo correction, resolved client-side — chosen.
- **Decision:** A phrase is split on commas and the word "and"; each token resolves via (a) `normalizeDomain()` if it has a dot, (b) an exact alias-dictionary lookup (`extension/lib/site-aliases.js`, new), or (c) a confident single-match edit-distance-≤2 (≤1 for tokens ≤4 chars) typo correction against the dictionary — a tie between two equally-close keys is not confident. Resolution is all-or-nothing per Enter press: any unresolved token blocks the whole phrase and shows one inline `m-meta` message (a suggestion or "not a known site"), never a partial chip list. Pure resolver function `resolveSitePhrase()` (`extension/lib/resolve-sites.js`, new) has no DOM/storage access, same testable-in-isolation shape as `normalizeDomain`.
- **Consequences:** A single word with no comma still behaves exactly as before (fully backward compatible). Alias-dictionary coverage is an implementation detail, cheap to extend later without touching the resolution mechanism. Multiple simultaneous bad-token messages in one phrase were deliberately left unsupported (one message at a time, left to right) to stay within the popup's zero-chrome budget.
- **Source:** `docs/superpowers/specs/2026-09-07-natural-language-site-input-design.md` (full component/contract detail and code lives there)
