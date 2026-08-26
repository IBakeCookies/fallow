# What the advisor actually costs

**Kind:** repair · **Status:** landed 2026-08-17 · **Roadmap:** item 31, findings M9 and M10

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes. `suggestPlanAdjustments` was **called** by a probe
and **timed** by none, so every millisecond in §14 and §14.4, and the one
percentage in §14.3, came from sweeps that were thrown away. Two probe arms now
reach all of them through the shipped call site. Five numbers move; the
architectural rule they support does not.

This is the expensive half of item 31's upheld list — the half the previous batch
[deferred](four-descriptions-the-code-moved-past.md) because it needed a new
instrument rather than a correction. With it, thirteen of the fourteen upheld
findings are closed and only M11 remains.

## Scenarios

**No suite scenario, and that is deliberate.** No formula, constant, bound, fit
or runtime value changes — the only `src/` edits are comments — so R6 has no
behaviour to fail a test for. Both arms are probe-backed Claims, written after
the fact by rule: a probe reports a number and there is no red to watch.

- **M9** — `plan-advice.probe.ts` gains one arm timing three things: one
  `calculateDailyMetrics`, one whole `suggestPlanAdjustments`, and §14.3's two
  extra `calculateZenithGain` solves, at n = 3/6/9/12/15 with
  `candidatesEvaluated` printed beside each.
- **M10** — `adv2-switch-cost-price.probe.ts` gains one arm reading
  `advice.switchCostPrice` at budget 0.5 h and s = 15 min over the fixture year's
  58 three-task days and a 4560-case deterministic triple grid.

Acceptance is the five corrections below, each measured rather than argued, and
each re-run by the reviewer rather than taken from the implementer's report —
which is how the 109 ms / 119.67 ms disagreement surfaced.

## Out of scope

- **Any executable change.** No expression in `src/`, no metric, no allocator
  seam. Five comment blocks move because they quoted a false number; that is
  AGENTS.md §0, not a behaviour change.
- **Re-measuring the pre-solve-once figures.** 103.6 ms is the one number in this
  batch that **cannot** be re-run — the change it measures is shipped. The ratio
  and the conclusion are kept, the absolute is dated. Checking out an old
  revision to recover it would be measuring a program nobody runs.
- **M11.** §13.6 cites `scratchpad/rv-energy-readouts.probe.ts`, which exists
  neither in the tree nor in git history. It needs a re-derivation in
  `rv13-terminal-timing.probe.ts` or an unbacked label per §15.1, and it is the
  last upheld finding of item 31.
- **A new probe file.** Both arms went into the probe that already backs their
  section and already had the harness — `plan-advice.probe.ts` was already
  calling `suggestPlanAdjustments`, and `adv2` already regenerates the fixture
  year. A third file would have been a `scripts/PROBES.md` row buying nothing.
- **The `41.8` literal in `plan-advice-descriptor.test.ts`.** It is a fixture
  **input** to a display test whose subject is the suppression, not the number, so
  it stays and its comment now says so. Changing it would have churned an expected
  string to no end.
- **§14.2's own timing.** The budget marginal's one extra solve is named in
  §14.4's arithmetic but was not among the findings; timing it would have grown
  the arm past what was asked.
- **Re-dating §14's or §14.3's other measured sets.** Same rule the previous two
  changes stated: re-measuring a section's whole set is how a correction grows
  without adding evidence.

## Read before building

- `MATH.md` §14 (the Cost paragraph and the solve-once paragraph), §14.3 (the
  +41.8% sentence and the independent-suppression argument), §14.4 (the extra
  pair's Cost paragraph), §34 (the funded-subset size bound), §8.6 (the
  machine-caveat convention a wall clock must carry).
- `src/lib/business/model/metric/plan-advice.ts` — `suggestPlanAdjustments`, and
  `calculateSwitchCostPrice`, which is **module-private**: `advice.switchCostPrice`
  is the only way to §14.3's reading, which is why the existing probe re-derived
  it.
- `src/lib/business/model/zenith.ts` — `EXACT_SUBSET_LIMIT`,
  `SUBSET_SEARCH_BUDGET`, and the `maxFunded` loop whose affordability test
  decides which path a 15-task day takes.
- `scripts/plan-advice.probe.ts` (the existing `task`/`day`/`mulberry32` helpers)
  and `scripts/adv2-switch-cost-price.probe.ts` (`fixtureDays`).
- The three sites quoting 421 ms: `metric/plan-advice.ts`,
  `store/daily-plan-store.svelte.ts`, `src/lib/business/AGENTS.md`.
- `ROADMAP.md`, item 31 and findings M9, M10.

## Decisions

- **The figure is a range, because the measurement is.** Six runs of the same
  12-task advice run on the same idle box spanned **109.00–123.86 ms**. The
  implementer reported 119.67 ms to two decimals; the reviewer's own first run
  read 109.00. Quoting either alone would have replaced a stale number with a
  falsely precise one, so MATH.md carries **109–124 ms** with its machine, its rep
  count and its method — §8.6's convention, applied to §14.
- **The ladder was ~10× high, and the conclusion is untouched.** 95 → ~9.3 ms per
  solve, 946 → 109–124 ms per run. A tenth of a second on every keystroke is
  still a frozen main thread, so **never a `$derived`** holds; what was wrong was
  the number doing the arguing in four places. `candidatesEvaluated` reproduced
  §14's count exactly (14 on a 12-task day), which is the part of the paragraph
  that was never about the machine.
- **421 ms was history presented as current.** It dated from 2026-07-28 and had
  been copied into two docblocks and an area `AGENTS.md` without its date. The
  section keeps it as the halving's "after" and says so; the three code sites now
  quote today's range.
- **Advisor cost is non-monotone in n, and nothing had noticed.** At an 8 h budget
  the §34 affordability test (`33 − m ≥ m`) lets `maxFunded` reach n, so a 15-task
  day needs 32,767 subsets against `SUBSET_SEARCH_BUDGET = 4095` and takes the
  greedy fallback: ~45 ms, a third of the 12-task day's. **n = 12 is the worst
  case, not a floor.** Recorded in §14 and in the area `AGENTS.md`, because "a
  longer backlog is worse" is the natural and wrong reading of the on-demand rule.
- **§14.4's "roughly a third" is the one claim measured false.** The doubled-`s`
  solve runs at 0.7–0.9× the declared one. The direction the section argues holds
  — the pair's share falls with n, `s = 0` is very nearly free at 0.05–0.08 ms —
  so the sentence is corrected rather than the argument.
- **The probe times the shipped expression, not a replica.** §14.3's two extra
  solves are timed by calling the same
  `calculateZenithGain(tasks, budget, candidate, pools, constants, posterior)`
  that `planValueAt` evaluates. Timing a re-derivation would have been the R3
  hazard measuring itself.
- **M10's +41.8% is +41.9%, and the day is now named.** The witness is
  `mentalDifficulty/physicalDifficulty/enjoyment` 5/0/2, 4/1/8, 9/0/7 at pools
  4/6, Σ P̄ 1.1477 → 1.6286. 41.8 is reached by **none** of the 4618 cases swept —
  a 0.1 pp miss on this rounding lattice, so the phenomenon is confirmed and only
  the digit was wrong.
- **§14.3's day is the generic day, and that strengthens it.** The
  suppressed-reservation-with-bracket state holds on 58 of 58 fixture 3-task days
  and 4560 of 4560 grid triples: at a 0.5 h budget with s = 0.25 h,
  `budgetBlocksFor(2)` is one block, so no plan can fund two tasks. The section
  read as though it were describing a corner. It was describing the whole
  configuration, which is a better reason to suppress the two sentences
  independently than the one it gave.
- **The frontier denominator drifted, and no finding named it.** §14's "0 positive
  deltas over **4450** non-empty priced frontiers" now counts **4112** on the same
  seeded 600 — verified against the committed probe before this change, so it is
  pre-existing. The claim it carries is intact; only the denominator is dated.
  Same rule as the previous batch's §21.1 correction (AGENTS.md §0).
- **Every pre-existing figure in both probes was re-run and is unchanged** — the
  trim arm's 404 levers and −0.9%, the 0 positive deltas, and all sixteen `adv2`
  lines including −6.53% at 2026-05-14, the 284-of-596 flooring count and the
  195-violations-on-115-days bracket.

## Open questions

None.
