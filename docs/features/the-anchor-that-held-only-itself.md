# The anchor that held only itself

**Status:** landed 2026-08-22 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The day stops carrying a start time. `/` loses the **Day Starts** field, the
strip loses its `from 09:00` label, and `DailySession` loses the key behind
both, so no screen in Fallow prints a time of day.

[the-plan-that-had-no-clock.md](the-plan-that-had-no-clock.md) added the field
earlier the same day, to give the strip the clock the redesign artboards drew.
Two things had already gone before it landed: the finish time, because
`availableHours` is the hours a user intends to _work_ (MATH.md §11.3) and a
clock read off it omits every break; and the label on a day that stored no
start, because a default is the field's answer and not the day's. What was left
was a stored, sanitized, per-day, backed-up field whose only reader was one
label beside it — which its own hint text said out loud. A label anchored to
nothing is not an anchor.

Every duration on the strip is now an offset from the day's own zero, which is
the only reading the model has.

## Scenarios

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

One observable per line, no `and` — a line with a conjunction cannot come back
half-true. Every scenario names the file its test lands in, at the level
`docs/testing.md`'s table picks.

### Scenario — today's strip prints no time of day

`e2e/time-budget.e2e.ts`

- **Given** today, a fresh profile, one task, an 8 h budget
- **When** the page loads
- **Then** the strip prints no `HH:MM` anywhere

### Scenario — a past day's strip prints none either

`e2e/day-navigation.e2e.ts`

A past day is the case the field could never answer for: it has no field, so
while the label existed a past day either printed a start nobody could correct
or printed nothing.

- **Given** a past day loaded by date, holding one task and a budget
- **When** the page loads
- **Then** the strip prints no `HH:MM` anywhere

### Scenario — ticking a task off on a past day leaves the day's budget alone

`e2e/day-navigation.e2e.ts`

The reason this scenario outlives the field it was written for: three sites
write a day as a WHOLE record, so every field the payload does not carry is a
field it erases (`business/AGENTS.md`). `startHour` fell into that trap and is
how it was found; the budget the strip is drawn against sits in the same one.

- **Given** a past day holding one funded task, reloaded after the tick
- **When** its task is marked complete
- **Then** the strip still draws that task's block

### Scenario — a task moved to tomorrow keeps tomorrow's own plan

`src/lib/business/store/session-store.svelte.spec.ts`

- **Given** tomorrow already stored with its own budget and switch cost
- **When** a task is moved to tomorrow
- **Then** the destination write still carries both

### Scenario — a day stored while the strip had a clock loads without one

`src/lib/business/model/persisted.test.ts`

This is the whole migration. `sanitizeSession` builds a session from a fixed
field list, so a stored key it no longer names is dropped on the way in and the
next write persists the day without it. `sanitizeTask`'s `flowMinutes` test is
the same argument one level up.

- **Given** a stored session carrying `startHour: 7`
- **When** it is sanitized
- **Then** the returned session has no `startHour`

### Scenario — the constraints panel reads its four fields

`src/lib/presentation/component/day-constraints-bar.stories.svelte`

- **Given** the panel expanded on a day with a budget, a switch cost and both
  pools
- **When** the story renders
- **Then** each of the four fields reads its own value

## Out of scope

- **A time of day anywhere else.** MATH.md §8.3's circadian boundary stays
  settled as "rejected until there is an instrument", and this change brings
  none — it removes the only field that looked like one without being one. The
  one time-of-day instrument the data does carry is the `createdAt` stamp on 🪫
  logs (§36), which is untouched.
- **The strip itself, and its floor.** The blocks, the run order, the switch-cost
  gaps, the flow bars and the scroll floor
  ([the-sentence-the-narrow-block-drops.md](the-sentence-the-narrow-block-drops.md))
  are all unchanged. Only the label above them goes.
- **A stored-data migration.** See the scenario above: the sanitizer's shape
  makes one unnecessary, so no version stamp and no rewrite pass.
- **The artboards.** `docs/redesign/Main.dc.html` and its siblings still draw
  `09:00 → 17:15`. They are dated artboards, not a spec of what ships;
  `docs/redesign/README.md`'s Settled section is where the divergence is
  recorded.

## Read before building

- `src/lib/presentation/utils/duration-format.ts` — `formatOffset` stays,
  `formatClock`/`parseClock` go: the strip's label was their only caller
- `src/lib/presentation/utils/day-timeline.ts` — `startLabel` off the view
  model, `startHour` off its input
- `src/lib/presentation/component/day-constraints-bar.svelte` — the field, and
  the `lg:grid-cols-5` that drops to four
- `src/lib/data/type/index.ts` — `DailySession.startHour`
- `src/lib/business/model/persisted.ts` — the sanitizer's clamp, and
  `HOURS_IN_DAY` with it
- `src/lib/presentation/utils/budget-bounds.ts` — `DEFAULT_START_HOUR`
- `src/lib/business/store/session-store.svelte.ts` — the `number | null`
  accessor the pristine-day check needed
- `src/lib/business/AGENTS.md` — the destination-write rule the field was the
  worked example for; the rule stays, the example changes
- MATH.md §11.3 — `availableHours` as intended work, which is why no clock can
  be derived from it

## Decisions

- **The whole chain goes, not just the label.** A stored key with no reader is
  worse than no key: it rides every backup and every whole-record write, and the
  next feature to want a day-start would find a field already there carrying
  values nothing had validated against its own new use. Rejected: keeping
  `DailySession.startHour` unread for a future circadian model — §8.3 is
  rejected until there is an instrument, and a field is not an instrument.
- **The removal writes its own feature file rather than editing the
  addition's.** [the-plan-that-had-no-clock.md](the-plan-that-had-no-clock.md)
  is frozen at land and stays the true record of what shipped on its date,
  including every scenario this change deletes. Reading the two in order is the
  history; editing the first would erase it.
- **No test pins the field's absence.** A deleted control needs none, and here
  it could not have one: all three keys go from all five locales —
  `budget_day_start`, its `_hint` (which is where the field admitted no formula
  read it) and `day_timeline_start` — so a test naming that label has no message
  to name it by. The scenarios above assert what the screens now print, which is
  the observable that matters.
- **`formatOffset` keeps its comment, minus one clause.** It explained itself by
  contrast with `formatClock` — "the MODEL has no notion of when the day begins
  (the session does)". The parenthesis is what stopped being true, so the
  parenthesis is what was deleted; the rest of the sentence is the reason the
  function exists.
- **The e2e that pinned the destination-write trap is rewritten, not deleted.**
  It found a real bug once, and the trap it was aimed at is a property of the
  three write sites rather than of `startHour`. It now watches the budget
  through the same sequence.

## Open questions

None.
