# ADR-0086 — The judge fails its eval gate, so it renders nothing

- **Date:** 2026-09-25
- **Status:** Accepted
- **Context:** ADR-0085 fixed the pass criteria before any data was written, and the runs went in the order it set, one commit each under `eval/results/`: the set (`eval/judge-cases.json`), then the baseline on test, then the judge on dev, then the floor, then the judge once on test. The config is the production one, `openai/gpt-oss-120b` via Groq, with the same request the route sends (`lib/judge/request.ts`).

  **Sizes.** 48 sessions and 205 labelled visits, split by session into dev (24 sessions, 102 visits) and test (24 sessions, 103 visits). Test labels: 33 `focused`, 30 `supportive`, 7 `neutral`, 14 `drift`, 19 `unknown`. No session was truncated on either side: 0 uncovered sessions and 0 uncovered visits.

  **Baseline on test** (`baseline-test.json`): the declaration alone scores 27/103 = 0.262 with undeclared hosts filled as `neutral`, and 38/103 = 0.369 with them filled as `unknown`. The bar is the stronger one, **0.369**.

  **Judge on dev** (`judge-dev.json`, `floor.json`). Precision among rendered verdicts rises with the floor: 0.725 at 0.00 (102 rendered), 0.779 at 0.70 (95), 0.797 at 0.80 (79), 0.823 at 0.85 (62), 0.827 at 0.90 (52), 1.000 at 0.95 (22). The lowest grid point at ≥ 0.80 on ≥ 20 rendered verdicts is **0.85**, so the floor is 0.85. The placeholder 0.70 (ADR-0080) would have failed on dev.

  **Judge on test, run once at floor 0.85** (`judge-test.json`, `gate.json`):
  - **(a) Accuracy over all 103 rows: 56/103 = 0.544, against the baseline's 0.369. Pass.**
  - **(b) Precision among rendered verdicts: 44/60 = 0.733, against a bar of 0.80. Fail.** The 95% Wilson interval on 44/60 is roughly 0.61 to 0.83. The bar sits inside it, so 60 verdicts can't show the judge's real precision is below 0.80. They can't show it reaches 0.80 either. ADR-0085 requires the measured figure to clear the bar, and it doesn't.

  **Where the 16 wrong rendered verdicts went** (descriptive only, found after the result and changing nothing): 7 were confident verdicts on visits labelled `unknown` (3 `supportive`, 2 `drift`, 1 `neutral`, 1 `focused`). 5 were `focused` visits called `supportive`. 2 were `drift` visits called `supportive`. 2 were `neutral` visits called `drift`. Of the 7 rendered `drift` verdicts, 3 were right. A wrong `drift` is the false positive ADR-0057 deleted the live signal over.
- **Decision:** **The judge fails ADR-0085's gate and renders nothing to anyone.** Rendering is off behind one exported boolean, `JUDGE_RENDERS = false` in `extension/lib/judge-view.js`. The popup's "try the judge" UI is built behind that boolean and never shows while it is `false`.

  The floor is **not** replaced. 0.85 is the floor the dev split produced, and it failed on test, so no measured floor is licensed. `PROVISIONAL_MIN_CONFIDENCE = 0.70` (`lib/thresholds.ts`) stays a placeholder, now known to be below even the failed candidate. Nothing about the set, the criteria, the prompt or the floor changes after this result. ADR-0085 forbids it, and this ADR is the record that it didn't happen.
- **Consequences:**
  - **Flipping `JUDGE_RENDERS` is not a way to ship the judge.** A pass on a new run is. That means a new eval ADR with its own pre-fixed criteria, then replacing `PROVISIONAL_MIN_CONFIDENCE` with the measured floor under a new name (never one containing the retired `CONFIDENCE_FLOOR` substring; see `test/companion-state.test.js`), then turning the boolean on. A change to the prompt or model is a new judge, so it needs a new test split or a fresh set, because this test split has now been seen.
  - The route still writes `judgment` rows when called. ADR-0073 allowed that, and nothing in the product calls it while rendering is off. The ADR-0078 memory tally still filters at 0.70. That filter was not measured and is recorded here as owed.
  - **What the failure says, within ADR-0085's limits.** The judge beats the declaration by a wide margin on accuracy, so it isn't worthless. Its high-confidence verdicts are still wrong about one time in four, and those errors cluster on visits a careful reader couldn't resolve and on `supportive` against `focused`. On this set, it doesn't know when it doesn't know. Two limits bound that reading: the set is synthetic and AI-labelled (ADR-0085), and 60 rendered verdicts is a small sample.
  - The spike's much higher numbers (0.966 accuracy at 0.70) came from a templated set whose author also labelled it. The difference between those numbers and these is the measured cost of that weakness.
- **Source:** `eval/results/*.json`; `scripts/eval/run.mjs`; ADR-0037, ADR-0057, ADR-0073, ADR-0078, ADR-0080, ADR-0085.
