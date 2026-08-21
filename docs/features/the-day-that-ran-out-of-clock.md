# The day that ran out of clock

**Status:** landed 2026-08-21 · **Roadmap:** M42 (ROADMAP.md:669)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A day that ran out of wall clock stops being read as a day the user chose to
stop. Today `total` reads WORKED hours in both stop readings, so a day whose own
log moments describe a span with no room for another 45-min step still enters
the λ₀ fit as a voluntary stop — `lo` at the truth, `hi` +0.264 above it, the
midpoint halfway up — and the live card can name a session longer than the
clock the day has left. After this the fit censors that day, the Stopping
Calibration card says how many days it censored for that reason, and the
advisor never prices a session the day cannot hold.

## Scenarios

The Stopping Calibration card's body is inline in `energy/+page.svelte`, not in
`calibration-card.svelte` — the calibration cards share a shell, not a body
(AGENTS.md §4) — so its copy is reachable at the e2e level and nowhere below it.
That is the level M37 read the same card family at.

### Scenario — the Stopping Calibration card says how many days ran out of clock

`e2e/energy-lab.e2e.ts`

- **Given** past days logged with 🪫 ratings, at least one of them a day whose
  logged span leaves no room for another step
- **When** the Stopping Calibration card is read
- **Then** a line names the censored days as not counted

### Scenario — a fit with nothing censored shows no such line

`e2e/energy-lab.e2e.ts`

- **Given** past days logged with 🪫 ratings, none of them censored for clock
- **When** the Stopping Calibration card is read
- **Then** no censored-day line is on the card

### Scenario — the censored day does not move the fitted value

`e2e/energy-lab.e2e.ts`

- **Given** the two profiles above, identical but for the censored day
- **When** the fitted free-time value is read on each
- **Then** the two values are equal

### Claim (pin) — the window-edge censor reads worked hours today

`src/lib/business/model/zenith-energy.test.ts`

- **Given** `zenith-energy.test.ts:1628`'s `overrun` day — 3 h worked inside a
  9 h logged span of an 8 h window, one open task
- **Then** `stopIndifferencePoint` returns a number

This is the behaviour the change inverts, phrased through the surface that
exists today so it runs against the old code. It goes red when the censor
lands, and its replacement is the claim below.

### Claim — a day whose logged span leaves no room for a step reveals no indifference

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the same `overrun` day
- **Then** `stopIndifferencePoint` returns null

### Claim — the censor reads the UNCAPPED span, not the reconstruction's

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a day whose logged gaps sum to more than
  `windowHours − worked − DEFAULT_STEP_HOURS`, so `loggedStructure` scales them
  down
- **Then** `stopBracket` returns null

### Claim — a batch-logged day is unaffected

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the batch-logged variant of the same day (every 🪫 row written at
  day's end, so `loggedStructure` returns null)
- **Then** `stopBracket` returns the bracket it returns today

### Claim — `window-full` still reads worked hours

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the `overrun` day
- **When** `adviseStop` runs on it
- **Then** the verdict is not `window-full`

### Claim — the advisor never prices a session past the day's remaining clock

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a day of 3 h worked inside a 6 h logged span of an 8 h window, one
  open task — worked hours leave room for six steps, the span for two
- **Then** `adviseStop`'s `sessionHours` is at most 2 steps

### Claim — a day whose span is already past the window is advised on at one step

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the `overrun` day — 3 h worked inside a 9 h span of an 8 h window,
  so worked hours leave room for six steps and the span leaves room for none
- **Then** `adviseStop` returns a priced session of exactly one step

### Claim — what the censor buys and what it costs

`scripts/stop-block-structure.probe.ts` → MATH.md §8.10

- **Given** the probe's existing grid — 120 slider-drawn days × λ₀ ∈
  {0.1 … 1.1}, every task through `toEnergyTask` from integer sliders, read on
  the `logged` arm against the oracle
- **Then** it prints the share of priced cells the censor drops
- **Then** it prints the bracket's containment-failure rate with the censor and
  without it
- **Then** it prints the signed error on the censored class, per λ₀ and pooled

The three scratch figures §8.10 and ROADMAP M42 carry — 25.4% of priced cells,
containment 13.8% → 4.0%, signed +0.124 with `hi` +0.264 above truth — are
unquotable under ROADMAP item 29's rule until this arm prints them. Whatever it
prints replaces them in §8.10 with its date, and the numbers are expected to
move: the scratch run rebuilt the bracket from exported parts, this arm reads
the shipped `stopBracket`.

### Claim — the advisor's invited session, measured before and after

`scripts/stop-advisor.probe.ts` → MATH.md §8.11

- **Given** the probe's existing walk of 120 slider-drawn days
- **Then** it prints the count of priced checkpoints whose session exceeds the
  day's remaining clock

§8.11 states 143 over the whole walk, 61 under a `continue` verdict, from
scratch. This arm makes the count committed, and it must read 0 after the cap.

## Out of scope

- **`window-full` on the recovered extent.** The verdict gate stays on worked
  hours. A user whose worked hours leave room must not be told the window is
  full because of a gap the reconstruction inferred.
- **`STOP_INVERSION_MARGIN` and the inversion censor.** A dead end
  (`business/model/AGENTS.md:170`); untouched.
- **The censored likelihood.** A settled no (`business/model/AGENTS.md:175`,
  MATH.md §8.10). The day this change censors is dropped, not entered one-sided.
- **The structure-recovered day count.** ROADMAP item 4's leftover obligation is
  a different count on the same card, and stays unbuilt. This change adds one
  count, not a breakdown.
- **The other 🪫-fed readings.** §11.9 carry-over, the §12 audit and the α/r
  fits read worked hours for their own reasons and are not in this diff.
- **`stop-margin-fit-error.probe.ts`'s off-surface generator.** ROADMAP M40's
  last open generator; still its own change.
- **The fallback path.** A batch-logged day has no span to read, so the censor
  cannot fire on it. Named in MATH.md, not fixed here.

## Read before building

- MATH.md §8.10 — the rest-cap bullet at `MATH.md:2097`, which states the class,
  both scratch figures, and that the ruling is filed rather than taken. This is
  the section the change rewrites, same commit (R7).
- MATH.md §8.11 — the worked-hours `room` rule at `MATH.md:2565` and the
  measured cost paragraph under it. The rule survives for `window-full` and
  stops applying to the session lengths priced.
- MATH.md §10 — the revision-log entry the correction adds; the 2026-08-19
  entry at `MATH.md:3437` is the one that filed M42.
- `src/lib/business/model/zenith-energy.ts:1951` — `stopBracket`, whose
  `nextStep` guard (`day.total + step <= observation.windowHours`) is the
  window-edge censor.
- `src/lib/business/model/zenith-energy.ts:2088` — `loggedStructure`, where
  `room = max(0, windowHours − total − DEFAULT_STEP_HOURS)` and
  `scale = min(1, room/restTotal)`. `scale < 1` **is** M42's class; the uncapped
  span the censor must read is `total + restTotal`, which nothing outside this
  function currently has.
- `src/lib/business/model/zenith-energy.ts:2141` — `trimRest`, and the
  `StopDayReconstruction` docblock at `:2011`, which asserts the rule this
  change qualifies.
- `src/lib/business/model/zenith-energy.ts:2313` — `adviseStop`, whose
  `room = floor((windowHours − day.total)/step)` both gates `window-full` and
  bounds the `m` loop. Those two uses come apart here.
- `src/lib/business/model/zenith-energy.ts:2381` — `fitStoppingValue`, which
  drops a null point and reports `usedCount`. The new count is its output.
- `src/lib/business/model/AGENTS.md:163` — "`total` … reads WORKED hours, never
  the recovered extent: a verdict may not turn on recovered structure." Half of
  this stops being true and the rule must be re-stated as the two readings, not
  one. Cited here because the change also moves a public export.
- `src/lib/business/session-history.ts:446` — `fitStoppingValue`'s caller; the
  `StoppingValueFit` it returns reaches the card through
  `CalibrationSnapshot.stopping`.
- `src/routes/(app)/energy/+page.svelte:673-696` — the Stopping Calibration
  card, its three branches, and `stopFit.usedCount` at `:692`.
- [`the-lab-fit-that-read-todays-logs.md`](the-lab-fit-that-read-todays-logs.md)
  — M37, landed 2026-08-21 in this same code. Read its out-of-scope list first:
  it names the λ₀ fit as untouched (its window is
  `readStopObservations(session.today)`, for its own reason) and M42 as
  unreachable from it, so nothing about which days reach `fitStoppingValue`
  moved. Its scenarios are also the level precedent above.
- `src/routes/(app)/energy/+page.svelte:577-584` — M37's deferred-log line on
  the drain card: `{#if count > 0}` around one
  `<p class="mt-text-sm text-xs text-ty-silent">`, outside the `FitRow` group and
  above the reset row, with a singular/plural key pair. The censored-day line is
  that shape on the stopping card.
- `messages/en.json:483-486` — the card's existing four strings; and `:461-462`,
  `:481-482` — M37's `energy_drain_pending` / `energy_rest_pending` pairs, the
  naming and pluralisation the new keys follow. New keys in all five locale files
  (`de`, `en`, `es`, `fr`, `zh`).
- `src/lib/business/model/zenith-energy.test.ts:1626-1628` — the pinned
  worked-hours test whose comment states the rule; it splits into the two claims
  above.
- `src/lib/business/model/zenith-energy.test.ts:2694` — the `window-full` pin,
  which must keep passing unchanged.
- `scripts/stop-advisor.probe.ts:345-352` — the one-step replica of `adviseStop`
  and the comment stating the worked-hours rule. The replica must move with the
  cap or the probe's zero-mismatch gate goes red for the wrong reason.
- `scripts/stop-block-structure.probe.ts` — the on-surface §8.10 instrument that
  hosts the new arm; its header states why it exists and what its arms are.
- `scripts/PROBES.md:35` — `stop-block-structure`'s row, and `stop-advisor`'s;
  both descriptions gain the new arm.
- `ROADMAP.md:669` — M42's entry, which collapses to a date and a link to this
  file. Its half-closed neighbours M39 and M40 stay open and must not be
  collapsed with it.
- [docs/testing.md](../testing.md) — the level table (`:26-34`) and the reviewer
  table (`:195-199`): this diff touches `business/model` and user-visible
  behaviour, so it gets a full reviewer pass with the MATH.md §.

## Decisions

- **The fit censors on the day's uncapped span; the advisor's verdict does
  not.** M42 asks one question of a value two readings share, and the answer is
  different for each. §8.10's censor decides whether a finished day is
  _evidence_, and no user reads it — so the accuracy argument wins there.
  §8.11's `window-full` is a sentence shown to someone who still has hours, so
  the "a verdict may not turn on recovered structure" rule wins there. Rejected:
  moving both, because it would tell a user with worked hours left that their
  window is full on the strength of an inferred gap; and moving neither, because
  the class carries 48 of 61 containment failures, 47 of them one-signed HIGH,
  and leaving it is what let "absorbed as noise" survive a year one level up.
- **The advisor's session LENGTHS are capped by the span even though its verdict
  is not.** §8.11's measured cost of the worked-hours rule is not the verdict —
  it is that on 142 of 445 at-stop checkpoints the card names a session longer
  than the clock the day has left, 61 of them under `continue`. Capping `m` pays
  that cost without moving the gate. Rejected: leaving it, because the user's
  ruling put it in scope and it is the same day, the same reconstruction and the
  same commit.
- **A day with no span left is still advised on, at one step.** The cap floors
  at one step rather than returning `window-full`, which is what keeps the two
  halves of the ruling consistent. Rejected: `window-full`, which is the gate
  change this spec refuses; and null, which would blank the card on the last
  checkpoint of the day — the one a user reads to decide whether to keep going.
- **The censored count is the model's, not the card's.** The class is only
  computable inside the reconstruction (`loggedStructure`'s `restTotal` exists
  nowhere else), so `fitStoppingValue` counts it and `StoppingValueFit` carries
  it. Rejected: a presentation-layer recount, which is R1 and R2 both, and would
  need the reconstruction in a component.
- **The line follows M37's shape but must not reuse its sentence.** M37 landed
  a deferred-log line on the drain and recovery cards the day before this was
  planned, and it rejected "letting `usedCount` drop them silently" for the same
  reason this count exists — so the markup, the key naming and the
  singular/plural pair are settled precedent to copy. The WORDING is not: M37's
  rows are counted from tomorrow and will count later, and a day censored for
  clock is dropped for good. Copying "counted from tomorrow" onto this line would
  state the opposite of what happened. Rejected: a shared component for the two
  lines, which is R3 anticipated rather than observed — one `<p>` twice is not
  the second real duplication of anything.
- **The count is one number, not a breakdown of every censor.** The card's
  existing copy already lists the other four reasons a day drops out in prose
  (`messages/en.json:486`); this adds the one number the change makes non-obvious
  — days the fit stopped using — and does not turn the card into a table.
  Rejected: a full censor histogram, which is item 4's leftover plus three more
  counts nobody asked for (AGENTS.md §0).
- **Every figure this change touches must be printed by a committed probe before
  it is quoted.** §8.10's 25.4% / 13.8% → 4.0% / +0.124 / +0.264 and §8.11's
  143 / 61 are all scratch, and ROADMAP item 29's rule is explicit. The two
  probe arms are therefore part of the change, not a follow-up, and the
  scratch numbers are replaced by whatever the arms print — not confirmed by
  them.
- **The cause, for the record.** Neither reading had a bug. `total` was made to
  mean worked hours on purpose, and both readings were pinned to it in the same
  breath; what was never separated is that one of them is an estimator and the
  other is a sentence. M42 is the residual of that conflation, and the sign is
  the tell: M38's fix moved the bias LOW, this one reads HIGH, so a mean over
  both cancels.

## What landed, and what moved that this file did not plan

The figures live in MATH.md — §8.10's clock-censor bullet, §8.11's session-cap
paragraph, and the §10 entry dated 2026-08-21 — because they are the model's
record, not this file's. What belongs here is the five places the plan and the
code disagreed:

- **The censor drops the day whole; it does not blank one side.** `stopBracket`
  returns null before it reconstructs, so a censored day is not one-sided
  evidence. The worked-to-the-edge day still reveals `λ₀ ≤ hi`, unchanged: the
  censor needs a RECOVERED span to fire, and that day has none.
- **`trimRest` was deleted, which this file did not foresee.** A session capped
  to the clock the day has left cannot overhang the window, so the trim that paid
  for the overhang had no reachable input left. Its day-level pin moved with it
  (2.25 h → the 1.5 h the day had room for), and §8.11 records what comes back if
  the cap is ever loosened.
- **The advisor claim's witness needed a second, unlogged task.** As specced —
  one open task, already logged — the day prices one step with or without the
  cap, because growing a warm session has a falling marginal. The claim only
  discriminates with a fresh open task in the day, so the test carries one.
- **The over-clock count does not read 0 after the cap, and must not.** A day
  with less than a step of clock left is still advised on at one step, by this
  file's own ruling, so the committed count keeps those. What reads 0 is the
  count PAST that floor: 5 before, 0 after.
- **Three probe replicas of §8.10 had to take the censor, and this file named
  none of them.** `stop-inversion-margin`, `stop-margin-fit-error` and
  `rv13-stop-insertion` rebuild the bracket from exported parts; two of them
  validate the rebuild against the shipped reader and printed **INVALID** the
  moment the censor shipped without them. That is the gate working, and it is the
  real cost of this change: the app's own plans fill their windows, so they ARE
  the censored class, and every figure those instruments print for a planned day
  moved. §10's entry lists what was re-read.

## Open questions

None.
