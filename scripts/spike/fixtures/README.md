# Spike fixtures — never commit anything in this directory

These files hold **real full paths** from the owner's browser: `docs.google.com/document/d/<id>`,
`github.com/acme/<unreleased>`. ADR-0059 keeps paths on the device and off our servers, and
`lib/migrations/002-drift.sql:24` calls a title or text column in Postgres a release-blocking
change. A path is worse than a title, not better.

`.gitignore` excludes everything here except this file. If you find yourself adding an
exception, you are about to publish someone's browsing history.

## path-log.json

Exported by hand from the extension (see the plan, Task 2). Array of
`{ sessionId, host, path, at }` — the shape `extension/lib/path-log.js#appendVisit` writes.
