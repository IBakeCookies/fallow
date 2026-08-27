# The block that was already done

**Kind:** feature · **Status:** planning · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On `/energy`, ticking a task off leaves its blocks in the day's plan looking
exactly like the work still ahead. After this, a finished task's blocks read as
finished — struck through with a ✓ in the timeline bar, dimmed and struck
through in the schedule list — so the plan can be read as "what is left" without
holding the ledger's checkboxes in your head.

The plan itself does not move. The allocator is blind to `completed`
(`business/model/AGENTS.md`, "The budget's shadow price is a day-level
reading"), and the energy optimizer runs over every task for the same reason:
checking one off must not re-solve the day. This is a reading laid over blocks
that are already there.

## Scenarios

### Scenario — a finished task's block reads struck through in the bar

`src/lib/presentation/component/plan-timeline-bar.stories.svelte`

- **Given** a plan of `boxing` (0h–2h15), rest (2h15–3h), `writing` (3h–6h) in
  an 8 h window, and `boxing` completed
- **When** the bar renders
- **Then** `boxing`'s label carries `line-through`

### Scenario — a finished task's block is marked with a ✓

`src/lib/presentation/component/plan-timeline-bar.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the bar renders
- **Then** `boxing`'s label text begins with `✓`

### Scenario — a finished task's block keeps its width

`src/lib/presentation/component/plan-timeline-bar.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the bar renders
- **Then** `boxing`'s block still has `width: 28.125%`

### Scenario — a finished task's block keeps its series hue

`src/lib/presentation/component/plan-timeline-bar.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the bar renders
- **Then** `boxing`'s block still has `background-color: var(--series-1)`

### Scenario — a finished block too narrow for a label says so in its tooltip

`src/lib/presentation/component/plan-timeline-bar.stories.svelte`

- **Given** an 8 h window holding a 20-minute `inbox` block — under
  `LABEL_MIN_SHARE`, so it renders no label — and `inbox` completed
- **When** the bar renders
- **Then** the block's `title` reads `inbox (done) — 0h–20m (20m)`

### Scenario — a rest block never reads as done

`src/lib/presentation/component/plan-timeline-bar.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the bar renders
- **Then** the rest block's `title` is unchanged — no `(done)`

### Scenario — a finished task's row dims in the schedule list

`src/lib/presentation/component/plan-schedule-list.stories.svelte`

- **Given** the same plan, `boxing` completed, in the schedule view
- **When** the list renders
- **Then** `boxing`'s `<li>` carries `opacity-60`

### Scenario — a finished task's row title is struck through in the schedule list

`src/lib/presentation/component/plan-schedule-list.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the list renders
- **Then** `boxing`'s title carries `line-through`

### Scenario — a finished task's row announces "done"

`src/lib/presentation/component/plan-schedule-list.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the list renders
- **Then** `boxing`'s row holds an `sr-only` "done"

### Scenario — a finished task's row keeps its output figure

`src/lib/presentation/component/plan-schedule-list.stories.svelte`

- **Given** the same plan, `boxing` completed
- **When** the list renders
- **Then** `boxing`'s row still prints its `+2.40` output

### Scenario — ticking a task off marks its block

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile, one task `Deep work` added on `/`, a saved day, and
  `/energy` open with a positive day window
- **When** `Mark Deep work complete` is checked
- **Then** the bar's `Deep work` label reads `✓Deep work`

### Scenario — un-ticking it restores the block

`e2e/energy-lab.e2e.ts`

- **Given** `Deep work` checked on `/energy`, its block marked
- **When** the checkbox is un-checked
- **Then** the bar's `Deep work` label carries no `✓`

## Out of scope

- **`/`'s own day strip** (`component/day-timeline.svelte`,
  `utils/day-timeline.ts`). It draws completed tasks with no distinction too —
  same question, different component, different geometry util, and its blocks
  carry a band bar and a flow sentence the energy bar has no equivalent of.
  Left for its own change so this one stays two components.
- **A ✓ on a block too narrow for a label.** Below `LABEL_MIN_SHARE` the bar
  prints nothing at all today, and the branch to print a bare glyph there is a
  branch nobody asked for (AGENTS.md §0). The schedule list gives every block a
  row regardless of width, and it is the toggle's other half of the same card —
  that is the reading for a narrow block.
- **Any change to a number.** `workHours`, per-block `output`,
  `satiatedOutput`, `valueVsClassic`, the stop advisor and the trajectory chart
  all read the full intended day and keep doing so. Nothing here enters the
  model.
- **Removing or reordering a finished task's blocks.** Settled against —
  see **Goal**.
- **Making the bar's blocks properly announced.** They are non-semantic `<div>`s
  carrying a `title`, which is not a reliable accessible name; the schedule list
  is the announced reading of the same blocks. Pre-existing, noticed here, not
  fixed here (AGENTS.md §0).

## Read before building

- `src/lib/presentation/component/plan-timeline-bar.svelte` — the bar.
  `LABEL_MIN_SHARE` (the label floor), the label `<span>`, and the `title` built
  from `energy_block_tooltip`.
- `src/lib/presentation/component/plan-schedule-list.svelte` — the list rows.
  The `<li>`, the title `<span>` that already switches on
  `block.taskId === null`, and the output column.
- `src/routes/(app)/energy/+page.svelte` — both call sites (`PlanTimelineBar`,
  `PlanScheduleList`), and the `activeTasks.length === 0` branch directly above
  them: an all-completed day replaces the whole plan card with
  `energy_all_done`, so a fully-marked bar is unreachable.
- `src/lib/presentation/style/STYLE.md`, "A series fill under a label is
  opaque" — why the bar's fill is not dimmed. Alpha on a series fill shipped
  once (blocks at 70%, rest at 40%) and was removed as a contrast bug.
- `src/lib/presentation/component/task-row-shell.svelte` — the done language
  being reused: `opacity-60` on the row's content, `text-ty-silent line-through`
  on the title. One vocabulary for "finished" across the screen.
- `src/lib/business/model/AGENTS.md`, "The budget's shadow price is a day-level
  reading" — "the allocator is blind to `completed`", the settled statement this
  feature is a reading over.
- `src/lib/business/store/energy-lab-store.svelte.ts` — `#energyTasks` (the
  optimizer's input is every task, completed included) and `#stopAdvice`, which
  already builds the complement set `openTaskIds`. Check R3 before adding a
  second definition of the same split.
- `src/lib/presentation/component/energy-task-row.svelte` — its `trailing`
  snippet comment says a completed task is one "the optimizer no longer plans at
  all". That is false: `toEnergyTask` drops `completed`, so the optimizer funds
  it and `allocatedHoursByTask` holds its hours — the row chooses not to print
  them. **Correct the comment in this change** (AGENTS.md §0: documentation the
  change discovers false is fixed in the diff that found it). The behaviour is
  right and stays.
- `src/lib/presentation/AGENTS.md` — the UI rules this joins: "A completed task
  renders its `Planned` and `Prio` cells EMPTY", and "Ordering rows by `#N` is
  what rescoped `#N`" (completion-invariance, and a gap meaning "done"). Add the
  paragraph for this reading beside them; it is a public prop change on two
  components, which is where this repo prices its interfaces.
- `messages/en.json` around `energy_block_tooltip` — two new keys, and the same
  two in `de.json`, `es.json`, `fr.json`, `zh.json`.
- `e2e/energy-lab.e2e.ts`, the "completing a task opens its drain rating" tests
  — the existing check-a-task-on-`/energy` flow to extend, and its note that
  `opacity` does not inherit, so an assertion must land on the element that
  carries the class.
- `docs/testing.md` — the level table: a component change is a story `play`, the
  user flow is `e2e`.

No MATH.md section changes.

## Decisions

- **The bar marks, it does not dim** — `✓` prefixed to the label plus
  `line-through`, hue and opacity untouched. Rejected: alpha on the fill,
  because STYLE.md settled it ("a series fill under a label is opaque"): the
  fill is fixed so `series-ink` can be fixed, and a translucent block composites
  toward the surface and drops the pair under 4.5:1 on the dark themes. Also
  rejected: a diagonal hatch (a CSS pattern under the ink, and the pairing the
  `series-ink-contrast` script checks would need re-reading), and recolouring the
  block to `--series-rest` (that is the rest block's own colour — a finished task
  would become indistinguishable from a break, the one distinction the bar
  exists to draw).
- **The list dims, because nothing is written on its fill.** STYLE.md's rule
  ends "wash out a fill only where nothing is written on it", and the list's mark
  is a 10px dot with no label — so the row takes `opacity-60` and the title
  `text-ty-silent line-through`, the ledger row's own vocabulary.
- **Completion is a presentation prop, not a field on `EvaluatedBlock`.** Both
  components take `completedTaskIds: number[]`; the page derives it from
  `session.tasks`. `EvaluatedBlock` is a model type and the optimizer never sees
  `completed` — putting it there would imply the plan reads it. An array and
  `.includes` over a `Set`: a day holds a handful of tasks, and a `Set` built in
  a reactive context needs the `svelte/prefer-svelte-reactivity` disable the
  store already carries. Rejected: folding it into `SeriesColors`, because that
  util is the categorical scale and `colorOf` would stop being about colour.
- **The mark is per task, not per block.** A task interleaved into two blocks
  marks both, including one that sits later in the day. There is no alternative:
  the plan carries no time of day at all (`formatOffset` offsets from the day's
  own zero — see
  [the-plan-that-had-no-clock.md](the-plan-that-had-no-clock.md)), so "the block
  you already ran" is not a reading the app can make.
- **A separate tooltip message, not a suffix appended in markup.**
  `energy_block_tooltip_done` mirrors `energy_block_tooltip`'s params; a
  concatenated "(done)" is a string a translator cannot place.
- **The list's "done" is `sr-only`, the bar's is the tooltip.** Colour is not
  carrying the reading in either place (the ✓ and the strikethrough are glyphs),
  so WCAG 1.4.1 is not the driver — the announcement is, and the list is the
  surface that can make it. Precedent: `day-timeline.svelte`'s `sr-only`
  `bandLabel`.
- **`/`'s strip is left alone deliberately, not overlooked.** See **Out of
  scope**.

## Open questions

None.
