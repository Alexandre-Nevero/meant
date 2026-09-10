# ADR-0009 — Block page as a redirect rule, host permission per blocklist domain

- **Date:** 2026-08-18
- **Status:** Superseded by ADR-0027 (`<all_urls>` upfront, 2026-09-07)
- **Context:** `declarativeNetRequest`'s redirect action needs host permission for whatever domain it targets; the original design asked for that permission per domain as the user added it to a blocklist, to keep the install-time permission grant minimal.
- **Decision:** Block page is a `declarativeNetRequest` redirect rule; host permissions are declared per blocklist domain, not broadly.
- **Consequences:** Worked, but meant a fresh permission prompt every time the user named a new site to block — the exact friction ADR-0027 later removed in favor of one honest upfront grant.
- **Source:** `docs/sdd-intent.md` V4, `docs/build.md` §7.4
