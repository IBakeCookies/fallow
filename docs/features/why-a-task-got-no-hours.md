# Why a task got no hours

**Kind:** feature · **Status:** landed 2026-09-01 · **Roadmap:** item 20

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

When the plan funds a task zero hours, the advice card today says only that it
happened — "2 tasks get no hours in this plan." After this, each of those tasks
is named with the one reason it got nothing: the single task you could drop that
would fund it, that an extra hour would, that a capacity pool is full, or that
nothing available reaches it.

Gated: the reading ships only if the probe below finds a mix worth printing.

## Scenarios

### Claim — the attribution mix, and the gate

`scripts/plan-advice.probe.ts` → the `plan-advice.probe.ts` row in
[scripts/PROBES.md](../../scripts/PROBES.md)

Run this arm FIRST and read it before writing any of the scenarios below.

- **Given** the 600 seeded random days this probe already builds
  (`randomDays(600, 42)`), restricted to those with at least one unfunded active
  task
- **Then** it prints the share of unfunded tasks falling to each of the four
  branches, the share of those days whose defer branch is non-empty, and the
  count of unfunded tasks scored
- **Then** the gate: **stop and report** if any single branch exceeds 80% of
  attributed tasks — the honest product is then one static sentence, not a
  per-task line — or if the defer branch is empty on most days with an unfunded
  task, which leaves only branches nobody can act on

### Claim (pin) — attribution costs no extra solve

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** any day with unfunded active tasks
- **Then** `advice.candidatesEvaluated` equals the non-pinned active task count
  plus the budget levers `buildLevers` produces — the same count as before this
  change

### Claim — the branch order

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** a task that a single defer funds AND that `budget + 1` also funds
- **Then** its reason is the defer, naming that task

### Claim — a pinned task is attributed, and is never the task named to drop

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** an unfunded task flagged `mustDoToday`, on a day where deferring one
  other unflagged task funds it
- **Then** it carries the defer reason, naming that other task
- **Then** no reason anywhere on the day names a pinned task as the one to drop

### Claim — the pool branch

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** an unfunded task that no single defer and no extra hour funds, on a
  day whose `humanCapacity.limitType` is `cognitive`, where the task's own
  mental difficulty is above 0
- **Then** its reason is the cognitive pool

### Claim — the residual

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** an unfunded task that no single defer funds, that `budget + 1` does
  not fund, and whose day has no full pool that the task draws on
- **Then** its reason is that nothing available reaches it

### Scenario — the card names the task to drop

`src/lib/presentation/component/plan-advice-card.stories.svelte`

- **Given** advice with one unfunded task whose reason is a defer of "Inbox"
- **When** the card renders
- **Then** the unfunded line names the unfunded task
- **Then** the same line names "Inbox" as the one to drop

### Scenario — a must-do task keeps its own line

`src/lib/presentation/component/plan-advice-card.stories.svelte`

- **Given** advice with one unfunded pinned task and one unfunded unpinned task
- **When** the card renders
- **Then** the pinned task's line renders in the warning colour
- **Then** the unpinned task's line renders in the secondary colour

### Scenario — every branch has a sentence

`src/lib/presentation/utils/plan-advice-descriptor.test.ts`

- **Given** one unfunded task per branch — defer, budget, pool, none
- **When** `buildAdviceDisplay` runs
- **Then** each produces its own non-null sentence
- **Then** the pool sentence contains no imperative — it states the reading only

## Out of scope

- **The task list's "No time today" group** (`task-list.svelte`,
  `list_group_unfunded`) stays a bare group. It renders from a `$derived`, and
  plan advice is computed on demand and never in one (AGENTS.md §4, Stores) —
  putting a reason on those rows would make every keystroke pay for
  `activeTasks + 3` solves.
- **A cheaper-budget branch.** `buildLevers` also solves `budget − 1` and the
  trim, and the allocator is path-dependent on `budgetBlocks`, so a _smaller_
  budget can in principle fund a task the current one does not. It is not a
  reason anybody would act on, and printing it would read as a defect.
- **Naming more than one way to fund a task.** One reason per task; the branch
  order below decides which.
- **Multi-task defers.** Only the single removals already solved are searched —
  "drop these two" is a new enumeration and a new solve.
- **Any change to `budgetMarginal`.** Its `recipient: null` still says nothing
  about why, and that stays (model/AGENTS.md, "The budget's shadow price is a
  day-level reading").
- **Prescription in the pool and residual branches.** They are readings; the
  pools are measurements of the user, not levers (model/AGENTS.md, "The switch
  cost is instrumented but never advised" — same sentence).

## Read before building

- `src/lib/business/model/metric/plan-advice.ts` — `suggestPlanAdjustments`
  builds `candidates` (one solved `DailyMetrics` per lever) and then throws them
  away except for the frontier; `buildLevers` decides which levers exist; the
  `unfunded` read and its `isPinned` partition are at the end of the same
  function. Every input the attribution needs is already in that scope.
- `src/lib/business/model/metric/daily-metrics.ts` — `DailyMetrics.activeTasks`
  and `suggestedHours` (what "unfunded" means), and `humanCapacity` on the
  baseline, which already names the binding pool with no solve.
- `src/lib/presentation/utils/plan-advice-descriptor.ts` — `AdviceDisplay`'s
  `unfunded` / `unfundedMustDo`, today two sentences built from counts.
- `src/lib/presentation/component/plan-advice-card.svelte` — the two coloured
  paragraphs those sentences render into, and the `advice_clear` condition that
  reads both.
- `src/lib/business/model/AGENTS.md` — **three sections to correct in this
  change** (AGENTS.md §0: documentation is fixed, not reported). "The budget's
  shadow price is a day-level reading" concedes that a bound pool and a task
  near `T*` "look identical from one solve" — still true of the day-level
  marginal, and now explicitly not the claim for the per-task read, which reads
  `activeTasks + 3` solves. "`mustDoToday` promises the day, not the hours"
  describes the `unfundedTaskIds` / `unfundedMustDoTaskIds` partition this change
  replaces. And the file needs the new settled decision: what the four branches
  are and in which order they are tried.
- `AGENTS.md` §4, Model — add the one-line verdict; the argument stays in
  model/AGENTS.md.
- `src/lib/presentation/AGENTS.md` — the card gains no new surface, but the
  descriptor's return shape changes from two sentences to two lists.
- `scripts/plan-advice.probe.ts` — `randomDays`, the seeded `DAYS` (600 at seed 42) and the existing `describe('plan advice')` block the gate arm joins.
- `scripts/PROBES.md` — extend the `plan-advice.probe.ts` row with the mix; the
  registry check fails `npm run lint` otherwise.
- `messages/en.json` — `advice_unfunded`, `advice_unfunded_one`,
  `advice_unfunded_must_do`, `advice_unfunded_must_do_one` are the four the
  branch sentences replace; `de`, `es`, `fr`, `zh` carry the same keys.
- `ROADMAP.md` item 20 — collapse to a date and a link at land, and correct the
  budget-branch line (see Decisions).
- `docs/testing.md` — the level table, and the reviewer row: this touches
  `business/model` and user-visible behaviour, so it takes a full reviewer pass.

No MATH.md section. The attribution is a lookup over plans the model already
solved, not a derivation — nothing here is a formula, constant, bound or fit.

## Decisions

- **Four branches, tried in this order: defer → budget → pool → none.** Defer
  first because it is the only one of the four the user can act on inside
  today's declared inputs, and the card already carries Apply for it; budget
  next because it is a lever, though an unpriced one; pool and none are
  readings. A task that two branches could explain reads as the more actionable
  of the two. Rejected: reporting every branch that applies, because a task with
  three reasons has told the user nothing.
- **The defer branch names the funding removal with the highest resulting plan
  value** when several qualify — the cheapest sacrifice, the same sense in which
  the frontier is ordered. Rejected: naming them all; rejected: naming the first
  in list order, which is arbitrary.
- **The budget branch reads the `set-budget` candidate at `budget + 1`, not
  `budgetMarginal.recipient`.** ROADMAP item 20 says "the budget branch already
  ships as `budgetMarginal`"; routing disproves it. `budgetMarginal` is one
  block (`BLOCK_HOURS`) and **open-scoped** — it is deliberately blind to
  `completed` — while the defer candidates are the full plan-scoped solve. Two
  branches of one reading on two scopes would produce a sentence pair no user
  could reconcile, and the `budget + 1` candidate is already solved beside the
  defers. Correct that ROADMAP line in the landing commit.
- **One `unfunded` array replaces `unfundedTaskIds` and
  `unfundedMustDoTaskIds`** — `{ taskId, title, pinned, reason }`. The partition
  those two arrays exist for is a _colour_ decision, and the descriptor makes it
  by filtering on `pinned`; keeping two id lists beside a third list carrying
  the same ids is the duplication R3 bans. The card's two coloured lines are
  unchanged in intent (model/AGENTS.md, "`mustDoToday` promises the day, not the
  hours").
- **`reason` is a tagged union carrying data, never a sentence** —
  `{ kind: 'defer', taskId, title }`, `{ kind: 'budget', hours }`,
  `{ kind: 'pool', limitType }`, `{ kind: 'none' }`. The words are the
  descriptor's, the same way a view model carries a `Band` and never a class
  string (AGENTS.md §4, UI).
- **A pinned task IS attributed, and the defer branch applies to it.**
  `isPinned` removes a task from the _candidates_ — it does not stop some other
  task's removal from funding it. The only invariant is the converse: no
  reason may name a pinned task as the one to drop, because it is not a
  candidate and there is no such plan to price.
- **The gate arm joins `plan-advice.probe.ts` rather than opening its own
  file.** It sweeps the same seeded days, over the same function, for the same
  card — a new probe file would duplicate `randomDays` and earn a second
  registry row for one `it`.
- **600 days at seed 42, not the ~300 the roadmap item names.** That is the
  sweep the file already builds; re-rolling a smaller one buys nothing and makes
  the arm's numbers incomparable with the rest of the file.
- **The residual branch is "no full pool", not `limitType: 'none'`.** Written
  during planning as the latter; `calculateHumanCapacity` returns `'none'` only
  for an empty plan, which has no unfunded task in it, so that Given was
  unreachable. The branch is reached whenever the binding pool is below
  `POOL_FULL_PERCENT` or the task puts no demand on it.
- **The 80% gate is on the mix over attributed _tasks_, not over days.** A day
  with four unfunded tasks is four readings the user has to make sense of, and
  it is the per-line variety that decides whether a per-task line beats one
  static sentence.

## Open questions

None.
