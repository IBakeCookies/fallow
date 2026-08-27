# The planner that said it needed an open task

**Kind:** feature · **Status:** planning · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On `/energy`, ticking off the last open task replaces the whole plan card with
"All tasks done for today. 🎉 — The planner needs an open task." After this the
plan stays on screen, every block struck through, so a finished day is read as
the day you finished rather than as a screen with nothing on it.

The sentence it replaces is wrong about the code as well as unhelpful: the
optimizer runs over every task, completed included
(`energy-lab-store.svelte.ts`, `#energyTasks`), precisely so that ticking one
off does not re-solve the day. The plan the card was hiding is a complete,
correct plan. `/` has never had this branch — its day strip draws a fully
completed day like any other — so this also settles the two screens on one
answer.

## Scenarios

### Scenario — an all-done day still draws its plan

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile, one task `Deep work`, `/energy` open with an 8 h day
  window, and `Deep work` checked
- **When** the page renders
- **Then** the `Optimized day` heading is visible

### Scenario — its block reads as finished

`e2e/energy-lab.e2e.ts`

- **Given** the same day
- **When** the page renders
- **Then** the bar's `Deep work` label reads `✓Deep work`

### Scenario — the finished day still reports its hours

`e2e/energy-lab.e2e.ts`

- **Given** the same day
- **When** the page renders
- **Then** the work/free summary is visible

### Scenario — the ledger below is still there to un-check from (pin)

`e2e/energy-lab.e2e.ts`

- **Given** the same day
- **When** the page renders
- **Then** `Mark Deep work complete` is visible and checked

### Scenario — a day with no tasks at all still shows no plan (pin)

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile with no tasks, `/energy` open
- **When** the page renders
- **Then** the `Optimized day` heading is absent

## Out of scope

- **`/`'s day strip.** It already draws an all-completed day; making its blocks
  _read_ as done is
  [the-strip-that-read-as-all-ahead.md](the-strip-that-read-as-all-ahead.md),
  planned separately. This change touches no file that one does, apart from the
  `presentation/AGENTS.md` paragraph both need — whichever lands second amends
  it rather than writing a second copy (R3).
- **The `hasTasks` gate.** A day with no tasks at all still stops at the list,
  and the form there is where the first task gets typed. That is a different
  emptiness — nothing to plan, rather than a plan you finished — and it stays.
- **Any replacement acknowledgement.** No banner, no toast, no 🎉 moved
  elsewhere. `/` has never congratulated a finished day and the struck-through
  plan is the reading; adding one here would be the ask plus an improvement
  (AGENTS.md §0).
- **The stop advisor.** It renders far below the plan card, already draws on an
  all-done day, and owns its own empty case through `openTaskIds`
  (`energy-lab-store.svelte.ts`, `#stopAdvice`). Untouched.
- **Editing
  [the-block-that-was-already-done.md](the-block-that-was-already-done.md).**
  It landed 2026-08-27 and is frozen; its note that "a fully-marked bar is
  unreachable" was true when written. This file is the record that it stopped
  being true.

## Read before building

- `src/routes/(app)/energy/+page.svelte` — the `{#if activeTasks.length === 0}`
  branch inside `{#if hasTasks}`, its comment ("The optimizer needs an open
  task"), and the `activeTasks` `$derived` above it. Delete the branch and
  collapse the `{:else}`; check whether `activeTasks` still has a caller on the
  page and drop it if not.
- `src/lib/business/store/energy-lab-store.svelte.ts` — `#energyTasks` and its
  comment, "Optimize over ALL tasks (completed included), matching the main
  page's allocator". That is the statement the deleted branch contradicted, and
  it is why `plan.evaluation` is complete on an all-done day.
- `e2e/energy-lab.e2e.ts` — the two tests `ticking a task off marks its block in
the plan` and `un-ticking a task restores its block`. Their shared comment
  says "Two tasks, because an all-completed day replaces the whole plan card
  with 'all done' and there is no bar left to read" — **false after this
  change; correct it in the same diff** (AGENTS.md §0). Whether the tests keep
  their second task is the implementer's call; the comment's reason must go
  either way.
- `messages/en.json` — delete `energy_all_done` and `energy_all_done_hint`, and
  the same two keys in `de.json`, `es.json`, `fr.json`, `zh.json`. Confirm no
  other caller first; at planning time the branch was the only one.
- `src/lib/presentation/AGENTS.md` — add the paragraph beside "A completed task
  renders its `Planned` and `Prio` cells EMPTY": a day with every task ticked
  renders its plan, struck through, on both screens; the plan is a reading of
  what was intended and does not empty out as it is worked. Note that
  [the-strip-that-read-as-all-ahead.md](the-strip-that-read-as-all-ahead.md)
  writes into the same place.
- `docs/testing.md` — the level table. This is a route branch with no story, so
  the level is `e2e`. Check the existing `/energy` tests for the `Day window`
  fill and `AUTOSAVE_MS` idioms before writing new ones.

No MATH.md section changes.

## Decisions

- **The branch is deleted, not rephrased.** The obvious smaller fix — keep the
  card and correct its hint — keeps a screen that hides a working plan behind a
  sentence, and keeps `/` and `/energy` disagreeing about what a finished day
  looks like. Rejected: a shorter "All done 🎉" line above the plan instead of
  replacing it, because `/` prints nothing of the kind and the point of the
  change is that the two screens read alike.
- **Nothing replaces it.** The affordance the hint narrated — un-check a task,
  or add one — is the ledger directly below, which renders on this day like any
  other. A sentence pointing at a control three inches down the page is
  furniture.
- **This is a `feature`, not a `repair`, although it fixes a false sentence.**
  What lands is a screen the user sees differently; the wrong comment and the
  wrong hint go with it. Calling it a repair would claim nothing shipped moves,
  and something does.
- **It waits for the block marking, it does not race it.** Deleting this branch
  before
  [the-block-that-was-already-done.md](the-block-that-was-already-done.md)
  landed would have shipped an all-done day drawing a plan that looked entirely
  unfinished — strictly worse than the card. That spec landed 2026-08-27, so the
  marking is there and this is the branch's last reason gone.

## Open questions

None.
