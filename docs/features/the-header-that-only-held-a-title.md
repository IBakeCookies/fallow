# The header that only held a title

**Kind:** feature · **Status:** landed 2026-08-22 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`/` gives back the ~56px its page header spent on a second copy of the app name:
the header row goes, the day's **Load** and **Save** move onto the Tasks card's
own heading row beside "Next", and the `<h1>` stays in the markup as `sr-only`
so the page keeps a crawlable heading without drawing one. The tagline that was
the `<h1>`'s tooltip moves to the nav brand, where it explains the app on every
page instead of only on `/`.

## Scenarios

### Scenario — the day's Load and Save read on the Tasks card

`e2e/routine.e2e.ts`

- **Given** today, a fresh profile with one task
- **When** the page loads
- **Then** the Tasks card contains the `Load` button
- **Then** the Tasks card contains the `Save` button
- **Then** no `Load` button exists outside the Tasks card

### Scenario — the page draws no second app name

`e2e/tasks.e2e.ts`

- **Given** today, a fresh profile
- **When** the page loads
- **Then** the `Fallow` heading is attached to the document
- **Then** that heading carries `sr-only`

### Scenario — a past day offers neither

`e2e/day-navigation.e2e.ts`

- **Given** a past day loaded by date
- **When** the Tasks card renders
- **Then** it has no `Load` button
- **Then** it has no `Save` button

### Scenario — an empty day can still load yesterday

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** `currentTasks: []` on today, with a yesterday session
- **When** the row renders
- **Then** the `Load` button is present
- **Then** no `Save` button is present

### Scenario — the nav brand explains the app

`src/lib/presentation/component/nav.stories.svelte`

- **Given** the nav on `/`
- **When** the pointer hovers the `Fallow` brand link
- **Then** the tagline tooltip opens

### Scenario — Return to Today is not lost with the header

`e2e/day-navigation.e2e.ts` (pin)

- **Given** a past day loaded by date
- **When** the first nav item is clicked
- **Then** the page is on today

## Out of scope

- **`/energy` gaining Load and Save.** Agreed as the next step, and cheap once
  `day-actions.svelte` exists (that page already holds `getSessionStore()`), but
  it is a new capability on that screen rather than a relocation — it lands with
  its own e2e coverage, in its own change. This one stays behaviour-free apart
  from the two deletions below.
- **The metrics grid's `Capacity Left` / `Human Capacity` overlap.** Noticed in
  the same screenshot review; a separate question about what the grid should
  read.
- **Renaming `header_tagline`.** The app bar is a header, so the key still says
  what it holds.
- **Any change to what Load and Save DO.** Same menus, same callbacks, same
  routine delete-confirm step (AGENTS.md §4, "only routines get a confirm
  step").

## Read before building

- `src/lib/presentation/component/page-header.svelte` — the whole component.
  Renamed to `day-actions.svelte`, keeping the two dropdowns, `hasYesterday`,
  `hasRoutines`, `canSave`, both draft-clearing `$effect`s and the
  `{#if !isViewingPast}` guard. Deleted from it: the `<h1>` + `Tooltip` block,
  the `completedTasks`/`totalTasks` reading, and the Return-to-Today button.
  Props lost: `completedTasks`, `totalTasks`, `ondatechange`. **`selectedDate`
  and `today` stay** — `hasYesterday` needs `isToday` and the guard needs
  `isViewingPast`, and they are two different questions.
- `src/lib/presentation/component/page-header.stories.svelte` — renamed with the
  component; title `Component/Page Header` → `Component/Day Actions`. "Today,
  empty" drops its heading and count assertions; "Viewing a past day" drops its
  Return-to-Today half and keeps the neither-button half. Its `whenClickable`
  helper and the "close every menu before returning" rule (axe runs on what is
  left mounted) are why these plays look the way they do — keep both.
- `src/lib/presentation/component/task-list.svelte:158-172` — the `heading`
  snippet, built here "and not in the page: this list is `/`'s alone". Gains one
  prop, `actions?: Snippet`, rendered beside `NextUpLine` inside one
  `items-center` flex group so the buttons stay pinned right while the Next
  title grows leftward.
- `src/lib/presentation/component/task-list-card.svelte:44-49` — the heading
  row that group lands in. It is `items-baseline`; buttons need `items-center`
  on their own wrapper.
- `src/routes/(app)/+page.svelte:35,170-183` — drops the `PageHeader` import and
  render, gains an `sr-only` `<h1>` and a `{#snippet}` holding `<DayActions>`
  passed to `<TaskList actions={...}>`. It already derives `isViewingPast` and
  already holds all six callbacks.
- `src/lib/presentation/component/nav.svelte:107-119` — the brand link becomes
  the `header_tagline` tooltip's trigger via `Tooltip.Trigger`'s `child`
  snippet, so it stays an `<a>`. The nav has no `Tooltip.Provider` today and
  needs one (every other component brings its own).
- `src/lib/presentation/AGENTS.md` — the public-export half. "R3 in the UI"
  describes `task-list-card`'s `heading` as what "`/` puts its 'Next' there and
  the Lab nothing"; it now also carries the day's Load/Save, and `task-list`
  has a new snippet prop. Both belong there, in a line, not a paragraph.
- `src/lib/presentation/style/STYLE.md:197` — says `@tailwindcss/forms` cannot
  be dropped because of "the two bare-`border` inputs in `page-header.svelte`".
  Those two inputs move; the citation has to move with them or the next reader
  greps a file that no longer exists.
- `messages/{en,de,es,fr,zh}.json` — `common_tasks` and
  `header_return_to_today` lose their only caller (`nav_return_to_today` is a
  different key and stays). Delete both from all five.
- `e2e/nav.e2e.ts:6-11,55-60`, `e2e/error-page.e2e.ts:39-44`,
  `e2e/service-worker.e2e.ts:116-121` — three `getByRole('heading', {name:
'Fallow'})` assertions using `/`'s `<h1>` as "the home page painted".
  `toBeVisible()` would keep passing on an `sr-only` element (Playwright reads a
  1px box as visible), which is worse than failing — it would assert something
  no user can see. Each becomes `toBeAttached()`, which is what those three
  tests actually mean.
- `docs/testing.md` — the level table, for the two component-level scenarios
  above, and the reviewer table at the bottom for the dispatch.
- `AGENTS.md` §0 — the out-of-scope section above is enforcement of it.

## Decisions

- **The `<h1>` goes `sr-only` rather than away** — the below-the-fold explainer
  opens at `<h2>` and `/` is the app's indexed landing page, so the document
  needs a real `<h1>` above it. `sr-only` costs 0px and keeps the crawler and
  the screen reader whole. Rejected: promoting the nav brand to `<h1>` — the nav
  is in the shared layout, so every route would claim the same heading;
  rejected: deleting it — a page whose first heading is an `<h2>` inside a card.
- **The task count is deleted, not relocated** — `0 / 5 tasks` says what the
  metrics grid's Completion Rate already says and what five checkboxes show. It
  was the second thing on the row being removed for space. Rejected: keeping it
  after "TASKS", because that costs `task-list` two numeric props to restate a
  metric (R3 — `calculateDailyMetrics` owns that count).
- **Return to Today is deleted, not relocated** — `nav.svelte:44-48` already
  does it: on another day the first nav item shows that date and clicking it
  returns to today. The button was a second control for one action.
- **The component is renamed, not inlined into the route** — ~140 lines of
  dropdown markup and two draft-clearing effects in `+page.svelte` would be
  legal under R2 and still wrong. Rejected: a new component beside a gutted
  `page-header.svelte`, which leaves a page header that is not one.
- **The tagline lands on the nav brand** — a brand mark is where "what is this
  app" belongs, and it answers on all five routes instead of one. Rejected:
  dropping the tooltip, because the copy is the app's only in-UI pitch;
  rejected: hosting it on the `sr-only` `<h1>`, which has no hover target.
- **`selectedDate` and `today` stay props** — collapsing them into one
  `isViewingPast` boolean would take `hasYesterday`'s `isToday` with it, and
  "yesterday is relative to today, not to the day on screen" is a behaviour the
  stories pin.

## Open questions

None.
