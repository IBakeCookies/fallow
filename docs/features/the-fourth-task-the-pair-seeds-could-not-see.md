# The fourth task the pair seeds could not see

**Kind:** model · **Status:** landed 2026-08-27 · **Roadmap:** finding M54

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M54 was the residue of M47. Pricing §8.6's pair-seed cap turned up a result the
deleted prose had never measured: over 400 seeded days, unbounded `C(n,2)` beats
`PAIR_SEED_TASKS = 3` on two of them, worst 0.208672 objective — and a cap of
**four** reaches both. So: does the constant move?

M47 filed it as a decision rather than a sweep, and named the reason. Raising
the cap changes every plan the app proposes, on a path `EnergyLabStore`'s
`#plan` `$derived`, `plan-audit.ts` and `suggestBudgetCurve`'s per-budget solves
all take. Weigh 0.208672 on 2 days in 400 against that.

## What the framing got wrong

That weighing is between an objective margin and a latency cost, and it is the
wrong weighing. **Six of the seven gain days do not redistribute hours — they
change which tasks the user is told to do.**

`energy-search-gap.probe.ts` now prints both funded sets for every day the wider
cap wins:

```
[seed 8600] day 215: 4 tasks x 6.5h, funds {2} -> {2,4}
[seed 8601] day 13:  7 tasks x 7.25h, funds {1} -> {1,2}
[seed 8601] day 126: 7 tasks x 7.75h, funds {1,2} -> {2,4}
[seed 8602] day 102: 7 tasks x 7.5h, funds {4} -> {3,4}
[seed 8602] day 232: 6 tasks x 6.75h, funds {2,5} -> {4,5}
[seed 8604] day 276: 6 tasks x 11h, funds {1,2,5} -> {1,5}
[seed 8600] day 220: 7 tasks x 6h, funds {2,6} -> {2,6}     <- the only hours-only day
```

A task funded nowhere at a cap of three, a different task entirely, or one
dropped. §8.6 calls the wrong funded set the worse of its two failure modes, and
it is the exact defect the pair family was added to fix — the family was never
bought for margin. The largest objective gain (2.1865%, seed 8600 day 220) is
the one day that is margin; the structural days are cheaper and more common.

Several cap-3 answers on that list are degenerate — `t2 6h`, `t1 6.75h`,
`t4 4.5h + rest 0.75h + t4 2.25h` — single-task days where the cap-4 search finds
a two-task interleave. Not a nudge.

## What was measured

Four arms on `scripts/energy-search-gap.probe.ts`, one box
(AMD Ryzen 7 7800X3D, node v22.14.0), stated because a wall clock without its
machine is not quotable.

**The gain, across five seeds — 2000 days, not one draw.** M53's finding was
that a worst case from a single generator draw is the maximum of that draw and
nothing more, so the cap-3-against-cap-4 comparison runs on five:

| seed | cap 4 wins | worst gain | different plan, unchanged objective |
| ---- | ---------- | ---------- | ----------------------------------- |
| 8600 | 2 / 400    | 2.1865%    | 0                                   |
| 8601 | 2 / 400    | 0.2080%    | 0                                   |
| 8602 | 2 / 400    | 1.5365%    | 0                                   |
| 8603 | 0 / 400    | —          | 0                                   |
| 8604 | 1 / 400    | 0.9608%    | 0                                   |

The rate is stable and small: **7 in 2000, 0.35%**. The magnitude is not — the
per-seed worst runs an order of magnitude apart, so no envelope is claimed for
it, and 2.1865% is quoted as one draw's maximum rather than as a bound.

**Nobody pays for nothing.** The third column is the risk a wider cap carries
beyond its cost: the search keeps the best over seeds and accepts only strict
improvements, so a superset of seeds can return a _different_ plan at the _same_
objective — pair (0,3) now falls between (0,2) and (1,2) in the seed order.
Across all 2000 days that happened **zero** times. Every plan the wider cap
moves, it improves.

**The cost.** Flat in n, because a cap of four adds three seeds at any task
count, where `C(n,2)` is quadratic:

| n   | cap 3 → cap 4 (ladder) | cap 3 → cap 4 (seeded) | `C(n,2)` (ladder) |
| --- | ---------------------- | ---------------------- | ----------------- |
| 3   | 0.98×                  | 0.98×                  | 0.99×             |
| 4   | 1.39×                  | 1.61×                  | 1.39×             |
| 8   | 1.43×                  | 1.28×                  | 5.29×             |
| 15  | 1.32×                  | 1.29×                  | 14.42×            |

At three tasks the two caps _are_ the same search, and at four `C(4,2)` _is_ the
cap of four, so those cells are the table's noise floor — every ratio here
carries about ±2%. An earlier run of the same arm read 1.21×–1.54× where this
one reads 1.27×–1.61×: the band is the result, no cell is.

**In milliseconds, on the paths the product takes**, over app-shaped days
(3–8 tasks × 6–10 h) rather than the 12 h ladder above, because a ratio cannot
say whether a change is felt:

- one solve, the Lab's `#plan` on every slider move: median **55.0 → 80.1 ms**,
  p95 142.7 → 185.2, worst 158.6 → 209.3
- `suggestBudgetCurve`'s 12 solves over an 8-task 9.25 h horizon:
  **310.6 → 422.7 ms**
- `auditPlanAdherence` is one solve per logged day under a 30-day cap, so it
  scales as the first row and is not measured separately

## What was decided

**`PAIR_SEED_TASKS = 4`.** 0.35% of days get a structurally different plan; 100%
of interactions pay ~1.4× on a solve that stays under a tenth of a second at the
median. A planner whose output is the product buys the plan.

`C(n,2)` stays rejected and the rules file still says so — 14.42× at 15 tasks,
and a cap of four already reaches every day `C(n,2)` reached in the 400-day
sweep, so the unbounded family has bought nothing measured.

## What was deliberately not done

- **No cap of 5 or more.** Nothing measured says where the next step is, and
  every day found so far is reached by four. Raising it again needs its own
  forfeit arm, not an extrapolation from this one.
- **No adaptive cap** (four at small n, three above). Cost is flat in n, so it
  would buy nothing.
- **The two existing arms keep their literal caps of 0, 3 and n** rather than
  reading the shipped constant. They are a controlled comparison, and M47's
  400-day figures stay reproducible against them.
- **`suggestBudgetCurve` was not given an options parameter.** Its solve cost is
  measured by running the same solves the function runs; threading
  `OptimizeOptions` through it would widen the product surface to save a loop.

## Where it landed

- `src/lib/business/model/zenith-energy.ts` — `PAIR_SEED_TASKS` 3 → 4, and the
  `pairSeedTasks` docblock, which had said the cap was priced only against 0
  and n
- `src/lib/business/model/AGENTS.md` — the "do not unbound it" rule, restated at
  `C(4,2)` and 14.4×
- `MATH.md` §8.6 — the pair-seed fix and the cap paragraph
- `scripts/energy-search-gap.probe.ts` — a cap-4 column on the cost arm, the
  relative gap on the forfeit arm, and two new arms: the five-seed check with
  its funded sets, and the absolute-ms pricing of the product's paths
- `src/lib/business/model/zenith-energy.test.ts` — seed 8600's day 215 pinned at
  both caps, realigned onto the sliders
- `scripts/PROBES.md`, `ROADMAP.md`
