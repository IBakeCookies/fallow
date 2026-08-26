# Budget prefill for unseen days

**Kind:** feature · **Status:** landed 2026-08-12 · **Roadmap:** item 16

Backfilled 2026-08-14 from ROADMAP item 16, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A day with no stored session opens on the hours that weekday usually has,
instead of on 0.

## Scenarios

### Scenario — an unseen day opens on its weekday's hours

- **Given** a day with no stored session
- **When** it is viewed
- **Then** it shows the median budget of the same weekday across stored days
- **Then** it falls back to the overall median when that weekday has none
- **Then** it falls back to 0 when neither exists

### Scenario — only declared budgets are evidence

- **Given** stored days, some of which never declared a budget
- **When** the fold runs
- **Then** only days that declared a budget count toward either median

### Scenario — a past day is not back-filled

- **Given** a past day with no stored session
- **When** it is viewed
- **Then** its budget is 0

### Scenario — browsing writes nothing

- **Given** an unseen day showing a prefilled budget
- **When** nothing else about the day is touched
- **Then** the autosave writes no record

### Scenario — a day saved for a reason of its own records what it showed

- **Given** an unseen day showing a prefilled budget
- **When** the day is saved for a reason of its own
- **Then** the payload records the effective budget it was showing

### Scenario — the first user edit clears the prefill

- **Given** a day showing a prefilled budget
- **When** the user sets the hours
- **Then** the day has hours of its own

### Scenario — a defer lands in a day with hours

- **Given** a task moved by `moveTaskToTomorrow`
- **When** the destination day has no stored session
- **Then** the destination is written with that day's prefill, not 0

### Scenario — the day lands with its hours already known

- **Given** boot
- **When** the day is presented
- **Then** the history read has already completed

### Claim — one read, one transaction per store

- **Given** the composed history read
- **Then** each store is read once; a test pins the single transaction

## Out of scope

- **No store, no schema, no formula.** The change adds none of the three.
- **A separate `#prefilled` flag.** The item asked for one, excluded from the
  autosave's dirty test. Refused under R3: a flag beside a number is free to
  drift, and nothing in either says the two agree.
- **A second whole-history scan.** `readTitleRatings` was widened rather than
  joined by another full read.
- **Back-filling a past day.** A day the user did not plan has no budget, and
  back-filling one would be a claim about their history.
- **The stated probe.** It was not run and the item shipped without it, on item
  15's precedent. Its gate — weekday median vs real `availableHours`, kill if
  MAE > 1.5 h — is a question about habit, answerable only from a real exported
  history, and there is none on the author's machine. So the reading is
  unmeasured.
- **Changing `+page.svelte`'s auto-open condition.** It is unchanged and simply
  fires less often, which is the point.
- **Known limit: the fold is a boot snapshot.** Hours entered today do not enter
  it until the next load. Not worth code today.
- **Known limit: the median takes the lower of the two middles** on an even
  count, so the answer is always a number the user really declared. Not worth
  code today.

## Where it landed

- `business/model/budget-memory.ts` — `summarizeBudgetHistory` /
  `prefillBudgetFor`, the fold from stored days to a day's prefill.
- `+page.svelte` — remounts the constraints bar on `{#key session.loadedDate}`;
  its auto-open condition is unchanged.
- business/AGENTS.md — a composed read reads each store once, the rule the
  widened read follows.
- `scripts/generate-fixture.mjs` — disqualified for the probe's class of
  question.

## Decisions

- **Only budgeted days count in the fold** — a stored day the user never
  budgeted is not evidence of a habit, and folding those in drags every median
  toward the 0 this replaces.
- **One field, not two** — the trap was real and it took one field.
  `#availableHours` is `number | null` instead of a number beside a
  `#prefilled` flag, and `null` IS "this day has no hours of its own". The
  dirty test reads the raw field, so a merely-browsed day still writes no
  record; the payload reads the effective getter, so a day saved for a reason
  of its own records the budget it was showing. The setter clears the flag by
  assigning a number, which is the whole of "cleared on the first user edit".
  Rejected: a separate `#prefilled` flag excluded from the autosave's dirty
  test (R3 — a flag beside a number is free to drift, and nothing in either
  says the two agree).
- **Derived, not assigned** — the prefill is a `$derived` off the fold plus the
  viewed day, so every later day (a navigation, the midnight tick, the banner's
  retry re-reading) answers without a second read. Two things fell out of
  deriving rather than assigning it; this is the first.
- **0 on a past day** — the second thing that fell out. A day the user did not
  plan has no budget, and back-filling one would be a claim about their
  history.
- **The boot read is awaited before the day is presented** — item 15's "do not
  await the history read" no longer covers this read, and a review caught the
  display losing that race. `#boot` now starts it right after
  `initializeStorage()` and awaits it before `#loadSession`, so it overlaps the
  routines and flow reads and the day lands with its hours already known.
  Deriving cannot fix this on its own: `+page.svelte` remounts the constraints
  bar on `{#key session.loadedDate}` and `DayConstraintsBar` snapshots `isOpen`
  at mount, so a day presented before its budget opens the panel against 0 and
  then fills in behind it. The read still feeds a form nobody has opened yet —
  it just also feeds the day on screen, which is what changed.
- **The read's failure surface is unchanged** — caught, logged, never bannered.
  The catch is what lets `#boot` await it without a failed prefill taking the
  day down.
- **One read, two folds** — `readTitleRatings` was widened to
  `readHistoryPrefills(today)` → `{ titleRatings, budgets }`. Rejected: a
  second whole-history scan beside it, because business/AGENTS.md says a
  composed read reads each store once. A test pins the single transaction.
- **Ship without the probe** — on item 15's precedent, because its gate is
  answerable only from a real exported history that does not exist on the
  author's machine, and `scripts/generate-fixture.mjs` is disqualified for
  exactly this class of question. The consequence is stated rather than
  hidden: run the gate the moment a backup exists, and if the weekday median
  turns out to be no better than 0, the honest move is to delete this rather
  than to tune it.
- **`moveTaskToTomorrow` writes the destination day's prefill, not 0** — a
  defer is that day being saved for a reason of its own, the same rule the
  auto-save payload follows. A hard 0 there made the destination a **stored**
  day that no prefill may then speak for, which is the "a deferred task lands
  in an unplanned day" symptom this item claims to remove and the prereq item
  21 declares. It was also drift this change would have created: "unset" is
  `null` in memory, and that write was the one place it stayed 0.

## Open questions

The probe's gate is unmeasured: weekday median vs real `availableHours`, kill
if MAE > 1.5 h. Run it the moment a real exported history exists.
