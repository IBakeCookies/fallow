# The refusal redrawn on the sliders

**Status:** landed 2026-08-25 · **Roadmap:** finding M40 (fourth of five)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M40's fourth generator — FIXED 2026-08-25. `censored-stopping-fit.probe.ts`
built its tasks with `difficulty = Math.max(mental, physical)`, skipping the 0.3
spillover the app applies, so no day it generated was one a user could have
declared.** The fix is the recipe the three earlier generators took: `drawTask`
draws integer sliders — difficulty in [0, 10], enjoyment in [1, 10] — and returns
`toEnergyTask(task)`. Eleven lines, no shipped code touched.

What separates this one from the other four is that **a decision rested on it.**
This is the instrument ROADMAP item 4 was DECIDED AGAINST on: §8.10's censored
likelihood was built, measured and refused on the population this probe
generates. A refusal read off days the app cannot produce is not a refusal, in
either direction — so the run had to be redone before the verdict could be
quoted again, and the honest possibility was that it would flip.

**It did not, and it moved away from the gate rather than toward it.** The mixed
cell the kill criterion is set on gains 0.0492 → **0.0403** λ₀ RMSE, 44.8% →
**36.7%** of the 0.110 spec gate. Both gates still hold: the replica validates
against the shipped `fitStoppingValue` at 0 difference on both arms — the dropped
arm over every mixed history, the censored arm over all 713 two-sided days — and
the kill criterion fired again.

## What moved in §8.10

- **Every cell moved and the sign pattern changed once.** Dropped → censored
  RMSE, gain in brackets, off-surface → on-surface:

  | cell                     | off-surface (2026-08-21)  | on-surface (2026-08-25)   |
  | ------------------------ | ------------------------- | ------------------------- |
  | honest, n = 3            | 0.1556 → 0.1386 (+0.0170) | 0.1672 → 0.1508 (+0.0165) |
  | honest, n = 12           | 0.1249 → 0.0678 (+0.0571) | 0.1704 → 0.0878 (+0.0826) |
  | mixed, n = 3             | 0.2350 → 0.2055 (+0.0295) | 0.2654 → 0.2402 (+0.0252) |
  | **mixed, n = 12** (gate) | 0.1950 → 0.1458 (+0.0492) | 0.2105 → 0.1701 (+0.0403) |
  | completed-only, n = 3    | 0.2450 → 0.2511 (−0.0061) | 0.2414 → 0.2464 (−0.0050) |
  | completed-only, n = 12   | 0.0962 → 0.1250 (−0.0288) | 0.1040 → 0.1302 (−0.0262) |
  | all-censored, n = 3      | 0.4160 → 0.3621 (+0.0540) | 0.4166 → 0.3586 (+0.0580) |
  | all-censored, n = 12     | 0.3693 → 0.3338 (+0.0356) | 0.3621 → 0.3743 (−0.0122) |

- **The one sign flip is the all-censored cell at n = 12**, +0.0356 → −0.0122.
  §8.10 already refused to read that cell as a like-for-like contrast — the
  shipped arm has no fit there, returning the prior for every user — but its sign
  was the last reading anywhere that pointed toward the feature, and on days the
  app can hold it does not point there. Nothing in the section acted on it either
  way.

- **The honest n = 12 cell is now the closest any cell has come to the gate**,
  +0.0571 → +0.0826 against 0.110. It is not the cell the gate is set on, and the
  record says so where it reports it: a re-opening has to be argued on the mixed
  cell, which moved the other way. Recorded because it is close enough that a
  later reader would want it stated rather than left to be discovered.

- **The category bounds are unchanged in kind, which is the finding that
  survives.** A sliver day's `λ₀ ≥ lo` is still violated 100% of the time
  (1080 days, was 1075). An all-completed day's `λ₀ ≤ hi` is still almost never
  violated — 0.3% of 900 days, was 0.2% of 931 — and still sits far above the
  truth, so the term is still loose rather than informative, which was item 4's
  entire case. The window-edge category is still rarer than its name: 373
  one-sided days in 1080, was 286 in 1075.

- **The calendar the censored fit buys is the same size.** Used-day share on the
  gate cell 53.0% → 79.1% becomes **52.7% → 80.9%**; users fitted at n = 3
  91.1% → 100% becomes 90.0% → 100%. The feature still uses far more of the
  calendar and still is not worth the 0.110.

## What this leaves for M40

**One generator left**: the same hand-built `drawTask` in
`satiety-gaming.probe.ts` (§8.4). `grep 'difficulty: Math.max' scripts/` is the
close condition M40 carries, and it is not yet empty. That one is its own change,
for the reason all four before it were: the figures move, and moving them is a
section re-read, not an edit.

The wider class was checked and is narrower than M40's phrasing suggests. Every
probe that builds a task literal by hand was scanned against the Eᵤ values
integer sliders can actually reach; two literals are off-surface and **both are
deliberate**. `session-row-truncation.probe.ts`'s witness is declared
model-level-not-app-reachable at MATH.md §18 and paired there with the reachable
variant. `enb-simpson-error.probe.ts`'s `FAST_TASK` is the ϕ-floor worst case for
the quadrature node budget, where an unreachable extreme makes the error bound
conservative rather than wrong — but its docblock does not say so, which is the
gap `energy-search-gap.probe.ts:112` had before M44 made it declare itself.

## What was deliberately not done

- **`CURRENT_HALF_WIDTH = 0.129` in the probe is one reading stale and stays.**
  §8.10 has read 0.125 since 2026-08-21, past the clock censor. It is a second
  gate printed for context; `SPEC_GATE = 0.110` is what fires the kill criterion,
  both are stricter than it, and the record quotes the spec-gate percentages.
  Moving a printed threshold is a different question from what surface the days
  are drawn on — the same call the third generator made about
  `BRACKET_HALF_WIDTH`. The docblock now says which reading it is instead of
  calling 0.129 current.

- **`docs/features/censored-stopping-fit.md` was not edited.** It is frozen at
  land and carries the 2026-08-21 figures the decision was made on. This file is
  the re-read.

- **No reachability counter was added.** Every task now comes out of
  `toEnergyTask` and every row out of `observationFrom` at exact lattice
  multiples, so a counter would assert its own construction. AGENTS.md §0:
  complexity needs a reachable failure.

## Where it landed

- [`scripts/censored-stopping-fit.probe.ts`](../../scripts/censored-stopping-fit.probe.ts)
  — `drawTask`, and the header docblock's 2026-08-25 entry and gate note.
- [MATH.md](../../MATH.md) §8.10 — the four bullets of the censored-likelihood
  record; §10 — the dated entry.
- [ROADMAP.md](../../ROADMAP.md) — item 4's figures, and M40's remaining set.
- [`src/lib/business/model/AGENTS.md`](../../src/lib/business/model/AGENTS.md)
  — the settled-decision line, which quoted the gain and its share of the gate.
