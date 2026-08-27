# Roadmap

What is next and what was refused. The math behind every item lives in
[MATH.md](MATH.md). Settled decisions are in AGENTS.md §4's decision index —
notably the three roads deliberately not taken: the energy model stays a peer
mode, never a replacement (MATH.md §15), run order stays the nature-alternation
heuristic (§16), and ϕ stays one plane for all tasks (§17). Do not re-open those
here.

Phases are priority order. Item numbers and finding ids are stable and cited
from elsewhere (MATH.md §14.2 cites item 3, the suite cites M44), so they are
never reused; phase numbers are not cited and were re-cut on 2026-08-04 when
items 11–23 were added. Update this file when an item ships or is rejected.

**A shipped item or a closed finding collapses to its date and a link.** What
was decided, what was rejected and what the review caught go to
`docs/features/<slug>.md`, frozen at land — a finding that closes without a
feature of its own still gets one, or its record is only in this file and this
file grows. An entry here never describes how the code works today: that is
MATH.md and the area `AGENTS.md`, and a claim about current behaviour written
here is the one that rots (2026-08-13 sweep: 14 of 161). Collapsing was skipped
often enough that on 2026-08-21 the file was 1650 lines, half of them closed
records; six of those became the feature files they should have had at land.

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

- **Every calibration instrument lived behind `/energy`** — closed 2026-08-10
  by item 11, which put `logDrain` on the main page too. The `readFinishedDays`
  half stands: a day reaches λ₀ (§8.10), the §12 audit and overnight carry-over
  (§11.9) only through a 🪫 log with `hours > 0`.

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

1. ~~**Live stop advisor**~~ — SHIPPED 2026-08-03 (MATH.md §8.11).
2. ~~**Interactive budget slider**~~ — SHIPPED 2026-08-03. Plan advice
   deliberately does not follow the drag (MATH.md §14).
3. ~~**Marginal-of-budget diagnostic**~~ — SHIPPED 2026-08-03 (MATH.md §14.2).
   Stayed a day-level reading: a per-task marginal column prices no lever the
   user owns, and the "marginals equalize at the optimum" reason planned for it
   was measured false (§14.2).

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

13. ~~**"You are here" on the run order**~~ — SHIPPED 2026-08-10 (MATH.md §35),
    which also records the caveat left unfixed: the alternation has no memory of
    what was just worked, and conditioning position 1 on the last session is a
    change to §16's heuristic, not a patch.

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
    item 11 in practice. The per-day prefill slot it requires now exists (item 32) — this item replaces the source of the pool prefill, not its wiring.

Item 16 for the other two declared constraints, and the slot item 18 prefills
into:

32. ~~**Constraint carry-over for unseen days**~~ — SHIPPED 2026-08-24.
    [docs/features/constraint-carry-over-for-unseen-days.md](docs/features/constraint-carry-over-for-unseen-days.md)

Item 15 shipped as one feature with the item below, which is how its ratings
reach the form at all:

24. ~~**Title suggestions as you type**~~ — SHIPPED 2026-08-05.
    [docs/features/title-suggestions-as-you-type.md](docs/features/title-suggestions-as-you-type.md)

## Phase 3 — calibration trust

4. ~~**Censored-likelihood stopping fit**~~ — DECIDED AGAINST 2026-08-21, built
   and measured first.
   [docs/features/censored-stopping-fit.md](docs/features/censored-stopping-fit.md),
   MATH.md §8.10, `scripts/censored-stopping-fit.probe.ts`. **This item's own
   sentence was wrong on two of its three categories** and read
   "worked-to-edge, zero-work and inverted days currently drop out of the §8.10
   fit; a one-sided likelihood term would use them": zero-work days never reach
   the fit at all (`readFinishedDays` skips a log with `hours <= 0`, so such a day
   is not an observation) and inverted-past-margin days stay dropped on purpose
   (§8.10, item 28). The three reachable categories are worked-to-the-window-edge,
   every-task-completed and sliver-only.
   The Tobit-style term was implemented and scored against the shipped fit over 90
   seeded users × 12 days at true λ₀ ∈ {0.3 … 1.3}. Figures re-read 2026-08-25 on
   the app's constraint surface (M40 below); the run that decided it was
   off-surface, and MATH.md §8.10 carries all three readings. It gains **0.0403**
   λ₀ RMSE at best on the mixed cell — 36.7% of the 0.110 bracket half-width the
   gate was set at — while raising the used share from 52.7% to 80.9% of days.
   **The category that motivated the item is worse alone:** all-completed days
   move RMSE 0.1040 → 0.1302 at n = 12 (bias −0.014 → −0.113), because their
   `λ₀ ≤ hi` is almost never violated (0.3%) but sits far above the truth —
   ordinary is not informative. A sliver day's `λ₀ ≥ lo` is violated **100%** of
   the time: a sub-step day is an interruption, not a leisure choice. The refusal
   survived every re-reading and the on-surface gain is the smallest of them, so
   nothing here is a near miss.
   What shipped is the instrument and one export: `stopBracket`, the two sides the
   midpoint used to hide, so a probe can read them instead of rebuilding the
   bracket the way the three existing stop probes still do. Re-open only
   with a bound that is TIGHTER, not merely more numerous — the pre-2026-08-21
   sizing (the fifth category is 8.0% / 37.8% / 72.0% of all dropped days at
   completion rates 0.25 / 0.50 / 0.75) counted days, and days were never the
   binding constraint.

   **One obligation outlives the closure, and it is not the censored likelihood**
   (recorded here by MATH.md §8.10's break-reading correction, 2026-08-19): a
   batch-logged day reads its breaks as nothing and degrades to the
   pre-2026-08-19 numbers, and `usedCount` cannot tell a structure-recovered day
   from a collapsed one. The cheap honest version is to count structure-recovered
   days and show that count on the Stopping Calibration card — a copy decision in
   five locales, still not built.

5. ~~**Fit-snapshot persistence**~~ — SHIPPED 2026-08-03 (MATH.md §12.1).
   Recomputing each day's fit instead was rejected on cost, not correctness — it
   would fix history retroactively but costs a whole-history fit per audited day
   (19 ms/day, 570 ms per 30-day audit), so it grows with everything the user
   ever logs. The accepted cost is that the correction only accrues forward.
6. ~~**Per-task ϕ offsets**~~ — REJECTED 2026-08-04 (MATH.md §17,
   `business/model/AGENTS.md`). Offsets move blocks, not value: +0.09% of plan
   value at a plausible 0.3 h spread, against a true-ϕ oracle worth +0.16%.
   Re-open only on real logs with `Σδ̂²` above the 0.25 h noise floor **and** a
   habitually ≤2 h budget.

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
    allocation-precision claim. MATH.md: a note on the scoring convention in §5.
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

26. **Round-2 probes for the unbacked `MATH.md` claims** — DONE 2026-08-06. All
    four targets built plus a fifth found while doing them
    (`fit-snapshot-drift`, `satiety-gaming`, `stop-inversion-margin`,
    `phi-error-price`, `allocator-exactness`); each carries a dated
    back-reference in `MATH.md`, a row in `scripts/PROBES.md` and one suite
    fixture, which is where its numbers live.

27. ~~**§8.6's missing off-midpoint rest split**~~ — SHIPPED 2026-08-13 (MATH.md §8.6).
    [docs/features/off-midpoint-rest-split.md](docs/features/off-midpoint-rest-split.md)
28. ~~**Re-derive `STOP_INVERSION_MARGIN` from measured distributions**~~ — SHIPPED 2026-08-13 (MATH.md §8.10).
    [docs/features/stop-inversion-margin-rederived.md](docs/features/stop-inversion-margin-rederived.md)

29. **Round-3: what the 2026-08-06 agent sweep found and nobody built** — five
    agents swept disjoint `MATH.md` ranges to pick item 26's targets and
    surfaced more than the five that got probes; this was the residue. Three
    entries rested on a counterexample from a scratch probe nobody committed,
    which is item 26's own failure mode one level up. **The rule this item is
    cited for: do not quote a number as a result until a committed instrument
    prints it.** (b)–(f) were settled by the 2026-08-06 `MATH.md` claim audit,
    (a) on 2026-08-13 (MATH.md §11.9, which records the one alternative it left
    open — seeding carry-over from the WORST order rather than the logged one, a
    call about what the number means and not another probe) and (h) with item 27.
    Each settled entry has a committed probe and a corrected section. The residue
    is (g).
    (g) **§12's ±0.05 adherence verdict band has no noise model** — §12 says so
    outright ("no noise model") while printing one English verdict decided by
    that constant. Nothing shows it is wide enough to stop week-to-week flipping
    or narrow enough to ever name a planner.

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
    over §0–§36, every claim checked three ways (cited from the code, backed by a
    committed probe, formula still matching), each finding then handed to a
    skeptic told to refute it, plus a second three-lens pass over §8.12 that the
    first partition had left unread. **37 raised, 14 upheld**, ids M1–M36 in the
    findings section below, and **all fourteen upheld findings are closed.** It
    was a reading, not a measurement, and executing it is what corrected it:
    claims were wrong by 3.5× and ~10×, one measured outright false (§14.4's
    "roughly a third"), two number-sets cited probe files that were never
    committed, and closing the findings turned up defects no finding had named.
    The second batch also killed ranking by effort — four of its five cheap leads
    were mis-scoped, and both figures that had actually drifted sat in the one
    filed as a citation gap.

Item 4's outstanding obligation is the Stopping Calibration card learning to
explain its own count; the analytics card has the same gap on a different
number:

33. **The "Your model" card names deferred logs for ϕ only** — raised
    2026-08-25 while closing M23, verified in the code, not measured. The §33
    causal window defers today's logs on all four legs, but only ϕ reports how
    many: `pendingCount` is computed at `session-history.ts:137`
    (`observations.length - counted.length`) and surfaced at `:463`, and the
    energy (r, α_cog, α_phys) and stopping (λ₀) legs carry no equivalent — they
    print `usedCount` alone. So a user who logs a ☕ or a 🪫 today watches the
    count sit still with nothing on screen saying the log was read and held for
    tomorrow, which reads as a dropped log rather than a deferred one. This is
    the gap M37 closed for the Energy Lab's two calibration cards, still open on
    the analytics card. Cost is a count per leg plus copy in five locales (en,
    de, es, fr, zh).

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

8. ~~**Priced defer destination**~~ — SUPERSEDED 2026-08-04 by item 21.

What survives of the multi-day idea is two readings, not a solver:

21. ~~**Destination preview for a defer**~~ — SHIPPED 2026-08-12 (MATH.md §14).
    [docs/features/defer-destination-preview.md](docs/features/defer-destination-preview.md)
22. ~~**Chronic-slide badge**~~ — SHIPPED 2026-08-21.
    [docs/features/chronic-slide-badge.md](docs/features/chronic-slide-badge.md)

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
  backup bump) for no plan-value number. **Built 2026-08-22 anyway, on the one
  clause this never priced**: it costed recall ACCURACY, not how often a 🪫 log
  gets written at all, and λ₀ (§8.10), the §12 audit and §11.9 carry-over reach a
  day only through one. The quoted cost turned out avoidable and no plan-value
  number is claimed —
  [the-session-nobody-was-timing.md](docs/features/the-session-nobody-was-timing.md).
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
  user-editable (`day-constraints-bar.svelte:151-183`). A sleep slider is a
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

## Findings from the 2026-08-14 `MATH.md` audit

Item 31's list. The **M** ids are stable and never reused. M1–M13 and M22 were
each handed to a skeptic told to refute them and survived; **M14–M21 and M23–M54
were raised and not verified** — the open ones are leads, and item 29's rule
applies, so quote none of them as a result until its own check is run. M37 and
later came from probe sweeps and later reviews rather than from the 2026-08-14
audit and carry the same rule.

**Every `MATH.md:NNNN` below is as of the date its entry carries and most have
since drifted**, some by hundreds of lines. Grep the quoted text, not the line:
each lead has to be re-located when its own check is run anyway, and re-guessed
line numbers would read as verified when only the quoted text is. That drift is
what M1, M3 and M11 each found in `MATH.md`'s own citations.

**No open lead below was executed.** The audit read `MATH.md`, the code and the
probe sources; it ran no probe, no test and no solve, so every figure in an open
entry is transcribed rather than reproduced. "Unbacked" means no committed probe
reaches the claim, never that the claim is false.

- **M1 §34 — fixed 2026-08-14,
  [`subset-size-bound-under-a-prefix`](docs/features/subset-size-bound-under-a-prefix.md).**
- **M2 §21.4 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
- **M3 §11.11 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
- **M4 §2 — fixed 2026-08-14,
  [`three-explanations-the-code-outgrew`](docs/features/three-explanations-the-code-outgrew.md).**
- **M5 §8.9 — fixed 2026-08-14,
  [`three-explanations-the-code-outgrew`](docs/features/three-explanations-the-code-outgrew.md).**
- **M6 §2 — fixed 2026-08-14,
  [`three-explanations-the-code-outgrew`](docs/features/three-explanations-the-code-outgrew.md).**
- **M7 §19.4 — closed 2026-08-17,
  [`what-still-reaches-the-gain-cap`](docs/features/what-still-reaches-the-gain-cap.md).**
- **M8 §19.3 — closed 2026-08-17,
  [`what-the-rotation-baseline-costs`](docs/features/what-the-rotation-baseline-costs.md).**
- **M9 §14 — closed 2026-08-17,
  [`what-the-advisor-actually-costs`](docs/features/what-the-advisor-actually-costs.md).**
- **M10 §14.3 — closed 2026-08-17,
  [`what-the-advisor-actually-costs`](docs/features/what-the-advisor-actually-costs.md).**
- **M11 §13.6 — closed 2026-08-18,
  [`what-the-lab-tile-was-measured-with`](docs/features/what-the-lab-tile-was-measured-with.md).**
- **M12 §8.10 — closed 2026-08-17,
  [`what-the-open-task-scope-is-worth`](docs/features/what-the-open-task-scope-is-worth.md).**
- **M13 §8.2 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
- **M14 §3 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).**
- **M15 §5 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).**
- **M16 §5.2 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).**
- **M17 §13.4 — closed 2026-08-27, not fixed,
  [`the-third-site-deleted-with-its-section`](docs/features/the-third-site-deleted-with-its-section.md).**
  Raised against the retracted "0.65 appended-last against 0.37 inserted-first"
  quoted as live fact in three places. Two were fixed 2026-08-19
  ([`what-the-retracted-step-still-said`](docs/features/what-the-retracted-step-still-said.md));
  the third — §8.10's feasibility-2 paragraph — was held with the reconstruction
  ruling. The hold was never lifted: `e61d207` (2026-08-25) cut MATH.md to
  derivations only, deleting §10–§37 and, with §13.4, both the retraction and
  the pair inside §8.10's paragraph. Verified across every tracked file: neither
  figure survives as live text, and the only quotes left are
  `rv13-stop-insertion.probe.ts:8,15`, which state the claim as the
  unreproducible record they measure against. What replaced the pair re-derives
  today — fixture day inserted **0.9135** vs appended **0.9112** (gap 0.0023),
  appending reads higher on 19.7% of 6,232 probes and shifts the indifference
  point on 552 of 2,258 two-sided days (worst 0.1964, 79% of the margin), and
  §8.11's "agree to four decimals" holds on every uncensored timed cell. This
  entry's prescription stays wrong and nothing was substituted from it.
- **M18 §28 / §31 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).**
- **M19 §28 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).**
- **M20 §32 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).**
- **M21 §16 — closed 2026-08-18, [`what-the-metric-sections-stopped-describing`](docs/features/what-the-metric-sections-stopped-describing.md).**
- **M22 §8.12 — fixed 2026-08-17,
  [`four-descriptions-the-code-moved-past`](docs/features/four-descriptions-the-code-moved-past.md).**
- **M23 §8.10 — closed 2026-08-25, MATH.md §10 (2026-08-25).** Doc-only; the
  record is the revision-log entry.
- **M24 §11.8 — closed 2026-08-19, [`what-the-output-tile-was-scored-against`](docs/features/what-the-output-tile-was-scored-against.md).**
- **M25 §1 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).**
- **M26 §8.7 — closed 2026-08-19, [`what-the-priority-score-actually-prints`](docs/features/what-the-priority-score-actually-prints.md).**
- **M27 §22 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).**
- **M28 §18 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).**
- **M29 §34 — closed 2026-08-19, [`what-the-bounded-path-actually-ran-on`](docs/features/what-the-bounded-path-actually-ran-on.md).**
- **M30 §7 — closed 2026-08-19, [`what-the-bounded-path-actually-ran-on`](docs/features/what-the-bounded-path-actually-ran-on.md).**
- **M31 §8.2 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).**
- **M32 §11.5 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).**
- **M33 §8.12 — closed 2026-08-26,
  [`the-cap-the-sweep-never-reached`](docs/features/the-cap-the-sweep-never-reached.md).**
- **M34 §8.12 — closed 2026-08-26,
  [`the-seeding-the-probe-never-re-ran`](docs/features/the-seeding-the-probe-never-re-ran.md).**
  The entry's `MATH.md` address died with the 2026-08-25 cut to derivations, and
  the claim it named survived only in comments. `curve-shape.probe.ts` now
  reconstructs the `-Infinity`-seeded level per λ₀ as a third arm: on all 215
  days whose level never leaves the do-nothing floor it names the first swept
  step booking 0 h, and on the other 265 it names the shipped knee. The claim
  held; nothing shipped moved.
- **M35 §8.12 — closed 2026-08-27,
  [`the-witness-that-outlived-its-section`](docs/features/the-witness-that-outlived-its-section.md).**
  The 2026-08-25 cut deleted the witness from §8.12 along with every other
  measurement, so the section no longer states it; the probe's off-default
  constants are now declared there instead. Re-run on 2026-08-27 and it holds.
- **M36 §8.12 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).**
- **M37 §33 — closed 2026-08-21, [`the-lab-fit-that-read-todays-logs`](docs/features/the-lab-fit-that-read-todays-logs.md).**
- **M38 §8.10 — closed 2026-08-19, [`the-bracket-that-inverted-on-a-day-it-kept`](docs/features/the-bracket-that-inverted-on-a-day-it-kept.md).** Shipped as a model change (MATH.md §8.10, §8.11, §10); the residual it left is M42.
- **M39 §8.11 — closed 2026-08-27,
  [`the-censor-that-does-not-run-forward`](docs/features/the-censor-that-does-not-run-forward.md).**
  `adviseStop` runs the same reconstruction with no inversion censor at all, so
  `STOP_INVERSION_MARGIN` guards the retrospective fit only. **Half-closed
  2026-08-19**: M38's fix removed the bias the unguarded path was exposed to —
  mid-day false stops under 1% at every λ₀, the warm-up fixture's at-stop
  agreement at λ₀ = 0.9 going 1/13 → 11/13. What was left — whether the advisor
  should ALSO carry a censor — is now decided NO, on an argument and a
  measurement. The argument: `lo > hi` is a contradiction only where there is a
  stop to rationalize, and run forward it says merely that the best next step
  beats the best step already logged, which is when `continue` is RIGHT (MATH.md
  §8.11 now carries this in place of the bare sentence). The measurement: a
  third arm on slider-drawn days finds the inverted cell is 8.3–16.4% of the
  checkpoints the card speaks on and carries ZERO mid-day false stops at all
  four λ₀ on both populations — 0 of 118/110/88/23 random-day and 0 of
  16/17/27/16 warm-up, against 8 of 1,811 and 4 of 587 everywhere else — so the
  censor would silence 339 + 76 correct `continue`s and remove none that were
  wrong. The one residual, recorded not acted on: at the stop moment agreement
  on the inverted cell is 8/20 against 213/232, and censoring converts 8 right
  and 12 wrong verdicts into 20 silences without fixing the 12. Nothing shipped
  moved.
- **M49 §8.11 — raised and closed 2026-08-27 by M39,
  [`the-sweep-that-missed-two-generators`](docs/features/the-sweep-that-missed-two-generators.md).**
  `stop-advisor.probe.ts` held the sixth and seventh generators off the slider
  surface after M40's five — `randomDays`, drawing `difficulty` independently of
  the two demands, and the hand-written `WARMUP_HEAVY`, whose `difficulty: 9`
  beside demands `0.9/0.2` the sliders project to 9.6. Both back §8.11's shipped
  one-step-vs-session table and its candidate-filter arm, both quote rates, and
  neither declared itself. Both now draw through `toEnergyTask`; `WARMUP_HEAVY`
  was moved onto the surface rather than declared off it, because M48's
  extreme-may-stay-off exemption is for model-level bounds and this fixture
  witnesses app-level behaviour. **Every figure moved and no verdict did.** The
  session arm still beats the one-step arm at every λ₀ and by more — the two λ₀
  quoted in `adviseStop`'s docblock go 19.7% → 14.2% at 0.9 and 24.7% → 28.1% at
  1.3, against the session arm's 6.6% → 1.3% and 6.2% → 0.0% — at-stop agreement
  is still identical between the arms in all eight rows, the day's own breaks
  still beat the summed reading everywhere (M38's headline witness moving 1/13 →
  11/13 to 2/13 → 12/13), the candidate filter still helps in the same direction
  (its λ₀ = 0.3 at-stop row sharpening 15/18 → 18/18 to 6/15 → 15/15), and M39's
  censor verdict is unchanged. 0 replica mismatches throughout. Nothing shipped
  moved. The residue: M40's sweep grepped for one hand-built signature and this
  file escaped it, so seven may not be the count. That search ran the same day
  and answered it — M50 and M51 below.
- **M50 — raised and closed 2026-08-27 by the M49 residue,
  [`the-tenth-copy-of-a-day-declared-once`](docs/features/the-tenth-copy-of-a-day-declared-once.md).**
  The search replaced counting generators with checking the fault: every
  `EnergyTaskInput` the repo builds — 9 inline literals plus 113 call sites of
  the eight `task`/`makeTask` factories, matched by AST rather than by
  spelling — tested against the surface directly (demands a slider/10, enjoyment
  an integer 1–10, `difficulty` equal to what `getEffectiveDifficulty` derives
  from the two demands). **84 sit off the surface and 68 already declare it** —
  64 under the class declaration `docs/testing.md` gives
  `zenith-energy.test.ts`'s `makeTask` calls, four individually. Of the 16 left,
  ten are verbatim mirrors of suite fixtures that class covers, and exactly one
  is a WRONG number rather than an undeclared one: `plan-audit.test.ts` held a
  TENTH copy of the 2026-07-14 named day, still carrying the pre-slider
  `guitar 0.4/0.3` and `reading 0.5/0.05` — and `physicalDemand: 0.05` has no
  slider at all. The day has ten declarations; M44 aligned eight of the nine it
  should have and missed this one, the only copy outside a probe. The COUNT in
  `energy-search-gap.probe.ts` — deliberately unaligned "with the other nine
  declarations of this day" — was right all along; what was false was its
  presumption that those nine were aligned, and the fix makes the sentence true
  rather than correcting it. `zenith-energy.test.ts`'s guard ("no longer a
  second place for it to drift from") is scoped to that file and stays true; it
  is simply not the repo-wide claim it is easy to read as. Aligned; its nine
  tests pass unchanged, because they compare a plan against itself and quote
  nothing.
- **M51 — raised and closed 2026-08-27 by the M49 residue,
  [`the-pair-that-could-not-be-matched`](docs/features/the-pair-that-could-not-be-matched.md).**
  The same search's second residual, a declaration gap rather than a wrong
  number: `rv13-terminal-timing.probe.ts`'s `task()` pins `difficulty: 8` and
  swaps the demands 1/0 ↔ 0/1, where sliders 10/0 and 0/10 both derive
  difficulty 10. Its comment gave a reason ("matched across the pair") but not
  the surface sentence M48's rule asks for — and the record's own fixture spec,
  a pure-cognitive and a pure-physical task at MATCHED difficulty, is
  unreachable BY CONSTRUCTION, which is what the missing sentence had to say.
  Declared; nothing moved, all three arms still pass.
- **M52 — raised and closed 2026-08-27 while closing M17,
  [`the-rule-that-outlived-its-document`](docs/features/the-rule-that-outlived-its-document.md).**
  `e61d207` (2026-08-25) deleted the hand-dating rule — `docs/testing.md:302`,
  "the dating rule is gone with them"; `PROBES.md`, the probe's header "is the
  only home for a measured number" — and touched 44 files including `scripts/`
  while removing **zero** instances of the rule from the probes. **34 of the 64
  still told the reader "Whatever it prints belongs in MATH.md WITH ITS DATE",**
  four adding "an undated number in that document is unfalsifiable"; following
  that header today violates R7. The first count was 32: `adv2-budget-marginal`
  and `prefix-replan` wrap it as a clause rather than a paragraph, so only
  `WITH ITS DATE` — the phrase re-wrapping cannot hide — finds all 34. Deleted,
  nothing substituted (`AGENTS.md:62`), and `plan-advice`'s longer tail is not
  lost: `docs/testing.md:287-290` opens the probe rules with the same lesson.
  Fixed in the same pass: that file's own `§14.1-2` citation, dangling since
  §10–§37 went, which `math-citations.mjs` skips because its regex reads the
  trailing `-2` as a line range.
- **M53 — closed 2026-08-27,
  [`the-references-the-checker-could-not-see`](docs/features/the-references-the-checker-could-not-see.md).**
  Filed as a count of 27 in 19 files; scanning every `MATH.md` occurrence not
  followed by a `§` finds **54 in 24 files** — the filed number came from
  headers alone. Two are correct as written (`curve-marginal-facts`,
  `energy-search-gap`) and **every other one was stale**, in three kinds: a
  claim attributed to a deleted section, archaeology printed into a run log
  (`stop-inversion-margin` emitted "(MATH.md said zero until 2026-08-06)" beside
  its own numbers), and an M52 survivor — `sat-gate-floor` wraps the dating rule
  as "WITH THEIR DATE", which that sweep's `WITH ITS DATE` grep could not see.
  The same fault reached seven test and fixture comments outside the probes.
  Four headers carried the deleted document's FIGURES rather than their own and
  were re-run: `pool-allocator` (no envelope — five seeds spread 1.91%),
  `fit-snapshot-drift` (day-10 fit 52% high; 30-day refit 500.1 ms), and two
  that came back **different** — `rv13-prior-posterior` (the prior's σ_ϕ is 24.0%
  of ϕ̂, not 29%; the plan changes on 6.8% of days at n = 1, not 21.7%) and
  `rv13-naive-lattice` (the before-fix negative rate is a 3.8–7.8% band, not a
  rising 4% → 19% ladder). One dangling NUMBERED citation turned up on the way:
  `hedged-stop-band` cited "§4's own rule" for what makes a number unbacked; §4
  is the allocator. The rule went into `docs/testing.md` rather than a checker —
  `math-citations.mjs` resolves `§N` to a heading, never to what it still says.

- **M40 §8.10 + §8.4 — closed 2026-08-25,
  [`the-satiety-price-on-the-sliders`](docs/features/the-satiety-price-on-the-sliders.md).**
  `grep 'difficulty: Math.max' scripts/` is empty, which is the close condition
  this entry carried. The entry named three off-surface probe generators and
  there were **five**, found one at a time as each fix read the next probe: the
  identical hand-built `drawTask` had been copied around. All five now draw every
  task from integer sliders through `toEnergyTask`, and each fix re-read its own
  section from its own run rather than editing figures in place —
  `stop-block-structure` and `stop-inversion-margin` on 2026-08-19 with M38
  ([`the-bracket-that-inverted-on-a-day-it-kept`](docs/features/the-bracket-that-inverted-on-a-day-it-kept.md)),
  `stp-stopping-identifiability` on 2026-08-21 with M44
  ([`one-named-day-declared-once`](docs/features/one-named-day-declared-once.md)),
  `stop-margin-fit-error` on 2026-08-25
  ([`the-third-generator-off-the-sliders`](docs/features/the-third-generator-off-the-sliders.md)),
  `censored-stopping-fit` the same day
  ([`the-refusal-redrawn-on-the-sliders`](docs/features/the-refusal-redrawn-on-the-sliders.md)),
  and `satiety-gaming` last. **Every figure moved and no verdict did** — §8.10's
  headline error figures, its censored-likelihood refusal (item 4 above, which
  had a DECISION resting on the off-surface run) and §8.4's satiety price were
  all re-decided at their new levels. Two prose claims died on the way, both
  properties of the unreachable population rather than of the model: §8.10's
  endpoint contrast that said wider censors fit better, and §8.4's reversal
  between its two scoring scales. The residue is **M48**, which is a different
  fault: witnesses the app cannot produce that are deliberately unreachable and
  do not say so.
- **M41 §8.10 — closed 2026-08-21, [`one-named-day-declared-once`](docs/features/one-named-day-declared-once.md).**
- **M42 §8.10 — closed 2026-08-21, [`the-day-that-ran-out-of-clock`](docs/features/the-day-that-ran-out-of-clock.md).**
- **M43 — closed 2026-08-20, [`the-insertion-witness-re-read`](docs/features/the-insertion-witness-re-read.md).**
- **M44 — closed 2026-08-21, [`one-named-day-declared-once`](docs/features/one-named-day-declared-once.md).**
- **M45 — closed 2026-08-20, [`six-constants-the-suite-could-not-see-move`](docs/features/six-constants-the-suite-could-not-see-move.md).**
- **M46 — closed 2026-08-20, [`the-default-nobody-had-measured`](docs/features/the-default-nobody-had-measured.md).**
- **M47 §8.6 — closed 2026-08-27,
  [`the-cap-that-outlived-its-measurement`](docs/features/the-cap-that-outlived-its-measurement.md).**
  Raised against pair-seed cost prose no instrument printed. `e61d207`
  (2026-08-25) deleted the tables with §10–§37, leaving **six live sites quoting
  them** — including `src/lib/business/model/AGENTS.md`, a rules file whose "do
  not unbound it" rested on `12.5× / 13.1×`, and the constant's own docblock,
  which quoted a single absolute ratio the deleted source had instructed nobody
  to quote. `math-citations.mjs` passed all six: §8.6 still exists, only its
  contents moved. The blocker was overstated — `OptimizeOptions` already carries
  `stepHours` and `maxIterations` and **no product caller sets either**, so
  `pairSeedTasks` is a third instrument-only field, not an opened module.
  `energy-search-gap.probe.ts` now prices the cap: the pair seeds cost
  1.28×–2.40× the search without them, unbounded `C(n,2)` reaches 13.84× at 15
  tasks (4147 ms against 300), and over 400 seeded days the family beats no
  pairs on 4 (worst 0.395580) while `C(n,2)` beats the cap on **2** (worst
  0.208672). That last number is new: the deleted prose asserted three tasks
  were enough and had measured nothing wider. Residue is **M54**.
- **M54 — raised 2026-08-27, measured, NOT decided.** Both days M47's forfeit
  arm found are reached by `PAIR_SEED_TASKS = 4`, at `C(4,2)` = 6 pair seeds
  instead of 3. Weigh 0.208672 objective on 2 days in 400 against a wider seed
  family on a path `EnergyLabStore`'s `$derived`, `plan-audit.ts` and
  `suggestBudgetCurve`'s 16 solves all take — one more column on the cost arm
  prices it. The other direction is already on record: 3 → 2 costs 0.038620 over
  60 days
  ([`six-constants-the-suite-could-not-see-move`](docs/features/six-constants-the-suite-could-not-see-move.md)).
  A plan change, so it needs a decision, not a sweep.

- **M48 §8.1 — closed 2026-08-27,
  [`the-extreme-that-had-never-declared-itself`](docs/features/the-extreme-that-had-never-declared-itself.md).**
  The open question had an answer: the ϕ floor IS reachable (both difficulty
  sliders at 0 clamp to difficulty 1 and land on it), and the worst error over
  all 1,210 slider combinations is 5.001e-5 against `FAST_TASK`'s 5.561e-5 — so
  the extreme is conservative, measured pointwise rather than argued, and both
  witnesses now run in the probe. The rule landed in `docs/testing.md`.

**What the sweep got wrong, worth knowing before trusting the leads.** Fifteen of
the 37 died under refutation, and they died in one direction: an auditor reading
`scripts/PROBES.md` as the authority on what a probe covers, rather than the
probe. A registry row names a section, not every claim inside it, and several
probes reach claims filed under a heading they do not name. Search the probe
bodies before believing an "unbacked" — M22 is the case worth studying, because
the same figure was filed as unbacked by one lens and as stale by another, the
unbacked framing was refuted, and only the stale one is real.

The partition failed once. The thirteen ranges left §8.12 (`MATH.md:2005-2196`,
sole owner of four registry probes) unread until the completeness pass caught it;
M22 and M33–M36 come from a second three-lens pass over that section alone, which
is why §8.12 is the only section here audited by lens rather than by range. That
pass upheld 1 of 6 against 13 of 32 for the main sweep — a ratio worth reading as
the cost of the wider sweep's shallower reading, not as §8.12 being cleaner.

**Registry holes found alongside the above** — §18, §22, §11.5 and §8.2 carried
quantitative claims with no row in `scripts/PROBES.md`, which
`node scripts/probe-registry.mjs --check` cannot see because it checks that rows
and files pair up, not that a section has a row at all. **All four closed
2026-08-18**
([`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md)),
and the durable half is that §8.2 and §11.5 were never holes: the registry's own
definition counted a fixture-cited number as unbacked and no longer does.

## Findings from the 2026-08-20 rules eval

The harness in [eval/](eval/) measures whether an agent given a slice of this
brief follows it. Two of the three faults it has surfaced so far were in the
harness, not the rules, and the one real finding is about enforcement rather
than wording — the four worst-scoring rules were all reachable by a checker
nobody was running.

- ~~**A third of runs never ran the checks the rules name.**~~ Closed by
  `.claude/hooks/verify-before-finish.mjs`, a `Stop` hook that blocks finishing
  while prettier, eslint or the five doc scripts fail on the files the run
  changed.
- ~~**R2's placement half was enforced by nothing.**~~ Closed: an `await` or a
  `.then()` inside a `$effect` under `src/routes/**` or `presentation/**` is now
  `no-restricted-syntax`.
- ~~**`calendar/+page.svelte` holds the one `eslint-disable` for that rule, and
  it is a true positive.**~~ Closed 2026-08-20,
  [`what-the-extraction-was-worth`](docs/features/what-the-extraction-was-worth.md)
  — the one measured arm: 21% (SD 8) to 77% (SD 15) on the `none` condition, and
  8 of 8 runs added a spec where 8 of 8 had added none.

- **Do not trim the brief for tokens.** `targeted` (the owning docs only) scored
  no better than `monolith` (all nine) once within-cell variance was measured at
  SD 39 points, R8 scores 100% in every condition including no-rules-at-all, and
  the only literal duplication in the corpus is R8's five steps appearing twice.
  Size is not the problem; a properly powered condition comparison needs
  n = 60 runs per arm.

## Findings from the 2026-08-25 `SessionStore` review

A read-only review of [`session-store.svelte.ts`](src/lib/business/store/session-store.svelte.ts)
and its collaborators. The **S** ids are stable and never reused. Six findings
and one nit were raised; **S1, S2, S3 and S6 were upheld and closed on this
branch**, S4 and the nit were dropped, and S5 was dropped as stated but left a
real residue, which is the one open entry below.

Two of the six did not survive being checked against the code, and both failure
modes are worth knowing before trusting a review of this shape. **S4 asserted a
cost model nobody measured** — `flowMinutesOn` was called "per rendered row",
where both screens call it once inside a `$derived`. **S5 reported a settled
decision as a defect** without reading the rules file that settles it, and the
fix was written and landed before the contradiction surfaced; it had to be
reverted. A finding that says a convention is violated has to name where the
convention is written, because the exception is usually written in the same
place.

- ~~**S1 — the past-day invariant was asserted in a comment and enforced in
  three of seven writers.**~~ Closed: one `#canEditPlan` getter, refused from
  `addTask`, `updateTask`, `removeTask` and `importTasks`.
- ~~**S2 — `logFlow` was the one direct write without the mid-navigation
  guard.**~~ Closed: a ⚡ submit landing between a date change and the load
  stamped the new date with the old day's task, title and covariates.
- ~~**S3 — `retryLoad` re-ran the whole boot unserialized and with no loading
  state.**~~ Closed: `#booting`, and `isLoading` back to true while it runs.
- ~~**S6 — archaeology comments §0 bans.**~~ Closed by deletion; the
  `nextTaskId` paragraph moved to the rules file that owns the decision.

- **Pool absence does not survive a rewrite.** The residue of S5. A stored day
  with no pool fields loads with the constants in raw state — deliberately, so
  the store agrees with `metric/history.ts`, which reads absence the same way —
  but the next write of that day then materializes them as explicit numbers, and
  `constraint-memory.ts`'s pools branch takes the latest day carrying both
  fields as the standing declaration. So a rewritten legacy day dated after the
  user's last real pool declaration outranks it and pins untouched future days
  to the constants. Bounded on both sides: autosave refuses past days, so the
  rewritten day must be today or later, and every day written since pools
  shipped already carries them, so only legacy records enter this path. Closing
  it means writing `?? undefined` in the autosave payload so absence survives —
  which changes the "a stored day keeps its own" decision rather than
  implementing it, and needs deciding as one. Unmeasured: no probe has counted
  how many legacy pool-less records a real profile holds, and the answer may be
  zero.
- **One predicate, three spellings.** `#canEditPlan` (loaded-date and
  not-past) is still written out inline twice more in the same file — in
  `readDeferDestination`, where it is the same refusal, and in the autosave
  `$effect`, where it is the positive form. A refactor, not a bug; the risk is
  the ordinary one of a rule changing in two places out of three.

## Findings from the 2026-08-26 scenery gutter

- **`cathedral`'s rose window still needs a redraw, and until it gets one it is
  the worst-lit thing on `/`.** The gutter that fixed `moonphase` cannot take
  it: the window is 20rem _of detail_ — twelve lancet petals, a roundel ring,
  eight jewel circles, a hub — and at the ~11rem a gutter allows, the petals are
  ~30px and the jewels ~13px. It also cannot take the `hourglass` treatment of
  becoming a low-alpha wash, because it is a hard-edged SVG over an opaque
  `#17121f` backing circle. Measured on `/` at both 1440px and 1888px, seven
  labels sit over it and all seven fail WCAG AA; five of them read **1.00:1** —
  the label's own colour, exactly, against the jewel behind it. That is the
  highest-severity contrast failure the app currently ships, and it is invisible
  to `scripts/ink-contrast.mjs`, which samples token fills rather than scenery.
  The price is design work — fewer, larger elements and thicker strokes at a
  size that fits — not a relocation, which is why
  [the-moon-that-lost-its-sky](docs/features/the-moon-that-lost-its-sky.md) left
  it out. Moving the window vertically mitigates without closing: the brightest
  ring hides behind the app bar and the two mid-range labels recover to ~1.9:1,
  while the five at 1.00:1 do not move.
