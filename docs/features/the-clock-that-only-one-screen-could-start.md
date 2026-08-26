# The clock that only one screen could start

**Kind:** feature · **Status:** planning · **Roadmap:** item `none` (a follow-on to
the timer bullet already dated in ROADMAP's not-proposed list — nothing re-opens)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The session timer starts, pauses and stops from the Energy Lab as well as from
`/`, and it is the **same clock**: a session started on one screen is still
counting when the other is opened, and stopping it on either leaves one reading
that the next 🪫 editor on either screen fills. Today the controls are `/`'s
alone — a user working from the Lab can only see the minutes their session cost
by navigating away to start the clock, and back again to stop it.

## Scenarios

Scenarios marked **(pin)** assert behaviour that already ships. They go green on
their first run, which is their pass condition — the state moves out of `/`'s
`+page.svelte` and into a store, and these say the move changed nothing the user
can see.

### Scenario — the Lab's Tasks card offers the timer

`e2e/energy-lab.e2e.ts`

- **Given** today, one task, no stored timer
- **When** the Lab's Tasks card heading row renders
- **Then** a `Start timer` button is present

### Scenario — a session started on `/` is still counting on the Lab

`e2e/energy-lab.e2e.ts`

- **Given** today, one task, and the timer started on `/`
- **When** the Lab is navigated to
- **Then** a `Pause timer` button is present
- **Then** no `Start timer` button is present

### Scenario — a session started on the Lab is still counting on `/`

`e2e/energy-lab.e2e.ts`

- **Given** today, one task, and the timer started on the Lab
- **When** `/` is navigated to
- **Then** a `Pause timer` button is present

### Scenario — stopping on the Lab fills the Lab's own drain editor

`e2e/energy-lab.e2e.ts`

- **Given** today, one task, and the timer started on the Lab
- **When** `Stop timer` is clicked and that task's `Log end-of-session drain` is
  clicked
- **Then** the drain form's first number field holds a value greater than 0

### Scenario — a reading spent on `/` is gone on the Lab

`e2e/energy-lab.e2e.ts`

- **Given** today, one task, and a timer stopped at a nonzero reading
- **When** the task's drain log is saved with the filled value on `/`, then the
  Lab is navigated to and that task's `Log end-of-session drain` is clicked
- **Then** the drain form's first number field is empty

### Scenario — a reading discarded on the Lab is gone on `/`

`e2e/energy-lab.e2e.ts`

- **Given** today, one task, and a timer stopped at a nonzero reading
- **When** `Discard timed session` is clicked on the Lab and `/` is navigated to
- **Then** a `Start timer` button is present

### Scenario — the store hands back what it was seeded with (pin)

`src/lib/business/store/session-timer-store.svelte.spec.ts`

- **Given** a store constructed with a stored timer of phase `running`
- **When** `timer` is read
- **Then** it is that timer

### Scenario — a timer that did not start today reads as no timer (pin)

`src/lib/business/store/session-timer-store.svelte.spec.ts`

- **Given** a store constructed with a timer whose `startedOn` is not today
- **When** `timer` is read
- **Then** it is `null`

### Scenario — every write reaches storage (pin)

`src/lib/business/store/session-timer-store.svelte.spec.ts`

- **Given** a store constructed with no stored timer
- **When** `timer` is assigned a running timer
- **Then** the injected persist thunk received that timer

### Scenario — the timer still reads on today's Tasks card (pin)

`src/lib/presentation/component/day-actions.stories.svelte`

- **Given** today, one task, no stored timer
- **When** the heading row renders
- **Then** a `Start timer` button is present

### Scenario — a past day still offers no timer (pin)

`e2e/day-navigation.e2e.ts`

- **Given** a past day loaded by date
- **When** the Tasks card renders
- **Then** it has no `Start timer` button

### Scenario — a rollover still drops a timer left running overnight (pin)

`e2e/day-navigation.e2e.ts`

- **Given** today, one task, and a timer started and left running
- **When** the clock crosses midnight with the page still mounted
- **Then** a `Start timer` button is present

## Out of scope

- **Cross-tab sync.** Two browser tabs, one on `/` and one on the Lab, keep two
  live clocks; whichever writes last wins in `localStorage`, and the other tab
  picks it up on its next load or navigation — which is what a reload already
  does today. No `storage` event listener, and therefore no rule for what two
  tabs pressing Stop means. Asked and answered by the user during planning.
- **Sharing the open 🪫 drafts.** Navigating between the two screens still
  unmounts the page and drops any open drain editor, which releases the claim on
  the stopped reading — so the editor opened on the other screen finds the
  minutes waiting. Only the timer becomes shared state; the drafts stay each
  page's, keyed by task. Asked and answered by the user during planning.
- **Any change to the claim rule itself.** One stop funds one log,
  `claimPendingMinutes` / `spendsPendingMinutes` unchanged, corrections never
  spend the reading, a running clock funds nothing. Both screens already seed
  and spend by that one rule; this change only gives the second screen the
  controls.
- **The timer on `/analytics` or `/calendar`.** The store is app-wide because
  the `(app)` layout is where stores are built, but neither of those screens
  renders `day-actions.svelte` and neither gains a control.
- **A per-task-row timer, and attributing the reading at stop time.** Settled in
  [the-session-nobody-was-timing.md](the-session-nobody-was-timing.md) and not
  re-opened: the timer belongs to the person, and the task is named by which
  row's 🪫 editor is opened afterwards.
- **☕ rest logging from the timer.** Still structural, for the reason that file
  gives — `logRest` has no editor on `/` for the timer to fill.
- **Any change to what a 🪫 log means.** One row per session (MATH.md §18),
  appended today only, corrected by record id on any day. No MATH.md change.
- **Notifications, background ticking, a title-bar countdown, or a cap on a long
  reading.** Unchanged from the original timer.

## Read before building

- `src/lib/presentation/utils/session-timer.ts` — **splits in two**, because R1
  forbids a business store importing presentation. The pure half —
  `SessionTimer`, `runTimer`, `pauseTimer`, `stopTimer`, `getElapsedMinutes`,
  `getPendingMinutes`, `sanitizeSessionTimer` — moves to
  `src/lib/business/utils/session-timer.ts`, which is where R4's "validate on
  read, in the business layer that owns the shape" already wanted the sanitizer.
  What stays behind is the `localStorage` half and nothing else:
  `readSessionTimer`, `writeSessionTimer`, and the one declaration of
  `fallow:session-timer`. Presentation may value-import `business/utils` — it is
  pure, which is the exemption `presentation-not-to-business-model` turns on.
  `src/lib/presentation/utils/session-timer.test.ts` moves with the pure half.
- `src/lib/business/store/session-timer-store.svelte.ts` — **new**, and thin on
  purpose. Constructor takes the initial timer (a value, not a reader — the
  `browser` guard and the storage read are the layout's, as ThemeStore's two
  snapshots are) and a persist thunk. It holds one `$state`, a getter that
  returns `null` when `startedOn` is not `liveToday.value`, and a setter that
  persists. `setSessionTimerStore` / `getSessionTimerStore` per
  business/AGENTS.md's "Every store reaches a route through its `setXStore()`".
  Also needs `session-timer-store.test-harness.svelte` — docs/testing.md's table
  puts a store spec at `*.svelte.spec.ts` with a harness component.
- `src/routes/(app)/+layout.svelte` — the `setSessionTimerStore(...)` call, in
  the block that already builds `StorageStatusStore`, `SessionStore`,
  `EnergyObservationStore` and `EnergyLabStore`. It supplies the SSR guard and
  both storage calls. Note this store reports **no** storage failure: a lost
  reading costs a typed number, which is R4's `localStorage` tier and one of the
  deliberately silent reads business/AGENTS.md already lists.
- `src/lib/business/state/today.svelte.ts` — `liveToday.value`, which the
  getter reads so the midnight drop stays live under a page left open. That
  replaces the `$effect` on `/` that watched `today`; a stale entry is left in
  `localStorage` rather than cleared, because every read sanitizes by day
  anyway.
- `src/routes/(app)/+page.svelte` — loses the `sessionTimer` `$state` and **both**
  `$effect`s (the day check and the persist), and binds
  `bind:timer={timerStore.timer}` instead. Svelte 5 binds to a member expression
  through the class's get/set pair, so `day-actions.svelte` keeps its
  `$bindable` prop exactly as it is and every one of its stories stays green.
  `openDrainLog` and `saveDrainLog` keep their shape — only the argument to
  `getPendingMinutes` changes, and clearing the spent reading becomes
  `timerStore.timer = null`.
- `src/routes/(app)/energy/+page.svelte` — gains `bind:timer={timerStore.timer}`
  on its `DayActions`, and its two `readSessionTimer(session.today)` calls plus
  the `writeSessionTimer(null)` become store reads and one assignment. The
  comment above `openDrainLog` says "the timer's controls stay on `/`" and
  becomes false in this diff — AGENTS.md §0's documentation clause.
- `src/lib/presentation/component/day-actions.svelte` — the prop comment on
  `timer` says "the page owns it, because the 🪫 editor a stopped reading fills
  is the page's too". The second half still holds; the first does not. The
  `timer !== undefined` half of the render guard was the mechanism for
  withholding the control on the Lab and no caller passes `undefined` any more —
  decide whether it goes, and if it stays, say what withholds it. Otherwise this
  component is unchanged.
- `src/lib/presentation/component/day-actions.stories.svelte` — a one-line
  import move for `type SessionTimer`. Its five timer plays and its
  `whenClickable` / "close every menu before returning" rules stay as they are.
- `e2e/energy-lab.e2e.ts` — six of the scenarios above. Its existing "the day's
  Load and Save read on the Lab's Tasks card" test is the pattern for reaching
  that heading row.
- `e2e/tasks.e2e.ts` — the `localStorage.setItem('fallow:session-timer', …)`
  seeding helper near the top, which the two "stopped at a nonzero reading"
  scenarios need. It re-spells the key deliberately, as an independent oracle
  (data/AGENTS.md, "One module is about production code").
- `src/lib/presentation/AGENTS.md` — two statements this change makes false, in
  the sections that own them: "Both screens seed and spend by that one rule; the
  timer's CONTROLS are `/`'s alone", and "The state is `/`'s (`+page.svelte`),
  bound into the component". The `isToday` gate stays true and stays stated. The
  public-export half belongs here too: the new store, and the two modules the
  old `session-timer.ts` became.
- `src/lib/business/AGENTS.md` — "All eight" in "Every store reaches a route
  through its `setXStore()`" becomes nine, and the `(app)`-layout list in
  "Context is the creation rule" gains it. The persist thunk is a fourth
  injected thunk and a different kind from the three notification ones — say so
  in a line where that convention is stated, or not at all.
- `src/lib/data/AGENTS.md` — R4's `localStorage` tier names "`/`'s running
  session timer (`presentation/utils/session-timer.ts`)". The possessive goes;
  the module is still the right one, because after the split that file is the
  only thing that touches the key. The "No store talks to a storage API
  directly" rule needs no amendment and must not get one — the store never
  touches `localStorage`, the layout does, which is why the injection shape was
  chosen.
- `docs/testing.md` — the level table for the mix above, and the reviewer table
  at the bottom: this diff touches `business/store` and user-visible behaviour,
  so it is a full reviewer pass, no exceptions.
- `docs/features/the-session-nobody-was-timing.md` — read, **never edited**. Its
  "Out of scope: the timer on `/energy`" entry and its "A page's state, not a
  store" decision are what this change collects on; both said the store is one
  `setSessionTimerStore` call away when a second screen needs the reading.
- MATH.md §18 — read, not edited. It is why one stop funds one log, and that
  rule is untouched. **No MATH.md change in this commit**: no formula, constant,
  bound or fit moves.
- `ROADMAP.md` — read, **not edited**. Its timer bullet already carries the
  2026-08-22 build and its plan-value verdict is unaffected by which screens
  hold the controls. Nothing is renumbered.

## Decisions

- **A store, because the second screen arrived** — the original spec rejected
  `SessionTimerStore` on the grounds that it "buys nothing until a second screen
  needs the reading, and it is one `setSessionTimerStore` call away when one
  does". That is now the case, and it is AGENTS.md §0's own rule about cutting a
  seam at the second real caller rather than in anticipation of one. It also
  collects a duplication that already shipped: both pages spell
  `getPendingMinutes(readSessionTimer(…))` for themselves. Rejected: giving
  `/energy` its own `$state` + persist effect, which works — one page is mounted
  at a time, so `localStorage` alone would carry the clock across the
  navigation — but copies fifteen lines of state, sanitizing and persistence
  into a second route, which is R3's defect the moment it exists.
- **The store never touches `localStorage`; the layout hands it a value and a
  persist thunk** — R4's "no store talks to a storage API directly" is a hard
  rule, and its carve-out is scoped to presentation modules owning a
  presentation-tier key. Injection satisfies both: the key stays declared in
  `presentation/utils/session-timer.ts`, and the store stays testable with two
  plain arguments and no module mock — the same reason ThemeStore takes both
  appearance snapshots instead of reading `document.cookie`. Rejected: moving
  the whole module into business and letting the store own the key, which needs
  a hard rule amended for one value. Rejected: a repository, which data/AGENTS.md
  already says would put a view-preference-tier key in the data layer to no
  purpose.
- **The pure half moves to `business/utils`, not the type alone** — a
  type-only import across the layer boundary is still an import, and
  dependency-cruiser reads specifiers, not `import type`. The split lands where
  R4 already wanted it: `sanitizeSessionTimer` is a validate-on-read for a
  persisted shape, which is the business layer's by rule, and `getPendingMinutes`
  is the policy both pages ask about. What stays in presentation is exactly the
  storage call and the key.
- **`bind:timer` survives, so `day-actions.svelte` and its stories do not
  change** — the class exposes `timer` as a getter/setter pair and Svelte 5
  binds through a member expression, so the component keeps the `$bindable` prop
  it was designed with and its five plays keep passing untouched. Rejected:
  replacing the prop with `onstart`/`onpause`/`onstop`/`ondiscard` callbacks and
  moving the two transitions into the store. It reads like better depth and is
  not: the store would learn the primary/terminal button roles that only exist
  because there are two buttons, four story plays would be rewritten to chase an
  interface change no user can see, and the transitions are already pure
  functions the component composes — which is what R2 permits.
- **The midnight drop moves into the getter, and leaves the stale entry
  behind** — `/` ran an `$effect` on `today` that nulled the state and wrote
  through. A getter reading `liveToday.value` is the same guarantee with no
  effect and no ordering question, and it is reached by every caller rather than
  by whoever mounted the effect. The uncleared `localStorage` entry is inert:
  `sanitizeSessionTimer` drops any timer whose `startedOn` is not today, so it
  can never be read back. Rejected: clearing it in the getter, which makes a read
  a write.
- **No storage-failure surface** — the store reports nothing to
  `StorageStatusStore`. A lost reading costs a typed number, which is R4's
  `localStorage` tier by definition, and business/AGENTS.md already lists the
  reads that stay deliberately silent for exactly that reason. Silent still
  means logged, which `readSessionTimer` already does.
- **Two tabs are two clocks** — per the user, during planning. The store is
  per-document and no `storage` listener is added, so a second tab reads the
  timer on its next load or navigation. Rejected: live cross-tab sync, which
  needs a conflict rule for two tabs stopping the same session and buys nothing
  a person working one session at a time can use.
- **Drafts stay each page's** — per the user, during planning. Only the timer
  crosses the navigation; an open 🪫 editor still dies with its page, which
  releases its claim on the reading and is why the other screen's editor then
  opens with the minutes filled. Rejected: hoisting the two draft records into a
  store as well, which moves the claim rule, the completion prompt and both
  pages' editor lifecycle for a half-typed rating nobody asked to keep.

## Open questions

None.
