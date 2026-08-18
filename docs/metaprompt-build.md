# Metaprompt — BUILD session

> Paste this whole file as your first message in a fresh Claude Code session, or run
> `claude "$(cat docs/metaprompt-build.md)"`. A design session is running in parallel in the same repo; §Coordination is the contract between you.

---

You are building MEANT: a Chrome/Edge MV3 extension plus a Next.js web app on Vercel, with Clerk sign-in and Neon Postgres. It makes someone declare what they intend to finish, blocks chosen sites during the session, records where their attention went, and ends by asking whether they finished it.

**Read first, in this order. Do not start from memory or from this prompt alone:**
1. `docs/build.md` — the file-by-file build guide. It is the spec you execute. §2 invariants, §5 task ledger, §6 contracts, §7 shared contracts, §9 do-not.
2. `docs/sdd-intent.md` — schema, endpoints, security controls.
3. `docs/prd-intent.md` §4 — acceptance criteria. Every "done when" traces here.
4. `docs/build-intent.md` — the four-hour clock and the cut line. Check it at every checkpoint.

## Skills

Invoke `using-superpowers` first; it governs how you find and use the rest.

Install these three before touching code. All are published by the vendors whose products you are integrating, and skill discovery ranked them by installs:

```
npx skills add clerk/skills@clerk-chrome-extension-patterns -g -y
npx skills add googlechrome/modern-web-guidance@chrome-extensions -g -y
npx skills add neondatabase/agent-skills@neon-postgres -g -y
```

Then, in the order they become relevant:
- `vercel:marketplace`, then `vercel:vercel-storage` and `vercel:auth` — provision Neon and Clerk through the Vercel Marketplace before writing app code, never after. Never `npm install` a provider SDK to stand in for a real integration.
- `vercel:nextjs` — App Router specifics. Do not write route handlers from memory.
- `test-driven-development` — for the pure functions only: attention attribution, the gap calculation, session recovery. The rest of this build is verified manually by `docs/build.md` §8, and that is a deliberate call given four hours, not an oversight. Say so in your report rather than pretending there is a test suite.
- `systematic-debugging` — the moment anything behaves unexpectedly. No guess-patching.
- `verification-before-completion` — before any claim that something works.
- `dispatching-parallel-agents` and `subagent-driven-development` — see §Parallelism.
- `find-skills` — if you hit a domain none of the above covers.

Do **not** use `using-git-worktrees` here. The design session needs to see your markup and you need to see its tokens, in one tree. Isolation comes from file ownership instead, below.

## The one open decision — resolve it in the first 20 minutes

`docs/build.md` specifies a one-time **pairing code** for extension auth, chosen because a Chrome extension cannot read the web app's session cookie. That premise is incomplete: Clerk ships an official Chrome Extension SDK with a **sync host** feature that shares the web app's session with the extension directly.

The trade-off is a build step. `@clerk/chrome-extension` is an npm package and Clerk's quickstart uses Plasmo, which contradicts `docs/build.md` B1 ("plain JS, no bundler").

**Timebox a 20-minute spike.** Read the `clerk-chrome-extension-patterns` skill and Clerk's sync-host docs, then decide:
- **Sync host** if you get a signed-in extension popup inside the spike. It deletes TASK-003 entirely.
- **Pairing code** if you do not. It is fully specified in `docs/build.md` §6 and needs no toolchain.

Whichever you pick, record it in `docs/build.md` §11 with one line of reasoning, and update the affected tasks before continuing. Do not carry both paths forward.

## Invariants

From `docs/build.md` §2. Breaking one is a bug, not a refactor.

1. No in-memory state in the service worker. It dies after 30s idle. Elapsed time is always `now − storedTimestamp`.
2. Hostname only. Never a path, query string, or page title, in any payload or column.
3. Block rules die with their session, on every path including errors and recovery.
4. No fourth external service. Three of five are allocated.
5. Host permissions are per blocked domain, never `<all_urls>`.
6. Every query filters on `user_id`. Another user's row 404s, never 403s.

## Parallelism

Sequence the ledger in `docs/build.md` §5, but these are genuinely independent and are worth dispatching as subagents rather than doing serially:

| Can run in parallel | Why it is safe |
|---|---|
| TASK-002 (Next shell, Clerk, dashboard shell) and TASK-004 (extension skeleton, manifest, popup states) | Disjoint file scopes; they meet only at the API contract in §7.1, which is already fixed |
| TASK-008 (review page) and TASK-007 (blocking) | Different surfaces, no shared file |
| Schema application and the extension manifest | Nothing in common |

Everything else is a real dependency chain. Do not fan out work whose interface you have not pinned first: give each subagent the exact contract from `docs/build.md` §7, its file scope, and its done-when. Verify its claims yourself on the actual surface. A subagent's report is not evidence.

## Coordination with the design session

**This section is canonical. The design metaprompt points at it.**

**File ownership. Do not write outside your lane.**

| Lane | Owns |
|---|---|
| Design session | `design/**`, `app/globals.css` |
| Build session (you) | everything else: `app/**` except `globals.css`, `lib/**`, `extension/**` except its CSS, `docs/**` |

**The meeting point is class names.** You write semantic markup with these from the first commit. Design styles them. You never write visual CSS; design never writes logic.

```
.m-app                     app shell
.m-mark[data-state]        idle | running | drifting | ended | empty
.m-sentence                the user's intention, wherever it appears
.m-meta                    elapsed, counts, secondary figures
.m-field                   the intention input
.m-btn[data-variant]       primary | quiet
.m-answer[data-answer]     yes | not-yet
.m-row                     a domain row in the review
.m-row-domain / .m-row-bar[data-kind="attention|away"] / .m-row-figure
.m-rate                    the completion rate on the dashboard
.m-empty                   empty states
```

Rules: never rename one of these unilaterally; if a name is wrong, say so and wait. Never inline a style attribute — the design session cannot override it. Import `design/tokens.css` and use its custom properties; never hardcode a color.

**Conflicts:** if `git status` shows the other session touched a file in your lane, stop and report it rather than resolving it yourself.

## Definition of done

- The demo path in `docs/build-intent.md` §5 runs twice consecutively without a reload.
- `docs/build.md` §8 cases T1, T2, T4, T7 pass, verified by you actually running them, not by reading the code.
- `npx tsc --noEmit` and `npm run build` both clean.
- Every cut you made is recorded in `docs/build-intent.md` §7 with what it cost.
- The Clerk decision is recorded in `docs/build.md` §11.

Report exactly what works, what is stubbed, and what is missing. If the clock beat you, say which cut-line item you took and when. Do not describe a partially working loop as working.
