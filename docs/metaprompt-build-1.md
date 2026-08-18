# BUILD 1 of 4: Foundation (0:00 to 1:00)

> Paste as the first message of a fresh session, or `claude "$(cat docs/metaprompt-build-1.md)"`.

You are building MEANT: a Chrome/Edge MV3 extension plus a Next.js app on Vercel, with Clerk sign-in and Neon Postgres. It makes someone declare what they intend to finish, blocks chosen sites, records where their attention went, and ends by asking whether they finished it. The number that accumulates is completed outcomes, never hours.

This is prompt 1 of 4. Your hour buys the ground everything else stands on. Do not start the extension.

## Read first, in this order

1. `docs/build.md` sections 1, 2, 3, 5, 6 (TASK-001, TASK-002), 7.
2. `docs/sdd-intent.md` sections 3 and 4.
3. `docs/build-intent.md` for the clock and the cut line.

## Skills

Invoke `using-superpowers` first. Then install, because these are published by the vendors you are integrating:

```
npx skills add clerk/skills@clerk-chrome-extension-patterns -g -y
npx skills add neondatabase/agent-skills@neon-postgres -g -y
npx skills add googlechrome/modern-web-guidance@chrome-extensions -g -y
```

Then `vercel:marketplace` before you pick or install any provider, followed by `vercel:vercel-storage`, `vercel:auth`, and `vercel:nextjs`. Provision through the Marketplace; never `npm install` a provider SDK as a stand-in for a real integration, and never write App Router handlers from memory.

## Scope

**TASK-001, provision and schema.** `vercel link`, add Neon and Clerk from the Marketplace, `vercel env pull`, apply `lib/schema.sql` verbatim from `docs/sdd-intent.md` section 3.1. Four tables: `device`, `pairing_code`, `session`, `event`.

**TASK-002, shell and auth.** `app/layout.tsx`, `app/page.tsx`, `app/dashboard/page.tsx`, `middleware.ts`, `lib/db.ts`. Sign in from `/` lands on `/dashboard`, which renders its empty state.

**The middleware detail that costs three tasks if you miss it:** `middleware.ts` protects everything except `/`, `/api/pair/claim`, `/api/sessions/*`, and `/api/events`. Those are device-token routes. If Clerk redirects one of them, a `fetch()` receives HTML and you debug a JSON parse error two prompts from now, far from its cause.

`lib/db.ts` exports one thing, a query function. No ORM, no schema DSL.

## The decision this prompt owns

`docs/build.md` specifies a one-time pairing code for extension auth, on the premise that an extension cannot read the web app's session. That premise is incomplete: Clerk ships a Chrome Extension SDK with a sync host feature that shares the session directly. The cost is a build step, since `@clerk/chrome-extension` is an npm package and Clerk's quickstart uses Plasmo, which contradicts `docs/build.md` B1 (plain JS, no bundler).

**Timebox 20 minutes.** Read the Clerk skill and the sync host docs, then decide:
- Sync host, if you get a signed-in extension popup inside the spike. It deletes TASK-003.
- Pairing code, if you do not. It is fully specified and needs no toolchain.

Record the decision in `docs/build.md` section 11 with one line of reasoning, update the affected tasks, and carry exactly one path forward.

## Lane

You own everything except `design/**` and `app/globals.css`. A design session owns those and is running now. Write semantic markup using the class vocabulary in `docs/metaprompt-build.md` Coordination. Never inline a `style` attribute, never hardcode a color, import `design/tokens.css` for values. If `git status` shows the design session touched your lane, stop and report rather than resolving.

## Done when

- A query against `session` returns zero rows without erroring.
- Sign in from `/` lands on `/dashboard` and the empty state renders.
- The four device-token routes are excluded from Clerk middleware, verified by curling one and getting JSON, not HTML.
- The auth decision is written into `docs/build.md` section 11.

Report what is real, what is stubbed, and the minute you finished. Prompt 2 assumes all four lines above are true.
