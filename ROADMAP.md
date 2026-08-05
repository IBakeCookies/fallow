# Roadmap

Fallow sits at a stable V1: two peer planning modes (the default Zenith
Gradient allocator and the Energy Lab), a full calibration loop (⚡ time-to-flow,
☕ recovery, 🪫 drain, stop-time λ₀), plan advice, the analytics audit, offline
PWA, en/de.

The math behind every item lives in [MATH.md](MATH.md). Settled decisions are
in [AGENTS.md §5](AGENTS.md) — notably the three roads deliberately not taken:
the energy model stays a peer mode, never a replacement (MATH.md §15), run
order stays the nature-alternation heuristic (§16), and ϕ stays one plane for
all tasks (§17). Do not re-open those here.

Phases are priority order. Item numbers are stable and cited from elsewhere
(MATH.md §14.2 cites item 3), so they are never reused; phase numbers are not
cited and were re-cut on 2026-08-04 when items 11–23 were added. Update this
file when an item ships or is rejected.

## Where the headroom actually is (2026-08-04)

Three readings shaped the phases below, and each is checkable in the code
today:

- **The objective prices hour _quality_, never importance or completion.**
  `priorityScore = P̄(T*)·10` is _derived_ from difficulty × enjoyment
  (`metric/calculation.ts:196`), so a task that matters and a task that is
  pleasant are indistinguishable to the allocator. There is no importance
  input, no deadline, no task size. Item 23 is the only item that changes this,
  and it is deliberately last.
- **Every calibration instrument lives behind `/energy`.** `logDrain` has
  exactly one caller (`energy/+page.svelte:196`), and `readFinishedDays` skips
  any date without a 🪫 log with `hours > 0`
  (`session-history.ts:163`, `:180`). A user who only ever opens `/` therefore
  contributes **zero** days to λ₀ (§8.10), the §12 audit and overnight
  carry-over (§11.9). Item 11 is the cheapest item here for that reason.
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
   false stops from 16–25% to 5–6% at high λ₀, at-stop agreement within one
   45-min step throughout.
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
   the optimum (relative spread median 0.265, p90 0.803). What survives: the
   column prices no lever the user owns, and it ignores the pools and switch
   cost, overstating the budget's yield on 16% of days. The finding that
   justified shipping it: on **35%** of days another block buys nothing, and on
   every one of those the card was still offering "work an extra hour".

Items 1–3 shipped and did not finish the thesis: the plan still cannot see the
hours you have already spent.

11. **Worked-hours instrument on `/`** — log "worked 50 min on this" from the
    main page, so a `/`-only user stops being invisible to three calibrations.
    Reuse `drain-log-form.svelte` and the `completionPromptAction` policy
    already on `/`, and add today's logs to `DailyMetricsInput`
    (`metric/daily-metrics.ts:48-58` has no worked-hours field at all);
    `DailyPlanStore` already holds the observation store and reads drain logs
    for fits and for `selectedDate − 1`. Zero plan value on its own — it is a
    binary unlock (0 → n fitted days) and the prerequisite for 12–14.
    **The decision that _is_ the build is hours provenance.**
    `DrainObservationRecord.hours` is documented as _session length worked
    before the rating_ and is the α instrument (§8.7 reads `H` as one session
    from a full reservoir), while §8.10/§11.9/§12 de-facto treat one record as
    that task's whole day — the upsert key is `(taskId, date)`. Amending hours
    without re-rating therefore attaches a 2 h rating to 5 h of hours, biasing
    α̂ **down** in a fit that already has a documented **upward** fresh-start
    bias. Pick one first: (a) every amendment re-asks mind/body — honest, more
    friction, no schema change; (b) worked hours become a `Task` field —
    session-embedded, validator in `persisted.ts`, round-trips in backup, no
    new store and no R8, but two definitions of "worked hours" then exist and
    R3 forces §8.10/§12 to choose one; (c) a new store — R8's five steps, only
    if (a) and (b) both fail. **Probe:** refit α on synthetic days amended
    without re-rating vs correctly re-rated; **kill hours-only if α̂ moves by
    more than the reported posterior std** (§8.7 measures 0.033–0.090 at 2–8
    logs). If it moves less, (a) is friction for nothing and (b)'s R3 cost is
    unjustified — take the cheap path. New user input: yes. MATH.md: a sentence
    in §8.7/§8.10 fixing the convention chosen.
12. **Prefix-aware mid-day re-plan** — "it's 2pm, you're an hour behind and you
    spent it on the wrong thing; here is the best use of the hours left". Pass
    an optional per-task already-worked vector `h` into the allocation entry
    points so `buildBlockIncrements` (`zenith.ts:634`) continues from the
    prefix, `Δᵢ(j) = P̄ᵢ(hᵢ+jδ) − P̄ᵢ(hᵢ+(j−1)δ)`: a started task stops
    re-collecting the ≈p₀ activation bonus and a task past `T*` is offered
    nothing. A prefix menu is a suffix of the same non-increasing sequence when
    `h` is on the block lattice, so the greedy's exactness is untouched. Pools
    enter depleted at `Σ wᵢhᵢ`, **clamped at 0**, or an overrun day funds
    nothing. Probed at median **+5.8% to +7.8%** of day `Σ P̄` against the cold
    re-solve the budget slider gives today, **+8.9%** against sticking to the
    morning plan, funded set differing on 81% of divergent days, and **+0.07%**
    on a day executed exactly to plan — ≈**74 equivalent budget-minutes**
    against the 0.4 that killed item 6. It escapes §17's flatness table
    legitimately: it moves _which tasks are funded_, not block timing. Recalled
    hours suffice (±15 min of recall error costs 0.00% median, ±30 min 0.36%
    mean), which is why no timer appears anywhere in this roadmap.
    **The shape is constrained before any code is written.** Twelve-plus
    readings are plan-family (§11.8), whose rule is verbatim "completing a task
    must not move them", so replacing the plan solve silently converts them
    into remaining-day readings; and a second solve inside
    `calculateDailyMetrics` doubles a `$derived` that re-runs on every
    keystroke and slider drag at ~51 ms/solve at n = 12, which is the same cost
    rule that kept `budgetMarginal` out of it (§14.2). The only legal shape is
    a **next-up-family reading computed at store level or on demand** — the
    shape `adviseStop` already uses. It follows that `suggestedHours` cannot
    become "X more h"; remaining hours are a second column beside the plan.
    The switch convention must be written down too: charging a re-entry switch
    when the afternoon subset contains an already-started task gives median
    +5.79%, free re-entry +7.79%; they differ by 1.71% of value and pick a
    different funded set on only 8.2% of days, so the item survives its worst
    case either way. **Probe** (the value is already measured; this one is
    scope): instrument the chosen shape at n = 12 and **count plan-family rows
    whose value changes mid-day on a day executed exactly to plan — any
    non-zero count kills that shape.** Needs a new MATH.md section (the
    objective under a prefix, the switch-re-entry convention, the pool clamp).
    No new store; no new input beyond 11. **Prereq:** 11.
13. **"You are here" on the run order** — one line on `/` naming the task the
    next 15 minutes are worth most on. It must **label position 1 of the
    re-planned run order**, not an independent `argmax Δᵢ(1)`: subset
    enumeration plus switch cost can disagree with the best single increment,
    and two definitions of "next" is the R3 failure. The run order is already
    next-up scoped and already re-forms on completion
    (`daily-metrics.ts:133`) — what it lacks is awareness of hours worked,
    which 12 supplies. It must never say "stop for the day": the classic
    objective prices no leisure (§14.1), so day-ending stays λ₀ and §8.11. No
    independent plan value; it is 12's user-visible surface and the reason to
    open the app at 2pm. **Prereq:** 12.
14. **Executed capacity burn-down** — "55 min of cognitive capacity left today"
    instead of an 8am percentage. `Σ (demandᵈ/10 · hoursWorked) / poolᵈ` from
    the logs' snapshotted demands — the same quantity 12 needs to deplete pools
    with, so one computation serves both. It must be a **new next-up row**, not
    a rescoping of the Human Capacity tile, which §11.8 names in the plan
    family. `band.ts:102` does have a critical band above 100% that is
    currently unreachable from allocator output (`calculation.ts:347-350`);
    this reading makes it reachable, which is its honest pitch. A display item
    with no probe and no plan risk — argue it as one. **Prereq:** 11; free
    once 12 lands.

_Decide before 11, not a roadmap item:_ `importFromDate` / `importYesterday`
copy every stored task — completed ones included — into fresh incomplete tasks
with no dedupe against today's list (`session-store.svelte.ts:597-620`).
Re-importing a finished task as fresh is plausibly the point of "import
yesterday"; the missing dedupe is less clearly intended. Settle which it is
before 11 adds a second write path to the same day.

## Phase 2 — declared inputs the app can already infer

The inversion named above, in priority order. Measured framing for the whole
phase (400 synthetic days, 3–7 tasks, budgets {2,4,4,6,8}, real
`calculatePooledAllocations`, scored §17-style — plan under θ̂, score under
θ_true): ϕ off by +0.5 h on every task costs **0.074%** (the §17 anchor); one
enjoyment point **0.052%** — _below_ the anchor that killed item 6, which kills
every enjoyment-side idea outright; one task's mental demand off by 4 points
**0.582%**; a pool 2× wrong **4.1–5.7%**; `switchCost` 2× too high **10.1%**;
every slider left at 5/5/5 **5.42%**. **The constraint side and the difficulty
side are where declared-input error costs real money; the β side is a
re-labeling, not a loss.**

15. **Title memory for the two difficulty sliders** — retype a title you have
    used before and its P/M sliders come back instead of resetting to 5/5.
    `$readSessionsByDateRange` already returns full `tasks: Task[]`
    (`metric/history.ts:27-35`), so this is a `Map<normalizedTitle, latest
{physicalDifficulty, mentalDifficulty}>` built in business and passed as a
    prop to `task-form.svelte`, which hardcodes 5/5/5 twice (lines 26-28,
    48-50). **Enjoyment is deliberately out of scope** at 0.024%. Title
    normalization is a genuinely new concept — there is no `toLowerCase`
    anywhere in `src/lib/business` today — so it gets exactly one definition
    (R3). Ceiling measured: planning under 5/5/5 costs **5.42% mean / 4.72%
    median with 98% of days moved**, 73× the ϕ anchor, and systematic per
    re-typed title rather than noisy; realized value is that ceiling ×
    P(default left) × recurrence share. **Probe:** over real sessions, the
    share of tasks whose normalized title repeats **and** whose P/M sit at
    exactly 5/5 — **kill if recurring titles are already hand-rated**, because
    the ceiling is then unreachable. No store, no schema, no formula, and it
    _removes_ an input rather than adding one.
16. **Budget prefill for unseen days** — a new day opens with the hours that
    weekday usually has, overwritable, instead of 0. Seed `#availableHours`
    from the range read already available: same-weekday median → overall median
    → 0. **The trap that makes this bigger than it looks:** the autosave dirty
    test is literally `this.#availableHours > 0`
    (`session-store.svelte.ts:212`), whose documented purpose is that pristine
    never-saved days are skipped so browsing ahead creates no empty records. A
    nonzero prefill therefore writes a phantom session for every future day the
    user merely looks at — which then appears in the calendar, in `DaySummary`,
    in analytics' `plannedHours`, and as a _declared intent_ driving Burnout
    Risk (§11.3). It needs a separate `#prefilled` flag excluded from `dirty`
    and cleared on the first user edit. AGENTS.md must record why this is not
    §13.6's deliberately removed Lab `|| 8` fallback: history-derived,
    user-overwritable, and not persisted until touched. **Probe:** weekday
    median vs actual `availableHours` on real history — MAE in hours plus the
    share of prefills overwritten; **kill if MAE > ~1.5 h**, and then just fix
    the auto-open. Today 100% of unseen days read budget 0, so all four
    headline tiles read N/A, the constraints bar auto-opens
    (`+page.svelte:163`), and a deferred task lands in an unplanned day. Not a
    precision claim — it is the instrument item 21 needs.
17. ~~**Switch-cost price diagnostic**~~ — SHIPPED 2026-08-04 (MATH.md §14.3):
    `switchCostPrice` on `PlanAdvice`, two extra solves at `s = 0` and `s = 2s`
    inside `suggestPlanAdjustments`, one quiet line on the advice card. The
    gate cleared by 8×: the kill criterion was a median |Δ value| under ~1%
    between `s = 0.25` and `s = 0.5` on 2–4-task days, and the measurement
    through the real solver is **8.51%** over the fixture's 180 such days,
    **8.14%** over the author's own four logged days, and **18.80%** on 5+-task
    days. Constant-independent (8.54% under the fixture's own ground-truth ϕ
    constants), and the reservation it reports is a median **23.08%** of the
    day's budget.
    Two things changed on contact with the measurement. The **framing had to
    become conditional**: the planned copy ("halving it would buy X") priced a
    quantity the app cannot compute, because the cost of _mis_-declaring `s`
    needs to know which value is true, so each alternative now reads "if your
    switch cost were X, this plan would read Y". And the old asymmetry figures
    quoted below (2× too high 10.13%, too low 1.04%, ignoring it 1.18%) answer
    that different question — the diagnostic's own numbers are the table in
    §14.3, where `s → 0` reads **+10.95%** rather than 1.18%, because planning
    as if switching were free _raises_ reported value while switching for
    free-that-isn't lowers realized value. No floor, unlike §14.2 — but not
    because inversions cannot happen: 0 of 298 fixture days invert at their
    **stored** budget and pools, and off those values they do (§13.3's pooled
    suboptimality). The floor is refused because it would zero the doubled arm,
    which is the arm that carries the message.
    _The estimator proposed alongside it stays unbuilt:_ fitting `s` from the
    observed funded-task count died on three measurements — `m(s)` is not
    monotone (609 violations over 400 days × 101 `s` values), median one-day
    bracket width 0.39 h against a [0,1] h range with 14% of days consistent
    with the entire range, and one mis-counted task shifts the bracket edge by
    median 0.34 h off opt-in logs.
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
    (measured 2026-08-04 with `scripts/generate-fixture.mjs`, recovering known
    ground truth through the real `fitEnergyParams`): the fit is **exactly
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
    fallback for every stored day with no pools (`session-history.ts:239`,
    `history.ts:73`), so changing it re-scores history against §12.1's settled
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

## Phase 3 — calibration trust

4. **Censored-likelihood stopping fit** — worked-to-edge, zero-work and
   inverted days currently drop out of the §8.10 fit; a one-sided likelihood
   term would use them. Build once real usage shows enough censored days.
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
6. ~~**Per-task ϕ offsets**~~ — REJECTED 2026-08-04 (MATH.md §17, AGENTS.md §5).
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
    its date via `fitUserConstants` (`zenith.ts:1609`) and record the residual
    against the fitted plane, against `DEFAULT_USER_CONSTANTS`, and against the
    ±1σ band from `phiPredictionStd` (`zenith.ts:1756` — exported, documented
    "intended for UI", and consumed by nothing outside its own test).
    Whole-history flow is already read once in `readModelReport`
    (`session-history.ts:437`), so this adds no read. **Two corrections that
    are easy to get wrong:** each backtest fit must pass `ageDays` relative to
    _that log's_ date, not today (`session-history.ts:103-110` bases it on
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
    over-cover (σ̂² floored at 0.25 h, ν₀ = 4), and skill against the default is
    ≈0 at small n _by construction_, since the ridge is anchored to the
    default — so gate the coverage row at n ≥ 10. Fold in the ~5-line display
    of `phiPredictionStd` as a ± band beside the point ϕ on the task card
    (`task-item.svelte:261-265`), which that function's own docstring
    sanctions. Unpriced by design and outside §17's table — it is not an
    allocation-precision claim. MATH.md: a §5.3 note on the scoring convention.
20. **Unfunded-task attribution** — name the binding reason a task got 0 h.
    **Zero extra solves:** `suggestPlanAdjustments` already computes a full
    `calculateDailyMetrics` per defer candidate, each carrying `activeTasks`
    with `suggestedHours` (`plan-advice.ts` `suggestPlanAdjustments`), so "which single removal
    funds this task" is a lookup over candidates already in hand; pool-bound is
    detectable by comparing the plan's `Σ hours·weight` against the declared
    pool with no solve at all; and the budget branch already ships as
    `budgetMarginal`. `unfundedTaskIds` (`plan-advice.ts:527`) today says
    _that_ and never _why_, and §14.2 concedes that a bound pool, a task near
    `T*`, and a block landing on finished work "look identical from one solve".
    **Strip all prescription** from the pool and switch branches — §14 is
    explicit that advising someone to raise their cognitive pool is advising
    them to lie to the model. **Probe:** attribution mix over ~300 random days;
    **kill if any single cause exceeds ~80%** (the honest product is then one
    static sentence), **or if the defer branch is empty on most days**, leaving
    only non-actionable branches.

## Phase 4 — multi-day horizon

7. **Satiety across days** — BLOCKED, and not the small item it reads as.
   Reservoirs already carry over overnight (§11.9); satiety still resets at
   midnight, so yesterday's 7 h of guitar doesn't temper today's κ. But the
   mechanism is unavailable: `seedMorningReservoirs` receives only
   `{id, cognitiveDemand, physicalDemand}` (`energy-calibration.ts:150-160`),
   while per-task output needs `curves.get(taskId)` built from difficulty
   **and enjoyment** (`zenith-energy.ts:538-544`), which
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

21. **Destination preview for a defer** — before you send a task to tomorrow,
    see what tomorrow already looks like: the destination day's task count,
    budget and funded set after the move, read-only, from the one extra session
    read `moveTaskToTomorrow` effectively already needs. **No Δ% pair** — see
    item 8. **Probe:** is the destination day non-empty often enough to earn a
    row? **Kill if tomorrow has 0 tasks and 0 budget on >80% of real defer
    moments** — item 16 is what makes it non-empty. **Prereq:** 16.
22. **Chronic-slide badge** — "this has been on your list 6 days".
    `moveTaskToTomorrow` copies `createdAt` verbatim
    (`session-store.svelte.ts:536-548`), `Task.createdAt` is an ISO date string
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
    `toPooledInputs` (`metric/calculation.ts:123-131`).
    **The R3 hazard to price first:** `Σ P̄` has two independent
    implementations — the allocator's `planValue` over `buildBlockIncrements`
    (`zenith.ts:905`, `:633`) and `calculateTotalProductivity`
    (`zenith.ts:1255`), which is what Zenith Gain and the §12 audit score with.
    A weight must land in both in lockstep or §13.2's "the gain is provably
    ≥ 0" breaks and the audit starts comparing two objectives. Default `v = 1`
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
    (`task-item.svelte:295`); `SavedRoutine.tasks` shares `taskCore`
    (`persisted.ts:68-76`), so decide whether importance travels with routines
    (`mustDoToday` deliberately does not); and the energy mode does not get the
    weight (`toEnergyTask`, `calculation.ts:94`), so §12's audit becomes
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

Not settled decisions — those live in [AGENTS.md §5](AGENTS.md) and an item
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
  regression). The whole β channel measures **0.052% per point** — below the
  0.074% ϕ anchor that item 6 was rejected for. A perfect β oracle is worth
  less than the thing already declined.
- **A budget-realization ratio ρ as a fit or a prior.** Unidentifiable:
  worked hours come only from opt-in 🪫 logs, so ρ conflates over-declaration,
  under-logging, and §13.6's dual meaning of `availableHours`. At most one
  display line phrased as _logged_ vs _declared_.
- **Auto-routine by weekday.** Re-implements `SavedRoutine` with an inferred
  frequency threshold in place of the user's exact choice (§0).
- **A sleep-quality slider feeding the pools.** Already built:
  `cognitivePool`/`physicalPool` are per-day, persisted, validated and
  user-editable (`day-constraints-bar.svelte:204-215`). A sleep slider is a
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
