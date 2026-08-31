# Task importance weight

**Kind:** feature · **Status:** landed 2026-08-31 · **Roadmap:** item 23

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

The user can mark a task **low**, **normal** or **high** importance, and a day
too short to fund everything funds what matters instead of what is cheap.
Today the plan ranks purely on what the model thinks a task is worth per hour,
so an easy, enjoyable errand outranks the invoice that has to go out.

Importance redivides the day's budget across tasks — both which ones are funded
and how many blocks a funded one gets. What it does **not** touch is any figure
that belongs to a task on its own: `argmax v·P̄ = argmax P̄`, so the optimal
stopping time, the printed priority score and the three ratings are the same
whatever level the user picks.

## Scenarios

### Scenario — a new task is created at high importance

`e2e/task-importance.e2e.ts`

- **Given** a fresh profile with no tasks and no logs
- **When** the user picks **High** in the add-task form and submits
- **Then** the new row shows a high-importance badge

### Scenario — importance survives a reload

`e2e/task-importance.e2e.ts`

- **Given** a task saved at **High** on today
- **When** the page is reloaded
- **Then** the row still shows a high-importance badge

### Scenario — a tight day funds the important task over the cheap one

`e2e/task-importance.e2e.ts`

- **Given** today has a 2-hour budget and two tasks, and the plan funds only the
  cheaper one at default importance
- **When** the user sets the unfunded task to **High**
- **Then** the previously unfunded task is shown suggested hours

### Scenario — the cheap task loses its hours in the same move

`e2e/task-importance.e2e.ts`

- **Given** the state at the end of the scenario above
- **When** the plan re-solves
- **Then** the previously funded task is shown no suggested hours

### Scenario — importance is editable on an existing task

`e2e/task-editing.e2e.ts`

- **Given** a task saved at **Normal**
- **When** the user opens its edit form, picks **Low** and saves
- **Then** the row shows a low-importance badge

### Scenario — a routine carries the importance it was saved with

`e2e/routine.e2e.ts`

- **Given** a routine saved from a task list containing one **High** task
- **When** the routine is loaded onto an empty day
- **Then** the loaded row shows a high-importance badge

### Scenario — the control is a real radio group

`src/lib/presentation/component/task-importance-select.stories.svelte`

- **Given** the control rendered at **Normal**
- **When** the user presses the arrow key to the next option
- **Then** `getByRole('radio', { name: 'High' })` is checked

### Claim — the item has reach: a day leaves tasks unfunded (gate)

`scripts/task-importance.probe.ts`

Item 23 gated itself on a histogram of the author's own
`DailySession.availableHours` — an audience question answered at n = 1, against
a database that no longer exists. The model question underneath it needs no
users at all: importance can only re-rank tasks the allocator currently leaves
at zero hours, so the item's entire reach is the share of days where the
unfunded set is non-empty **and** something else is funded. A day that funds
everything is untouchable however important its tasks are.

- **Given** the pooled allocator swept over budget × task count, and again over
  budget-per-task
- **Then** the contested-day share, and **the item is killed rather than built
  if it is near zero across the plausible range**

### Claim — the default is an exact no-op (pin)

`src/lib/business/model/zenith.test.ts`

Phrased through today's surface so it runs green against the old code, which is
its pass condition: a `PooledTaskInput` with no `importance` field.

- **Given** any task list with no importance declared
- **Then** `calculatePooledAllocations`, `calculateTaskAllocations` and
  `calculateTotalProductivity` return exactly what they return today

### Claim — positive scaling preserves the menu's shape

`src/lib/business/model/zenith.test.ts`

The premise §4's exact greedy and the funded-subset enumeration rest on.

- **Given** any task and any `v > 0`
- **Then** the scaled block increments are positive and non-increasing wherever
  the unscaled ones are

### Claim — importance does not move the stopping time

`src/lib/business/model/metric/calculation.test.ts`

- **Given** one task, solved at each of the three importance levels with a
  budget long enough to fund it in all three
- **Then** its `priorityScore`, `optimalHours` and `flowStateTime` are identical
  across the three

### Claim — both sides of the gain are weighted

`src/lib/business/model/zenith.test.ts`

`pooledProductivityGain` scores its optimized plan and its naive baseline
through the same `calculateTotalProductivity`, so the weight enters both or the
gain inflates.

- **Given** any task list with any importance levels, on the single-budget path
- **Then** `gainPercent` is not negative — the existing invariant, still holding

## Out of scope

- **The energy mode does not get the weight.** `optimizeSchedule` maximizes
  total output (MATH.md §8), not `Σ P̄`; a value multiplier on an integral of
  output is a different quantity, and the two modes stay peers (AGENTS.md §4).
- **No second axis.** One 3-level weight per task, not a deadline, not a
  numeric priority, not a per-day override of the task's level.
- **The advisor does not price importance.** No new lever, no "raise this
  task's importance" suggestion — the advisor ranks levers the user already
  owns, and this is a declared input like the sliders.
- **`DEFAULT_CAPACITY_POOLS`, the pools and the switch cost are untouched.**
- **No `DB_VERSION` bump.** R8 governs stores, not shapes; a new optional field
  on `Task` is read through `sanitizeTask` like every other.

## Read before building

- ROADMAP.md item 23 — the item's own text, including the kill-probe, the
  circularity warning on the 14.7% figure, and the R3 hazard. **It names
  `toEnergyTask` as the place the energy mode misses the weight; routing found
  that wrong** — `plan-audit.ts` does not call `toEnergyTask` for its classic
  branch, it rebuilds pooled inputs inline (see below). Correct the item's
  sentence in the landing commit, then collapse it to SHIPPED with a link here.
- `src/lib/business/model/zenith.ts` — `buildBlockIncrements` (the menu),
  `planValue`, `bestPlanWithSwitchCost`, the two `allocTasks` maps in
  `calculateTaskAllocations` and `calculatePooledAllocations` (the single
  insertion point for the scale), `calculateTotalProductivity`,
  `pooledProductivityGain` and `naiveBaselineValue`. `toAllocations` computes
  `optimalAvgProductivity` and must **not** be scaled.
- `src/lib/business/model/metric/calculation.ts` — `toPooledInputs` is the entry
  point; `calculateTaskPlan` turns `optimalAvgProductivity` into
  `priorityScore`; `calculateCompletionRate` and `calculateYieldIndex` weight by
  that score.
- `src/lib/business/model/metric/remaining-day.ts` — the second `priorityScore`,
  un-rescaled by design; it must stay the same quantity as the plan's.
- `src/lib/business/model/metric/history.ts` — its comment states `priorityScore`
  is INTRINSIC and therefore exact for `completionRate`. That claim survives this
  change; check it still reads true after.
- `src/lib/business/model/plan-audit.ts` — the classic branch builds pooled
  inputs inline from the audit's task records, an existing mirror of
  `toPooledInputs`. It must carry the weight or `classicOverlap` starts scoring
  reality against a plan the user was never shown. The energy branch stays
  unweighted.
- `src/lib/business/session-history.ts` — `session.tasks.map(toEnergyTask)` is
  where the audit's task records are built, so it is where importance has to be
  threaded through.
- `src/lib/data/type/index.ts` — `Task`, and `mustDoToday`'s comment beside it
  explaining exactly why that flag does **not** travel; importance does.
- `src/lib/business/model/persisted.ts` — `taskCore` (shared by session tasks and
  routine templates) and `sanitizeTask`. Importance goes in `taskCore`.
- `src/lib/presentation/component/must-do-toggle.svelte` — the STYLE.md carve-out
  this control copies: a real input keeping its role and keyboard, with the
  button recipe on the label.
- `src/lib/presentation/component/task-form-fields.svelte`,
  `task-form.svelte`, `task-edit-form.svelte` — the `TaskEdit` draft type and the
  two forms the control lands in.
- `src/lib/presentation/component/task-item.svelte`, `task-row-shell.svelte`,
  `task-list.svelte` — how `mustDoToday` reaches a badge on the row.
- `messages/{en,de,es,fr,zh}.json` — five locales; `form_must_do_today` at line
  274 of each is the neighbouring key.
- `src/lib/business/model/AGENTS.md` — the settled-decision list this change adds
  to (priority stays intrinsic; the energy mode stays unweighted).
- AGENTS.md §4 — the decision index mirrors that list.
- MATH.md §0 — the objective becomes `Σᵢ vᵢ·P̄ᵢ(tᵢ)`, same commit (R7). §3 gains
  the `T*` invariance under positive scaling; §4 gains the note that positive
  scaling preserves the increment menu's positivity and monotonicity, which is
  what its exactness argument needs.
- `docs/testing.md` — the level table each scenario above was picked from.
- `scripts/PROBES.md` — the gate is a probe and needs its registry row in the
  landing commit (`node scripts/probe-registry.mjs --check` fails lint without
  one).

## Decisions

- **Three levels at `v ∈ {0.5, 1, 2}`, default 1** — p90/p10 = 4×, which is the
  dynamic range item 23 defends the item on, against the model's implicit 2.32×.
  Default 1 makes the no-op claim exact rather than approximate. Rejected: a
  continuous 1–10 slider, because the item's whole pre-build argument is a
  3-level scale, and ten levels re-open every metric's calibration for a
  precision nobody has evidence for.
- **The control is three segmented buttons under a visible "Importance" label,
  sitting with the sliders** — importance is a property of the task, like the
  three ratings, not a statement about today like `mustDoToday`, so it tabs
  before the footer's flag rather than beside it. It takes the
  `must-do-toggle.svelte` carve-out three times: real radios inside a
  `<fieldset>`, so the group keeps its roving tabindex and arrow keys and is one
  tab stop, with the button recipe on each `<label>`. All three levels are
  readable at a glance and settable in one click, which a dropdown is not.
  Rejected: a fourth range input in the sliders grid, which is the cheapest diff
  but tells the user the field has ten stops when it has three; rejected: a
  cycling control on the task row, which has nowhere to put a label and no
  keyboard story; rejected: `shadcn-svelte`'s `native-select` — built and
  discarded, because a 3-option dropdown hides two of its three options behind a
  click to save a line of vertical space; rejected: the nav's
  `DropdownMenu.RadioGroup` (the language and theme pickers), which is a nav
  affordance, not a form field whose value is submitted. The **visible** legend
  is what the earlier `sr-only` version got wrong: three bare buttons in a form
  say nothing about what they set.
- **`priorityScore` stays intrinsic — unweighted, unscaled, unmoved** — it is
  printed on the row, it is the weight in Completion Rate and Yield Index, and
  it is the sort key `calculateInterleavedOrder` breaks ties on. Weighting it
  would silently re-score every stored day's Completion Rate against a
  definition those days were never planned under. It also keeps the item's own
  promise honest: importance changes which tasks are funded, not what a task is
  worth per hour. Rejected: v-scaling the printed figure only, which leaves two
  quantities named `priorityScore` disagreeing by a factor of v (R3).
- **Importance goes in `taskCore`, so it travels with routines and day-imports**
  — the level is a property of the task ("the invoice is always high"), like the
  three sliders it sits beside, and unlike `mustDoToday`, whose name is a
  statement about today. Rejected: beside `mustDoToday` in `sanitizeTask`, which
  would silently drop the level every time a routine is loaded.
- **`plan-audit.ts`'s classic branch carries the weight; its energy branch does
  not** — the audit asks how closely reality tracked each mode's own plan, and
  the classic plan the user saw is the weighted one. Leaving it unweighted is
  not a smaller change, it is a wrong reading that only appears once a user sets
  a level. Rejected: weighting the energy branch too, because §8's objective is
  total output and a value multiplier on it is not the same quantity.
- **The scale enters at `increments`, nowhere else** — one multiplication in
  each of the two `allocTasks` maps. `planValue` sums increments, so the
  allocator, the subset enumeration and the greedy all inherit it unchanged, and
  `toAllocations` — which produces every per-task figure the UI prints — is
  provably untouched. Rejected: scaling inside `expectedAverageProductivity`,
  which would leak v into `optimalAvgProductivity`, `peakProductivity` and the
  stopping solve.
- **The gate ran before anything was written, and it passes.** Sweeping the
  pooled allocator, the contested-day share is 100% at 0.25 and 0.4 h per task
  at every task count; at 0.5 h per task the count decides — 8.7% (n = 3),
  26.0% (n = 5), 55.7% (n = 8), 82.0% (n = 12) — then 0.3–7.0% at 0.75, and
  **exactly 0.0% at 0.9 h per task and above, at every task count from 3 to
  12**. No day in the sweep funded nothing, so the only dead region is the
  fully-funded one. The item has reach wherever a day gives each task under
  ~0.9 h.
- **What the weight buys where it has reach: 92.3–100% of contested days.**
  The same probe's third arm raises one unfunded task to `high` and re-solves.
  Seven of the twenty cells that have any contested day fall short of 100% —
  98.0% (n = 3, 1 h), 94.3% and 97.3% (n = 5, 1 and 1.5 h), 92.3%, 93.7%, 97.0%
  and 99.3% (n = 8, 1 through 3 h) — all at the short, crowded end where the day
  cannot buy a block even for a doubled task; every other cell is 100%. This is
  the arm that says the three levels keep their promise, not merely that days
  exist for them to act on.
- **Item 23's kill rule was mis-specified, and this is the second roadmap
  correction the item needs.** It says "kill it if the day is habitually
  planned at ≥ 6 h", but reach is governed by hours ÷ tasks, not hours: a 6-hour
  day is inert at 3 tasks (0.0% contested) and squarely live at 12 (82.0%, the
  0.5 h/task cell). The hours-only threshold drops the term that decides the
  answer. Both corrections — this and the `toEnergyTask` sentence — are moot in
  the landing commit, which collapses item 23 to a date and a link to this
  file.
- **The n = 1 gate was rejected as evidence, not merely as unrunnable.** One
  person's histogram cannot decide what ships for an audience that does not
  exist yet, and the audience question it wanted to ask — do users over-list
  their day — is unanswerable today for anyone. What bounds the risk instead is
  the no-op: `v = 1` is exact, so a user who plans long days and never touches
  the control sees nothing change at all.

## Open questions

None.
