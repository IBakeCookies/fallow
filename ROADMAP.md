# Roadmap

Fallow sits at a stable V1: two peer planning modes (the default Zenith
Gradient allocator and the Energy Lab), a full calibration loop (⚡ time-to-flow,
☕ recovery, 🪫 drain, stop-time λ₀), plan advice, the analytics audit, offline
PWA, five locales (en/de/es/fr/zh).

The math behind every item lives in [MATH.md](MATH.md). Settled decisions are
in AGENTS.md §4's decision index — notably the three roads deliberately not
taken:
the energy model stays a peer mode, never a replacement (MATH.md §15), run
order stays the nature-alternation heuristic (§16), and ϕ stays one plane for
all tasks (§17). Do not re-open those here.

Phases are priority order. Item numbers are stable and cited from elsewhere
(MATH.md §14.2 cites item 3), so they are never reused; phase numbers are not
cited and were re-cut on 2026-08-04 when items 11–23 were added. Update this
file when an item ships or is rejected.

**A shipped item collapses to its date and a link.** What was decided, what was
rejected and what the review caught go to `docs/features/<slug>.md`, frozen at
land; this file stays the list of what is next and what was refused. An item
here never describes how the code works today — that is MATH.md and the area
`AGENTS.md`, and a claim about current behaviour written here is the one that
rots (2026-08-13 sweep: 14 of 161).

**Prettier renumbers a contiguous ordered list to increment from its first
number**, so an out-of-sequence item dropped into the middle of a phase is
silently rewritten — which, since numbers are cited, collides with a real item
elsewhere. A new item therefore starts its own list: put it after a blank line
and a sentence of prose, the way items 11 and 24 sit apart from 1–3 and 15–18.
After editing this file, re-run `npx prettier --write ROADMAP.md` and check the
numbers.

## Where the headroom actually is (2026-08-04)

Three readings shaped the phases below, and each is checkable in the code
today:

- **The objective prices hour _quality_, never importance or completion.**
  `priorityScore = P̄(T*)·10` is _derived_ from difficulty × enjoyment
  (`metric/calculation.ts:229`), so a task that matters and a task that is
  pleasant are indistinguishable to the allocator. There is no importance
  input, no deadline, no task size. Item 23 is the only item that changes this,
  and it is deliberately last.
- **Every calibration instrument lives behind `/energy`.** `logDrain` has
  exactly one caller (`energy/+page.svelte:161`), and `readFinishedDays` skips
  any date without a 🪫 log with `hours > 0`
  (`session-history.ts:226`, `:243`). A user who only ever opens `/` therefore
  contributes **zero** days to λ₀ (§8.10), the §12 audit and overnight
  carry-over (§11.9). Item 11 is the cheapest item here for that reason.
  **Closed 2026-08-10 by item 11:** `logDrain` has a second caller on the main
  page (`+page.svelte:101`), and every row on both screens now reads, corrects
  and drops its own ⚡ and 🪫 measurements. The `readFinishedDays` half is
  unchanged and still true — a day still qualifies only through a 🪫 log — so
  what the reading measured is now reachable without `/energy`, not gone.
- **The one constant the app fits is the cheapest one in the model.** §17
  measured the whole true-ϕ oracle at +0.16% of plan value. Nothing fits
  `switchCost` (`zenith.ts:92` is a bare literal with a CHI-2008 citation), the
  capacity pools, or the difficulty sliders — and probes put each of those an
  order of magnitude above ϕ. Phase 2 exists to close that inversion.

**Read every percentage in items 11–23 as a hypothesis, not a result.** They
come from throwaway ideation probes run on 2026-08-04 against synthetic days;
none is in MATH.md, none was re-run against real logs, and several are
explicitly circular where noted. Each item states the probe that would
establish or kill its own number. Run it before building, per §17's precedent.
The exception is the α-bias table in item 18, which is a **parameter-recovery**
measurement through the real fit and does not depend on assuming a user.

`scripts/generate-fixture.mjs` writes an importable year of history simulated
from known true (c₁,c₂,c₃), (α_cog,α_phys), r and λ₀. It exists for **recovery
testing** — does a fit find the truth it was given — and for exercising the
year-scale screens (analytics, the §12 audit, the calibration snapshot) that no
real profile has data for yet. It can never gate an item whose question is
"what does the user habitually do": a generator only replays its own
assumptions, which is the circularity §17 turns on real logs to avoid.

## Phase 1 — in-day companion

The model is strong at 8am and silent at 2pm; these close that gap.

1. ~~**Live stop advisor**~~ — SHIPPED 2026-08-03 (MATH.md §8.11): `adviseStop`
   prices the best next _session_ (max over open tasks × durations of average
   value/hour) from today's 🪫 logs against λ₀; card on `/energy`. Probed
   first, as planned: session-lookahead cut the one-step verdict's mid-day
   false stops from 19.7–24.7% to 6.2–6.6% at high λ₀, at-stop agreement within
   one 45-min step throughout.
2. ~~**Interactive budget slider**~~ — SHIPPED 2026-08-03: a range input beside
   the Available Hours field in the day-constraints bar, sharing its bounds and
   its value. No new plumbing was needed — the whole plan is already one
   `$derived`, so a drag re-solves the day at the ~1–13 ms/solve of realistic
   task counts. Plan advice deliberately does **not** follow the drag: it stays
   on-demand behind `isAdviceStale` (MATH.md §14), because at 12 tasks the
   advice run is `activeTasks + 3` solves.
3. ~~**Marginal-of-budget diagnostic**~~ — SHIPPED 2026-08-03 (MATH.md §14.2):
   one extra solve at `budget + BLOCK_HOURS` prices the next 15 minutes and
   names the task that would get them; a line in the advice card. Open-scoped
   (§11.8) — review caught the plan-scoped reading naming an already-completed
   task as the recipient, worth up to +33.4%. Still a
   budget diagnostic rather than a per-task column, but **the reason planned
   here was wrong** — the probe found per-task marginals do _not_ equalize at
   the optimum (relative spread median **0.573**, p90 **0.977**, re-measured
   2026-08-06, MATH.md §14.2). What survives: the
   column prices no lever the user owns, and it ignores the pools and switch
   cost, overstating the budget's yield on **63%** of days. The finding that
   justified shipping it: on **54%** of days another block buys nothing, and on
   all but one of those the card was still offering "work an extra hour".

Items 1–3 shipped and did not finish the thesis: the plan could not see the
hours already spent. Item 11 shipped the instrument that records them from
anywhere in the app and 12 made a reading consume them, so the thesis is closed
and 13 and 14 were display work on top of it — 13 names position 1 of the
re-planned order, 14 turns the same pool depletion §35 already computes into a
row. Neither needed a new solve.

11. ~~**Worked-hours instrument on `/`**~~ — SHIPPED 2026-08-09 (MATH.md §18).
    [docs/features/worked-hours-instrument.md](docs/features/worked-hours-instrument.md)
12. ~~**Prefix-aware mid-day re-plan**~~ — SHIPPED 2026-08-10 (MATH.md §35).
    [docs/features/prefix-aware-mid-day-replan.md](docs/features/prefix-aware-mid-day-replan.md)
13. ~~**"You are here" on the run order**~~ — SHIPPED 2026-08-10 (MATH.md §35).
    `RemainingDay.nextTask` is position 1 of `calculateInterleavedOrder` over the
    funded remainder; `next-up-line.svelte` renders it on the list card's header
    row on `/`. It labels, it does not recompute — `argmax Δᵢ(1)` is a different
    task, because the allocator buys a funded _subset_ under a switch bill and
    two pools, and two definitions of "next" is the R3 failure this item named.
    No new solve, no store change: 12's `$derived` already had the allocations.
    **The set it sequences is `hoursByTask`, not the candidate set** — the
    accounting share of a task ticked done without a log is solved and never
    reported (§35), so naming it would send the user back to work they just
    finished. It never says "stop for the day", as specified.
    **One caveat is written down rather than fixed** (§35): the alternation has
    no memory of what was just worked, so the line can open with cognitive work a
    moment after three hours of it were logged. The morning `#N` badges have the
    same blind spot — hidden there because the sequence is read whole and the
    previous task is the row above. The instrument to fix it exists (a 🪫 log
    carries a task id), but conditioning position 1 on the last session is a
    change to §16's heuristic and needs §16's probe re-run, not a patch.
    The one code change outside the reading: `calculateInterleavedOrder` is now
    generic over what it actually reads — two difficulties, hours, a rank — so
    the remainder can be sequenced without mirroring `SuggestedTask`'s priority
    formula. Its five existing callers are untouched.
14. ~~**Executed capacity burn-down**~~ — SHIPPED 2026-08-12 (MATH.md §35).
    [docs/features/executed-capacity-burn-down.md](docs/features/executed-capacity-burn-down.md)

Found by the 2026-08-06 review of the advice card, and small enough to be
nobody's feature — which is why it is written down rather than remembered:

25. ~~**The advice card's buttons must not outlive the day they priced**~~ — SHIPPED 2026-08-12.
    [docs/features/advice-buttons-expire-with-their-day.md](docs/features/advice-buttons-expire-with-their-day.md)

_Settled 2026-08-09, not a roadmap item:_ both halves of `importFromDate` /
`importYesterday` are intended and stay. Copying a completed task in as a fresh
incomplete one IS the point of "import yesterday", and importing a title that is
already on today's list is allowed to produce two rows — no dedupe against the
day's tasks, no filter on `completed` (`session-store.svelte.ts:761`, `:792`).
The consequence to keep in mind, since 🪫 logs key on `taskId`: two rows with
the same title are two tasks to every fit, and the hours logged against each
stay separate.

## Phase 2 — declared inputs the app can already infer

The inversion named above, in priority order. Measured framing for the whole
phase (400 synthetic days, 3–7 tasks, budgets {2,4,4,6,8}, real
`calculatePooledAllocations`, scored §17-style — plan under θ̂, score under
θ_true): ϕ off by +0.5 h on **every** task costs **0.074%** (the §17 anchor);
one enjoyment point on **one** task **0.052%**; one task's mental demand off by
4 points **0.582%**; a pool 2× wrong **4.1–5.7%**; `switchCost` 2× too high
**10.1%**; every slider left at 5/5/5 **5.42%**.
**Read the scope of each figure before comparing two of them.** Item 15 excluded
enjoyment by putting the per-point-per-task 0.052% next to the every-task ϕ
anchor and concluding the β channel was "a re-labeling, not a loss". Measured at
the same scope, a whole day planned with enjoyment at its default costs **2.02%
mean / 1.16% median** — 27× the ϕ anchor, and never negative. That retraction
does not resurrect β _inference_ (below), which loses on its own costs, but the
value argument against it was arithmetic, not evidence. **The constraint side is
still where the money is; the difficulty and β sides are the same order as each
other.**

15. ~~**Title memory for the task sliders**~~ — SHIPPED 2026-08-05.
    [docs/features/title-memory-for-task-sliders.md](docs/features/title-memory-for-task-sliders.md)

16. ~~**Budget prefill for unseen days**~~ — SHIPPED 2026-08-12.
    [docs/features/budget-prefill-for-unseen-days.md](docs/features/budget-prefill-for-unseen-days.md)
17. ~~**Switch-cost price diagnostic**~~ — SHIPPED 2026-08-04 (MATH.md §14.3).
    [docs/features/switch-cost-price-diagnostic.md](docs/features/switch-cost-price-diagnostic.md)
18. **Capacity pools from the fitted drain rates** — your cognitive pool is
    what your own 🪫 logs say, not 4 hours. Invert the reservoir law at a
    shared floor: at defaults `C_cog(4 h) = 0.3042` and `C_phys(6 h) = 0.2516`,
    so a floor of 0.28 gives 4.373 h / 5.307 h, and α = 0.7 gives 1.976 h — two
    invented constants collapsing into one floor plus a fitted parameter, a
    real net reduction. **Two hard conditions.** The map has a pole:
    `C_eq = b·r'/(α + b·r') = 0.0525/(α + 0.0525)` reaches a 0.28 floor at
    **α = 0.135**, and the neighbourhood explodes (α = 0.20 → 9.49 h, 0.15 →
    17.7 h, 0.135 → 197.9 h, against 0.35 → 4.37 h), and `ALPHA_FIT_MIN` of
    0.05 sits inside that divergent region, so a clamp and a stated floor
    constant go in MATH.md before any code.
    **α̂ is biased upward, and by how much depends on how often the user logs**
    (measured 2026-08-04 with an **uncommitted** variant of
    `scripts/generate-fixture.mjs`, recovering known ground truth through the
    real `fitEnergyParams` — the committed script hard-codes the 🪫 opt-in and
    cannot emit these cells, so read the direction, not the percentages;
    MATH.md §18): the fit is **exactly
    unbiased at one 🪫 log per day** (α_cog −0%, α_phys −0%) and then drifts
    **+17%/+15% at two logs, +28%/+22% at three, +40%/+31% at five**, purely
    from §8.7's fresh-start assumption — each rating is read as a session from a
    full reservoir, so a later session's deeper rating can only be explained by
    a larger α. `r` is untouched throughout (−0% to −1%), which is §8.9's
    independence claim confirmed. Two consequences for this item: the upward
    bias pushes α _away_ from the pole, so the divergence risk is smaller than
    it looks — but a higher α maps to a **smaller** pool, so the derived
    capacity shrinks the more diligently the user logs, which is an absurd
    dependency for a capacity estimate and must be corrected or bounded before
    the map ships.
    And it must be a **prefill of the per-day session
    field, never a change to `DEFAULT_CAPACITY_POOLS`**: that constant is the
    fallback for every stored day with no pools (`session-history.ts:303`,
    `history.ts:108`), so changing it re-scores history against §12.1's settled
    "a past day's fit is what the user had", and prefilling is also what "a fit
    never writes params silently" requires. **Probe:** the pool has no
    observable, so use the only ground truth there is — does the α-derived pool
    raise §12's `classicOverlap` on real finished days against declared 4/6?
    **Kill if overlap does not move, or if the fitted α lands below ~0.2**,
    where the map is meaningless. A 2× pool error costs 4.1–5.7% mean, p90
    12.9–21.2%, ~50% of days moved — 55–76× the ϕ anchor _if_ the fitted value
    is actually better than 4/6, which is exactly what the probe tests.
    MATH.md section required (the map, the pole, the clamp, and the
    sessions-per-day bias). **Prereq:** enough 🪫 logs for a credible α, i.e.
    item 11 in practice.

Item 15 shipped as one feature with the item below, which is how its ratings
reach the form at all:

24. ~~**Title suggestions as you type**~~ — SHIPPED 2026-08-05.
    [docs/features/title-suggestions-as-you-type.md](docs/features/title-suggestions-as-you-type.md)

## Phase 3 — calibration trust

4. **Censored-likelihood stopping fit** — worked-to-edge, zero-work and
   inverted days currently drop out of the §8.10 fit; a one-sided likelihood
   term would use them. Build once real usage shows enough censored days. **Sized
   2026-08-17** (M12's close, `stop-inversion-margin.probe.ts`): the
   all-checked-off category §8.10 calls "not an edge case" is 7.7% / 40.5% /
   73.1% of all dropped days at completion rates 0.25 / 0.50 / 0.75 and 0% at
   0 — it needs **every** task on the day ticked, so it is ordinary from q ≈ 0.5
   up and rare below. The window edge takes the rest. That share is what this
   item would recover, and the completion rate is an axis, not a frequency: no
   real history exists on this machine to place a user on it (the same block as
   items 15 and 16).
   **Two things M38's fix added to this item (2026-08-19).** First, a surface
   obligation it deliberately did not build: a batch-logged day reads its breaks
   as nothing and degrades to the pre-2026-08-19 numbers, and `usedCount` cannot
   tell a structure-recovered day from a collapsed one — the cheap honest version
   is to count structure-recovered days and show that count on the Stopping
   Calibration card, which is a copy decision in five locales. Second, a
   contamination DETECTOR that does not depend on bracket inversion: the distance
   between a day's observed per-task hours and the plan's. §8.10 values inversion
   as a detector (39% against 3.7%) and M38's fix leaves its hit rate on
   interrupted and grind days intact, so nothing forces this — but a censored
   likelihood wants a cleaner signal than a bracket that has stopped inverting on
   honest days.
5. ~~**Fit-snapshot persistence**~~ — SHIPPED 2026-08-03 (MATH.md §12.1): a
   `fitSnapshots` store keyed by date, holding only what a fit can move (the ϕ
   plane with its posterior, α_cog/α_phys/r, λ₀); the §12 audit scores each day
   under the fit recorded that day, and the "Your model" card draws each fit as a
   sparkline against its default. Only today's record is ever written, so a
   day's fit is immutable once the day passes; a day with no snapshot falls back
   to the live fit. **Probed first, and the gap was bigger than assumed**: on a
   drifting synthetic year, α_cog as of day 10 was 0.3069 against a
   whole-history 0.4973 — the early day had been audited against a drain rate
   62% too high. Recomputing the fit per day instead was rejected on cost, not
   on correctness: it would fix history retroactively (which storing cannot) but
   costs a whole-history fit per audited day — 19 ms/day, 570 ms per 30-day
   audit — so it grows with everything the user ever logs. The accepted cost is
   that the correction only accrues forward.
6. ~~**Per-task ϕ offsets**~~ — REJECTED 2026-08-04 (MATH.md §17,
   `business/model/AGENTS.md`).
   Probed as planned, and the probe answered the gate: offsets move **blocks,
   not value**. The hierarchical fit works — held-out ϕ error −23% to −37% — but
   at a plausible 0.3 h per-task spread it buys **+0.09%** of plan value on a
   4 h budget, 0.4 minutes' worth of the budget slider, and the oracle that
   knows every task's true ϕ is itself worth only +0.16%. The reason is
   structural and outlives this item: `P̄` is flat at `T*`, so **half an hour of
   per-task ϕ error costs ~0.3% of the day** (§17's table prices any future
   per-task-ϕ idea). Against that: 64–79% of logged titles carry one log, so δ
   absorbs stopwatch noise and a no-structure user's displayed ϕ gets 68–98%
   worse; unlogged tasks would carry a permanent σ_ϕ penalty (0.058 → 0.259 h);
   and grouping would key on the free-text title, since `nextTaskId` gives each
   day's instance a new id. Re-open only on real logs with `Σδ̂²` above the
   0.25 h noise floor **and** a habitually ≤2 h budget.

Two readings that would make the calibration loop auditable rather than merely
present:

19. **Prequential ϕ scorecard** — the only reading the app could have that says
    whether the ϕ model has ever predicted anything, scored out-of-sample. Walk
    `flowObservations` in date order; for each log, fit on logs strictly before
    its date via `fitUserConstants` (`zenith.ts:1852`) and record the residual
    against the fitted plane, against `DEFAULT_USER_CONSTANTS`, and against the
    ±1σ band from `phiPredictionStd` (`zenith.ts:1999` — exported, documented
    "intended for UI", and consumed by nothing outside its own test).
    Whole-history flow is already read once in `readModelReport`
    (`session-history.ts:528`), so this adds no read. **Two corrections that
    are easy to get wrong:** each backtest fit must pass `ageDays` relative to
    _that log's_ date, not today (`session-history.ts:124`, `:138` base it on
    today, and §5.2 half-life-weights the ridge), or every historical fit is
    weighted with the future's clock; and the retained residuals should be
    grouped by `taskTitle` to report **between-title variance against
    σ₀² = 0.25 h**, which _is_ `Σδ̂²` — the exact statistic item 6 names as its
    re-open gate — delivered as a by-product. **Probe:** backtest on synthetic
    users at the model's own noise floor plus real logs. **Kill if prequential
    MAE_fitted ≥ MAE_default for n up to ~40** (the fit then has no
    demonstrable skill in the regime users live in, and shipping the number
    advertises that), **or if coverage sits inside 60–75% at every n** (the
    band is already correct and unremarkable — then ship only the between-title
    variance). Two results the copy must not overpromise: coverage will
    over-cover at small n (σ̂² is the ν₀ = 4 blend toward σ₀ = 0.25 h,
    `zenith.ts:1958` — a prior, not a floor: it decays as logs accumulate), and
    skill against the default is
    ≈0 at small n _by construction_, since the ridge is anchored to the
    default — so gate the coverage row at n ≥ 10. Fold in the ~5-line display
    of `phiPredictionStd` as a ± band beside the point ϕ on the task card
    (`task-item.svelte:144-155`), which that function's own docstring
    sanctions. Unpriced by design and outside §17's table — it is not an
    allocation-precision claim. MATH.md: a §5.3 note on the scoring convention.
20. **Unfunded-task attribution** — name the binding reason a task got 0 h.
    **Zero extra solves:** `suggestPlanAdjustments` already computes a full
    `calculateDailyMetrics` per defer candidate, each carrying `activeTasks`
    with `suggestedHours` (`plan-advice.ts` `suggestPlanAdjustments`), so "which single removal
    funds this task" is a lookup over candidates already in hand; pool-bound is
    detectable by comparing the plan's `Σ hours·weight` against the declared
    pool with no solve at all; and the budget branch already ships as
    `budgetMarginal`. `unfundedTaskIds` (`plan-advice.ts:599`, field at `:183`)
    today says
    _that_ and never _why_, and §14.2 concedes that a bound pool, a task near
    `T*`, and a block landing on finished work "look identical from one solve".
    **Strip all prescription** from the pool and switch branches — §14 is
    explicit that advising someone to raise their cognitive pool is advising
    them to lie to the model. **Probe:** attribution mix over ~300 random days;
    **kill if any single cause exceeds ~80%** (the honest product is then one
    static sentence), **or if the defer branch is empty on most days**, leaving
    only non-actionable branches.

Left over from the 2026-08-06 probe round, which backed five `MATH.md` claims
and found three of them wrong: the rest of that list, and the smallest of the
defects it found without fixing.

26. **Round-2 probes for the unbacked `MATH.md` claims** — **DONE 2026-08-06.**
    All four targets built, plus a fifth found while doing them. Each carries a
    dated back-reference in `MATH.md`, a row in `scripts/PROBES.md`, and one
    suite fixture. The expectation that this round would correct more than it
    confirmed held for one of the five.
    (a) **§12.1's fit-snapshot numbers** → `scripts/fit-snapshot-drift.probe.ts`.
    **Confirmed, both halves.** Day-10 fit 0.3447 against a whole-history 0.5240
    (52%, doc says 62%), in-window movement 3.3% against the doc's 3.2%, and a
    flat-α control at −0.1% proving it is the drift. Per-audited-day refit costs
    ≈1.0× a whole-history fit and grows linearly with log volume, so
    O(auditDays × totalLogVolume) — and item 5 stands.
    (b) **§8.4's anti-gaming constraint** → `scripts/satiety-gaming.probe.ts`.
    **Confirmed and, for the first time, priced.** Satiety is reproducible from
    per-task totals alone to 8.9·10⁻¹⁵ over 300 schedules, 297 of which split a
    task across a gap. A session-keyed accumulator puts **98.4%** of worked hours
    on one task against the shipped 82.3% — the re-run-the-winner corner,
    reproduced — at a cost of 0.226% (0.599% for the phase-decaying form).
    (c) **§8.10's `STOP_INVERSION_MARGIN = 0.25`** →
    `scripts/stop-inversion-margin.probe.ts`. **Both defences were wrong.**
    "Zero inversions under ±1-step mood" is false: optimizer days invert 4/315,
    mood days 44/1179, **6 of them censored**, worst gap 0.421. The
    decomposition does not add up either — loose-max bias median 0.000 (not
    ~0.1), half-width median 0.110 (not ~0.15), summing to 0.110 rather than
    0.25. `MATH.md` §8.10 and the two source docblocks are corrected; the
    constant is LEFT at 0.25 because the two populations overlap and there is no
    clean cut to move it to. **Re-deriving it from the measured distributions**
    became item 28, which measured it on 2026-08-13 and found the fit error flat
    in the constant — it is not derivable, and it stays at 0.25.
    (d) **§17's ϕ-error table** → `scripts/phi-error-price.probe.ts`.
    **Confirmed.** Same U, same headline (half an hour costs a few tenths of a
    percent); large-`s` cells run hotter than 2026-08-04's and small-`s` cooler,
    which is two synthetic grids disagreeing, not the model. The funded-set
    channel the U-shape is credited to is now measured apart from the timing
    loss: 72%/68% of days at 1 h/2 h budgets, **0%** at 6 h and 10 h. The
    rebuild needed no allocator seam — §17's claimed injection point does not
    exist on `main`.
    (e) **§4's exactness claim**, found unbacked while doing the above →
    `scripts/allocator-exactness.probe.ts`. The document's strongest claim rested
    on the suite's smallest sample (one 3-task case); **0 non-exact in 6400**
    across all three untested seams. Its arm B also produced the one genuinely
    new number of the round: §5.1's guard 2 costs nothing until σ/ϕ̂ reaches the
    0.5 cap, where it forfeits up to **5.26%** of a plan.
27. ~~**§8.6's missing off-midpoint rest split**~~ — SHIPPED 2026-08-13 (MATH.md §8.6).
    [docs/features/off-midpoint-rest-split.md](docs/features/off-midpoint-rest-split.md)
28. ~~**Re-derive `STOP_INVERSION_MARGIN` from measured distributions**~~ — SHIPPED 2026-08-13 (MATH.md §8.10).
    [docs/features/stop-inversion-margin-rederived.md](docs/features/stop-inversion-margin-rederived.md)
29. **Round-3: what the 2026-08-06 agent sweep found and nobody built** — five
    agents swept disjoint `MATH.md` ranges to pick item 26's targets, and
    surfaced far more than the five that got probes. This is the residue. Three
    entries already have a COUNTEREXAMPLE measured in a scratch probe that was
    not committed — which is item 26's own failure mode, one level up — so they
    are recorded with their numbers and marked unverified rather than trusted.
    Ranked by whether a shipped behaviour is wrong, not by effort.
    **(b)–(f) were settled by the MATH.md claim audit of 2026-08-06** — each
    now has a committed probe and a corrected section, noted inline below; (a)
    followed on 2026-08-13 and (h) shipped with item 27. The residue is (g).
    (a) ~~**§11.9's "inherited approximations wash out exponentially through
    the trailing rest" is probably false where the feature exists**~~ — SETTLED
    2026-08-13 (MATH.md §11.9). Claimed, unverified, from an uncommitted scratch
    probe: ≤ 0.01 pt at defaults, but **8.4 pt** of morning level from reordering
    three blocks over a 16 h day at `RECOVERY_FIT_MIN`, and **2.4 pt** from
    moving a 2 h break out of the trailing gap. Both **reproduced in direction
    and understated in size**: `scripts/mtr2-carry-over.probe.ts` now sweeps
    every permutation of 3- and 4-row asymmetric days at 8/12/16/19 h worked and
    r ∈ {0.7, 0.3, 0.1}, and that cell measures **13.3 pt** and **7.4 pt** over
    three rows (15.8 pt over a four-row day). Propagated to the DISPLAYED reading
    through `calculateBurnoutRisk`: **11 risk points** at 16 h, **17** at 19 h
    (34 % vs 51 % on a 1 h today-budget, where attenuation is weakest), 0–1 at
    defaults. What §11.9 gained is a mechanism instead of an assurance: order
    and omitted breaks are ONE approximation (`reservoirAt` is affine, so a cycle is a
    composition of affine maps; walking a break out of the trailing gap permutes
    the same multiset, and putting it back at the end is bit-identical), bounded
    by e^(−ρ_rest·gap) — 0 breaches over 2 × 48 cells, worst 81 % of it — and
    visible only while ρ_rest·gap ≲ ln 200 ≈ 5.3, i.e. past a 19 h logged day at
    defaults. The "one-day lookback ≈ 0.8 %" bullet was scoped too: that bound
    is the GAP's, and two 19 h days at the floor keep ~22 %. Pinned at both ends
    in `energy-calibration.test.ts`. **Not built, deliberately:** the real fix is
    ordered, timed logs, which is the shelved multi-day work §11.9's Scope bullet
    already excludes — this is a documented approximation with a measured bound,
    not a bug to re-open. **Left open, and now written down:** the displayed
    reading swings up to 17 points on the order the 🪫 presses arrived, which is
    an artefact of when someone tapped rather than of what they did, and it can
    be made order-independent with no new instrument by seeding from the WORST
    order instead of the logged one (conservative for a metric that warns).
    §11.9 records it as an open alternative with its cost. It is a decision
    about what the number means, not a measurement, so it needs a call rather
    than another probe.
    (b) **§11.9's own exemplar may be arithmetically wrong** (UNVERIFIED): the
    doc says a 16 h day (8 h gap) starts the next morning near **74%**;
    recomputing §11.9's stated closed form at its stated constants gives
    **70.6%**. The 8 h exemplar (92%) reproduces at 91.6%. Two fixed points, so
    a unit test, not a probe — do it in the same pass as (a).
    SETTLED 2026-08-06: §11.9 now reads 92% / **71%**, printed by
    `scripts/mtr2-carry-over.probe.ts` and pinned against a closed-form oracle
    in `energy-calibration.test.ts`.
    (c) **§8.3 claims a unit test that does not exist.** "Post-fix probes
    (locked in as unit tests): … a ~30-minute break placed mid-session _raises_
    total output at equal work-hours — the Jaber–Neumann result". Grep finds no
    such test; the three nearest ones assert reservoir levels, not output, and
    one asserts the opposite direction. §13.5's +17%-at-2-chunks figure is the
    same claim from another thrown-away sweep. Cheapest of the three to settle
    and the most embarrassing to leave: the document asserts a suite guarantee
    it does not have.
    SETTLED 2026-08-06: §8.3 no longer claims the test — it names the effect
    (+5.1% / +6.9%, `scripts/enb-break-economics.probe.ts`) as the one post-fix
    consequence with no suite fixture of its own; §13.5's +17% is now +19.5%.
    (d) **§8.9's "within ~0.05 of truth" under rating quantization + jitter**
    (UNVERIFIED): one agent realization deviated by up to **0.133** (true 0.7 →
    0.833). This is the identifiability bound the whole r → α → λ₀ conditioning
    chain rests on, so if it is really 0.13 the downstream stds are optimistic.
    SETTLED 2026-08-06: §8.9 no longer claims ~0.05. Over 200 seeded trials per
    level (`scripts/stp-recovery-fit.probe.ts`) the median is ~0.06 for r ≤ 0.7
    and ~0.09 for r ≈ 1–1.5, p90 0.13–0.23, worst ~0.36 — so the 0.133 above
    sits inside the p90 band and the tail is worse than either figure.
    (e) **§8.8's coarse/fine quantization ratio is tested at one window only.**
    The suite asserts ≥ 0.97 at `windowHours = 8`; an agent measured **0.9759 at
    12 h** — 0.6 pp of headroom on a window the test never runs — where the
    doc's "~1% objective cost" is actually 2.4%. Rest-confetti reproduced
    exactly (fine = 5 rest blocks vs coarse = 1).
    SETTLED 2026-08-06: §8.8 now carries all four cells, the 2.4%, and the
    breach — over windows 4–14 h the worst ratio is **0.9693 at 4 h**
    (`scripts/stp-lattice.probe.ts`), so the suite's ≥ 0.97 is not a lattice
    property and stays asserted at 8 h only. "0.6 pp of headroom" understated
    it: the bound is crossed, not merely tight.
    (f) **Three more lost sweeps, same class as item 26's**: §14.3's switch-cost
    inversion grid (322 inversions over 178,800 configurations, worst free arm
    −6.53% — the sole justification for a shipped clamp); §15's 300-day
    cross-scoring table (276/300) that withdrew the energy-plan promotion;
    §16's order-only permutation bound (+0.47%) restated as fact in
    `calculation.ts`.
    SETTLED 2026-08-06: all three now have committed, seeded probes and the
    sections quote them. §14.3 is **112 inversions over 71,520** configurations
    with the grid stated (`scripts/adv2-switch-cost-price.probe.ts`); §15 is
    **284/300** (`scripts/mode-cross-scoring.probe.ts`, seed `0x290729`;
    283/300 when settled, re-measured 2026-08-19); §16's median holds at
    **+0.47%**, p90 +1.50%, max +3.96%
    (`scripts/mode-run-order.probe.ts`).
    (g) **§12's ±0.05 adherence verdict band has no noise model** — §12 says so
    outright ("no noise model") while printing one English verdict decided by
    that constant. Nothing shows it is wide enough to stop week-to-week flipping
    or narrow enough to ever name a planner.
    (h) ~~**Documentation defect, free to fix**: §8.6 and item 27 both read as
    if the energy search has NO split-around-rest move.~~ Done 2026-08-13 with
    item 27, which restated the gap as "midpoint-only, and only with room" and
    then closed the midpoint half of it. The `room` gate stands and §8.6 records
    why.

Item 27's replacement follow-up — pushing the exhaustive reference to the
largest task counts it reaches — then found one defect, at a size no proven
reference had covered before.

30. ~~**A funded-subset seed deeper than drop-one**~~ — SHIPPED 2026-08-13 (MATH.md §8.6).
    [docs/features/funded-subset-seed.md](docs/features/funded-subset-seed.md)

Round-3 picked its targets with five agents over disjoint ranges. Round-4 swept
every section instead, and its result is that the gap has moved: no shipped
formula was found wrong, and what has drifted is what the document says about
them.

31. **Round-4: the 2026-08-14 whole-file `MATH.md` audit** — thirteen agents
    over §0–§36, every claim checked three ways (cited from the code, backed by
    a committed probe, formula still matching), then each finding handed to a
    skeptic instructed to refute it, plus a second three-lens pass over §8.12,
    which the first partition had left unread. **37 raised, 14 upheld**, ids
    M1–M36 below. **It was a reading, not a measurement** — no probe, test or
    solve was run and no number re-measured, so nothing below is established
    until its own check is; the findings section states what that costs each
    class of finding. The upheld set is seven statements the code has moved out
    from under (M1–M6, M22), six numbers no probe reaches (M7–M12) and one
    uncited mechanism (M13). One structural hole produces much of the unbacked
    set and is worth closing ahead of the individual items, since it kills
    several at once: **nothing sets `openTaskIds`** (M12, and §11.8's scope
    families). **Closed 2026-08-17, and "several at once" was wrong** — it was one
    finding (M12) living in three probes, the §8.11 half being the same hole with
    no id of its own. What closing it did buy beyond M12 was two numbers no
    finding had raised: the fifth censoring category's share (item 4) and §8.11's
    filter rates. It also refuted the sentence M12 was raised to defend — see its
    entry. The "**nothing runs a fitted posterior** at σ_ϕ > 0" hole this
    entry also claimed was never real: `phi-cap-reachability.probe.ts` imports
    `fitUserConstants` and `phiParameterStd` and fits synthetic histories at two
    noise arms, and `gain-cap-trigger.probe.ts` now does the same for §19.4.
    (`rv15-gain-headroom.probe.ts:51` fits only `fitUserConstants([])`, which
    returns the defaults with the prior — that one is not a counter-example.)
    The third hole named here — that nothing times the advisor path (M9, M10) —
    turned out to be half closed already: §8.6's table prices
    `suggestBudgetCurve`, and M22 is §8.12 not reading it. Ranked below by
    whether a shipped number is wrong, not by effort. **M1 is closed**
    (2026-08-14,
    [`subset-size-bound-under-a-prefix`](docs/features/subset-size-bound-under-a-prefix.md)) —
    and closing it corrected two things in its own entry, which is the first
    evidence of what "a reading, not a measurement" costs: the fix it prescribed
    was wrong for half the change, and the witness it named turned out to cost
    nothing on the day it named. Both only showed up under execution. **M7 is
    closed** (2026-08-17,
    [`what-still-reaches-the-gain-cap`](docs/features/what-still-reaches-the-gain-cap.md)),
    and it cost this entry a third correction — the fitted-posterior hole above.
    **M8 is closed** (2026-08-17,
    [`what-the-rotation-baseline-costs`](docs/features/what-the-rotation-baseline-costs.md)),
    and it is the second entry where execution refuted a number the reading had
    only doubted: §19.3's "0 monotonicity cuts with integer sliders" is false,
    and the guarantee it files as harmless is held up by a different half of the
    same sentence. **M2, M3, M22 and M13 are closed** (2026-08-17,
    [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md)) —
    all four upheld, which is the first batch where the reading was right in
    every particular it raised. What it still cost: M13's entry named five code
    sites and got two of them wrong and missed the biggest one, and M2's fix
    exposed a second copy of its own defect (§21.1's decomposition) that no
    finding had named. **M9 and M10 are closed** (2026-08-17,
    [`what-the-advisor-actually-costs`](docs/features/what-the-advisor-actually-costs.md)) —
    both upheld, both by timing the advisor for the first time, and the batch that
    most changed what the document says: the per-solve ladder was ~10× high, the
    421 ms cited in three code sites was 3.5× the truth, §14.4's "roughly a third"
    was measured **false**, and advisor cost turns out non-monotone in n, which no
    finding had suspected. **M11 is closed** (2026-08-18,
    [`what-the-lab-tile-was-measured-with`](docs/features/what-the-lab-tile-was-measured-with.md)) —
    §13.6's two sets did not survive equally: the ladder reproduces on all twelve
    cells because its prose pins its own fixture, while the shipped-optimum pair
    needed a task set nobody wrote down and is withdrawn. **All fourteen upheld
    findings are closed**, which is the half of item 31 ranked by whether a
    shipped number is wrong. Every one was upheld on execution,
    and the pattern across them is worth keeping: the audit found claims wrong by
    3.5× (421 ms) and ~10× (the per-solve ladder), one measured outright false
    (§14.4's "roughly a third"), and two number-sets citing probe files that were
    never committed (§13.6's here, §15.1's already labelled). Closing them also
    turned up defects no finding had named — §21.1's second copy of M2's own
    defect, §14's drifted frontier denominator — which is the argument for
    executing an audit's findings rather than filing them.
    **A second batch closed five of the leads on 2026-08-18** — M27, M28, M31,
    M32 and M36, chosen as the cheapest on the list plus the four registry holes
    this entry lists at the end
    ([`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md)).
    It says something the upheld set could not, because that set was ranked by
    whether a shipped number is wrong and this one was ranked by effort: **the
    ranking by effort was worthless.** Four of the five were mis-scoped — a
    fixture that already existed, a probe header lying where the registry told
    the truth, a witness at demands the app cannot produce — and both figures
    that had actually drifted (§8.12's dip rate and its `kneeC` ladder) sat in
    the one lead filed as "a citation gap, not a measurement gap". Seventeen
    leads remain and none of them is now safe to call cheap.

## Phase 4 — multi-day horizon

7. **Satiety across days** — BLOCKED, and not the small item it reads as.
   Reservoirs already carry over overnight (§11.9); satiety still resets at
   midnight, so yesterday's 7 h of guitar doesn't temper today's κ. But the
   mechanism is unavailable: `seedMorningReservoirs` receives only
   `{id, cognitiveDemand, physicalDemand}` (`energy-calibration.ts:150-160`),
   while per-task output needs `curves.get(taskId)` built from difficulty
   **and enjoyment** (`zenith-energy.ts:535-537`), which
   `DrainObservationRecord` does not carry. It is not "the same pass" — it
   needs a yesterday-session read, cross-day task identity, and a curve
   rebuild, and it puts a second uninstrumented knob (the half-life) on top of
   an already uninstrumented `satietyScale`. Do not start it as a small item.
8. ~~**Priced defer destination**~~ — SUPERSEDED 2026-08-04 by item 21, on a
   measurement: tomorrow's %gain exceeds today's %loss on **88%** of pairs
   (median +11.8 pp), and the two percentages have different denominators (a
   fuller day against an emptier one), so printing them side by side is a
   systematic pro-deferral nudge dressed as a price. The related measurement
   that kills the horizon solver behind the original item: `Σ_d Σ_i P̄` is
   non-decreasing in window length on 24/24 trials, so a multi-day objective is
   only well-posed if **every** task carries a hard deadline inside the
   window — a mandatory new input on every task, not `deadline?`. For scale, an
   oracle partition beats a hand round-robin spread by median +2.17% at H = 3
   and a plain hill-climb from that spread closes the gap to 0.27–0.71%: the
   value is in spreading at all, not in optimizing the partition, and the
   solver costs seconds per search.

What survives of the multi-day idea is two readings, not a solver:

21. ~~**Destination preview for a defer**~~ — SHIPPED 2026-08-12 (MATH.md §14).
    [docs/features/defer-destination-preview.md](docs/features/defer-destination-preview.md)
22. **Chronic-slide badge** — "this has been on your list 6 days".
    `moveTaskToTomorrow` copies `createdAt` verbatim
    (`session-store.svelte.ts:713`), `Task.createdAt` is an ISO date string
    already validated on read (`persisted.ts:91`), and nothing in presentation
    renders it — so slide age is `today − task.createdAt`: no title matching,
    no new read, no new concept. Cross with `unfundedTaskIds` for the "never
    funded" half. Honest limit: `importTasks` restamps `createdAt` to the
    selected date, so age accrues only along the deliberate "To tomorrow"
    path — which is what "slide" means. **Hard ceiling: it stays a badge.** An
    objective term, or auto-setting `mustDoToday`, re-opens settled ground
    (§14: the flag promises the day, not the hours). Smallest item here.

## Phase 5 — the lever the objective lacks

23. **Task importance weight — `Σ vᵢ·P̄ᵢ(tᵢ)`** — one 3-level weight per task,
    so a tight day funds what matters rather than what is cheap. `v` scales the
    whole block menu in `buildBlockIncrements`; positive scaling keeps
    increments positive and non-increasing, so the greedy's exactness, the
    subset enumeration and the pool-ratio candidate all survive, and `T*` is
    **invariant** (`argmax v·P̄ = argmax P̄`) — so `v` changes only _which_
    tasks are funded, never how long a funded task runs. Entry point is
    `toPooledInputs` (`metric/calculation.ts:157-165`).
    **The R3 hazard to price first:** `Σ P̄` has two independent
    implementations — the allocator's `planValue` over `buildBlockIncrements`
    (`zenith.ts:948`, `:667`) and `calculateTotalProductivity`
    (`zenith.ts:1387`), which is what Zenith Gain and the §12 audit score with.
    A weight must land in both in lockstep or §13.2's "the gain is provably
    ≥ 0" — which since §19.3 holds on the SINGLE-BUDGET path only, while the
    dashboard reads the pooled one — breaks and the audit starts comparing two
    objectives. Default `v = 1`
    must be an exact no-op, or every worked percentage in
    §11.2/§13.2/§14/§14.2 becomes non-reproducible.
    **Probe — one command, and it can kill the item outright:** read the
    histogram of `DailySession.availableHours` from the real IndexedDB. The
    item's value decays 14.7% @ 2 h → 9.3% @ 4 h → 4.4% @ 8 h, the same shape
    as item 6's own re-open condition, so **kill it if the day is habitually
    planned at ≥ 6 h** — at 8 h the funded set barely moves. Do **not** quote
    the 14.7% as justification: it is measured against a ground truth the added
    weights themselves define, i.e. circular. The defensible pre-build number
    is the dynamic range — the model's implicit value spread is
    p90/p10 = **2.32×** across the whole slider grid, against 4× for a 3-level
    scale.
    **Unpriced costs to settle before building:** `priorityScore = P̄(T*)·10`
    becomes v-scaled and is rendered as a bare number
    (`task-item.svelte:194-196`); `SavedRoutine.tasks` shares `taskCore`
    (`persisted.ts:68-76`), so decide whether importance travels with routines
    (`mustDoToday` deliberately does not); and the energy mode does not get the
    weight (`toEnergyTask`, `calculation.ts:112`), so §12's audit becomes
    weighted against unweighted. One `Task` field plus one `sanitizeTask`
    line — **no `DB_VERSION` bump, since R8 governs stores, not shapes.** New
    user input: yes, per task. **MATH.md §0's objective changes**, same commit
    (R7).

## Phase 6 — product and reach

Only if Fallow grows users beyond its author.

9. **Weekly retrospective digest** — the §12 audit and the calibration
   snapshot, summarized per week in analytics.
10. **Sync** — default no (the no-server stance is a feature); revisit as
    file-based export/merge if a second device becomes a felt need.

## Considered on 2026-08-04 and not proposed

Not settled decisions — those live in AGENTS.md §4's index and an item
here graduates there only if it is ever formally decided. This is a list of
things that looked good, were measured or checked, and lost, so they do not
have to be re-derived:

- **Per-task remaining-work caps / task size estimates.** Against "finish early
  and idle the leftover" a declared cap is worth +2.45% median — but against
  item 12's prefix-aware re-plan it is **median 0.00%, mean −0.47%, p10
  −1.69%**: never better, sometimes worse, because declaring commits the
  morning plan while the re-plan reacts with full information. Re-open only if
  item 12 is declined, and then fix the obvious formula bug first
  (`floor(remaining/BLOCK_HOURS)` gives 0 blocks under 15 minutes, refusing to
  fund the nearly-finished task — it needs `max(1, …)`).
- **A start/stop session timer.** Buys item 12 nothing: ±15 min of recall error
  costs 0.00% median. Order is settled (§16) and `Σ P̄` is order-invariant
  anyway; time-of-day already has `createdAt` and §8.3 declines circadian until
  there is an instrument. Highest cost in the batch (R8 + a timer store + a
  backup bump) for no plan-value number.
- **Enjoyment inference of any kind** (revealed dread, completion-order
  regression). **The figure this was rejected on was mis-scoped** (see the phase
  framing): 0.052% is one point on one task, not the channel. A β oracle is worth
  up to the 2.02% that defaulting enjoyment costs — for users who leave it
  defaulted, which item 15 now handles for any title they have rated before. What
  survives without arithmetic help: there is no instrument for enjoyment, the
  mapping from behaviour to β would be invented, and the user can simply move the
  slider. Re-decide on those if it is ever re-opened, not on the anchor.
- **A budget-realization ratio ρ as a fit or a prior.** Unidentifiable:
  worked hours come only from opt-in 🪫 logs, so ρ conflates over-declaration,
  under-logging, and §13.6's dual meaning of `availableHours`. At most one
  display line phrased as _logged_ vs _declared_.
- **Auto-routine by weekday.** Re-implements `SavedRoutine` with an inferred
  frequency threshold in place of the user's exact choice (§0).
- **A sleep-quality slider feeding the pools.** Already built:
  `cognitivePool`/`physicalPool` are per-day, persisted, validated and
  user-editable (`day-constraints-bar.svelte:213-224`). A sleep slider is a
  second input for the same lever plus an invented mapping with no instrument.
- **Deadlines as an urgency multiplier.** The date→weight curve is invented and
  nothing in the app can fit a discount rate; a user who wants Friday's task
  funded raises its importance (item 23) in the same keystrokes.
- **Fixed appointments / longest-stretch caps.** The "fragmentation
  mis-scoring" is a re-measurement of the already-documented `Σ P̄` spreading
  artefact (§12), and the cheap mechanism is unsound: capping each task at the
  longest stretch admits inexecutable plans (two 3 h stretches, three 2 h
  tasks). Real feasibility is bin-packing inside the 2ⁿ enumeration, not one
  `Math.min`.
- **Adherence as an objective term.** Self-confirming — shrinking the plan
  toward revealed composition raises next week's `classicOverlap` by
  construction, destroying the only audit there is (§15).
- **Task dependencies / a `seriesId`.** No recorded instances, no cross-day task
  identity (`nextTaskId` is per-day), and the zero-code alternative works:
  don't put the blocked task on today's list.
- **A backlog flag, or "add a task" as an advice lever.** Measured: adding a
  task never lowers `Σ P̄` (0/600 days), raises it on 88% by median +7.4%, and
  the addition gets ≤30 min on 56% of funded days — so it would dominate every
  axis and read "add more work". Same shape as the settled rule that a budget
  _increase_ never enters the frontier (§14.1).
- **A week-feasibility reading (`ΣT*` vs `Σbudget`).** Pinned "infeasible" on 84% of
  slack weeks and 100% of tight ones — it is per-week Time Scarcity, already
  permanently high.
- **Hindsight value (plan vs actual composition scored in `Σ P̄`).** Near
  tautological: the plan is the argmax of the objective doing the scoring, over
  the same total hours, and provably optimal on the single-budget path, so the
  sign is fixed up to lattice and pool slop.
- **Reserved hours per task.** The funding privilege §14 rejected, relocated
  from a flag to an hours field; the workaround already ships in two actions
  (drop the budget, drop the task), and §17's flatness makes an itemized "bill"
  read as free.
- **A hedge receipt (posterior vs no-posterior plan diff).** The unhedged plan
  uses ϕ̂, not truth, so the diff is not "what knowing your true ϕ would buy",
  and there is no lever the user owns in response. Only the ± band survives,
  folded into item 19.
- **Fit-vs-default plan diff; a funded-set robustness sweep; the information
  value of the next ⚡ log.** Redundant with item 19's rows or expected to
  collapse to a static sentence; the robustness sweep also costs 2n+4 solves,
  worse than the whole advice run. Run each as a probe only — the cheapest good
  outcome is one constant sentence and no code.
- **Fitting `switchCost` from the observed funded-task count.** See item 17.

## Findings from the 2026-08-11 comment sweep

These came out of a sweep that cut 946 comment lines across 30 files. A comment
defending a design is evidence about the design, and this is what the defended
code turned out to be. The **F** ids are stable and never reused.

All 65 were then triaged against the code they name: **34 dropped** and **31
fixed** on this branch — every finding the triage upheld, none left open. The
fixed ids are F2, F4, F8, F10, F11, F16, F18, F19, F20, F21, F22, F23, F24, F26,
F28, F31, F32, F33, F37, F39, F41, F42, F46, F47, F48, F49, F54, F55, F61, F62
and F64, named here so a reference to one resolves to "done" rather than "lost".

One error dominated the raised set and is worth knowing before trusting anything
here: "nothing enforces this", written without opening the story or e2e file that
did. Of the seventeen "contracts held by convention only", eleven dropped, and
seven of those went because a named test had pinned them all along. Look for the
test before believing that phrase.

### Raised while working the list, not by the sweep

No **F** id — these came out of fixing the findings above, and the ids belong to
the sweep.

- ~~**`ghost` has never had a readable hover on a dark theme, and now it is
  measured.**~~ The measurement was wrong, not the token. Adding `ghost` to
  `scripts/hover-contrast.mjs` (F21) took the residue from 23 to 60, and 33 of
  those were one artefact of the instrument: `step` and `gap` were absolute
  differences of WCAG relative luminance, which is compressed near black, so the
  one unchanging 6% `surface-hover` tint measured ΔL 0.129 over white and 0.0048
  over black — a 27× spread from a token that does not vary, and a threshold that
  can only ever be calibrated for one end of the catalogue. Re-measured as a
  contrast ratio, the dark themes' ghost hover is _stronger_ than the light
  themes': dark 1.081–1.174 (median 1.122) against light 1.102–1.147 (median
  1.116). The metric also under-reported — `glacier` ghost read 1.02, the
  faintest in the catalogue, and the ΔL bound passed it at 0.0181 because it is a
  light theme; a patch-mean sample showed that one was the single-pixel
  sampler landing on corner antialiasing, and it reads 1.096 over its own area.
  Three changes, all in the script, none to a token: step and gap became ratios
  against one bound (1.03, sitting in the measured gap between the palette caps at
  1.019 and the faintest shipped hover at 1.037); `ghost` joined the gap
  exemption, because with no rest fill and a transparent border the pixel behind
  it and its own rest pixel are one pixel, so `gap` there was `step` re-measured
  against a stricter bound; and every sample became a patch mean rather than one
  pixel. Residue 60 → 27. Left standing and worth knowing: four light themes'
  `outline` and `bubblegum` secondary sit at 1.037–1.049, a near-white hover over
  a near-white page, and are the faintest hovers the design ships — nothing was
  changed for them, and a bound at 1.05 would report them.
- ~~**`drain-log-form.svelte`'s `seed.recordId` is now read by nothing.**~~ Done
  with F26. Dropped from the form's seed rather than made load-bearing: expressing
  the pairing in the type would take a union whose two arms `task-row-shell.svelte`
  cannot select between — it derives `ondelete` from `recordId` in a ternary, which
  TypeScript will not correlate with a sibling prop — so it would have bought an
  `{#if}` split and a duplicated `{#key}` to restate a decision the form does not
  take. `DrainDraft.recordId` remains the one statement of it.

### Dropped on triage

Not to be re-raised without new evidence beyond what the original text argued.

- **Pinned by a test the finding did not look for** — F1 (`fit-log-summary.stories`
  "Resetting" asserts focus returns to the trigger), F6 (`energy-chart.stories`
  "Phone width" pins the viewBox to the rendered width), F9
  (`day-constraints-bar.svelte.spec.ts` + `e2e/time-budget.e2e.ts`), F12 (the ≥2
  guard lives in `calibration-descriptor.ts` and is tested), F14, F15, F17, F25
  (`session-store.svelte.spec.ts`), F27, F30 (an e2e clicks the prompt and asserts
  focus lands on the field).
- **Premise false** — F13: Storybook's `resetAllMocksLoader` is in
  `getCoreAnnotations()`, so `fn()` mocks are restored before every story and the
  shared-mock hazard does not exist.
- **True but the fix is churn** — F3 (a `{#key seed}` would remount on every parent
  update and discard live typing, because `seed` is a fresh object literal), F5,
  F7, F29, F34, F35, F36, F38, F40, F43, F44, F45, F50, F51, F52, F53, F56, F57,
  F58, F59, F60, F63, F65.

Two upheld drops left facts worth keeping. `budget-curve-chart.svelte`'s
`bind:clientWidth` wrapper repeats the pattern F6 was dropped over but has no
viewBox assertion in its story, so that enforcement covers one chart only. And
F34's own text names a real hole — `{#if ondrainopen}` renders the 🪫 button while
the editor needs `ondrainsave` — but the per-instrument object it proposes would
not close it: `(app)/+page.svelte` deliberately passes save-without-open on past
days (`ondrainopen` is withheld when `canLog` is false, `ondrainsave` always
passed), so that pairing is intended, not an accident.

## Findings from the 2026-08-14 `MATH.md` audit

Item 31's list. The **M** ids are stable and never reused. M1–M13 and M22 were
each handed to a skeptic told to refute them and survived; **M14–M21 and M23–M42
were raised and not verified** — they are leads, and item 29's rule applies, so
quote none of them as a result until its own check is run. **M27, M28, M31, M32
and M36 were closed on 2026-08-18** ([`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md)), which took the four registry
holes below with them, and **M18–M21 the same day**
([`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md)); **M24, M29 and M30 followed on
2026-08-19**, and **M14, M15, M16, M25 and M26** with them ([`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md)), and **M38 the
same day** — its ruling shipped as a model change (MATH.md §8.10, §8.11, §10).
Ten are still leads: M17 (two of its three sites landed), M23, M33, M34, M35,
M37, and M39–M42, the last four filed 2026-08-19 out of M38's measurement and its
fix. M37–M42 came from probe sweeps rather than from the 2026-08-14 audit and
carry the same rule; M38 is the one exception, because its fix committed the
instrument that reproduces it.

**Every `MATH.md:NNNN` below is as of 2026-08-14 and most have since drifted**,
some by hundreds of lines — closing the fourteen upheld findings added six §10
entries and re-measured several sections, and §34's citation, for one, is now
~600 lines further down. Grep the quoted text, not the line. They are not being
swept: each lead has to be re-located when its own check is run anyway, and
twenty re-guessed line numbers would read as verified when only the quoted text
is. The same drift is what M1, M3 and M11 each found in `MATH.md`'s own
citations, and it is the argument for citing text over position.

**Nothing below was executed.** The audit read `MATH.md`, the code and the probe
sources. It ran no probe, no test and no solve, and it re-measured nothing, so
every figure quoted here is transcribed from `MATH.md` or from a probe source
rather than reproduced. Three consequences, and they bound what the list is
worth: "unbacked" means no committed probe reaches the claim, never that the
claim is false; a drift finding names two expressions that differ on inspection,
not two runs that disagreed — M1's n = 13 witness included, which is hand-derived
and unexecuted; and a section reported clean is one whose text and code agree by
reading, which is weaker than agreeing in a run. Confirming any of it by
measurement is the next round's job. That is the same discipline item 26 was
created to enforce and item 29 (a), (b) and (d) had to invoke after trusting
numbers from probes nobody committed.

Within that limit, nothing here says a formula is wrong. Every upheld drift is
the document, a docblock or a form comment describing code that has since moved,
which is the class R7 exists to prevent and the class a whole-file sweep is the
only way to catch.

### Upheld — the document disagrees with the code

- **M1 §34 — fixed 2026-08-14,
  [`subset-size-bound-under-a-prefix`](docs/features/subset-size-bound-under-a-prefix.md).**
  §34 gave the bound as `maxFunded = max { m : budgetBlocksFor(m) ≥ m }`; the
  code is `budgetBlocksFor(Math.max(startedCount, m)) ≥ m` (`zenith.ts:1098`),
  and the proof could not express the difference because its variable was
  `b = budgetBlocksFor(|S|)` — §34 (2026-08-08) lagging §35's union rule
  (2026-08-10). Upheld, and the code was correct throughout. Two corrections to
  this entry, both found by running it: the **bound** takes
  `budgetBlocksFor(max(startedCount, m))`, not the
  `budgetBlocksFor(dayFundedCount(S))` prescribed here — that expression is
  right for the proof variable, where `S` is in hand, but the bound quantifies
  over sizes with no `S` to name. And this entry's own witness (s = 0.25,
  B = 3.25 h, startedCount = 10, doc 7 against code 4) flips the branch but
  costs nothing on that day, because forward selection reaches the optimum there
  anyway; the day that shows the cost is n = 13, B = 4 h, s = 0.33,
  startedCount = 8, where the stale form forfeits 15.0%. So "changes a plan"
  holds — it is the branch that changes it, not the bound, which is never
  tighter than the shipped one.
- **M2 §21.4 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
  The row labelled "(shipped)" was one largest-remainder equal split; the shipped
  `naiveBaselineValue` averages the n cyclic rotations, which the audit found by
  reading and `rv15`'s new arm J priced: 4.575 against 4.621 at 4 h, so the
  shipped comparison is **+2.9%** and not +1.9%. Upheld exactly as framed, and
  the entry understated it — §21 already printed 2.9% in its own header and arm A,
  so the section contradicted itself, and §21.1's decomposition inherits the same
  single-split scope. The `zenith.ts:1573-1579` citation had drifted to `:1584`.
- **M3 §11.11 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
  Upheld, and the audit's `100·(m−g)/(m(m−1))` is right — a defer drops the task
  from both sides of `grinds/funded` (`metric/calculation.ts:1033`, still the
  current citation), so the step is 0 on an all-grind plan and 15 pp on the quoted
  day, which the table below already printed as −15 pp. Re-measured at
  `mtr-grind-density.probe.ts:458`: the mispriced-defer share is **10/545**, not
  107/545 — the one figure execution moved beyond the step itself. The
  conclusion stands, as the entry predicted.
- **M4 §2 — fixed 2026-08-14,
  [`three-explanations-the-code-outgrew`](docs/features/three-explanations-the-code-outgrew.md).**
  `MATH.md:204-209`, echoed at `:25`, says concavity and the decaying
  tail are **not** asserted in `zenith.test.ts`. Both are, added in the same
  commit c5f4ef1 (`zenith.test.ts:142`, `:161`, `productivity(200,…) < 1e-6` at
  `:171`). `curve-marginal-facts.probe.ts:10-12` repeats the stale framing and
  contradicts its own `:26-27`.
- **M5 §8.9 — fixed 2026-08-14,
  [`three-explanations-the-code-outgrew`](docs/features/three-explanations-the-code-outgrew.md).**
  `zenith-energy.ts:1678-1679` still reads "≈ 0.2–0.4 … roughly
  half the drain fit's lever arm"; `MATH.md:1562-1563` retracted that on
  2026-08-06 (0.22–0.26 against dD/dα 0.6–0.9, a third). The 0.4 is unreachable:
  dD/dr ≤ d_pre/(r·e) = 0.263. One comment edit; the probe back-reference at
  `:1683` stays.
- **M6 §2 — fixed 2026-08-14,
  [`three-explanations-the-code-outgrew`](docs/features/three-explanations-the-code-outgrew.md).**
  `task-form-fields.svelte:24-25` justifies `min: 1` as "ϕ divides by
  enjoyment (MATH.md §2) … division by zero". Nothing divides by β (ϕ = c₁E +
  c₂β + c₃, p₀ = β/E), and βᵤ = 0 → β = 8/9 is finite. The reason and the
  citation both belong to §1's declared domain βᵤ ∈ [1,10]. The same claim and
  the same wrong citation sit in the document at `MATH.md:5120` (§22), found by
  grepping `divides by` while routing this and corrected with it.

### Upheld — numbers no committed probe reaches

- **M7 §19.4 — closed 2026-08-17,
  [`what-still-reaches-the-gain-cap`](docs/features/what-still-reaches-the-gain-cap.md).**
  §19.4's 999% ladder at 4.25/8.5/13/17.25 h, ϕ̂ = 0.17 h → 7 h, and the 569% and
  41.6% maxima (`MATH.md:4929-4958` after this change). rv14 never imports the
  fit API and its budget draw (`0.5 + Math.floor(rnd() * 32) * 0.25`) stops at
  **8.25 h**, not the 10 h this entry first said. Mirrored verbatim into
  `zenith.ts:1415-1427`, where it is the sole justification for
  `GAIN_PERCENT_CAP`. `gain-cap-trigger.probe.ts` swept 0.25–24 h at
  ϕ̂ = 0.1/0.17 h: the σ = 0 rungs reproduce exactly, the **569% does not** (it is
  291.7% at the measured cell, 479.7% anywhere on the slider grid), and the
  fitted user §19.4 asserted is reachable — 97.3% of seeded fast-flow histories
  — so the cap keeps its trigger. Two things only execution found: the ladder is
  a difficulty-5 cell and not "the default sliders" (the form's 5/5 draft is
  effective difficulty 6.5), and at σ > 0 every rung arrives one to four budget
  steps later, where the first draft of this change had recorded "no rung
  moves" — that reading was the fitted user's ϕ̂ = 0.36 h, not the ladder's 0.1 h.
  The `naive = 0` arm found no witness in 6,576 days and stays open.
- **M8 §19.3 — closed 2026-08-17,
  [`what-the-rotation-baseline-costs`](docs/features/what-the-rotation-baseline-costs.md).**
  The four groups were `MATH.md:4918` (the rotation spread), `:4931` (0.886678
  against 0.891116), `:4943-4955` (the cut counts), `:4988` (the timing), and
  the header's "every number below sits on the same draw" now says which draw
  each one comes from. Two new `rv14` arms (J, K) and a new probe,
  `naive-menu-cut-corner.probe.ts`, back all four. The witness pair reproduces
  exactly and is pinned; the 81.7% does not (**75.9%** of 2400 days); the timing
  is restated as a ratio with its machine and day (0.4–1.4% of the solve). The
  finding execution turned up: **"0 monotonicity cuts in 156,000 integer-slider
  cells" is false** — 220 of 100,320, every one of them costing value, and the
  witness cell sits on that regime's own axes. What keeps the weakened ≥ 0
  guarantee unreachable is the σ_ϕ half, which §5.1's 576,000-cell sweep already
  held and which arm 3 re-asks at ϕ̂ ≥ 4 h: 0 of 4,320 fitted histories reach
  σ_ϕ/ϕ̂ ≥ 0.35 there, largest 0.232. §5.1's cut is untouched by design, and no
  item is opened for it — the corner needs both halves and the fit half holds.
- **M9 §14 — closed 2026-08-17,
  [`what-the-advisor-actually-costs`](docs/features/what-the-advisor-actually-costs.md).**
  The finding was §14's and §14.4's millisecond figures (1.6/3.9/12.5/95 ms; 12 ms
  and 946 ms per run; 103.6→51.2 ms; **421 ms**; 7.3% / 2.9%), none of them timed
  by a probe, with the 421 ms quoted as settled in three code sites.
  `plan-advice.probe.ts` now times the ladder, the whole run and §14.3's two extra
  solves. **Upheld, and the ladder was ~10× high**: ~9.3 ms per solve and
  **109–124 ms** for the 12-task run, against 95 and 946. Execution added three
  things the finding did not predict — §14.4's "roughly a third" is the one claim
  measured **false** (0.7–0.9×), **advisor cost is non-monotone in n** (a 15-task
  day takes §34's fallback at ~45 ms, so n = 12 is the worst case and not a
  floor), and the 421 ms's "before" half cannot be re-run at all. The
  never-a-`$derived` conclusion stands in all three code sites and is unaffected.
- **M10 §14.3 — closed 2026-08-17,
  [`what-the-advisor-actually-costs`](docs/features/what-the-advisor-actually-costs.md).**
  The finding was §14.3's "+41.8%", whose only executing copy was a fixture
  literal, and the day it never stated. `adv2-switch-cost-price.probe.ts` now
  reads the shipped `switchCostPrice` through `suggestPlanAdjustments` instead of
  re-deriving it. **Upheld; the figure is +41.9%** and is reached by none of 4618
  cases as quoted. The finding also asked for the day's tasks and pools, now named
  by value — and the sweep showed the state is the **generic** 3-task day at that
  budget (58/58 and 4560/4560), not the corner the section implied, which
  strengthens the independent-suppression decision rather than weakening it.
- **M11 §13.6 — closed 2026-08-18,
  [`what-the-lab-tile-was-measured-with`](docs/features/what-the-lab-tile-was-measured-with.md).**
  The finding was that §13.6 cited `scratchpad/rv-energy-readouts.probe.ts`,
  which exists nowhere in the tree or in git history, for two number-sets that
  `rv13-terminal-timing.probe.ts` did not cover. **Upheld, and the two halves
  did not survive equally** — which is what execution added. The 12 h ladder
  reproduces on **all twelve cited cells**, because the fixture is pinned by the
  section's own prose: `simulateReservoirs` reads the two demands and the params
  and neither `difficulty` nor `enjoyment`, so nothing unstated could have moved
  it. The 0.890/0.469 pair is **withdrawn**: an optimized plan reads difficulty
  and enjoyment through the objective, no plausible task set reproduces it, and
  it is unreachable from the ladder's shape at all. §13.6 now quotes the ladder's
  own task optimized (0.9995/0.4542), which makes the paragraph's point by a
  wider margin. §15.1's unbacked label was the fallback and was not needed.
  One reported defect was rejected on checking and recorded as rejected: the
  "fixed 2026-08-07" date is a timezone boundary (8f01ca8, authored 08-08 01:03
  +0200, committed 08-07 23:03 UTC), not a wrong fact.
- **M12 §8.10 — closed 2026-08-17,
  [`what-the-open-task-scope-is-worth`](docs/features/what-the-open-task-scope-is-worth.md).**
  The finding was §8.10's "1.32 → 1.16" for the 2026-08-12 open-task correction,
  now `MATH.md:1645-1652`. No probe set `openTaskIds` — both bracket replicas took
  `lo` over every task, so they modelled the superseded scope while validating
  clean, and the suite pinned direction only. All three stop probes now read the
  field, both replicas are validated on days carrying completions, and the
  witness is pinned as a **pair**: it reproduces at **1.321 → 1.156**, a 0.165
  shift, 1.5× the 0.110 half-width. What execution changed is the sentence
  underneath it: across 90 users at a known λ₀ the corrected scope beats the
  pre-correction one in 1 of 12 arms by +0.0054 λ₀ and loses the other 11, so
  §8.10's "biased λ₀ up by the whole marginal of work that no longer existed" is
  now stated as a **one-day witness, not a measured bias** — the rule itself is
  settled and untouched, and it rests on an argument no synthetic day can make.
  Two numbers nobody had asked for came free with the population: the fifth
  censoring category's share of the losses (item 4 above) and §8.11's filter
  rates. These two sections had already retracted one uncommitted pair —
  §8.11's 2026-08-05 append-last counts, which no probe reproduces either.
- **M22 §8.12 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
  "16 solves at the default cap, **~40 ms each** on a small day", against §8.6,
  which prices the same call site by name and instructs the reader to quote its
  range because its two runs share no absolute figure. §8.12 now defers to that
  table; the 16-solve count, the 17-budget arithmetic and the
  never-a-`$derived` conclusion all stand. Upheld as framed, including the part
  of this entry that matters most: raised as unbacked by one lens and **refuted in
  that framing** — the defect was staleness, and `suggestBudgetCurve`'s own
  docblock had already been corrected on 2026-08-13.
- **M13 §8.2 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
  `MATH.md §8.2` appeared nowhere in `src/` and §8.1 was uncited too; both
  sections' text was already correct, so this was citations only (R7). Upheld with
  two corrections, both from reading the file rather than the finding: the audit
  **missed the largest site** (the file header's warm-up bullet, whose two
  siblings cite §8.5 and §8.4), and **two of the five sites it named should not
  carry a citation** — they are defaults-block comments, and this file's idiom
  puts the section on the interface docblock, so following the entry literally
  would have broken the pattern it asked to match.

### Raised and not verified

- **M14 §3 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).** Upheld: two scales ship and §3 named
  one. §3 now states both — `SuggestedTask.priorityScore` is
  `Number((P̄(T*)·10).toFixed(1))` at `metric/calculation.ts`, the printed figure,
  the weight in `completionRate` and `yieldIndex`, and the key
  `calculateSuggestedTasks` sorts by, against `metric/remaining-day.ts`, which
  passes P̄(T*) un-rescaled and deliberately — and it says the ×10 is
  order-preserving where the 1 dp rounding is not. **Every consequence figure was
  left out.** The lead's headline "2.76% of days print an inverted list" measures
  `calculateSuggestedTasks`'s array, not the page: `task-list.svelte` re-sorts
  the funded group by `#N`, and its "1,2,5,4,3" example day funds all five tasks,
  so the page prints 1,4,2,3,5. Nothing committed prints the rendered order;
  quoting a percentage needs `scripts/priority-scale.probe.ts`, which nobody has
  written, so §3 states the two scales and the rounding qualitatively.
- **M15 §5 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).** Upheld in the docblock only, and **the
  obvious repair was wrong.** §5 and §5.1 are true of the shipped allocator: it
  consumes the posterior covariance through `phiParameterStd` whenever a
  posterior is passed, which the store always does, and the prior posterior keeps
  σ_ϕ > 0 from zero logs. The false clause sits on `phiPredictionStd` — a
  function the allocator deliberately never consumes, because its σ̂² term is the
  user's own day-to-day scatter rather than measurement debt — so "the allocator
  consumes this now" would have swapped one false sentence for another. The
  docblock now points at `phiParameterStd`, and §5 names which of the two shipped
  so the `phiPredictionStd` two lines above it cannot be carried into the
  allocator. Reported, not fixed: `phiPredictionStd` has **no production caller
  at all**, and the ϕ row prints no ± band either. Execution turned up the
  round's second transcribed figure, which the lead's own verdict had declared
  clean: §13.1's σ_ϕ at n = 200 read **0.003**, a second rounding of the probe's
  4 dp display 0.0025. `rv13-prior-posterior.probe.ts` now prints 6 dp and the
  cell reads **0.002473**, in both table rows and in `zenith.ts`.
- **M16 §5.2 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).** Upheld, and none of the three
  phrasings was the right one: §5.2 had the row count right and the fit count
  wrong, while both source comments were plain undercounts. Five fits reach the
  card (ϕ, r, α_cog, α_phys, λ₀ — §8.7 calls α_cog/α_phys two independent fits),
  so §5.2 now states the split it was reaching for, the recency-weighted ϕ row
  against four unweighted fits, rather than a tally. The likeliest source of
  "(four fits)" is §5.2's own "The three energy fits" eight lines up — ϕ plus
  three, λ₀ forgotten — and the reword is needed under all three readings of it.
  Doc and comments only; the shipped card and its count formatting were green.
- **M17 §13.4** — `zenith-energy.ts:2028-2029` still quotes the retracted "0.65
  appended-last against 0.37 inserted-first"; `MATH.md:3319-3325` retracted it
  (the gap is 0.005). Replace with the 0.8894/0.8840 pair from
  `rv13-stop-insertion.probe.ts`.
  **Two of three sites fixed 2026-08-19,
  [`what-the-retracted-step-still-said`](docs/features/what-the-retracted-step-still-said.md); does not close.** The third —
  §8.10's own paragraph, which states the same pair as live fact — is held with
  the reconstruction ruling and still reads it. Both of this entry's citations
  are stale (`zenith-energy.ts:2028-2029` → `:2031-2032`; `MATH.md:3319-3325` →
  the §13.4 retraction, several hundred lines down) and its prescription is
  wrong: 0.8894/0.8840 are whole-day indifference midpoints, not a step
  marginal, so the docblock drops the pair and cites §13.4 rather than
  substituting them.
- **M18 §28 / §31 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).** Upheld: 24 `label:` rows, 4
  headlines, Capacity Left the 24th. §28 and §31 now read twenty-four / twenty.
  Execution added that the count had rotted **twice**, across four sites holding
  one fact with no check between them — so `metrics-dashboard.svelte` drops its
  two literals instead of bumping them (the component filters an array it is
  handed and cannot know the count), and `metric-descriptor.test.ts` pins 24 rows
  and 4 headlines so a 25th fails the suite.
- **M19 §28 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).** Premise held: §28 was cited
  nowhere in `src`, `e2e`, `scripts` or `docs`. The docblock paragraph that
  paraphrases the decision now cites it; the four `headline: true` flags stay
  uncited, because the docblock is where this file puts sections and repeating
  §28 four times restates it.
- **M20 §32 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).** Premise held (`git grep 'MATH.md §32'`
  returned only this lead). Defect 1's gate now cites §32. `history.ts` is
  **declined**: §32's own defect-2 paragraph blesses that bare `(§29)`, and since
  8babd94 the bar-sizing decision is made in `quadrant-distribution.svelte`, which
  is where the `(§32)` went. Execution turned up that §32 itself was stale — its
  fix paragraph and its "Pinned in the suite" line both described a `total` prop
  8babd94 deleted on 2026-08-12; both now describe the shipped derivation.
- **M21 §16 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).** Four callers, confirmed by grep.
  `MATH.md` §16 had already been corrected to four by be1bc26 the same day; only
  `calculateInterleavedOrder`'s docstring still said three, and it now names
  `EnergyLabStore`'s classic schedule as the fourth.
- **M23 §8.10** — `MATH.md:1872-1874` "runs the full conditioning chain on ALL
  logs", superseded by §33 and by `session-history.ts:418-426` (`date < today`).
- **M24 §11.8 — closed 2026-08-19, [`what-the-output-tile-was-scored-against`](docs/features/what-the-output-tile-was-scored-against.md).** The retired name is real
  and §11.8 now annotates it in place. All four supporting facts were wrong: the
  store field is at `energy-lab-store.svelte.ts:413`/`:422-423`, the rename is
  recorded in the first line of §30's "The fix" (`#outputVsClassic` →
  `valueVsClassic`) and not at the cited `:6048`, the old name does not grep
  empty (three tracked hits, one of them §30's own record of the rename, which
  keeps it), and the rename was **not** name-only — §30 repointed the tile
  from raw `totalOutput` to the `objective` the same day, so a token swap
  would have rewritten a 2026-07-20 entry into a claim it never made.
  Filed as a one-token rename, and the pass that verified it marked §30's
  headline pair "transcribed — probe not run": that is where the round's only
  measured drift was sitting. Four §30 figures moved (61.4 → **61.03**, 73.1 →
  **73.20**, 45.8 → **45.65**, and the per-worked-hour 39.9 → **41.97**),
  bisected to the two 2026-08-13 solver fixes — §30 was exact until the day
  they landed. Renaming `scripts/rv16-output-vs-classic.probe.ts` is
  **declined** — its subject is the `totalOutput` "before" row and the registry
  is intact at 60/60.
- **M25 §1 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).** Premise held at every site, and the
  scoping did not. Nine `zenith.ts` definitions now cite §1 — including
  `calculateTaskParams`, the site the lead missed, which assembles the whole map
  and applies the cap — and §1 gained the back-references its own registry policy
  asks for (`curve-marginal-facts.probe.ts` for the cap, `zenith.test.ts` for the
  maps). The per-field comments, `amplitudeRatio` and the `UserConstants` fields
  stay uncited, this file's idiom; `DEFAULT_SWITCH_COST` is uncited too but is
  §4/§14, out of scope. Two corrections: §1 was **already cited six times**
  elsewhere in the repo, so the map was uncited at its definitions rather than
  un-findable, and **no rule was broken** — R7's citation clause fires on a
  change to a formula, constant, bound or fit, and every one of these sites
  predates it. At `AMPLITUDE_RATIO_CAP` the citation **replaced** a near-verbatim
  restatement of §1's paragraph rather than sitting on top of it (AGENTS.md:62,
  not the restatement clause at :61 the lead reached for).
- **M26 §8.7 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).** Half upheld, and the wrong half was
  the fix. The §8.8 citation is not incomplete but plainly wrong — §8.8 is the
  45-minute plan lattice and fits nothing, and the form's 1-minute input is
  deliberately off that lattice — so both sites now read §8.7 and the payload
  docblock mirrors `rest-log-form`'s units sentence. The other half is
  **refuted**: §8.7's `d/10 = 1 − C(H)` reading is cited from four places, and
  the form does not implement it — it collects minutes and two raw 0–10 ratings,
  and the `/10` map lives downstream in `energy-calibration`. The second site
  (`drain-log-form.stories.svelte`) is one the lead did not name; landing either
  alone would have left the two files disagreeing.
- **M27 §22 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).** The exhaustive
  121-pair enumeration upholds the four moved pairs and both balanced rates
  (49/121 = 40.5% → 45/121 = 37.2%, and 44/100 over 1–10 either way). "22 of
  121" holds only against the ±3 gap ALONE: against the rule as shipped the
  demand-share alternative disagrees on **18**, because it reaches the zero
  gate's verdict on all four pairs the gate moved. §22 now says which rule each
  count is measured against, and `calculation.test.ts` pins the 45.
- **M28 §18 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).** Upheld to every digit:
  `session-row-truncation.probe.ts` reads 0.6669 / 1.0986 / 0.3716 through the
  shipped `adviseStop` at the shipped defaults, the `continue` → `stop` flip
  reproduces, and the two-row day prices identically to one 4.5 h row. Two things
  execution added. The example **understates** the defect — every split of that
  day flips the verdict, 1.35× to 3.28× the true price, and the truncated reading
  is higher on all of 200 seeded slider-drawn tasks, flipping 66.5%. And §18's
  witness is **not app-reachable**: `toEnergyTask` reads w = (0.8, 0.2) off
  sliders 8/2, effective difficulty 8.6, where the 4.5 h day does not flip at all
  (`continue` at 0.562/h) — so the section demonstrated its headline flip at
  demands the app cannot produce. It flips at difficulty 7 with w = (0.7, 0), and
  that is what the suite now pins. Same class as M35, one section over.
- **M29 §34 — closed 2026-08-19, [`what-the-bounded-path-actually-ran-on`](docs/features/what-the-bounded-path-actually-ran-on.md).** The figure was never
  wrong — 1587/6400 = **24.80%**, which is "about a quarter". The hole was
  emission: `boundedSearchRuns` was called only inside the violation push, so
  nothing in the repo could print the share. The monotonicity arm now hoists it
  and writes `bounded` / `boundedShare`. The per-n and per-switchCost splits are
  **declined** — artifacts of the sweep's uniform grid, not of days the app
  produces, and quoting eight of them to two decimals would close one provenance
  hole by opening six.
- **M30 §7 — closed 2026-08-19, [`what-the-bounded-path-actually-ran-on`](docs/features/what-the-bounded-path-actually-ran-on.md).** Both crossovers hold to the
  quarter-hour and a new arm now emits them. The lead missed the actual defect
  one sentence later: the causal clause was **false**. A one-hour day needs
  n = 30 at `switchCost` 0.1 and n = 91 at 0.25 and above, so the after-table's
  ≤ 2 h shortfalls are the low-switch-cost corner instead. Execution also found
  that `zenith.test.ts:699-748` is not the backstop it reads as — its sole
  assertion is budget monotonicity, and running its own 14 days to 10 h at every
  switch cost gives zero violations, so its 3.75 h ceiling detects nothing.
- **M31 §8.2 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).** Upheld: no committed probe reaches
  either figure. Both reproduce out of the shipped evaluator — **84.648%** and
  **1.832%**, agreeing with `e^(−g/τ)` to 4e-8 — and are pinned by fixture, not
  by a probe, because a closed form has nothing to sweep. The lead's own hedge
  was backwards: that probe's header **claimed** §8.1–8.2 scope its arms never had
  (it only _disables_ both to build its pre-fix arm), so the header was the defect
  and its `PROBES.md` row was right all along — the header now matches the row. The
  audit's standing failure was trusting the registry over the probe body; this is
  the inverse, which means neither side is the authority on its own.
- **M32 §11.5 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).** All three cells and all three
  guards hold. **Refuted on coverage**: the fixture this lead asks for already
  existed (`calculation.test.ts`, dated to the 2026-07-18 redefinition), so what
  was missing was the citation and not the test — the lead read one as the other.
  Its judgement was still right, and no row was added: closed form gets a fixture
  citation, which is now what the registry header says. Two real gaps underneath,
  both found by mutating the shipped source: every assertion passed `0.25` as a
  literal, so `DEFAULT_SWITCH_COST` could move without going red, and the
  no-budget guard was pinned on a 0-hour task, where the nothing-funded guard
  answers first. Three guards claimed, two pinned.
- **M33 §8.12** — the shipped pseudocode at `MATH.md:2033` defines
  `recommendedHours` as null "when that is W", the horizon; the code nulls on the
  last budget of the lattice instead (`zenith-energy.ts:1364-1372`,
  `knee < last.budgetHours - 1e-9`, and `:1338`). The two coincide only when the
  lattice ends exactly at the horizon.
- **M34 §8.12** — `MATH.md:2054-2056` says the pre-fix days that "recommended a
  45-minute day booking 0 h of work" are counted at each λ₀ in
  `curve-shape.probe.ts`. The probe's only measurement is
  `if (curve.points.every((p) => p.workHours === 0)) noWork++` (`:262`); the
  sentinel knee it names is asserted in a comment (`:242-246`), not
  reconstructed, though the RAW arm at `:111` shows the probe knows how to.
- **M35 §8.12** — the §8.11 agreement witness at `MATH.md:2169-2173` (one task
  P0/M8/E9, 6 h, λ₀ = 1.2, curve 3 h, advisor flipping at 3 h logged) is run at
  `alphaCog: 0.25, alphaPhys: 0.35, recoveryRate: 1`
  (`advisor-curve-agreement.probe.ts:38-49`), which are not the defaults at
  `zenith-energy.ts:138-143`; the doc does not say so. A skeptic **refuted the
  drift framing** of this — the numbers reproduce — so what is left is that the
  section states a witness without its constants.
- **M36 §8.12 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).** Filed as the cheapest fix on this
  list and **partially refuted**: the citation gap was real and the "not a
  measurement gap" was wrong. `budget-knee.probe.ts` does print the sentence
  verbatim, but re-running it gives **17 of 5040 (0.3%)** against the quoted 22
  (0.4%), and the same run puts `kneeC`'s interior count at λ₀ = 1.0 at
  **24/40**, not 25 — a figure no finding had named. The worst dip is unmoved.
  The probe is untouched since 28e2e16 (2026-08-08) and the allocator moved on
  2026-08-13, so the numbers drifted for five days while a probe printed the
  truth and nothing cited it. Direction unaffected: fewer dips, none larger.
  **This is the entry that argues cheapness is the wrong ranking axis** — the two
  drifted figures in the whole batch were both in the lead filed as citation-only.

- **M37 §33** — the Energy Lab straddles the causal fit window.
  `energy-lab-store.svelte.ts` has no date filter: the α fits read
  `drainObservations` at `:569` and `:580` and the r fit reads
  `restObservations` at `:615`, all unfiltered, while only λ₀ goes through
  `readStopObservations(this.#session.today)` at `:200-201` — against §33's
  rule that today's 🪫 stops moving the plan. Raised 2026-08-19 by the probe
  sweep and confirmed by reading, but **not a doc edit**: it needs a ruling on
  whether the Lab is "a plan for day D" at all, or a calibration surface that
  should see every log the moment it lands. The only candidate wrong _shipped
  behaviour_ either audit round turned up.
- **M38 §8.10** — the reconstruction's bracket inverts on a day it then keeps,
  and the docblock's tolerance is the casualty. At true λ₀ = 0.9 over a 12 h
  window `stp-stopping-identifiability.probe.ts` reads `lo` 0.7001 above `hi`
  0.6637, so the bracket excludes truth by 0.236 and its midpoint enters the fit
  0.218 low — against the "midpoints track it within ~0.13" that
  `zenith-energy.ts:1905-1906` states as the reconstruction's contract. The day
  is **not** censored: the inversion gap is 0.036, inside
  `STOP_INVERSION_MARGIN` = 0.25, so it is kept as a biased point estimate
  rather than dropped. The same cell kills the other half of §8.10's
  feasibility-2 paragraph — the V_T sweep at (12 h, λ₀ = 0.9) walks 9 / 8.25 /
  7.5, monotone non-increasing over a span of 2 steps, where the paragraph says
  "through three levels non-monotonically". Awaiting a ruling and **held out of
  the round's edits on purpose**: whether the margin should censor an inversion
  this size, or the contract should be restated, is a code question, and
  "correcting" ~0.13 to 0.218 in the document would write the defect down as the
  design. Unlike M14–M36, this one was **found by measurement** — the probe was
  run, not read — so the "nothing below was executed" note above does not cover
  it.

  **Measured twice since, independently, and both times "shipped defect"
  (2026-08-19). Every figure below is scratch — no committed instrument
  reproduces any of them, so item 29's rule still applies:**

  - **The published cell is not app-reachable, so the witness above is a grid
    artifact.** Its t2 (mental 4, physical 3) declares difficulty 6 where
    `toEnergyTask` gives 4.90, and t3 needs a physical slider of 0.5. Legalising
    the same demands removes the inversion entirely: 12 h reads 1.017, inside
    tolerance.
  - **The phenomenon is reachable.** A fully app-legal witness, built through the
    app's own mappers and the app's own optimizer plan — tasks {mental 8,
    physical 3, enjoyment 8} and {mental 0, physical 3, enjoyment 2}, 14 h
    window, true λ₀ 0.7, plan t1 7.5 h — reads 0.407 with `lo` 0.469 above `hi`
    0.345, gap 0.124, inverted and KEPT, error −0.293. Three more witnesses at
    −0.322, −0.141, −0.210.
  - **The mechanism is BREAK OMISSION, not the canonical reorder.** Re-bracketing
    on the real block order barely moves the error (mean |err| 0.108 against
    0.104 canonical), while keeping the breaks fixes every witness. 48.3% of the
    app's own plans carry an interior rest break, and |err| > 0.13 on 42.3% of
    those against 3.8% of break-free plans. §8.10's "absorbed as noise" is the
    sentence that does not survive, and the bias is one-signed — the fit reads
    LOW.
  - **The real failure is CONTAINMENT, not inversion.** The bracket excludes the
    true λ₀ on roughly a third of app-legal days (34.2% of 427 in one arm, 32–49%
    across arms), p90 0.251, max 0.470 — and no censor flags any of them. That is
    the first half of the same `zenith-energy.ts:1905-1906` sentence, not the
    tolerance half. The 9-cell grid was too SMALL, not only off-surface.
  - **The margin cannot be the fix.** The documented gap sits 6.9× inside it,
    halving it to 0.1 still keeps both witnesses, and raising it censors more days
    while §8.10's own margin sweep says censoring buys the fit nothing.
  - **What the error costs.** A −0.2 λ₀ error moves the plan's worked hours on
    64.4% of plans (mean 2.48 lattice steps) and flips the live advisor's verdict
    on 77.1% of days; a repeating-day user at true 0.7 fits 0.414 ± 0.035, so the
    posterior std printed beside it understates the error 8×. The population mean
    signed error nearly cancels (+0.020 / −0.006), which is why a mean-based check
    would have closed this wrongly.

  The V_T half of this entry is superseded by M41, which measures the same claim
  over app-legal days.

  **CLOSED 2026-08-19 — the ruling was "keep the breaks in the reconstruction,
  fix the cause" and it shipped** (MATH.md §8.10, §8.11, §18 and §10's
  2026-08-19 entry). `readFinishedDays` stopped summing the 🪫 rows by
  `(date, taskId)`, so each row's own `createdAt` reaches the estimator and the
  breaks between sessions are read rather than discarded; a day with no usable
  moment, or one logged in a single batch, falls back bit-identically to the old
  reading. Measured through the shipped function over 436 optimizer-funded days
  drawn from integer sliders **at λ₀ {0.5, 0.7, 0.9, 1.1}**: |err| mean
  0.106 → 0.065, past the bracket half-width 28.3% → 7.9%, the witness
  −0.293 → +0.030 with its bracket un-inverted, a repeating-day user
  0.415 → 0.709. That grid is the scope, and it was the narrow half of the Lab's
  own λ₀ range: widened to 0.1 … 1.1 on 2026-08-19 the same probe reads
  0.123 → 0.086 and 35.1% → 16.3% over 676 cells, with the residual concentrated
  at the low end (MATH.md §8.10, and M42 for what is left of it). The margin was
  NOT touched and no day was censored to achieve it. Two of this entry's own figures are
  superseded by the committed instrument: 48.3% of plans carrying a break reads
  63.5% on the slider-drawn population, and "the fit reads LOW" is now +0.032
  signed rather than negative.

- **M39 §8.11** — `adviseStop` runs the same reconstruction with no inversion
  censor at all, so `STOP_INVERSION_MARGIN` guards the retrospective fit only and
  the in-day path is unguarded. Reachable by construction. Same shape as M38: a
  code question, not a doc edit. **Half-closed 2026-08-19**: the unguarded path
  is why the advisor was the more exposed reading, and M38's fix removes the bias
  it was exposed to — measured, the session arm's mid-day false stops fall to
  under 1% at every λ₀ and the warm-up fixture's at-stop agreement at λ₀ = 0.9
  goes 1/13 → 11/13 (MATH.md §8.11). Whether the advisor should ALSO carry a
  censor is untouched and still open.
- **M40 §8.10** — three committed probe generators are off the app's constraint
  surface, so no day they generate is slider-reachable.
  `stop-inversion-margin.probe.ts:237` and `stop-margin-fit-error.probe.ts:232`
  build tasks with `difficulty = Math.max(mental, physical)`, skipping
  `DIFFICULTY_SPILLOVER = 0.3`; `stp-stopping-identifiability.probe.ts`'s standard
  day declares its difficulties outright (t2 at 6 where `getEffectiveDifficulty`
  gives 4.90) and hands t3 a 0.05 physical demand, which is a slider of 0.5.
  Every §8.10 population figure resting on them — the 39% inversion rate, 4/315,
  44/1179, the median 0.110 half-width — is therefore unquotable in either
  direction until the generators use `getEffectiveDifficulty`. This is the M28
  class (a witness at demands the app cannot produce), now found in three
  instruments rather than one section. **Half-closed 2026-08-19**: M38's fix
  committed `scripts/stop-block-structure.probe.ts`, which draws every task
  through `toEnergyTask` from integer sliders, so §8.10 finally has an on-surface
  instrument and its headline error figures come from that one. The three
  generators above are UNCHANGED and their figures were re-read on the same
  off-surface days, so this caveat still attaches to every number they back —
  fixing them is its own change, and it moves that whole set again.
- **M41 §8.10** — the V_T non-monotonicity claim is UNDERSTATED, not merely
  mis-witnessed: over the UI's own V_T range on app-legal days, 18 of 200 cells
  are non-monotone with up to 5 levels and a 4-step span, while §8.10 claims three
  levels and `zenith-energy.ts:2349-2350` says "two lattice levels" (scratch,
  2026-08-19; the citation was `:2188-2189` before the 2026-08-19 model change
  moved it). Inside the §8.10 hold — filed, with the text left alone.
- **M42 §8.10 — the residual after M38's fix is one-signed HIGH, and censoring it
  is a data-versus-accuracy call the maintainer makes.** Not a doc defect: §8.10
  now states this size, and this entry is the POLICY question it deliberately does
  not answer. Such a day ran out of wall clock,
  but `total` reads WORKED hours (§8.11, pinned), so the window-edge censor never
  fires and the day enters the fit as a voluntary stop; its `lo` sits at the truth
  (mean −0.016) while `hi` sits +0.264 above it, and the midpoint lands halfway up.
  **The trade, measured** (scratch, 2026-08-19, 120 slider-drawn days × λ₀ 0.1 …
  1.1, the bracket rebuilt from exported parts and validated against
  `stopIndifferencePoint` on every day): censoring the class takes the bracket's
  containment failure **13.8% → 4.0%** —
  it holds 48 of the 61 failures, 47 of them HIGH — at the cost of **25.4% of the
  fit's priced days** (112 of 441; 17.6% over the {0.5 … 1.1} scope, consistent
  with the 19% §8.10 and §8.11 already quote). **The interesting part is the
  SIGN**: the bias this round fixed read LOW, and what is left reads HIGH, so the
  two do not stack and a mean-based check over both would cancel them — the same
  failure mode that let "absorbed as noise" survive. Ruling needed on whether the
  window censor should read the day's recovered extent instead of its worked
  hours, which is a code question and would move §8.11's `window-full` copy with
  it; nothing here says which way. Do not quote these numbers as a result until a
  committed instrument prints them (item 29's rule).

**What the sweep got wrong, worth knowing before trusting the leads.** Fifteen of
the 37 died under refutation, and they died in one direction: an auditor reading
`scripts/PROBES.md` as the authority on what a probe covers, rather than the
probe. A registry row names a section, not every claim inside it, and several
probes reach claims filed under a heading they do not name. Search the probe
bodies before believing an "unbacked" — M22 is the case worth studying, because
the same figure was filed as unbacked by one lens and as stale by another, the
unbacked framing was refuted, and only the stale one is real.

The partition failed once. The thirteen ranges left §8.12 (`MATH.md:2001-2192`,
sole owner of four registry probes) unread until the completeness pass caught it;
M22 and M33–M36 come from a second three-lens pass over that section alone, which
is why §8.12 is the only section here audited by lens rather than by range. That
pass upheld 1 of 6 against 13 of 32 for the main sweep — a ratio worth reading as
the cost of the wider sweep's shallower reading, not as §8.12 being cleaner.

**Registry holes found alongside the above** — §18, §22, §11.5 and §8.2 carried
quantitative claims with no row in `scripts/PROBES.md`, none of which
`node scripts/probe-registry.mjs --check` can see, because it checks that rows
and files pair up and not that a section has a row at all. **All four closed
2026-08-18** ([`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md)), and only two by adding a row:
§22 got `mtr-task-nature.probe.ts` and §18 got `session-row-truncation.probe.ts`,
while §8.2 and §11.5 are closed form and were never registry holes at all — they
cite a suite fixture, because a row with no probe file fails that same check. The
registry's own definition counted a fixture-cited number as unbacked and no
longer does, which
is the durable half of this: the hole was in the rule, not only in the table.
