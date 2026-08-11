# Roadmap

Fallow sits at a stable V1: two peer planning modes (the default Zenith
Gradient allocator and the Energy Lab), a full calibration loop (⚡ time-to-flow,
☕ recovery, 🪫 drain, stop-time λ₀), plan advice, the analytics audit, offline
PWA, en/de.

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
  exactly one caller (`energy/+page.svelte:161`), and `readFinishedDays` skips
  any date without a 🪫 log with `hours > 0`
  (`session-history.ts:180`, `:197`). A user who only ever opens `/` therefore
  contributes **zero** days to λ₀ (§8.10), the §12 audit and overnight
  carry-over (§11.9). Item 11 is the cheapest item here for that reason.
  **Closed 2026-08-10 by item 11:** `logDrain` has a second caller on the main
  page (`+page.svelte:99`), and every row on both screens now reads, corrects
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
and 13 and 14 are now display work on top of it — 13 names position 1 of the
re-planned order, 14 turns the same pool depletion §35 already computes into a
row. Neither needs a new solve.

11. ~~**Worked-hours instrument on `/`**~~ — SHIPPED 2026-08-09, and it was a
    smaller thing than this item claimed. Nothing about the data needed
    building: `EnergyObservationStore` is created once in the `(app)` layout and
    both pages already read it from context, so a 🪫 log has always been shared
    across the two screens — the button was simply only ever rendered on
    `/energy`. What shipped is the button, on both rows.
    **The symmetric half was the real finding.** If 🪫 belongs on `/` because
    the α, λ₀, §12 and §11.9 readings all run off worked hours, then ⚡ belongs
    on `/energy` for the same reason: `zenith-energy.ts` takes `UserConstants`
    in its curve builders, so the Lab's own plans are computed with ϕ constants
    only the main page could calibrate. Each screen was withholding an
    instrument the other's model consumes. Both measurements are now on both
    rows.
    **So it consolidated rather than added.** The two rows already shared
    `task-row-shell.svelte`; with the same two actions on both, the `actions`
    and `forms` snippets were identical in each caller, so the whole action
    strip, both measurement editors and the ✎ editor moved into the shell.
    `task-item.svelte` and `energy-task-row.svelte` are now their three reading
    snippets and the prop mapping around them. `canLogFlow` became `canLog`: the
    gate is `selectedDate === today` and both stores stamp an observation with
    the live clock's today, so the hazard it guards is the same for either
    measurement. `DrainDraft`/`newDrainDraft` moved to `measurement-prompt.ts`,
    which is what stops the two pages' draft records drifting apart again.
    **Completing a task now asks both questions**, stacked, each keeping its own
    policy — ⚡ goes quiet once measured (one number per day), 🪫 never does (one
    per session, MATH.md §18). The other change on `/energy` is the ⚡ badge,
    which moved into the shell from `task-item.svelte`: with both instruments on
    both rows and the strip hover-revealed, neither caller was saying at rest
    what it had already measured. 🪫 cannot badge — a task worked twice has two
    ratings — so it pinned the strip open instead, which is what the Lab's row
    did before and `/` then did too. **Superseded 2026-08-10:** a rating reads as
    one chip per session, which says it at rest without holding the strip open —
    and, being per-rating, is what let correcting and deleting one move onto the
    row it belongs to on both screens (AGENTS.md R3) — and, on 2026-08-10, let the
    cross-date reading the chips cannot give move to `/analytics`, which now prints
    every ⚡, 🪫 and ☕ as one dated list — the range it is viewed under by default,
    or all of them — and both of a measurement's verbs sit on its row there: ✕
    drops it, ✎ corrects it. The card resets the fit, the list holds the
    measurements, and this answers "what did I log". The three calibration cards
    stopped listing their own kind the same day — three partial answers to one
    question — and kept the fit's two verbs (`fit-log-summary.svelte`). ⚡ joined
    🪫 in being correctable on a PAST day the same week: the badge
    reads the day's own observation instead of a `flowMinutes` field on its
    session, so an amendment lands somewhere the auto-save is not asked to
    rewrite, and the field is gone. What let the ✎ leave the row at all is
    MATH.md §36: a correction rewrites the quantities the user rated and re-derives
    no covariate from the live task, so it needs no day in view — which is also the
    first correction ☕ has ever had, having no task and so no row to carry one.
    The ✓/✕ pair likewise has one owner
    (`measurement-form-actions.svelte`); the three editors had each grown their
    own, two with a hover surface and one without.
    **`DailyMetricsInput` was deliberately left alone.** This item planned to
    add today's logs to it (`metric/daily-metrics.ts:48-58` still has no
    worked-hours field), but nothing reads such a field until item 12 — it is
    12's input, and adding it now would ship a prop with no consumer.
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
12. ~~**Prefix-aware mid-day re-plan**~~ — SHIPPED 2026-08-10 (MATH.md §35).
    `calculateRemainingDay` (`metric/remaining-day.ts`) re-plans the OPEN tasks
    over the hours today's 🪫 logs leave, from a prefix: `buildBlockIncrements`
    continues at `Δᵢ(j) = P̄ᵢ(hᵢ+jδ) − P̄ᵢ(hᵢ+(j−1)δ)`, pools enter depleted at
    `Σ wᵢhᵢ` clamped at 0, and it renders as a second column beside the plan.
    The shape is the one this item specified — a store-level `$derived` on
    `DailyPlanStore`, gated on the viewed day being today AND on any hours
    existing — and the kill criterion is pinned as a store spec: logging hours
    moves no plan-scoped metric. `hᵢ = 0` is bit-identical to the cold solve,
    so §4, §5.1 and §34 are undisturbed and no existing plan moved.
    **The switch convention was the real finding, and BOTH options named above
    were wrong.** Charging a re-entry double-charges a task that simply
    continued; free re-entry _refunds_ the switches of a started task the
    remainder abandons, letting it buy blocks with a bill the day still owes.
    On days executed exactly to plan that manufactured a median **+6.67%** over
    finishing the morning plan, against this item's own expected ≈0 — the kill
    criterion caught it, one input wider than the plan-family test it was
    written for. The rule that survives is neither: the bill is charged over the
    **day's** funded set, `{worked} ∪ {newly funded}` (`AllocTask.isStarted`).
    Under it the on-plan control reads median **0.00%**, mean 0.01%, funded set
    differing on 6 of 400 days. The seam itself stays free, and that IS measured:
    charged re-entry median 0.00% / mean −0.45% against free's +0.34% / +4.23%.
    **The value is well below what this item hypothesised, and the gap is
    methodological.** Against a feasibility-matched baseline
    (`scripts/prefix-replan.probe.ts`, seed `0x9e12ab`, 400 days): median
    **+1.76%** of day `Σ P̄` vs the cold re-solve the budget slider gives, mean
    3.74%, p90 9.57%, never negative; median **+1.21%** vs the morning plan's
    remainder; funded set differs from cold on **44.75%** of days. The +5.8–7.8%
    and 81% quoted above reproduce only if the baselines are left **infeasible**
    — `Σ P̄` prices neither pools nor switches, so an arm ignoring them outscores
    one respecting them for free (§19, one level down). The strongest number is
    not a percentage: over those 400 days the re-plan needed **0** feasibility
    trims against the cold solve's 270 and the morning remainder's 359. The
    alternatives mostly propose spending capacity the morning already burned.
    Still ~24× §17's ϕ anchor and the same order as item 15's enjoyment default.
    Cost measured at **12.4 ms**/solve at n = 12 and **0.001 ms** when nothing is
    logged, which is what makes the gate rather than an on-demand method viable.
    No new store, no new input beyond 11, no `DB_VERSION` bump.
13. ~~**"You are here" on the run order**~~ — SHIPPED 2026-08-10 (MATH.md §35).
    `RemainingDay.nextTask` is position 1 of `calculateInterleavedOrder` over the
    funded remainder; `next-up-line.svelte` renders it above the list on `/`. It
    labels, it does not recompute — `argmax Δᵢ(1)` is a different task, because
    the allocator buys a funded _subset_ under a switch bill and two pools, and
    two definitions of "next" is the R3 failure this item named. No new solve, no
    store change: 12's `$derived` already had the allocations.
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

_Settled 2026-08-09, not a roadmap item:_ both halves of `importFromDate` /
`importYesterday` are intended and stay. Copying a completed task in as a fresh
incomplete one IS the point of "import yesterday", and importing a title that is
already on today's list is allowed to produce two rows — no dedupe against the
day's tasks, no filter on `completed` (`session-store.svelte.ts:638`, `:669`).
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
    (`+page.svelte:226`), and a deferred task lands in an unplanned day. Not a
    precision claim — it is the instrument item 21 needs.
17. ~~**Switch-cost price diagnostic**~~ — SHIPPED 2026-08-04 (MATH.md §14.3):
    `switchCostPrice` on `PlanAdvice`, two extra solves at `s = 0` and `s = 2s`
    inside `suggestPlanAdjustments`, one quiet line on the advice card. The
    gate cleared by 8×: the kill criterion was a median |Δ value| under ~1%
    between `s = 0.25` and `s = 0.5` on 2–4-task days, and the measurement
    through the real solver is **8.47%** over the fixture's 180 such days,
    **8.14%** over the author's own four logged days (unrecorded — the only
    figure here with nothing behind it), and **18.77%** on 5+-task
    days. Constant-independent (8.50% under the fixture's own ground-truth ϕ
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
    monotone (195 violations on 115 of the 298 fixture days × 101 `s` values),
    median one-day bracket width 0.50 h against a [0,1] h range with 25% of days
    consistent with the entire range, and one mis-counted task shifts the
    bracket edge by median 0.34 h off opt-in logs.
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
    its date via `fitUserConstants` (`zenith.ts:1736`) and record the residual
    against the fitted plane, against `DEFAULT_USER_CONSTANTS`, and against the
    ±1σ band from `phiPredictionStd` (`zenith.ts:1883` — exported, documented
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
27. **§8.6's missing off-midpoint rest split** — the energy search _can_ split a
    funded block around an interior rest, but only at the rounded midpoint and
    only when the window has a spare step (`neighbors`, 2026-08-06 audit); the
    split it needs is off-midpoint, and splitting then re-growing is downhill in
    between. Measured 2026-08-06 against the **exhaustive** optimum
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
    **(b)–(f) were settled by the MATH.md claim audit of 2026-08-06** — each
    now has a committed probe and a corrected section, noted inline below. The
    residue is (a), (g) and (h).
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
    **283/300** (`scripts/mode-cross-scoring.probe.ts`, seed `0x290729`); §16's
    median holds at **+0.47%**, p90 +1.50%, max +3.96%
    (`scripts/mode-run-order.probe.ts`).
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
    (`zenith.ts:920`, `:649`) and `calculateTotalProductivity`
    (`zenith.ts:1271`), which is what Zenith Gain and the §12 audit score with.
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
    (`task-item.svelte:203-205`); `SavedRoutine.tasks` shares `taskCore`
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

All 65 were then triaged against the code they name: **34 dropped**, **18 open**
below, and **13 fixed** in the commit that carries this line — F8, F24, F28, F31,
F32, F39, F41, F42, F46, F48, F49, F55 and F62, named here so a reference to one
resolves to "done" rather than "lost".

One error dominated the raised set and is worth knowing before trusting anything
here: "nothing enforces this", written without opening the story or e2e file that
did. Of the seventeen "contracts held by convention only", eleven dropped, and
seven of those went because a named test had pinned them all along. Look for the
test before believing that phrase.

### Open — make the contract enforced

- **F2** `task-row-shell.svelte`, `drain-log-form.svelte`,
  `flow-log-form.svelte`, `rest-log-form.svelte`, `task-edit-form.svelte` — the
  forms copy `seed`/`focusMinutes` at mount and none rejects a re-seed in place,
  so every re-open must be a fresh mount. Four component comments state that
  contract and no rules file does, which is what a comment sweep erases. The
  drain half is pinned (`e2e/energy-lab.e2e.ts`, "the ✎ re-seeds a drain editor
  the row already has open") and log-history-list's `{#if editingKey === row.key}`
  sits inside a keyed `{#each}`, so it cannot re-seed in place either. The fix is
  one bullet in presentation/AGENTS.md's Components list and the four comments cut
  to a citation of it — not a runtime guard.
- **F4** `measurement-form-actions.svelte` — `ondelete?`, `deleteLabel?` and
  `deleteTitle?` are three independent optionals, so the type permits a 🗑 Button
  whose `aria-label` is `undefined`, named to a screen reader by the bare emoji.
  All three callers pair them and presentation/AGENTS.md states the rule in prose,
  but nothing mechanical holds it: no story queries the 🗑 by name, and axe cannot
  flag it because the emoji supplies an accessible name. Replace the three
  optionals with a union — one branch all-absent, one requiring both strings,
  keeping `ondelete: (() => void) | undefined` so the `cond ? undefined : ondelete`
  call sites still type-check.
- **F11** `day-constraints-bar.svelte` — two counts on one panel: `modelStatus`
  quotes `countedLogs` (fit-visible) while `FitLogSummary` gets `count`,
  `confirmLabel` and the reset from `flowLogs.length` (all logs), and the rule
  lives in a comment, not the types. Both are right today, but "Personalized from
  3 logs · 1 pending" beside "Reset 4 logs?" looks like the bug it isn't. Add an
  open-panel story with `pendingFlowLogs: 1` asserting both numbers, and name the
  two locals so the rule reads off the props.
- **F16** `day-constraints-bar.svelte`, `energy/+page.svelte` — one persisted
  value with two independent bound declarations: `BUDGET_BOUNDS = { min: 0, max:
24, step: 0.25 }` feeds the field and slider on the bar, while the Lab's
  `window-hours` row hand-writes `min={0} max={24} step={0.25}` over the same
  `session.availableHours`. Only `step` is tested (`e2e/energy-lab.e2e.ts`), and
  `session-store.svelte.ts`'s setter neither clamps nor validates, so there is no
  backstop below them. Change `BUDGET_BOUNDS.max` and the Lab keeps writing values
  the main page can no longer display or correct. Export the one constant and
  import it at both sites — which is what the comment above it already claims it
  exists for, one caller short.
- **F19** `budget-curve-chart.svelte`, `energy-chart.svelte` — each legend
  restates by hand what the SVG draws: dash patterns written twice with no shared
  source (`7 4` against `0 7px, transparent 7px 11px`; `5 3` against
  `5px … 5px 8px`; `2 3` against `2px … 2px 5px`), and `bg-brand/20` against the
  area's `fill-brand/20`. Retune a line and its swatch stays on the old pattern.
  Export one dash spec per series from a presentation util, derive both the
  `stroke-dasharray` and the `repeating-linear-gradient` from it, and assert in a
  play that a swatch's on-length equals its line's dash-length.
- **F21** `scripts/hover-contrast.mjs` — the script reads `THEMES` out of theme.ts
  precisely so a hand-copied list cannot go stale, then hand-copies `VARIANTS`,
  which already has: `ButtonVariant` and the `ui-button--variants` story both
  carry six, and `ghost` and `link` are never measured. `ghost`'s entire visual
  state is its hover fill (`hover:bg-surface-hover`) and no theme's is checked,
  while the file's opening line claims it covers every button variant. Add
  `ghost`, exclude `link` with a one-line reason, then correct the residue count
  and the "× 4 variants" line in STYLE.md and the coverage sentence in
  docs/testing.md.
- **F22** `task-form.svelte` — `handleTitleInput` restores three `DEFAULT_RATING`
  fields by hand; the set it must revert is exactly what `pick()` writes, and
  nothing ties the two lists together. Add a fourth rating to `TitleRating` and
  `pick()`, and clearing the title leaves that field at the picked value — the new
  task deploys under a rating nobody gave it. Rebuild from `emptyDraft()` keeping
  the live title and `mustDoToday` so the revert set is type-total, and add a story
  that picks a suggestion, clears the field, and asserts all three sliders are 5.
- **F23** `flow-log-form.svelte`, `drain-log-form.svelte` — whether 🗑 appears is
  decided twice: the forms re-derive it (`seed === null`,
  `draft.recordId === undefined`) after task-row-shell has already decided by
  passing `ondelete` or `undefined`, and log-history-list passes none at all. The
  two authorities agree only by accident. Pass `{ondelete}` straight to
  `MeasurementFormActions` and move the ⚡ gate up to the shell; the behaviour is
  already covered by five existing plays.
- **F26** `analytics/+page.svelte` — `editLog` builds the row key as
  `${kind}-${id}` while `logHistory` builds `row.key` as `flow-${id}` /
  `drain-${id}` / `rest-${id}`, and `LogHistoryList` compares the two strings.
  Change the key format in log-history.ts and ✎ silently stops opening any row —
  same type, no error. Have `onedit` take `row.key`, the string the list already
  holds.
- **F33** `fit-log-summary.svelte` — `confirmingReset` is declared outside the
  `{#if count > 0}` block it is only meaningful inside, so an `$effect` exists
  solely to zero it when `count` hits 0. Nothing misbehaves; the confirm step's
  lifetime is enforced by a second mechanism instead of by the block that renders
  it. The cheaper half is a spec that names the rule the effect encodes — render
  at 3, open the confirm, rerender at 0 then 3, assert the confirm is gone and the
  trigger is back — rather than extracting a child component.

### Open — refactors, one commit each

- **F10** `day-constraints-bar.svelte` — the budget field accepts off-quarter
  values by design (MATH.md §14.1) but the slider binds `step={BUDGET_BOUNDS.step}`,
  and a range input sanitizes its DOM value to the nearest step. Type 6.4 h and the
  field reads 6.4 while the thumb sits at 6.5 — two controls over one value
  disagreeing. Decide where quarter alignment lives: `step="any"` on the range so
  the thumb tracks the true budget, or round at the two `session.availableHours =`
  apply sites. Pin it with a story on an off-quarter budget, and correct MATH.md
  §14.1-2's "the card has no Apply for set-budget" sentence.
- **F20** `tooltip-provider.svelte` and its callers — `delayDuration={150}` is
  hand-copied at twelve `Tooltip.Provider` call sites (eleven in components and
  routes, one in the tooltip story) while `tooltip-provider.svelte` defaults the
  prop to 0. Changing the app's hover delay means finding all twelve, and a site
  that misses the prop silently gets a 0 ms tooltip. Default it to 150 and drop
  the prop everywhere, recording the deviation beside STYLE.md's `shadcn add
sonner` note — `shadcn add tooltip` would revert it. No story or e2e asserts a
  tooltip delay, so the one site that currently inherits 0 changes silently and
  breaks nothing.
- **F37** `task-row-shell.svelte` — one flag, two names: `withMustDoToday` on the
  shell, `showMustDoToday` on task-edit-form / task-form / task-form-fields, with
  the shell translating between them. Grepping either name finds only half the
  chain from `withMustDoToday={false}` on the energy row to the hidden checkbox.
  Rename inward to `withMustDoToday` (booleans are `is`/`has`/`with`), collapsing
  the shell's forward to `{withMustDoToday}`. Lands with F18 — same doc paragraph.
- **F54** `task-item.svelte` — both branches of the trailing snippet's `{#if replan}`
  print the priority line and open `m.task_allocation_tooltip()`, in two different
  trigger structures (two sibling triggers against one trigger wrapping two spans),
  so a change to the small line has to be made twice. Collapse to one structure —
  a primary span and one secondary span whose `plan … ·` prefix is conditional —
  and re-point the four replan stories at it.
- **F61** `analytics/+page.svelte` — `profiledDays` sums `quadrantCounts` in the
  route and hands the sum to `QuadrantDistribution` as a `total` prop the component
  could derive from the `counts` it already receives. One caller today; a second
  passing a `total` that disagrees with `counts` would draw a bar whose segments
  miss 100%. Drop the prop, derive inside, and "Segments tile the bar" then pins a
  structural invariant.
- **F64** `energy-task-row.svelte` — the row's edit callback is `onchange` outward
  and `onupdate` inward, while task-item.svelte forwards the same shell callback as
  `onupdate`. One callback under two names across the two task rows, so a grep for
  `onupdate` misses the energy row. Rename to `onupdate`; the energy page's other
  control callbacks stay `onchange`, which is why this one reads as arbitrary.

### Open — needs a decision before it can be worked

- **F18** `task-row-shell.svelte` — presentation/AGENTS.md states the shell rule
  twice and the two statements disagree: "do not give the shell a mode flag"
  against the settled "must-do checkbox is hidden in both of the Lab's forms",
  which is only reachable through `withMustDoToday`, a prop the doc never names. A
  reader enforcing the first sentence deletes the prop and un-hides the Lab's
  checkbox; a reader enforcing the second adds more pass-throughs. One of the two
  sources has to name the carve-out. Rewrites the same paragraph as F37.
- **F47** `plan-advice-card.svelte` — three `class:` directives (`border-t`,
  `border-line-soft`, `pt-text-xs`) repeat the same `option.isUnpriced` condition
  to apply one rule-off treatment, and can be edited apart so the rule appears
  without its colour or its padding. STYLE.md:206 points at `cn` for a conditional
  cluster, but task-row-shell.svelte:153-154 uses the same multi-directive idiom —
  so either this becomes the repo's second convention, or `class:` gets an explicit
  carve-out in STYLE.md. Sweeping every site is a larger change than the finding.

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
not close it: `(app)/+page.svelte` deliberately passes open-without-save on past
days, so that pairing is intended, not an accident.
