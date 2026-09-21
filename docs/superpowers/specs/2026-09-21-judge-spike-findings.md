# Judge spike — findings

**Date:** 2026-09-21
**Plan:** `docs/superpowers/plans/2026-09-21-judge-spike.md`
**Status:** run to completion, with one material deviation from the plan — see "How this data was produced" below. Read that section before trusting any number here.

## How this data was produced (read this first)

Task 2 Step 4's own gate stopped the plan before it could run against real
data: the on-device `chrome.storage.local` path log covered only **2
sessions** against the plan's own >=15-session floor for a measurable
sample (`PATH_TTL_MS` had purged the rest of the owner's history). Per an
owner decision on 2026-09-21, this was **not** worked around by waiting for
more real usage. Instead, 24 synthetic sessions were generated directly as
structured data (`scripts/spike/generate-synthetic-corpus.mjs`) and run
through the real, already-reviewed `buildCases` (Task 3) — the same
pipeline real data would hit.

**This is a material, deliberate limitation on everything below, not a
footnote:**

1. **The answer key is not independent of the data.** The same party that
   authored each session's intended label (the generator/controller) also
   produced `labels.jsonl`. A real answer key requires a human labelling
   blind, per ADR-0073 — that did not happen here. The numbers below cannot
   show the judge generalizes to real, ambiguous human behaviour. They can
   only show two narrower things: whether a small model can **produce** the
   label vocabulary at all, and whether it can follow **unambiguous** cases
   correctly.
2. **Every visit in the synthetic corpus carries a path** (87/87). Question
   4 below ("how much does the path add") is **not measurable** from this
   run — there is no path-vs-no-path comparison group in synthetic data,
   because the generator gave every host a plausible path by construction.
3. **The residual ratio (72%) is a generator setting, not a discovered
   fact.** The generator deliberately declared roughly half of the
   focused/drift hosts as work/blocked sites and left the rest undeclared,
   to make sure the judge had a nontrivial job to do. It says nothing about
   how much of a *real* user's browsing goes undeclared.

None of the numbers below are useless — they answer the narrower questions
the plan also cared about (vocabulary producibility, confidence-floor
shape) — but **none of them license shipping the four-label judge against
real users on this evidence alone.** A real, human-labelled run (once
`PATH_TTL_MS`-eligible path data accumulates past 15 sessions) is still
required before ADR-0073's gate is actually satisfied.

## 1. Does the judge beat the no-model baseline?

Yes, decisively, on the metrics this synthetic run can measure.

**Held-out test split** (winning config: four-label taxonomy, `openai/gpt-oss-120b`, chosen on dev, run once against test per the plan):

| | Baseline (declaration only) | Judge (four/120b) |
|---|---|---|
| Accuracy | 0.522 (over all 46 rows) | 0.905 (over 42 covered rows; 0.826 over all 46) |
| Coverage | 1.000 | 0.913 (11/12 sessions — free-tier rate limit truncated 1 session) |
| Drift precision | 1.000 | 0.818 |
| Drift recall | 0.500 (over all 10 real drift rows) | **0.900** (9 of 10 real drift rows, over all 46 — not the 1.000-among-covered figure a first pass at this table reported) |

The baseline's perfect drift precision is a small-denominator artifact: it
only ever predicts `drift` when a site was pre-declared as a distraction,
so it catches half of real drift and is silent (as `neutral`) on the rest.
The judge predicts drift more broadly and catches nearly all of it (9 of
10), at a real but non-trivial false-positive cost (2 of 11 predicted-drift
were wrong). **Per ADR-0060's own rule — build the arithmetic before the
judge, and a model that cannot beat it does not ship — accuracy clears that
bar by a wide margin on this data, using either denominator;** whether
drift precision at 0.900 recall is an acceptable trade against the
baseline's precision-only behaviour is a product decision, not a
measurement one.

## 2. Is `supportive` separable?

Yes, on the one comparison this run can actually support — but an earlier
draft of this section drew a second conclusion from an invalid comparison,
caught in review. Both are recorded here so the correction is auditable.

**Valid evidence: held-out test, four/120b.** `supportive` precision
0.909, recall 0.909. This is a real, within-taxonomy result: the model was
offered the label and used it correctly on 10 of 11 opportunities. This
alone supports "producible and separable, on this data."

**Invalid comparison, now withdrawn.** An earlier draft compared raw
accuracy across the four-, three-, and two-label dev runs (0.659 vs 0.481
vs 0.429) and concluded the four-label taxonomy was doing better than a
collapsed one. That comparison scored all three runs against the
**unfiltered four-label truth** — so the three-label run had 8 of its 27
kept rows carrying a `supportive` truth answer it was never offered the
word for, and the two-label run had 20 of its 35. Both were mechanically
unwinnable, not model failures. Once `score.ts` was fixed to restrict each
run's truth set to its own taxonomy (the fix this review triggered), the
same dev data reads:

| dev run | kept rows | accuracy (own taxonomy) |
|---|---|---|
| four/20b | 41 | 0.659 |
| three/20b | 27 | 0.684 |
| two/20b | 35 | **1.000** |

The two-label run got every row it could possibly get right, right — it
was never a harder problem for the model, it was a smaller one. **Accuracy
is not comparable across taxonomies even with this fix** — each run solves
a different-difficulty problem by construction, so a within-taxonomy
perfect score and a four-label imperfect score are not evidence for or
against either taxonomy relative to the other. The only cross-taxonomy-safe
metric here is `binaryDriftPrecision` (score.ts says so in its own
comment), and it does not move in a way that argues for or against
`supportive`'s presence either.

**Conclusion for Plan 2 (contingent on a real re-run):** rest this
question on the held-out `supportive` P/R alone (0.909/0.909) — it is
produced and used correctly when offered. Whether a smaller vocabulary
would have done just as well is genuinely unanswered by this run, not
answered in either direction. Re-verify on real, human-labelled data before
treating either claim as settled.

## 3. What is the confidence floor?

From the held-out sweep (four/120b, test):

| Threshold | Coverage | Accuracy | Drift precision |
|---|---|---|---|
| 0.00 | 0.913 | 0.905 | 0.818 |
| 0.55 | 0.848 | 0.949 | 0.818 |
| 0.70 | 0.630 | 0.966 | 0.900 |
| 0.85 | 0.413 | 1.000 | 1.000 |

There is a real, usable curve here: raising the floor trades coverage for
precision smoothly, with no cliff. **A floor around 0.70** looks like a
reasonable candidate — it keeps 63% of visits rendering a verdict at 0.900
drift precision and 0.966 accuracy — but this number was fit on synthetic
data the model was never confused by in the way real ambiguous browsing
would confuse it. Treat this as "the shape of the curve is sane," not "0.70
is the number," until re-run for real.

## 4. How much does the path add?

**Not measurable from this run.** Every one of the 87 synthetic visits
carries a path (100%), because the generator gave every host a plausible
path by construction. There is no path-vs-no-path comparison group to
measure against. This question requires a real run, where path coverage is
naturally partial.

## 5. How large is the residual?

63 of 87 visits (72%) were undeclared in the synthetic corpus. **This is a
generator setting, not a discovered fact** — the generator deliberately
left roughly half of the focused/drift hosts undeclared so the judge would
have a nontrivial job. It cannot be used to argue the judge's real-world
addressable job is large or small; that remains an open question pending a
real corpus.

## Sample size and label counts

24 synthetic sessions, 87 visits total. Split by session: dev 41 visits /
test 46 visits. Label counts (whole corpus): focused 23, supportive 24,
neutral 24, drift 16 — all comfortably clear the plan's own >=10-example
floor for a measurable per-label precision, on synthetic data.

Per Task 7 Step 7's free-tier constraints, three of the four dev
configurations only received partial session coverage before hitting
Groq's free-tier rate limit (expected and disclosed by the plan itself):
four/20b 12/12 sessions, three/20b 8/12, two/20b 10/12, four/120b(dev)
10/12. The held-out test run (four/120b) completed 11/12 sessions.

## What this run does and does not license

- **Does license:** treating the four-label vocabulary as plausibly
  producible by a small model, and treating the confidence-floor mechanism
  (ADR-0073's gate) as workable in shape.
- **Does not license:** shipping the judge against real users, or trusting
  the specific precision/recall/threshold numbers above as representative
  of real behaviour. **A real, human-labelled run remains required** before
  ADR-0073's release gate is actually satisfied — this run answers "can the
  mechanism work at all," not "does it work on real ambiguous browsing."

## Recommendation for Plans 2–5

Do not cancel Plans 2-5 on this evidence (the mechanism clearly *can* work),
but do not green-light them on it either. The next real step is accumulating
>=15 sessions of real, unpurged path-log data (i.e. actually using the
product for a while, or shortening/removing `PATH_TTL_MS` for the owner's
own account during evaluation), re-running Task 2 Step 3 onward for real,
and treating *that* run's numbers — not this one's — as the actual answer
to the five questions above.
