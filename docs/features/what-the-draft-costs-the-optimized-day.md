# What the draft costs the optimized day

**Kind:** feature · **Status:** landed 2026-09-04 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On `/`, the add-task form prices the draft into the day beside the fields you
are typing. On `/energy` the same form is one column and says nothing: the Lab's
plan is the optimizer's, and a classic-allocator reading would describe a day
that screen does not show.

After this, the Lab's form carries its own reading. You type the task, press
**Price this day**, and the panel says what the optimizer would give it, when it
would run, what your Total Output and your end-of-day energy would read
afterwards, and what the day's other tasks lose to it.

## Scenarios

### Scenario — the optimizer funds the draft and the panel says when it runs

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** an 8 h day whose optimized plan leaves room, and a draft the
  optimizer funds
- **When** the impact is calculated
- **Then** `suggestedHours` is the draft's blocks summed
- **And** `startHour` is the start of its first block

### Scenario — an unfunded draft has no slot

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** a tight day whose optimizer gives a weak draft no blocks
- **When** the impact is calculated
- **Then** `suggestedHours` is 0
- **And** `startHour` is `null`

### Scenario — Total Output reads before and after

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** any day with a window and a draft
- **When** the impact is calculated
- **Then** `totalOutput.before` is the baseline evaluation's `totalOutput`
- **And** `totalOutput.after` is the drafted plan's `totalOutput`

### Scenario — end-of-day energy reads before and after

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** any day with a window and a draft
- **When** the impact is calculated
- **Then** `endCog.before` is the baseline's `workEndCog`
- **And** `endPhys.before` is the baseline's `workEndPhys`
- **And** `endCog.after` is the drafted plan's `workEndCog`
- **And** `endPhys.after` is the drafted plan's `workEndPhys`

### Scenario — the draft thins the day's other tasks

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** a day whose optimized plan spends its window across three active
  tasks, and a draft the optimizer funds
- **When** the impact is calculated
- **Then** `displaced.hoursTaken` is the total hours those tasks lose between
  the baseline plan and the plan with the draft in it
- **And** `displaced.taskCount` is how many of them lost any hours

### Scenario — the draft drops a task by name

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** a tight day whose optimized plan funds an active task the draft
  outvalues
- **When** the impact is calculated
- **Then** `displaced.unfunded` holds exactly the titles of the active tasks
  that had blocks in the baseline plan and have none in the drafted plan

### Scenario — a completed task is never displaced

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** a day holding a completed task the baseline plan gives blocks to,
  and a draft the optimizer funds
- **When** the impact is calculated
- **Then** the completed task's title is absent from `displaced.unfunded`
- **And** any hours it loses are absent from `displaced.hoursTaken`

### Scenario — an unfunded draft takes nothing

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** a day whose optimizer gives the draft no blocks, and whose plan
  still moves under it
- **When** the impact is calculated
- **Then** `displaced` reads zero on all three parts

### Scenario — a zero window is priced as no plan at all

`src/lib/business/model/metric/energy-draft-impact.test.ts`

- **Given** a window of 0 h
- **When** the impact is calculated
- **Then** it returns `null`

### Scenario — the button prices the draft

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a loaded Lab with a day window and tasks, and a draft published to
  the store
- **When** `computeDraftImpact(draft)` resolves
- **Then** `draftImpact` holds the reading for that draft

### Scenario — editing the draft drops the reading

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab holding a priced `draftImpact`
- **When** a different draft is published to the store
- **Then** `draftImpact` is `null`

### Scenario — a second press while one is running is ignored

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab with `computeDraftImpact` in flight
- **When** `computeDraftImpact` is called again
- **Then** the second call returns without starting a second solve

### Scenario — the panel prompts before anything is priced

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** a `null` impact and a not-busy panel
- **When** the panel renders
- **Then** it renders the prompt line and no figures

### Scenario — the panel says it is working

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** a `null` impact and a busy panel
- **When** the panel renders
- **Then** it renders the working line

### Scenario — the panel names when the draft runs

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact of 1.5 h starting at hour 2 of the window
- **When** the panel renders
- **Then** the hours tile reads `1h 30m`
- **And** its note carries the block's start offset

### Scenario — the panel says an unfunded draft gets no hours

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact of 0 h and a `null` `startHour`
- **When** the panel renders
- **Then** the hours tile reads the unfunded note

### Scenario — the Total Output row reads before and after

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact whose Total Output goes 12.4 → 14.1
- **When** the panel renders
- **Then** the row reads `12.4 → 14.1`

### Scenario — the end-energy rows read before and after

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact whose end cognitive energy goes 0.84 → 0.71
- **When** the panel renders
- **Then** the cognitive row reads `84% → 71%`

### Scenario — the panel names what the draft drops

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact whose `displaced.unfunded` holds `Write report`
- **When** the panel renders
- **Then** the cost row names `Write report`

### Scenario — the panel prints the total when nothing is dropped

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact taking 0.67 h from 3 tasks and dropping none
- **When** the panel renders
- **Then** the cost row reads `40m` and `3`

### Scenario — the panel says the day gave it up for free

`src/lib/presentation/component/task-form-energy-preview.stories.svelte`

- **Given** an impact whose `displaced.taskCount` is 0
- **When** the panel renders
- **Then** the cost row says the day loses nothing

### Scenario — the Lab's form prices a typed task end to end

`e2e/energy-lab.e2e.ts`

- **Given** the Lab on a day with a window and at least one task
- **When** a title and ratings are typed and **Price this day** is pressed
- **Then** the panel shows the hours the optimizer would give it

### Scenario — the Lab's form is one column with no window

`e2e/energy-lab.e2e.ts`

- **Given** the Lab on a day whose window is 0 h
- **When** the add-task form is opened
- **Then** the panel says the day has no window and offers no button

### Claim — the Total Output delta is not a foregone conclusion

`scripts/energy-draft-price.probe.ts` → no MATH.md section

- **Given** sampled days across task counts and windows, each with a sampled
  draft
- **Then** the probe reports the distribution of
  `totalOutput.after − totalOutput.before`, and the share of days on which it is
  `≤ 0`

## Out of scope

- **Any change to a number.** The optimizer, its parameters, the window, the
  evaluation and every figure `PlanSummary` prints are read exactly as they are.
  Nothing here enters the model, and no MATH.md section moves.
- **A `$derived`, a debounce, or any automatic run.** Measured on this repo at
  an 8 h window: `optimizeSchedule` costs 35 ms at n = 3, 95 ms at n = 12 and
  195 ms at n = 20. `business/AGENTS.md`'s "Plan advice is computed on demand,
  never in a `$derived`" exiled a ~130 ms solve for exactly this reason, and the
  rule is not re-opened here — it is the reason this change has a button.
- **The empty form's ranked next tasks.** `/`'s panel ranks three titles worth
  adding (`NextTaskSuggestion`); the Lab's does not. That ranking is one solve
  per candidate, which under the optimizer is n × the cost above, and it would
  need an energy-mode definition of "worth adding" that nothing has written.
  The Lab's panel is blank until there is a draft to price.
- **Work vs free hours before and after.** Free off the same solve and
  deliberately left out: `displaced` and the hours tile already say the day got
  busier, and a third row saying it again is the same fact priced twice.
- **A value-vs-classic delta for the draft.** `valueVsClassic` needs the classic
  allocator's rival plan re-solved with the draft in it — a second solve of a
  different kind, on a reading that is about the two modes and not about this
  task.
- **A per-task breakdown of where the hours came from.** One line, one reading —
  the same call `/`'s panel made, for the same reason.
- **A band on the end-energy rows.** `PlanSummary` prints end energy unbanded
  and `AXIS_BAND` has no axis for it; inventing thresholds here would put a
  judgement in the panel that the page above it does not make.
- **`mustDoToday` on the Lab's form.** It stays `withMustDoToday={false}`, as it
  is today. The flag promises the day, not the hours, and the optimizer is
  unweighted by it.
- **Anything on `/`.** Its panel, its `DraftImpact` and its `$derived` are
  untouched.

## Read before building

- `src/lib/business/model/metric/draft-impact.ts` — `DraftTask`, `DraftChange`
  and `prependDraft` are imported, not re-declared. `prependDraft`'s doc comment
  is the one definition of how an unsaved task joins a day (R3) and its
  reasoning about FIRST position and the `max + 1` id applies here unchanged.
  `calculateDraftImpact`'s `displacement` helper is the shape the energy one
  mirrors — read it, do not import it: it walks `SuggestedTask.suggestedHours`,
  and this walks summed `EvaluatedBlock.hours`.
- `src/lib/business/model/zenith-energy.ts` — `optimizeSchedule` (its
  `OptimizeResult` carries `blocks` and `evaluation`), `EvaluatedBlock`
  (`taskId`, `hours`, `start`), and `ScheduleEvaluation`'s `totalOutput`,
  `workEndCog` and `workEndPhys`. Read the doc comment on `workEndCog` before
  choosing between it and `endCog`: they answer different questions and
  `PlanSummary` prints the worked-end pair.
- `src/lib/business/model/metric/calculation.ts` — `toEnergyTask`, which is how
  a `Task` becomes an `EnergyTaskInput`, and `getEffectiveDifficulty` behind it.
- `src/lib/business/store/energy-lab-store.svelte.ts` — `computeBudgetCurve` is
  the pattern the new method copies verbatim in shape: busy guard, `setTimeout`
  yield, one read of the inputs after the yield, `logError` in the catch. Also
  `#energyTasks` and `#plan` (the baseline this passes in, so the reading costs
  one solve and not two) and the comment above `#energyTasks` on why the plan is
  solved over completed tasks too.
- `src/lib/business/AGENTS.md`, "Plan advice is computed on demand, never in a
  `$derived`" and "The add-task draft is priced in a `$derived`, unlike the
  advice" — the two halves of the budget this change sits between. **The second
  bullet needs a sentence added**: it currently reads as though every add-task
  draft is a `$derived`, and after this the Lab's is not.
- `src/lib/presentation/component/task-form.svelte` — the `impact === undefined`
  ternary that gates the second column, and `pick`, the internal that fills the
  title field from a suggestion.
- `src/lib/presentation/component/task-form-preview.svelte` — the `changeRow`
  snippet, the `StatTile` in its `surface-inset` box, and the three-shape cost
  line. The energy panel is a sibling of this file, not a mode of it.
- `src/lib/presentation/AGENTS.md`, the bullet beginning "The add-task form's
  second column is a reading and nothing else". **Two corrections land with this
  change**, both to statements that are false or become false:
  (1) "every control is in the first" is already untrue — `task-form-preview`
  renders the next-task `<button>`s in the second column, as the comment in
  `task-form.svelte` says outright; (2) "The Lab passes neither prop and stays
  one column" stops being true here. Fix both in the landing commit (AGENTS.md
  §0, documentation is the exception).
- `src/lib/presentation/AGENTS.md`, "Both task screens are one `<table>` off one
  shell; a column list is one definition per screen, and the shell takes a
  `columnCount`, never a mode flag" — the rule that decides the shape below, and
  `task-list-card.svelte`'s `form` / `heading` / `strip` snippets are the idiom
  it points at.
- `src/lib/presentation/component/plan-summary.svelte` — the three figures this
  panel moves, and the `Math.floor` on the energy percentages ("100% has to mean
  untouched"). The panel formats them the same way or the two disagree.
- `src/lib/presentation/utils/duration-format.ts` — `formatDuration` for the
  hours, `formatOffset` for the block start, which is what
  `plan-schedule-list.svelte` prints.
- `src/routes/(app)/energy/+page.svelte` — the `addTaskForm` snippet, and
  `windowHours` / `hasTasks`, which are the two gates the panel matches.
- `src/routes/(app)/+page.svelte` around the `addTaskForm` snippet — it gains
  the `preview` snippet and the props that move out of `TaskForm`.
- `messages/en.json` around the eleven `form_impact_*` keys and the
  `energy_total_output` / `energy_end_energy` keys — the new keys go beside the
  former and reuse the latter's wording, and land in `de.json`, `es.json`,
  `fr.json`, `zh.json`.
- `scripts/PROBES.md` — the probe needs its registry row, or `npm run lint`
  fails.
- `docs/testing.md`'s level table — why the model work is a `*.test.ts`, the
  store work a `*.svelte.spec.ts`, the panel a story `play`, and only the two
  end-to-end paths an `e2e`.
- [what-the-draft-takes-from-the-day.md](what-the-draft-takes-from-the-day.md)
  and
  [the-form-that-priced-the-day-it-joined.md](the-form-that-priced-the-day-it-joined.md)
  — both frozen. Each lists `/energy`'s form under **Out of scope**; that is a
  scoping note, not a refusal, and neither file is edited by this change.

## Decisions

- **The trigger is a button, and it sits in the field column.** One press, one
  solve. Rejected: a `$derived` like `/`'s, which the measured 35–195 ms puts on
  the wrong side of the repo's own threshold; and a debounce, which is the same
  cost paid repeatedly on drafts the user has not finished typing. The button
  goes in the footer of the field column, in the `mr-auto` slot the must-do
  toggle occupies on `/` — free on the Lab's form, which passes
  `withMustDoToday={false}`.
- **`TaskForm` takes a `preview` snippet and an `action` snippet; it never
  learns which screen it is on.** The column exists iff `preview` is passed, and
  `impact` / `nextTasks` / `hasNextTaskRoom` / `onnexttasks` move out of
  `TaskForm`'s props onto `/`'s page, which renders `TaskFormPreview` inside its
  own snippet. `preview` is rendered with `pick` as its argument, since the
  next-task buttons fill the title field and only `TaskForm` can do that —
  the same shape `task-list-card` already uses for `form(close)`. Rejected:
  a second `energyImpact` prop alongside `impact`, which is a mode flag spelled
  as two props that are never both set — the thing `presentation/AGENTS.md` bans
  by name.
- **The reading is dropped whenever the draft changes, never marked stale.**
  `ondraftchange` fires on every edit; the store clears `draftImpact` on the
  ones that MOVE the draft, the panel returns to its prompt line and the button
  comes back. Rejected: `BudgetCurveCard`'s `isStale` fingerprint, which is right
  for a 17-solve sweep the user may want to keep looking at while they change
  something, and wrong for a one-solve reading that costs a click to refresh. A
  stale number beside live sliders is a number that disagrees with the fields
  above it.

  **Corrected before the commit, once the panel was driven:** "every edit" and
  "the draft changes" are not the same set, and clearing on the first was wrong.
  The form republishes on every keystroke in the TITLE too, and a title reaches
  no solve — `prependDraft` blanks it — so those arrive carrying the same four
  ratings. Charging a second press for a number that cannot have moved is what
  the setter's value comparison (`isSameDraft`) now prevents. It is not the
  `isStale` fingerprint this bullet rejects: nothing is dated or greyed, and a
  draft that really moves still drops the reading outright.

- **A failed solve clears back to the prompt line and logs; there is no error
  state.** The only caller is a fire-and-forget click handler, exactly as
  `computeBudgetCurve` documents. Rejected: a `hasError` flag — the panel that
  strands on "working…" is the failure worth preventing, and one is prevented by
  the `finally`, not by a fourth state.
- **The panel carries four readings and no more.** Hours-and-when, Total Output,
  the two end-energy rows, and what it displaces. Each is a figure `PlanSummary`
  already prints above the form or the direct analogue of a row `/`'s panel
  already carries; nothing here is a quantity the user meets for the first time
  in a dialog.
- **Total Output earns its row as a magnitude, not a verdict.** It is expected
  to rise nearly always: adding a candidate cannot lower the maximum of the
  `objective` the search climbs, since every plan that ignored the draft is
  still available, and `totalOutput` tracks that climb loosely. Which is the
  same near-tautology ROADMAP's "add a task as an advice lever" was rejected
  on. It is not the same
  use: that entry rejected _ranking_ an action nothing can lose, and this row
  prints the size of a gain the user has already chosen, against the two cost
  rows beside it. The probe above records how often it is not a gain, so the
  claim is a measurement and not an assertion. Rejected: printing `objective`
  instead, which is the figure `valueVsClassic` uses but not one the page prints
  anywhere the user can see.
- **Displacement reads over active tasks; the day-level readings read over all
  of them.** The same split, for the same reasons, as
  [what-the-draft-takes-from-the-day.md](what-the-draft-takes-from-the-day.md):
  a completed task keeps its blocks and will not be re-worked, so naming one as
  displaced is a phantom, while Total Output and end energy are the day's own
  readings over the plan `optimizeSchedule` actually returns — which is solved
  over completed tasks too, by the rule above `#energyTasks`.
- **An unfunded draft displaces nothing, by the same construction as `/`.** The
  optimizer is a seeded local search, so a candidate it funds nothing for can
  still move the plan it lands on; that movement is the search's, not the
  draft's, and reading it as a cost would name hours the day is not buying.
- **A zero window returns `null`, and the panel says so.** The page already
  refuses to draw a plan without a window and offers "set a day window"
  instead; the panel agrees with it rather than printing four zeroes from a plan
  the optimizer never made. A day with no OTHER tasks is priced normally — a
  one-task day is a real plan, and "what would this alone give me" is a fair
  question.
- **`prependDraft` is reused, not re-derived.** It already decides that a draft
  joins the day FIRST and under an id one past the day's highest, and it says
  why in its own doc comment. The energy reading maps its output through
  `toEnergyTask`; a second prepend here would be a mirrored definition of how an
  unsaved task joins a day (R3).
- **The reading lives in its own file.** `energy-draft-impact.ts` beside
  `draft-impact.ts`, importing the three shared shapes from it — the same split
  `zenith.ts` and `zenith-energy.ts` already price. Rejected: one file holding
  both, which would pull `daily-metrics` and `zenith-energy` into the same
  module for two functions that share only their input type.
- **The baseline is passed in, never re-solved.** `EnergyLabStore` already holds
  `#plan` as a `$derived`; taking it as an argument is what keeps this one solve
  rather than two, and it is the same call `calculateDraftImpact` made for the
  same reason.

## Open questions

None.
