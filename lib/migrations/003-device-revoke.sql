-- Voluntary unpair (D-none, dogfooding gap): revoking a device must not touch its
-- session history. `device_id` on `session` has no `on delete cascade` and never
-- should — a hard delete here would either fail on the FK or silently orphan a
-- user's own past sessions. Soft-revoke instead: the token stops authenticating,
-- the row (and every session it authored) stays exactly as it was.
alter table device add column if not exists revoked_at timestamptz;
