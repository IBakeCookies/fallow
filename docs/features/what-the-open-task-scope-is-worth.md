# What the open-task scope is worth

**Status:** landed 2026-08-17 · **Roadmap:** item 31, finding M12

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Nothing the user sees changes. On 2026-08-12 both stop readings were rescoped to
price the stop against open work only — §8.10's `lo` bound and §8.11's advisor
candidates now read one `openTaskIds` (R3, §11.8's next-up family) — and no
probe in the repo has ever set that field. Both §8.10 bracket replicas take
`lo` over every task, `stop-advisor.probe.ts` calls `adviseStop` with the field
omitted, and the suite pins direction only, so the one number the correction was
argued on (1.32 → 1.16 on one fixture day) is reproduced by nothing. After this,
the correction's size is measured on a population instead of a witness, both
replicas model the scope the code ships, and the share of days the correction's
own fifth censoring category discards is a number rather than an assertion.

## Scenarios

No scenario. Nothing here has a click: the scope rule is shipped model
behaviour, the whole change is measurement plus the prose it dates, and the
behaviour worth holding onto lands as the pin in Claim 1.

**The figures quoted inside the Claims are §8.10's and §8.11's, not results.**
They are what the arms are built to confirm or refute. Where a figure does not
survive, MATH.md gets the measured one and this file is not updated — M7's and
M8's precedent
([what-still-reaches-the-gain-cap.md](what-still-reaches-the-gain-cap.md),
[what-the-rotation-baseline-costs.md](what-the-rotation-baseline-costs.md)),
where execution refuted a quoted number in both.

**Already backed, do not re-measure.** §8.10's inversion rates (4/315 optimizer,
44/1179 mood, 6 past the margin), the 0.110 bracket half-width, the loose-max
bias and the whole margin sweep are `stop-inversion-margin.probe.ts` and
`stop-margin-fit-error.probe.ts` as they stand, and every one of those arms
draws days with no completions. They are unchanged by this change **by
construction**, and Claim 6 is what proves it rather than assumes it.

### Claim — the witness pair, reproduced or refuted _(pin)_

`scripts/stop-inversion-margin.probe.ts` → MATH.md §8.10

The sole evidence for the 2026-08-12 correction, and a hand-built deterministic
cell, so it is the natural suite pin — but the pin carries **what the probe
measures**, not the figure below. It is phrased through `stopIndifferencePoint`,
which is what the code exports today, so it runs against the old code unchanged.

- **Given** the §8.10 fixture day — `boxing` (10/10, 0.2/1.0), `guitar`
  (6/9, 0.4/0.3), `reading` (4/7, 0.5/0.05) at a 12 h window, with 2.25 h logged
  on `boxing` and nothing else, at `DEFAULT_ENERGY_PARAMS`
- **Then** the indifference point with `openTaskIds` omitted reads 1.32
- **Then** the same day with `openTaskIds` = {2, 3} — `boxing`, the strongest
  task, checked off — reads 1.16
- **Then** the gap between them is reported against the 0.110 bracket
  half-width, which is the comparison §8.10 makes at `MATH.md:1652`
- **Then** the measured pair is pinned in
  `src/lib/business/model/zenith-energy.test.ts` beside the existing direction
  assertion, dated, citing §8.10 — one fixture, never a sweep

### Claim — how far the open-task filter moves the day's point

`scripts/stop-inversion-margin.probe.ts` → MATH.md §8.10

One day is not a size. This arm asks what the correction is worth across the
probe's own day population, at completion rates a user could plausibly produce.

- **Given** the probe's existing `optimizerDay` generator at its `LAMBDAS`, each
  day re-read at completion rates q ∈ {0, 0.25, 0.5, 0.75} where each of the
  day's tasks is independently marked checked off with probability q, seeded
- **Then** the distribution of `pointAllOpen − pointFiltered` is reported —
  median, p90 and max — per completion rate
- **Then** the share of days whose shift exceeds the 0.110 bracket half-width is
  reported per completion rate, which is the bar §8.10 sets for the witness
- **Then** the share of days where the shift is exactly zero is reported — the
  filtered task was not the `lo` maximizer, so the correction changes nothing
- **Then** the arm reports the shift separately for **logged** completions and
  for completions of tasks with no hours logged, since the second removes a
  candidate that was never worked and is the larger effect if the two differ
- **Then** the arm states that completion is drawn exogenously and why (see
  Decisions), because a reader who assumes the plan finished those tasks will
  read the rate as a frequency rather than as an axis

### Claim — the filter can only lower the point, and can only un-censor

`src/lib/business/model/zenith-energy.test.ts`

A bound, not a number: `lo` is a max over `candidates`, so shrinking that set
cannot raise it, `stopBound = max(0, lo)` is monotone in `lo`, `hi` does not
read the set at all, and the censor fires on `stopBound > hi + margin`. It is
provable, it holds on every input, and it is the property that makes Claim 2's
one-sided reporting honest — so it belongs in the suite, at the model unit level
([docs/testing.md](../testing.md)'s first row).

- **Given** any `StopObservation` and any non-empty subset of its task ids
- **Then** `stopIndifferencePoint` with that subset as `openTaskIds` is at most
  its value with the field omitted, wherever both are non-null
- **Then** a day the full set censors is never censored by a subset
- **Then** the empty set returns null, which is the fifth category and the one
  direction that loses a day

### Claim — how many days the fifth censoring category discards

`scripts/stop-inversion-margin.probe.ts` → MATH.md §8.10

§8.10 says a day that ends with everything ticked off "is not an edge case:
finishing everything you planned is an ordinary good day, and every one of them
is now discarded whole", and files that as the case for the censored likelihood
(ROADMAP item 4). Nothing counts them.

- **Given** the same population and completion rates as Claim 2
- **Then** the share of days that reach `openTaskIds` empty and drop whole is
  reported per completion rate
- **Then** the share that drop for each of the other four categories is reported
  beside it, so the fifth is a proportion of the losses and not of the calendar
- **Then** the arm reports what fraction of a day's tasks must be ticked before
  the fifth category can fire at all — an unfunded task left open keeps the day
  alive, which is the mechanism that decides whether this is ordinary or rare

### Claim — does the corrected scope recover a known λ₀ better?

`scripts/stop-margin-fit-error.probe.ts` → MATH.md §8.10

The correction's whole justification is that the old scope "biased λ₀ up by the
whole marginal of work that no longer existed". This probe already simulates
users at a known true λ₀ and scores the fit against it, which is the only place
that claim can be tested rather than reasoned about.

- **Given** the probe's existing population and day kinds, extended with a
  completion mix built **causally**: draw the day from `optimizeSchedule` at the
  true λ₀ first, then declare a random subset of the funded tasks finished at
  exactly the hours the plan gave them — a size cap that binds nowhere the plan
  reached, so the generated day is still the true rational day
- **Then** λ₀ recovery RMSE is reported for the shipped corrected scope and for
  the pre-2026-08-12 all-tasks scope, per completion mix and per `DAY_COUNTS`
- **Then** the mean signed error of each arm is reported, since the claim is
  about **bias** and an RMSE hides its direction
- **Then** the used-day count of each arm is reported, because the two arms do
  not fit the same days: the corrected scope drops all-completed days and
  un-censors inverted ones
- **Then** the arm states that a completion drawn independently of the plan
  cannot test this and would show the correction losing (see Decisions) — the
  trap the causal construction exists to avoid
- **Then** if the corrected scope does not beat the old one by more than the
  0.110 bracket half-width, that is reported as the result and §8.10's "biased
  λ₀ up" is restated as a one-day witness rather than a measured bias. The scope
  rule does not move on it — it is settled behaviour, and this is a measurement

### Claim — the replicas model the scope the code ships _(pin)_

`scripts/stop-inversion-margin.probe.ts`, `scripts/stop-margin-fit-error.probe.ts`

Both probes hand-rebuild the bracket from exported parts and validate the
replica against the shipped function before believing a number. Today the
generators emit no completions, so the missing filter is invisible and the
validation passes — which is exactly why it went unnoticed for two months.

- **Given** each probe's existing replica-validation arm, unchanged in its draw
- **Then** the replica's `lo` loop runs over `openTaskIds` when the field is
  present and over every task when it is not, matching `reconstructStopDay`
- **Then** the mismatch count against the shipped function stays 0 on the
  existing no-completion arms — every published §8.10 number is unmoved
- **Then** the mismatch count is 0 on the new completion arms too, which is the
  first time either replica is validated against a day that has any
- **Then** `stop-margin-fit-error.probe.ts:499`'s comment — "the generated days
  carry no `openTaskIds`, so the filter is the identity, which is why the
  replica omits it" — is gone, because the reason it states stops being true

### Claim — does the advisor's candidate filter change its verdict?

`scripts/stop-advisor.probe.ts` → MATH.md §8.11

§8.11 reads the same field for the same reason and its probe has never set it
either. The advisor is a live reading the user acts on, so a verdict that flips
on completion matters more here than a fitted constant shifting.

- **Given** the probe's existing `randomDays` and `WARMUP_HEAVY` fixtures walked
  by `walkPlan`, where at each checkpoint a task is checked off exactly when the
  remaining plan holds no more blocks for it — the plan finished it, so there is
  no more of it to do
- **Then** the share of checkpoints where the verdict differs between the
  filtered and unfiltered call is reported, split into continue→stop and
  stop→continue
- **Then** the share where the verdict agrees but the recommended `taskId`
  differs is reported — the advisor names a task, and naming a finished one is
  the defect the correction was for
- **Then** the at-stop lateness of each arm is reported on the existing scale,
  so a filter that stops the day earlier is priced and not just counted
- **Then** the `searchMarginals` one-step replica applies the same filter, and
  the probe's existing mismatch check against `adviseStop` stays at 0
- **Then** the existing §8.11 rates (19.7% / 24.7% against 6.6% / 6.2%, and the
  31.7% / 9.9% pair) are re-printed unchanged from arms that draw no
  completions, so the new arm is additive and not a re-measurement

## Out of scope

- **Building the censored likelihood.** ROADMAP item 4, and
  [censored-stopping-fit.md](censored-stopping-fit.md) already plans it — that
  spec rewrites `stopIndifferencePoint` into an exported `stopBracket` and stops
  dropping one-sided days. Claim 4 measures how many days its fifth category
  loses, which is evidence for that item; nothing here changes what the fit
  keeps.
- **Changing the scope rule.** §11.8's next-up family is settled (2026-07-20,
  AGENTS.md §4), the 2026-08-12 correction is shipped, and Claim 5's kill line
  says so explicitly: a measurement that fails to confirm the bias restates
  §8.10's prose, it does not re-open `openTaskIds`.
- **`STOP_INVERSION_MARGIN`.** Settled 2026-08-13 by ROADMAP item 28 — not
  derivable, left at 0.25. Claim 3 reads the censor; it does not move it.
- **Per-task size in the product.** Claim 5's cap is a generator device that
  makes the simulated day's completions causal. Declared per-task caps are on
  ROADMAP's not-proposed list, measured worse than item 12's re-plan, and no
  model input changes here.
- **§8.11's canonical-rank over-pricing bound.** §8.11 records it with its own
  reason (`MATH.md:1982-1989`); `growBy` is untouched.
- **The other §8.10 and §8.11 numbers.** The inversion rates, the loose-max
  decomposition, the margin sweep and the session-vs-one-step table are backed
  and drawn without completions. Claim 6 is how that is verified rather than
  assumed; re-measuring them is how a change of this shape grows without adding
  evidence.
- **Validating the completion rate against a real history.** No export exists on
  this machine — the same block that stalled ROADMAP items 15 and 16, and that
  [censored-stopping-fit.md](censored-stopping-fit.md) already declares. The
  completion rate stays an axis, never a frequency.
- **Any user-visible change.** No component, store, view model or copy. λ₀, the
  advice card and the Stopping Calibration card read identically before and
  after.

## Read before building

Line numbers are as of planning. Sections and symbols are the durable address.

- `MATH.md:1598` — §8.10's header, and `:1640-1652`, the open-task paragraph
  under test. The witness is at `:1647` and the half-width comparison at `:1648`.
  Both get the measured figure and its date.
- `MATH.md:1686-1704` — §8.10's **Censoring** paragraph. `:1687-1690` is the
  fifth category, and the parenthetical at `:1692` is the case for item 4 that
  Claim 4 puts a number behind.
- `MATH.md:1717`, `:1789-1791` — where the 0.110 bracket half-width is measured
  and quoted. Claims 2 and 5 compare against it; neither re-measures it.
- `MATH.md:1886` — §8.11's header, and `:1962-1971`, the **Candidates vs
  reconstruction** paragraph. Its "test-pinned" claim is the suite's direction
  assertion; Claim 7's rates go here.
- `MATH.md:2251` — §10, the doc-only revision log. R7 wants a dated entry: this
  change alters explanations and adds probe arms, and changes no behaviour.
- `src/lib/business/model/zenith-energy.ts:1764-1777` — `StopObservation` and
  the `openTaskIds` docblock. "Omitted means every task was open" is the
  convention every arm here depends on.
- `src/lib/business/model/zenith-energy.ts:1983-2023` — `reconstructStopDay`:
  `candidates` is the filter, at `:2016`. The canonical order and `rank` run
  over **all** tasks, which is why a completed task still shapes the day.
- `src/lib/business/model/zenith-energy.ts:1920-1964` — `stopIndifferencePoint`:
  `lo` from `bestNextStep`, `hi` looped over `observation.tasks` (not
  `candidates` — that asymmetry is the design), and the censor at `:1962`.
  Claim 3's bound is read off these lines.
- `src/lib/business/model/zenith-energy.ts:2058-2082` — `bestNextStep`, the
  `lo` side's max over `day.candidates`. Private; both replicas rebuild it.
- `src/lib/business/model/zenith-energy.ts:2129-2168` — `adviseStop`, exported.
  `day.candidates.length === 0` returns null, which is the advisor's own version
  of the fifth category.
- `src/lib/business/model/zenith-energy.ts:1786-1800` — `workedHoursByTask`,
  exported. Both replicas already call it; it is the R3 join the §12 audit
  shares.
- `src/lib/business/model/zenith-energy.test.ts:1326-1330` — the §8.10 fixture
  `day`, Claim 1's three tasks.
- `src/lib/business/model/zenith-energy.test.ts:1423-1480` — the existing
  "prices the stop against OPEN work only" test. Claim 1's pin goes beside its
  `toBeLessThan`, not instead of it, and Claim 3's bound is the same describe
  block.
- `src/lib/business/model/zenith-energy.test.ts:2100-2220` — the `adviseStop`
  completion tests, which pin §8.11's direction. Claim 7 measures what they
  cannot: how often it fires.
- `src/lib/business/session-history.ts:268-274` — `toStopObservations`, where
  `openTaskIds` comes from in production: `!t.completed` over the session's
  tasks. This is what the probes' completion notion must be a model of.
- `src/lib/business/store/energy-lab-store.svelte.ts:539-548` — the advisor's
  live call site, building the same set. Read only to confirm the two agree;
  nothing in the store changes.
- `scripts/stop-inversion-margin.probe.ts:110-215` — `bracketOf`, the replica.
  Its `lo` loop is at `:186` (`for (const t of tasks)`) and takes the filter.
  Its docblock at `:22-35` states the replica pattern and its validation rule —
  the arms list there needs the new arms.
- `scripts/stop-inversion-margin.probe.ts:294-320` — `optimizerDay`, and
  `:230-247` `drawDay` / `:216-229` `drawTask`. Claims 2 and 4 reuse these
  verbatim, which is the whole reason the arms live in this file.
- `scripts/stop-inversion-margin.probe.ts:323-378` — the replica-validation arm.
  Claim 6's new mismatch count goes through the same gate; a nonzero value
  invalidates every rate in the run, and that must stay true of the new arms.
- `scripts/stop-margin-fit-error.probe.ts:93-179` — `bracketOf`, the second
  replica; `lo` at `:164`.
- `scripts/stop-margin-fit-error.probe.ts:499-501` — the comment that must go,
  and `:498-530`, the validation arm it sits in.
- `scripts/stop-margin-fit-error.probe.ts:197-212`, `:304-326`, `:363-380` —
  `KINDS`, `buildDay` and `drawKind` / `MIXES`. Claim 5's completion mix is a
  new axis beside `MIXES`, not a sixth kind: it composes with every kind.
- `scripts/stop-margin-fit-error.probe.ts:253-303` — `observationFrom` and
  `variantSteps`, where a day's per-task hours become a `StopObservation`. This
  is the single place `openTaskIds` enters.
- `scripts/stop-margin-fit-error.probe.ts:327-362`, `:412-414` — `LAMBDAS`,
  `USER_COUNT`, `DAY_COUNT`, `DAY_COUNTS` and `BRACKET_HALF_WIDTH = 0.11`, which
  Claim 5's kill line already has a constant for.
- `scripts/stop-advisor.probe.ts:287-296` — `observe`, the one function that
  builds every `StopObservation` in that probe. Claim 7's filter enters here and
  nowhere else.
- `scripts/stop-advisor.probe.ts:148-188` — `walkPlan` and `Checkpoint`, which
  already track the plan's remaining work. "Finished when the plan holds no more
  blocks for it" is derived here, not drawn.
- `scripts/stop-advisor.probe.ts:189-240` — `searchMarginals`, the one-step
  replica, and `:399-440` — `measure` and the mismatch line that invalidates the
  run. Both must take the filter, or the check fires for the wrong reason.
- `src/lib/business/model/AGENTS.md:156-160` — the settled statement that both
  stop readings price against `openTaskIds`. It is correct and stays; check it
  still is after the measurement, per AGENTS.md §0's documentation exception.
- `scripts/PROBES.md:25`, `:33-34` — the three rows. No new file, so no new row,
  but all three descriptions widen to name the open-task scope.
  `node scripts/probe-registry.mjs --check` runs in `npm run lint`.
- `docs/testing.md:236-250` — probe policy: seed the sweep, date the number
  where it is quoted, pin what the probe found with **one** suite fixture.
- `ROADMAP.md:912-917` — item 31's M12 entry. Mark it closed with a link to this
  file. Item 31's own structural-hole sentence at `:497-500` claims closing this
  "kills several at once" — say what it actually killed, the way M7's and M8's
  closings corrected their entries. Do not renumber any item.
- `ROADMAP.md` item 4 at `:239-241` and
  [censored-stopping-fit.md](censored-stopping-fit.md) — Claim 4's number is
  evidence for that item. If the fifth category turns out rare, item 4's own
  framing ("not an edge case") needs the measured share written into it.

## Decisions

- **Three existing probes, no new file, split by draw.** Each arm goes where its
  generator already lives: §8.10's day population and the fifth category in
  `stop-inversion-margin`, the λ₀-recovery question in `stop-margin-fit-error`
  because only that file has a known truth to score against, and §8.11 in
  `stop-advisor` because its checkpoint walk is the completion signal. Rejected:
  one new probe holding all six arms, which would have to copy three generators
  and would put the new numbers on a different draw from the numbers they sit
  beside — M8's own reason for splitting, applied the other way.
- **Completion is exogenous in Claim 2 and causal in Claim 5, on purpose.** The
  model has no task size, so "checked off" has no model correlate: in
  `stop-inversion-margin` it is drawn as an axis, which is honest for measuring
  how far the filter moves a point. But a completion drawn independently of the
  plan makes the corrected scope look **worse** against truth — at a rational
  stop `lo ≤ λ₀` already, and removing a maximizer only lowers it — so Claim 5
  caps the finished tasks at the hours the plan gave them, which binds nowhere
  and makes their forgone marginal the fiction §8.10 says it is. Rejected: one
  shared generator, which would have produced a defensible number for Claim 2
  and a misleading one for Claim 5.
- **The bound is a test and the sizes are probes.** `lo` shrinking with its
  candidate set is provable and holds on every input, which
  [docs/testing.md](../testing.md) puts in the suite; how far it shrinks moves
  with the curves and the lattice, which puts it in a probe. Rejected: asserting
  the size in the suite, which is the red build carrying no regression that
  `scripts/PROBES.md` exists to prevent.
- **The replicas get the filter even though it is the identity today.** Both are
  validated against the shipped function, and both would pass while modelling
  the superseded scope — the failure M12 is. Fixing them is the part that
  outlives this measurement. Rejected: leaving the explanatory comment in place,
  which documents the trap rather than removing it and is a rule that goes false
  the first time someone adds completions to either generator.
- **The witness is the pin, whichever way it lands.** It is deterministic and
  hand-built, so it pins cleanly, and the suite currently asserts only that one
  is smaller than the other — which cannot catch a change that moves both. If
  the measured pair differs from 1.32 / 1.16, MATH.md takes the measured pair
  and the pin takes it too.
- **Claim 5 can refute §8.10's stated reason without moving the scope rule.**
  The correction is right on an argument the simulation cannot make — a
  checked-off task's remaining work does not exist, and a synthetic day has no
  remaining work to run out of. If the measured bias is inside the instrument's
  slack, the honest outcome is §8.10 stating that, not a model change. Rejected:
  omitting the arm because it cannot lose, which is how §14.1-2's discarded
  sweep became a claim nobody could re-check.
- **Item 4 is measured for, not built.** The fifth category's share is the one
  fact [censored-stopping-fit.md](censored-stopping-fit.md) asserts without
  evidence, and it costs one counter in an arm that already exists here.
  Rejected: folding it into that spec, which would leave item 4 unstartable
  until someone re-derives the population this change already has.
- **`stopIndifferencePoint` is the surface, not `stopBracket`.** Item 4's spec
  plans to export a bracket and rewrite the censoring. It is unbuilt, so every
  Claim here is phrased through what ships today; if item 4 lands first, the
  replicas rebase onto the new export and the numbers are unaffected — they are
  properties of the day, not of the signature.

## Open questions

None.
