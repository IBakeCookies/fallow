# The row that became a table

**Status:** landed 2026-08-21 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Every reading a task row prints gets its own headed column, so the numbers line
up down the page and can be compared between tasks. `/` and `/energy` both read
as one `<table>` off the same `TaskRowShell`, and the hover-revealed action
strip — which reserved 114px on every row to show nothing — is replaced by a
narrow always-visible ✎/✕ column.

Drawn 2026-08-21 as [docs/redesign/Main.dc.html](../redesign/Main.dc.html); the
artboards' day timeline is **not** in this change (see Out of scope).

## Scenarios

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

One observable per line, no `and` — a line with a conjunction cannot come back
half-true. Every scenario names the file its test lands in, at the level
`docs/testing.md`'s table picks.

### Scenario — `/`'s ledger prints one headed column per reading

`src/lib/presentation/component/task-list.stories.svelte`

- **Given** a viewed day whose plan funds five tasks
- **When** the list renders
- **Then** the rows sit in one `<table>`
- **Then** its header row reads `#`, `Task`, `Phys`, `Ment`, `Enjoy`, `Effort`,
  `Hours`, `Prio`, `Flow @`, `Stop by`, `Logged` in that order
- **Then** each column header is a `<th>` with `scope="col"`
- **Then** the trailing action column's `<th>` is empty

### Scenario — a task's readings each land in their own cell

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a task with physical 0, mental 8, enjoyment 9, true effort 4.1,
  1.75 h allocated, priority 25.3, ϕ 2.23 h and T\* 3.92 h
- **When** the row renders
- **Then** the `Phys` cell reads `0`
- **Then** the `Ment` cell reads `8`
- **Then** the `Enjoy` cell reads `9`
- **Then** the `Effort` cell reads `4.1`
- **Then** the `Prio` cell reads `25.3`
- **Then** every numeric cell is right-aligned

### Scenario — the ⚡ badge and every 🪫 chip read in the `Logged` cell

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a task with a 95-minute ⚡ reading and two 🪫 ratings for the day
- **When** the row renders
- **Then** the `Logged` cell holds the `⚡ 95m` button
- **Then** the same cell holds two 🪫 chips
- **Then** the same cell holds the 🪫 append trigger
- **Then** no pointer is over the row for any of the three to be readable

### Scenario — a task with no readings still offers both instruments

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a task with no ⚡ reading and no 🪫 rating
- **When** the row renders
- **Then** the `Logged` cell holds the ⚡ trigger
- **Then** the `Logged` cell holds the 🪫 trigger

### Scenario — ✎ and ✕ are reachable without hovering the row

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a task row with `onupdate` and `onremove` supplied
- **When** the row renders with no pointer over it
- **Then** the ✎ button's computed `opacity` is `1`
- **Then** the ✕ button's computed `opacity` is `1`

### Scenario — ticking a task done opens both measurement forms in one spanning row

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a task with no ⚡ reading and no 🪫 rating, on today
- **When** the completion checkbox is ticked
- **Then** the flow form appears
- **Then** the drain form appears
- **Then** both sit inside a single `<tr>` beneath the task's own row
- **Then** that `<tr>`'s one cell spans every column of the table

### Scenario — ✎'s editor stacks under the two measurement forms, in the same spanning row

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a row whose flow form and drain form are both open
- **When** ✎ is clicked
- **Then** the edit form appears in the same spanning `<tr>`
- **Then** the table still has exactly one `<tr>` of task cells for that task

### Scenario — the plan's two groups read as two headed row-groups

`src/lib/presentation/component/task-list.stories.svelte`

- **Given** a plan that funds two tasks and leaves two with no hours
- **When** the list renders
- **Then** "Today's sequence" heads the first group
- **Then** "No time today" heads the second group
- **Then** each group heading is a `<th>` with `scope="rowgroup"`
- **Then** both groups sit in the same `<table>` under one header row

### Claim (pin) — a completed funded task keeps its `#N` slot

`src/lib/presentation/component/task-list.stories.svelte`

Phrased through today's surface so it runs against the old code first
(MATH.md §11.8's 2026-08-18 rescope, and presentation/AGENTS.md "Ordering rows
by `#N` is what rescoped `#N`").

- **Given** a plan funding three tasks, the second of them completed
- **Then** the rows read in the order `#1`, the completed task, `#3`
- **Then** the completed task renders no `#N` badge

### Scenario — the ledger scrolls sideways inside its card, and the page does not

`e2e/tasks.e2e.ts`

- **Given** a 390px-wide viewport with three funded tasks
- **When** the day loads
- **Then** the table's container has a horizontal scrollbar
- **Then** `document.documentElement.scrollWidth` equals its `clientWidth`

### Scenario — `/energy` reads the same grammar with its own columns

`src/lib/presentation/component/energy-task-row.stories.svelte`

- **Given** a scheduled task with true effort 4.1 and 2.5 h planned
- **When** the Lab's list renders
- **Then** the header row reads `Task`, `Phys`, `Ment`, `Enjoy`, `Effort`,
  `Logged`, `Planned`
- **Then** the leading cell holds the task's schedule hue
- **Then** the `Effort` cell reads `4.1`
- **Then** the `Planned` cell reads `2h 30m`

### Scenario — `/energy` prints "no hours" rather than a blank `Planned` cell

`src/lib/presentation/component/energy-task-row.stories.svelte`

- **Given** a scheduled task the optimizer funded 0 h
- **When** the row renders
- **Then** the `Planned` cell reads the `energy_no_hours` copy

### Claim (pin) — `Effort` reads the same number on both screens for one task

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

`EnergyLabStore.scheduledTasks` does not carry true effort today, so the Lab's
new column needs it. `E` is `mapEffort(getEffectiveDifficulty(task))` and
nothing else, which is what makes this a pin rather than new math.

- **Given** a task with physical 0, mental 8, enjoyment 9
- **Then** `scheduledTasks[0].trueEffort` equals `mapEffort` of that task's
  effective difficulty
- **Then** it equals the `trueEffort` `calculateSuggestedTasks` reports for the
  same task

### Scenario — the empty list still reads as empty, not as a table of nothing

`src/lib/presentation/component/task-list-card.stories.svelte`

- **Given** a day with no tasks
- **When** the card renders
- **Then** no `<table>` is in the document
- **Then** the empty-state copy is shown

## Out of scope

What was considered and deliberately left out. This is the section that stops
the implementer helpfully building more than was asked (AGENTS.md §0).

- **The artboards' day timeline.** `09:00 → 17:15` is invented: Fallow
  allocates durations and has no day-start anchor, so the timeline needs a new
  setting and a decision about how it meets the circadian drain instrument
  (MATH.md §8.8). That is model work. Settled with the user 2026-08-21: the
  ledger lands alone.
- **The artboards' "binding constraint" panel** (promoting `plan-advice-card`'s
  reading) and **the four-column metrics grid** (replacing the accordion). Both
  are on the same artboards; neither is this change.
- **Sorting, filtering, column resize or column hiding by the user.** The run
  order is the plan's, not a view preference — `calculateInterleavedOrder`
  computes it (AGENTS.md §4, "Run order stays `calculateInterleavedOrder`'s
  nature alternation"). A `<table>` is markup here, not a data grid.
- **`Prio`, `Flow @` and `Stop by` on `/energy`.** The Lab is a peer model
  (AGENTS.md §4) and does not compute them; blank cells would assert a missing
  reading.
- **Renaming or restyling the forms the spanning row carries.** `FlowLogForm`,
  `DrainLogForm` and `TaskEditForm` move into a `<td>` unchanged.
- **Instrument Sans / IBM Plex Mono.** The artboards' typefaces are a separate
  change; `tabular-nums` on the numeric cells is in this one, since column
  alignment is the point of it.

## Read before building

The routing — the exact files and sections, not the areas. This is what keeps
the implementer's context small: it reads these and nothing else.

- `src/lib/presentation/AGENTS.md` — four rules this change makes false, each
  corrected in the same commit per AGENTS.md §0:
  - **"The row's layout"** — the three-columns-from-`sm`, stacked-below rule and
    its `min-w-0`/`truncate` reasoning are replaced by the table's column set
    and its scroll container.
  - **"Every reading keeps its tooltip"** — `P · M · E`'s tooltip existed
    because "three bare letters are the one thing on that line that says
    nothing for itself". Headed columns say it, so state what the three cells
    keep and what they drop.
  - **"Each measurement is read, corrected and dropped on the row it belongs
    to"** — "⚡ … reads as a badge beside the `P · M · E` line" becomes the
    `Logged` cell, for both readings and both triggers. The one-click rule
    itself does not change.
  - **"R3 in the UI — the two task screens are one definition"** — record that
    the shell is now a `<tbody>` and that `columnCount` joined
    `withMustDoToday` as a non-mode-flag prop, with the reason.
- `src/lib/presentation/component/task-row-shell.svelte` — the shell.
  `onCompletionChange` (line 100) is the two-editor policy that forces the
  spanning row; `actionsPinned` (line 132) and the `hover-reveal` call site
  (line 247) both die with the strip.
- `src/lib/presentation/style/tokens.css` — `@utility hover-reveal`. Line 247
  above is its **only** caller, so the utility is deleted with it.
- `src/lib/presentation/utils/measurement-prompt.ts` line 2 — its header
  comment cites the hover-revealed strip as the reason the editors open where
  they do. The reason survives; the wording does not.
- `src/lib/presentation/component/task-item.svelte` — `/`'s three snippets
  become cells. The `lead` snippet's four badges (`#N`, nature, must-do, slide)
  do not all fit a 34px `#` column; see Decisions.
- `src/lib/presentation/component/energy-task-row.svelte` — the Lab's two
  snippets, and the `withMustDoToday={false}` carve-out that stays.
- `src/lib/presentation/component/task-list.svelte` and
  `task-list-card.svelte` — the card owns the `<ul>`/`divide-y` and the
  two-group `split`; both become `<table>` / `<tbody>`. The card is shared, so
  `rows: Snippet | null` keeps meaning what it means (an empty `<table>` is the
  same mistake as an empty `<ul>`).
- `src/routes/(app)/+page.svelte` — the `min-w-0` comment on the task column.
  `min-w-0` **stays**, for a new reason: it is what lets the scroll container be
  narrower than the table. Its stated reason (the title's `truncate`) is what
  changes.
- `src/routes/(app)/energy/+page.svelte` lines 229-256 — the Lab's `<li>`
  wrapper and row props; `colors.colorOf(task.id)` is the hue the leading cell
  reads.
- `src/lib/business/store/energy-lab-store.svelte.ts` — `#scheduledTasks`
  (line 339) is where `trueEffort` joins the Lab's rows. Adding it to a public
  getter's shape is an interface change, so record it in
  `src/lib/business/AGENTS.md`.
- `src/lib/business/model/zenith.ts` — `mapEffort` (line 146) and
  `calculateTaskParams` (line 562); `getEffectiveDifficulty` and `toEnergyTask`
  in `src/lib/business/model/metric/calculation.ts` (line 112).
- MATH.md §1 (lines 156-185) — `E = (4/9)·Eᵤ + 5/9`, the quantity the new
  `Effort` column prints. **No MATH.md change**: the column prints an existing
  formula on a second screen.
- `src/lib/presentation/style/STYLE.md` — where the two new `@utility` rules go
  and why they are utilities rather than a wrapper component.
- `docs/testing.md` line 26's table (test levels) and the browser-test gotchas;
  the row stories currently render the component bare, which a `<tr>` cannot
  be. See Decisions.
- `docs/redesign/README.md` — its "Two things to settle before implementing"
  section is answered by this spec, and its claim that the table has no
  completion cell and no ⚡/🪫 affordance stops being true. Correct it in the
  landing commit.

## Decisions

Each one: what was decided, why, and what was rejected. The rejected half is
the part git cannot reconstruct.

- **Both screens go tabular; the shell stays one definition.** `TaskRowShell`
  renders a `<tbody>` holding the task's `<tr>` and, when a draft is open, one
  spanning `<tr>`. Rejected: a `<tr>` component for `/` only, leaving the Lab
  on the flex shell — it duplicates `onCompletionChange`'s two-prompt policy
  and mounts the three editor forms in two places, which is exactly what R3
  consolidated. Also rejected: a mode flag on the shell, which
  presentation/AGENTS.md bans outright.

- **The shell takes `columnCount: number` for the spanning row's `colspan`.**
  One integer, and each caller knows its own column list. It is not a mode flag
  — it switches no behaviour. Rejected: `colspan="99"` with no prop, because an
  oversized `colspan` establishes 99 columns in the HTML table model rather
  than being clamped to the row's width, so the header's own widths are then
  computed against columns nothing fills. Also rejected: `colspan="0"` (HTML4's
  "to the end of the group", dropped in HTML5 — browsers read it as 1).

- **⚡ and 🪫 read in one `Logged` cell, both readings and both triggers.**
  🪫 is one rating per session (MATH.md §8.7), so its chip count is unbounded
  and only a flexible cell holds it; putting the triggers in the same cell is
  what keeps the one-click rule intact, since a control has to sit beside the
  reading whose editor it owns. Rejected: the README's own proposal (⚡ inside
  `Flow @`, 🪫 inside `Hours`), because an unbounded chip list in an 88px
  fixed-width column re-breaks the alignment the table exists for. Also
  rejected: a sub-line inside the `Task` cell, which reads less tabular and
  makes row height vary with session count.

- **✎ and ✕ get a narrow always-visible trailing column; `hover-reveal` is
  deleted.** That is the redesign's first claim — 114px reserved permanently to
  show nothing — and it only comes true if the replacement is narrower. The
  utility has exactly one caller, so it goes with it. Rejected: a single ⋯
  menu, which is 32px but costs two clicks per action and drops the at-rest
  colour cue that says whether a reading exists. Also rejected: keeping the
  strip hover-revealed inside a cell, which changes nothing and delivers none
  of the win.

- **Below `sm` the table scrolls sideways inside its card.** One markup tree at
  every width. `min-w-0` on `/`'s task column is what permits it, so the fix
  that stopped the page scrolling sideways is what now stops it again — the
  container scrolls, the document does not, which is the pinned observable.
  Rejected: `display:block` on `tr`/`td` below `sm` with `::before` labels,
  which duplicates every `<th>`'s text in CSS content. Also rejected: hiding
  five columns below `sm`, which makes readings unreachable on a phone.

- **`/energy`'s columns: hue, `Task`, `Phys`, `Ment`, `Enjoy`, `Effort`,
  `Logged`, `Planned`.** The hue dot takes the narrow leading cell `#N` takes on
  `/`, so both screens share the column grammar. `Effort` is the one reading
  added: it is `mapEffort` of the effective difficulty and needs no plan solve,
  and with `Phys`/`Ment`/`Enjoy` now headed it is the number that says what the
  three of them come to. Rejected: giving the Lab all of `/`'s columns with
  blanks, because an empty `Prio` cell asserts a reading the peer model never
  computes.

- **`Effort` arrives from the store, not computed in the row.** R2 keeps model
  values out of components, so `scheduledTasks` carries `trueEffort` the way
  `SuggestedTask` already does. Rejected: calling `mapEffort` in
  `energy-task-row.svelte`.

- **The `Task` cell carries the title and all four badges.** `#N` is the `#`
  column; nature, must-do and slide stay with the title, which is the one
  flexible-width column. Rejected: a column per badge — three mostly-empty
  columns on a table already 12 wide.

- **The re-plan stays two lines in the `Hours` cell.** MATH.md §35's rule is
  re-plan leading, plan beneath, never a strikethrough; a cell holds a
  two-line stack unchanged. Rejected: a separate `Re-plan` column, which would
  be empty every morning.

- **`Flow @` ships as `Flow at`.** Paraglide inlines a no-input message's value
  into a JSDoc table (`| "Flow @" |`), and `@"` there is an unterminated JSDoc
  tag, so `npm run check` fails on generated code with `Identifier expected`.
  A trailing space does not help — the value is trimmed before it is inlined.
  Rejected: excluding `src/lib/paraglide/messages` from `tsconfig.json`, which
  buys one label with a permanent hole in what is type-checked.

- **The ledger takes `/`'s full width and the metrics read beneath it.** Settled
  with the user 2026-08-21, while building: twelve columns have nowhere to go in
  two thirds of a page. The `lg:grid-cols-3` split and the metrics column's
  `lg:sticky` are gone, and `min-w-0` on the task column goes with them — it was
  a grid item's automatic minimum that needed overriding, and a block in normal
  flow has none. `e2e/tasks.e2e.ts`'s two width tests are what proved it inert
  rather than load-bearing.

- **Row stories wrap the component in `<table><tbody>` via a `template`
  snippet.** A `<tr>`-rooted component rendered bare has no table to be a row
  of, so its cells lay out as inline boxes and every visual or axe assertion
  reads the wrong DOM. `task-item.stories.svelte` and
  `energy-task-row.stories.svelte` both need it, across their existing `play`
  stories.

## Open questions

None.
