# The cap the sweep never reached

**Kind:** repair · **Status:** landed 2026-08-26 · **Roadmap:** finding M33

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M33 — the §8.12 pseudocode nulled `recommendedHours` at `W`, the horizon; the
code nulls at the top of the step lattice.** They are the same number only when
`W` is a whole number of steps. `suggestBudgetCurve` sweeps
`budget = step; budget <= W; budget += step`, so the last swept budget is the
largest multiple of `DEFAULT_STEP_HOURS` at or below `W` — 12 h at the default
cap, which is 16 steps exactly, and 4.5 h under a 5 h cap.

**The code was right and the doc was wrong**, so nothing shipped moved. Against
the horizon, a day still climbing when the sweep ran out has its knee land on the
last swept budget, `knee < W` holds, and the day is recommended a window the
sweep never established was the best one — the exact reading the null exists to
distinguish from a real interior knee ("the sweep ran out before the model did,
which is a different statement"). Against the lattice, it stays null.

§8.12 now names the lattice in the pseudocode block, defines `valuePerHour`'s
majorant over it rather than over `{0, step, …, W}` — the same off-by-a-lattice
slip one line up — and the cap paragraph says why the two tops part and which one
the knee is compared against.

## The distinction is now pinned, which is why it could drift

Every existing budget-curve test ran at a cap that was a whole number of steps
(6 h and 9 h are 8 and 12 steps), including the one asserting the null at the top
of the range, so the whole suite passed identically under either rule and the
prose was free to drift off the code. That test now runs at a **5 h** cap, and
asserts the lattice tops out at 4.5 h beside the null — under the horizon rule it
returns 4.5 and fails, which is how it was watched to fail (R6).

The case is reachable only through the exported `maxBudgetHours` option: the
app's one caller, `EnergyLabStore.computeBudgetCurve`, takes the default cap.

## What was deliberately not done

- **No production change.** The guard is the natural formulation already
  (`knee < last.budgetHours - 1e-9`, against the last point of `points`), and its
  own comment stated the distinction correctly all along. There was nothing to
  delete and nothing to add.

- **ROADMAP's dead `MATH.md §` citations were left alone.** M33's own
  `MATH.md:2037` address, and the sections above §9 that several closed entries
  name, both predate the 2026-08-25 cut that took MATH.md from 9,482 lines to its
  math. `scripts/math-citations.mjs` exempts `ROADMAP.md` and `docs/features/` by
  name for that reason: they are dated records, and a section they cite is a fact
  about that day. This entry was re-located by content, as that exemption
  intends.

## Where it landed

- [MATH.md](../../MATH.md) §8.12 — the pseudocode block and the
  `BUDGET_CURVE_MAX_HOURS` paragraph.
- [`src/lib/business/model/zenith-energy.test.ts`](../../src/lib/business/model/zenith-energy.test.ts)
  — "reports no recommendation when the best value is at the top of the range",
  at a cap that is not a whole number of steps.
