# Four descriptions the code moved past

**Status:** landed 2026-08-17 · **Roadmap:** item 31, findings M2, M3, M22 and M13

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes. Four statements describe something the code no
longer does: §21.4 labels a baseline "(shipped)" that the metric stopped using,
§11.11 gives a per-defer step its own table already contradicts, §8.12 keeps a
per-solve millisecond figure §8.6 superseded, and the warm-up-carryover
mechanism ships with no §8.2 citation at all. Two of the four are arithmetic and
were re-measured; two are prose. After this, each says what the code does.

This is the cheap half of item 31's upheld list — the half that needed no new
instrument. The expensive half (M9/M10's advisor timings, M11's missing probe)
is untouched and stays open.

## Scenarios

**No suite scenario, and that is the batch's shape.** No formula, constant,
bound, fit or runtime value changes, so R6 has no behaviour to fail a test for.
The R6 obligation is discharged the way `three-explanations-the-code-outgrew.md`
discharged it — through artefacts that already exist, plus two probe arms whose
printed output IS the result:

- **M2** — `rv15-gain-headroom.probe.ts` gains **arm J**, which prints the
  shipped rotation-averaged baseline beside the single largest-remainder split at
  five budgets. A probe-backed Claim is written after the fact by rule: there is
  no red to watch when the answer is a number.
- **M3** — `mtr-grind-density.probe.ts`'s question-6 lever arm is corrected in
  place and re-run. The day it reports was already in §11.11's table; the arm now
  agrees with it.
- **M22, M13** — prose and comments. No number is produced and none is needed.

Acceptance is the four corrections below, each checked against the code rather
than against the finding that raised it.

## Out of scope

- **Any executable change outside two probe arms.** No `.ts` expression in
  `src/`, no `.svelte` prop, no metric, no allocator seam. `calculation.ts`'s
  grind density and `zenith.ts`'s `naiveBaselineValue` are both **correct** — the
  document and the probes described them wrongly, which is the whole batch.
- **Re-measuring §8.6's timing table.** It is backed, dated and instructed to be
  quoted as a range. M22 is a stale copy of one of its cells, not a measurement
  gap — the lens that filed it as unbacked was refuted.
- **M9, M10 and M11.** All three need `suggestPlanAdjustments` timed or
  re-derived from a probe that does not exist. That is a build, not a correction,
  and M9/M10 should land together since one probe reaches both.
- **§8.2's missing `scripts/PROBES.md` row**, and the other three registry holes
  (§18, §22, §11.5). Named at the end of item 31's findings section as a separate
  concern; adding a row here would imply a probe this change does not write.
- **The advisor figures in §11.11's later paragraph** (332 offers, 132 under 15%,
  the ~3pp hour-weighted step). They were measured against the pre-retirement
  advisor, cannot be re-run now the axis is gone, and are not fed by the step
  expression this change fixes.
- **§21.5's `equal split | +1.9%` row.** Its label says "equal split" and means
  it; arm D reproduces both its figures exactly. Only the row that claimed to be
  the shipped baseline was false.
- **Re-dating §21's or §8.6's backed figure sets.** Same rule the previous
  change stated: re-measuring a section's whole set is how a correction grows
  without adding evidence.

## Read before building

- `MATH.md` §21.4 (the reference-set table), §21.1 (the selection/shape
  decomposition that shares its baseline), §11.11 (the axis-retirement section),
  §8.12 (the budget curve's Cost paragraph), §8.6 (the timing table §8.12 should
  defer to), §8.1 and §8.2 (whose text is correct and uncited).
- `src/lib/business/model/zenith.ts` — `naiveBaselineValue`, the rotation loop.
- `src/lib/business/model/metric/calculation.ts` — `calculateGrindDensity`.
- `src/lib/business/model/zenith-energy.ts` — the file-header bullets, the
  `EnergyParams` docblocks, `resumePhase`, and `suggestBudgetCurve`'s docblock
  (already corrected on 2026-08-13, and the model for M22's fix).
- `scripts/rv15-gain-headroom.probe.ts` (arms A, D, G, H) and
  `scripts/mtr-grind-density.probe.ts` (question 6).
- `ROADMAP.md`, item 31 and findings M2, M3, M22, M13.

## Decisions

- **Add a row rather than replace one (M2).** §21.4 now carries four rows: the
  single equal split at +1.9% **and** the shipped rotation average at +2.9%.
  Replacing the number would have destroyed the section's own point, which is
  that the figure is a property of the comparison. Both are true; only the label
  was false.
- **The shipped baseline is the weaker one, and the section says why.** An
  average over n rotations cannot exceed the best rotation, so it reports a
  larger gain than a single split does. Measured on §21's reference day: 4.575
  against 4.621, optimizer 4.710. The general claim is bounded to what was
  measured — §19's own 2026-08-17 measurement found the average strictly below
  the best rotation on 75.9% of days and tied on the rest, so "below any single
  split" would have been a stronger statement than anything run.
- **§21.1 is corrected even though no finding named it.** Its selection and
  shape terms are measured against the single split, so they sum to 1.9% and not
  to the 2.9% §21's own header reports. A reader arriving from that header would
  read the decomposition as explaining the shipped number. One clause, same
  defect, same change (AGENTS.md §0).
- **The probe mirrors the metric instead of re-deriving it (M3).** The corrected
  step is `reading(g, m) − reading(g−1, m−1)` over the same rounding
  `calculation.ts` does, not the closed form `100·(m−g)/(m(m−1))`. The closed
  form is right and is what MATH.md states, but computing it in the probe would
  be a second implementation of a shipped expression — the R3 hazard — and it
  needs special cases at `m = 1` and `g = m` that the difference handles for
  free.
- **M3's re-measurement moved a number nobody flagged.** The mispriced-defer
  share is **10/545**, not 107/545. The finding predicted only that the step and
  the 20pp were wrong. §11.11's conclusion still stands because it never rested
  on that count — it rests on the 153/600 band split, the
  `100 − RewardDensity` duplication, and the retired axis's own offer log.
- **§8.12 defers, it does not re-quote (M22).** The Cost paragraph now points at
  §8.6's table and gives its run-A range (30.0 ms at 3 tasks/8 h to 412.4 ms at
  15 tasks/12 h) with the machine caveat attached. Keeping one cell is how the
  ~40 ms got stale in the first place, and the conclusion the paragraph draws —
  never a `$derived` — is only strengthened by a larger per-solve cost.
- **Two of M13's five named sites are deliberately left uncited.** The
  `EnergyParams` defaults-block comments get no section reference, because this
  file puts the citation on the interface docblock and never on the default —
  `microRecoveryFraction` cites §8.5 on its docblock while its default comment
  cites only Rohmert (1960). Following the finding literally would have broken
  the pattern it invoked. The `resumePhase` call sites are likewise bare: the
  docblock they call now carries §8.2, and repeating it at the call site is the
  restatement AGENTS.md §0 forbids.
- **M13's largest site was one the audit missed.** The file header's warm-up
  bullet describes the whole §8.2 mechanism — decaying carryover, the hump's
  double duty, fragmentation — while its two sibling bullets cite §8.5 and §8.4.
  That asymmetry is the clearest instance of the defect and is fixed with the
  rest.
- **Every published probe figure still reproduces.** Arm J is deterministic and
  adds no draw; M3's fix touches one expression and the arm that reads it. Arms
  A–I's numbers, and every §11.11 figure the step did not feed, were re-run and
  are unchanged.

## Open questions

None.
