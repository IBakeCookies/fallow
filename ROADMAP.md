# Roadmap

What is next and what was refused. Derivations live in [MATH.md](MATH.md), what
the code does today in the area `AGENTS.md`. Settled decisions are in AGENTS.md
§4's decision index — notably the three roads deliberately not taken: the energy
model stays a peer mode, never a replacement, run order stays the
nature-alternation heuristic, and ϕ stays one plane for all tasks. Do not
re-open those here.

Phases are priority order. Item numbers and finding ids are stable and cited
from elsewhere (`constraint-memory.ts` cites item 32, the suite cites M44), so
they are
never reused; phase numbers are not cited and were re-cut on 2026-08-04 when
items 11–23 were added. Update this file when an item ships or is rejected.

**A shipped item or a closed finding collapses to its date and a link** — to
the test file that carries its scenarios (`/plan` writes them; before
2026-09-12 that was `docs/features/<slug>.md`, and those links stay), or, for a
finding with no test, to the file that owns it: MATH.md, the area `AGENTS.md`'s
settled decisions, the probe header. What was decided and rejected goes to the
landing commit, and to the settled decisions when it closes a question someone
would re-open. An entry here never describes how the code works today: that is
MATH.md and the area `AGENTS.md`, and a claim about current behaviour written
here is the one that rots (2026-08-13 sweep: 14 of 161). Collapsing was skipped
often enough that on 2026-08-21 the file was 1650 lines, half of them closed
records.

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
  `switchCost` (`zenith.ts:92` is a bare literal with a CHI-2008 citation) or
  the difficulty sliders — and probes put each of those an order of magnitude
  above ϕ. Phase 2 exists to close that inversion.

**Read every percentage in items 11–23 as a hypothesis, not a result.** They
come from throwaway ideation probes run on 2026-08-04 against synthetic days;
none is in MATH.md, none was re-run against real logs, and several are
explicitly circular where noted. Each item states the probe that would
establish or kill its own number. Run it before building, per §17's precedent.

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

13. ~~**"You are here" on the run order**~~ — SHIPPED 2026-08-10. Caveat closed
    2026-09-06: the alternation takes a predecessor.
    [docs/features/the-alternation-that-forgot-what-you-just-worked.md](docs/features/the-alternation-that-forgot-what-you-just-worked.md)

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
day's tasks, no filter on `completed`. The consequence to keep in mind, since 🪫 logs key on `taskId`: two rows with
the same title are two tasks to every fit, and the hours logged against each
stay separate.

## Phase 2 — declared inputs the app can already infer

The inversion named above, in priority order. Measured framing for the whole
phase (400 synthetic days, 3–7 tasks, budgets {2,4,4,6,8}, real
`calculatePooledAllocations`, scored plan-under-θ̂ against score-under-θ_true):
ϕ off by +0.5 h on **every** task costs **0.074%** (the ϕ anchor);
one enjoyment point on **one** task **0.052%**; one task's mental demand off by
4 points **0.582%**; a pool 2× wrong **4.1–5.7%**; `switchCost` 2× too high
**10.1%**; every slider left at 5/5/5 **5.42%**; a day with one `high` task
planned with importance left undeclared **4.45%** — and, measured per grid cell
rather than at this scope, a `high` remembered on the WRONG task costs
**1.96–2.97×** what declaring nothing costs, in every cell
([the-weight-nobody-had-priced](docs/features/the-weight-nobody-had-priced.md)).
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
18. ~~**Capacity pools from the fitted drain rates**~~ — SHIPPED 2026-09-08 as
    a per-reservoir offer under each Day Setup pool field, declared with a
    press and never a prefill —
    [docs/features/the-pool-the-drain-logs-offer.md](docs/features/the-pool-the-drain-logs-offer.md).
    The map and its gate:
    [the-pool-the-drain-logs-might-know](docs/features/the-pool-the-drain-logs-might-know.md);
    why the gate stayed void:
    [the-pool-adherence-could-not-rank](docs/features/the-pool-adherence-could-not-rank.md),
    [the-margins-that-were-one-draw](docs/features/the-margins-that-were-one-draw.md).

Item 16 for the other two declared constraints, and the slot item 18's press
writes into:

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

   **One obligation outlived the closure, and it was not the censored likelihood**
   — BUILT 2026-09-01
   ([docs/features/the-breaks-the-fit-could-not-read.md](docs/features/the-breaks-the-fit-could-not-read.md)).

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
present — the first now measured, the second still open:

19. ~~**Prequential ϕ scorecard — the probe**~~ — MEASURED 2026-08-30 (MATH.md
    §5, `scripts/phi-prequential-skill.probe.ts`).
    [docs/features/phi-prequential-skill.md](docs/features/phi-prequential-skill.md)

20. ~~**Unfunded-task attribution**~~ — BUILT 2026-09-01
    ([docs/features/why-a-task-got-no-hours.md](docs/features/why-a-task-got-no-hours.md)).

The measurement answered item 19's gates and left its reading unbuilt, so the
reading is its own item:

34. ~~**The ϕ skill reading**~~ — the headline sentence SHIPPED 2026-09-02
    ([the-minutes-the-fit-was-closer.md](docs/features/the-minutes-the-fit-was-closer.md));
    the ± band half SHIPPED 2026-08-31
    ([the-band-beside-the-flow-time.md](docs/features/the-band-beside-the-flow-time.md)).

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
    call about what the number means and not another probe), (h) with item 27,
    and (g) on 2026-09-01 (MATH.md §9, `scripts/adherence-tie-band.probe.ts`).
    Each settled entry has a committed probe and a corrected section. Nothing is
    left open.
    [docs/features/the-verdict-band-with-no-noise-model.md](docs/features/the-verdict-band-with-no-noise-model.md)

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

Item 4's outstanding obligation — the Stopping Calibration card learning to
explain its own count — was met by two changes that never carried item 4's name:
the clock censor's line shipped 2026-08-21 with M42
([the-day-that-ran-out-of-clock](docs/features/the-day-that-ran-out-of-clock.md)),
the unread-breaks line on 2026-09-01
([the-breaks-the-fit-could-not-read](docs/features/the-breaks-the-fit-could-not-read.md)),
so a count that fell names the clock that cut it and the days it read at reduced
accuracy. The residue is narrow: a day dropped as one-sided or past
`STOP_INVERSION_MARGIN` is explained only when NOTHING fits, the fit exporting
no count of its own for those. The analytics card had the same gap on a
different number:

33. ~~**The "Your model" card names deferred logs for ϕ only**~~ — SHIPPED 2026-08-30.
    [docs/features/the-count-that-only-flow-explained.md](docs/features/the-count-that-only-flow-explained.md)

_Settled 2026-08-27, not a roadmap item:_ the Energy Lab's "Apply my fits"
button re-arming itself is not a calibration leak, and auto-applying is not the
fix. **Nothing outside `/energy` reads the Lab's sliders.** The day's plan
refits α and r from the logs on every derivation, anchored to the model defaults
rather than the sliders (`daily-plan-store.svelte.ts:52`); ϕ refits the same way
(`session-store.svelte.ts:201`); and the audit's per-day snapshots come from
`readModelReport`, never from the Lab (`analytics-store.svelte.ts:204`, `:227`).
So a user who never opens the Lab loses nothing — the plan, the metrics and the
history were never on those numbers. The one consumer of a stale slider is the
stop advisor (`energy-lab-store.svelte.ts:571`), which renders on the same
screen as the re-armed button, so the stale reading and the click that fixes it
are never out of sight of each other. Nor does the button re-arm on a schedule:
`fitsApplied` compares each param against `round2` of its fit, so a fit that has
stopped moving at two decimals stops asking, and the prompting is heaviest at
the low log counts where the fit is least worth trusting anyway. Auto-applying
would also have to overwrite manual slider edits with no provenance
distinguishing a fitted value from a user's, against §8.7/§8.9/§8.10's settled
"a fit never writes params silently"
([business/model/AGENTS.md](src/lib/business/model/AGENTS.md), line 198). Written
down because a button that re-arms itself reads as a bug from outside the call
graph — it was diagnosed as one twice before the consumers were checked.

Four leads from the 2026-09-04 next-work sweep, kept here rather than in a
findings block because each one is work somebody has to choose, not a defect
already understood. They sit in this phase because three of the four are the
same complaint as the phase itself one level down: an instrument that does not
say what it is believed to say. **Every figure quoted in them comes from an
uncommitted run** — item 29's rule applies, and each item names the committed
instrument that would establish or kill its own number before any build.

35. ~~**The light side's text ladder, sized from the corrected instrument**~~ —
    SHIPPED 2026-09-08
    ([the-ladder-the-instrument-never-sized](docs/features/the-ladder-the-instrument-never-sized.md)).
    Four of the five were light; `blueprint` is dark, and was the one residue —
    closed 2026-09-08,
    [the-well-that-climbed-under-white-ink](docs/features/the-well-that-climbed-under-white-ink.md).

36. ~~**The 12-task wall clock is one seeded day**~~ — FIXED 2026-09-08
    ([the-wall-clock-that-was-one-day](docs/features/the-wall-clock-that-was-one-day.md)).

37. ~~**Two blind spots in the verification chain**~~ — FIXED 2026-09-06
    ([the-rename-that-turned-off-every-check](docs/features/the-rename-that-turned-off-every-check.md)).
    The hook reads `--porcelain -z` and keeps a rename's first record; the
    quoted-path half of the same parse went with it. `tsconfig.tooling.json`
    joins `npm run check` over `scripts/**/*.ts` and `e2e/**/*.ts` and printed
    exactly the four errors the item predicted — the live one reads `undefined`
    rather than throwing, because Vite's SSR transform makes an unexported name
    a property access. The same repair closed a second route to that early exit
    the item did not name: a stop whose only change is a **deletion** also
    emptied the list, and a deleted module is what breaks `check`.
    `scripts/**/*.mjs` was left for M103, since closed.

38. ~~**`satietyScale`'s conditioning error on the λ₀ fit, priced beside V_T's**~~
    — CLOSED 2026-09-08
    ([the-second-slider-the-fit-conditions-on](docs/features/the-second-slider-the-fit-conditions-on.md)).

Two readings from the 2026-09-15 read of MATH.md. The chain now fits four
parameters and scores exactly one of them out of sample; these ask what the other
three are worth, and what the oldest known bias in them costs. **Neither carries
a figure** — no run has been made, and item 29's rule applies, so each names the
instrument that would establish or kill its own number.

39. **Prequential scores for the energy fits** — §5 walks the ⚡ history in date
    order and reports what the fitted ϕ plane was worth against the defaults (the
    "Your model" flow row). r, α and λ₀ have no such reading: each carries a
    posterior ± that §8.10's common-mode bullet and M108 say answers a narrower
    question than it looks like. The same walk is available for α — fit on the 🪫
    rows dated < d, predict day d's ratings, score against α₀ — and for r on the
    ☕ pairs. What it buys is the sentence the three calibration cards cannot say
    today: whether any of those fits has predicted anything. It is also the gate
    the c₃ flip (§1) and §5.2's recency scope both wait on, both being
    out-of-sample questions about parameters with no out-of-sample score. The
    machinery exists — §5's prequential convention and the §33 causal window — so
    this is a probe, and a model change only if a fit is measured to lose to its
    own prior.
40. **Price the chained start level for the α fit** — §8.7's fresh-start
    assumption reads every 🪫 session as beginning at a full reservoir and biases
    α upward, and that bias has the longest reach in the model: α sets the
    capacity pools (§8.13), conditions λ₀ (§8.10), and orders the per-title
    ranking (§8.14, which only sidesteps it by keeping each day's earliest row).
    §8.7 names the repair — start each row from the previous row's own rating,
    recovered over the idle hours between their `createdAt`s — and
    `scripts/circadian-residual.probe.ts` prices it only for the hour-of-day term
    it was built for. Its price for α's own bias is unmeasured. Read it on that
    same instrument before any fit moves; what the measurement has to beat is the
    trade §8.7 already states (the previous rating's own noise, and assuming
    nothing unlogged drained the reservoir in between).

_Closed 2026-09-15 in MATH.md §8.10, not built:_ the day's START, which that
section had called unrepresented since it was written. It is not a gap —
`availableHours` is intended work rather than a span of the clock
([presentation/AGENTS.md](src/lib/presentation/AGENTS.md), the same decision that
bars a time of day from the plan axis), so no window-start moment exists to be
late of, and what would represent one is a declared start time: a second input
for a lever the user already owns by declaring fewer hours. What the section now
carries instead is where the two units meet — both stop readings measure a clock
span against a work budget.

_Checked 2026-09-15 and not an item:_ `satietyScale` has no instrument and
probably cannot have one. It is the largest unfitted knob the fitted parameters
condition on — §8.10's feasibility 2 conditions λ₀ on it, and item 38 priced what
a mis-set one costs — but fitting it needs observed OUTPUT, where every
instrument the app has records hours and ratings. Written down so the hole reads
as a bound on λ₀'s accuracy rather than as a fit somebody forgot.

## Phase 4 — multi-day horizon

7. **Satiety across days** — BLOCKED, and not the small item it reads as.
   Reservoirs already carry over overnight (`seedMorningReservoirs`, and
   [model/AGENTS.md](src/lib/business/model/AGENTS.md) on which reads are state
   rather than identity); satiety still resets at
   midnight, so yesterday's 7 h of guitar doesn't temper today's κ. But the
   mechanism is unavailable: `seedMorningReservoirs` receives only
   `{id, cognitiveDemand, physicalDemand}`,
   while per-task satiety needs that task's `refOutput` from `buildCurves`,
   a quadrature over difficulty **and enjoyment**, which
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

The carry-over that did ship has no MATH.md section: the §0–§10 cut dropped the
old §11.9, so `seedMorningReservoirs`' formula — simulate yesterday's rows from
full reservoirs, then rest for the remainder of a fixed 24 h cycle — now lives
only in the code, against R7. The item below is where it gets one, because it
changes the anchor that section would state.

41. **The overnight gap the rows can already measure** — `RESERVOIR_CYCLE_HOURS`
    anchors work-start to work-start, and its comment gave as the reason that no
    clock times are stored. They are: `DrainObservationRecord.createdAt` is
    required on every 🪫 row, and §8.10/§8.11 read exactly those moments to
    recover a day's own breaks — so the gap from yesterday's last session to
    today's first start is readable, with the same fallback shape §8.10 uses for a
    day whose moments are unusable. Both errors are reachable under the fixed
    cycle (a late finish with an early start is credited rest it never had; a long
    night is credited less than it took), so this is a bias fix of unknown size:
    price it on a probe first, since the seeding's own docblock holds that
    carry-over is visible only where the ☕ fit says recovery is slow. Unlike item 7 it needs no curve
    rebuild and no cross-day task identity — the rows carry their own demands.

## Phase 5 — the lever the objective lacks

23. ~~**Task importance weight — `Σ vᵢ·P̄ᵢ(tᵢ)`**~~ — SHIPPED 2026-08-31 (MATH.md §0).
    [docs/features/task-importance-weight.md](docs/features/task-importance-weight.md)
    Its price measured 2026-09-03, and the reach argument it shipped on
    corrected: [docs/features/the-weight-nobody-had-priced.md](docs/features/the-weight-nobody-had-priced.md)

## Phase 6 — product and reach

Only if Fallow grows users beyond its author.

9. **Weekly retrospective digest** — the plan-adherence audit and the calibration
   snapshot, summarized per week in analytics.
10. **Sync** — default no (the no-server stance is a feature); revisit as
    file-based export/merge if a second device becomes a felt need.
11. **The example day a shared link opens on** — built 2026-08-31,
    [demo-day.md](docs/features/demo-day.md).

## Phase 7 — the curve itself

Last because it is a revision and not an item: it re-prices every plan, re-scores
every stored day, and changes what a slider means.

42. **`a = E·β`'s inverted-U** — §7 keeps the v1 peak amplitude monotone in
    effort, records that flow research puts an inverted-U in challenge instead
    (Peifer et al. 2014, §10), and says the change "deserves its own revision".
    It is the last untouched modelling direction in the classic model, and the
    consequence of leaving it is stated rather than hidden: peak height grows
    without bound in difficulty, so the hardest thing a user declares is always
    their most valuable hour. Any attempt needs its own before/after instrument
    over real declared days — the figures the suite pins today were all read at
    the monotone `a`, so a swap that keeps them green has not been measured, it
    has been fitted to.

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
  and there is no lever the user owns in response. Only the ± band survives, and
  it shipped 2026-08-31
  ([the-band-beside-the-flow-time.md](docs/features/the-band-beside-the-flow-time.md)).
- **Fit-vs-default plan diff; a funded-set robustness sweep; the information
  value of the next ⚡ log.** Redundant with the ϕ skill reading
  ([the-minutes-the-fit-was-closer.md](docs/features/the-minutes-the-fit-was-closer.md))
  or expected to
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

**A lead below that quotes a `MATH.md` line number quotes it as of the date its
entry carries**, and the 2026-08-27 collapse left none. Grep the quoted text,
never the line: each lead has to be re-located when its own check is run anyway,
and a re-guessed line number reads as verified when only the quoted text is.
That drift is what M1, M3 and M11 each found in `MATH.md`'s own citations, and
AGENTS.md §0 now bans the shape outright.

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
- **M17 §13.4 — closed 2026-08-27, not fixed, [`the-third-site-deleted-with-its-section`](docs/features/the-third-site-deleted-with-its-section.md).**
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
- **M34 §8.12 — closed 2026-08-26, [`the-seeding-the-probe-never-re-ran`](docs/features/the-seeding-the-probe-never-re-ran.md).**
- **M35 §8.12 — closed 2026-08-27, [`the-witness-that-outlived-its-section`](docs/features/the-witness-that-outlived-its-section.md).**
- **M36 §8.12 — closed 2026-08-18, [`what-the-registry-holes-were-hiding`](docs/features/what-the-registry-holes-were-hiding.md).**
- **M37 §33 — closed 2026-08-21, [`the-lab-fit-that-read-todays-logs`](docs/features/the-lab-fit-that-read-todays-logs.md).**
- **M38 §8.10 — closed 2026-08-19, [`the-bracket-that-inverted-on-a-day-it-kept`](docs/features/the-bracket-that-inverted-on-a-day-it-kept.md).** Shipped as a model change (MATH.md §8.10, §8.11, §10); the residual it left is M42.
- **M39 §8.11 — half-closed 2026-08-19, closed 2026-08-27, [`the-censor-that-does-not-run-forward`](docs/features/the-censor-that-does-not-run-forward.md).**
- **M49 §8.11 — raised and closed 2026-08-27 by M39, [`the-sweep-that-missed-two-generators`](docs/features/the-sweep-that-missed-two-generators.md).**
- **M50 — raised and closed 2026-08-27 by the M49 residue, [`the-tenth-copy-of-a-day-declared-once`](docs/features/the-tenth-copy-of-a-day-declared-once.md).**
- **M51 — raised and closed 2026-08-27 by the M49 residue, [`the-pair-that-could-not-be-matched`](docs/features/the-pair-that-could-not-be-matched.md).**
- **M52 — raised and closed 2026-08-27 while closing M17, [`the-rule-that-outlived-its-document`](docs/features/the-rule-that-outlived-its-document.md).**
- **M53 — closed 2026-08-27, [`the-references-the-checker-could-not-see`](docs/features/the-references-the-checker-could-not-see.md).**

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
- **M47 §8.6 — closed 2026-08-27, [`the-cap-that-outlived-its-measurement`](docs/features/the-cap-that-outlived-its-measurement.md).**
- **M54 — closed 2026-08-27, DECIDED FOR, [`the-fourth-task-the-pair-seeds-could-not-see`](docs/features/the-fourth-task-the-pair-seeds-could-not-see.md).**

- **M48 §8.1 — closed 2026-08-27, [`the-extreme-that-had-never-declared-itself`](docs/features/the-extreme-that-had-never-declared-itself.md).**

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
  Size is not the problem. ~~A properly powered condition comparison needs
  n = 60 runs per arm.~~ That number now comes off the sweep instead of standing
  as prose — fixed 2026-08-31,
  [`the-sweep-that-could-not-have-decided`](docs/features/the-sweep-that-could-not-have-decided.md):
  `eval/analyze.mjs` prints each comparison's own detectable difference and
  required n, and the three `targeted`-vs-`monolith` sweeps ask for 60, 23 and 42
  runs per arm against the six they ran. **No arm has been widened**, so no
  comparison here has been decided; what changed is that a sweep now says so.

  **Two of those three numbers, and the SD 39 above, were read off contaminated
  runs** — corrected 2026-09-02,
  [`the-arm-wide-enough-to-size-the-next`](docs/features/the-arm-wide-enough-to-size-the-next.md).
  Nothing filtered `notes`, so a refused tool or a dead agent scored as a broken
  rule. The n = 60 and the SD 39 both come from `2026-08-19T19-48-11.317Z`,
  **all twelve of whose runs are contaminated** — it is the pre-container
  allowlisted sweep `eval/README.md` already calls zero usable rows, with the
  sign that favours rule-ignorance. So "size on the largest" named the one sweep
  that measured the permission layer. The n = 42 sweep loses 2 runs of 12 and
  asks n = 46 with 0 pairs; only the n = 23 sweep was ever clean. `analyze.mjs`
  now drops a noted run whole and prints the count. **Still no arm widened**: an
  attempt on 2026-09-02 banked 27 clean runs of 60 before the agent under test
  stopped executing, with three of six cases scoring nothing, and no figure is
  claimed from it.

## Findings from the 2026-08-25 `SessionStore` review

A read-only review of [`session-store.svelte.ts`](src/lib/business/store/session-store.svelte.ts)
and its collaborators. The **S** ids are stable and never reused. Six findings
and one nit were raised; **S1, S2, S3 and S6 were upheld and closed on this
branch**, S4 and the nit were dropped, and S5 was dropped as stated but left a
real residue. Both it and the refactor S1 left were fixed on 2026-08-31, and
nothing here is open.

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

- ~~**Pool absence does not survive a rewrite.**~~ The residue of S5 — fixed
  2026-08-31,
  [`the-absence-a-rewrite-declared`](docs/features/the-absence-a-rewrite-declared.md).

- ~~**One predicate, three spellings.**~~ The residue of S1 — fixed 2026-08-31,
  [`the-predicate-with-three-spellings`](docs/features/the-predicate-with-three-spellings.md).

## Findings from the 2026-08-26 scenery gutter

- ~~**`cathedral`'s rose window still needs a redraw, and until it gets one it is
  the worst-lit thing on `/`.**~~ — CLOSED 2026-09-08 without the redraw,
  [the-window-that-lit-the-labels-under-it](docs/features/the-window-that-lit-the-labels-under-it.md),
  then the window itself replaced by its light on 2026-09-09,
  [the-light-the-window-left-on-the-sill](docs/features/the-light-the-window-left-on-the-sill.md).
  The 2026-09-04 re-read's three-arm run decided it; the 1.00:1 readings this
  finding was priced on did not reproduce.

## Findings from the 2026-08-27 branch review

The twelve commits that closed M17, M33–M35 and M47–M54 were reviewed together
rather than one at a time, by nine readers and one told to refute what they
found. **Nothing shipped was wrong.** Every finding below is a claim in a probe
header, a code comment, a rules file or a row of this file — which is the class
of defect those twelve commits were themselves closing, so the review is the
same sweep run once more over its own output.

Each row is its date and its link, per this file's own preamble. What was found
and what it cost is in the spec.

- **M75 — the discarded-sweep failure, cited to a document that no longer shows
  it — fixed 2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M76 — the reachability rule's own `makeTask` census — fixed 2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M77 — a pre-cut MATH.md size no revision ever had — fixed 2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M78 §8.12 — the cap the copy names against the cap it checked — fixed
  2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M79 §8.12 — the rejected seeding's fifth site, in the banned past tense —
  fixed 2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M80 §8.6 — the docblock M47 cleaned and M54 dirtied again — fixed
  2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M81 — eight alignments credited as nine, on two wrong dates — fixed
  2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M82 §8.12 — three off-default constants declared where four differ — fixed
  2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M83 §8.10 — a percentage of a constant the code did not read — fixed
  2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M84 — the seventh of M50's eight excluded call sites — fixed 2026-08-27,
  [`the-sites-the-sweeps-walked-past`](docs/features/the-sites-the-sweeps-walked-past.md).**
- **M85 — twelve closed rows that kept their narratives and their figures — fixed
  2026-08-27,
  [`the-rows-that-kept-their-figures`](docs/features/the-rows-that-kept-their-figures.md).**
- **M86 §8.11 — a quotation attributed to a section that never held it — fixed
  2026-08-27,
  [`the-rows-that-kept-their-figures`](docs/features/the-rows-that-kept-their-figures.md).**
- **M87 §8.12 — a control read as 265 named knees — fixed 2026-08-27,
  [`the-rows-that-kept-their-figures`](docs/features/the-rows-that-kept-their-figures.md).**
- **M88 — a completeness claim that was false when made: 35, not 34 — fixed
  2026-08-27,
  [`the-rows-that-kept-their-figures`](docs/features/the-rows-that-kept-their-figures.md).**
- **M89 — a scan described as something it was not — fixed 2026-08-27,
  [`the-rows-that-kept-their-figures`](docs/features/the-rows-that-kept-their-figures.md).**
- **M90 §8.6 — two rows asserting two values for one measurement — fixed
  2026-08-27,
  [`the-rows-that-kept-their-figures`](docs/features/the-rows-that-kept-their-figures.md).**
- **M55 §8.1 — a bound claimed pointwise, on a sweep that was never committed —
  fixed 2026-08-27,
  [`the-bound-that-only-held-past-nine-hours`](docs/features/the-bound-that-only-held-past-nine-hours.md).**
- **M56 §8.1 — both halves of the reason for keeping the off-surface witness —
  fixed 2026-08-27,
  [`the-bound-that-only-held-past-nine-hours`](docs/features/the-bound-that-only-held-past-nine-hours.md).**
- **M57 §8.1 — a header quoting a claim MATH.md never carried — fixed
  2026-08-27,
  [`the-bound-that-only-held-past-nine-hours`](docs/features/the-bound-that-only-held-past-nine-hours.md).**
- **M58 §8.1 — the ϕ floor described as a point where it is a region — fixed
  2026-08-27,
  [`the-bound-that-only-held-past-nine-hours`](docs/features/the-bound-that-only-held-past-nine-hours.md).**
- **M71 — five numbered MATH.md citations the section-sign filter hid — fixed
  2026-08-27,
  [`the-citations-the-section-sign-hid`](docs/features/the-citations-the-section-sign-hid.md).**
- **M72 — the wall clocks the band rule did not reach — fixed 2026-08-27,
  [`the-citations-the-section-sign-hid`](docs/features/the-citations-the-section-sign-hid.md).**
- **M73 — a deleted document's caption standing in a fifth header — fixed
  2026-08-27,
  [`the-citations-the-section-sign-hid`](docs/features/the-citations-the-section-sign-hid.md).**
- **M74 — M53's own describing sentence — fixed 2026-08-27,
  [`the-citations-the-section-sign-hid`](docs/features/the-citations-the-section-sign-hid.md).**
- **M91 §8.1 — one witness's curve read as a bound over the ϕ floor — fixed
  2026-08-27,
  [`the-witness-read-as-a-bound`](docs/features/the-witness-read-as-a-bound.md).**
- **M59 §8.11 — a refusal reason derived from the room-scaled rest where the
  shipped clock censor reads the uncapped one — fixed 2026-08-27,
  [`the-refusal-the-replica-mis-derived`](docs/features/the-refusal-the-replica-mis-derived.md).**
- **M60 §8.11 — a printed taxonomy that was not `stopBracket`'s, one branch of it
  unreachable — fixed 2026-08-27,
  [`the-refusal-the-replica-mis-derived`](docs/features/the-refusal-the-replica-mis-derived.md).**
- **M61 §8.11 — five censor figures a shipped `PAIR_SEED_TASKS` change left stale
  — fixed 2026-08-27,
  [`the-refusal-the-replica-mis-derived`](docs/features/the-refusal-the-replica-mis-derived.md).**
- **M62 §8.11 — a surface fix credited with a pre-existing docblock's stale
  off-surface baseline — closed 2026-08-27, not fixed,
  [`the-refusal-the-replica-mis-derived`](docs/features/the-refusal-the-replica-mis-derived.md).**
- **M63 §8.11 — four M49 cells that do not reproduce, two of them off-surface
  readings in a paragraph claiming the on-surface ones — closed 2026-08-27, not
  fixed,
  [`the-refusal-the-replica-mis-derived`](docs/features/the-refusal-the-replica-mis-derived.md).**
- **M64 §8.6 — a live rules file pricing `C(n,2)` against the wrong denominator —
  fixed 2026-08-27,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M65 — four wall-clock bands that did not survive a re-run of their own arm —
  fixed 2026-08-27,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M66 §8.6 — two ledger rows asserting two values for one measurement — raised
  and closed 2026-08-27 by M90,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M67 — four probe generators off the surface with no declaration, and a
  fixture declaring the opposite — fixed 2026-08-27,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M68 §8.6 — three statements restating their own code wrongly — fixed
  2026-08-27,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M69 — "every timing cell prints the half-range of its own reps", against the
  `[app]` rows — fixed 2026-08-27,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M70 — a rule-mandated declaration giving the wrong reason — fixed 2026-08-27,
  [`the-band-that-named-the-wrong-denominator`](docs/features/the-band-that-named-the-wrong-denominator.md).**
- **M92 — two declarations claiming a superset of the surface that is not one —
  fixed 2026-08-27,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**
- **M93 — an off-surface declaration with the direction wrong for one task —
  fixed 2026-08-27,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**
- **M94 — a worked example mis-describing its own evidence — fixed 2026-08-27,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**
- **M95 — a census wrong in two of its three cells — closed 2026-08-27, not
  fixed,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**
- **M96 — a collapse that deleted the only text a surviving rule referred to —
  fixed 2026-08-27,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**
- **M97 — a line-count reduction describing a size the file never had — closed
  2026-08-27, not fixed,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**
- **M98 §8.1 — an unscoped bound over the ϕ-floor regime, in the file M55
  rewrote to stop it — fixed 2026-08-27,
  [`the-repairs-that-needed-repairing`](docs/features/the-repairs-that-needed-repairing.md).**

## Findings from the 2026-08-28 free-time-value review

One question — on what basis does "Apply my fits" move the free-time value —
read against §8.10 and its probes. The fit reads worked minutes, log moments,
the checkbox and the window; a 🪫 rating reaches it only as the α it fits. What
was missing was the premise's own failure: the hours a day was COMPELLED to work
read as a leisure choice.

- **M99 §8.10 — obligation unnamed among the λ₀ fit's error sources, and the two
  repairs unpriced — fixed 2026-08-28,
  [`the-hours-that-were-not-a-choice`](docs/features/the-hours-that-were-not-a-choice.md),
  `scripts/stop-obligation-bias.probe.ts`.** The instrument is unbiased on
  honest days and reads λ₀ **low** on compelled ones — the direction that plans
  more work. Both available repairs lose to shipping nothing, so the estimator
  did not move: MATH.md §8.10 states the approximation, and the Stopping
  Calibration card's hint states the premise.

## Findings from the 2026-09-03 plan-value review

One question, asked of the shipped card — what do the percentages in "Adjust the
plan" mean? Every one of them is arithmetically right, and the sum they are
taken against, `Σ vᵢ·P̄ᵢ` (MATH.md §0), is named nowhere in the product. Read
against the objective and measured over the fixture year.

- **M100 — the advice card priced three readings in a unit it never defined, and
  bracketed the switch cost as a level — fixed 2026-09-03,
  [`the-unit-the-percentages-never-named`](docs/features/the-unit-the-percentages-never-named.md),
  `scripts/adv4-plan-value-vs-output.probe.ts`.** Copy only; no formula,
  constant, bound or fit moved.

## Findings from the 2026-09-04 next-work sweep

Eight lenses over the repo, each candidate screened against this file's refused
list and the per-area settled decisions before it was priced. Four candidates
were dropped as contradicting a settled decision. Two closed the same day; the
four that needed choosing are items 35–38, and two more amended entries already
here (item 18, and the 2026-08-26 `cathedral` finding).

- **The one instrument for the pair axe cannot see read the ink as opaque —
  fixed 2026-09-04,
  [`the-ink-the-instrument-read-as-opaque`](docs/features/the-ink-the-instrument-read-as-opaque.md).**
  The `cr` half of `inset-contrast.mjs` took the label's colour from computed
  style, so it printed the label's best case. The corrected run puts five light
  themes under AA. The colour repair is deliberately a separate change, sized
  from that run.
- **M101 — `NumberInput` was the one focused control with no ring — fixed
  2026-09-06,
  [`the-field-that-answered-a-tab-with-a-border`](docs/features/the-field-that-answered-a-tab-with-a-border.md).**
  The wrapper rings at `ring-2`; the 4-up bar needed no `has-focus-visible:z-10`,
  its columns being gapped rather than joined. A story `play` asserts the focused
  state, which is the state axe never reads. **The finding's reach sentence was
  wrong on its last clause**: the instrument inputs it named are raw
  `<input type="number">`, not `NumberInput`, so the wrapper ring cannot reach
  them — see M102.
- **M102 — the instrument fields answered a keyboard focus in a blue no theme
  declares — fixed 2026-09-06,
  [`the-ring-the-plugin-painted-blue`](docs/features/the-ring-the-plugin-painted-blue.md).**
  Nine raw fields across the 🪫, ☕ and ⚡ editors take
  `focus:ring-1 focus:ring-<channel>/60`, which is `field-input`'s shape. **The
  finding's own diagnosis was wrong**: it read the
  `outline-none focus:border-mind/60` recipe as the whole indicator, and the
  measured focused state
  carries `@tailwindcss/forms`' hardcoded blue-600 ring, which `outline-none`
  does not touch. The repair displaces that ring rather than adding a first one.
  Reported here, the ☕ length field's inline second definition of
  `MEASUREMENT_MINUTES_CLASS` — fixed 2026-09-08,
  [the-recipe-spelled-twice](docs/features/the-recipe-spelled-twice.md).
- **M103 — the `.mjs` half of `scripts/` was in no type-check program — fixed
  2026-09-06,
  [`the-scripts-nothing-type-checked`](docs/features/the-scripts-nothing-type-checked.md).**
  `tsconfig.tooling.json` drops `checkJs: false` and takes `scripts/**/*.mjs`;
  all 160 errors across 11 of the 13 files are closed. **None was live** — the
  question the finding left open. Two of them describe a reachable crash path,
  `boundingBox()` returning null in the two storybook instruments, and those two
  now throw naming the theme and the element; every other null is on a node
  created three lines above and takes a cast, not a branch. `ink-contrast.mjs`
  prints byte-identical output across the change, which is what licenses moving
  its `best` field inside `page.evaluate`.
- **The funded-subset enumeration priced every subset it could not use —
  closed 2026-09-04,
  [`the-subsets-that-could-not-win`](docs/features/the-subsets-that-could-not-win.md).**
  A pool-free upper bound skips the pooled solve on subsets that cannot beat the
  incumbent. The plan is unchanged against both committed falsifiers.

## Findings from the 2026-09-11 curve migration

The energy model moved to the classic model's v2 curve
([`the-curve-nobody-chose`](docs/features/the-curve-nobody-chose.md)), and the
two probes whose claims the change could falsify were re-run. Both records are
in the feature file; two readings became findings.

- **M104 — SHRINK-ONE + INSERT-ONE is uphill from the returned plan on 2 of 21
  audited days — raised 2026-09-11, FIXED 2026-09-14,
  [`zenith-energy.test.ts`](src/lib/business/model/zenith-energy.test.ts)
  ("transfers a step into a task the plan does not hold yet").** It is the
  transfer move with a destination that does not exist yet, which is what a
  spent window has to have to buy a task the plan is not holding. What it gains,
  what it costs and the narrowing that keeps the first while cutting the second
  are in `scripts/energy-search-gap.probe.ts`. **Gating the family to that spent
  window was priced on 2026-09-14 and refused** — a branch review read the
  move's comment as a scope claim and asked what the gate would buy. Over the
  same 400 days it is better on 0 and worse on 6, forfeiting six of the move's
  thirty-four winning days while fixing none of its six losing ones, and the
  cost it saves is inside the sweep's own noise band. The comment that invited
  the question, and §8.6, now say the spent window motivates the move rather
  than bounding it; the probe header carries the figures.
- **M105 — the λ₀ fit's RMSE was compared against a half-width no run had read
  on this curve — raised 2026-09-11, CLOSED 2026-09-12.**
  `scripts/stop-margin-fit-error.probe.ts` and
  `scripts/stop-inversion-margin.probe.ts` carry the runs and the verdict.

- **M106 — the honest arm's λ₀ bias GROWS with n: +0.0111 at n = 3, +0.0917 at
  n = 12 — raised 2026-09-12, CLOSED 2026-09-14.** Both untested halves hold and
  the growth is the ridge's own weight, uncovering a per-day bias that is flat
  across the window; `scripts/stop-margin-fit-error.probe.ts` carries the two
  arms and the criterion. What the per-day bias is made OF is M107.

## Findings from the 2026-09-12 past-day build

Noticed while building
[`the-day-you-could-not-correct`](docs/features/the-day-you-could-not-correct.md);
the **S** series continues from the 2026-08-25 review above.

- ~~**S7 — a stored day is written back once on every load.**~~ The autosave
  `$effect` re-ran when `#loadSession` assigned the day it read, and its dirty
  test was true for any stored day, so opening one scheduled a write of identical
  content with a fresh `updatedAt` — and once past days became correctable, every
  visit to a stored one bumped `pastWriteGeneration` and the Lab re-folded its
  stop observations. Closed 2026-09-14: `#buildSessionContent` serialized is the
  "changed since" baseline, recorded by every load and by each scheduled write, so
  an edit and its undo still both land.

## Findings from the 2026-09-14 stop-bias instrument

Raised closing M106 with the two arms
`scripts/stop-margin-fit-error.probe.ts` grew for it.

- **M107 — the λ₀ point's upward bias is concentrated at low λ₀ — raised
  2026-09-14, CLOSED 2026-09-14,
  `scripts/stop-margin-fit-error.probe.ts`.** All three candidates were priced
  as re-readings of the same cached brackets, and the concentration is none of
  them. §8.10's loose `hi` max is a real part of the pooled per-day bias and a
  FLAT one — it lowers every truth level by about the same amount, leaving the
  profile where it was. `max(0, lo)`, the standing hypothesis for exactly this
  shape, is inert: it raises the lo side on none of the kept days. And the
  midpoint is the arithmetic rather than the cause, because at the level that
  reads highest the bracket mostly does not contain the truth at all — `lo` is
  above it on the large majority of those days.
  What those levels share is how few of their days survive: the censors drop a
  low-λ₀ user's long days and leave their short ones, which are the days another
  step really was worth taking. That is selection, so no estimator repair
  reaches it, and MATH.md §8.10 now carries it as an approximation of its own.
  The probe's whole figure set was re-read at HEAD in the same commit, M104
  having landed since the arms were first run in a worktree.
- **M108 — the λ₀ fit's bias does not shrink with days, and the card's ± cannot
  see it — raised 2026-09-14, CLOSED 2026-09-14 (MATH.md §8.10 and the card),
  `scripts/stop-margin-fit-error.probe.ts`.** M106's split leaves
  the ridge
  weight going to 1, so a user who logs consistently converges on the per-day
  point rather than on their own λ₀ — and that point reads above the truth, by
  the margin the probe prints. §8.10 already says `valueStd` prices the day
  points' scatter and never widens for an error every day shares; this is one,
  since every point is read through the same bracket. So the Stopping
  Calibration card can carry a tight ± around a value that is systematically
  high, and a high λ₀ funds less work. What the user is told, if anything, is a
  product decision rather than a measurement. M107 has since answered what an
  estimator repair could remove: the one repair that acts — §8.10's honest `hi` —
  removes a real part of the per-day bias and none of its concentration, and the
  rest is the censors' own selection, which no re-fitting narrows. The small-n
  masking is this population's luck and does not generalise: its truths average
  above the 0.5 default, so the prior cancels part of the bias, while a user
  whose λ₀ sits below the default gets both errors in the same direction and
  few days is then worse than many. §8.10 now carries the model half: after the
  posterior-std bullet, the limit — weight n/(n + λ) → 1, so the fit converges
  on the mean day point — and the note that the section's four upward
  approximations lift that mean through the same bracket on every day,
  common-mode in the sense the bullet above it defines, while obligation
  displaces it downward by the same route. No figure moved into the prose; the
  probe keeps them.

  The card half was decided the same day and is prose, not arithmetic. Four
  options were priced: leave it, widen the ± by a bias floor, drop the ±, or
  relabel it. **Widening was refused** — the bias is concentrated, so one
  constant is wrong at both ends of λ₀, and no committed run licenses it on a
  real user's screen (item 29's rule). Dropping it would have thrown away a
  reading that is true about scatter. What shipped is the relabel: the
  free-time-value row reads `spread` where the α and r rows read ±, and the
  Stopping Calibration card states that the error is a DISPLACEMENT rather than
  scatter — the days behind the fit move the number one way, so more of them
  tighten the spread without bringing it closer — with neither a size nor a
  sign attached, since §8.10's common-mode bullet is what licenses the sentence
  and the probe holds the figures. A sign was drafted and cut: the section's own
  obligation bullet displaces the same mean downward, and the card's existing
  hint already tells a deadline-day user their number is pulled down, so naming
  one direction would have contradicted the paragraph above it. **The read-only
  Analytics copy still reads ± on λ₀**, its row being one of five that share a
  format; that is a knowing inconsistency, not an oversight, and the Lab is
  where the fit's own caveats already live.

- **M109 — §8.10 defends a one-signed bias with a wide σ₀, which prices scatter
  and not a shift — raised 2026-09-14, CLOSED 2026-09-14, MATH.md §8.10.** The
  partial-logging bullet accepts its upward bias because "the calibration is for
  users who log consistently, and σ₀ is wide". σ₀ enters the posterior std
  alone and never the point, so it cannot absorb a one-signed error — and the
  same section's `valueStd` paragraph already says the ± is blind to an error
  every day shares. The repair is deleting the clause, and it is deletion-only.
  §8.7's fresh-start bullet carried the same defense for the same shape of
  error — a one-signed upward α bias "accepted as noise (σ₀ is wide)", against
  that section's own "ν₀ ≠ λ (changes reported stds only, never the MAP)" two
  paragraphs above it — and both clauses are gone.
