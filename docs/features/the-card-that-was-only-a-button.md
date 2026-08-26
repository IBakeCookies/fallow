# The card that was only a button

**Kind:** feature · **Status:** landed 2026-08-25 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Both cards whose reading costs a solve — the plan advice card on `/` and the
budget curve card on `/energy` — render as themselves from the first paint,
with a one-line prompt where the reading will go and the card's own run button
in its header. Today each is a lone button that, once clicked, unmounts itself
and renders a card carrying a second button for the same action; the user sees
two different controls for one thing, in two different places, depending on
state they cannot see before they click.

The two buttons deleted are `Check my day` (the standalone one; the card's own
button keeps that label) and the standalone `How long should today be?` in the
Model Parameters header, which goes away with
`budget-curve-button.svelte` itself.

## Scenarios

### Scenario — the advice card reads as a card before it is run

`src/lib/presentation/component/plan-advice-card.stories.svelte` — the
`Not calculated yet` story, whose assertions invert

- **Given** `advice: null`, `isBusy: false`, `hasError: false`
- **When** the story renders
- **Then** the heading `Adjust the plan` is visible
- **Then** the prompt line `advice_unrun` is visible
- **Then** a button named `Check my day` is enabled
- **Then** clicking it calls `oncheck` once

### Scenario — the un-run advice card while the solve is in flight

`src/lib/presentation/component/plan-advice-card.stories.svelte`

- **Given** `advice: null`, `isBusy: true`
- **When** the story renders
- **Then** the button named `Solving…` is disabled
- **Then** the prompt line `advice_unrun` is still visible

### Scenario — a first advice check that failed

`src/lib/presentation/component/plan-advice-card.stories.svelte`

- **Given** `advice: null`, `hasError: true`
- **When** the story renders
- **Then** `The check failed. Try again.` is visible inside the card
- **Then** the button named `Check my day` is enabled

### Scenario — the budget curve card reads as a card before it is run

`src/lib/presentation/component/budget-curve-card.stories.svelte`

- **Given** `curve: null`, `isBusy: false`, `hasError: false`
- **When** the story renders
- **Then** the heading `How long should today be?` is visible
- **Then** the prompt line `energy_curve_unrun` is visible
- **Then** a button named `Check the window` is enabled
- **Then** no chart is rendered

### Scenario — a first sweep that failed

`src/lib/presentation/component/budget-curve-card.stories.svelte`

- **Given** `curve: null`, `hasError: true`
- **When** the story renders
- **Then** `The sweep failed. Try again.` is visible inside the card
- **Then** the button named `Check the window` is enabled

### Scenario — the Lab opens with the curve card already on screen

`e2e/energy-lab.e2e.ts` — replaces the scenario
`the budget-curve button reads in the Model Parameters header`

- **Given** a day with tasks and an 8h day window, the curve not yet run
- **When** the Lab opens
- **Then** the curve card renders below the calibration boxes, showing its
  prompt line
- **Then** the Model Parameters card holds no button for the curve
- **Then** clicking `Check the window` replaces the prompt line with the chart

### Scenario — an empty day stops before the curve card

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile with no tasks deployed
- **When** the Lab opens
- **Then** the heading `How long should today be?` is not on the page

### Scenario — the advice card is on screen before the first click

`e2e/plan-advice.e2e.ts`

- **Given** a day with tasks, the advice not yet computed
- **When** `/` opens
- **Then** the heading `Adjust the plan` is visible

No **Claim**: no formula, constant, bound or fit changes. Both stores already
expose every reading this needs, and `isAdviceStale` / `isCurveStale` are
already false while the reading is null
(`daily-plan-store.svelte.ts`, the `isAdviceStale` getter), so nothing gates on
the null state that did not before.

## Out of scope

- **A skeleton or shimmer of the eventual reading.** Refused: greyed shapes in
  the chart's place claim a layout the card does not have yet, which is the
  same lie the old bare shell was avoided for. One prompt line, no animation.
- **A body that changes while busy.** The button already reads `Solving…` and
  is disabled; a second in-flight statement in the body is a second thing to
  keep true.
- **Keeping a curve trigger in the Model Parameters header as well.** Two
  controls for one sweep is the defect being fixed, not a feature of it.
- **Staleness, error and apply-lever behaviour once a reading exists.** All
  unchanged — `docs/features/advice-buttons-expire-with-their-day.md` owns it,
  and the stale banner stays the only statement of why levers are disabled.
- **The load-failure path** left open by that same feature file. Still open,
  still not this.
- **`advice_check`'s wording.** `Check my day` is the label the card's button
  now carries in its un-run state and seven `e2e/plan-advice.e2e.ts` selectors
  find it by that name; only the curve's label changes.

## Read before building

- `src/lib/presentation/component/plan-advice-card.svelte` — the `{#if !advice}`
  branch is deleted; the card body branches on `advice === null` for the prompt
  line, and the header's button label picks between `advice_check` and
  `advice_recheck` on the same test.
- `src/lib/presentation/component/budget-curve-card.svelte` — `curve` becomes
  `BudgetCurve | null`; `recommended` and `booksNoWork` already derive off it,
  and the chart plus the recommendation block move behind the non-null branch.
- `src/lib/presentation/component/budget-curve-button.svelte` and its
  `.stories.svelte` — both deleted. They shipped with
  `docs/features/the-fit-reads-on-the-row-it-fits.md`, so this reverses a split
  one commit old.
- `src/routes/(app)/energy/+page.svelte` — two edits: the
  `{#if budgetCurve === null}` block inside the Model Parameters header goes,
  and the trailing `{#if budgetCurve !== null}` block becomes `{#if hasTasks}`,
  passing `curve={budgetCurve}` through as nullable. Its comment
  (`Full width and last…`) says the button reads on the parameters card — no
  longer true, so it is rewritten in the same diff (AGENTS.md §0).
- `src/routes/(app)/+page.svelte` — the `PlanAdviceCard` call site, already
  inside `!isViewingPast && tasks.length > 0`. No change expected; confirm the
  half-width grid cell holds the card.
- `messages/en.json` and the four other locales — add `advice_unrun` and
  `energy_curve_unrun`; change `energy_curve_check`'s value from
  `How long should today be?` (it duplicates `energy_curve_title` verbatim once
  both are on screen) to a verb label.
- `src/lib/presentation/AGENTS.md`, **Components** — the bullet
  "A card whose reading costs a solve is its run button and nothing else until
  it has run" is amended here, not re-opened: it now says the card renders with
  a prompt line in place of the reading, and its reference to
  `budget-curve-button.svelte` goes with the file. The neighbouring stale bullet
  stays true and is not touched.
- `docs/features/the-fit-reads-on-the-row-it-fits.md` — frozen; read only for
  why the button was split off. This file supersedes that decision.
- `docs/features/advice-buttons-expire-with-their-day.md` — the staleness
  contract this must not disturb.
- `docs/testing.md` — the level table: card rendering is a `play` function,
  page placement is `e2e/*.e2e.ts`.
- `src/lib/presentation/style/STYLE.md` — tokens-only classes, before the
  prompt line's markup.
- MATH.md — nothing. No section changes.

## Decisions

- **The card renders always; the reading is what waits.** The old rule traded a
  shell for honesty — a heading over an empty panel claims a reading that does
  not exist. A prompt line pays that debt directly by saying the reading has not
  been taken, and buys back the thing the rule cost: one control in one place,
  discoverable before the first click. Rejected: leaving both cards as they are
  and only deduplicating the button, which cannot be done — the two buttons are
  in different components at different places on the page precisely because the
  card is absent in one state.
- **One prompt line, not a skeleton.** Rejected: placeholder shapes, because a
  skeleton is a claim about the shape of an answer nobody has computed, and on
  the curve card that answer may be a chart, a no-crossing sentence or a
  no-work sentence.
- **The curve card lands full width at the foot, and the header button is not
  replaced.** `the-fit-reads-on-the-row-it-fits.md` put the run button beside
  the Day window row it prices; an always-rendered card cannot sit there — the
  chart is wider than a third of that card, which was that spec's own reason for
  keeping the chart at the foot. The adjacency is what this trades away.
  Rejected: moving the whole card up into the parameters column.
- **The curve card is gated on `hasTasks`.** It was outside that gate only
  because a null curve rendered nothing; always-rendering it would put a card
  offering a sweep on a day with nothing to sweep, past the page's own "an empty
  day stops here" line. Rejected: rendering it disabled with a "deploy a task
  first" line, which is a third empty state for the same fact the empty task
  list already states.
- **`energy_curve_check` is re-worded; `advice_check` is not.** With the card
  always present, the curve's button label repeated its own heading word for
  word. `Check my day` sits under `Adjust the plan` and does not. The re-word
  costs three selectors in `e2e/energy-lab.e2e.ts`; the advice label being left
  alone saves seven in `e2e/plan-advice.e2e.ts`.

## Open questions

None — landed.
