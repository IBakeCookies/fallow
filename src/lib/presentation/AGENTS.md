# Presentation layer — rules

UI only (this directory and `src/routes`). **Never** imports `$lib/data/*`.
Persisted types come from `$lib/business/type` — the one place; never re-export
an entity type from a model as a convenience (`Task` was reachable from
`metric/calculation.ts` too, and a route used that path). Read with the root
[AGENTS.md](../../../AGENTS.md).

All styling rules live in [STYLE.md](style/STYLE.md): tokens-only classes, the
`dark:` ban, the three colour roles and the ink contrast budget, the two hover
families, backdrop-blur, sonner's four registry deviations, the Tailwind
scanner gotchas, the CSS namespace split, the adding-a-theme checklist. **Read
it before touching markup, classes, or anything under `style/`.**

**Imports**: the order is [AGENTS.md](../../../AGENTS.md) §2's, not restated here.

## R2 — Routes and components hold no logic

Direction is cheap to enforce and placement is not: a route importing business
code is legal, so logic drifts into `+page.svelte` where nothing can unit-test
it. Happened twice (a 518-line main page, a 1349-line Energy Lab); both had to
be pulled back out.

The commonest form of that drift is now an error rather than a judgement call:
an `await` or a `.then()` inside a `$effect` in `src/routes/**` or
`presentation/**` fails `no-restricted-syntax`, because a file that sequences
reads and holds their results is orchestrating. Read in a store and take the
value. What the selector cannot see is a synchronous pile — a page of
`$derived` chains computing policy is still legal and still wrong, which is
what the rule of thumb below is for. The tree carries no `eslint-disable` for
it: `calendar/+page.svelte` was the one hit, and its read went to
`CalendarStore`.

Reads end at a store: `presentation-not-to-business-model` in
`.dependency-cruiser.cjs` is an **error** when a route or component
value-imports `$lib/business/model/*` (stores, state, `utils`, and
`import type` are fine). Not a judgement call: put the orchestration in a store
and give the page the result.

A `+page.svelte` may contain: markup, local UI-only state (draft editors,
open/closed toggles, view preferences), formatters, and thin `$derived` aliases
of a store. Anything else — model orchestration, fits, persistence, threshold
policy — goes in a module:

| Kind of code                        | Where it goes                                        |
| ----------------------------------- | ---------------------------------------------------- |
| Pure math                           | `business/model/*.ts`                                |
| Composed model results for a screen | `business/model/metric/daily-metrics.ts` (or a peer) |
| Reactive state + persistence        | `business/store/*.svelte.ts`                         |
| Labels, thresholds, colors, i18n    | `presentation/utils/*.ts`, `presentation/component/` |

Rule of thumb: if you cannot test it at **any** level in R6's table, it is in
the wrong file. Not "has no `.test.ts`" — a component is tested by a story
`play` and a store by a `.svelte.spec.ts`, and both are in the right place.
Untestable at every level is the signal.

## Components

- Components take snippets/props from the layout; they do not reach into stores
  themselves.
- **A shell renders tooltips but never owns the `Tooltip.Provider`.** The
  callers' `lead` / `badges` / `meta` / `trailing` snippets are full of them
  too, so the provider sits above the shell, in the page (`/energy` sets one for
  its whole region). A component that owns every tooltip it renders —
  `calibration-card`, `drain-log-form` — does carry its own: one that cannot
  mount without an ancestor's costs every caller a wrapper, and nesting is
  harmless, since the inner provider wins at the same delay.
- **The add-task form lives in a dialog the CARD owns, and no page decides when a
  form is on screen.** `task-list-card.svelte` holds the `Dialog.Root`, both triggers
  — the `+` BESIDE the `<h3>` and never inside it, since a button in the heading joins
  its accessible name and the card would stop being "Tasks", plus the empty state's own
  button, because a 24px glyph in the corner is not the call to action an empty day
  is — and renders the caller's `form` snippet inside `Dialog.Content`. Three things fall out and none of them may
  come back: the form has no open/closed state and no collapse control; neither page
  reads the day to decide whether to open it, so the `{#key session.loadedDate}` that
  used to wrap it is gone (the constraints bar still needs its own — that one asks a
  question about the day, this one only needed a fresh draft, and Content already
  remounts on every open); and the ledger keeps the height the form used to take.
  **Deploying does NOT close the dialog** — a day gets typed in one sitting — so the
  form puts the caret back in the title field itself, which is the one focus move
  `{@attach}` cannot make, since that field never unmounts between deploys.
- **A combobox inside a dialog must `stopPropagation()` on the Escape that closes its
  own list.** bits-ui's escape layer listens on `document`, so an unstopped Escape
  closes the whole form while the user was only dismissing the suggestions. Stop it in
  the list-open branch ONLY: the Escape that arrives with no list open is the one that
  is supposed to close the dialog. Same family as the `DropdownMenu` key-ownership
  rule below, opposite conclusion, because there the document listener was the wanted
  behaviour.
- **An inline editor focuses with `{@attach (node) => node.focus()}`, never
  `autofocus`.** The attribute is inert on any node inserted after load (the
  document's autofocus-processed flag), so all three editors that used it — ⚡,
  🪫, ☕ — silently never focused. The attachment also makes the choice
  conditional, which matters where an editor opens itself: completing a task
  asks for both measurements (`task-row-shell.svelte` reports the two prompts,
  the page opens them) and a draft opened by the prompt leaves `focusMinutes`
  false, so ticking tasks off with the keyboard cannot yank the caret into a
  number field.
- **A `DropdownMenu.Item` never contains a focusable child, and an input inside
  menu content stops the keys it needs.** Two separate bits-ui facts, both of
  which shipped as mouse-only UI in `day-actions.svelte`'s routine rows. First:
  the menu's Tab handler `preventDefault`s and moves focus past the whole menu,
  so a `<button>` nested in an item is unreachable, and Enter on the item
  dispatches the click at the _item_ — an item with no `onclick` silently does
  nothing. A row of two actions is therefore two sibling items inside a
  `DropdownMenu.Group` (`role="group"` keeps the menu → menuitem ownership
  valid), not one item with buttons in it. Second: the content's keydown handler
  claims arrows/Home/End for roving focus and every single character for
  typeahead **regardless of the event's target**, so an `<input>` in a menu must
  `stopPropagation()` on the keys it owns — but never on Escape, whose listener
  sits on `document`, nor on the arrow that is the only way out of the field
  (menu content hands focus to its first tabbable on open, which is that input).
- **`task-form.svelte`'s title combobox is the ARIA 1.2 pattern hand-rolled
  inline, not `bits-ui`'s combobox.** Three of that bit's habits fight a form:
  `Combobox.Input` double-owns `value` (R3 — the bit's own state and the draft
  are two answers to what the field holds), its `onkeydown` `preventDefault`s
  Enter and so takes the form's only keyboard submit, and its `oninput` never
  opens the menu, which is the whole of suggesting as the user types. What the
  hand-rolled one owes back is the highlight, which is three rules: an arrow key
  reopens a closed list (Enter and everything else must reach the form),
  Escape, a pick and a blur drop the highlight — a stale
  `aria-activedescendant` otherwise names an id that has unmounted — and an
  `$effect` on `active` scrolls the highlighted row into view, since a reopened
  list highlights an `<li>` that does not exist until the DOM is patched.
- **Emptying the title field resets the three sliders to 5/5/5 only when a pick
  put the numbers there.** `fromPick` in the same form: clearing the title and
  typing an unrelated task would otherwise deploy it under a rating nobody
  gave it, while sliders the user dragged are theirs and stay. Editing short of
  empty keeps the pick, and the flag clears on submit — left set, the next
  title being cleared would reset sliders no pick had touched.
- **A card whose reading costs a solve renders with a prompt line where the
  reading will go** — `plan-advice-card` and `budget-curve-card`: the heading,
  the description and the card's own run button from the first paint, and one
  line saying the reading has not been taken. That line is what stops the shell
  claiming a reading nobody has computed; a skeleton would claim its shape
  instead. One control, in one place, discoverable before the first click.
- **The same card, once stale, keeps its numbers and withdraws its levers.**
  Both cards above: the reading stays on screen (it is a warning about the
  numbers, not a reason to hide them), and every Apply button gates on
  `isBusy || isStale` — each option is priced as the ONE next move on the day
  that was solved, so on any other day they are wrong together,
  and a run in flight is about to replace the one being held. Only the recheck
  button stays live: it is the way out. The stale banner is also the only
  statement of WHY, since a disabled button is not focusable.
  **The one reading that is withdrawn instead of kept shows the rule's scope:**
  the destination line (ROADMAP item 21) is about ANOTHER day, so a session write
  refutes it rather than merely dating it — it carries its own key off
  `SessionStore.writeGenerationFor` and the card simply drops the line. What stays
  through staleness is the numbers priced on the day that was solved.
- **A seeded editor copies its seed at mount** — `flow-log-form`,
  `drain-log-form`, `rest-log-form`, `task-edit-form` all read `seed` (and
  `focusMinutes`) once and never again, so **every re-opening must be a fresh
  mount**, never a re-seed of a live one, which would leave the old numbers in
  the fields. The caller owns that, and two mechanisms give it:
  `task-row-shell.svelte` wraps each measurement editor in a `{#key}` on the
  page-owned draft, and `log-history-list.svelte`'s
  `{#if editingKey === row.key}` sits inside a keyed `{#each}`, so a row's
  editor cannot outlive the row. The forms carry no runtime guard;
  `e2e/energy-lab.e2e.ts` ("the ✎ re-seeds a drain editor the row already has
  open") is what holds the drain half.
- Storybook stories live **beside their component** (`*.stories.svelte`), one
  file per component or primitive group, rendered as smoke tests by the
  `storybook` vitest project — see [docs/testing.md](../../../docs/testing.md)
  for what runs them and the a11y gate.

## R3 in the UI — the two task screens are one definition

`/` and `/energy` render the same day's list, and everything they were free to
disagree about had drifted: the card around the list, where the add-task form
sat, the rule between rows, and the ✎ editor, which only `/` had, so the Lab
could not rename a task at all. The page ORDER is not part of that agreement,
and deliberately: on `/` the list is where the day gets typed, so it leads; on
the Lab it is a read-out you annotate and the plan is the screen's answer, so the
plan leads full width and the ledger heads the wide column under it. What both
screens do hold is that the ledger and the parameters that move it are adjacent —
the Lab buys that by stacking them in one column, not by ordering the page.
Five components hold what the two screens say the same way:

- **`task-list-card.svelte`** — the card, the heading, `strip` between the heading
  and the ledger (`/` puts its day strip there, the Lab the ☕ editor), the ADD-TASK
  DIALOG the `form` snippet is mounted in and both ways into it, the empty state, the
  `<table>` and its scroll container, and the header
  row it builds from the caller's column list (so neither screen decides how its
  own rows are separated: the rule is `ledger-cell`'s bottom border). `split` is
  how a caller reads its rows as two headed groups instead of one — `/`
  passes it, the Lab never does. `heading` is the caller's own half of the card's
  heading row: both screens put the day's Load/Save there — `/` through
  `task-list`'s `actions` snippet, the Lab straight into `heading` — and `/` its
  "Next" line too.
- **`task-row-shell.svelte`** — the row's `<tbody>` and hover surface, the
  completion checkbox, the title, the three input cells, the `Logged` cell (⚡ and
  🪫, both readings and both triggers), the ✎/✕ cell, and every editor it opens
  in the spanning row, including the completion prompt that opens both
  measurements at once. Each screen adds only its readings, as `<td>`s through
  `lead` / `badges` / `meta` / `trailing`. **An action is present when its
  callback is**, so a read-only row passes no ✎ or ✕ and a past day none of the
  **logging** ones — the cell is still drawn either way, or the row loses a
  column.
- **`measurement-form-actions.svelte`** — the ✓/✕/🗑 that closes ⚡, 🪫 and ☕. It
  exists because those three editors were written separately and drifted into
  two different button sizes, one with a hover surface and one without; the
  instrument's hue on ✓ is the only real difference and is a prop. 🗑 is the
  caller's copy and absent unless it passes one, because what is being dropped
  differs per editor and a first measurement has nothing to drop.
- **`task-edit-form.svelte`** — the editor, on both screens.
- **`task-form-fields.svelte`** — what both task forms set about the task
  itself: the three model input sliders, one loop over one table so their
  labels, minimums and accents are defined once, and `task-importance-select`
  under them. `TaskEdit` — the six fields a form can set — is this component's
  type, since adding a task and re-tuning one emit the same thing. Importance
  belongs here and `mustDoToday` does not, for the reason the model file gives:
  the level is a property of the task, the flag is a statement about today. Each
  form still owns its own action row, because each is a stack whose footer is
  its own — they happen to agree on the shape (flag pushed out by `mr-auto`,
  submit in the corner) and not on the copy.
- **`must-do-toggle.svelte`** — the flag itself, a `<label>` carrying
  `buttonVariants` over a transparent full-size `<input type="checkbox">`. It
  reads as a button with a set state (`secondary`) and an unset one (`outline`),
  and stays a real checkbox, which is what keeps its role, its space key and
  `.check()` in a test. STYLE.md names it and `task-importance-select.svelte`
  as the two carve-outs from `appearance-auto accent-brand`. The forms
  are otherwise not each other: `task-form.svelte` is a title combobox over
  rated history with a pick-reset, `task-edit-form.svelte` is a plain
  title input, which is ~150 lines of script the editor has no counterpart for.
  **The editor offers no suggestions on purpose** — a pick rewrites the three
  ratings, and renaming a task the user has already rated must not; only the
  add form reads title memory.
  Do not push the title or the frame in here to make them look like one
  component; the callers keep both, so each frame and each field is defined
  once, whole, and the caller's own spacing is what sets the form's density.

What is left in `task-item.svelte` and `energy-task-row.svelte` is one screen's
reading of the task and nothing else: priority, allocation, run order and T* on
`/`, the schedule's hue, effort and hours in the Lab — four snippets and the
prop mapping around them. That is two readings of one task, not one thing
duplicated — and it is the only reason there are two components. If the
readings ever converge, merge the two callers; do not give the shell a mode
flag.

**The shell is a `<tbody>`**, holding the task's `<tr>` and — while any of the
three editors is open — ONE spanning `<tr>` beneath it. That is what makes a row
group per task the unit: the two measurement editors and ✎'s stack together
under the row they belong to, and a `<tbody>` is the only element that can own
both without leaving the table. Each caller's own cells arrive as `<td>`s
through `lead` (the narrow leading column), `badges` (beside the title), `meta`
(before `Logged`) and `trailing` (after it).

**Two props are the carve-outs, and neither is a mode flag.**
`withMustDoToday` says whether the ✎ editor offers one field, and the Lab passes
`false` for the reason under "The Lab's row reads the three model inputs" below.
`columnCount` is the spanning row's `colspan` — one integer, and each caller
knows its own column list (`utils/ledger-column.ts`); it switches no behaviour.
An oversized `colspan` is not the shortcut it looks like: 99 ESTABLISHES 99
columns in the HTML table model rather than clamping to the row's width, so the
header's own widths are then computed against columns nothing fills, and HTML5
dropped `colspan="0"`. Everything else that differs between the screens arrives
as a snippet. A third prop of this shape is the signal that the readings have
converged and the two callers should merge, not licence for a fourth.

### The row's layout

**Every reading gets a headed column, and the row is one `<tr>` of them.** One
markup tree at every width: when the ledger is wider than its column it scrolls
sideways inside its own `overflow-x-auto` container and the DOCUMENT does not —
`e2e/tasks.e2e.ts` pins both halves, because a table that overflows is only
correct while the container is the thing that scrolls. The ledger also takes each
screen's full width and the readings sit beneath it — `/`'s metrics, the Lab's
plan: twelve columns have nowhere to go in two thirds of a page. The column list
is `utils/ledger-column.ts`, one function per
screen, and it is the ONE definition of how wide the table is: the card heads it
and the shell spans it. The hours the optimizer planned are `Planned`, the LAST
column, on BOTH screens — one word and one place for one reading, so the two
ledgers read the same way (`trailing`, not `meta`). Numeric cells are `ledger-numeric` — right-aligned and
`tabular-nums`, because a column nobody can compare down is not worth a column.

**A phone shows five of the columns, not all twelve.** `ledger-wide` drops
`Phys`, `Ment`, `Enjoy` and every derived reading below `sm`, leaving the lead,
`Task`, `Logged`, `Planned` and the ✎/✕ strip — the plan's answer and the two
instruments, which is what fits without the ledger scrolling sideways at all.
The flag lives on the column (`isWideOnly`) so the card heads it, and the SAME
utility goes on the matching `<td>` — the shell's three rating cells and each
screen's own `meta` snippet — or the header stops lining up with its cells.
The dropped readings are not lost: `sm` is where they come back.

**Three header cells show no text and are named anyway** — the ✎/✕ strip on both
screens and the Lab's hue lead. The column carries its label with
`isLabelHidden`, the card renders that one `sr-only`, and nothing is asked to
switch axe's `empty-table-header` off: a `<th>` with no accessible name
announces an anonymous column, which is a reading lost, not a design decision.

**A completed task renders its `Planned` and `Prio` cells EMPTY rather than
dropping them.** A row short of a cell is a row whose columns no longer line up
with the header's, so the `{#if !completed}` goes inside the `<td>`, never
around it.

**A day with every task ticked renders its plan, struck through, on BOTH
screens.** The plan is a reading of what the day was for, not a queue that
empties as it is worked, so nothing replaces it: `/energy` had a card saying the
planner needed an open task and no longer does, and `/`'s day strip drew a
finished block as work ahead and no longer does
([the-planner-that-said-it-needed-an-open-task.md](../../../docs/features/the-planner-that-said-it-needed-an-open-task.md);
[the-strip-that-read-as-all-ahead.md](../../../docs/features/the-strip-that-read-as-all-ahead.md)).
Which mark each screen uses is "the bar marks, the list dims", below.

✎ and ✕ carry an `aria-label` and no tooltip: a pencil and a cross are the two
icons nobody needs told. They sit in a narrow always-visible trailing column —
the strip they replaced was hover-revealed and reserved 114px on every row to
show nothing, which is the whole reason the row became a table
([docs/features/the-row-that-became-a-table.md](../../../docs/features/the-row-that-became-a-table.md)).
A story `play` pins that they read at rest and that neither is a tooltip's
trigger, the second on `data-slot` rather than by hovering and waiting for
nothing: a tooltip that never opens and one that opens after a delay look alike.

**Every reading keeps its tooltip except the three input cells.** `P · M · E`
had one because three bare letters said nothing for themselves; `Phys`, `Ment`
and `Enjoy` at the head of their own columns do say it, so the cells read as
bare numbers and the tooltip is gone. Everything the MODEL derived keeps its
own — no column word can say what ϕ is — and it triggers on its own reading.
Alignment is the `<td>`'s (`ledger-numeric`), not the trigger's; the one trigger
that repeats `text-right` is the `Planned` cell's, whose two stacked lines are
block-level buttons and would otherwise centre themselves (a `Tooltip.Trigger`
is a `<button>`, whose UA `text-align` is `center`).

### `/` reads the day as the two groups the plan makes

Settled 2026-08-17. Each heading is a spanning `<th>` with **no `scope`**: a task
row is its own `<tbody>`, so `scope="rowgroup"` heads the row group the heading
sits in — which holds nothing — while the implicit scope makes a header row of
one spanning cell head the cells beneath it, down to the next such row.

Funded rows sit under "Today's sequence" in their `#N` order, the tasks the plan
gave nothing under "No time today" in the priority order they arrive in, having
no position at all. What made the single list read as a
contradiction was not its order: a low-priority task collecting the last block is
normal (the objective is Σ P̄ and a cheap task's average peaks almost at once —
MATH.md §3), and with the two states unlabelled that looked like the plan funding
the wrong task. The split appears only when both groups have a row — a heading
over the only group there is says nothing about it.

**Ordering rows by `#N` is what rescoped `#N`.** The badge was interleaved over
ACTIVE tasks, so a sort on it sank a row to the foot of the group the moment it
was ticked — out from under the 🪫 editor that completing it had just opened.
Both properties (the sequence counting down the page, and a row that never moves
under the cursor) hold only if the order is completion-invariant, which is
the 2026-08-18 rescope: the map covers the funded PLAN, a completed task keeps
its slot, and `task-item` renders no badge on it — so the visible numbers can
carry gaps, and a gap means "done", not "moved". The strip's block prints its
position under the same rule and drops it the same way: it sits inches above the
ledger, so a `#2` beside a title the rows had already stopped numbering
contradicted the reading
([the-strip-that-read-as-all-ahead.md](../../../docs/features/the-strip-that-read-as-all-ahead.md)).

### Slide age is a `/` reading, computed above the row

`utils/slide-age.ts` — `getSlideDay(createdAt, viewedDate)` and
`CHRONIC_SLIDE_MIN_DAYS`. The gate is display policy, so R2 keeps it out of the
markup: `task-list.svelte` calls it once per row and `task-item` takes
`slideDay?: number | null`, the same shape as `runOrder`. Age is measured against
`viewedDate` — the day on screen, never the clock — so a browsed past day reads
what the badge said then, and a story `play` needs no fake time. It renders
through completion, unlike `#N`: the count is a fact about the task, not a
next-up reading. `/energy` does not carry it
([docs/features/chronic-slide-badge.md](../../../docs/features/chronic-slide-badge.md)).

### The mid-day re-plan reads beside the plan, not over it

Both readings stack in the one `Planned` cell, re-plan leading and plan beneath
— **never a strikethrough on the plan**, which the plan-family rows are still
computed from. The two sit on different bases: the re-plan is time to spend ON
TOP of the hours already worked, so neither line may be phrased as a comparison
("15m more"); each is labelled by the question it answers.

### The day's strip reads inside the Tasks card, and carries no clock

`utils/day-timeline.ts` builds
`{ totalHours, minimumBlockWidths, blocks }` from the funded plan,
`runOrder` and the switch cost; `component/day-timeline.svelte` draws it — no card
and no visible title of its own, since it renders through `task-list-card`'s `strip`
between the "Tasks" heading and the ledger it is a reading of. The name stays
`sr-only`: the strip's scroll region is focusable and nothing else says what the
blocks are.
The geometry is a tested util rather than `$derived` in the markup (R2), a block
carries a `Band`, and the gap between two blocks IS the switch cost — no number
restates it. Every width is a share of the TRACK, and so is the floor:
`minimumBlockWidths` is the day over its shortest allocation, so scaling the
track to that many minimum block widths lifts the narrowest block to legible
without moving any width off scale. What legible means is settled per block, not
per day: each block is its own container query, and under `--container-day-flow`
it sends the flow sentence to `sr-only` rather than truncate a duration into a
figure nothing computed. So the floor is the width of a block that has already
dropped it — its run position and its hours — and the flow bar is pinned with
`mt-auto`, or it would step up and down between the blocks that kept the
sentence and the blocks that did not. A day that then overflows scrolls sideways
inside the strip's own container and the DOCUMENT does not — the ledger's
pattern, `tabindex` included. The strip is its own scroll handle as well
(`utils/drag-scroll.ts`), because `nice-scrollbar` keeps the bar invisible until
hover: a mouse drag moves it, and touch and trackpad are left to the platform,
which already scrolls the container with momentum the drag would cost them. It
is `/`'s alone: the Lab's `plan-timeline-bar.svelte` renders the energy
optimizer's own blocks and shares only `formatDuration`.

**The strip's finished block reads as finished, and the plan does not move.**
`opacity-60` on the block and `text-ty-silent line-through` on its title — the
ledger row's own vocabulary (`task-row-shell.svelte`), because the strip and the
rows it is a reading of sit inches apart — plus an `sr-only` `day_timeline_done`,
and no `#N`. Every width, offset and band still reads the full intended day: the
allocator is blind to `completed`, so a block that moved when a box was ticked
would be a picture of a plan nothing computed. `isCompleted` is a field on
`DayBlock` and not a prop, the opposite of `/energy`'s `completedTaskIds`: the
optimizer owns `EvaluatedBlock`, while `DayBlock` is a view model whose input
`SuggestedTask` already carries the flag, so a prop would move the policy back
into the markup
([the-strip-that-read-as-all-ahead.md](../../../docs/features/the-strip-that-read-as-all-ahead.md)).

The strip carries **no time of day at all**. It once read against a persisted
`DailySession.startHour`, set by a "Day Starts" field, to print a `from 09:00`
label — and that label was its only reader: no formula, fit or metric ever
touched the value. `availableHours` is intended work, not a span of the clock,
so start-plus-budget is a finish time nobody computed, which
left the start with nothing to anchor but itself. The field, the label, the
persisted key and the `formatClock`/`parseClock` pair went with it; every
duration on the strip is an offset from the day's own zero (`formatOffset`),
which is the only reading the model has
([the-anchor-that-held-only-itself.md](../../../docs/features/the-anchor-that-held-only-itself.md);
[the-plan-that-had-no-clock.md](../../../docs/features/the-plan-that-had-no-clock.md)
records the version that had one).

### A finished task's blocks read as finished, and the plan does not move

`plan-timeline-bar.svelte` and `plan-schedule-list.svelte` both take
`completedTaskIds: number[]` — required and not defaulted, because `/energy`
derives it from `session.tasks` and is the only caller, and a plan that silently
marks nothing is the reading this exists to fix. The route derives the ids
because neither existing split of the same field is a view of completion to
reuse (R3): `session-store`'s `activeTasks` drops the completed tasks instead of
naming them, and `energy-lab-store`'s `openTaskIds` is the stop advisor's model
input. Completion stays a PROP and
never a field on `EvaluatedBlock`: the optimizer runs over every task, completed
ones included, so a block carrying the flag would imply the plan read it
([business/model/AGENTS.md](../business/model/AGENTS.md), "the budget's shadow
price is a day-level reading"). Nothing here enters a number, and the mark is per
TASK — a task interleaved into two blocks marks both, since the plan carries no
time of day to tell the block already run from the one still ahead.

**The bar marks, the list dims**, and STYLE.md settles which is which rather than
taste. A bar label sits on a series fill, which is opaque so `series-ink` can be
fixed, so a finished block takes a `✓` prefix and `line-through` and keeps its
hue, its width and its opacity. The list's mark is a 10px dot with nothing
written on it — the half of the same rule that allows a wash — so its row takes
`opacity-60` and its title `text-ty-silent line-through`, the ledger row's own
vocabulary (`task-row-shell.svelte`). "Done" is ANNOUNCED in the list alone,
`sr-only`: the bar's blocks are non-semantic `<div>`s whose `title` is not a
reliable accessible name, so the bar says it in a message of its own
(`energy_block_tooltip_done`) rather than a "(done)" concatenated onto the
tooltip string, which is a word no translator could place — the `✓` concatenates
in markup precisely because a glyph is not one. Under `LABEL_MIN_SHARE` there is no label to mark at
all, and the list's row is the reading for that block
([the-block-that-was-already-done.md](../../../docs/features/the-block-that-was-already-done.md)).

### Each measurement is read, corrected and dropped on the row it belongs to

Both read in the `Logged` cell, and so do both triggers: a control has to sit
beside the reading whose editor it owns, or the one-click rule below has nothing
to be about. The shapes differ because the quantities do: ⚡ is one number per
day and reads as one badge, 🪫 is one per session (§8.7) and reads as one chip
per rating — an unbounded list, which is why this is a flexible cell and not a
fixed-width column of its own. Both readings are buttons into their own editor,
and both explain themselves through the row's shadcn tooltip, never a native
`title`.

**A reading is a recessed chip, a trigger is a bare glyph** — `READING_CHIP_CLASS`
in the shell, and the one thing that tells the cell's four controls apart. All
four were bare, so a rated row read as one run of glyphs (`⚡ 🪫 2h M0 B0 🪫`)
in which the instrument that OPENS the editor and the instrument that IS the
reading were the same picture. For the same reason the 🪫 chip words its two
ratings (`Mind 6`, `Body 2`, the editor's own localized labels) instead of the
initials it carried: `M6 B4` beside a duration reads as a code, and two e2e
assertions plus a story `play` read that text.

Both models read both fits — ϕ (⚡) feeds the Lab's own curves, and the α, λ₀,
audit and carry-over readings all run off 🪫 hours — so neither instrument may
be withheld from a screen (ROADMAP item 11).

**One click rule covers the whole `Logged` cell: a control closes the editor it
owns, and otherwise opens its own.** A reading owns the editor seeded from it, so
clicking the reading the editor is open on closes it while clicking a different
chip switches to that session — the switch arm exists only for 🪫, since ⚡ has
one reading, which is why its badge reads as a plain toggle. The 🪫 button owns
the APPEND editor (the one with no `recordId`) and nothing else: over a
correction it opens a blank one rather than closing a rating the user is
amending. The button is **not** hidden on a completed task — finishing one is
the commonest way a session ends. Each editor then drops what it opened on (🗑).

**Both editors are open only while the PAGE holds a draft for that task** — the
shell renders the two forms and owns neither. 🪫 has to be the page's, since a
chip opens one over a draft the row may already hold; ⚡ is the page's too, and
that split is what lets the two answer the row's own lifecycle: ✕ then Undo
restores the task under its original id (`removeTask`), so a surviving draft
re-opens while a row-local one would not. `EditorDraft`, `newEditorDraft`,
`DrainDraft`, `newDrainDraft` and `drainDraftFromLog` in `measurement-prompt.ts`
keep the two pages' four records one shape, `completionPromptAction` is the one
prompt policy both run, and `EnergyObservationStore.drainLogsOn(date)` is the
one answer to "what did this task measure that day" that both screens read
their chips from.

A draft whose row leaves the screen is inert (it is keyed by a task nothing
renders); a deleted task's is not, so ✕ drops both on both screens.

The session timer is the third opening of the 🪫 APPEND editor, and the only
one that arrives with a value: `newDrainDraft(source, minutes)` takes what a
STOPPED timer counted (`getPendingMinutes` — a running clock offers nothing, or
it would fund a second log from the same minutes), and `drain-log-form.svelte`
then focuses the **first empty required field, falling back to the length when
none is empty** — so a seeded `45` cannot become `456`, and a correction, which
seeds all three, keeps the caret it always had. One stop funds one log and
several rows hold an open editor at once, so the reading is
**claimed by the first editor opened** (`claimPendingMinutes`): every other row
opens empty while that claim stands, closing the claiming editor releases it,
and only that editor's append spends the reading (`spendsPendingMinutes`) —
never a correction, and never while the clock still runs. Both screens seed and
spend by that one rule, and both offer the timer's CONTROLS.

### One screen lists logs: `/analytics`

It prints every ⚡, 🪫 and ☕ — the range it is viewed under, or all of them
(`log-history.ts` folds the three stores, `log-history-list.svelte` prints
them). The range can be dropped because this list is the only surface some
measurements have: nothing older than the widest range (a year) is reachable
from anywhere else, so a bound that always held would put an old typo
permanently beyond both correcting and dropping while it still fed a fit.

Three cards each listing their own kind was three partial answers to "what have
I logged" — none could show a neighbouring kind or a day outside its own fit —
so what stays with each card is the one thing a FIT has rather than a
measurement: what it was fitted from. ⚡ and 🪫 say it in a sentence and offer
no verb at all, because their cards now stand on this page: the link would point
at the card it is drawn in, and the reset would be this page's second. ☕, alone
behind a Lab fold, still carries both through `fit-log-summary.svelte` (whose
two-step reset and focus handling are the safety of every bulk delete in the
app). The history card draws that same row once per kind, with
`withHistoryLink={false}`, for the same self-pointing reason.

**A fit card comes to this page when the list holds its rows and it has nothing
left to do.** ⚡ and 🪫 qualify on both counts. ☕'s pairs are listed here, but
its card is the app's last link INTO the list and its editor is typed on the
ledger's heading row, so moving it would cost the link and split the editor from
the card. λ₀ fails the first count outright: it reads finished DAYS, not
measurements, and nothing it names appears in the list at all.

The history **drops, corrects and wipes**: ✕ and ✎ on every row, each addressed
by `(kind, id)` and not `id` alone — three kinds are three stores with three id
sequences — and, at the card's FOOT under the list, one reset per kind making the
same store call that kind's fit card makes. Under, because the one other reset
sits on a card read for something else — ☕'s, behind the Lab's fold — and these
would otherwise be the app's most prominent destructive control, on a card
opened to read the list. Their counts and their deletes are ALL-TIME while the
list above them is ranged, because the stores expose no ranged delete — a count
filtered to the viewed range would name less than the button removes. A row's
date is also a link to `/?date=<that day>` for ⚡ and 🪫, which is navigation and
not the correction path; ☕ belongs to no day's row and gets no link.

### The range readings are one card: four headline, five folded

Tasks completed, Avg completion rate, Current streak and Logged hours keep the
large reading and the note — volume, trend, consistency, load, one per question
the range asks. Active days, Longest streak, Planned hours, Rest hours and Best
day fold under a rule in the same card as label, value and suffix; the five
notes are what the hierarchy cost. `metrics-dashboard.svelte`'s own comment
holds why there is a headline set at all, and its `metrics_more` labels this
summary too (R3 — one key for one concept). The fold carries no `Band`: none of
these readings is judged, so no colour and no tooltip.

**One card, not one per reading** — `/`'s shape. `stat-tile.svelte` therefore
draws no shell of its own: four shells side by side said the four readings were
four independent facts, when they are one answer to how the range went, and the
fold had nowhere to sit but the page background.

Plan adherence and Your model are full-width siblings under the other cards:
both read as what the model makes of the range. The one grid on this page is
below them and outside the load gate — Flow Calibration and Drain Calibration,
half each, directly above the log history they were fitted from.

### A correction rewrites the quantities the user rated and nothing else

This is the reason the ✎ can be there at all. Every measurement
freezes the covariates it was taken under (⚡ its `(E, β)`, 🪫 its reservoir
demands, ☕ none) so that editing a task later cannot rewrite what an earlier
session measured, and every correction path used to re-derive them from the
live task, which is that same rewrite by another route. **The rule is about the
correction, not the address it arrived by**, so it binds all three: `logFlow`
reads the day's task only when there is no record to read instead, and
`editDrainLog` and `editFlowLog` read no task at all. A correction is therefore
addressable **by record id alone** — off any screen, with no day in view, and
for a task since deleted. ☕ got a correction at all on that account: it has no
task, hence no row on either screen, so this list is its only editor.

### Both corrections are offered on any day the page shows, a new measurement only today

`logDrain` stamps the live clock (a rating browsed onto a past day would
misdate itself), while `editDrainLog` passes no `date` at all — the data
layer's upsert rules have the type-level reason.

⚡ has two writers split by ADDRESS and not by verb: `logFlow` is the row's
(keyed `(taskId, date)`, since a row has no record id) and `editFlowLog` is the
analytics list's. `logFlow` stamps the **viewed** day and refuses a first
measurement dated before today, so a correction lands and a back-dated log
cannot. The two are not interchangeable: handing the row's UPSERT a record that
has since been deleted re-creates it under its own id with a fresh stamp, so
the by-id path is a real `$updateFlowObservation` and not
`$createOrUpdateFlowObservation` with the record spread back in.

**The observation is the only place a ⚡ lives** —
`SessionStore.flowMinutesOn(date)` is what the row reads, the field is gone from
`Task`, and `sanitizeTask` reads a stored one past rather than repairing it. It
could not be corrected before, because the badge was ALSO a `flowMinutes` field
on the day's task and the autosave never rewrites a past day, so an amended one
came back on the next load. Hence two callbacks on the row and not one:
`onflowopen` is the ⚡ BUTTON (a first measurement, today only) and `onflowedit`
is the badge (a correction, any day) — a past day passes the second and
withholds the first, exactly as it does for 🪫.
`SessionStore.clearFlowLog(taskId)` is the row's delete — the same delete as
`deleteFlowLog(recordId)`, addressed the way a row can address it — and drops
the viewed day's reading, since that is the one on screen.

The timer that fills a 🪫 length is gated the same way, and it is the one control
on `day-actions.svelte` that is: its neighbours read on any day that is not past,
the timer on **today** alone. The state is `SessionTimerStore`'s, bound into the
component by both screens that render it (`bind:timer`), and `localStorage`'s —
`business/utils/session-timer.ts` owns the shape, the transitions and
`getPendingMinutes`, and `presentation/utils/session-timer.ts` is the storage
call and the key
([the-clock-that-only-one-screen-could-start.md](../../../docs/features/the-clock-that-only-one-screen-could-start.md)).
A timer whose `startedOn` is not today is dropped both on read and by the
store's getter, which reads `liveToday.value` — so one left running overnight is
disposed of under a page left open too.

## Settled decisions — do not re-litigate

### A deleted task is undone from its toast; only routines get a confirm step

The ✕ deletes at once and `removeTaskWithUndo` (`presentation/utils`) offers the
task back for eight seconds. A second press would sit on the common path
forever to save the rare mistake — deleting a task is frequent, and the row is
gone either way when the user meant it. The routine rows in
`day-actions.svelte` arm-then-delete instead, for the opposite reason: nothing
there can be handed back.

The undo restores the task at its original index (`/energy` renders the day in
store order) with its original id — safe because `nextTaskId` never recycles
one, and necessary because the drain logs that outlive a task key on it. It
refuses once the viewed day has moved on: a toast outlives a click onto another
day, and autosave would keep the stray task there.

### A dropped measurement is undone the same way

Through `removeLogWithUndo` beside it: a ⚡/🪫/☕ is dropped at once and offered
back for the same eight seconds. The undo is a closure the STORE hands back,
because putting a measurement back is a second IndexedDB write and only the
store knows what it writes — the whole record under its own id and `createdAt`
(`$restore*Observation`), never a re-log, which would be a second session for
§8.7's α and a second recovery for §8.9's r.

No day guard, unlike the task's: a record carries the day it belongs to, so no
viewed day can misplace it. Nothing is offered back for a record the store does
not hold (a second click on a row already gone, which must not delete blind
either) or for a delete that failed — the record is still there and the banner
already says the write did not land.

**Every address the same drop arrives by opens the same window** — the
analytics list's ✕ and the 🗑 in a row's own editor, on both task screens. The
window is not a property of the screen the click landed on, and one of the two
being permanent is exactly what R3's two-screen argument is about. Hence two
exports, not one: `removeLogWithUndo(kind, recordId)` for the list,
`removeFlowLogWithUndo(taskId)` for a row's ⚡ — a row holds no record id, so
`SessionStore.clearFlowLog` is what turns (task, viewed day) into one and
forwards the undo. A single `id` parameter meaning a record on one screen and a
task on the other is how the wrong record gets deleted. 🪫 needs no counterpart:
its editor is opened BY a stored rating, so the row already has that id.

### Metric color-band thresholds live in the presentation layer

`utils/band.ts` — the whole banding policy in one module: the four band names,
the thresholds, the per-axis table, and the tokens and words each band renders
as. Banding a reading as good/bad is display policy, not domain math. It
exports `AXIS_BAND` + `isOutOfBand` because the plan-advice card decides which
findings to surface from the same call the metric rows are colored by — two
copies of the thresholds is exactly the R3 failure.

**A view model carries a `Band`, never a class string.** `Metric.band` and
`AdviceRow.beforeBand` name the band; the component looks up `BAND_TEXT_CLASS` /
`BAND_BAR_CLASS` and `bandLabel`. Keying anything off `text-success` makes
renaming a token a silent behaviour change: the dashboard's screen-reader band
text was wired that way and a `-strong` swap would have dropped it with nothing
failing. `bandLabel` returns `null` for `neutral` on purpose — the default value
colour makes no claim, so silence is the honest equivalent.

**The plan-adherence verdict band is not one of them.**
`ADHERENCE_TIE_BAND` (`utils/plan-audit-descriptor.ts`) stays in this layer, but
its derivation is MATH.md §9's and its number is
`scripts/adherence-tie-band.probe.ts`'s — unlike `utils/band.ts`, whose
thresholds are display policy this layer owns outright.

### The Lab's task list reads in schedule order, snapshotted per visit

Settled 2026-08-05. Sorting it live is the obvious implementation and it is
wrong: every parameter edit re-optimizes, so the rows re-ranked mid-drag and
moved the row being dragged out from under the cursor. The page calls
`lab.resnapshotOrder()` from its `onMount` — first paint and every
re-navigation — and `#displayOrder` holds until then. Only positions freeze:
every number in a row stays live, so a stale order never shows a stale reading.

The snapshot is the **whole** day's order — scheduled tasks first, then the ones
the plan funded nothing, in the store's own order — so "has no position" means
exactly one thing: added since the snapshot. Those go to the front, because
`addTask` puts a new task first and the card's form is above the list, so the
front is where the user looks for the row they just deployed. A day with no
window has no blocks to sort by, so the snapshot stays unfilled and the list
reads in the store's order until one is set.

### The Lab's row reads the three model inputs, it does not slide them

Settled 2026-08-06. They were live sliders — a second line on every row — on the
theory that the Lab is where you watch the schedule react. It is, but to the
params panel beside the list: `P`/`M`/`E` are a definition the user sets once
when deploying a task, and the form already suggests them from history (ROADMAP
item 24). So they read as text, exactly as `/` spells them, and ✎ re-tunes them.
The must-do toggle is hidden in both of the Lab's forms
(`withMustDoToday={false}` — the add form takes it directly, the row's ✎ through
the shell) because `isPinned` is read by the plan advisor and by nothing in this
mode. The seeded value still round-trips, so an edit here cannot clear a flag set
there. This is the carve-out named under "R3 in the UI" above; the prop is one
name from the Lab's page down to the form that renders the toggle.

### The calibration cards share a shell, not a body

`calibration-card.svelte` is the card, the explained heading and the action
slot, and nothing else. The fitted numbers read on the parameter rows they fit
(`param-row.svelte`'s `fit`), so the Lab's two cards are read-outs and neither
takes the action slot: ☕ is typed on the ledger's heading row with the day's
other logs, which is also what makes it reachable on a day with no tasks. What
is left is still four different things — ⚡ has a headline count and a status
sentence, 🪫 has the same headline and a pending line, r has a pending line and
a fit summary, λ₀ has a censored state and a day count and no log store at all.
⚡ and 🪫 stand side by side on `/analytics` and still do not share a body: they
look alike there, which is exactly when a mode flag is tempting. No flag and no
folding the bodies in — the same argument as the two task rows' shell: a
component covering all four would be a config blob, not a card.
