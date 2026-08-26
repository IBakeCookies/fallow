# What the Lab tile was measured with

**Kind:** repair · **Status:** landed 2026-08-18 · **Roadmap:** item 31, finding M11

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes, and no `src/` file is touched at all. §13.6 cited
`scratchpad/rv-energy-readouts.probe.ts` for two number-sets; that file exists in
neither the tree nor git history. One probe arm re-derives them from the shipped
fields. **One set reproduces on all twelve cells and one is withdrawn**, and the
asymmetry between them is the finding.

This closes item 31 — the whole-file MATH.md audit of 2026-08-14, thirty-seven
findings raised and fourteen upheld. M11 was the last, and the smallest.

## Scenarios

**No suite scenario, and that is deliberate.** No formula, constant, bound, fit
or runtime value changes, and unlike the previous two batches not even a comment
in `src/` moves — the whole change is a probe arm plus the documents it corrects.
The arm is a probe-backed Claim, written after the fact by rule: a probe reports
a number and there is no red to watch.

- **M11** — `rv13-terminal-timing.probe.ts` gains one arm printing the forced
  pure-cognitive ladder at 2/4/6/8/10/12 h in a 12 h window with four columns
  (`workEndCog`, `endCog`, the pre-fix tile, today's tile), then
  `optimizeSchedule` over three named fixtures with `endCog` against
  `workEndCog`.

Acceptance is the two outcomes below, each re-run by the reviewer rather than
taken from the implementer's report — which is how the date finding was caught.

## Out of scope

- **Any `src/` change.** The tile is correct; the fix it documents shipped
  2026-08-07. Only the record of what measured it was missing.
- **A new probe file.** The arm went into the probe that already backs §13.6 and
  already had the `task` helper and the imports. A third file would have been a
  `scripts/PROBES.md` row buying nothing.
- **Recovering the lost fixture behind 0.890/0.469.** Three plausible task sets
  were read out and named; the nearest miss found is recorded as a lead. Tuning
  a fixture until the target reappears would back nothing, so the pair is
  withdrawn rather than fitted.
- **Re-dating §13.6's fix date.** See the decision below — the reported
  off-by-one is a timezone boundary, not a defect.
- **Re-measuring §13.6's other sets.** The two pre-existing arms were re-run and
  confirmed unchanged, but nothing beyond the findings was re-quoted. Same rule
  the previous three changes stated.
- **The `availableHours` and peak-depletion blockers (§13.6's two numbered
  items).** Settled against on 2026-07-29 with promotion; untouched.

## Read before building

- `MATH.md` §13.6 (the Lab-tile paragraph, its ladder and the shipped-optimum
  sentence), §14.1-2 (the uncommitted-probe failure this repeats), §15.1 (the
  unbacked-label precedent, considered as the fallback and not needed).
- `src/lib/business/model/zenith-energy.ts` — `simulateReservoirs` (what it
  reads, which is what pins the ladder's fixture), `ScheduleEvaluation`'s
  `endCog` / `workEndCog`, and `optimizeSchedule`.
- `src/routes/(app)/energy/+page.svelte` and
  `src/lib/presentation/component/plan-summary.svelte` — the tile's live
  formula; and `git show 8f01ca8^` for the pre-fix one.
- `scripts/rv13-terminal-timing.probe.ts` — the existing `task` helper, `PAIR`,
  and `WINDOW_HOURS = 10`, which belongs to the existing arms and stays.
- `ROADMAP.md`, item 31 and finding M11.

## Decisions

- **A claim whose prose fully specifies its fixture survives losing its probe.**
  The ladder reproduces on all twelve cited cells because `simulateReservoirs`
  reads the two demands and the params and neither `difficulty` nor `enjoyment`
  — so "forced, pure-cognitive, 12 h window" determines every row, and no
  unstated field could have moved it. This is the exception that explains the
  rule: the other set, which needed an optimizer, did not survive.
- **The shipped-optimum pair is withdrawn, not corrected.** 0.890/0.469 is
  reproduced by none of the ladder's own task, §13.6's cognitive/physical pair,
  or §8.10's fixture day, and it is unreachable from the ladder's shape at all:
  `endCog` 0.890 puts the end of work near 10 h, where full cognitive demand
  leaves `workEndCog` at 0.146. So the lost fixture was several milder tasks.
  §13.6 now quotes the ladder's own task optimized — 0.9995 against 0.4542 —
  which makes the paragraph's point by a **wider** margin than the withdrawn
  pair did.
- **The nearest miss is a lead, not a reading.** Three identical full-cognitive
  tasks give 0.8883/0.4606. Close enough to place the lost fixture, not close
  enough to be it, and adopting it would be reverse-engineering a fixture to hit
  a number — the exact failure mode this batch exists to correct.
- **A pre-fix formula is re-derivable when it is arithmetic over a field that
  still ships.** `8f01ca8^` passed `plan.evaluation.endCog` into
  `Math.round(endCog * 100)`; today's passes `workEndCog` into `Math.floor`. Both
  columns were read off the code rather than assumed, and no old code path was
  reinstated. Contrast §14's pre-solve-once 103.6 ms, which cannot be re-run
  because the change it measures is shipped: the distinction is whether the
  inputs still exist, not whether the code does.
- **The lost probe carried the R3 hazard, and that is the likely asymmetry.**
  8f01ca8 introduced `workEndCog` and the tile fix that reads it in the same
  commit, so the 2026-08-07 figures cannot have come from that field —
  end-of-work depletion was computed privately. A second implementation agrees
  with the shipped one on a forced single-task day and has every chance to
  diverge once an optimizer and an unnamed task set are in play.
- **The reported date defect was rejected after checking, and the rejection is
  recorded.** 8f01ca8 was authored 2026-08-08 01:03 +0200 and committed
  2026-08-07 23:03 UTC. §13.6's "fixed 2026-08-07" is one side of a date
  boundary, not a wrong fact; renaming it would desynchronise the section from
  its neighbouring probe dates for no gain. Written into §10 so a later audit
  does not re-raise it.
- **§15.1's unbacked label was the planned fallback and was not needed.** Both
  halves ended up with a committed probe behind them: one re-derived, one
  replaced by a measured pair with its fixture named.
- **Every pre-existing figure in the probe was re-run and is unchanged** — the
  four-plan avg/min table to four decimals, worst |Δ| 0.0767 with the ranking
  preserved under both aggregators, C_cog 0.2081 at 6 h (risk 79%), and V_T's
  0.0339 per hour against `freeTimeValue`'s 0.5.

## Open questions

None.
