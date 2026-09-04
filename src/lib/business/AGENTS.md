# Business layer — rules

Domain logic: pure models (`model/`, [own rules](model/AGENTS.md)), reactive
stores (`store/`), app-wide reactive state (`state/`), pure helpers (`utils/`).
Read with the root [AGENTS.md](../../../AGENTS.md).

The layer's **root** is the fifth category and the easy one to get wrong:
composed, stateless facades over the data layer — `session-history.ts`
(read-side sessions, the calibration snapshot, storage startup), `backup.ts`,
`appearance.ts`. Not a store: no reactive state, and the stores are among its
callers. Not `utils/`: `utils/` is pure — which is what lets a route
value-import from it (see `presentation-not-to-business-model`) and what
nothing touching IndexedDB may claim.

## R1 — never imports `$lib/presentation/*`

### `src/lib/logger.ts` sits below all three layers

And is the only module that does — every layer and the hooks report
diagnostics, so a home inside any one layer would break the direction for the
other two. It imports nothing from the app (`logger-imports-nothing`, an error)
and is the only file allowed to touch `console`; `no-console` is an **error**
everywhere else, and off in exactly four places — `logger.ts` itself,
`scripts/`, `eval/` and `.claude/hooks/`, whose console output is the point. Call
`logError` / `logWarning` with a message, the caught error, and a `context`
object of ids, dates and counts — **never task titles or notes**, the payload a
reporting service would ship off-device. Plugging in Sentry or similar is one
`setLogSink` call in `hooks.client.ts`; no per-call-site reporting. Logging is
**not** a user-facing surface, and most failures do one of each.

### Three user-facing failure surfaces; picking the wrong one is the bug

- **Retryable and persistent → the banner**, `StorageStatusStore`'s
  (`store/storage-status.svelte.ts`): a store takes a `StorageReporter` from
  `register(name, retryLoad?)` and reports `'load-failed'` or `'save-failed'`,
  passing `retryLoad` if it can fail a **read** — that is what the banner's
  Retry re-runs.
- **Transient and informational → a toast** (`presentation/utils/toast.ts`).
- **Already visible in the failing component → nothing more**, but verify it
  really is visible: the `analytics-store` load is two `try` blocks — one per
  read — because `#hasModelReportFailed` takes every card that read feeds out
  of its loading string and each then says so itself, while a failed
  **history** read renders every chart as an empty year — looks like a user
  with no data, so it toasts.

Silent is only acceptable where the screen is already visibly wrong. Four stay
deliberately silent (re-proposing them is churn): yesterday's session
(decoration, and the banner's Retry does not cover that read), the Energy Lab's
`localStorage` view preference (loss costs nothing), its `readStopObservations`
effect (any real outage also fails the `settings` read, which toasts for both;
an isolated failure only empties a fit the card already labels "not fitted"),
and `readHistoryPrefills` (the add-task form offers no title suggestions or
tags and an unseen day opens on 0 hours — what the app did for a year, where a
banner would claim the day failed to load). Silent still means **logged** —
`readStopObservations` was an unhandled rejection until caught.

A count is not a surface: `importFromDate` returning 0 makes the header say
"No tasks on that date", a claim about the user's data a failed read cannot
support, so it raises the retryable banner instead.

### A store never imports the toast API; it takes an injected thunk

Importing is doubly illegal (business → presentation, caught by both `eslint`
and `depcruise`), and `svelte-sonner`'s `toast` is module-scope state, which no
store may hold. Injection also keeps the store testable without module mocks —
the same reason R5 exists. Three so far — `EnergyLabStore`'s
`NotifyParamsLoadFailed`, `AnalyticsStore`'s `NotifyHistoryLoadFailed`,
`CalendarStore`'s `NotifyCalendarLoadFailed`; the first two wired by the `(app)`
layout, which builds every store in the app even where only one route reads it,
the third by `/calendar` itself: one purpose-named thunk per case, **not** a
`NotificationKind` union. Severity vocabulary and copy belong to presentation;
an enum in business mirrors the message catalogue for no gain. A second site
gets its own thunk; a union earns its keep at three. The banner is the
counter-example that shows the line: a business-owned _state_ with no copy in
it (`'load-failed'` is a machine value the layout localizes), so it is a store
the others take, not a thunk they are handed.

A thunk is the shape for any collaborator a store may not import, not for
notifications alone: `SessionTimerStore` takes the `writeSessionTimer` the
`(app)` layout hands it, because R4 forbids a store touching a storage API and
the key stays declared in presentation.

## R5 — Business code does not import SvelteKit routing

Stores take what they need as arguments. `SessionStore` reads the viewed day
through an injected `ReadDateParam` thunk supplied by the `(app)` layout — not
by importing `$app/state`. Testable without module mocks; routing stays a
layout concern.

The **environment** is an argument too. `ThemeStore` takes both appearance
snapshots — the SSR payload (`data.appearance`) and `appearance.ts`'s
`readClientAppearance()`, both read by `+layout.svelte` — instead of reading
`document.cookie` itself behind a `browser` check. The layout is the module
that genuinely runs in both places; a store handed two snapshots reconciles
them by precedence alone, and its spec needs no module mock to do it.

`$app/environment`'s `browser` is still fine where a module really does run in
both (`state/today.svelte.ts`, whose getter SSR reaches). **Never inside an
`$effect`**: effects do not run during SSR, so a `browser` guard in one is dead
code — six were, across `SessionStore`, `EnergyLabStore` and
`debounced-write.svelte.ts`, until 2026-08-04.

## Stores

### Every store reaches a route through its `setXStore()`

All nine (`ThemeStore`, `StorageStatusStore`, `SessionStore`,
`EnergyObservationStore`, `SessionTimerStore`, `DailyPlanStore`,
`AnalyticsStore`, `EnergyLabStore`, `CalendarStore`). Sole exception: a
`*.test-harness.svelte`, which constructs directly because the store under test
is the thing it hands back.

A bare `new XStore(...)` in a route is not a shortcut, it is the hole:
`setContext` **throws outside component initialisation**, which is what makes
"a store only ever exists inside a component tree" mechanically enforced
instead of merely conventional. Do not assume the runes catch it:
`DailyPlanStore` touches neither `onMount` nor `$effect`, only
`$state`/`$derived`, so `new DailyPlanStore(...)` in a `+page.ts` `load()`
**succeeds** — state created on the server and shared across SSR requests.

`state/*.svelte.ts` remains the one module-scope exception, only for values
derived from the environment (e.g. the clock), never user data.

### Context is the creation rule; what the constructor does picks the tree

`setXStore()` runs in whichever component's tree needs the store — the root
layout for `ThemeStore`, `(app)` for `StorageStatusStore`, `SessionStore`,
`EnergyObservationStore`, `EnergyLabStore` and `SessionTimerStore` (status store
first, because the three that report into it register their re-reads there; the
timer reports nothing — R4's `localStorage` tier), the
route's own instance script for `setDailyPlanStore` in `/`, `setAnalyticsStore`
in `/analytics` and `setCalendarStore` in `/calendar`.
**Every store loads at init** — in its constructor, so a caller holding one
never has to know it is inert. Three questions place the call:

- **Does the constructor do I/O?** If not, lifetime is irrelevant: put the
  store at the route, because recreating it costs an allocation.
  `DailyPlanStore` touches neither `onMount` nor `$effect` — it is a fold over
  two layout stores, so a fresh one per visit is free.
- **Do several routes read it?** Then it belongs at their lowest shared node,
  and its data comes from _that_ node's load. `ThemeStore` is the clean case:
  `+layout.server.ts` reads the cookies, the root layout hands them to the
  constructor, and no route ever passes the store anything. Nothing else can
  follow it — every other store's data is in IndexedDB, which no server `load`
  can await, which is why the rest read for themselves.
- **Does it hold state its source does not own?** Then hoist it above the
  consumers and take each fresh slice through a named setter. Do **not** add an
  `init(data)` for the route to call on arrival: if it resets everything it is
  recreation with a precondition bolted on, and if it does not, the store and
  its source are two authorities over one array.

For a single-route store whose constructor reads, both trees are defensible and
the trade runs the same way in each direction:

- **On the route, recreation is the refresh.** Both single-route stores sit
  here. `CalendarStore` follows the visible range through a `() => [start, end]`
  thunk rather than exposing a `reload(range)` the page must remember to call —
  same principle as loading at init, applied to a store whose input keeps
  moving. `AnalyticsStore` reads a year of
  summaries plus a 30-day audit that runs both planners per day: at boot every
  other page would pay for it, and it reads day summaries the main page
  rewrites all day, so arriving with a fresh store is how the numbers stay
  true. The price is the empty window on the way in, which the page's
  placeholder frame covers. Do **not** reach for a lazy `load()` to get cheap
  boot without that price — an inert store whose correctness depends on the
  caller remembering a second call is worse than the re-read it saves.
- **In the layout when every staleness reason has a key.** `EnergyLabStore`
  moved there: its params are the Lab's alone, but its stop observations are
  not — a completion toggle on a past day moves them — so the effect that folds
  the finished days keys on `SessionStore`'s past-write generation and re-reads.
  The optimizer behind `plan` is a `$derived` no `$effect` touches, so it stays
  unrun on the five routes that never show it. What it buys is the ~120 ms of
  placeholder a page-scoped store spent re-reading on every visit. A staleness
  reason with no such key means a named refresh instead, called by whoever knows
  the reason — `SessionStore` has two, `retryLoad()` for the banner's button and
  a `visibilitychange` re-read for a returning tab. A refresh is not the
  `load()` above: it leaves the store valid, only less current.
- **A layout-scoped debounced write flushes on app teardown, not route
  teardown**, and that is not a loss: the pending timer stays alive to fire on
  its own precisely _because_ the store did, and `visibilitychange` still
  covers a tab that leaves first.
- `StorageStatusStore.register` has no unregistration, so anything
  layout-scoped may pass a `retryLoad` freely and anything page-scoped may not.
  `EnergyLabStore` registers without one anyway, on its own merits: a failed
  params read is a toast, not the banner.

A single-consumer store's `getXStore()` may legitimately have no callers yet; it
lets a second route read the store without the layout threading it down, at one
line. Not a component: those take props and snippets
([presentation/AGENTS.md](../presentation/AGENTS.md)).

### Loaded-ness is a field, never emptiness

Every store that reads carries its own `isLoading`/`isLoaded`, because an empty
array is an answer and a read that has not returned is the absence of one.
Collapsing them is how a page ends up telling a user with a full week "No
tasks" — the failure the first-paint policy in `STYLE.md` exists to prevent. A
getter that reports on the data rather than the read (`AnalyticsStore.hasData`)
is only meaningful once the flag says the read is done, and says so in its doc
comment.

A class field that a `$derived` initializer reads must be declared with `!` and
assigned first in the constructor — the deriveds are lazy, but TypeScript
checks declaration order.

### Autosave goes through `createDebouncedWrite`

(`store/debounced-write.svelte.ts`) which owns the whole mechanism: the
trailing timer, the `onDestroy` flush and the flush-when-hidden listener. A
store snapshots inside its own tracked `$effect` and calls `schedule(payload)`;
nothing else. The rule the module encodes: **a debounce flush belongs in
`onDestroy`, never in an `$effect` teardown.** An effect's cleanup runs before
_every_ re-run, not only on destroy — flushing there fires on each keystroke
and defeats the debounce, while cancelling there (the old bug) silently drops
the last edit when the user navigates away. The session store and the Lab each
had their own copy spelling the 500 ms delay two ways — R3 applied to a
mechanism.

The delay is `AUTOSAVE_DEBOUNCE_MS`; wait on it in a spec, never on `500`;
`e2e/helpers.ts` exports its own `AUTOSAVE_MS = 1000` for Playwright, which
cannot import app code.

Two things stay with the caller because they are not the mechanism. The Lab's
`#saveArmed` guard: the effect's first run after a load only establishes
tracking, and scheduling there writes the just-loaded params straight back —
after a _failed_ load, that overwrites the stored calibration with the
defaults, a bug that shipped and is pinned by
`energy-lab-store.svelte.spec.ts`. And the session store's re-read when the tab
becomes visible, which asks the writer for `pending` so an unlanded edit is not
overwritten by the stored day — reachable because a hidden tab that rolls over
midnight re-loads and re-arms the autosave.

### Three write sites carry the whole day, so a new field lands in all three

`SessionStore` writes a `DailySession` from the autosave payload, from
`toggleTask`'s past-day branch and from `moveTaskToTomorrow` — each a whole
record, so every field one of them does not carry is a field it erases.
`#persistSession` cannot catch that: it takes the payload already built.
A field that reached only two of the three once reset a past day's value when a
task was ticked off there
([the-plan-that-had-no-clock.md](../../../docs/features/the-plan-that-had-no-clock.md)).
The destination write also reads its OWN day's values through `#readDestination`
and defaults nothing: a fallback there stamps a value onto a day that never
chose one.

### `SessionStore` has a second day source, and it reaches no storage

A third constructor argument, `ReadDemoTitles`, returns the example day's six
titles or `null` (`demo-day.ts`; `docs/features/demo-day.md`). Non-null and the
store seeds the fixture instead of reading. **The guard is not one guard**, and
which of the two flags a site takes is the whole of it:

- `#demoTitles` — what the URL asked for. Gates the READS: `#boot` returns
  before `initializeStorage`, the day effect seeds instead of loading, the
  yesterday effect and the `visibilitychange` re-read stand down.
- `#isShowingDemo` — whether the fixture is on screen. Gates the WRITES:
  `#persistSession`, the auto-save effect, `logFlow`, `saveCurrentAsRoutine`,
  `deleteRoutine`, `moveTaskToTomorrow`, and the two remaining reads a click can
  still reach (`readDeferDestination`, `importFromDate`). Leaving the demo drops
  the param while the fixture is still in `#tasks`, and a URL-keyed auto-save ran
  in exactly that gap and saved all six.

A write refused here and not at its call site, always. `logFlow` is why: the
planner hides the ⚡ affordance in the demo (`canLog`), the Energy Lab renders
this same day and hides nothing, so a presentation-side guard covered one caller
of two. It happened to be unreachable — the Lab is outside the demo's route
scope — which is exactly the kind of cover that disappears when a scope moves.

Editing still works, so `#seedDemoDay` sets `#loadedDate` like a real load —
which is why leaving the demo tests `#isShowingDemo` and not the two dates: a
visitor who entered from their own loaded day leaves it with both dates already
agreeing, and no read would fire.

`#hasReadStorage` is the third field: whether boot ever started. A visitor who
ARRIVED on `?demo` and then navigated to their own day has run no migration and
folded no prefill, so that day needs the whole boot, not a session read.

**None of the three collapses by forcing a reload on the demo's own two links.**
Every nav link is a client-side navigation to another `(app)` route over this
same store, so `?demo` is left that way too — with no param change at all, just
`page.route.id` (`e2e/demo-day.e2e.ts`, "a nav link leaves the example day").
Covering that needs the whole machinery regardless; reload-forcing the links
buys two page loads and deletes nothing.

**Not covered, on purpose:** `DailyPlanStore` folds `EnergyObservationStore`'s
real drain and rest rows into whatever day is on screen, so an existing user's
example day carries their own logged hours in its mid-day re-plan. Excluding them
means threading the demo through a second store, and the demo's audience has no
logs.

Copy comes from the caller, and the param name plus the localized href are
`presentation/utils/demo-link.ts` (R3). Not R1 — `$lib/paraglide` sits beside the
three layers and no rule bars it here. It is the convention above: copy belongs
to presentation, and this layer has no locale in it at all.

## Settled decisions — do not re-litigate

### Task ids come from `nextTaskId` and nowhere else

`session-store`: `Math.max(Date.now(), …ids + 1)`, monotonic and never
recycled. Both simpler rules are wrong and were shipped: `Date.now()` alone
collides for two tasks added in the same millisecond (and the import path
patched around that with `Date.now() + Math.random()`, putting fractions in a
field three observation stores use as their foreign key); plain `max + 1` over
the day's tasks recycles a deleted task's id, and a drain log — which outlives
the task it rated — re-attaches to whatever new task inherits it.

**"Never recycled" is within a day.** Only the viewed day's tasks are in scope,
so across days it rests on `Date.now()`, and importing N tasks reserves ids up to
now+N−1: adding a task on another day inside that window could reuse one, which
no UI reaches two days fast enough to do. Every join a fit reads is per-date, so
a collision could not move a measurement between days anyway; the one join by id
alone is the log history's task NAME (`analytics-store`'s `taskTitles`), where a
collision costs a row printing the other day's title.

**The demo day is the one exception**, and only because nothing it holds is
ever written: `buildDemoTasks` numbers its six tasks 1–6, and `#persistSession`
refuses every write while the demo is on. The rule is about ids a day KEEPS, so
it does not reach an id that never leaves one call: `calculateDraftImpact`
numbers the task being typed `max + 1` for the length of one solve, purely so it
can find its own row in the result.

**A new task is PREPENDED, and anything predicting a plan has to prepend too.**
`addTask` puts it at the head of `tasks`, and `calculateTaskPlan` sorts on the
priority score rounded to 1 dp with a stable sort — so input position orders
every rounding tie, which decides the run slot and, on a tight budget, which
tie-mate gets funded. `calculateDraftImpact` reads the plan the deploy will
produce only because it inserts the draft in the same place.

**A day's `tasks` array is newest-first** — every writer in `SessionStore`
prepends — so anything wanting the later of two entries walks it backwards, and
never sorts by `id`: an import assigns ids ascending across a batch it prepends
as a block, which runs opposite to the array.

### A composed read reads each store once

`session-history.ts`. Every read is a full store scan that grows with the
user's whole history, so `readModelReport` reads flow, rest, drain and the
session range once each and derives both model cards from those records — it
used to compose its own sub-reads and cost three drain scans and two of
everything else on every visit to analytics. A test in
`session-history.test.ts` counts transactions.

### The banner is `StorageStatusStore`'s, not the session store's

It was the session store's because that store failed first, and every store
added afterwards depended on it to reach the banner: `EnergyObservationStore`
imported `StorageErrorKind` from it, `EnergyLabStore` held a session store
partly to call `reportStorageError`, and the retry action was a list in the
layout that each new `retryLoad()` had to be remembered into — an invariant
maintained in prose. Now the session store loses three public members, the
cross-store type import is gone, and "a store that can fail a read is covered
by the retry" is true by registration, not memory.

**The failure is tracked per reporting store, not as one flag** — keep that:
one flag meant one store's success cleared another's unrecovered failure.
Sharpest on retry: `retry()` fires the registrations in order, but
`EnergyObservationStore`'s two reads settle before `SessionStore`'s
migration-plus-three, so a re-failure there was wiped by the session's later
`clearLoadFailure()` — the user pressed Retry, the banner vanished, and the
drain/rest logs were still unreadable with Burnout Risk quietly on defaults. A
store therefore gets a `StorageReporter` and nothing else: it can report and
clear **its own** load failure, and cannot dismiss the banner, fire the retry,
or speak for another store. Three consequences worth not undoing:

- `clearLoadFailure` is not `clear`. A read that works again proves that
  store's data is reachable, so it drops that store's `'load-failed'` — never a
  `'save-failed'`, whose edit is already lost, and never anyone else's. That is
  what lets a transient read failure heal on the next successful read instead
  of leaving a banner over a recovered app.
- `error` and `canRetry` are separate. A lost write outranks a failed read for
  the _message_ (a read failure is already visible as a wrong or empty screen;
  an unsurfaced lost edit reads as success), but Retry is offered for any
  outstanding failed read regardless — keying the button off `error`, as it
  was, hides the only recovery affordance whenever a write has also failed.
- `retry()` drops the load failures and keeps the save failures. Re-reading
  does not un-lose a write.

### Drain and rest observations live in `EnergyObservationStore`

Not the session store — the one cluster whose extraction cost **zero** new
cross-module exports: a measurement is stamped with the live clock's today,
never the viewed day, so it needs none of the date-routing, load or auto-save
state — only a task lookup and somewhere to report a failed write, both already
available (`tasks`, and `liveToday` needs no store at all). It also needs no
`initializeStorage()` ordering: the localStorage migration writes only sessions
and `energyParams`, never these two object stores. What deliberately did **not**
move (re-proposing it is churn):

| Stayed                        | Because                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| Day routing + load + autosave | One concern; task mutations work _because_ the autosave effect watches them |
| Flow observations             | `logFlow` reads the viewed day and the task's tuned difficulty to write one |
| Routines                      | 3 members, needs a `tasks` thunk — not worth a file                         |

`session-store.svelte.ts` is not worth splitting further, for the same
interface-arithmetic reason as `zenith.ts` —
[the measurement is in `model/AGENTS.md`](model/AGENTS.md).

### Plan advice is computed on demand, never in a `$derived`

The cost rule, and it decides the shape of every reading that solves the day.
**A reading costing one solve per candidate goes behind a method; a reading
costing one solve may stay a `$derived`.**

| Reading                             | Shape                      | Cost                                                               |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `suggestPlanAdjustments`            | `computeAdvice()` + a flag | one solve per candidate — 65 ms at n = 12, a frozen main thread    |
| `DailyPlanStore.draftImpact`        | `$derived`                 | one solve, what `#daily` already costs per keystroke               |
| `EnergyLabStore.computeDraftImpact` | method behind a button     | the energy optimizer, 35-195 ms at an 8 h window (n = 3 to n = 20) |
| `computeNextTasks`                  | method, withdraws          | one solve per capped candidate                                     |
| `#remainingDay`                     | `$derived`, gated          | 12.4 ms at n = 12, 0.001 ms until something is logged              |

The frozen thread is the budget field, which re-derives on every keystroke. A
12-task advice run is the **worst** case, not a floor: past
`EXACT_SUBSET_LIMIT` the solve takes the fallback and gets cheaper.
`#remainingDay` survives as a `$derived` only because of its gate — the viewed
day being today **and** any hours existing, so it costs nothing every morning,
which is exactly when the day is being typed into. A `$derived` nobody reads
never runs, which is why `draftImpact` costs every screen but an open add-task
dialog nothing.

Four rules the table cannot carry:

- **Staleness compares a fingerprint of the inputs, never identity.** A
  `$derived` read from outside a reactive context is not guaranteed to return
  the same object twice, so identity reports staleness on a day that never
  changed.
- **The fingerprint carries the DATE as well as the inputs** — `isAdviceStale`
  and `EnergyLabStore`'s `#curveFingerprint` both. `selectedDate` follows the
  live clock and the URL while `#loadSession` is async, so a navigation and the
  midnight tick each move the day with the previous day's tasks still in
  memory, and a held reading reports FRESH right through that window. Any
  future on-demand reading held across days needs the same field. What the two
  cards do with the flag is theirs:
  [presentation/AGENTS.md](../presentation/AGENTS.md).
- **A draft reading is dropped rather than dated, and compared by VALUE.**
  `previewDraft`'s setter clears `draftImpact` and values-compares first,
  because the form republishes on every keystroke in the title and a title
  reaches no solve: without it, fixing a typo after pricing charged a second
  solve for a number that could not have moved. `computeDraftImpact` takes no
  draft parameter and assigns its reading only while `previewDraft` still
  values-equals what it read at the start — the press opens a yield a slider
  drag can publish inside, and a dropped reading that comes back is worse than
  one never dropped, since nothing on screen says the figures describe the
  previous ratings.
- **`computeNextTasks` withdraws instead of dating**: it clears the held list
  before it solves, and its two callers are every way the day can move under
  it — the panel's own `onMount`, so each opening of the dialog re-ranks, and
  `/`'s deploy handler, because the dialog stays open across a deploy and the
  task just added is one the ranking must stop offering. `onMount` and not an
  `$effect` is what keeps it inside R2, which bans `await`/`.then()` in an
  effect. It publishes no busy flag — the panel reads `nextTasks === null` as
  "still working", which is the same fact.

### `EnergyLabStore` never writes to the daily session

Its params live in IndexedDB (`settings` store, key `energyParams`) — see R4 —
orchestrated by that store, not by the route. The **day window is not a param**:
it is `session.availableHours`, one value shared both ways with the main page
(settled 2026-07-29 — neither mode is the better one, so neither owns the day's
hours). The store reads it; `/energy` writes it, like every other session field
that route edits. There is deliberately **no** `|| 8` fallback and no lab-local
override: either would render a window the main page does not have, which is
the fork this replaced.

A dated URL is refused rather than served — `/energy?date=…` redirects to the
canonical route, because the layout's date reader is route-blind while the Lab
is a today-only instrument (🪫/☕ stamp the live clock, the λ₀ fit reads finished
days). That redirect belongs in `energy/+page.ts`, not in a `$effect`: a load
redirect runs before the layout hands the session store a date, so the wrong
day is never read, and it holds with JS disabled.

Being a today-only instrument does not exempt its fits from the causal window:
the three identity fits (α, r, λ₀) read only days **strictly before** today, like
every other fit in the app. The Lab's α and r cards and every row of analytics'
"Your model" name what they defer beside the count; the Lab's Stopping
Calibration card is the one that still does not (ROADMAP item 4). The stop
advisor is the one read that keeps today's rows — it
prices the day in progress, which is the state half.

### `scheduledTasks` carries the task's true effort

The Lab's ledger heads an `Effort` column, so the row needs `E` — and R2 keeps
the mapping out of the component: `#scheduledTasks` attaches
`trueEffort: mapEffort(getEffectiveDifficulty(task))`, the same field name and
the same number `SuggestedTask` already carries, so the two screens cannot print
different efforts for one task. The public getter's shape is `Task & { trueEffort
}`; nothing else about the snapshot order changed.

### An unseen day's budget is prefilled, and that is not the Lab's `|| 8`

ROADMAP item 16. A day with no stored session shows the median budget of its own
weekday (`model/budget-memory.ts`), which the removal above does **not**
forbid: that fallback invented a window the main page did not have, while this
is the user's own recorded hours and the two screens still read one value.

Three properties are the whole of it, and none is optional. It is **derived, not
assigned** — from the boot fold plus the viewed day, so every later day answers
without a second read. It is **not persisted until the day is saved for a reason
of its own**: `#availableHours` is `number | null`, `null` is the untouched
state, and the autosave's dirty test reads that raw field — a prefill in the
dirty test writes a phantom session for every future day the user merely looks
at, which then drives the calendar, `DaySummary`, analytics' `plannedHours` and
Burnout Risk from a budget nobody declared. The two writes that _are_ saves for a
reason of their own — the autosave payload and `moveTaskToTomorrow`'s
destination — record the effective hours, so "unset" is `null` in exactly one
place. And it is **0 on a past day**, which no prefill may back-fill: an
unplanned day had no budget, and saying otherwise is the app inventing the user's
history.

The boot read is **awaited before the day is presented** (`#boot`), started
alongside the routines and flow reads so it costs no serial round trip. Deriving
it does not make that optional: `+page.svelte` remounts the constraints bar on
`{#key session.loadedDate}` and the bar snapshots `isOpen` at mount, so a day
that lands before its budget opens the panel against 0 and fills in behind it.
Awaiting is safe only because the read catches its own failure (above): the day
must not wait on a history read that can take it down.

The **switch cost and the capacity pools carry over the same way** (ROADMAP item
32, `model/constraint-memory.ts`), with three differences that are the whole of
that item. It is **last declared, not a weekday median** — hours are
weekday-shaped, a switch cost and a capacity are properties of the person, and
the calendar says nothing about those. Each field answers from **its own latest
day**, because pools are optional in storage and the newest day may have none.
And a **stored day keeps its own**: absent pools on a stored day are the
constants that day ran with (`metric/history.ts`, `session-history.ts`), so
carrying today's into it would re-score a day the user already worked — item 18
depends on that. That absence is kept as absence, in memory (`null`, answered by
`#openingPools`) and through every write, including the destination of a defer:
writing the constants a day merely opens on would read as a declaration to
`constraint-memory.ts` and outrank the user's own, older one, pinning untouched
future days to 4/6. A day a write CREATES records the pools it opens on, the
rule its hours follow — the difference is whether the day already existed
without them.
A **blur is not a declaration**, and that rule is one method for all four fields:
`#declare(value, prefilled)` returns `null` while the field still says what it was
already showing. `NumberInput` reports on blur whether or not the value moved, so
without it a tab through the panel stores the day — the phantom session the `null`
above exists to prevent, reached by a touch instead of by a look. It governs the
hours field too, which is where the hole was open before the other three existed.
There is **no past-day rule** here: an unseen past day is read-only, saves
nothing, and showed an invented constant before this existed, so a branch would
guard nothing. The one limit is storage's: `switchCost` is not optional in a
stored session, so what carries is the cost the last stored day _ran with_, which
is the only declaration there is.

The same read carries the title→rating map and the tag vocabulary, which are
**boot snapshots**: `readHistoryPrefills(today)` runs once at load, so a title
rated or a tag typed within the session is not offered until the next load, and
both keep the boot day's answer while another date is viewed.

### A task moves between days only via `moveTaskToTomorrow`

Tasks live inside their day's `DailySession` record, so a move is two writes:
append to tomorrow's session (a read-modify-write through `$readSessionByDate` /
`$updateSession` — the only store write that does not target the viewed day),
then drop from today's `#tasks` (persisted by the normal autosave). In that
order and without a transaction on purpose: the failure mode is a visible
duplicate, never a vanished task.

What travels is definition and provenance only — a fresh id in the destination
day's id space (observation joins are per-date, so ⚡ and 🪫 stay with the day
that measured them), no `mustDoToday`. The method refuses completed and
`mustDoToday` tasks, no-ops mid-navigation (`#loadedDate !== #selectedDate`) and
serializes with itself (two overlapping read-modify-writes on tomorrow would
drop one task). Destination is hard-coded to `selectedDate + 1`: the advice
card's "To tomorrow" button is the only caller, it never means anything else,
and tomorrow is never the day on screen — an arbitrary-date move would have to
answer that (YAGNI). The advice reading itself stays a counterfactual: the
model prices "off today", only the button commits to a destination.

The destination record is also **read** for a preview — the card's day-level
"what tomorrow already holds" line (ROADMAP item 21) — and both go through
`#readDestination`, which owns the fallbacks a day with no record opens on
(R3: the line would otherwise print hours the write does not use). The preview
refuses on the move's own guards and answers `null` on a failed read, which is
`#readHistoryPrefills`' policy: the advice it sits under is priced on today and
still correct.

A reading about a day OTHER than the viewed one cannot key its freshness off
that day's inputs — today → tomorrow (edit it) → today fingerprints
identically — so `#writeGenerations` counts landed session writes **per date**
(every session write goes through `#persistSession`) and anything held across
days keys on `writeGenerationFor(that day)`. Not one counter: today's own
auto-save then withdrew a reading it cannot have affected. A `SvelteMap` and not
a `Map`, because it is mutated per write rather than replaced — a plain one
would not re-derive its dependents. Where a defer sends is
`deferDestinationDate`, read by the move, the preview and that key.

Its whole-past sibling is `pastWriteGeneration`, one counter over every day
already past, because the reading it keeps fresh folds all of them in a single
pass: no per-date count can withdraw it, since the write that invalidates it may
land on any finished day.
