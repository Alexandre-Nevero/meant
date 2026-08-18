# BUILD 2 of 4: The bridge (1:00 to 2:00)

> Paste as the first message of a fresh session, or `claude "$(cat docs/metaprompt-build-2.md)"`.

MEANT is a Chrome/Edge MV3 extension plus a Next.js app on Vercel with Clerk and Neon. Prompt 1 provisioned the stack, applied the schema, shipped the signed-in shell, and recorded the extension-auth decision in `docs/build.md` section 11. Read that decision before anything else; it determines half of this hour.

This is prompt 2 of 4. Your hour connects the extension to the account. Do not build session logic.

## Read first

1. `docs/build.md` section 11 (the auth decision), then sections 2, 6 (TASK-003, TASK-004), 7.1, 7.2.
2. `docs/prd-intent.md` US-06.
3. The `clerk-chrome-extension-patterns` skill if the decision was sync host; `docs/build.md` section 6 TASK-003 if it was pairing code.

## Scope

**If the decision was pairing code:** build TASK-003 and TASK-004.
- `POST /api/pair` mints a six-character code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, expiring in ten minutes.
- `POST /api/pair/claim` claims atomically: update where `claimed_at is null and expires_at > now()`, then **check the affected row count**. Zero rows means 401. On success, insert `device` with `token_hash = sha256(token)` and return the plaintext token. That is the only moment it is ever transmitted.
- Extension: `manifest.json` (MV3, permissions `declarativeNetRequest`, `tabs`, `storage`, `alarms`), `popup.html`, `popup.js`, `api.js`.

**If the decision was sync host:** skip TASK-003 entirely. Build the extension against Clerk's SDK, add the sync host to `host_permissions`, and run `createClerkClient` in the background service worker so the session stays fresh. Record in `docs/build.md` section 11 what replaced the pairing tables, and leave those tables in place rather than dropping them mid-build.

**Either way, `api.js` is the same contract:** exports `post(path, body)`, prefixes the API base, attaches credentials, and on network failure pushes the payload onto a `queue` array in `chrome.storage.local` instead of throwing. Offline tolerance is not a later concern; the tracker's honesty depends on it.

**The popup renders three states from storage:** unpaired or signed-out, idle, running. No framework, no bundler unless the sync host decision already forced one.

## Invariants in play

- Hostname only. Nothing in a payload may contain a path, query string, or title.
- Every device-token route calls the auth check first and returns 401 before reading the body.
- Every query filters on `user_id`. Another user's row 404s, never 403s.

## Lane

Unchanged from prompt 1. You own everything except `design/**` and `app/globals.css`. Use the class vocabulary; no inline styles, no hardcoded colors.

## Done when

- The popup moves from its signed-out state to idle, attributed to a real account.
- A second claim of the same pairing code returns 401, or the sync host equivalent is demonstrated.
- An offline `post()` queues instead of throwing, verified with devtools offline.

Report the state of each. Prompt 3 assumes the extension can authenticate every request it makes.
