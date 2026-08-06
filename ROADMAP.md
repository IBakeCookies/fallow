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
  (`metric/calculation.ts:196`), so a task that matters and a task that is
  pleasant are indistinguishable to the allocator. There is no importance
  input, no deadline, no task size. Item 23 is the only item that changes this,
  and it is deliberately last.
- **Every calibration instrument lives behind `/energy`.** `logDrain` has
  exactly one caller (`energy/+page.svelte:197`), and `readFinishedDays` skips
  any date without a 🪫 log with `hours > 0`
  (`session-history.ts:180`, `:197`). A user who only ever opens `/` therefore
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
    **Hours provenance — SETTLED 2026-08-05 as option (a)** (MATH.md §18).
    `DrainObservationRecord.hours` stayed the α instrument (§8.7's one session
    `H`) and the store became **one row per session**: §8.10/§11.9/§12 read a
    task's day as the sum of its rows, which is what `workedHoursByTask` and
    `readFinishedDays` already computed. The `(taskId, date)` upsert that
    forced the two readings onto one number is gone — it was deleting the
    earlier session outright, not just blurring it — so there is no amendment
    path that attaches an old rating to new hours: every session re-asks
    mind/body, and correcting one edits that row in place. No schema change,
    no R8.
    Options (b) (worked hours as a `Task` field) and (c) (a new store) are
    therefore moot, and the α-drift probe that would have chosen between them
    is not needed; what remains true is the **sessions-per-day bias** in
    item 18's table, which this makes commoner and does not cause. New user
    input: yes, but only the `/`-side form.
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

Found by the 2026-08-06 review of the advice card, and small enough to be
nobody's feature — which is why it is written down rather than remembered:

25. **The advice card's buttons must not outlive the day they priced.** Two
    halves of one rule, both reachable today. (a) `isStale` renders a banner
    but every Apply button stays enabled on `isBusy` alone
    (`plan-advice-card.svelte`), so after one deferral the remaining rows offer
    single-step prices that no longer describe the day the button would act
    on — §14's single-step contract is exactly what makes them wrong together.
    (b) `DailyPlanStore`'s `#fingerprint` covers the seven model inputs but not
    `selectedDate`, so advice survives a day change and renders on the new day
    with the stale banner and buttons that silently do nothing. Not a wrong
    move — ids are `Date.now()`-derived, so `moveTaskToTomorrow` finds no task
    and returns `false` — but the click is swallowed and the return value has
    no reader anywhere. **No probe:** this is a correctness fix, not a
    measurement, and it makes no claim to establish. Argue it as one, or
    decline it: the counter-case is that the banner already says the numbers
    are stale, and gating the buttons costs a user the one deferral they can
    still take honestly.

_Decide before 11, not a roadmap item:_ `importFromDate` / `importYesterday`
copy every stored task — completed ones included — into fresh incomplete tasks
with no dedupe against today's list (`session-store.svelte.ts:616`, `:647`).
Re-importing a finished task as fresh is plausibly the point of "import
yesterday"; the missing dedupe is less clearly intended. Settle which it is
before 11 adds a second write path to the same day.

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

15. ~~**Title memory for the task sliders**~~ — SHIPPED 2026-08-05 together with
    item 24, which is the surface it ships behind. `normalizeTitle` and
    `latestRatingsByTitle` (`business/model/title-memory.ts`) fold every stored day
    into `Map<normalizedTitle, {title, physicalDifficulty, mentalDifficulty,
enjoyment}>`; `readTitleRatings(today)` reads it once at boot and
    `SessionStore.suggestTitles` answers the add-task form. No store, no schema, no
    formula. **The fold walks each day's tasks backwards**, which a review caught:
    days sort ascending, but within a day `tasks` is newest-first — every writer in
    `SessionStore` prepends — so array order handed a title used twice in one day the
    rating the user had already superseded. Reversed rather than sorted by `id`,
    because an import assigns ids ascending across a batch it prepends as a block.
    The test that should have caught it was pinning array position instead: its
    fixture was written in an order the store cannot produce.
    **Nothing infers which title the user means.** Two versions of this were built
    before the shipped one, and both failed the same way: they moved the sliders
    while the user was still typing. Applying a rating once per title and never
    taking it back deployed `Gym session notes` at `gym session`'s 8/2, because
    typing walks through every prefix and the recall fires on the way past.
    Withdrawing it again on every keystroke fixed that and cost a per-slider
    ownership flag to stop the memory speaking over a slider the user had dragged —
    two mechanisms, both guessing. The pick in item 24 has neither, and the sliders
    move only when the user names the title they mean.
    **Two corrections to this item's own numbers, both the same unit error.** The
    5.42% it quoted is all _three_ sliders at 5/5/5, so as first shipped — two
    sliders — it overstated its reach 2.3×. Then excluding enjoyment was justified
    with "0.052% per point", which is one point on **one** task, against a ϕ
    anchor measured as +0.5 h on **every** task. Measured properly through the
    real `calculateTaskPlan` (400 days, 3–7 tasks, budgets {2,4,4,6,8},
    §17-style):

    | planned under                  |  mean | median |   p90 | days moved | days it helped |
    | ------------------------------ | ----: | -----: | ----: | ---------: | -------------: |
    | P/M at 5/5, enjoyment true     | 2.39% |  2.02% | 6.17% |      91.8% |      19 of 400 |
    | enjoyment at 5, P/M true       | 2.02% |  1.16% | 4.90% |      90.8% |              0 |
    | all three at 5/5/5             | 4.59% |  3.97% | 9.56% |      97.5% |      16 of 400 |
    | one task, enjoyment off by one | 0.06% |      0 | 0.18% |      26.3% |       1 of 400 |

    The last row reproduces the 0.052% that was used to exclude the third slider;
    the second row is what excluding it actually cost. Enjoyment is 85% of the
    difficulties by mean and the only arm that is never negative.
    **The stated probe was not runnable and the item shipped without it.** Its
    gate — the share of repeating titles already hand-rated — is a question about
    habit, answerable only from real sessions, and there is no exported history on
    the author's machine; the fixture generator is disqualified for exactly this
    class of question (see above). So the ceiling is confirmed and the realized
    fraction of it is still unmeasured: run the gate the moment a backup exists,
    and if recurring titles turn out to be hand-rated already, the honest move is
    to delete this, not to keep it.
    Declared limits, none of them worth code today: the map is a **boot snapshot**,
    so a title rated within one session is not suggested until the next load, and
    it stays the boot day's answer while another date is viewed; the **task editor
    deliberately offers no suggestions** — renaming a task the user already rated
    must not rewrite its ratings; and the whole-history read measured 47 ms at 3651
    stored days, unguarded by any budget in the repo.

16. **Budget prefill for unseen days** — a new day opens with the hours that
    weekday usually has, overwritable, instead of 0. Seed `#availableHours`
    from the range read already available: same-weekday median → overall median
    → 0. **The trap that makes this bigger than it looks:** the autosave dirty
    test is literally `this.#availableHours > 0`
    (`session-store.svelte.ts:220`), whose documented purpose is that pristine
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
    (`+page.svelte:167`), and a deferred task lands in an unplanned day. Not a
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
    fallback for every stored day with no pools (`session-history.ts:256`,
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

Item 15 shipped as one feature with the item below, which is how its ratings
reach the form at all:

24. ~~**Title suggestions as you type**~~ — SHIPPED 2026-08-05, and it replaced
    item 15's first two mechanisms rather than adding to them. `suggestTitles`
    (`business/model/title-memory.ts`) answers a part-typed title with every rated
    title it could be naming; `SessionStore.suggestTitles` hands that to the
    add-task form, which shows them under the field. The history read is not
    awaited — the day must not wait on it — so the Map it lands in is `$state`:
    the form is on screen and typed into while the read is in flight, and a list
    that asked before it landed has to see it arrive. **Picking one fills the title
    and moves all three sliders to what that title was last rated, and the user
    can then drag any of them.** Typing past the list and picking nothing leaves
    the sliders where they are — a task nobody picked is rated by hand.
    **It is smaller than what it replaced.** The recall fires on one explicit
    action instead of on every keystroke, so there is no prefix to walk through,
    nothing to withdraw, and no per-slider ownership flag; the form lost both, and
    the two stories that existed only to pin them. One rule survived contact with
    its own story: **emptying the field returns the sliders to 5/5/5 — but only
    when a pick put the numbers there** (`fromPick`). Both halves are a failure
    somebody hit: without the reset, clearing a picked title and typing an
    unrelated task deploys it wearing the picked rating; without the guard, a
    typo in a hand-rated title costs the user the drags they made themselves, and
    the flag has to clear on submit or the _next_ task's drags are lost the same
    way. Editing short of empty keeps a pick on purpose — a renamed task is still
    that task, and its three numbers are on screen. **One case is knowingly
    unguarded**: selecting the whole field and typing over it never passes through
    empty, so a pick's rating survives the replacement. It is rare, and every rule
    that would catch it (reset when the field diverges from the picked title, or
    stops being a prefix of it) breaks appending to a picked title, which is the
    ordinary reason to keep typing after a pick. If it shows up in real use the fix
    is to make the carried rating legible ("recalled from _Gym_" until a drag), not
    to guess harder.
    **Hand-rolled, and the library was read before it was refused.** `bits-ui` is
    already a dependency and has a combobox, and the repo's `ui/` directory is
    shadcn-svelte ports of exactly those primitives — but its combobox is
    Select-shaped and this field is a free-text input that sometimes matches:
    `Combobox.Input` strips `value` from its own attributes and drives it from the
    root's `inputValue`, so `draft.title` would have two owners (R3); its
    `onkeydown` calls `preventDefault()` on Enter and opens the menu instead, which
    takes the form's only keyboard submit; and its `oninput` does not open the menu
    at all, so `open` had to be driven here regardless. What shipped is the ARIA
    1.2 combobox pattern inline in `task-form.svelte` — `role="combobox"` with
    `aria-expanded`/`aria-controls`/`aria-activedescendant` over a `role="listbox"`
    of `role="option"` rows, arrow keys and Enter and Escape on the input, and
    `mousedown` prevented so a click does not blur the field before it picks. Three
    of those details are the pattern's and were missing until a review asked for
    them: an arrow key **reopens** a list that Escape or a blur closed and highlights
    the end it was opened from (otherwise editing the field is the only way back, and
    reaching a suggestion cost two keystrokes), Escape, a pick and a blur all **drop
    the highlight** with the list it names (otherwise `aria-activedescendant` outlives
    its element), and the highlighted row is **scrolled into view** — the list is
    uncapped, so it can be taller than the box that shows it, and a highlight below
    the fold is one nobody can see. The scroll is an `$effect` on `active` rather than
    a call beside each assignment, because a reopen highlights a row whose `<li>` does
    not exist until the DOM has been patched.
    **Two characters, not three, and it is a judgement.** The match is a substring,
    so one character finds most of a history and the list would cover the sliders
    on every new task; two is the first length that discriminates and is shorter
    than the shortest titles anyone writes (`Gym`, `Run`). Matching is substring
    rather than prefix because the word the user reaches for is often not the first
    one, ordering is alphabetical, and the list is **uncapped** — any ranking would
    be invented and a cap would hide rated titles with no way to know.
    **Item 15's gate still has not been run** (no exported history exists), and it
    now gates both: if recurring titles turn out to be hand-rated already, this
    goes with it. The one question this item adds — whether a real history holds so
    many titles that alphabetical is unreadable — is answerable at the same moment,
    from the same backup.

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
    (`session-history.ts:453`), so this adds no read. **Two corrections that
    are easy to get wrong:** each backtest fit must pass `ageDays` relative to
    _that log's_ date, not today (`session-history.ts:106-113` bases it on
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
    `budgetMarginal`. `unfundedTaskIds` (`plan-advice.ts:537`) today says
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
    dated back-reference in `MATH.md`, a row in AGENTS.md §4's registry, and one
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
    clean cut to move it to. **Re-deriving it from the measured distributions is
    now its own open item** — see 28.
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
27. **§8.6's missing rest-insert move** — the energy search cannot split a funded
    block around an interior rest, because splitting a block and re-growing it is
    downhill in between. Measured 2026-08-06 against the **exhaustive** optimum
    on the same 45-min lattice (`scripts/energy-search-gap.probe.ts` — every
    lattice plan enumerated, so a shortfall is a proven search defect and not a
    better heuristic): 58 of 60 seeded days exact, median 0.0000%, **worst
    −0.5951%**, on a single task over a 6 h window where the search returns one
    5.25 h block and the optimum works the same 5.25 h as 3.75 + 1.5 around a
    45-min rest. The fix is one more deterministic paired candidate beside the
    existing transfer move: split a funded block at each interior lattice point,
    hand one step to REST, keep total hours.
    **The smallest item in this file, and the case against it is on the record
    too:** 0.5951% on 1 day of 60, and **0 funded-set mismatches of 60** — so on
    the tier that is proven, the structural failure §8.6 itself calls the worse
    one does not occur — against a new candidate class in a ~60 ms search that
    re-runs on every Lab solve. What keeps it alive at all is the harder tier,
    where 12 days of 4–6 tasks × 8–12 h show **3 funded-set mismatches**; those
    are **unattributable**, because the reference there is a 200-restart hill
    climb and a lower bound, so either search can be the wrong one.
    **Probe:** re-run that same probe with the move in. **Kill if it does not
    take the worst day to exact**, or if wall time moves enough to be felt at
    3 tasks / 8 h. If it does close the exhaustive tier, raise the harder tier to
    an exhaustive reference before reading anything into those 3. Written down
    rather than remembered because the probe already scores any fix in one
    command.
28. **Re-derive `STOP_INVERSION_MARGIN` from measured distributions** — 26(c)
    left the constant standing on an arithmetic that does not hold. What is known
    now: the honest instrument slack is ~0.110, not 0.25; at 0.25 six near-
    rational days in 1179 are still censored; and the inversion gap does not
    separate the populations cleanly (censored random compositions gap a median
    0.282 while honest mood days reach 0.421). So tightening toward 0.110 censors
    MORE honest days, and widening keeps more contamination — the trade is real
    and currently unpriced. The missing measurement is the one §8.10 actually
    cares about: **λ₀ fit error as a function of the margin**, sweeping it over
    a population mixing rational, mood-perturbed and genuinely interrupted days.
    Kill criterion: if the fit's RMSE is flat across margins in [0.1, 0.5], the
    constant does not matter and the paragraph should say so instead of
    pretending to derive it.
29. **Round-3: what the 2026-08-06 agent sweep found and nobody built** — five
    agents swept disjoint `MATH.md` ranges to pick item 26's targets, and
    surfaced far more than the five that got probes. This is the residue. Three
    entries already have a COUNTEREXAMPLE measured in a scratch probe that was
    not committed — which is item 26's own failure mode, one level up — so they
    are recorded with their numbers and marked unverified rather than trusted.
    Ranked by whether a shipped behaviour is wrong, not by effort.
    (a) **§11.9's "inherited approximations wash out exponentially through the
    trailing rest" is probably false where the feature exists** (UNVERIFIED,
    agent scratch probe). The claim covers block order and omitted intraday
    breaks. At the default recovery rate the spread is ≤ 0.01 pt, but at
    `RECOVERY_FIT_MIN = 0.1` — which §11.9 itself says is exactly when
    carry-over becomes visible — reordering three blocks over a 16 h day moved
    the morning level by **8.4 points**, and moving a 2 h break from the
    trailing gap to mid-day by **2.4 points**. Same shape as §14.1-2: a claim
    true at defaults, stated unconditionally, and load-bearing only in the
    regime where it fails. Entry point `seedMorningReservoirs`; propagate
    through `calculateBurnoutRisk` and report the spread in risk POINTS.
    (b) **§11.9's own exemplar may be arithmetically wrong** (UNVERIFIED): the
    doc says a 16 h day (8 h gap) starts the next morning near **74%**;
    recomputing §11.9's stated closed form at its stated constants gives
    **70.6%**. The 8 h exemplar (92%) reproduces at 91.6%. Two fixed points, so
    a unit test, not a probe — do it in the same pass as (a).
    (c) **§8.3 claims a unit test that does not exist.** "Post-fix probes
    (locked in as unit tests): … a ~30-minute break placed mid-session _raises_
    total output at equal work-hours — the Jaber–Neumann result". Grep finds no
    such test; the three nearest ones assert reservoir levels, not output, and
    one asserts the opposite direction. §13.5's +17%-at-2-chunks figure is the
    same claim from another thrown-away sweep. Cheapest of the three to settle
    and the most embarrassing to leave: the document asserts a suite guarantee
    it does not have.
    (d) **§8.9's "within ~0.05 of truth" under rating quantization + jitter**
    (UNVERIFIED): one agent realization deviated by up to **0.133** (true 0.7 →
    0.833). This is the identifiability bound the whole r → α → λ₀ conditioning
    chain rests on, so if it is really 0.13 the downstream stds are optimistic.
    (e) **§8.8's coarse/fine quantization ratio is tested at one window only.**
    The suite asserts ≥ 0.97 at `windowHours = 8`; an agent measured **0.9759 at
    12 h** — 0.6 pp of headroom on a window the test never runs — where the
    doc's "~1% objective cost" is actually 2.4%. Rest-confetti reproduced
    exactly (fine = 5 rest blocks vs coarse = 1).
    (f) **Three more lost sweeps, same class as item 26's**: §14.3's switch-cost
    inversion grid (322 inversions over 178,800 configurations, worst free arm
    −6.53% — quoted verbatim inside `plan-advice.ts` and the sole justification
    for a shipped clamp); §15's 300-day cross-scoring table (276/300) that
    withdrew the energy-plan promotion; §16's order-only permutation bound
    (+0.47%) restated as fact in `calculation.ts`. No probe file was ever
    committed for any of them.
    (g) **§12's ±0.05 adherence verdict band has no noise model** — §12 says so
    outright ("no noise model") while printing one English verdict decided by
    that constant. Nothing shows it is wide enough to stop week-to-week flipping
    or narrow enough to ever name a planner.
    (h) **Documentation defect, free to fix**: §8.6 and item 27 both read as if
    the energy search has NO split-around-rest move. It has one — `neighbors`
    splits at the snapped midpoint, gated on spare lattice room. The real gap is
    "midpoint-only, and only with room", which changes item 27's premise. Fix
    the wording wherever item 27 is next touched.

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

21. **Destination preview for a defer** — before you send a task to tomorrow,
    see what tomorrow already looks like: the destination day's task count,
    budget and funded set after the move, read-only, from the one extra session
    read `moveTaskToTomorrow` effectively already needs. **No Δ% pair** — see
    item 8. **Probe:** is the destination day non-empty often enough to earn a
    row? **Kill if tomorrow has 0 tasks and 0 budget on >80% of real defer
    moments** — item 16 is what makes it non-empty. **Prereq:** 16.
22. **Chronic-slide badge** — "this has been on your list 6 days".
    `moveTaskToTomorrow` copies `createdAt` verbatim
    (`session-store.svelte.ts:568`), `Task.createdAt` is an ISO date string
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
