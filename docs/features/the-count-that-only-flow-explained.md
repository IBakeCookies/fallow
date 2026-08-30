# The count that only flow explained

**Kind:** feature · **Status:** landed 2026-08-30 · **Roadmap:** item 33

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A user who logs a ☕ or a 🪫 today can see, on analytics' "Your model" card, that
the log was read and held for tomorrow. Today it is silent: only the ϕ row names
its deferred logs, so the other four rows' counts sit still after a log and read
as a log that was dropped.

## Scenarios

The four rows are Recovery rate (☕), Cognitive drain rate (🪫), Physical drain
rate (🪫) and Free-time value (finished days). The first three name a row count;
the fourth names a day, because that is the unit its fit reads.

### Scenario — a ☕ logged today is named on the Recovery rate row

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** a snapshot whose `energy.pendingRestCount` is 1
- **When** `calibrationRows` builds the rows
- **Then** the Recovery rate row's note ends `· 1 ☕ logged today, counted from tomorrow`

### Scenario — a 🪫 logged today is named on the Cognitive drain rate row

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** a snapshot whose `energy.pendingDrainCount` is 2
- **When** `calibrationRows` builds the rows
- **Then** the Cognitive drain rate row's note ends `· 2 🪫 logged today, counted from tomorrow`

### Scenario — the same 🪫 is named on the Physical drain rate row

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** the same snapshot, `energy.pendingDrainCount` 2
- **When** `calibrationRows` builds the rows
- **Then** the Physical drain rate row's note ends `· 2 🪫 logged today, counted from tomorrow`

### Scenario — today's work is named on the Free-time value row

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** a snapshot whose `stopping.todayPending` is true
- **When** `calibrationRows` builds the rows
- **Then** the Free-time value row's note ends `· today counts from tomorrow`

### Scenario — a row with nothing deferred keeps the note it prints today (pin)

`src/lib/presentation/utils/calibration-descriptor.test.ts`

- **Given** a snapshot with `pendingRestCount` 0, `pendingDrainCount` 0 and
  `todayPending` false
- **When** `calibrationRows` builds the rows
- **Then** the four notes are byte-identical to the strings the file's existing
  fitted/unfitted cases already assert

### Scenario — today's ☕ is deferred, and counted from tomorrow

`src/lib/business/session-history.test.ts`

- **Given** one rest log dated today and one dated yesterday
- **When** `readModelReport` runs for today
- **Then** `calibration.energy.pendingRestCount` is 1

### Scenario — the same ☕ is pending on no later day

`src/lib/business/session-history.test.ts`

- **Given** the same two rest logs
- **When** `readModelReport` runs for tomorrow
- **Then** `calibration.energy.pendingRestCount` is 0

### Scenario — today's 🪫 is deferred

`src/lib/business/session-history.test.ts`

- **Given** two drain logs dated today and one dated yesterday
- **When** `readModelReport` runs for today
- **Then** `calibration.energy.pendingDrainCount` is 2

### Scenario — a day that will become a stop observation says so

`src/lib/business/session-history.test.ts`

- **Given** a stored session dated today with one task and `availableHours` 6,
  and a 🪫 log dated today with `hours` 2
- **When** `readModelReport` runs for today
- **Then** `calibration.stopping.todayPending` is true

### Scenario — a 🪫 logged against no usable day promises nothing

`src/lib/business/session-history.test.ts`

- **Given** a 🪫 log dated today with `hours` 2 and no stored session for today
- **When** `readModelReport` runs for today
- **Then** `calibration.stopping.todayPending` is false

### Claim — the λ₀ fit still reads no day dated today (pin)

`src/lib/business/session-history.test.ts`

- **Given** the qualifying-day state above, and the same store with today's
  session and 🪫 log absent
- **Then** `calibration.stopping.usedCount` is equal across the two reads
- **Then** `calibration.stopping.value` is equal across the two reads

### Claim — the composed read still opens no extra transaction (pin)

`src/lib/business/session-history.test.ts`

- **Given** the existing transaction-counting case, which spies on
  `IDBDatabase.prototype.transaction` around one `readModelReport`
- **Then** its `toBeLessThanOrEqual(5)` bound still holds with the widened
  finished-day range

## Out of scope

- **The Energy Lab.** Its α and r cards already name their pending logs, and its
  Stopping Calibration card is not part of this item.
- **`/`'s flow calibration card.** It already has `model_status_pending`.
- **What any fit reads.** Every count here is display; the causal window,
  `readFinishedDays`' predicate and all five fits are untouched.
- **Splitting the drain count per reservoir.** Both α fits read the same 🪫 rows
  (`toCognitiveDrainObservations` / `toPhysicalDrainObservations` map the same
  records), so the two rows name the same number. Two numbers would be a lie.
- **Counting only _informative_ pending rows.** Pending is a raw row count, as
  ϕ's already is — a row's informativeness is the fit's verdict, not a promise
  to make before it has read it.
- **A `_one` singular variant per key.** The ϕ row's pending clause has none and
  reads correctly at 1; these follow it.

## Read before building

- `src/lib/business/session-history.ts` — `CalibrationSnapshot`,
  `calibrationSnapshotFrom`, `readFinishedDays`, `toStopObservations`,
  `toPlanAuditDays`, `readModelReport`. `UserFit.pendingCount` is the shape the
  three new counts copy, and its docblock already states the obligation this
  item discharges.
- `src/lib/presentation/utils/calibration-descriptor.ts` — `calibrationRows`;
  the ϕ row's `flow.pendingCount > 0` branch is the pattern the four rows take.
- `src/lib/presentation/utils/calibration-descriptor.test.ts` — the `unfitted`
  and fitted fixtures gain the new fields.
- `src/lib/business/session-history.test.ts` — the ϕ pending case
  (`sameDay.pendingCount` / `nextDay.pendingCount`) is the model for the four
  new business scenarios, and holds the transaction pin.
- `src/lib/business/store/analytics-store.svelte.spec.ts` — mocks the whole
  `readModelReport` shape; the new fields go into every mocked snapshot.
- `src/lib/business/model/energy-calibration.ts` — `EnergyCalibration`, and why
  the two α fits share one row set. Not edited: the counts are added at the
  composition boundary, not in the model.
- `src/lib/business/AGENTS.md` — "A composed read reads each store once", which
  the widened range must not break, and the causal-fit-window section, whose
  last sentence names the Lab's _two_ pending counts and is what this change
  makes incomplete. Correct it in the landing commit (AGENTS.md §0: a rule your
  change makes false is fixed in the diff that found it).
- `messages/en.json` plus `de`, `es`, `fr`, `zh` — `ana_model_note_ratings`,
  `ana_model_note_days`, `ana_model_note_flow_pending` are the neighbours the
  three new keys are written against.
- [ROADMAP.md](../../ROADMAP.md) item 33 — collapse to a date and a link to this
  file at land.

No MATH.md section changes: no formula, constant, bound or fit moves. (MATH.md
ends at §9; the causal window is documented in `business/AGENTS.md`, not in a
MATH.md section, whatever older notes cite.)

## Decisions

- **The unit is the emoji, not the fit's own unit** — the pending clause reads
  `1 ☕` and `2 🪫`, the raw rows the user created. Rejected: "breaks" and
  "ratings", because the Recovery row's `usedCount` counts _informative
  reservoir observations_ (up to two per ☕, and fewer when a reservoir was rated
  0 before the break), so "2 ratings logged today" beside "8 ratings" would
  promise a contribution the fit has not agreed to, and "1 break" beside "8
  ratings" puts two silent units on one line. The emoji is what was logged, is
  unarguable, and is already this card's vocabulary (`ana_model_hint`,
  `ana_model_note_flow`).
- **The Free-time value row names a day, and prints no number** — it is 0 or 1
  by construction, since the only date that can be deferred is today. So the
  snapshot carries `stopping.todayPending: boolean`, not a count that can never
  reach 2. Rejected: a `number` for parallelism with the other three, because a
  count with one reachable non-zero value is a shape that lies about its range.
- **The day is only promised when it will actually qualify** — `todayPending` is
  true only if today passes `readFinishedDays`' whole predicate (a 🪫 log with
  `hours > 0`, and a stored session with tasks and `availableHours > 0`).
  Rejected: "any 🪫 logged today", because a log against a deleted task or a
  zero-hour day would promise an observation that never arrives.
- **One read, by widening the existing one** — call `readFinishedDays` with
  tomorrow's date, then split the result on `session.date < today`: the past
  days feed `toStopObservations`, `toPlanAuditDays` and
  `recordedFitRangeStart` exactly as now, and the remainder (0 or 1) is
  `todayPending`. Rejected: a second `readFinishedDays(addDays(today, 1), …)`
  call, because `business/AGENTS.md`'s "a composed read reads each store once"
  bans the extra session scan, and a hand-rolled today-qualifies predicate,
  because it would be a second definition of the same join (R3).
- **The counts sit beside the fit they belong to, via an intersection at the
  composition boundary** — `CalibrationSnapshot.energy` becomes
  `EnergyCalibration & { pendingRestCount: number; pendingDrainCount: number }`
  and `.stopping` becomes `StoppingValueFit & { todayPending: boolean }`, so the
  descriptor reads `energy.pendingRestCount` next to `recovery.usedCount` the
  way it already reads `flow.pendingCount` next to `flow.usedCount`. Rejected:
  a sibling `pending: { rest, drain, stopDays }` block, because it splits one
  concept across two places while ϕ's stays on its leg; and adding the fields to
  `EnergyCalibration` / `StoppingValueFit` themselves, because a causal-window
  bookkeeping count is not the model's business (R1's direction of travel).
- **Three message keys, not five** — `ana_model_note_recovery_pending`,
  `ana_model_note_drain_pending`, `ana_model_note_days_pending`, each a whole
  sentence like `ana_model_note_flow_pending` rather than a suffix composed onto
  the base note in code. Rejected: composing `base + " · " + suffix`, because
  the repo's existing pending copy is whole-sentence and a translator cannot see
  the joined result.

## Open questions

None.
