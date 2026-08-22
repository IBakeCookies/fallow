# The session nobody was timing

**Status:** landed 2026-08-22 · **Roadmap:** item `none` (re-opens a not-proposed
entry — see **Decisions**)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`/` gains one start/pause/stop timer on the Tasks card's heading row, beside
**Load** and **Save**. Stopping it leaves the elapsed minutes pending; the next
🪫 end-of-session drain editor opened on any task row that day opens with the
`worked` field already filled, so the user answers only the two ratings. Today
that number is typed from recall, and a session the user forgot to time is a
session with no 🪫 log at all — which is the only way a day reaches λ₀
(MATH.md §8.10), the §12 audit and the §11.9 carry-over.

## Scenarios

### Scenario — the timer reads on today's Tasks card

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** today, one task, no stored timer
- **When** the heading row renders
- **Then** a `Start timer` button is present

### Scenario — a running timer offers pause and stop

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** today, one task, no stored timer
- **When** `Start timer` is clicked
- **Then** a `Pause timer` button is present
- **Then** a `Stop timer` button is present
- **Then** no `Start timer` button is present

### Scenario — a paused timer offers resume

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** a stored timer, phase `running`
- **When** `Pause timer` is clicked
- **Then** a `Resume timer` button is present

### Scenario — the stopped reading can be thrown away

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** a stored timer, phase `stopped`, 45 minutes accumulated
- **When** `Discard timed session` is clicked
- **Then** a `Start timer` button is present

### Scenario — a past day offers no timer

`e2e/day-navigation.e2e.ts`

- **Given** a past day loaded by date
- **When** the Tasks card renders
- **Then** it has no `Start timer` button

### Scenario — a future day offers no timer

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** `selectedDate` after `today`, one task
- **When** the heading row renders
- **Then** no `Start timer` button is present

### Scenario — stopping fills the next drain editor's worked field

`e2e/tasks.e2e.ts`

- **Given** today, one task, no stored timer
- **When** the timer is started, then stopped, then that task's
  `Log end-of-session drain` is clicked
- **Then** the drain form's first number field holds a value greater than 0

### Scenario — the filled editor puts the caret on the mind rating

`src/lib/presentation/component/drain-log-form.stories.svelte`

- **Given** `seed: { minutes: 45, mind: null, body: null }` and `focusMinutes`
- **When** the form mounts
- **Then** the mind rating input is the focused element

### Scenario — one stop funds one log

`e2e/tasks.e2e.ts`

- **Given** today, two tasks, and a timer stopped at a nonzero reading
- **When** the first task's drain log is saved with the filled value
- **Then** the second task's drain editor opens with an empty worked field

### Scenario — the stopped reading survives a reload

`e2e/tasks.e2e.ts`

- **Given** today, one task, and a timer stopped at a nonzero reading
- **When** the page is reloaded and the task's drain editor is opened
- **Then** the drain form's first number field holds a value greater than 0

### Scenario — a running timer funds nothing

`src/lib/presentation/utils/session-timer.test.ts`

- **Given** a timer still running
- **When** `getPendingMinutes` reads it
- **Then** it returns `null`

### Scenario — a rollover drops a timer left running overnight

`e2e/day-navigation.e2e.ts`

- **Given** today, one task, and a timer started and left running
- **When** the clock crosses midnight with the page still mounted
- **Then** a `Start timer` button is present
- **Then** a drain editor opened on the new day has an empty worked field

### Scenario — a correction does not spend the stopped reading

`e2e/tasks.e2e.ts`

- **Given** today, one task carrying a saved 🪫 rating, and a timer stopped at a
  nonzero reading
- **When** that rating's chip is clicked and the correction is saved unchanged
- **Then** the task's `Log end-of-session drain` editor still opens with the
  timer's value filled

### Scenario — elapsed is the sum of the running segments

`src/lib/presentation/utils/session-timer.test.ts`

- **Given** a timer run for 10 minutes, paused for 30, resumed for 5
- **When** `getElapsedMinutes` reads it
- **Then** it returns 15

### Scenario — a timer started on another day reads as no timer

`src/lib/presentation/utils/session-timer.test.ts`

- **Given** a stored timer whose `startedOn` is not today
- **When** `sanitizeSessionTimer` reads it
- **Then** it returns `null`

### Scenario — a corrupt stored timer reads as no timer

`src/lib/presentation/utils/session-timer.test.ts`

- **Given** a stored value whose `accumulatedMs` is not finite
- **When** `sanitizeSessionTimer` reads it
- **Then** it returns `null`

## Out of scope

- **A per-task-row timer.** Considered and rejected — see **Decisions**. The
  timer belongs to the person, not the row.
- **Attributing the stopped reading to a task at stop time.** No dropdown, no
  picker, no "which task was that". The task is chosen the way it already is:
  by opening that row's 🪫 editor. Adding a second way to say the same thing is
  the thing AGENTS.md §0 bans.
- **☕ rest logging from the timer, and a second rest control.** Structural, not
  a taste call: `logRest` has exactly two surfaces today, `/energy`
  (`+page.svelte:626`) and `/analytics`'s history ✎ — there is no rest editor on
  `/` for a timer near **Load**/**Save** to fill. A rest timer is also not a
  minutes prefill: MATH.md §8.9 fits r from a before/after pair, so it would
  have to ask for two ratings at start as well, which is a different instrument
  with its own design question. Putting rest logging on `/` is its own change,
  and this timer prefills it for free once it is there.
- **The timer on `/energy`.** The Lab's rows carry the same 🪫 editor, but the
  control the user asked for sits beside **Load** and **Save** on `/`, and a
  reading that has to cross screens is a store rather than a page's state
  (§0 — the second real caller is where that seam gets cut, not before).
- **Any change to what a 🪫 log means, or to when one may be written.** One row
  per session (MATH.md §18), appended today only, corrected by record id on any
  day — all unchanged. The timer fills a field; it never writes a log.
- **A cap on a long reading.** A timer left running inside one day prefills
  whatever it read; the form's existing `max="960"` refuses it visibly and the
  user edits. Across midnight it is dropped by the day check above.
- **Notifications, background ticking, or a title-bar countdown.** The readout
  updates while the page is open and that is all.

## Read before building

- `src/lib/presentation/component/day-actions.svelte` — the host. Note its
  guard is `{#if !isViewingPast}`, which shows **Load**/**Save** on future days
  too; the timer needs `isToday`, because a new 🪫 measurement is today-only
  (presentation/AGENTS.md, "Both corrections are offered on any day the page
  shows, a new measurement only today"). It already derives `isToday`. The
  wrapper comment says the pair "never wraps and never shrinks: the pair is
  ~150px" — a third control changes that arithmetic, so the comment is part of
  the diff.
- `src/lib/presentation/component/day-actions.stories.svelte` — five of the
  scenarios above. Its `whenClickable` helper and its "close every menu before
  returning" rule (axe runs on whatever is left mounted) are why the existing
  plays look the way they do; keep both.
- `src/lib/presentation/utils/measurement-prompt.ts:81-89` — `newDrainDraft`
  gains the seeded minutes, and **its doc comment becomes false**: it says a new
  session's draft is "Always empty, never seeded from an earlier rating … so
  prefilling the last one invites re-saving hours the day already counts." The
  reason still holds for a _rating_; a stopped timer is a measurement of a
  session no row has logged yet. Rewrite the comment, do not delete the reason
  (AGENTS.md §0's documentation clause). `focusMinutes` keeps its meaning —
  this file already owns append-vs-rewrite, so it is also where the caret
  decision stays.
- `src/lib/presentation/component/drain-log-form.svelte:74-84` — the `@attach`
  that focuses the minutes input. It becomes "focus the first empty required
  field": minutes when minutes is empty, the mind rating otherwise. Every
  existing caller is unchanged by that rule (a correction seeds all three, so it
  still lands on minutes), and it is what stops a focused field holding `45`
  from turning the first rating keystroke into `456`. Do **not** give this form
  `recordId` to decide it with — the props comment at :12-16 says why.
- `src/routes/(app)/+page.svelte:66-73,97-112,166-179` — `openDrainLog` /
  `newDrainDraft`, `saveDrainLog`, and the `dayActions` snippet. The page owns
  the timer state and the three callbacks; **only the append arm of
  `saveDrainLog` clears it** (`recordId === undefined`), which is the
  correction scenario above and MATH.md §18's double-count in the one place it
  is reachable.
- `src/lib/presentation/utils/session-timer.ts` — new. Exports the shape
  (`phase: 'running' | 'paused' | 'stopped'`, `startedOn`, `runningSince`,
  `accumulatedMs`) and `runTimer`, `pauseTimer`, `stopTimer`,
  `getElapsedMinutes`, `sanitizeSessionTimer`, plus the read/write/clear pair
  and the one declaration of its `localStorage` key. Milliseconds accumulate and
  minutes are rounded once, at read, or every pause adds a rounding error.
- `src/lib/data/AGENTS.md:53-58` — R4's `localStorage` tier, and the one rule
  this change bends. It reads "only values whose loss costs nothing and that
  have no business in a backup", and names two presentation-tier keys
  (`toast.ts`, `/energy`'s `VIEW_KEY`). This is the third, and the operative
  test is the second clause: a restored three-week-old backup must not resurrect
  a running timer. Amend the tier's wording; the "no store talks to a storage
  API directly" rule at :106-118 already blesses a presentation module owning
  its own key.
- `src/lib/data/migration/local-storage-migration.test.ts:20` — the
  `vi.stubGlobal('localStorage', …)` pattern the three `session-timer.test.ts`
  scenarios need, since `*.test.ts` runs in the node project.
- `src/lib/presentation/AGENTS.md` — the public-export half, in lines not
  paragraphs: `newDrainDraft`'s new argument, the drain form's focus rule, and
  `day-actions.svelte` holding a control that is `isToday`-gated where its
  neighbours are `!isViewingPast`-gated. §302-350 ("Each measurement is read,
  corrected and dropped on the row it belongs to") is the section that owns the
  🪫 editor's openings and gains the third one.
- `messages/{en,de,es,fr,zh}.json` — five new keys, all five files:
  `timer_start`, `timer_pause`, `timer_resume`, `timer_stop`,
  `timer_discard`. The elapsed readout is a formatted duration, not a message.
- `ROADMAP.md:443-447` — the not-proposed bullet this re-opens. It is **not**
  deleted and **nothing is renumbered**: the plan-value verdict it records is
  still true. It gains the date, this file's link, and the one clause it did not
  price. ROADMAP's own header rules apply — a new list starts after prose, and
  `npx prettier --write ROADMAP.md` runs after the edit.
- `e2e/helpers.ts:103-125` — `logDrain`, which opens the form and fills all three
  fields. The scenarios above assert the field is _already_ filled, so they
  drive the form directly (`e2e/tasks.e2e.ts:244` notes the same reason for the
  same choice) rather than through this helper.
- `docs/testing.md` — the level table for the mix above, and the reviewer table
  at the bottom for the dispatch.
- MATH.md §18 and §8.7 — read, not edited. §18 is why one stop funds one log;
  §8.7 is the fit that consumes the hours. **No MATH.md change in this
  commit**: no formula, constant, bound or fit moves. The timer changes how a
  number reaches a field, not what the field means.

## Decisions

- **Global, not per-row** — one timer beside **Load** and **Save**, and the task
  is named by which row's 🪫 editor gets opened afterwards. Rejected: a
  start/pause control on each task row. It reads as the more direct design and
  costs the most: a column on `/`'s table (AGENTS.md §4, "both task screens are
  one `<table>` off one shell; a column list is one definition per screen"), the
  same column on `/energy` under R3-in-the-UI or a deliberate asymmetry, and a
  new rule for what starting a second row's timer does to the first. A person
  works one session at a time, so the state is the person's, not the row's.
  Rejected too: asking which task at stop time — the 🪫 button already is that
  question, and a second way to answer it is AGENTS.md §0's exact case.
- **Re-opened on log-rate grounds, and the closed line keeps standing** —
  ROADMAP.md:443 rejected a start/stop timer because "±15 min of recall error
  costs 0.00% median", which prices recall _accuracy_. It never priced how often
  a 🪫 log gets written at all, and the rate is load-bearing: λ₀ (§8.10), the
  §12 audit and the §11.9 carry-over reach a day only through a 🪫 log with
  `hours > 0`. **No plan-value number is claimed here.** The probe that would
  settle it is a log-rate one and cannot run on synthetic days — a generator
  replays its own assumptions about when a user logs, which is the circularity
  §17 turns on real logs to avoid. This ships as an ergonomics change with a
  named hypothesis, and the ROADMAP bullet keeps its verdict on its own terms.
- **`localStorage`, so R8 never enters it** — the cost the ROADMAP bullet quoted
  was "R8 + a timer store + a backup bump", and all three are avoidable. A
  running timer is not a model input (R4's heading), so it does not belong in
  IndexedDB; it belongs in the tier that has no business in a backup. Rejected:
  a new key in the existing `settings` store, which needs no `DB_VERSION` bump
  and is still wrong for the reason `toast.ts`'s tier note already gives — the
  store is in `STORE_NAMES`, so a backup would carry a running timer and
  restoring an old one would resurrect it. Rejected: `sessionStorage`, which
  does not survive the closed tab the user asked about.
- **A page's state, not a store** — both the control and the editor it fills are
  on `/`, so there is one caller and no seam to cut yet (§0). The route owns the
  authoritative timer; `day-actions.svelte` owns only the interval that
  re-renders the readout, which is UI-only state R2 already permits. Rejected: a
  `SessionTimerStore` wired in the `(app)` layout — it buys nothing until a
  second screen needs the reading, and it is one `setSessionTimerStore` call
  away when one does.
- **A timer that did not start today is dropped on read** — a new 🪫 measurement
  is today-only, so a timer started yesterday cannot legitimately fill one, and
  the same check disposes of the commonest failure by far: forgetting to stop it
  overnight. Rejected: clamping the reading to the form's 960-minute max, which
  invents a number the user did not measure. Accepted cost: a real session
  crossing midnight loses its reading, and the user types the minutes as they do
  today.
- **The elapsed value is rounded, and a sub-30-second reading rounds to 0** —
  the field takes integer minutes and refuses `<= 0`, so a timer started and
  stopped by accident fills nothing and the form says so. Rejected:
  `Math.max(1, …)`, which reports a minute nobody worked into a fit.
- **The drain form focuses its first empty required field, and the length when
  none is empty** — rather than learning who seeded it. It keeps `focusMinutes`
  meaning exactly what it means today, changes no existing caller's behaviour
  (a correction seeds all three, so it still lands on the length), needs no new
  prop, and honours the form's own stated boundary that append-vs-rewrite is the
  caller's decision. The fallback is the load-bearing half: without it a
  correction lands on a rating that already reads `6`, and a corrected `7` types
  as `67`. Rejected: a second focus prop; rejected: passing `recordId` down.
- **Only a STOPPED reading funds a log** — `getPendingMinutes` returns `null`
  for a running or paused clock, and the append arm clears the timer only when
  it was stopped. A running clock that seeded a log would fund a second one from
  the same minutes (MATH.md §18), and clearing it would delete a session still
  being worked. Found in review, not in planning: the scenario above read
  "a running timer" where its own title and this file's **Goal** both say
  stopping is what leaves the reading pending.
- **The day check runs whenever `today` moves, not only at read** — `today` is
  live, so a page left open crosses midnight with its timer still running and
  `isToday` still true. Read-time sanitizing alone would have let yesterday's
  minutes fill today's 🪫 log, which is the failure this check exists for.

## Open questions

None.
