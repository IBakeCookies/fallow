# Constraint carry-over for unseen days

**Status:** landed 2026-08-24 · **Roadmap:** item 32

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is the area `AGENTS.md`. When later work changes
the behaviour, it writes its own feature file; it does not edit this one.

## Goal

A day with no stored session opens on the switch cost and the capacity pools the
user last declared, instead of on `DEFAULT_SWITCH_COST` and
`DEFAULT_CAPACITY_POOLS`. Item 16 did this for the day's hours; these are the
other two declared constraints on the same panel.

## Scenarios

### Scenario — an unseen day opens on the last declared constraints

- **Given** a day with no stored session
- **When** it is viewed
- **Then** its switch cost is the one the last stored day ran with
- **Then** its pools are the ones the last day that declared them ran with
- **Then** both fall back to their constants when no day has ever been stored

### Scenario — each field answers from its own latest day

- **Given** a stored day that declares pools, and a newer one that does not
- **When** the fold runs
- **Then** the pools come from the older day and the switch cost from the newer

### Scenario — half a pool pair is not a declaration

- **Given** a stored day with one of the two pools missing
- **When** the fold runs
- **Then** that day declares no pools at all

### Scenario — browsing writes nothing

- **Given** an unseen day showing carried constraints
- **When** nothing else about the day is touched
- **Then** the autosave writes no record

### Scenario — a day saved for a reason of its own records what it showed

- **Given** an unseen day showing carried constraints
- **When** the day is saved for a reason of its own
- **Then** the payload records the constraints it was showing

### Scenario — a stored day keeps its own

- **Given** a stored day whose pools were never declared
- **When** it is viewed
- **Then** it shows the default pools, not the carried ones

### Scenario — the carried constraints reach the page

- **Given** a day whose constraints were declared and saved
- **When** the next day, which has no session, is opened
- **Then** the bar's collapsed summary reads the carried pools and switch cost

### Scenario — a field set to what it was showing is not a declaration

- **Given** a day showing prefilled hours and carried constraints
- **When** a field is set to the value it was already showing
- **Then** the day is not stored, and the field still reads that value
- **Then** a value that did move stores the day

### Scenario — a defer lands in a day with constraints

- **Given** a task moved by `moveTaskToTomorrow`
- **When** the destination day has no stored session
- **Then** the destination is written with the carried constraints

## Out of scope

- **A weekday median.** Item 16's fold is not reused and not parameterized. Hours
  are weekday-shaped — a Saturday is a different day — while a switch cost and a
  capacity are properties of the person and their tooling, which the calendar
  says nothing about. Last declared is also the shorter fold.
- **Making `switchCost` optional in the stored session.** It would give the fold
  a real "never touched this" sentinel, and it costs a fallback at every reader
  of a field three subsystems read. The limit is stated instead, below.
- **A past-day rule.** Item 16 answers 0 on a past day because back-filling a
  budget is a claim about the user's history. There is no equivalent here: an
  unseen past day is read-only, saves nothing, and already showed an invented
  constant, so a branch would guard nothing and no failure names it.
- **Deriving the pools from the fitted drain rates.** ROADMAP item 18. This item
  builds the prefill slot that item declares it needs; it does not change where
  the number comes from.
- **UI, schema, formula.** None of the three moved. The bar binds the same store
  getters, `cognitivePool`/`physicalPool` were already optional in a stored
  session, and no math changed — so no MATH.md section.
- **Known limit: the fold is a boot snapshot.** Item 16's, inherited. A switch
  cost set today does not carry until the next load.
- **Known limit: `switchCost` has no unset sentinel in storage.** Every stored
  day declares one, so what carries is the cost the last stored day _ran with_,
  which may be the constant it was never moved off. It propagates correctly once
  the user does move it: the day that carried the value records it when it saves.
- **The probe.** Unmeasured for item 16's reason — the gate is a question about
  habit, answerable only from a real exported history, and there is none on the
  author's machine.

## Where it landed

- `business/model/constraint-memory.ts` — `summarizeDeclaredConstraints`, the
  fold from stored days to the two carried constraints.
- `business/session-history.ts` — `HistoryPrefills.constraints`, off the scan
  the boot read already does (business/AGENTS.md: one read per store).
- `business/store/session-store.svelte.ts` — the three fields are
  `number | null`, the getters fall back to the fold, the dirty test reads the
  raw fields, and both saves-for-a-reason-of-their-own record the effective
  values.
- `e2e/time-budget.e2e.ts` — the carried constraints on a second day's collapsed
  summary, the only level that can see the fold reach the page.
- `e2e/helpers.ts` — `addTask` was racing the form's remount on `loadedDate` and
  had left this file 1 test of 5 green before this change; it now opens the form by
  retrying, with the click bounded so its own retry cannot outlive the attempt.
  Unrelated to the carry-over, fixed here because it blocked the file.
- business/AGENTS.md, AGENTS.md §4 — the prefill rule now covers all three
  constraints.

## Decisions

- **`null` is the untouched state, three more times** — item 16's one-field
  decision, applied per field. The autosave's dirty test used to read "unequal
  to the constant", which a carried value is by construction: left as it was, a
  prefill would have written a phantom session for every day the user merely
  looked at. The test now reads the raw fields, so the trap closes for all four
  constraints at once and the dirty test got shorter.
- **A stored day is answered by storage** — only `#loadSession`'s no-session
  branch goes `null`. A stored day with no pools ran on the constants, which is
  what `metric/history.ts` and `session-history.ts` already say and what item 18
  is forbidden from changing; carrying today's pools into it would re-score a day
  the user worked, and the autosave would then write them there.
- **Each field from its own latest day** — pools are optional in storage, so the
  newest stored day may have none. One pass, one date per field, order
  independent rather than trusting the range read's ordering.
- **The pair or nothing for the pools** — every writer writes both, so half a
  pair is a corrupt record rather than a statement about either capacity.
- **A blur is not a declaration, for all four fields** — `NumberInput` reports on
  blur whether or not the value moved, so tabbing through the panel stored the
  day: item 16's phantom session, reached by a touch instead of by a look. It was
  already reachable on the hours field before this item and would have been
  reachable on three more after it, so the fix is one rule at the setter —
  `#declare(value, prefilled)` returns `null` while the field still says what it
  was already showing — rather than three more comparisons. The four setters read
  it, and the hours field is included: this item changes item 16's behaviour there
  by one case, which is the case that was wrong.
- **One more fold on the one scan, not a second read** — business/AGENTS.md says
  a composed read reads each store once; `readHistoryPrefills` already scans all
  of history for the other two folds.
