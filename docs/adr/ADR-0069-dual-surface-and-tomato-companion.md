# ADR-0069 — Dual-surface split (/ledger vs /dashboard) and the Codex Pet Tomato Companion

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Following ADR-0068 (The dashboard states quantities), user feedback requested two architectural refinements:
  1. **Separation of daily vs monthly focus surfaces:** Combining daily chronological tracking and monthly aggregate breakdown into a single view was overwhelming for daily focus check-ins. A clean split was required:
     - `/ledger`: Daily surface, quick look on focus today with a 04:00–22:00 timeline hero and today's session rows with band visualizations.
     - `/dashboard`: Monthly macro view with a 30-day stacked bar breakdown (0h–8h axis), 3-column stats grid (Top Sites, Concentric Donut, Performance & Fidelity), and single inference sentence (ADR-0066).
  2. **Codex Pet Tomato Companion & Band Wake System:** Rather than a generic geometric dot, the companion is designed as a browser-native Codex Pet character ("The Tomato"), floating above webpages during sessions, freely draggable, with subtle idle breathing and an Emil Kowalski buoyant hover reaction that ripples through the band segments without judging or celebrating.

- **Decision:**
  1. **Dual-Surface Split:**
     - `/ledger` serves as the daily operational focus surface. It displays today's date, the 04:00–22:00 timeline hero track, session count, attended/away/break metrics, and the compact list of today's completed and running sessions.
     - `/dashboard` serves as the monthly macro reporting surface. It renders the 30-day stacked breakdown chart, top sites ranking, concentric donut relative time distribution, performance and fidelity metrics, and single inference observation.
     - The shared shell (`app/shell.tsx`) provides persistent navigation between `/ledger` and `/dashboard` with an active terracotta underline indicator.
  2. **Tomato Companion & Band Wake Interaction:**
     - The companion actor renders the transparent Tomato character sprite with a concentric segmented SVG band overlay.
     - Physics and motion follow Emil Kowalski principles: 160ms/280ms cubic-bezier springs, 4px lift on hover, subtle shadow softening, and gentle sequential clockwise band ripple.
     - Hovering reveals a neutral intention tooltip ("Focusing on: [intention]").
     - Tapping the companion on the web app opens the slide-over AI coach reflection drawer (`.m-coach-drawer`).
     - Tapping the companion in the extension records a one-tap return receipt (ADR-0058).
     - Strict adherence to invariants: the companion never varies with the outcome answer, carries no moral valence or grading colors, and never celebrates during a session.

- **Consequences:**
  - **Route Architecture:** `/ledger` and `/dashboard` are distinct routes with dedicated layouts and page components.
  - **Design System:** Added structural classes `.m-timeline-*`, `.m-breakdown-*`, `.m-site-row`, `.m-donut-*`, `.m-web-companion-actor`, and `.m-coach-drawer` while preserving token constraints.
  - **Design Canvas Synchronization:** Both `design/canvas/Ledger.dc.html` (daily) and `design/canvas/Dashboard.dc.html` (monthly) are canonical artboards in the repository.
  - **Test Coverage:** Full test coverage across `e2e/ledger.spec.ts`, `e2e/dashboard.spec.ts`, and `e2e/companion.spec.ts`.
