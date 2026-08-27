# The strip that read as all ahead

**Kind:** feature · **Status:** planning · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On `/`, the day strip above the ledger draws every funded block the same way,
so a task ticked off an hour ago still reads as work ahead. After this, a
finished task's block reads as finished — dimmed, its title struck through, and
its `#N` gone — so the strip can be read as "what is left of today" without
checking each block against the ledger's boxes underneath it.

Nothing about the day moves. The allocator is blind to `completed`
(`business/model/AGENTS.md`, "The budget's shadow price is a day-level
reading"), so every block keeps its width, its start offset and the switch-cost
gap beside it. This is a reading laid over the plan the strip already draws.

## Scenarios

### Scenario — a completed task's block carries `isCompleted` (pin: the input already holds the flag)

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** a funded plan of `Write the PDF` (open) and `Boxing training`
  (completed), both in `runOrder`
- **When** the timeline is built
- **Then** `Boxing training`'s block has `isCompleted: true`

### Scenario — a completed task's block keeps its width

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** the same plan, `Boxing training` allocated 1.5 h
- **When** the timeline is built
- **Then** `Boxing training`'s block still has `hours: 1.5`

### Scenario — the block after a completed one keeps its start offset

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** the same plan with a third task after `Boxing training`
- **When** the timeline is built
- **Then** the third block's `startOffset` is unchanged by the completion

### Scenario — a completed task's block dims

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the two-block day, `Boxing training` completed
- **When** the strip renders
- **Then** `Boxing training`'s block carries `opacity-60`

### Scenario — a completed task's block title is struck through

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the same day
- **When** the strip renders
- **Then** `Boxing training`'s title line carries `line-through`

### Scenario — a completed task's block prints no `#N`

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the same day, `Boxing training` at run position 2
- **When** the strip renders
- **Then** `Boxing training`'s block holds no `#2`

### Scenario — an open task's block still prints its `#N` (pin)

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the same day, `Write the PDF` open at run position 1
- **When** the strip renders
- **Then** `Write the PDF`'s block reads `#1`

### Scenario — a completed task's block keeps its flow sentence

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the same day, `Boxing training` allocated past its time-to-flow
- **When** the strip renders
- **Then** `Boxing training`'s block still reads `flow at 1h15m`

### Scenario — a completed task's block keeps its band fill

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the same day, `Boxing training` banded `success`
- **When** the strip renders
- **Then** `Boxing training`'s bar still carries `BAND_BAR_CLASS.success`

### Scenario — a completed task's block announces "done"

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the same day
- **When** the strip renders
- **Then** `Boxing training`'s block holds an `sr-only` "done"

### Scenario — ticking a task off marks its block in the strip

`e2e/tasks.e2e.ts`

- **Given** a fresh profile with a budget, one task `Write report` added on `/`,
  funded and drawn in the strip
- **When** `Mark Write report complete` is checked
- **Then** the strip's `Write report` title line carries `line-through`

### Scenario — un-ticking it restores the block

`e2e/tasks.e2e.ts`

- **Given** `Write report` checked and its block marked
- **When** the checkbox is un-checked
- **Then** the strip's `Write report` title line carries no `line-through`

### Scenario — the strip still draws on an all-done day (pin)

`e2e/tasks.e2e.ts`

- **Given** the same one-task day with `Write report` checked
- **When** `/` renders
- **Then** the strip's `Write report` block is visible

## Out of scope

- **`/energy`'s bar and schedule list.** They are the other half of the same
  question and are being built right now under
  [the-block-that-was-already-done.md](the-block-that-was-already-done.md), with
  their own vocabulary and their own reasons for it. This change touches neither
  component nor either of their message keys.
- **The strip's legend.** `day_timeline_legend` names what a filled bar, a short
  bar and a gap mean. It stays as it is: it is one unconditional sentence, and a
  clause about a mark that most days do not carry is a sentence about nothing on
  those days — the same reason the legend renders inside the strip rather than
  above it. The strikethrough and the dim are the ledger's own done vocabulary,
  one row below, and need no key.
- **Any change to a number.** `budgetHours`, `suggestedHours`, `flowStateTime`,
  the band, the run order, `minimumBlockWidths` and the metric rows all read the
  full intended day and keep doing so. Nothing here enters the model.
- **Removing, reordering or reflowing a finished task's blocks.** Settled — see
  **Decisions**.
- **A `title` tooltip on the block.** The strip's blocks carry none today; the
  `sr-only` "done" is the announcement, matching the `sr-only` band label already
  in the same block. Adding a tooltip is a branch nobody asked for
  (AGENTS.md §0).
- **The `#N` tooltip.** `task-item`'s badge is a `Tooltip.Trigger`; the strip's
  is a bare `<span>` and stays one.

## Read before building

- `src/lib/presentation/utils/day-timeline.ts` — the view model. `DayBlock`, the
  `Pick<SuggestedTask, …>` on `DayTimelineInput` (widen it with `'completed'`),
  and the `ordered.map` that builds each block. `SuggestedTask = Task & {…}`, so
  the flag is already on the input the page passes.
- `src/lib/presentation/component/day-timeline.svelte` — the block markup: the
  `#N` `<span>` and the title in one `<p>`, the flow sentence `<p>`, the
  `mt-auto` band bar, and the `sr-only` `bandLabel` the "done" span joins.
- `src/routes/(app)/+page.svelte` — the `buildDayTimeline` call (`daily`,
  `session.switchCost`) and the `strip={daily.suggestedTasks.length ? … }` gate,
  which counts completed tasks too. Confirm the page needs no change beyond what
  the widened `Pick` demands.
- `src/lib/presentation/component/task-row-shell.svelte` — the done vocabulary
  being reused verbatim: `class:opacity-60={completed}` on the row's content and
  `completed ? 'text-ty-silent line-through' : 'text-ty-primary'` on the title.
- `src/lib/presentation/component/task-item.svelte` — its `lead` snippet,
  `{#if runOrder !== undefined && !completed}`. That is the rule the strip is
  being brought into line with.
- `src/lib/presentation/AGENTS.md` — two sections to update in this change:
  "Ordering rows by `#N` is what rescoped `#N`" (the gap-means-done rule now
  holds in the strip as well, not only the ledger) and "The day's strip reads
  inside the Tasks card, and carries no clock" (the done reading, and that the
  block is a `DayBlock` field rather than a prop). This is a public shape change
  on `DayBlock`, which is where this repo prices its interfaces.
- `src/lib/presentation/style/STYLE.md` — check the dim before writing it. The
  block's surface is `bg-surface-inset` with a border, not a series fill, so the
  "a series fill under a label is opaque" rule that forbade dimming on
  `/energy`'s bar does not reach here; confirm that reading holds.
- `src/lib/presentation/component/day-timeline.stories.svelte` — the `blocks`
  fixture and `crowdedDay`, both of which gain the new field, and the
  `getByText(title).parentElement` idiom the plays are written in. Its note that
  the idiom "only holds while the title is a text node of its own" is the
  constraint on how `#N` is dropped.
- `src/lib/presentation/utils/band.ts` — `BAND_BAR_CLASS` and `bandLabel`; a
  view model carries a `Band`, never a class string.
- `e2e/tasks.e2e.ts` — the existing `Mark Write report complete` check/uncheck
  flow to extend, and `e2e/helpers.ts`'s `AUTOSAVE_MS`. Note the sibling e2e's
  finding that `opacity` does not inherit, so an assertion lands on the element
  carrying the class.
- `messages/en.json` around `day_timeline_*` — one new key, `day_timeline_done`,
  and the same key in `de.json`, `es.json`, `fr.json`, `zh.json`.
- `docs/testing.md` — the level table: a view-model change is a `*.test.ts`, a
  component change is a story `play`, the user flow is `e2e`.

No MATH.md section changes.

## Decisions

- **The block is marked in place; the plan does not move.** Rejected: dropping a
  done block and leaving its space empty, because the legend already says the
  gaps are the switch cost, and a hole that is not one makes both readings
  unreliable. Also rejected: dropping it and reflowing the rest, because then
  ticking a box changes every remaining block's width while the plan those
  widths are computed from is unchanged — the strip would stop being a picture of
  the day the metric rows read.
- **`isCompleted` is a field on `DayBlock`, not a `completedTaskIds` prop.** The
  sibling `/energy` change put completion on the component precisely because
  `EvaluatedBlock` is a model type the optimizer owns. `DayBlock` is the
  opposite: a presentation view model whose stated job is holding the geometry a
  test can assert instead of a pile of `$derived` in the markup (R2), and its
  input `SuggestedTask` already carries `completed`. A prop here would move
  policy back into the component and cost a `.includes` in the `{#each}`.
  Rejected: matching `/energy`'s prop for symmetry's sake — the two types have
  different owners, and that is the whole reason the decision differs.
- **The dim is the ledger's, not a new one** — `opacity-60` on the block,
  `text-ty-silent line-through` on the title line. One vocabulary for "finished"
  in the Tasks card, where the strip and the ledger sit inches apart. Rejected: a
  `✓` prefix, which `/energy`'s bar carries only because an opaque series fill
  leaves it nothing else to change; the strip's block can dim, and the ledger
  row it sits above prints no `✓`.
- **A done block drops its `#N`.** `task-item` renders no badge on a completed
  task so the visible numbers carry gaps, and a gap means "done" — a settled
  reading the strip was quietly contradicting by printing `#2` beside a title
  the ledger had already stopped numbering. The block keeps its `position` in
  the view model; only the render drops it, so nothing downstream loses the
  ordering.
- **A done block keeps its flow sentence and its band fill.** They are readings
  of the plan, and the plan did not change when the box was ticked — the same
  reason `/energy`'s done row keeps printing its output figure. Rejected:
  dropping the sentence, which is the one line in the block carrying a duration
  the block did not compute itself, and is already the first thing a narrow
  block trades away.
- **`day_timeline_done`, not `/energy`'s `energy_block_done`.** Message keys in
  this repo are screen-scoped (`day_timeline_*`, `energy_*`), a bare word is not
  a mapping or a format, and the two strings are free to diverge per locale.
  This is not the R3 mirror it looks like.
- **An all-done day still draws the strip, unlike `/energy`.** The gate counts
  `daily.suggestedTasks`, completed included, so a fully-marked strip is
  reachable here where `/energy` replaces the whole card with `energy_all_done`.
  That is the point of the change rather than a case to suppress: an all-struck
  strip is the day read as finished. Pinned by a scenario so nobody "fixes" it
  into the `/energy` behaviour later.
- **Three scenarios are marked `(pin)`.** They pin behaviour that is already
  true — the flag on the input, the open block's `#N`, the all-done gate — so
  they go green on their first run. That is their pass condition, not an R6
  failure.

## Open questions

None.
