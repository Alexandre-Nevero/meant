# ADR-0087 — Feature switches, and the right to be forgotten or deleted

- **Date:** 2026-09-25
- **Status:** Accepted
- **Implements:** Issue #19 (I9's seam requirement), Issue #20 (PRD-F15, expanded by ADR-0059)
- **Depends on:** ADR-0042 (no `externally_connectable`, so the extension pulls, it is never
  pushed to), ADR-0058 (the companion's one-tap label), ADR-0059 (the on-device path log)

- **Context:** `companionEnabled` had no UI — it was read in `extension/sw.js`
  (`reinjectCompanion`) and nothing anywhere set it, so I9's "every feature above the
  mechanical loop must be independently removable" was asserted, not exercised. Separately,
  PRD-F15 promised two levels of erasure — clear `memory` for this user, and delete the
  account with all its data — and neither existed; ADR-0059 made the gap worse by adding a
  full-path log in `chrome.storage.local` with no way for a user to clear it on demand.

- **Decision:**

  1. **Three switches, one shape.** Companion, judge, and coach are each on/off, stored in
     the existing `memory` table as `kind='setting'`, key `companion`|`judge`|`coach`, value
     `'on'`|`'off'`. No migration — `memory` already has `unique (user_id, kind, key)`. A row
     that was never written means on. `GET`/`PUT /api/settings` read and write it, authenticated
     by `lib/device-auth.ts#requestUserId` (session or device token, either one).

  2. **The extension pulls; it is never pushed to** (ADR-0042 is still refused).
     `GET /api/device` (device-token auth only) returns
     `{ settings: {companion, judge, coach}, forgetAt }`. `sw.js` calls it at startup and the
     popup calls it on open — both fire-and-forget, so a slow or offline server never delays
     the popup's own render (it animates nothing and opens dozens of times a day). The result
     lands in `chrome.storage.local` as booleans `companionEnabled`/`judgeEnabled`/`coachEnabled`
     — a contract another agent's code reads (`judgeEnabled`) directly. The companion's own
     on/off reaction (`extension/companion-overlay.js`'s `render()`/`applyState()`, and
     `sw.js`'s `reinjectCompanion()`/its `chrome.storage.onChanged` listener) already existed
     from ADR-0070's work; this ADR is what actually sets the flag they read, from the
     server the user's Settings page talks to.

  3. **Off actually costs something, not just hides a button.** `judge`/`coach` off return
     403 from `app/api/judge/analyze` / `app/api/coach/chat` — the boundary that spends
     inference money — not just a UI that declines to call them. `coach` off means
     `app/companion-pet.tsx` does not mount at all (the tomato actor and the drawer it
     opens are one surface); `companion` off is the extension-side switch from #19 above,
     unrelated to this web component.

  4. **"Forget what you know about me"** (`POST /api/me/forget`) deletes every inference
     the record has made about the user — `memory` rows outside `kind in ('list','setting')`
     (so the user's own configured sites and switches survive), `event.label` (the
     companion's one-tap self-report, ADR-0058 — an inference the user volunteered about
     themselves, not an observation), and `judgment`/`analysis` rows — while `session` and
     `event` rows themselves survive untouched. It stores `forget_at = now()` as
     `memory kind='setting' key='forget_at'`. The extension has no way to be told this
     happened (ADR-0042 again), so it learns the same way it learns everything else: the
     next `GET /api/device` returns a newer `forgetAt`, and the device purges any
     `pathLog` entry recorded before it (`purgeBefore`, `extension/lib/path-log.js`).

  5. **"Delete my account"** (`DELETE /api/me`, body `{confirm:'delete'}`) removes
     everything above plus the account itself, in FK-safe order verified against the live
     schema: `judgment` (references `analysis`, `NO ACTION`) before `session` (deleting it
     cascades `event`) before `analysis`, then `inference_call`, `memory`, `pairing_code`,
     `device` (referenced by `session.device_id`, `NO ACTION` — must go after every session
     that named it), one transaction. The Neon Auth identity row
     (`neon_auth."user"`, whose own FKs cascade `neon_auth.session`/`account`) is deleted
     separately and best-effort: this repo's own `.env.test` branch has no `neon_auth`
     schema at all (verified directly — a `_test`-suffixed branch created for app data only),
     so a same-request failure there must never undermine the deletion every "no rows
     survive" check actually verifies. Production is expected to hold both on the same
     branch (ADR-0021). The extension is told nothing directly; it learns through its next
     401 (the device row is already gone), at which point `extension/api.js`'s existing
     401 handling — extended here to also clear `pathLog`, `queue`, and `lastChoice` —
     drops every other piece of per-account local state.

  6. **Settings UI** (`app/settings/page.tsx`) gains a Features section (three `.m-chip`
     on/off pairs, `aria-pressed` plus `data-selected` — the web app's own CSS keys off
     `data-selected`, the extension's off `aria-pressed`; both are set so the same
     component vocabulary renders correctly in either surface) and a Your Data section:
     Forget and Delete account, each stated as one plain sentence naming exactly what it
     removes and that it cannot be undone, behind a two-step confirm with no dark pattern
     in either direction (canceling is exactly as easy as confirming).

- **Consequences:**
  - The companion's off-switch (I9's seam) is now actually reachable by a user, closing the
    exact gap issue #19 named: A9's "ten sessions with the companion on, ten off" experiment
    is unblocked.
  - `judgment`/`analysis`/`inference_call` rows accumulate under a config a user can turn
    off mid-stream; a running analysis already in flight when judge is switched off is not
    retroactively cancelled — only the next call is refused. Accepted: this is a request-time
    gate, not a kill switch on in-progress work, matching every other cost gate in this
    codebase (`DAILY_ANALYSIS_CAP`, `DAILY_COACH_TURNS`).
  - `forgetAt` is a `memory kind='setting'` row like the feature switches, not a new column —
    consistent with rule 1's "no migration."
  - Every table-level deletion in `DELETE /api/me` is verified against the live schema's
    actual FK `delete_rule`s (queried directly, not assumed from the migration files' column
    definitions alone), because `session.device_id` and `judgment.analysis_id` are both
    `NO ACTION`, and getting the order wrong fails the request rather than silently orphaning
    a row.
  - Issue #70 (the offline coach fallback's fabricated coaching claim) is fixed in the same
    commit as the coach's on/off gating, since both touch `app/companion-pet.tsx`'s only two
    non-render branches.

- **Source:** owner instruction 2026-09-25 (task brief); Issue #19; Issue #20; Issue #70;
  ADR-0042; ADR-0058; ADR-0059; ADR-0063; ADR-0075; ADR-0079; ADR-0080; live schema
  verification against `.env.local` and `.env.test`, 2026-09-25.
