# Chronic-slide badge

**Kind:** feature · **Status:** landed 2026-08-21 · **Roadmap:** item 22

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On `/`, a task that has been on the list for three days or more carries a badge
naming which day it is on — `DAY 4`, `DAY 12` — so a task the user keeps
sending to tomorrow says so on its own row instead of looking like a task added
this morning.

## Scenarios

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

One observable per line, no `and` — a line with a conjunction cannot come back
half-true. Every scenario names the file its test lands in, at the level
`docs/testing.md`'s table picks.

### Scenario — a task carried for three days names the day it is on

`src/lib/presentation/component/task-list.stories.svelte`

- **Given** a list viewed on `2026-07-23`, holding a task with
  `createdAt: '2026-07-20'`
- **When** the list renders
- **Then** that task's row shows a badge reading `DAY 4`

### Scenario — a task added on the day in view is not badged

`src/lib/presentation/component/task-list.stories.svelte`

- **Given** the same list, holding a second task with `createdAt: '2026-07-23'`
- **When** the list renders
- **Then** that task's row shows no slide badge

### Scenario — a task carried for two days is not badged

`src/lib/presentation/component/task-list.stories.svelte`

- **Given** the same list, holding a third task with `createdAt: '2026-07-21'`
- **When** the list renders
- **Then** that task's row shows no slide badge

### Scenario — a finished task keeps the badge

`src/lib/presentation/component/task-list.stories.svelte`

- **Given** the same list, holding a task with `createdAt: '2026-07-20'` and
  `completed: true`
- **When** the list renders
- **Then** that row shows the same `DAY 4` badge

### Scenario — the badge explains itself

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** a row rendered with `slideDay: 6`
- **When** the badge is hovered
- **Then** its tooltip text is visible

### Scenario — the badge is a tooltip trigger

`src/lib/presentation/component/task-item.stories.svelte`

- **Given** the same row
- **When** the story asserts on the badge element
- **Then** it carries `data-slot="tooltip-trigger"`

### Claim — the gate and the number are one function

`src/lib/presentation/utils/slide-age.test.ts`

- **Given** `getSlideDay(createdAt, viewedDate)` over ISO date pairs
- **Then** an age of 3 days returns `4`
- **Then** an age of 2 days returns `null`
- **Then** an age of 0 days returns `null`
- **Then** a negative age — `createdAt` after `viewedDate` — returns `null`
- **Then** an age of 30 days returns `31`
- **Then** the returned number is always the age plus one, for every age at or
  above the gate

### Claim — a corrupt stored `createdAt` reads as the session's own day

`src/lib/business/model/persisted.test.ts`

- **Given** a stored task whose `createdAt` is the string `'banana'`
- **Then** `sanitizeTask(raw, '2026-07-01')` returns `createdAt: '2026-07-01'`

### Claim (pin) — a defer carries `createdAt` across the day boundary

`src/lib/business/store/session-store.svelte.spec.ts`

Goes green on its first run: it pins today's behaviour, which is the whole
reason the badge can count at all.

- **Given** a task added today, then `moveTaskToTomorrow`
- **Then** the task written into tomorrow's session carries the same
  `createdAt` as the one it replaced

### Claim (pin) — an import restamps `createdAt` to the day in view

`src/lib/business/store/session-store.svelte.spec.ts`

Also a pin, and it is the honest limit the tooltip states: slide age accrues
along the deliberate "To tomorrow" path only.

- **Given** a task drafted from another day, imported onto the viewed day
- **Then** the imported task's `createdAt` is the viewed day, not the day it
  was copied from

## Out of scope

What was considered and deliberately left out. This is the section that stops
the implementer helpfully building more than was asked (AGENTS.md §0).

- **`/energy`.** The Lab's row reads the schedule; slide age is a planning
  fact. `energy-task-row.svelte` and `task-row-shell.svelte` are untouched, so
  the badge lives in `task-item.svelte`'s `lead` snippet — one screen's reading
  of the task, which is exactly what that component is for
  (presentation/AGENTS.md, "R3 in the UI").
- **Anything about funding.** The badge says age and nothing else. It does not
  read `suggestedHours`, `unfundedTaskIds` or the plan; it does not change hue,
  copy or weight when the plan gave the task nothing. `/` already groups
  unfunded rows under "No time today", so today's funding is on screen
  already, once, in the place that owns it.
- **Any effect on the model.** No objective term, no `mustDoToday`, no ordering
  input, no priority nudge. It stays a badge — the ceiling ROADMAP item 22 sets
  itself, because both alternatives re-open MATH.md §14 (the flag promises the
  day, not the hours).
- **An e2e test.** The user-visible flow is four days of deferrals, and every
  step of it is already pinned closer to home: the two pins above hold the
  data path, the util test holds the arithmetic, the story plays hold the
  render. An `e2e/*.e2e.ts` would fabricate four days of IndexedDB to re-prove
  the same three things.
- **Counting deferrals rather than days.** Age is calendar arithmetic off one
  stored field. Counting moves would be a new persisted counter, an R8
  question, and a different claim.
- **`text-*-strong` on the row's badges.** Reported, not fixed (AGENTS.md §0):
  the four badges already in that row use the bare token as text on a `/20`
  tint (`bg-warning/20 text-warning`, `bg-mind/20 text-mind`), where STYLE.md's
  three-roles rule asks for `-strong`. The new badge matches the four it sits
  beside; making all five right is its own change.
- **A composite `@utility` for the badge cluster.** The
  `border-transparent uppercase tracking-wide` trio on `<Badge>` predates this
  change in three places. Extracting it is a refactor with no behaviour change,
  which is `/refactor`.

## Read before building

The routing — the exact files and sections, not the areas. This is what keeps
the implementer's context small: it reads these and nothing else.

- `ROADMAP.md:375-386` — item 22, whose text is **wrong on one of its three
  premises** and must be corrected in the landing commit (see Decisions). It
  also carries the hard ceiling and the `importTasks` limit, both of which
  stand.
- `src/lib/business/utils/date.ts:42` — `daysBetween`, noon-anchored so a DST
  boundary inside the span cannot round a 23- or 25-hour day to the wrong
  count. This is the whole of the age arithmetic; do not write date math.
- `src/lib/business/model/persisted.ts:62-64` — `isoDate`, the unused helper
  the fix applies; `:82-99` — `sanitizeTask`, whose `createdAt` line is the
  one-line change. Its docstring already says "`createdAt` falls back to the
  session's own date" and stays true.
- `src/lib/business/model/metric/calculation.ts:123` — `SuggestedTask` is
  `Task & {…}`, so `createdAt` is already on every row the list renders. No new
  read, no new field, no store change.
- `src/lib/presentation/component/task-item.svelte:104-137` — the `lead`
  snippet, where `#N`, the nature badge and "Stays today" already sit. The new
  badge goes after the must-do one.
- `src/lib/presentation/component/task-list.svelte:108-152` — `taskRows`, which
  is where `getSlideDay` is called, the way `runOrder` is already looked up per
  row.
- `src/routes/(app)/+page.svelte:46` — `selectedDate`, the value passed down as
  `viewedDate`.
- `src/lib/presentation/utils/task-nature.ts` — the shape a new
  presentation-policy module in that folder takes: messages read per call so
  the badge follows a locale switch, tokens named semantically.
- `src/lib/presentation/AGENTS.md` — "R3 in the UI", "The row's layout" (every
  reading keeps its tooltip; a reading triggers on itself) and the
  presentation-utils row of the R2 table. **Add the badge's line here**: this
  change adds a public export (`getSlideDay`, `CHRONIC_SLIDE_MIN_DAYS`) and a
  prop on two components, which is the half that outlives this spec.
- `src/lib/presentation/style/STYLE.md:31-45` — the three colour roles, read
  for the reason the out-of-scope note gives.
- `messages/en.json:249` — `task_must_do_badge`, the key the two new keys are
  named and shaped after. Four more locales: `de`, `es`, `fr`, `zh`.
- `src/lib/business/store/session-store.svelte.spec.ts:805-838` — "moves a task
  to tomorrow, leaving today-only facts behind", where the first pin lands;
  `:700-721` is the existing `importTasks` test the second pin lands beside.
- No MATH.md section. Calendar age is not a model quantity: nothing here enters
  a fit, a solve or a metric, and no formula, constant, bound or fit moves.
- No `src/lib/data/AGENTS.md` change. The validation fix _applies_ that file's
  stated policy for user content — keep the record, default a corrupt field to
  its safe end — rather than changing it.

## Decisions

Each one: what was decided, why, and what was rejected. The rejected half is
the part git cannot reconstruct.

- **The gate is an age of 3 days, so the first badge reads `DAY 4`.** A task
  deferred once or twice is an ordinary day; three carried days is the first
  point at which "chronic" is honest, and it keeps most rows clean. Day 1 is
  the day the task was added, so the printed number is the age plus one and
  never contradicts the calendar. Rejected: a gate of 1, because every deferred
  task would then wear a badge and the row already carries up to three; a gate
  of 7, because it would fire so rarely the user would never learn what it
  means.
- **The badge prints `day {n}`, not an ordinal.** "4th day" needs English
  ordinal suffixes and prints "21th day" at three weeks — exactly the tasks the
  badge exists for. This repo has no plural or ordinal machinery: no `match`
  syntax anywhere in `messages/`, and `header_yesterday` does not pluralize
  "{count} tasks". `day 4` is still positional — it names the day you are on
  rather than a duration, which was the point of choosing an ordinal — and it
  translates with one interpolated number in all five locales (`Tag 4`,
  `día 4`, `jour 4`, `第 4 天`). Rejected: a per-locale suffix formatter over
  `Intl.PluralRules`, because it introduces an i18n mechanism for one badge and
  the four non-English locales need their own rules anyway.
- **Age is measured against the day in view, not against today.** Every reading
  on `/` answers for the day on screen, and a past day showing what the badge
  said then is the consistent answer. It also means the badge needs no clock:
  `viewedDate` is a prop, so the story plays are deterministic without mocking
  time. Rejected: `liveToday`, which would make a browsed past day claim an age
  it never had.
- **`getSlideDay` and `CHRONIC_SLIDE_MIN_DAYS` go in
  `presentation/utils/slide-age.ts`.** The threshold is display policy, which
  R2 keeps out of a component, and the whole behaviour is then testable without
  mounting a row. Rejected: a `$derived` in `task-item.svelte` — legal as a
  formatter, but it buries a threshold in markup and leaves the boundary cases
  reachable only by rendering four stories.
- **`task-list.svelte` calls it; `task-item.svelte` takes
  `slideDay?: number | null`.** The same shape as `runOrder`: computed above the
  row, one number passed down, and the row renders a reading it does not
  derive. Rejected: passing `createdAt` and `viewedDate` into every row, which
  hands each of them the same two values to reach the same conclusion.
- **The badge renders on a completed row.** It is a fact about the task, not
  about the plan — unlike `#N`, which `task-item` withholds once a task is
  ticked because the run order is a next-up reading. "Stays today" is the
  precedent that already renders through completion.
- **`bg-info/20 text-info`.** `warning` is spoken for by "Stays today", and the
  slide badge is a statement, not an alarm. The bare token rather than
  `-strong` is the row's existing idiom, for the reason in Out of scope.
- **The `createdAt` validation is fixed here, in the data path.** ROADMAP item
  22 asserts `Task.createdAt` is "an ISO date string already validated on read
  (`persisted.ts:91`)". **It is not.** `sanitizeTask` narrows it with
  `typeof source.createdAt === 'string'`, while the `isoDate` helper that would
  actually validate it sits two functions above, unused on this field — so a
  stored `'banana'` survives sanitize, reaches `daysBetween`, and prints
  `DAY NaN`. This badge is the first reader that can print the corruption, R4
  requires validating a user-reachable value on read in the layer that owns the
  shape, and the fallback semantics already exist. The item's line is corrected
  in the landing commit; leaving it would have the next reader believe the
  guard is there. Rejected: guarding inside `getSlideDay` instead, which leaves
  the bad value in the model for the next reader to hit.

## Open questions

None.
