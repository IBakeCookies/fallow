# Next-task suggestions

**Kind:** feature · **Status:** landed 2026-09-04 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The day has hours left and the user is opening the add-task form to fill them,
with nothing typed yet. After this, that empty form already shows the three
titles from their own history that today's plan would give the most hours to —
ranked 1 to 3, each with the hours it would get — and picking one fills the form
the way a typed title already does.

It answers the question the form cannot: not "what would this task cost me"
(that is the reading panel once you type) but "of the work I already do, what
fits the room I have left".

## Scenarios

### Scenario — the empty form is already looking

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an add-task form with no title typed, on a day whose plan leaves
  unspent hours
- **When** the form renders and the search has not settled
- **Then** the panel says it is ranking, and offers no control to start it

### Scenario — the suggestions are named and numbered, best first

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** a panel handed three ranked suggestions
- **When** it renders
- **Then** the three titles appear in the order they were handed, highest first,
  each carrying its 1-to-3 rank

### Scenario — each suggestion says what the day would give it

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** a panel handed a suggestion the plan funds 1.5 h
- **When** it renders
- **Then** that row reads its hours through `formatDuration`

### Scenario — picking one fills the form

`e2e/next-task-suggestions.e2e.ts`

- **Given** a day with unspent hours and a history holding a rated title
- **When** the user opens the form and clicks a suggestion
- **Then** the title field holds that title
- **And** the three sliders hold the ratings that title was last saved with

### Scenario — a picked suggestion is still the user's to change

`e2e/next-task-suggestions.e2e.ts`

- **Given** a filled form from a picked suggestion
- **When** the user moves a slider and submits
- **Then** the task is added with the moved value

### Scenario — today's own tasks are not offered back

`src/lib/business/model/metric/next-task-suggestion.test.ts`

- **Given** a title memory whose highest-scoring title is already on today's list
- **When** suggestions are calculated
- **Then** that title is absent from the result

### Scenario — a day with no room says so

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** a panel on a day whose plan leaves under one block unspent
- **When** it renders
- **Then** it says the day has no room rather than showing an empty list

### Scenario — a first profile has nothing to rank

`src/lib/business/model/metric/next-task-suggestion.test.ts`

- **Given** an empty title memory
- **When** suggestions are calculated
- **Then** the result is empty

### Scenario — the search says it is working

`src/lib/business/store/daily-plan-store.svelte.spec.ts`

- **Given** a store with a day and a title memory
- **When** the suggestion search is started
- **Then** the suggestions read empty until it settles, and hold the ranking
  after — there is no separate busy flag, because that reading is the same fact

### Scenario — reopening the form re-ranks against the day as it now stands

`src/lib/business/store/daily-plan-store.svelte.spec.ts`

- **Given** a settled search, and then a change to the day's budget
- **When** the search is started again
- **Then** the previous suggestions are gone while it runs, and the ones that
  land are the new day's

### Scenario — deploying re-ranks the panel behind the open dialog

`e2e/next-task-suggestions.e2e.ts`

- **Given** a suggestion picked and deployed, with the dialog still open
- **When** the panel renders its unnamed-draft state again
- **Then** the deployed title is gone from the suggestions and the rest are
  re-ranked against the day it just joined

### Scenario — a second request while one is in flight is dropped

`src/lib/business/store/daily-plan-store.svelte.spec.ts`

- **Given** a suggestion search already in flight
- **When** a second is started
- **Then** the second returns without starting another search

### Claim — the order is the objective's, not the memory's

`src/lib/business/model/metric/next-task-suggestion.test.ts`

- **Given** a day and a set of candidate titles
- **Then** the result is those candidates sorted by descending Σ v·P̄ of the day
  with that candidate prepended, a tie falling through to the most recently used
  and then to the memory's own order

### Claim — ranking a menu per day is worth more than naming one title

`scripts/next-task-shape.probe.ts`

- **Given** 300 seeded days, the 186 with slack, and a menu of eight rated
  titles
- **Then** the per-day winner beats always naming the modal winner on 87 of
  them, p90 +26.46% of Σ P̄ — the gate this feature was built on, already run

### Claim — the ranking costs no more than the advice card already does

`scripts/next-task-shape.probe.ts`

- **Given** the capped candidate count against a day at the task counts the
  add-task dialog can be open on
- **Then** the search's wall clock stays below the 109–124 ms per-candidate band
  `business/AGENTS.md` measures for `suggestPlanAdjustments` — roughly 0.2–9 ms
  per candidate, read as a range over three runs and not as a figure

## Out of scope

- **Recommending a task SHAPE rather than a title.** The gate probe's arm B
  found the best demand pair does move with the day — with which pool is
  _larger_, and with the length of the leftover window — but its answer is "add
  your most demanding task", which is the higher-peak-curve mechanism reading as
  advice. Not built, and not because it was unmeasured.
- **Enjoyment and importance in the ranking.** The same probe pins both on their
  own boundary on 100% of days. A recommendation naming them says "care more,
  enjoy it more" every morning.
- **Suggesting that a task be added at all.** ROADMAP's not-proposed list
  refused that: adding never lowers Σ P̄, so it would dominate every axis and
  read "add more work". This ranks only once the user has already opened the
  form.
- **Reordering the typed-title dropdown.** `suggestTitles` stays alphabetical
  over the query; its docstring's argument against a silent top-N is about the
  query case and is not disturbed.
- **A staleness flag on the panel.** The advice card carries `isAdviceStale`
  because it sits on the page while the day is edited. This panel cannot go
  stale on screen: it re-ranks on every mount and the dialog covers the day
  while it is up, so the reading is withdrawn and re-solved rather than
  labelled.
- **Remembering a title's importance.** `TitleRating` holds the three sliders
  and this change does not add a fourth; a picked suggestion arrives at the
  form's own importance default.

## Read before building

- `src/lib/business/model/metric/draft-impact.ts` — `calculateDraftImpact` and
  `DraftTask`: the one-solve pricing of a hypothetical task, and the rule that
  the draft is PREPENDED because `addTask` prepends and input position breaks
  the allocator's ties. The ranking scores each candidate the same way.
- `src/lib/business/model/title-memory.ts` — `latestRatingsByTitle`,
  `TitleRating`, `normalizeTitle`. Note the map is keyed date-ascending but
  `Map.set` keeps a re-seen key's ORIGINAL position, so its iteration order is
  first-seen, not recency; the cap below needs a recency field this file does
  not yet carry.
- `src/lib/business/model/AGENTS.md` — the model's public exports are priced
  there, and both the new ranking module and a widened `TitleRating` are that.
- `src/lib/business/AGENTS.md` — the two sections that decide where this
  computation lives: "Plan advice is computed on demand, never in a `$derived`"
  (N solves, 109–124 ms each on a 12-task day) and "The add-task draft is priced
  in a `$derived`, unlike the advice" (1 solve). This is N solves, so it takes
  the first shape and the section needs the third case written into it.
- `src/lib/business/store/daily-plan-store.svelte.ts` — `computeAdvice` is the
  pattern to copy exactly: the busy flag, the re-entrancy guard, the yield
  before the search so the busy state paints, the `logError` catch because the
  only caller is a fire-and-forget click handler. `previewDraft`/`draftImpact`
  is the neighbouring wiring the panel already reads.
- `src/routes/(app)/+page.svelte` — the `addTaskForm` snippet and the
  `PlanAdviceCard`'s `oncheck={() => plan.computeAdvice()}`; the new control is
  wired the same way, from the page, because R2 bans an awaited call inside a
  component `$effect`.
- `src/lib/presentation/component/task-form-preview.svelte` — the panel this
  renders in, and its rule that the panel labels and bands what the store
  solved.
- `src/lib/presentation/component/task-form.svelte` — `DEFAULT_RATING`, and how
  a picked title already fills the draft, which is the gesture a picked
  suggestion reuses.
- `scripts/next-task-shape.probe.ts` — the gate. Read its READ paragraphs before
  changing what is ranked or how.
- `docs/testing.md` — the level table; component behaviour is a story `play`
  function, the store needs `*.svelte.spec.ts`.

No MATH.md section changes: every number here is `zenithGain.optimized` under
§0's objective, computed by the existing solve.

## Decisions

- **Rank titles, do not describe a shape** — the gate probe's arm C is the arm
  with a name in it, and a name is something the user can act on without
  translating. Rejected: arm B's demand pair, because "add your most demanding
  task" is the mechanism, not advice.
- **Three suggestions, not one** — the probe found 4 distinct winners over 186
  days and the top pick beats the constant on only about half of them, so the
  model is confidently wrong about which task the user wants often enough that
  one name overstates it. Rejected: the full ranked list, because a list of
  every remembered title is a backlog, which ROADMAP refused.
- **Hours, not a percentage** — `DraftImpact.suggestedHours` is already the
  number the user acts on. Rejected: a Σ P̄ delta column, because Σ P̄ always
  rises when a task is added, so every row would carry a positive number that
  cannot distinguish anything.
- **Eight candidates, most recently used** — one full solve each, against the
  109–124 ms per-candidate worst case `business/AGENTS.md` measures. Eight is
  also the menu size the gate probe measured, so the +8.26% mean is the figure
  that sizes exactly this many. Rejected: scoring all of title memory, because
  the cost is unbounded in the user's own history.
- **`TitleRating` gains the date it was last used** — the cap needs recency and
  `latestRatingsByTitle` already iterates date-ascending, so it is one
  assignment. Rejected: taking the map's iteration order, because that is
  first-seen order and would hand a long-lived profile its eight OLDEST titles
  every time.
- **The panel names its own scope** — it says the suggestions come from the
  user's recent titles, so a title that was not scored is not silently missing.
  This is `suggestTitles`' own argument against a silent top-N, honoured by
  disclosure rather than by removing the cap.
- **Run on dialog open, not behind a control** — a button the user has to find
  and press before the panel says anything makes the reading opt-in, and the
  held result then survives the dialog closing: open, rank, close, change the
  budget, reopen, and the same list is back describing a day that has moved.
  Ranking on mount has no such window, because the mount is what the reopen is.
  It is an `onMount` call and not an `$effect` — R2 bans an awaited call inside
  a component `$effect`, and this is fire-and-forget wiring, the `/energy`
  route's own `resnapshotOrder` pattern. Rejected: computing it in a `$derived`
  alongside `draftImpact`, because that section's argument turns on draft impact
  being ONE solve.

- **How a hypothetical task joins a day is exported, not restated** —
  `prependDraft` in `draft-impact.ts` owns the prepend and the synthetic id, and
  the ranking is its second caller, which is R3's own trigger. The two readings
  have to agree or the hours the panel offers are not the hours the user then
  sees priced. Rejected: repeating the rule in a comment that cites the other
  file, which is the exact phrasing R3 says to replace with an export.

- **The rows carry their rank** — three titles with hours beside them read as a
  set the user picks from; the whole content of the reading is that they are
  ORDERED, and an `<ol>` says so to a screen reader while the numeral says it on
  screen. Rejected: order alone, because nothing on the row distinguishes "best"
  from "third".
- **Today's titles are filtered out** — the day already has them, and the
  allocator would price a duplicate title as a second task rather than as the
  one on the list. Rejected: leaving them in and marking them, because the row
  the user cannot act on is the row that makes the other two harder to read.

## Open questions

None.
