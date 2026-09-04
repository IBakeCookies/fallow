# The subsets that could not win

**Kind:** model · **Status:** landed 2026-09-04 · **Roadmap:** none — found by the
2026-09-04 sweep for what to build next, priced as its perf lens's one code win

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`bestPlanWithSwitchCost` spends the same work on every one of its ≤ 4095 funded
subsets — a pooled greedy, a ratio-ranked second candidate and two
`improveWithTransfers` passes — including on the large majority that cannot
beat the plan already held. Price each subset first with the pool-free greedy,
which is exact on the single budget constraint, and skip the pooled work
wherever that exact optimum already falls below the incumbent.

Nothing user-visible changes: the returned plan is identical, which is the
whole claim.

## Why the bound is admissible

Two facts already stated in `zenith.ts` above the allocator, and neither is new
here:

1. Each task's increments are positive and **non-increasing** —
   `buildBlockIncrements` truncates the menu at the first non-decreasing
   increment, so the premise holds by construction rather than by sweep.
2. With diminishing increments and a single shared block budget, greedy is
   exactly optimal (Fox 1966; Ibaraki & Katoh 1988).

So pool-free greedy returns the **maximum** value any allocation of this
subset can reach on `budgetBlocks`. Every pooled plan `allocate` can return
spends the same budget — `greedyAllocateBlocks` stops at `budgetBlocks` and
`feasible` re-checks it, so both transfer moves stay inside it — and pools only
remove options. The pool-free value therefore bounds the pooled value from
above, and a subset bounded below the incumbent cannot win.

The band is `bestValue - 1e-9` and not `bestValue`. `consider` promotes a plan
that merely ties on value when it funds more tasks, so a subset whose bound
only ties must still be allocated; skipping on a bare `<` would silently drop
the tie rule.

## Claims

### Claim — the plan does not move, against the exhaustive reference

`scripts/allocator-exactness.probe.ts`

- **Given** arm A's 6400 cases (4 budget families × 4 constant sets × 400),
  `switchCost ∈ {0, 0.1, 0.2, 0.25, 0.33, 0.5, 1}`
- **Then** non-exact stays **0/6400**, worst gap 0.0000%, and arm B's
  σ/ϕ̂ ≈ 0.5 cell stays at its pre-existing 21/4000, mean forfeit 0.0074%,
  worst 5.2607% @ n=2 — the same case, unchanged by this commit

### Claim — the pooled path reproduces its frozen record digit for digit

`scripts/pool-allocator.probe.ts`

- **Given** the app-reachable arm, 5 seeds × 2000 days
- **Then** the per-seed worsts are `[4.56%, 3.37%, 4.81%, 3.83%, 5.28%]` with a
  1.91% spread — identical to the 2026-08-27 record frozen in
  [the-references-the-checker-could-not-see](the-references-the-checker-could-not-see.md)

### Claim — the advice run gets cheaper on the thread the rules file calls frozen

`scripts/plan-advice.probe.ts`

- **Given** the `[cost]` arm on an AMD Ryzen 7 7800X3D, 4 cores, node v22.14.0,
  nothing else running
- **Then** the whole advice run reads **64.93 ms at n = 12** against 104.67 ms
  without the bound, and **7.20 ms at n = 9** against 23.86 ms; one solve reads
  6.32 ms against 8.22 ms at n = 12
- **And** a wall clock is only quotable with its box attached, so these carry
  theirs — and they are one seeded day at one budget, which is the standing
  limitation of that arm and not a claim this commit makes about the population

## Out of scope

- **The `n > EXACT_SUBSET_LIMIT` branch.** The same bound would apply to
  `enumerateFrom`'s incremental enumeration, and the argument transfers
  unchanged. It is not measured here, the regime needs ≥ 13 tasks in one day,
  and adding an unmeasured second site is how a figure without an instrument
  gets into the file. One site, one measurement.
- **A prune-rate counter.** Reporting what fraction of subsets skipped would
  need mutable instrumentation state threaded out of the allocator for a number
  no caller consumes. The wall clock is the reading that matters and it already
  has an arm.
- **Re-quoting the other cost figures.** `#remainingDay`'s 12.4 ms and
  `EnergyLabStore.computeDraftImpact`'s 35–195 ms sit in the same
  `business/AGENTS.md` table and were not re-run, so they were not touched.
  Only the row this commit measured moved.
- **The single-draw wall clock itself.** That `plan-advice.probe.ts` times one
  generated day per n at a hardcoded 8 h budget, and that six live sites quote
  it as a worst case, is a real defect — and a different one, raised by the same
  sweep and left open on purpose so this commit's numbers are not entangled
  with re-basing six figures.
- **Any change to what is returned.** No formula, constant, bound or fit moves.
  MATH.md §4 gains the bound's derivation because the section's cost clause
  became false, not because the objective changed.

## Read before building

- `src/lib/business/model/zenith.ts` — the two-fact block above `AllocTask`
  (greedy exactness), `buildBlockIncrements`'s truncation, `greedyAllocateBlocks`'s
  `budgetBlocks` loop, `feasible`, and `consider`'s tie rule
- MATH.md §2 (diminishing increments) and §4 (the fixed-charge dimension)
- `src/lib/business/AGENTS.md` — the reading/shape/cost table and the
  frozen-thread paragraph under it
