# What the draft takes from the day

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The add-task form's reading panel says what today looks like once the draft is
in it — the draft's hours, its slot, both pools, the unassigned hours left. It
never says what that costs. A task can arrive at `runs 2 of 5` having quietly
pushed something else off the plan, and the panel reads the same either way.

After this the panel carries two more readings: **what the draft takes from the
day's other tasks** — the hours they lose, or by name the ones it unfunds
outright, or that it takes nothing at all — and **Burnout Risk before and
after**, banded like the pools beside it.

Both come out of the solve the panel already pays for. No new solve, no button,
no change to any number the model computes.

## Scenarios

### Scenario — the draft thins the day's other tasks

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a day whose plan spends its budget across three active tasks, and a
  draft the plan funds
- **When** the impact is calculated
- **Then** `displaced.hoursTaken` is the total hours those tasks lose between
  the baseline plan and the plan with the draft in it
- **And** `displaced.taskCount` is how many of them lost any hours

### Scenario — the draft unfunds a task by name

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a tight day whose plan funds an active task the draft outscores
- **When** the impact is calculated
- **Then** `displaced.unfunded` holds exactly the titles of the active tasks
  that had hours in the baseline plan and have none in the plan with the draft

### Scenario — the day had room for it

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a day with unassigned hours the draft fits inside
- **When** the impact is calculated
- **Then** `displaced.hoursTaken` is 0
- **And** `displaced.taskCount` is 0
- **And** `displaced.unfunded` is empty

### Scenario — an unfunded draft takes nothing

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** the 2 h day holding four high-importance tasks that funds no hours
  for a weak draft
- **When** the impact is calculated
- **Then** `displaced.hoursTaken` is 0 and `displaced.unfunded` is empty

### Scenario — an unfunded draft takes nothing on a day whose plan still moves

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a 3 h day with declared pools where the plan moves under a draft it
  funds no hours for
- **When** the impact is calculated
- **Then** `displaced` reads zero on all three parts

### Scenario — a completed task is never displaced

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a day holding a completed task that carries hours, and a draft the
  plan funds
- **When** the impact is calculated
- **Then** the completed task's title is absent from `displaced.unfunded`
- **And** any hours it loses are absent from `displaced.hoursTaken`

### Scenario — Burnout Risk is the day's own reading, before and after

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a 12 h day holding `Write spec` and `Gym`, and a physical draft
- **When** the impact is calculated
- **Then** `burnoutRisk.before` is the baseline's `burnoutRisk`
- **And** `burnoutRisk.after` equals what `calculateDailyMetrics` reports for
  the same day with the draft deployed as a real task

### Scenario — the panel names what the draft unfunds

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact whose `displaced.unfunded` holds `Write report`
- **When** the panel renders
- **Then** the cost row names `Write report`

### Scenario — the panel prints the total when nothing is unfunded

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact taking 0.67 h from 3 tasks and unfunding none
- **When** the panel renders
- **Then** the cost row reads `40m` and `3`

### Scenario — the panel says the day gave it up for free

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact whose `displaced.taskCount` is 0
- **When** the panel renders
- **Then** the cost row says the day loses nothing

### Scenario — an unfunded draft prints no cost row

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact of 0 hours and a `null` position
- **When** the panel renders
- **Then** the cost row is absent

### Scenario — the Burnout Risk row reads before and after

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact whose burnout risk goes 31 % → 58 %
- **When** the panel renders
- **Then** the row reads `31% → 58%`
- **And** it carries the `AXIS_BAND.burnoutRisk` band's colour on its bar
- **And** an `sr-only` band label sits beside the figure

## Out of scope

- **Naming why the draft got no hours.** Closed by
  [the-form-that-priced-the-day-it-joined.md](the-form-that-priced-the-day-it-joined.md):
  `UnfundedReason` is the advisor's, attributed off a candidate frontier costing
  `activeTasks + 3` solves, and a cheaper second attribution here would mirror
  the same question (R3). This change does not re-open it — displacement is a
  diff of two plans already in hand, not an attribution, and it never says why.
- **A per-task breakdown of where the hours came from.** One line, one reading.
  A table of `Write spec −20m, Gym −20m` prices the same total three ways and
  turns a panel you glance at into one you audit.
- **A Time Scarcity or Deep Work Ratio row.** Both are free off the same solved
  plan and both were considered. Time Scarcity and the unassigned-hours row
  already on the panel describe the same shortage twice; Deep Work Ratio moves
  for reasons the draft's own three sliders already show.
- **A Zenith Gain delta.** `calculateZenithGain` takes `Task[]` and re-solves
  the day. The panel is a `$derived` on every keystroke
  (`business/AGENTS.md`, "The add-task draft is priced in a `$derived`"), and a
  second solve there is exactly what that rule permits it to skip.
- **`/energy`'s copy of the form.** It passes no `impact` and stays one column,
  for the reason the earlier spec gives: its plan is the energy optimizer's.
- **An advice lever, a button, or any prompt to act.** The panel offers no lever
  — the way to act on it is the form beside it.
- **Any change to a number.** The allocator, the pools, the slack, the priority
  score and Burnout Risk are read exactly as they are. Nothing here enters the
  model.

## Read before building

- `src/lib/business/model/metric/draft-impact.ts` — `DraftImpact` and
  `DraftChange` gain fields; `calculateDraftImpact` already holds both plans at
  its return, which is the whole mechanism.
- `src/lib/business/model/metric/daily-metrics.ts` — `burnoutRisk` on
  `DailyMetrics` is the `before`; `energyParams` on `DailyMetricsInput` is what
  the `after` needs and is the one field `calculateDraftImpact` does not yet
  destructure. Read the **task-set split** comment in `calculateDailyMetrics`
  before choosing a set for either reading.
- `src/lib/business/model/metric/calculation.ts` —
  `calculateBurnoutRisk(suggestedTasks, availableHours, switchCost, params)` is
  pure over an already-solved plan, which is why the `after` costs nothing.
- `src/lib/business/AGENTS.md`, "The add-task draft is priced in a `$derived`,
  unlike the advice" — the budget this change has to stay inside. It still holds
  after this: no solve is added.
- `src/lib/presentation/AGENTS.md`, "The add-task form's second column is a
  reading and nothing else" — still true after this, and the reason no row here
  may become a control.
- `src/lib/presentation/component/task-form-preview.svelte` — the `poolRow`
  snippet the Burnout Risk row copies, and the label-and-figure rows the cost
  row copies.
- `src/lib/presentation/utils/band.ts` — `AXIS_BAND.burnoutRisk`,
  `BAND_BAR_CLASS`, `BAND_TEXT_CLASS`, `bandLabel`. A reading carries a `Band`,
  never a class string.
- `messages/en.json` around the eleven existing `form_impact_*` keys — the new
  ones go beside them, and into `de.json`, `es.json`, `fr.json`, `zh.json`.
- [the-form-that-priced-the-day-it-joined.md](the-form-that-priced-the-day-it-joined.md)
  — frozen, and the decisions it already made about this panel: the draft is
  solved at the head of the list under an id one past the day's highest, an
  unnamed draft is not priced, both pools read.
- ROADMAP's **Considered on 2026-08-04 and not proposed**, the entry "A backlog
  flag, or 'add a task' as an advice lever" — related and NOT re-opened here.
  That entry rejects offering _add a task_ as an advice lever because adding one
  never lowers `Σ P̄` and the axis would read "add more work". This reading is
  the opposite direction: the user has already decided to add the task and is
  being told its price.

**No MATH.md section changes.** Every quantity here already exists and no
formula moves. Burnout Risk's derivation lives inside §8 without a heading of
its own, so there is no section to cite; MATH.md is §0–§10 with 27 sections
total, and the §11 / §14 / §33 / §35 numbers that appear in older frozen specs
are pre-renumber addresses that no longer resolve.

## Decisions

- **The cost row is ONE line with three shapes, and names beat numbers.**
  Unfunded titles when there are any; otherwise the hours taken and the count of
  tasks that lost them; otherwise "takes nothing from the day". Unfunding a task
  is categorically different from thinning several, and it is the outcome that
  would actually change the user's mind about a slider — so when it happens it
  takes the line, and the hours total steps aside rather than sharing it. The
  repo already prices this shape: an unfunded task gets ONE reason, not a menu
  (AGENTS.md §4). Rejected: always printing the total and never a name, which
  hides the only case worth interrupting for; and a total line plus a named
  list, which is two rows for one fact.
- **The unfunded list is not capped.** A day that drops five tasks to fit one
  draft is a day the user most needs to see all five, and the panel's rows
  already wrap. A cap would need a "+N more" message and a branch to earn.
- **The empty case prints a sentence rather than dropping the row.** Asked
  directly: absence is ambiguous, and "takes nothing from the day" is the answer
  the panel exists to give on a day with slack. This deliberately differs from
  the zero-hour pool rows, which drop — those drop because their figure is
  `Infinity`, which is not a reading at all.
- **An unfunded draft displaces nothing by construction, not by luck.** The
  first draft of this spec justified the zero by saying a candidate the search
  does not choose cannot move the argmax over the rest. That is false: the
  pooled allocator is greedy-plus-transfer-repair, not an exact argmax, so an
  unfunded candidate can move the plan — the review found a witness, and it is
  the 3 h declared-pool day the test now pins. The movement is the search's and not
  the draft's, and reading it as a cost would name hours the day is not buying,
  so `displaced` is zeroed whenever the plan funds the draft nothing. That is
  also the condition the panel already drops the row on, so the two agree
  instead of the panel hiding a reading that disagrees with its own name.
- **Displacement reads over ACTIVE tasks; Burnout Risk reads over all of
  them.** Two different sets on purpose, each matching what the quantity means.
  A completed task holds its hours in the plan and the user will not re-work it,
  so naming one as displaced would be a phantom — the diff filters to
  `!completed`, the same set `activeTasks` is. Burnout Risk is the day's own
  dashboard reading and `calculateDailyMetrics` computes it over
  `suggestedTasks`, all of them; computing the `after` over a different set
  would make `before` and `after` two different metrics.
- **`before` is taken from the baseline, never recomputed.** The baseline
  `DailyMetrics` is passed in and already carries `burnoutRisk`, exactly as
  `slackHours.before` already takes `planSlackHours`. Recomputing it would be a
  second definition free to disagree with the dashboard's (R3).
- **The row prints no delta arithmetic.** `31% → 58%`, like every other
  before-and-after row on this panel, not `+27 pts`. One format for the whole
  column.
- **No new solve, and that is the constraint the change is designed around.**
  Both readings fall out of `calculateTaskPlan`'s output, which
  `calculateDraftImpact` already computes and already discards most of. Rejected
  along the way for failing it: Zenith Gain (re-solves), the unfunded reason
  (`activeTasks + 3` solves), and a per-title past-hours spread (no instrument
  — same reason the earlier spec refused it).
- **`displaced` is one nested field, not three flat ones.** `hoursTaken`,
  `taskCount` and `unfunded` are one reading with three parts and are read
  together by the one row that renders them; flattening them onto `DraftImpact`
  would put three names in the interface where the caller uses one.

## Open questions

None.
