# ADR-0074 — Companion Visual Scale (20% Expansion) and Smooth Click Receipt Animation

- **Date:** 2026-09-21
- **Status:** Accepted
- **Depends on:** ADR-0058 (companion as input device), ADR-0069 (Codex Pet Tomato Companion), ADR-0070 (companion persistent presence), ADR-0071 (overlay scope and dark theme rendering)
- **Context:**
  Following the introduction of the Tomato Companion character sprite and multi-tab position synchronization, user testing identified two ergonomic and motion refinement requirements:
  1. **Visual Scale Was Too Small:**
     - The floating companion overlay was sized at `52px` (`SIZE = 52` in `extension/companion-overlay.js`), and the web app companion was sized at `64px` (`.m-companion-body-wrap` in `app/globals.css`).
     - At this scale, fine hand-drawn details of the tomato character (stem leaves, orbit band, facial ink) were slightly compressed, making the companion feel undersized relative to modern browser viewport margins and high-DPI displays.
  2. **Abrupt and Jerky Click Animation:**
     - The click receipt animation on tap (`playReceipt` / `@keyframes receipt`) was configured with `--m-dur-press: 160ms` and `scale(1)` to `scale(1.6)`.
     - While 160ms is appropriate for a flat button micro-press, expanding a spatial circle ring across 1.6x scale in 160ms flashed before the eye could track it, resulting in a strobe-like, jarring click experience.
     - Furthermore, the tomato character itself lacked tactile micro-press physics when tapped, and the web app companion lacked a corresponding ring ripple animation.

- **Decision:**
  1. **20% Companion Visual Scale Increase:**
     - Floating extension overlay: Increased `SIZE` by 20% from `52px` to `62px` (52 * 1.20 = 62.4 -> 62px integer).
     - Web app companion: Increased `.m-companion-body-wrap` and `<img />` by 20% from `64px` to `77px` (64 * 1.20 = 76.8 -> 77px).
     - Clamping boundaries and fraction-based coordinate normalization in `companion-overlay.js` automatically adapt to the new 62px bounding box.
  2. **Smooth, Organic Click Receipt Animation (Emil Kowalski / Apple Motion Principles):**
     - **Tuning and Timing:**
       - Defined `--m-dur-receipt: 420ms` and `--m-ease-receipt: cubic-bezier(0.16, 1, 0.3, 1)` (quintic ease-out deceleration curve).
       - Adjusted `RECEIPT_ANIMATED_MS = 420` so the `[data-returning="true"]` state persists through the full ripple decay window before clean teardown.
     - **Keyframe Refinement (`@keyframes receipt` and `@keyframes companionReceipt`):**
       - Starts at `scale(0.96)` and `opacity: 0.9` with an immediate soft glowing clay aura (`box-shadow: 0 0 0 0 rgba(199, 91, 57, 0.45)`).
       - Holds visibility at `opacity: 0.85` through 30% of the expansion curve.
       - Decelerates smoothly into `scale(1.6)` with full dissipation (`opacity: 0`, `box-shadow: 0 0 16px 2px rgba(199, 91, 57, 0)`), providing a gentle, natural wave sensation instead of a flash.
     - **Tactile Micro-Press Physics:**
       - Added `.dot-wrap:active` and `.m-web-companion-actor:active` compression (`transform: translateY(-2px) scale(0.95)` with 120ms transition).
       - Tomato character squashes subtly on press and springs back as the ripple expands outwards.
     - **Parity on Web Companion:**
       - Implemented `.m-companion-ring` and `data-returning` state on `<CompanionPet />` in `app/companion-pet.tsx` and `app/globals.css`.
     - **Accessibility (Reduced Motion):**
       - When `prefers-reduced-motion: reduce` is active, keyframe animations are suppressed, instantly presenting the solid contrast ring without layout shift or strobing.

- **Consequences:**
  - `extension/companion-overlay.js`: updated `SIZE = 62`, added `--m-dur-receipt`, `--m-ease-receipt`, smooth `@keyframes receipt`, micro-press styles, and set `RECEIPT_ANIMATED_MS = 420`.
  - `app/globals.css`: scaled `.m-companion-body-wrap` to `77px`, added `.m-companion-ring` with `@keyframes companionReceipt` (420ms cubic-bezier), active micro-press, and reduced-motion overrides.
  - `app/companion-pet.tsx`: updated image dimensions to `77x77` and wired up `isReceiptActive` click ripple trigger.
  - `e2e/companion.spec.ts`: updated size assertions to 62px and receipt animation timing assertions to 420ms.
  - All 180 unit tests (`npm test`), TypeScript verification (`npx tsc --noEmit`), and 17/17 Playwright e2e tests pass cleanly.
