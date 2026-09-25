# ADR-0088 — MEANT is not deployed; the reference build runs locally

- **Date:** 2026-09-25
- **Status:** Accepted
- **Context:** The Vercel project `focus` has never held a deployment, and `extension/api.js` defaults `apiBase` to `http://localhost:3000`. `apexhuman.md` §7 rule 4 ("deploy on day one") had been read as applying to this build, which made the absence of a production URL look like a defect. It was never recorded whether it was one.
- **Decision:** **MEANT is not deployed.** It is the reference product for the Apex Human course, and it runs locally: `npm run dev` for the app, `extension/` loaded unpacked, one Neon project for data and auth. No production URL, no store listing, and no users outside the team. Work on it is ranked by how complete and polished the product is, not by adoption.
- **Consequences:**
  - `DEFAULT_API_BASE = 'http://localhost:3000'` is correct, not a leftover.
  - Real usage data comes only from the team's own local sessions, so the judge's eval is synthetic and committed (ADR-0085), not built from real users.
  - `apexhuman.md` §7 rule 4 and §9a R1 ("a deployed, working review screen") are about the **student's** rebuild, not about this build. The manual still owes a first-deploy chapter, and nothing here removes it; it just means the reference build is not the thing that gets deployed.
  - `PRODUCT.md`'s business model (subscription, the paywall at the inference-cost line) describes what a student could sell, not something this build charges for. ADR-0075 already suspends every paid gate.
- **Source:** owner decision 2026-09-25 ("We are not deploying this. This is a reference product."); `vercel project inspect focus`, which shows no deployments.
