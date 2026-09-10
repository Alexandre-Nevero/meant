# ADR-0002 — Browser extension plus web app; no desktop app in v1

- **Date:** 2026-08-18
- **Status:** Accepted
- **Context:** The product's defining behavior (attention inside a browser tab, judged against a stated intention) is browser-native by definition; a desktop app adds a second runtime for no capability v1 needs.
- **Decision:** Ship a Chrome/Edge MV3 extension plus a Next.js web app. No desktop app, no OS-level tracking, in v1.
- **Consequences:** Keeps the surface area to two runtimes instead of three. Desktop/OS-level tracking stays explicitly out of scope (`docs/prd-intent.md` §5) until the browser-only loop proves itself.
- **Source:** `docs/sdd-intent.md` §2
