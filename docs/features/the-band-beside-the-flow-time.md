# The band beside the flow time

**Kind:** feature · **Status:** landed 2026-08-31 · **Roadmap:** item 34

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The `Flow at` cell on the plan's ledger prints one number, and it reads as a
fact. It is an estimate off a fit, and how sure that fit is varies enormously —
between a user with four ⚡ logs and one with eighty, and between a task like
the ones they have logged and a task unlike any of them.

After this, that cell prints the fit's own uncertainty beside it — `1h 24m ±
24m` — so the user can see when the model is guessing and when it has actually
learned them. It appears only once their logs have moved the model; until then
the cell reads exactly as it does today.

## Scenarios

### Scenario — a row whose fit has a spread prints it

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a row rendered with `flowStateTime` 1.4 and `flowStateTimeStd` 0.4
- **When** the story mounts
- **Then** its `Flow at` cell reads `1h 24m ± 24m`

### Scenario — a row with no spread prints the flow time alone

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a row rendered with `flowStateTime` 1.4 and no `flowStateTimeStd`
- **When** the story mounts
- **Then** its `Flow at` cell reads `1h 24m`, with no `±` anywhere in it

### Scenario — the tooltip says what the spread is

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a row rendered with `flowStateTime` 1.4 and `flowStateTimeStd` 0.4
- **When** the `Flow at` cell is hovered
- **Then** the tooltip carries the sentence naming the range, below the
  existing derived-values paragraph

### Scenario — a row with no spread gets no extra tooltip paragraph

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a row rendered with `flowStateTime` 1.4 and no `flowStateTimeStd`
- **When** the `Flow at` cell is hovered
- **Then** the tooltip carries only the existing derived-values paragraph

### Scenario — a fresh profile's plan shows no spread

`e2e/day-navigation.e2e.ts`

- **Given** a fresh profile viewing today, holding one task and no ⚡ logs
- **When** the plan renders
- **Then** that task's `Flow at` cell contains no `±`

### Scenario — a ⚡ logged today shows its spread on the next day's plan

`e2e/day-navigation.e2e.ts`

- **Given** that same profile, with 90 minutes logged as that task's time to
  flow
- **When** the page crosses midnight onto a day that holds a task
- **Then** that task's `Flow at` cell contains a `±`

### Claim — the printed spread is the fit's predictive std

`src/lib/business/model/metric/calculation.test.ts`

- **Given** a task list planned with a posterior
- **Then** every `SuggestedTask.flowStateTimeStd` equals
  `phiPredictionStd(task.trueEffort, task.trueEnjoyability, posterior)`

### Claim — no posterior, no field

`src/lib/business/model/metric/calculation.test.ts`

- **Given** the same task list planned with no posterior argument
- **Then** every `SuggestedTask.flowStateTimeStd` is `undefined`

## Out of scope

- **The prequential MAE reading** — item 34's other half, the one that says
  whether the fit predicts better than the article's defaults. It needs a walk
  over the user's whole ⚡ history and has a cost question this change does not,
  so it gets its own `/plan`. Item 34 stays open for it.
- **A coverage row anywhere.** Item 19's measurement answered it: the band
  covers at 65.9–67.6% against a 68.3% nominal at every n ≥ 10, which is the
  "already correct and unremarkable" case that item's own kill gate named
  ([phi-prequential-skill.md](phi-prequential-skill.md)).
- **Σδ̂² in the UI.** It is item 6's gate statistic and has no user.
- **The Lab's ledger** (`energy-task-row.svelte`). It heads no `Flow at`
  column, on purpose.
- **The day strip and the `reached flow` check** (`utils/day-timeline.ts`),
  which stay on the point ϕ. A band on the bar is a second question.
- **A guard against printing `± 0m`.** It needs σ̂ near zero under a large
  `Σw`, which is a user with hundreds of logs and near-perfect self-prediction;
  name the inputs before adding the branch (AGENTS.md §0).
- **Any change to `phiPredictionStd`, `phiParameterStd`, `fitUserConstants` or
  the allocator's hedging.** This change reads what they already return.
- **Column widths, order or the `ledger-wide` breakpoint.** The cell gets
  longer; the column list does not change.

## Read before building

- `ROADMAP.md` item 34 — **two of its sentences are wrong** and are corrected
  in the landing commit. See **Decisions**.
- `src/lib/business/model/metric/calculation.ts` — the `SuggestedTask` type,
  `calculateTaskPlan`'s existing `posterior?: FitPosterior` parameter, and the
  `.map` that builds each row from its `alloc` (`alloc.E` and `alloc.beta` are
  already the `trueEffort` and `trueEnjoyability` the std is evaluated at).
- `src/lib/business/model/metric/calculation.test.ts` — where both Claims land.
- `src/lib/business/model/zenith.ts` — `phiPredictionStd`, and `phiParameterStd`
  directly above it, whose comment says why the allocator uses the other one and
  why the σ̂² term is exactly the part it must not see.
- `src/lib/business/model/AGENTS.md` — the ϕ bullet, which already names
  `phiPredictionStd` as the posterior's public reading. `SuggestedTask` gains a
  field, so this is where the interface is priced.
- `src/lib/business/store/session-store.svelte.ts` —
  `#fittedFlowObservations`, the `date < selectedDate` filter that makes the
  next-day scenario the only place the band's arrival is observable, and
  `constantsFit`, whose `fitted` the dashboard already reads.
- `src/lib/presentation/component/task-item.svelte` — the `Flow at` `<td>`, its
  `Tooltip.Root`, and the `Props` block the new optional prop joins.
- `src/lib/presentation/component/task-list.svelte` — the per-row prop
  spread, and the list-level props (`viewedDate`, `remainingDay`) the new
  `constantsFitted` sits beside.
- `src/routes/(app)/+page.svelte` — `<TaskList` and, further down,
  `constantsFitted={session.constantsFit.fitted}` already passed to the
  calibration card. The same expression feeds the list.
- `src/lib/presentation/component/task-item.stories.svelte` — the existing
  `play` functions to pattern the four component scenarios on.
- `src/lib/presentation/utils/duration-format.ts` — `formatDuration`, which
  formats both halves so the two cannot round differently (R3).
- `src/lib/presentation/utils/ledger-column.ts` — `getEnergyTaskColumns`, the
  proof that the Lab's ledger has no `Flow at` column to put a band in.
- `src/lib/presentation/AGENTS.md` — the task rows, and the
  field-versus-prop passage under the day strip.
- `messages/en.json` — `task_derived_tooltip` (shared with the `Stop by` cell),
  and the new key beside it. Then `de`, `es`, `fr`, `zh`.
- `e2e/helpers.ts` — `taskRow`, `addTask`, `logFlow`; and
  `e2e/day-navigation.e2e.ts`'s existing midnight-rollover test, which already
  installs the clock, logs a ⚡ and adds a task on the new day.
- `docs/testing.md` — the level table, and the blast-radius table: this diff is
  user-visible and touches `business/model`, so it takes a full reviewer pass.
- MATH.md §5 and §5.1 — what the two standard deviations are and which one is
  a reading for the user. **Nothing in MATH.md changes.**
- AGENTS.md §4 — `PHI_UNCERTAINTY_RELATIVE_CAP` stays 0.5, and metric display
  policy lives in the presentation layer.

## Decisions

- **The band is `phiPredictionStd`, not `phiParameterStd`** — √(σ̂² + xᵀΣx),
  not √(xᵀΣx). The user is asking how long this will actually take them, and
  that includes their own day-to-day scatter. Rejected: the allocator's term,
  because it deliberately omits σ̂² so the hedging vanishes on a well-measured
  user (MATH.md §5.1) — printing it would tell someone with eighty logs that
  their flow time is certain to the minute.
- **`SuggestedTask` gains `flowStateTimeStd?: number`, computed in the
  allocator's row map.** Rejected: computing it in `task-item.svelte`, which R1
  forbids outright — presentation cannot import `business/model`.
- **Optional, because the posterior is.** `calculateTaskPlan` takes
  `posterior?: FitPosterior`, and `defer-destination.ts` and `history.ts` call
  it without one. A field that were always a number would have to invent a
  value for those callers. Rejected: making the parameter required, which is a
  change to three call sites for one cell.
- **Whether to print it before there is a fit is decided in presentation, by a
  list-level `constantsFitted` prop on `task-list.svelte`.** On a fresh profile
  the posterior is the prior, so the band is real, wide (≈±30 min) and a
  statement about the article's defaults rather than about the user. Rejected:
  a `fitted` argument on `calculateTaskPlan`, which would put a display
  decision inside the allocator. It is a prop and not a field on
  `SuggestedTask` because it is one fact about the whole list — like
  `viewedDate` and `remainingDay` beside it — not a fact about a task; the
  field-over-prop rule in `presentation/AGENTS.md` is about per-row facts the
  view model's own input already carries, and `fitted` is not one.
- **ROADMAP item 34 says the band goes on "both task screens". There is only
  one.** `getEnergyTaskColumns` omits `Flow at` deliberately — "absent rather
  than blank", because an empty cell would assert a reading the energy mode
  never made. ϕ renders in exactly one place in the app. The ROADMAP line is
  corrected in the landing commit.
- **ROADMAP item 34 says the posterior "needs plumbing through
  `SuggestedTask`". It is already at the call site.** `calculateTaskPlan` has
  taken a `posterior` since the ϕ-uncertainty hedging landed (MATH.md §5.1), and
  `daily-plan-store` passes `session.constantsFit.posterior` today. What is
  missing is one field and one prop, not plumbing. Corrected in the same commit.
- **A second tooltip paragraph, rendered only when the band is.**
  `task_derived_tooltip` is shared with the `Stop by` cell, where a ± is not
  shown and the sentence would be false. Rejected: a `Flow at`-only replacement
  message, which would duplicate the shared paragraph in five locales and let
  the two drift.
- **No cap on the printed ±.** Rejected: reusing
  `PHI_UNCERTAINTY_RELATIVE_CAP`, which is the allocator's hedge, is settled at
  0.5 (AGENTS.md §4), and would print a number the model did not compute.
- **The e2e lives in `day-navigation.e2e.ts`, not `tasks.e2e.ts`.** A ⚡ logged
  today cannot move today's band: `#fittedFlowObservations` filters to
  `date < selectedDate`, so the fit that plans a day never reads that day's own
  logs. Crossing midnight is the only way a browser sees the band arrive.
  Rejected: a `tasks.e2e.ts` test, which would have to assert the band's
  absence and could never show it appearing.
- **No MATH.md change.** §5 already names `phiPredictionStd` as the predictive
  std "for UI bands", and no formula, constant, bound or fit moves. R7 is
  satisfied by citing it, not by editing it.

## Open questions

None.
