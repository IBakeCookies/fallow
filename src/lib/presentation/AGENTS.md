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

**Imports**, in order: types → external libs → internal helpers → data layer →
business layer → presentation (big/abstract to small/specific).

## R2 — Routes and components hold no logic

The lint rules enforce dependency _direction_, not code _placement_: a route
importing business code is legal, so logic drifts into `+page.svelte` where
nothing can unit-test it. Happened twice (a 518-line main page, a 1349-line
Energy Lab); both had to be pulled back out.

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
  which shipped as mouse-only UI in the header's routine rows. First: the
  menu's Tab handler `preventDefault`s and moves focus past the whole menu, so
  a `<button>` nested in an item is unreachable, and Enter on the item
  dispatches the click at the _item_ — an item with no `onclick` silently does
  nothing. A row of two actions is therefore two sibling items inside a
  `DropdownMenu.Group` (`role="group"` keeps the menu → menuitem ownership
  valid), not one item with buttons in it. Second: the content's keydown
  handler claims arrows/Home/End for roving focus and every single character
  for typeahead **regardless of the event's target**, so an `<input>` in a menu
  must `stopPropagation()` on the keys it owns — but never on Escape, whose
  listener sits on `document`, nor on the arrow that is the only way out of the
  field (menu content hands focus to its first tabbable on open, which is that
  input).
- Storybook stories live **beside their component** (`*.stories.svelte`), one
  file per component or primitive group, rendered as smoke tests by the
  `storybook` vitest project — see [docs/testing.md](../../../docs/testing.md)
  for what runs them and the a11y gate.

## R3 in the UI — the two task screens are one definition

`/` and `/energy` render the same day's list, and everything they were free to
disagree about had drifted: the card around the list, where the add-task form
sat, the rule between rows, and the ✎ editor, which only `/` had, so the Lab
could not rename a task at all. Five components hold what the two screens say
the same way:

- **`task-list-card.svelte`** — the card, the heading, the form above the list,
  the empty state, and the rule between rows (`divide-y`, so neither screen
  decides how its own list is separated).
- **`task-row-shell.svelte`** — the row's frame and hover surface, the
  completion checkbox, the title, the `P · M · E` line, the whole action strip
  (⚡, 🪫, ✎, ✕) and every editor it opens, including the completion prompt that
  opens both measurements at once. Each screen adds only its readings, through
  `lead` / `meta` / `trailing`. **An action is present when its callback is**,
  so a read-only row passes no ✎ or ✕ and a past day none of the **logging**
  ones.
- **`measurement-form-actions.svelte`** — the ✓/✕/🗑 that closes ⚡, 🪫 and 😴. It
  exists because those three editors were written separately and drifted into
  two different button sizes, one with a hover surface and one without; the
  instrument's hue on ✓ is the only real difference and is a prop. 🗑 is the
  caller's copy and absent unless it passes one, because what is being dropped
  differs per editor and a first measurement has nothing to drop.
- **`task-edit-form.svelte`** — the editor, on both screens.
- **`task-form-fields.svelte`** — the fields both task forms set: the three
  model input sliders (one loop over one table, so their labels, minimums and
  accents are defined once) and the must-do flag, in the row the submit buttons
  sit in. `TaskEdit` — the five fields a form can set — is this component's
  type, since adding a task and re-tuning one emit the same thing. The forms
  are otherwise not each other: `task-form.svelte` is a title combobox over
  rated history with a collapse and a reset, `task-edit-form.svelte` is a plain
  title input, which is ~150 lines of script the editor has no counterpart for.
  Do not push the title or the frame in here to make them look like one
  component; the callers keep both, so each frame and each field is defined
  once, whole, and the caller's own `space-y-*` is what sets the form's
  density.

What is left in `task-item.svelte` and `energy-task-row.svelte` is one screen's
reading of the task and nothing else: priority, allocation, run order and T* on
`/`, the schedule's hue and hours in the Lab — three snippets and the prop
mapping around them. That is two readings of one task, not one thing
duplicated — and it is the only reason there are two components. If the
readings ever converge, merge the two callers; do not give the shell a mode
flag.

### The row's layout

**Three columns from `sm` up — box, task, what the day gave it — and stacked
below it.** The columns cost the same width at every size, so on a phone the
middle one was under half the row, the title truncated to nothing and the
derived readings wrapped three times. Stacked, `trailing` and the strip share
one line at the foot of the row; the strip is still drawn once, since a second
copy for the narrow layout would make every action on the row addressable by
two elements at once. A caller aligning a reading right does it from `sm` up
only, and on its own **trigger** — a `Tooltip.Trigger` is a `<button>`, whose
UA `text-align` is `center`, so a wrapped reading otherwise centres its last
line under itself.

✎ and ✕ carry an `aria-label` and no tooltip: a pencil and a cross are the two
icons nobody needs told, and hovering the strip to reach either one popped a
panel over the row underneath. **Every reading keeps its tooltip**, `P · M · E`
included — three bare letters are the one thing on that line that says nothing
for itself, and the ✎ that could show what they mean is hover-revealed. A story
`play` pins both halves, the second on `data-slot` rather than by hovering and
waiting for nothing: a tooltip that never opens and one that opens after a
delay look alike.

### Each measurement is read, corrected and dropped on the row it belongs to

Both had to read at REST — the action strip is hover-revealed, so an unlogged
session looked identical to a logged one — and the shapes differ because the
quantities do: ⚡ is one number per day and reads as a badge beside the
`P · M · E` line, 🪫 is one per session (§8.7) and reads as one chip per rating.
Both readings are buttons into their own editor, and both explain themselves
through the row's shadcn tooltip, never a native `title`.

Both models read both fits — ϕ (⚡) feeds the Lab's own curves, and the α, λ₀,
§12 audit and §11.9 carry-over readings all run off 🪫 hours — so neither
instrument may be withheld from a screen (ROADMAP item 11).

**One click rule covers the whole strip: a control closes the editor it owns,
and otherwise opens its own.** A reading owns the editor seeded from it, so
clicking the reading the editor is open on closes it while clicking a different
chip switches to that session — the switch arm exists only for 🪫, since ⚡ has
one reading, which is why its badge reads as a plain toggle. The 🪫 button owns
the APPEND editor (the one with no `recordId`) and nothing else: over a
correction it opens a blank one rather than closing a rating the user is
amending. Each editor then drops what it opened on (🗑).

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

### One screen lists logs: `/analytics`

It prints every ⚡, 🪫 and ☕ — the range it is viewed under, or all of them
(`log-history.ts` folds the three stores, `log-history-list.svelte` prints
them). The range can be dropped because this list is the only surface some
measurements have: nothing older than the widest range (a year) is reachable
from anywhere else, so a bound that always held would put an old typo
permanently beyond both correcting and dropping while it still fed a fit.

Three cards each listing their own kind was three partial answers to "what have
I logged" — none could show a neighbouring kind or a day outside its own fit —
so what stays with each card is the two verbs a FIT has rather than a
measurement: read what it was fitted from, and un-personalize it
(`fit-log-summary.svelte`, which is `log-list.svelte` narrowed to those two,
keeping its two-step reset and that reset's focus handling).

The history both **drops and corrects**: ✕ and ✎ on every row, each addressed by
`(kind, id)` and not `id` alone — three kinds are three stores with three id
sequences. A row's date is also a link to `/?date=<that day>` for ⚡ and 🪫,
which is navigation and not the correction path; ☕ belongs to no day's row and
gets no link.

### A correction rewrites the quantities the user rated and nothing else

MATH.md §36, and the reason the ✎ can be there at all. Every measurement
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

## Settled decisions — do not re-litigate

### A deleted task is undone from its toast; only routines get a confirm step

The ✕ deletes at once and `removeTaskWithUndo` (`presentation/utils`) offers the
task back for eight seconds. A second press would sit on the common path
forever to save the rare mistake — deleting a task is frequent, and the row is
gone either way when the user meant it. The header's routine rows
arm-then-delete instead, for the opposite reason: nothing there can be handed
back.

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
The must-do checkbox is hidden in both of the Lab's forms
(`showMustDoToday={false}`) because `isPinned` is read by the plan advisor and
by nothing in this mode — the seeded value still round-trips, so an edit here
cannot clear a flag set there.
