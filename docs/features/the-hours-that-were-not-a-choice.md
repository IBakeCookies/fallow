# The hours that were not a choice

**Kind:** audit · **Status:** landed 2026-08-28 · **Roadmap:** finding M99

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

MATH.md §8.10 reads a finished day as a leisure **choice**: the user worked those
hours and then preferred free time to every next block. A day whose hours were
**compelled** — a deadline, a promise, a task that had to be finished today —
breaks that premise, and nothing in the repo said so. §8.10's known
approximations covered partial logging, the checkbox scope, the loose `hi` max
and interruption-by-inversion; obligation was absent, even though `mustDoToday`
exists on `Task` and `toEnergyTask` drops it, and even though the same question
reaches λ₀ a second way — through the α that 🪫 ratings fit, which λ₀ conditions
on.

What closed it: `scripts/stop-obligation-bias.probe.ts`. The instrument is
unbiased on honest days and reads λ₀ LOW on compelled ones — the direction that
plans more work — and **both available repairs lose to shipping nothing**, so
the estimator did not move. What landed instead is the probe, the two §8.10
bullets that name the error and its direction, the model `AGENTS.md` settled
decision that stops it being re-opened, and one sentence in the Stopping
Calibration card's hint — the only place a user can be told the premise their
number is read under. The claims below are what the probe was built to
establish; the figures live in its header, never here (R7).

The only user-visible change is that sentence, in all five locales: every logged
hour is read as a choice, so a day you had to grind through reads as your free
time being cheap and pulls the number down. No component, store, view model or
model function changes.

### Claim — what a compelled day does to the fit

`scripts/stop-obligation-bias.probe.ts` → MATH.md §8.10

- **Given** 60 simulated users at known true λ₀ ∈ {0.3 … 1.3} × 10 days, each
  day planned by `optimizeSchedule` at that user's own λ₀ with every task drawn
  through `toEnergyTask` from integer sliders
- **Given** four readings of the same day: the plan as logged, +3 steps of grind
  APPENDED past the stop on the lowest-amplitude funded task (still open, and
  ticked off), and the day cut the moment that task is done
- **Then** signed bias, RMSE, p10/p90, kept-day share and the count of users the
  fit cannot serve are reported per reading
- **Then** the per-day movement of `lo`, `hi` and the midpoint against that same
  day's rational reading is reported, so the mechanism is visible and not
  inferred from the fit alone
- **Then** the share of days that must be compelled before the bias matters is
  reported — a user does not grind every day
- **Then** the censor that drops each dropped day is reported per reading, so
  "no censor is aimed at obligation" is a split and not an assertion

### Claim — do either of the two available repairs pay?

`scripts/stop-obligation-bias.probe.ts` → MATH.md §8.10

- **Given** the same population, read under three arms: shipped, the pinned task
  priced on **neither** bracket side (its hours still in the reconstruction), and
  the whole day censored when it worked a pinned task
- **Then** each arm is scored on the honest day as well as the compelled ones —
  a repair that fixes the grind and breaks the ordinary day is not a repair
- **Then** the kept-day share of each arm is reported beside its bias, because
  this fit's failure mode at low n is falling back to the prior
- **Then** if neither arm beats shipping nothing, that is the result: MATH.md
  states the contamination as an approximation and the estimator does not move

### Claim — the replica is the shipped reading, on both halves of the chain _(gate)_

`scripts/stop-obligation-bias.probe.ts`

The scope repair cannot be expressed through a shipped signature, so the
bracket is rebuilt from exported parts — the pattern
`stop-inversion-margin.probe.ts` and `stop-margin-fit-error.probe.ts` already
use. A midpoint-only gate is not enough: the per-day `lo`/`hi` medians and the
fitted values are both quoted.

- **Given** every day in the population, in all four readings
- **Then** the replica's TWO SIDES equal the shipped `stopBracket`'s exactly with
  the repair off, including agreeing about which days are censored
- **Then** the replica's closed form equals `fitStoppingValue`'s value over the
  shipped points, and reads `STOP_PRIOR_STRENGTH`, `STOP_FIT_MIN`,
  `STOP_FIT_MAX` and `STOP_INVERSION_MARGIN` from the model rather than
  re-stating them
- **Then** both mismatch counts are printed with the run, and a nonzero one
  invalidates every number in it

### Claim — the 🪫 rating channel

`scripts/stop-obligation-bias.probe.ts` → MATH.md §8.10

λ₀ never reads a drain rating. It reads worked minutes, log moments, the
checkbox and the window — the ratings reach it as the α they fit (§8.7).

- **Given** the rational days only, read under α scaled by 0.5 … 2
- **Then** the signed bias and RMSE of the λ₀ fit are reported per scale, so
  §8.10 feasibility 2's "this fit inherits their quality" has a size
- **Then** the direction is stated: over-rating drain reads λ₀ low

## Out of scope

- **Changing the estimator.** The claims above are what decides this, and they
  decided against. `stopBracket`, the five censors, `STOP_INVERSION_MARGIN` and
  the closed form are untouched.
- **Giving the model an obligation term.** `mustDoToday` promises the day, not
  the hours (model `AGENTS.md`); the allocator still never sees it, and after
  this neither does the fit. A task size — which is what would make "how much of
  this was compelled" answerable — is on ROADMAP's not-proposed list.
- **Fitting `terminalEnergyValue`.** Settled: user-owned, and its cost to this
  fit is `stp-stopping-identifiability.probe.ts`'s number, not re-measured here.
- **Widening `valueStd` for common-mode error.** The ± prices day-to-day scatter
  under one conditioning, and §8.10 already says so. Making it price a mis-set
  slider is a different estimator, not a note.
- **The α fit itself.** The α arm here reads λ₀ under a mis-set α; it does not
  ask whether ratings under deadline pressure are inflated. That needs a real
  history, which no export on this machine has — ROADMAP's "Where the headroom
  actually is" block, where `generate-fixture.mjs` is recorded as unable to gate
  a question about what the user habitually does.
- **A new counter on the card.** Nothing new is censored, so there is nothing
  new to count; the hint carries the premise instead.

## What it read

Sections and symbols, never line numbers — the durable address.

- MATH.md §8.10 — the **Known approximations** list, where the obligation and
  rating bullets go, and the **UI** paragraph, which gains the card's premise
  sentence. R7: no run figures in either.
- `src/lib/business/model/zenith-energy.ts` — `StopObservation`, `stopBracket`,
  `reconstructStopDay`, `bestNextStep` and `fitStoppingValue`. Read to confirm
  what the fit reads: worked hours, log moments, `openTaskIds`, the window and
  the day's task sliders. No rating, and no flag.
- `src/lib/business/session-history.ts` — `toStopObservations`, the production
  join. It is what a probe's day must be a model of.
- `src/lib/business/model/metric/calculation.ts` — `toEnergyTask` (drops
  `mustDoToday`) and `isPinned`, the one definition of the flag.
- `src/lib/business/model/AGENTS.md` — the §8.10 bullet list, which gains the
  settled decision, and the `mustDoToday` section, whose "the allocator never
  sees it" needs the fit named beside it.
- `scripts/stop-margin-fit-error.probe.ts` — the replica and its validation arm,
  the pattern this probe follows.
- `scripts/PROBES.md` — one new row; `node scripts/probe-registry.mjs --check`
  runs in `npm run lint`.
- `messages/en.json` and the four locales — `energy_stop_calibration_hint`.

## Decisions

- **A new probe, not an arm in an existing one.** `stop-margin-fit-error.probe.ts`
  already has a `grind` day kind — the whole day on the weakest task — so the
  perturbation is not new; what is new is the SHAPE of the reading. That probe
  mixes kinds into a contaminated population to sweep the inversion margin,
  while this question needs the same day read four ways against its own rational
  baseline, plus two repair arms that require a bracket the shipped signature
  cannot express. Rejected: adding both to that file, which would put the repair
  verdict on the margin sweep's population and silently widen the contamination
  axis every figure there is quoted against.
- **The obligation task is the lowest-amplitude funded task.** The case the
  question comes from is the boring thing with a deadline; making it the
  strongest task would model a different day and understate the depletion the
  grind causes. It is also the worst case for the scope repair, which is stated
  where the repair is refused.
- **Both repairs are measured, not argued.** The scope repair is the one the
  §8.10 machinery already suggests (it is exactly how a completed task is
  handled), so refusing it on reasoning alone would not have held. Rejected:
  documenting the error without pricing a fix, which leaves the next reader to
  re-derive both arms.
- **The copy states the premise, not the size.** A number on the card would be a
  measured figure quoted where nothing re-runs it, and the bias depends on how
  often the user is compelled — which the app cannot know. Rejected: a warning
  band or a suppressed fit, which would act on an error whose size is the user's
  own history.

## Open questions

- **What share of real days are compelled?** The bias scales with it and no
  export exists to read it. Until one does, the card's sentence is the only
  handle a user has.
