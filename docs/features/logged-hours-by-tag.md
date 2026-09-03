# Logged hours by tag

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

A task can carry tags the user types (`exercise`, `school`, `self care`), and
the analytics screen breaks the range's logged hours down by them — so "where
did my week go" has an answer instead of one total. Nothing about the plan
changes: a tag enters no formula, funds nothing, and the allocator never sees
it.

## Scenarios

### Scenario — tagging a task while adding it

`task-form.stories.svelte` (play)

- **Given** the add-task form with an empty draft
- **When** the user types `exercise` in the tag field and presses Enter
- **Then** a chip reading `exercise` appears in the form

### Scenario — a second tag on the same task

`task-form.stories.svelte` (play)

- **Given** the add-task form with one committed chip `exercise`
- **When** the user types `self care,`
- **Then** a second chip reading `self care` appears beside the first

### Scenario — removing a tag before submitting

`task-form.stories.svelte` (play)

- **Given** the add-task form with a committed chip `exercise`
- **When** the user activates that chip's remove control
- **Then** no chip remains in the form

### Scenario — the tag field offers tags used before

`task-form.stories.svelte` (play)

- **Given** a form whose tag vocabulary is `['exercise', 'school']`
- **When** the tag field renders
- **Then** its `<datalist>` holds an option for `school`

### Scenario — a task's tags are editable after the fact

`task-edit-form.stories.svelte` (play)

- **Given** a task row opened for editing, tagged `school`
- **When** the user removes that chip and commits `exercise`
- **Then** the submitted edit carries `['exercise']`

### Scenario — the card names each tag's logged hours

`tag-hours-card.stories.svelte` (play)

- **Given** a range holding 🪫 logs of 2 h on a task tagged `exercise` and 5 h on a task tagged `school`
- **When** the card renders
- **Then** the `exercise` row reads 2 h

### Scenario — the tags are ordered by hours, most first

`tag-hours-card.stories.svelte` (play)

- **Given** that same range
- **When** the card renders
- **Then** `school` is listed above `exercise`

### Scenario — logged hours on untagged tasks are shown, not hidden

`tag-hours-card.stories.svelte` (play)

- **Given** a range holding a 3 h 🪫 log on a task carrying no tags
- **When** the card renders
- **Then** an untagged row reads 3 h

### Scenario — nothing logged in range says so

`tag-hours-card.stories.svelte` (play)

- **Given** a range with no 🪫 logs
- **When** the card renders
- **Then** the card says no hours were logged in this range

### Scenario — the breakdown follows the range the page is on

`e2e/task-tags.e2e.ts`

- **Given** an analytics screen on `week` with a tagged 🪫 log 20 days back
- **When** the user switches the range to `month`
- **Then** that tag's row appears in the card

### Scenario — a tag reaches the card from the day it was typed on

`e2e/task-tags.e2e.ts`

- **Given** a fresh profile
- **When** the user adds a task tagged `exercise`, logs 1 h of 🪫 against it, and opens analytics
- **Then** the card's `exercise` row reads 1 h

### Scenario — a routine remembers its tasks' tags

`session-store.svelte.spec.ts`

- **Given** a day holding one task tagged `exercise`
- **When** the day is saved as a routine and applied to an empty day
- **Then** the applied task carries `['exercise']`

### Scenario — importing a day carries its tags

`session-store.svelte.spec.ts`

- **Given** a stored day holding one task tagged `exercise`
- **When** `importFromDate` imports it into the viewed day
- **Then** the imported task carries `['exercise']`

### Scenario — deferring a task carries its tags

`session-store.svelte.spec.ts`

- **Given** a task tagged `exercise` on the viewed day
- **When** `moveTaskToTomorrow` moves it
- **Then** tomorrow's copy carries `['exercise']`

### Claim — the breakdown adds up to the tile above it

`src/lib/business/model/tags.test.ts`

- **Given** any drain rows whose tasks carry at most one tag each
- **Then** the tag hours plus the untagged hours equal `loggedHours(drain, rangeStart)`

### Claim — a two-tag task's hours count once under each tag

`src/lib/business/model/tags.test.ts`

- **Given** a 2 h drain row on a task tagged `exercise` and `self care`
- **Then** both tags read 2 h

### Claim — one definition of "the same tag"

`src/lib/business/model/tags.test.ts`

- **Given** three days tagging one thing three ways: `Exercise`, `EXERCISE`,
  and `exercise` typed with a leading and a trailing space
- **Then** the fold returns one row

### Claim — the same rows `loggedHours` counts, and no others

`src/lib/business/model/tags.test.ts`

- **Given** drain rows before `rangeStart`, rows with `hours <= 0`, and rows in range
- **Then** only the in-range positive-hour rows contribute

### Claim — a log whose task is gone reads as untagged

`src/lib/business/model/tags.test.ts`

- **Given** a drain row whose `taskId` is absent from that date's session
- **Then** its hours land in the untagged row, not dropped

### Claim (pin) — the total the card breaks down does not move

`src/lib/business/model/metric/history.test.ts`

- **Given** the existing `loggedHours` fixtures
- **Then** `loggedHours` returns what it returns today

## Out of scope

- **Hour targets of any kind** — no "20 h of exercise this week", no goal
  state, no progress bar, no nudge. See the first Decision: the numerator is
  opt-in, so a target would grade logging diligence. A target is its own spec,
  and only after the untagged row shows the gap is small.
- **Tags in the objective.** No weight, no per-tag reserved hours, no run-order
  effect, no plan-advice lever. `Σ vᵢ·P̄ᵢ(tᵢ)` is untouched and the energy mode
  never reads a tag.
- **Tags on the title memory.** Picking a remembered title fills the three
  sliders (ROADMAP items 15 and 24) and will not fill tags. It is a change to
  `TitleRating` and to what a pick means, so it is a separate spec — the
  `<datalist>` is what "with suggestions" buys here.
- **A fixed tag vocabulary.** No shipped preset list; the user's own past tags
  are the only vocabulary.
- **Tags snapshotted onto the 🪫 record.** The join is by `date` + `taskId`
  against the stored day, so a re-tag re-attributes past hours. See Decisions.
- **Tags on the calendar screen, in the plan, or on a task row outside the
  forms.** The reading lives on analytics only.
- **A tag filter anywhere.** The card lists; it does not select.
- **Year.** The card follows the page's existing range selector, so `year`
  works because it already exists — no work is done to make it say anything.

## Read before building

- `src/lib/data/type/index.ts` — `Task`; add `tags?: string[]`, next to
  `importance` and for the same reason (a property of the task, not of today).
  Optional, so no migration: `importance` is the precedent.
- `src/lib/data/AGENTS.md` — the persisted-shape rules the new field is added
  under, and the settled decisions it must not disturb.
- `src/lib/business/model/persisted.ts` — `taskCore` is where `importance` sits
  "so routines and day-imports carry the level"; tags go there, not in
  `sanitizeTask`. Normalize, dedupe and drop empties here, and omit the field
  entirely when nothing survives.
- `src/lib/business/model/title-memory.ts` — the module shape to copy:
  `normalizeTitle` + a pure fold over `DailySession[]`, one concept per file.
  `normalizeTag` is the tag half of that (AGENTS.md R3).
- `src/lib/business/model/metric/history.ts` — `loggedHours` is the total this
  card breaks down; the new fold must match its row filter exactly, or the two
  numbers on one screen disagree.
- `src/lib/business/model/energy-calibration.ts` — `rankDrainByTask` is the
  precedent for folding `#drain` over a range, and records why it keys on the
  frozen `taskTitle` rather than `taskId`. Read it before choosing the join
  key; the reason does not apply here (see Decisions).
- `src/lib/business/session-history.ts` — `readHistoryPrefills` is the one boot
  scan over all stored days; the tag vocabulary is another fold off it, not a
  second read. `readDaySummaries` and `readModelReport` already hand analytics
  the sessions and the drain rows the join needs.
- `src/lib/business/store/session-store.svelte.ts` — five explicit task-field
  lists must carry `tags`: `addTask`'s parameter, `updateTask`'s `Pick`,
  `importFromDate`'s map, `saveRoutine`'s map and `moveTaskToTomorrow`'s
  `moved`. Missing one is a silent drop, which is what the three store
  scenarios pin.
- `src/lib/business/store/analytics-store.svelte.ts` — `ANALYTICS_RANGES`,
  `#range`, `#rangeStart`, `#drain` and `#all` (`DaySummary` carries the full
  `Task[]`). Everything the fold needs is already in the store: no new read,
  no new toggle.
- `src/lib/business/AGENTS.md` — the store rules, and where a new public store
  getter is priced.
- `src/lib/presentation/component/task-form.svelte`,
  `task-form-fields.svelte`, `task-edit-form.svelte` — `TaskEdit` is the shared
  draft shape; the tag control belongs in `task-form-fields.svelte` so both
  forms get it once.
- `src/lib/presentation/AGENTS.md` — the two-task-screens rule and the table of
  which module holds which policy.
- `src/routes/(app)/analytics/+page.svelte` — the card order and the gating
  comment above the full-width cards; the new card sits with the ranged
  readings, not with the two fit cards that ignore the range.
- `src/lib/presentation/style/STYLE.md` — `card-shell`, the token rules, and
  when a repeated class cluster becomes a `@utility`.
- `docs/testing.md` — the level table the scenarios above were picked from, and
  the reviewer rule: a persisted shape gets a full pass.
- `messages/en.json` plus `de`, `es`, `fr`, `zh` — every string here is new.
- ROADMAP.md Phase 6 item 9 — "weekly retrospective digest" is adjacent and
  stays open: it is the plan-adherence audit and the calibration snapshot per
  week, which this does not touch. Do not renumber it and do not mark it
  shipped.
- ROADMAP.md "considered on 2026-08-04 and not proposed" — the ρ entry
  ("worked hours come only from opt-in 🪫 logs … at most one display line
  phrased as logged vs declared") and the **reserved hours per task** entry.
  Both bound this feature; read them before adding anything the Out of scope
  section forbids.
- No MATH.md section. `loggedHours` has none, and a `groupBy` sum over rows the
  model already defines adds no formula, constant or bound.

## Decisions

- **Logged hours only, and no target.** The numerator can only come from opt-in
  🪫 logs (`loggedHours`, and `readFinishedDays` skips `hours <= 0`), so a
  target would read 40% for a user who exercised 20 h and logged 8 — a measure
  of logging diligence that under-reads in one direction and never
  self-corrects. Rejected: a declared weekly target shown as logged-vs-declared,
  which ROADMAP's ρ entry does permit as a display line — deferred until the
  untagged row shows the coverage is worth grading. Rejected: a target that
  reaches plan advice, which is the shape of the settled **reserved hours per
  task** and **adherence as an objective term** refusals one level up.
- **The untagged row IS the coverage disclosure.** An explicit untagged row
  costs nothing extra and states the gap in the card's own units. Rejected: a
  separate coverage percentage, which is a second number saying the same thing;
  rejected: dropping untagged hours, which makes the card silently disagree
  with the total above it.
- **Join by `date` + `taskId` against the stored day, not by a snapshot on the
  🪫 record.** A tag is a label, not a measurement, so the reason E/β and the
  reservoir demands are frozen at log time does not apply — freezing would mean
  fixing a typo never fixes the past. `rankDrainByTask` keys on the frozen
  `taskTitle` because its fit spans days and each day's routine instance has a
  fresh id; this fold is per-day, so the id join is available and exact.
  Consequence, accepted: re-tagging a task re-attributes its past hours.
  Rejected: adding `tags` to `DrainObservationRecord`, which costs a schema
  change and a migration for a worse answer.
- **The card follows the page's range selector.** `ANALYTICS_RANGES` already
  holds week/month/year and `AnalyticsStore` already holds `#range`, so
  "switchable week and month" is the existing control. Rejected: a per-card
  toggle, which would let one card disagree with the tile above it.
- **Many tags per task, and a two-tag hour counts under both.** So the column
  does not sum to the total, which is why the sum-identity Claim is stated for
  single-tag tasks only. Rejected: one tag per task, which sums cleanly but
  forces a choice on a task that is genuinely two things; rejected: splitting an
  hour across a task's tags, which invents a weighting nobody declared.
- **One tag field with a native `<datalist>`, committing a chip on Enter or
  comma.** Native suggestion behaviour, including keyboard, for no code.
  Rejected: a custom combobox like the title suggestions, whose keyboard nav,
  active-option tracking and ARIA wiring are the bulk of `task-form.svelte`
  and buy nothing here; rejected: a plain comma-separated text field, where a
  `<datalist>` matches the whole value and so never offers anything.
- **`tags` is absent unless non-empty, never `[]`.** Matches `mustDoToday` and
  `importance`: a stored empty array is a claim where there is none, and every
  reader would have to handle both spellings.
- **No new store spec.** The analytics getter is a pass-through to a pure fold
  with its own tests, and the wiring is what the two e2e scenarios exercise.
  The three `session-store.svelte.spec.ts` scenarios exist because a dropped
  field there is invisible at every other level.

## Open questions

None.
