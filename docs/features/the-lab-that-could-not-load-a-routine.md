# The Lab that could not load a routine

**Kind:** feature · **Status:** landed 2026-08-22 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`/energy` can only take the day's tasks one at a time: the Lab has the add-task
form but neither **Load** nor **Save**, so a routine saved on `/` cannot be
loaded into the screen where the day actually gets tuned. After this the Lab's
Tasks card carries the same pair `/` reads on its own card heading — same two
menus, same yesterday/routines/from-a-date choices, same routine delete-confirm
step — and the two screens' task cards stop disagreeing about what a task card
can do.

## Scenarios

### Scenario — the Lab's Tasks card carries the day's Load and Save

`e2e/energy-lab.e2e.ts`

- **Given** today with one task deployed, on `/energy`
- **When** the Lab finishes loading
- **Then** the Tasks card contains the `Load` button
- **Then** the Tasks card contains the `Save` button

### Scenario — a routine loads onto the Lab's list

`e2e/energy-lab.e2e.ts`

- **Given** a two-task routine saved from a future day, leaving today empty
- **When** that routine is picked from the Lab's `Load` menu
- **Then** the first task has a row in the Lab's ledger
- **Then** the second task has a row in the Lab's ledger

### Scenario — an empty Lab day offers Load and nothing to save

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile with no tasks, on `/energy`
- **When** the empty list renders
- **Then** the Tasks card contains the `Load` button
- **Then** no `Save` button exists on the page

## Out of scope

- **Any change to what Load and Save DO.** Same component, same two menus, same
  four session callbacks, same routine arm-then-delete step
  (`presentation/AGENTS.md`, "only routines get a confirm step"). This change is
  a second caller, not a new capability inside `day-actions.svelte`.
- **Date navigation on `/energy`.** The route stays today-only —
  `energy/+page.ts` redirects `?date=` away, and that is what makes the two date
  props honest here. Loading _from_ a past date is the existing menu field and
  still writes into today.
- **A "Next" line on the Lab's card.** That is `/`'s mid-day re-plan
  (MATH.md §35); the Lab reads its own order in the timeline and schedule views.
- **`split` row groups on the Lab's list.** Still `/`'s alone.
- **New message keys.** Both menus' copy is already locale-complete in all five
  files. The `header_*` prefix stays as-is, for the reason `header_tagline` did
  in [the-header-that-only-held-a-title](the-header-that-only-held-a-title.md):
  the app bar is a header and the key names what it holds.
- **`mustDoToday` travelling with routines.** It deliberately does not
  (ROADMAP, Phase 5 task-importance item), and the Lab's own form already passes
  `withMustDoToday={false}`. Loading a routine into the Lab changes neither.
- **Load/Save on `/calendar` or `/analytics`.** Neither screen edits the day's
  task list.

## Read before building

- `src/routes/(app)/energy/+page.svelte` — the `<TaskListCard form={addTaskForm}
columns={...} rows={...} />` call inside the `lg:col-span-2` / `lg:col-span-3`
  wrapper. It gains one prop, `heading`, fed by a `{#snippet}` holding
  `<DayActions>`. The page already holds `getSessionStore()` and already
  imports `TaskListCard`; nothing else on it moves.
- `src/routes/(app)/+page.svelte:166-178` — the `dayActions` snippet to mirror:
  eight props, four of them session callbacks. Copy the wiring verbatim, and see
  the second Decision below for why it is copied rather than hoisted.
- `src/lib/presentation/component/day-actions.svelte` — **unchanged.** Read its
  `isToday` / `isViewingPast` / `hasYesterday` / `canSave` derivations to see
  that this route needs no new prop: with the `date` param redirected away,
  `selectedDate === today`, so the `{#if !isViewingPast}` guard is open and the
  Yesterday shortcut is eligible.
- `src/routes/(app)/energy/+page.ts` — the redirect that makes the sentence
  above true, and its comment on why the Lab is a today-only instrument.
- `src/lib/presentation/component/task-list-card.svelte:8-13` — the `heading`
  prop. Its doc comment says the Lab passes nothing there; the Lab is now its
  second caller, so the comment is false in this diff and gets fixed in it.
- `src/lib/presentation/AGENTS.md:151-158` — the same claim in the
  five-shared-components list ("`/` puts its 'Next' and the day's Load/Save
  there … and the Lab nothing"). What is left `/`-only is the "Next" line and
  `split`; the day's Load/Save is now both screens', `/` through `task-list`'s
  `actions` snippet and the Lab straight into `heading`.
- `src/lib/presentation/AGENTS.md:59` — "Components take snippets/props from the
  layout; they do not reach into stores". This is why the four callbacks are
  re-wired at the second route instead of `day-actions.svelte` reading the
  session store itself.
- `src/lib/presentation/AGENTS.md:80` — "the header's routine rows" names a
  component that no longer exists. It is `day-actions.svelte`; fix the citation
  while in the file.
- `src/lib/business/store/energy-lab-store.svelte.ts:325-361` —
  `#scheduledTasks`. An imported task has no snapshot position and takes the
  **front** of the Lab's list, which is why loaded rows are visible without a
  re-navigation. That is what scenario 2 asserts; do not call
  `resnapshotOrder()` after an import to "fix" the order.
- `src/lib/business/store/session-store.svelte.ts:761-800,997-1025` —
  `importFromDate`, `importTasks`, `saveCurrentAsRoutine`, `deleteRoutine`. All
  four write against `#selectedDate`, which is today on this route.
- `e2e/energy-lab.e2e.ts:12-18,64-92,369-401` — the file's own header comment on
  what belongs in it, the existing empty-day test the third scenario sits beside,
  and the dated-URL pin that already covers the today-only half.
- `e2e/helpers.ts:26-37` — `taskCard(page)`, scoped by the heading "Tasks", which
  is `task-list-card`'s own `m.list_title()`. It resolves on `/energy`
  unchanged; its doc comment ("nowhere else on the page") stays true.
- `e2e/routine.e2e.ts:9-27` — `saveRoutine`, including why it waits
  `AUTOSAVE_MS` after the routine write. Scenario 2 needs the same wait, and the
  helper is not exported — decide between exporting it and repeating the four
  lines when you get there.
- `docs/testing.md:26-34` — the level table. All three scenarios are
  user-visible flows.

## Decisions

- **The Lab passes `DayActions` straight into `task-list-card`'s `heading`** —
  that hook already exists and is documented as "the caller's own half of the
  card's heading row", which is exactly this. Rejected: routing it through
  `task-list.svelte`'s `actions` prop, because the Lab does not render
  `task-list.svelte` at all — it builds its rows from `EnergyTaskRow`.
- **The wiring is repeated at the second route, not hoisted** — the eight props
  are the same eight on both screens, but the only way to stop repeating them is
  `day-actions.svelte` reading `getSessionStore()` itself, which
  `presentation/AGENTS.md:59` forbids. R3's trigger is a second _definition_ of
  a concept, and `day-actions.svelte` still has exactly one. Rejected: a
  layout-owned snippet, because the card is inside each page and a page cannot
  hand a snippet upward.
- **`currentTasks={session.tasks}`, not `lab.scheduledTasks`** — the two hold
  the same tasks here (`#scheduledTasks` maps `session.tasks`), and "does the day
  have tasks worth saving as a routine" is a session question. Rejected:
  `session.activeTasks`, which would withdraw Save from a day whose tasks are
  all ticked off — the routine is the list, not what is left of it.
- **`selectedDate` stays `session.selectedDate`** — equal to `session.today` on
  this route, but passing `today` into both props would make the component's own
  guard read as dead code at this caller and would hide the redirect that
  actually guarantees it. Rejected: an `isToday` or `readonly` prop on
  `DayActions`, which prices a route flag into a component to replace a
  derivation that is already correct.
- **No pin, and nothing to pin** — what this change must not move is already
  covered by tests that run unchanged: `/` reads exactly one `Load`
  (`routine.e2e.ts`, "the day's Load and Save read on the Tasks card") and the
  Lab stays today-only (`energy-lab.e2e.ts`, "a dated URL collapses to the
  canonical Lab"). All three new scenarios go red first.
- **No roadmap item** — nothing on ROADMAP asks for this. It was written down as
  the deferred next step in
  [the-header-that-only-held-a-title](the-header-that-only-held-a-title.md)'s
  out-of-scope section, and this is that step.

## Open questions

None.
