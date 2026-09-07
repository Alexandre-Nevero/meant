# Design — Natural-language site input for the popup's chip fields

**Date:** 2026-09-07 · **Traces to:** user feedback on the 0.2 build's "where it happens" /
"blocking" chip inputs — real friction typing full domains one at a time.

## Problem

Both chip fields (`extension/popup.js`'s `chipGroup({addable: true})`) only accept one
fully-qualified, real domain per Enter press. A user who wants "docs, gmail, and chatgpt"
tracked as work sites has to know and type `docs.google.com`, `gmail.com`, `chatgpt.com`
individually. This is real, reported friction, not a hypothetical one — the fix is a
resolution layer in front of the existing input, not a new input.

## Flow

```
type "docs, gmail, and chatgpt", press Enter
  -> split into tokens: ["docs", "gmail", "chatgpt"]
  -> resolve each token independently:
       has a dot?          -> normalizeDomain() (existing, unchanged)
       exact alias hit?     -> dictionary lookup (new)
       confident typo?      -> single unambiguous edit-distance-1-2 match against
                               dictionary keys
       none of the above    -> unresolved
  -> ALL resolved -> add every chip at once (atomic)
  -> ANY unresolved -> add nothing; show one inline message for the first
                       unresolved token, left to right
```

A single word with no comma still works exactly as today (trivially a one-token phrase) —
fully backward compatible.

## Components

| Unit | Does | Does not |
|---|---|---|
| `extension/lib/site-aliases.js` (new) | Curated `{alias: domain}` dictionary, e.g. `gmail`→`gmail.com`, `docs`→`docs.google.com`, `chatgpt`→`chatgpt.com`. Exports the dictionary and nothing else — no matching logic. | Attempt to be exhaustive. Unknown words fall through to "type the real domain," same as today. |
| `extension/lib/resolve-sites.js` (new) | `resolveSitePhrase(text) -> {ok: true, domains: string[]} \| {ok: false, badToken, suggestion?: string}`. Splits on commas and a trailing "and", resolves each token per the Flow above, using `normalizeDomain` and the alias dictionary. Pure function, no DOM/storage access — testable standalone like `normalizeDomain` already is. | Decide UI presentation. Does not mutate chip state itself. |
| `extension/popup.js` (`chipGroup`) | On Enter: calls `resolveSitePhrase`. All-resolved -> adds every returned domain as a chip (existing dedup-by-`domains.includes` logic covers duplicates). Unresolved -> renders one `<p class="m-meta">` error/suggestion line beneath the input; any further keystroke in the input clears it. Enter again with the input unchanged and a standing single-token suggestion -> accepts that suggestion and re-validates. | Add any new component, animation, or modal — reuses the existing `m-meta` text-line vocabulary already in the popup. |

## Contracts

**Token splitting:** split `text` on `,` and on the literal word `and` (case-insensitive,
whole-word) used as a separator; trim whitespace; drop empty tokens.

**Typo confidence:** Levenshtein distance ≤ 2 (≤ 1 for tokens of length ≤ 4, to avoid
false positives on short words) against every alias key. "Confident" requires exactly one
key at the minimum distance — a tie between two equally-close keys is NOT confident and
falls through to the plain "not a known site" message.

**Atomicity:** resolution is all-or-nothing per Enter press. No partial chip list is ever
added from a single phrase that contains one bad token.

**Error message shape** (both are single `m-meta` lines, no icon, no color other than the
existing `m-meta` token):
- Confident suggestion: `did you mean {suggestion}? Press Enter to use it`
- No suggestion: `"{badToken}" isn't a known site — type the full domain`

## Out of scope

- Growing the alias dictionary beyond an initial common-sites set (implementation detail,
  not a design decision — easy to extend later without touching the resolution mechanism).
- LLM-based resolution (explicitly rejected — adds latency, cost, and a network dependency
  that breaks the local-first/offline-start guarantee for this one step).
- Multiple simultaneous error messages for multiple bad tokens in one phrase (deliberately
  one at a time, left to right, to stay within the popup's zero-chrome-of-its-own budget).
