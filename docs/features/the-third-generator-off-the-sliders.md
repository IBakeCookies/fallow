# The third generator off the sliders

**Kind:** audit · **Status:** landed 2026-08-25 · **Roadmap:** finding M40 (third of five)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M40's third generator — FIXED 2026-08-25. `stop-margin-fit-error.probe.ts`
built its tasks with `difficulty = Math.max(mental, physical)`, skipping the 0.3
spillover the app applies, so no day it generated was one a user could have
declared and no §8.10 figure resting on it was quotable in either direction.**
The fix is the recipe the two earlier generators already took: `drawTask` draws
integer sliders — difficulty in [0, 10], enjoyment in [1, 10], the bounds
`persisted.ts`'s `sanitizeTask` clamps to — and returns `toEnergyTask(task)`.
Eleven lines, no shipped code touched.

Its whole figure set moved, as the two earlier fixes predicted. Both gates still
hold at the new level: the replica validates against the shipped
`fitStoppingValue` at 0 difference on all 90 users, with and without
completions, and both kill criteria fire again — the margin sweep in 4 of 4 arms
and the open-task scope arm.

## What moved in §8.10

- **The whole RMSE level rose**, in all four arms: honest n = 12
  0.1200–0.1202 → **0.1441–0.1442**, contaminated n = 12
  0.1581–0.1657 → **0.2133–0.2205**, honest n = 3
  0.1380–0.1383 → **0.1701–0.1708**, contaminated n = 3
  0.1748–0.1836 → **0.2138–0.2204**. Two things changed at once and this sweep
  cannot separate them: the spillover makes every two-dimensional task strictly
  harder, and a slider-drawn task can carry a 0 on one dimension where the
  hand-built one had a floor of 1. What the run establishes is not a mechanism
  but a level — λ₀ is estimated this much less precisely on the population the
  app can actually produce, and that is the level every figure in the section
  should have been read at.

- **The flatness verdict survives and gets stronger.** Largest movement anywhere
  in [0.1, 0.5] 0.0089 → **0.0072**, 5.4% of the 0.134 bracket half-width the
  probe still prices against and 2.9% of σ₀. The endpoint contrasts are
  −0.0008, +0.0000, −0.0027, −0.0056 and **all four bootstrap CIs now straddle
  zero**; on the off-surface reading the contaminated n = 3 arm did not
  ([−0.0178, −0.0022]) and was the one cell still saying wider censors less and
  fits better. That cell was a property of the population, not of the margin.

- **The one figure that did not move** is the m = ∞ control's sign: censoring
  nothing still wins both contaminated arms (by 0.0073 / **0.0161**, against
  0.0077 / 0.0159) and still ties the honest ones exactly. The section records
  it and does not act on it, unchanged.

- **The contamination bullet's two halves both got stronger.** The
  honest-to-contaminated RMSE gap widens 0.0417 → **0.0748**, and the share of
  interrupted days the censor can even see falls — 28.6% / 26.6% invert →
  **26.6% / 19.6%**, past 0.25 17.3% / 20.5% → **12.8% / 12.4%**. Indifference
  points p50 1.018 / 1.044 tail and mid → **1.066 / 1.079**, against
  0.969 → **1.003** on rational days.

- **The break-reading detector table is now one-signed.** Every row that moves
  at all moves down: rational 2.4% → 0.0%, mood 5.8% → 3.5%, tail
  27.8% → 26.6%, mid 20.6% → 19.6%, grind 82.7% → 82.7%. On the off-surface
  reading the interrupted-mid row moved the other way (25.4% → 26.6%), which is
  why the claim there could only be made as "less than two points in either
  direction".

- **The open-task scope arm keeps its verdict and changes its shape.** Gains in
  3 of 12 either way, but best +0.0131 → **+0.0285** and worst
  −0.0723 → −0.0560, and **all three gains are now the contaminated arm at
  n = 12**, at every completion rate, where before they were split across both
  mixes. The corrected scope helps where the population it reads is contaminated
  and n is large enough for the prior to let go, and nowhere else. Signed error
  +0.0680 → +0.0316 becomes **+0.0751 → +0.0337**; used-day counts
  833/845 and 752/845 become **756/771** and **678/771**.

## What this found that M40 had not recorded

**The entry named three generators and there are five.** The identical
hand-built `drawTask` — the same eleven lines — also sits in
`censored-stopping-fit.probe.ts:87` and `satiety-gaming.probe.ts:173`. The first
is the instrument ROADMAP item 4 was DECIDED AGAINST on, so §8.10's
censored-likelihood record carries this caveat too. Neither is fixed here, for
the reason the first three were each their own change: the figures move, and
moving them is a section re-read, not an edit. M40 stays open and now says a
grep is its close condition.

## What was deliberately not done

- **`BRACKET_HALF_WIDTH = 0.134` in the probe is stale and stays.** It is
  `stop-inversion-margin`'s 2026-08-06 median; that probe has since read 0.129
  and then 0.125. MATH.md already says the sweep "still prices against" it.
  Changing it moves the kill threshold and both verdict lines, which is a
  different question from what surface the days are drawn on.

- **No reachability counter was added.** `stop-inversion-margin` prints one
  because its rows are built by hand and could be off-surface; here every row
  comes out of `observationFrom` at exact lattice multiples on a wall clock, and
  every task out of `toEnergyTask`, so a counter would assert its own
  construction. AGENTS.md §0: complexity needs a reachable failure.

## Where it landed

- [`scripts/stop-margin-fit-error.probe.ts`](../../scripts/stop-margin-fit-error.probe.ts)
  — `drawTask`, and the header docblock's 2026-08-25 entry.
- [MATH.md](../../MATH.md) §8.10 — the open-task scope bullet, the margin sweep,
  the contamination bullet and the break-reading detector table.
- [`src/lib/business/model/zenith-energy.ts`](../../src/lib/business/model/zenith-energy.ts)
  — `STOP_INVERSION_MARGIN`'s docblock, which quoted four of the moved figures.
- [`src/lib/business/model/zenith-energy.test.ts`](../../src/lib/business/model/zenith-energy.test.ts)
  — one comment that said the probe "still draws its days off-surface".
