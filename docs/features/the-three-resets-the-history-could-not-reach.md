# The three resets the history could not reach

**Status:** landed 2026-08-22 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`/analytics` lists every ⚡, 🪫 and ☕ and drops them one row at a time; wiping a
whole kind is somewhere else — ⚡ behind the root page's Time Budget fold, 🪫 and
☕ on `/energy`. After this, the log card carries all three all-time resets, so
"delete every rating" is done on the screen that shows the ratings. The three
existing buttons stay where they are.

## Scenarios

### Scenario — the log card resets a kind

`e2e/analytics.e2e.ts`

- **Given** a profile with one ⚡ log and one 🪫 rating, viewed at `/analytics`
- **When** the ⚡ row's reset is clicked and the confirm is accepted
- **Then** the ⚡ log is gone from the list

### Scenario — a reset touches only its own kind

`e2e/analytics.e2e.ts`

- **Given** the state left by the scenario above
- **Then** the 🪫 rating is still in the list

### Scenario — the confirm can be refused

`e2e/analytics.e2e.ts`

- **Given** a profile with one 🪫 rating, viewed at `/analytics`
- **When** the 🪫 row's reset is clicked and Cancel is pressed
- **Then** the 🪫 rating is still in the list

### Scenario — the reset ignores the viewed range

`e2e/analytics.e2e.ts`

- **Given** two ⚡ logs, one dated today and one dated 90 days ago, with the
  range toggle on `week`
- **When** the ⚡ row's reset is clicked and the confirm is accepted
- **Then** switching the list to all time shows no ⚡ log

### Scenario — the count is the all-time count

`e2e/analytics.e2e.ts`

- **Given** two ⚡ logs, one dated today and one dated 90 days ago, with the
  range toggle on `week` (so the list shows one)
- **Then** the ⚡ row reads 2 logs

### Scenario — an open correction does not survive the wipe

`e2e/analytics.e2e.ts`

- **Given** a profile with one 🪫 rating whose ✎ editor is open
- **When** the 🪫 row's reset is clicked and the confirm is accepted
- **Then** the editor's Save button is gone

### Scenario — a fresh profile offers nothing to reset

`e2e/analytics.e2e.ts`

- **Given** a fresh profile with no logs at all, viewed at `/analytics`
- **Then** the log card shows no reset button

### Scenario — the summary row can omit its history link

`src/lib/presentation/component/fit-log-summary.stories.svelte`

- **Given** the story renders the summary with the history link suppressed
- **Then** no "In your logs →" link is in the row

### Scenario — the two call sites that keep the link keep it (pin)

`src/lib/presentation/component/fit-log-summary.stories.svelte`

- **Given** the existing "With logs" story, unchanged
- **Then** the "In your logs →" link is in the row

## Out of scope

- **Moving or removing the three existing resets.** The root page's "Reset
  personalization" and `/energy`'s two stay exactly where they are, with the
  same labels and the same behaviour; this adds a third place, it does not
  relocate anything.
- **A range-scoped bulk delete.** Every one of the three deletes all logs of
  its kind, all-time, the same as the buttons it mirrors. "Delete just this
  week's" is not built.
- **Undo for a bulk reset.** The inline two-step confirm is the whole guard, as
  it is today. The per-row ✕ keeps its undo toast and is not touched.
- **A kind filter on the list.** The list still shows all three kinds folded
  together; the reset rows are not a filter.
- **A single "delete everything" button.** Three kinds, three resets.

## Read before building

- `src/routes/(app)/analytics/+page.svelte:435-470` — the `#log-history` card:
  the heading row, the all-time toggle, the `areLogsLoading` branch and
  `closeEditor`. The three rows go inside the loaded branch, between the hint
  and `LogHistoryList`.
- `src/lib/presentation/component/fit-log-summary.svelte` — the row to reuse:
  its two-step confirm, its focus handling, the `count === 0` effect that hides
  the control, and the **unconditional** "In your logs →" link, which on this
  page would point at the card it is drawn in.
- `src/lib/presentation/component/fit-log-summary.stories.svelte` — the
  "Without reset" story is the shape for the new "without link" one.
- `src/lib/presentation/component/day-constraints-bar.svelte:252-262` — the ⚡
  call site: which message keys it passes and that `resettableLogs` is
  `flowLogs.length`, all-time.
- `src/routes/(app)/energy/+page.svelte:627-640` and `:695-707` — the 🪫 and ☕
  call sites and their message keys.
- `src/lib/business/store/session-store.svelte.ts:985` (`resetFlowLogs`) and
  `src/lib/business/store/energy-observation-store.svelte.ts:256`/`:356`
  (`resetDrainLogs`, `resetRestLogs`) — the three store calls, already all-time
  and already the only definition. No store change.
- `src/lib/presentation/AGENTS.md:419-437` — **this change makes it false.**
  "what stays with each card is the two verbs a FIT has rather than a
  measurement" and "The history both drops and corrects" describe a split this
  spec ends: the history gains the third verb, and the fit cards keep theirs.
  Correct that paragraph in the landing commit (AGENTS.md §0), and the
  `fit-log-summary.svelte` line at `:432` if the new prop changes what the
  component is described as taking.
- `messages/en.json:141-143`, `:366-383`, `:488-490`, `:511-513` — the existing
  reset labels, confirms and titles, and the `ana_logs_*` block the new keys
  join. All five of `messages/*.json` carry every new key.
- `e2e/analytics.e2e.ts:80-122` — the seeding and locator pattern (`logDrain`
  from `e2e/helpers.ts`, the `/^Delete Session rating logged on/` row names)
  the new tests follow.

No MATH.md section changes: the three resets already exist and already revert
the fits to defaults; this adds a fourth way to press two of them.

## Decisions

- **Reuse `fit-log-summary.svelte`, with its history link made optional.** The
  two-step confirm and its focus handling are the safety of this feature and
  exist once (R3). The one thing that does not transfer is the "In your logs →"
  link, which on `/analytics` links to itself. An optional prop that defaults to
  showing the link leaves both existing call sites untouched. Rejected:
  three inline confirm buttons on the page, because that copies the confirm and
  its focus rules into a route (R2, R3); rejected: linking the card to itself,
  because a link that scrolls nowhere is worse than no link.
- **The counts are all-time, and so is the delete.** `resetFlowLogs` and the
  two others delete every record; a count filtered by the viewed range would
  name a smaller number than the button removes. Rejected: honouring the range
  and the all-time toggle, because the three stores expose no ranged delete and
  the existing buttons would then mean something different from these.
- **The row's label is the kind and its all-time count; the confirm, title and
  two of the three button labels are the existing keys.** New: one plural pair
  for the label (kind interpolated from `ana_logs_kind_*`) and one ⚡ button
  label, because "Reset personalization" next to "Delete all ratings" and
  "Delete all pairs" reads as a different kind of action than it is.
- **A reset closes an open ✎.** `editingKey` is the page's, and a wipe can take
  the open row out of the list — the same reason the range toggle already calls
  `closeEditor`.
- **The rows sit at the card's foot, under the list.** The other three resets
  are each behind a fold — the root page's Time Budget, the Lab's two
  calibration cards — so drawn above the list these would be the most prominent
  destructive control in the app, on a card the user opened to read. Rejected: a
  bordered "danger zone" of their own, because the app's global wipe ("Delete
  all data") lives in the nav's Data menu, and a danger zone that does not hold
  it is a red border rather than a zone; rejected: a `/settings` route, which
  reopens the jump this spec closes and would make ⚡ resettable from three
  screens instead of two.
- **The rows render only in the loaded branch.** While `areLogsLoading`, every
  count is 0 and three rows saying "0 logs" would claim an empty history the
  same way zeroed tiles would claim an empty range.
- **Nothing moves off the root or `/energy` page.** Each fit card's reset is
  the un-personalize verb of that fit, next to the fit it reverts; removing it
  would send a user who is reading a calibration to another screen to undo it —
  the same jump this spec is closing, in the other direction.

## Open questions

None — landed.
