# Prefix-aware mid-day re-plan

**Kind:** feature · **Status:** landed 2026-08-10 · **Roadmap:** item 12

Backfilled 2026-08-14 from ROADMAP item 12, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`calculateRemainingDay` (`metric/remaining-day.ts`) re-plans the OPEN tasks over
the hours today's 🪫 logs leave, from a prefix, so a day that has already been
partly worked gets a plan for what is left of it instead of only the plan the
morning produced (MATH.md §35).

## Scenarios

### Scenario — the re-plan reads in the task row

- **Given** the viewed day is today
- **Given** today's 🪫 logs record hours
- **Then** a second line stacks in the task row
- **Then** the delta leads
- **Then** the plan sits under it

### Scenario — nothing logged leaves the day alone

- **Given** the viewed day is today
- **Given** no hours exist
- **Then** the store-level `$derived` on `DailyPlanStore` does not re-plan

### Claim (pin) — logging hours moves no plan-scoped metric

The kill criterion, pinned as a store spec.

- **Given** hours logged on today
- **Then** no plan-scoped metric moves

### Claim (pin) — an empty prefix is the cold solve

- **Given** `hᵢ = 0`
- **Then** the solve is bit-identical to the cold solve
- **Then** §4, §5.1 and §34 are undisturbed
- **Then** no existing plan moved

### Claim — the re-plan beats a feasibility-matched baseline

`scripts/prefix-replan.probe.ts` → MATH.md §35

- **Given** seed `0x9e12ab`, 400 days
- **Then** median **+1.76%** of day `Σ P̄` against the cold re-solve the budget
  slider gives
- **Then** mean 3.74%
- **Then** p90 9.57%
- **Then** never negative
- **Then** median **+1.21%** against the morning plan's remainder
- **Then** the funded set differs from cold on **44.75%** of days
- **Then** the re-plan needs **0** feasibility trims
- **Then** the cold solve needs 270
- **Then** the morning remainder needs 359

### Claim — the switch bill is charged over the day's funded set

- **Given** the on-plan control (days executed exactly to plan)
- **Then** median **0.00%**
- **Then** mean 0.01%
- **Then** the funded set differs on 6 of 400 days

## Out of scope

- **No new store.** The shape is a store-level `$derived` on `DailyPlanStore`.
- **No new input beyond 11.**
- **No `DB_VERSION` bump.**
- **No re-plan outside today, and none with no hours logged.** The `$derived` is
  gated on the viewed day being today AND on any hours existing.
- **No on-demand method.** Cost measured at **12.4 ms**/solve at `n = 12` and
  **0.001 ms** when nothing is logged, which is what makes the gate rather than
  an on-demand method viable.
- **Charging a re-entry: rejected.** It double-charges a task that simply
  continued.
- **Free re-entry: rejected.** It _refunds_ the switches of a started task the
  remainder abandons, letting it buy blocks with a bill the day still owes.
- **Known limit — the value is well below what this item hypothesised, and the
  gap is methodological.** The +5.8–7.8% and 81% this item quoted reproduce only
  if the baselines are left **infeasible**: `Σ P̄` prices neither pools nor
  switches, so an arm ignoring them outscores one respecting them for free (§19,
  one level down).

## Where it landed

- `metric/remaining-day.ts` — `calculateRemainingDay`, which re-plans the OPEN
  tasks over the hours today's 🪫 logs leave, from a prefix.
- `buildBlockIncrements` — continues at
  `Δᵢ(j) = P̄ᵢ(hᵢ+jδ) − P̄ᵢ(hᵢ+(j−1)δ)`.
- `AllocTask.isStarted` — the day's funded set, `{worked} ∪ {newly funded}`,
  that the switch bill is charged over.
- `scripts/prefix-replan.probe.ts` — the feasibility-matched comparison, seed
  `0x9e12ab`, 400 days.
- MATH.md §35 — the prefix re-plan.
- MATH.md §4, §5.1, §34 — undisturbed, because `hᵢ = 0` is bit-identical to the
  cold solve.
- MATH.md §19 — `Σ P̄` prices neither pools nor switches, one level down.
- MATH.md §17 — the ϕ anchor the measured value is compared against.

## Decisions

- **Solve from a prefix, not from zero** — `buildBlockIncrements` continues at
  `Δᵢ(j) = P̄ᵢ(hᵢ+jδ) − P̄ᵢ(hᵢ+(j−1)δ)`, and pools enter depleted at `Σ wᵢhᵢ`
  clamped at 0.
- **The shape is the one this item specified** — a store-level `$derived` on
  `DailyPlanStore`, gated on the viewed day being today AND on any hours
  existing. Rejected: an on-demand method, because 12.4 ms/solve at `n = 12` and
  0.001 ms when nothing is logged is what makes the gate viable.
- **The kill criterion is pinned as a store spec** — logging hours moves no
  plan-scoped metric. It caught the switch-convention defect, one input wider
  than the plan-family test it was written for.
- **`hᵢ = 0` is bit-identical to the cold solve** — so §4, §5.1 and §34 are
  undisturbed and no existing plan moved.
- **The switch convention was the real finding, and BOTH options named in this
  item were wrong.** Charging a re-entry double-charges a task that simply
  continued. Free re-entry _refunds_ the switches of a started task the
  remainder abandons, letting it buy blocks with a bill the day still owes: on
  days executed exactly to plan that manufactured a median **+6.67%** over
  finishing the morning plan, against this item's own expected ≈0.
- **The rule that survives is neither: the bill is charged over the day's funded
  set, `{worked} ∪ {newly funded}` (`AllocTask.isStarted`).** Under it the
  on-plan control reads median **0.00%**, mean 0.01%, funded set differing on 6
  of 400 days.
- **The seam itself stays free, and that IS measured** — charged re-entry median
  0.00% / mean −0.45% against free's +0.34% / +4.23%.
- **The value is well below what this item hypothesised, and the gap is
  methodological.** Against a feasibility-matched baseline
  (`scripts/prefix-replan.probe.ts`, seed `0x9e12ab`, 400 days): median
  **+1.76%** of day `Σ P̄` vs the cold re-solve the budget slider gives, mean
  3.74%, p90 9.57%, never negative; median **+1.21%** vs the morning plan's
  remainder; funded set differs from cold on **44.75%** of days. Rejected: the
  +5.8–7.8% and 81% quoted in this item, which reproduce only if the baselines
  are left **infeasible** — `Σ P̄` prices neither pools nor switches, so an arm
  ignoring them outscores one respecting them for free (§19, one level down).
- **The strongest number is not a percentage** — over those 400 days the
  re-plan needed **0** feasibility trims against the cold solve's 270 and the
  morning remainder's 359. The alternatives mostly propose spending capacity the
  morning already burned. The measured value is still ~24× §17's ϕ anchor and
  the same order as item 15's enjoyment default.
- **It renders as a second line stacked in the task row** — the delta leads, the
  plan sits under it (MATH.md §35).

## Open questions

None — landed.
