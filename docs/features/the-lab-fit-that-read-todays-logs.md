# The Lab fit that read today's logs

**Kind:** feature · **Status:** landed 2026-08-21 · **Roadmap:** M37 (§33)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The Energy Lab's drain and recovery calibration cards print the α and r the app
is actually planning under. Today's 🪫/☕ logs are named beside the fit as
counted from tomorrow, instead of being silently folded into it — which is what
made the Lab's α disagree with the same fit on `/` and on `/analytics`.

## Scenarios

### Scenario — a rating logged today does not move the drain fit

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab with one cognitive drain observation dated today
- **When** the store's `cognitiveDrainFit` is read
- **Then** `fitted` is false

### Scenario — the same rating dated yesterday does move it

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab with the same observation dated the day before today
- **When** the store's `cognitiveDrainFit` is read
- **Then** `fitted` is true

### Scenario — a break logged today does not move the recovery fit

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab with one rest observation dated today
- **When** the store's `recoveryFit` is read
- **Then** `fitted` is false

### Scenario — the deferred drain rows are counted, not dropped

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab with two drain observations dated today and one dated yesterday
- **When** the store's deferred drain count is read
- **Then** it is 2

### Scenario — the deferred rest rows are counted separately

`src/lib/business/store/energy-lab-store.svelte.spec.ts`

- **Given** a Lab with one rest observation dated today and none earlier
- **When** the store's deferred rest count is read
- **Then** it is 1

### Scenario — the drain card says why today's rating changed nothing

`e2e/energy-lab.e2e.ts`

- **Given** a task deployed on `/`, then one 🪫 rating logged on `/energy` today
- **When** the drain calibration card is read
- **Then** a line names the one rating as counted from tomorrow
- **Then** the cognitive drain row shows no fitted α
- **Then** no `Apply my fits` button is on the page

### Scenario — the rating fits on the next day

`e2e/energy-lab.e2e.ts`

- **Given** that same rating, with the page's clock advanced past midnight
- **When** `/energy` is reloaded
- **Then** the cognitive drain row shows a fitted α
- **Then** no deferred line is on the drain card

### Scenario — the recovery card says the same of a break

`e2e/energy-lab.e2e.ts`

- **Given** one ☕ pair logged on `/energy` today
- **When** the recovery calibration card is read
- **Then** a line names the one pair as counted from tomorrow

## Out of scope

- **The stop advisor.** `#stopAdvice` reads today's drain rows deliberately —
  §33's state half, and the same read `daily-plan-store.svelte.ts:42` names as
  legitimate. It keeps every row it has.
- **The λ₀ stopping fit.** Already excludes today, through
  `readStopObservations(this.#session.today)`, for its own reason (an unfinished
  day has not revealed its stop). Nothing here touches it and its exclusion is
  not re-explained as a §33 consequence.
- **The Lab's conditioning on the current sliders.** `#drainLawParams` feeds the
  fit from the live params rather than the defaults, unlike
  `calibrateEnergyParams`; that is intentional (dragging recovery re-fits) and
  stays. The date filter is the only difference being closed.
- **The `Drain ratings · N` / `Rest pairs · N` reset rows.** They count what
  is stored, because they price a delete, not a fit. Unfiltered.
- **M39 and M42.** The other two open §8.10 code questions. Neither is reachable
  from this change.
- **A second number.** The unfiltered fit is not shown anywhere as a preview of
  what tomorrow will say.

## Read before building

- MATH.md §33 (`MATH.md:7800`) — the rule, its identity/state split, and the
  copy paragraph at `:7842` that this change extends to the Lab's two cards. The
  `### Pinned in the suite` list at `:7853` gains the Lab's spec.
- `src/lib/business/store/energy-lab-store.svelte.ts:573`, `:584`, `:619` — the
  three unfiltered fit inputs (`toCognitiveDrainObservations`,
  `toPhysicalDrainObservations`, `toRestObservations`). `#hasFit` at `:674` is
  what makes the Apply button disappear on a today-only log with no new state.
- `src/lib/business/store/daily-plan-store.svelte.ts:42-50` — the filter to
  copy, comment included: it already names the Lab's advisor as the state read
  that stays.
- `src/lib/business/session-history.ts:436-444` — the same filter on the
  analytics card, with the reason this defect matters ("would print an α the
  main page is not using").
- `src/lib/business/store/session-store.svelte.ts:190-197` —
  `pendingFlowLogCount`, the shape the two new counts follow.
- `src/routes/(app)/energy/+page.svelte:546-590` (drain card) and `:593-648`
  (recovery card) — where the deferred line lands. Both cards keep their
  `length === 0` empty branch: a today-only log is a rendered card with an
  unfitted row, not the empty state.
- `messages/en.json:140-141` and `:343` — `model_status_pending`,
  `model_status_pending_one` and `ana_model_note_flow_pending`, the two existing
  wordings of this sentence. New keys in all five locale files.
- `src/lib/presentation/utils/calibration-descriptor.ts:91-104` — the analytics
  precedent for naming pending logs beside a count rather than in it.
- `e2e/energy-lab.e2e.ts:379`, `:893`, `:962` — three tests that log today and
  assert the fit moves. All three must seed the log before today; they cannot
  stay as written.
- `e2e/day-navigation.e2e.ts:59-93` — the `page.clock.install()` /
  `fastForward('25:00:00')` precedent those rewrites use.
- `src/lib/business/AGENTS.md:336-349` — the `EnergyLabStore` section. It says
  the Lab is a today-only instrument; it now also says which of its reads are
  causal, since that is the sentence whose absence made M37 a lead rather than a
  bug.
- `ROADMAP.md:625` — M37 collapses to its date and a link to this file.
- `docs/testing.md:26-34` — the level table behind the split above.

## Decisions

- **The Lab is bound by §33.** The three identity fits filter to
  `date < session.today`. Rejected: a carve-out naming the Lab as a calibration
  surface that sees every log immediately. The Lab's `energyParams` setting is
  read by the Lab alone, so the carve-out was defensible — but the card is
  labelled as the user's fitted drain rate, and two screens printing a different
  number under that label is the defect, whichever one is downstream.
- **Deferred logs get a line per card.** Rejected: letting `usedCount` drop them
  silently. §33 already requires this of the budget bar and the analytics card
  for the same reason — without it the rule reads as a broken button, and the
  user who just logged sees nothing acknowledge it.
- **A today-only log shows an unfitted row, not a provisional number.**
  Rejected: printing the unfiltered fit marked "not yet in effect". That is a
  second number on screen and a second thing to keep true, and `#hasFit` already
  hides Apply with no new state.
- **The filter stays inline at each of the three sites.** Rejected: a shared
  `beforeDate` helper. It is one date comparison, and the rule it implements
  lives in §33, cited from each site — which is what the two existing copies in
  `daily-plan-store.svelte.ts` and `session-history.ts` already do.
- **No formula moves, so no probe.** The fits, their conditioning and their
  ordering are untouched; only the row set reaching them changes. §33's cost
  paragraph already prices the filter at one `.filter`.
- **`session.today`, not `selectedDate`.** The Lab refuses a dated URL
  (`energy/+page.ts`), so the two are the same value there and `today` is the one
  that says why.

## Open questions

None.

## What shipped

- `EnergyLabStore`'s three identity fits filter their rows to
  `date < session.today`, inline at each of the three sites, under one comment
  citing MATH.md §33. The stop advisor, the λ₀ fit's own window and the reset
  rows' stored counts are untouched.
- Two new counts, `pendingDrainLogCount` and `pendingRestLogCount`, shaped after
  `pendingFlowLogCount`, and a line on each calibration card naming the deferred
  rows ("1 rating logged today, counted from tomorrow" / "1 break logged today,
  counted from tomorrow") in all five locales.
- **Five** e2e tests logged today and then applied the fit, not the three the
  read-list above found: `energy-lab.e2e.ts`'s reload test and
  `task-editing.e2e.ts`'s "a drain rating logged from the main page feeds the
  Lab" are the other two, in a file the read-list never names. All five carry the
  log past midnight with `page.clock`, and each then deploys a task on the new day
  — the cards sit behind one.
- MATH.md §33's copy paragraph names the Lab's two cards and its suite list names
  `energy-lab-store.svelte.spec.ts`; `business/AGENTS.md` now says which of the
  Lab's reads are causal and which reads today. No formula, constant or bound
  moved.
