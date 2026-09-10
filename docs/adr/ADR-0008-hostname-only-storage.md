# ADR-0008 — Hostname only, never full URLs or page titles, in storage

- **Date:** 2026-08-18
- **Status:** Accepted (storage rule); partially superseded by ADR-0017 (in-flight reading)
- **Context:** Storing full URLs or page titles is a meaningfully larger privacy surface than a hostname, for a product whose entire premise is "we watch your browser."
- **Decision:** Only the hostname is ever written to storage. Full URLs and page titles are never persisted.
- **Consequences:** This still governs storage. ADR-0017 later separated this from what's read *in flight* for judging (titles/text may be read transiently and never stored) — a narrower, not looser, rule.
- **Source:** `docs/sdd-intent.md` V5
