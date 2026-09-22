-- ADR-0076. The judge's verdict vocabulary replaces the tap-era one.
--
-- work -> focused, distract -> drift. `neutral` and `unknown` are unchanged and keep the
-- distinction ADR-0047 drew on purpose: `neutral` is a positive finding (genuinely neither
-- work nor drift), `unknown` is the absence of one (the judge's below-confidence floor).
-- Collapsing them would feed the judge's own low-confidence noise into the tally that gates
-- the judge.
--
-- `supportive` is new and has nothing to migrate. It is a judge verdict only: a tap means
-- exactly one thing, "this isn't the work" (ADR-0058), and cannot mean "supportive".
--
-- Both statements are no-ops on a second run, so this is safe to re-apply.
update event set label = 'focused' where label = 'work';
update event set label = 'drift'   where label = 'distract';

-- `judgment.verdict` (serves|drifts|unclear) and `judgment.label` (work|distract|neutral|
-- unknown) were two enums for one fact. The table has never received a row from any code
-- path (PRD 6, verified 2026-09-11), so dropping the redundant column costs nothing now and
-- stops the two drifting apart later. `judgment.label` carries the new vocabulary.
alter table judgment drop column if exists verdict;

-- `signalled`, `gate` and `corrected_to` are deliberately LEFT IN PLACE. They belong to the
-- live-signal design ADR-0057 deleted, and M7 currently has no definition (flow Q4, open).
-- Removing them is a separate decision and does not belong in a taxonomy migration.
