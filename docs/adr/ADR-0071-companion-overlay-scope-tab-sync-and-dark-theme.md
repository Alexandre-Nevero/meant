# ADR-0071 — Companion Overlay Scope, Multi-Tab Position Sync, and Dark Theme Rendering

- **Date:** 2026-09-21
- **Status:** Accepted
- **Depends on:** ADR-0058 (companion as input device), ADR-0065 (cream product, dark fallback), ADR-0069 (Codex Pet Tomato Companion), ADR-0070 (companion persistent presence)
- **Context:**
  Following the introduction of the Tomato Companion Character (`the-tomato-transparent.png`) and persistent overlay presence (ADR-0070), four visual and spatial integration defects were observed in user feedback:
  1. **Red Dot Artifact on Character Face:** A 10px clay `.dot` (originally the geometric companion core) remained rendered in the center of the tomato character sprite, appearing as an unintended orange dot directly over the tomato's eye.
  2. **Lack of Real-Time Multi-Tab Position Synchronization:** While the companion saved its dragged coordinates as fractional offsets to `chrome.storage.local`, other open tabs never listened to `changes.companionPosition`. Repositioning the companion in one tab left it in stale locations across other open tabs.
  3. **Duplicate Companion on MEANT Web App:** The MEANT web app (`app/dashboard`, `app/ledger`) already embeds the native React `<CompanionPet />` component. Because the Chrome extension injected `companion-overlay.js` on `<all_urls>`, both the web app's native companion and the floating draggable extension companion appeared simultaneously on `localhost:3000` / `meant.app`.
  4. **White Ground Shadow Defect in Dark Mode:** The raster sprite `the-tomato-transparent.png` contained a baked-in ground shadow watercolor wash sampled from cream paper (`RGB 218–245`). On light surfaces (`#F3F1EE`), this rendered as an acceptable faint tint, but on dark backgrounds (`#14120F`) or under system dark mode, the opaque light pixels rendered as an ungrounded white puddle beneath the character.

- **Decision:**
  1. **Removal of Red Dot Artifact:**
     - Removed the inner `.dot` element from `extension/companion-overlay.js`.
     - The Tomato Character itself serves as the bodily presence; state and receipts are communicated via the outer `.ring` (terracotta `--m-clay`), buoyant hover physics, and the hover pill.
  2. **Real-Time Cross-Tab Position Synchronization:**
     - `extension/companion-overlay.js` listens to `changes.companionPosition` in `chrome.storage.onChanged`. When position changes in any tab, all other open tabs immediately invoke `positionHost()` unless currently being dragged.
     - Added `visibilitychange` and `resize` listeners ensuring that tab switches and viewport changes reposition the companion reliably.
  3. **Exclusive Surface Scoping (No Double Companions):**
     - The floating extension overlay companion (`[data-meant-companion]`) is strictly scoped to appear *outside* the MEANT web application.
     - Added `isMeantWebApp()` detection in `companion-overlay.js` checking for `data-meant-web`, `m-app`, `.m-web-companion-actor`, `[data-surface]`, or origins matching `localhost`, `127.0.0.1`, `meant.app`. If true, the extension overlay does not mount, or immediately unmounts.
     - `reinjectCompanion()` in `extension/sw.js` skips MEANT web app tabs and clears any leftover overlay hosts.
     - Root Next.js layout (`app/layout.tsx`) adds `data-meant-web="true"` to `<html>`.
  4. **Dark Mode Shadow & Clean Asset Extraction:**
     - Replaced `the-tomato-transparent.png` across `extension/assets/`, `public/assets/`, and `design/canvas/explore/assets/` with an expertly segmented master asset. The baked cream-paper ground shadow was removed entirely, the right sketch loop was cleaned to proper transparency with proportional alpha, and perimeter antialiasing was defringed.
     - Grounding and depth are now handled dynamically via CSS:
       - Light mode: `filter: drop-shadow(0 4px 10px rgba(20, 18, 15, 0.12))` (idle), lifting to `drop-shadow(0 12px 20px rgba(20, 18, 15, 0.16))` on hover.
       - Dark mode (`prefers-color-scheme: dark` and `[data-theme="dark"]`): `filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6))` (idle), lifting to `drop-shadow(0 10px 24px rgba(0, 0, 0, 0.8))` on hover.
       - Eliminates white puddle artifacts on dark surfaces while providing physical elevation in both schemes.

- **Consequences:**
  - `extension/companion-overlay.js`: removed `.dot`, added `isMeantWebApp()` bail, synced `companionPosition` across storage changes, and updated dark scheme drop-shadows.
  - `extension/sw.js`: skips reinjection on MEANT web app tabs.
  - `app/layout.tsx`: marked with `data-meant-web="true"`.
  - `app/globals.css`: added `[data-theme="dark"]` drop-shadows for `.m-companion-body-wrap`.
  - `e2e/companion.spec.ts`: updated suite with 17 passing integration tests verifying external page visibility, absence on MEANT web pages, real-time multi-tab position sync, and contrast safety without `.dot`.
