# ADR — Architecture Decision Record

> Append-only decision changelog. One file per decision. Never edit a past entry after it's
> accepted — supersede it with a new one that says so. Keep entries short.
>
> **Every contributor** (owner and any agent) appends an ADR here on a real product,
> architecture, or plan decision or pivot — chat memory is not a record. `docs/index.md` §6
> points here first.

## When to add an entry

Add one when the choice changes product behavior, architecture, security posture, or live
plan intent — or when a future reader would reasonably ask "why did we do it this way?"

Skip only trivial, instantly reversible edits with no lasting *why*.

## Format

```markdown
# ADR-NNNN — <short title>

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by ADR-NNNN
- **Context:** <forces at play>
- **Options considered:** <only if real alternatives were weighed>
- **Decision:** <what we chose>
- **Consequences:** <easier / harder / owed>
- **Source:** <spec, plan, or code path with the full detail, if one exists>
```

## Numbering and history

`ADR-0001` through `ADR-0025` are a straight port of the `D1`–`D25` decisions previously kept
only in `docs/index.md` §6 (that table stays, marked historical). `ADR-0026` onward are new
decisions recorded directly here, going forward — including several rounds of extension UI
work (`docs/superpowers/specs/`) that were never logged as a numbered decision at all until
this pass.

Read newest first. A later ADR wins over an earlier one on the same topic until the earlier
one is explicitly marked Superseded.
