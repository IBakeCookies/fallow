# Censored-likelihood stopping fit

**Status:** decided against 2026-08-21 · **Roadmap:** item 4

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Outcome — built, measured, refused (2026-08-21)

The fit below was implemented and scored against the shipped drop-censored one by
`scripts/censored-stopping-fit.probe.ts`. **The kill criterion at the bottom of
the Scenarios list fired**, so the estimator was reverted and only the
instrument, one export (`stopBracket`) and the measurement shipped. MATH.md
§8.10 and [ROADMAP.md](../../ROADMAP.md) item 4 carry the numbers; the three that
decided it:

- mixed cell RMSE gain **0.0437** λ₀ at n = 12, 40% of the 0.110 gate
- **all-completed days alone make the fit worse** (0.0974 → 0.1224, bias −0.011 →
  −0.102): their `λ₀ ≤ hi` is violated on 0.2% of days but sits far above the
  truth, so the term is loose, not informative — and that category being ordinary
  was this item's entire case
- a sliver day's `λ₀ ≥ lo` is violated **100%** of the time: a sub-step day is an
  interruption, which the inversion censor already reads that way

Everything below is what was decided on the planning date, unchanged.

## Goal

A day that ran to the end of its declared window, or that ended with every task
ticked off, reveals a real bound on λ₀ (`λ₀ ≤ hi`) and today contributes
nothing — §8.10 drops it whole. After this, such a day enters the λ₀ fit as the
one-sided term it is, so a user whose days habitually fill the window gets a
fitted stopping value instead of the prior, and the Stopping Calibration card's
used-day count rises to include those days.

## Scenarios

All model math with no click, so these are Claims. The level for every one is
the model unit suite beside the code
(`src/lib/business/model/zenith-energy.test.ts`,
[docs/testing.md](../testing.md)'s first row); the two numbers that move get a
probe. No store or component change is planned — `fitStoppingValue`'s signature
and both call sites (`session-history.ts`, `energy-lab-store.svelte.ts`) are
untouched — so nothing is asserted at those levels.

**Four Claims are `(pin)`** — they assert what this change must not move, so
they go green on their first run against the code as it stands, and that is
their pass condition. Each is phrased through `fitStoppingValue`, never through
the new `stopBracket`, so it can run before that export exists.

### Claim (pin) — a day with no censored days fits bit-identically to today

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a history of two-sided days only (the existing §8.10 fixture days)
- **Then** `fitStoppingValue` returns the same `value` as the shipped closed
  form to 12 decimal places
- **Then** it returns the same `valueStd` to 12 decimal places
- **Then** `usedCount` is unchanged

### Claim — a worked-to-the-window-edge day now fits λ₀

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the `edge` day of the existing "drops censored and uninformative
  days" test — 6 h logged against a 6 h window, so no step fits and `lo` does
  not exist
- **Then** `fitStoppingValue([edge], prior, …)` reports `fitted: true`
- **Then** its `usedCount` is 1
- **Then** its `value` is at most the prior, because the day's evidence is
  `λ₀ ≤ hi` and that day's `hi` sits below the prior

### Claim — a day that ends with every task checked off fits λ₀

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a day with hours logged, room left in the window, and
  `openTaskIds` empty
- **Then** the bracket has an `hi` and no `lo`
- **Then** `fitStoppingValue` reports `fitted: true` with `usedCount` 1

### Claim — a sliver day bounds λ₀ from below

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the `sliver` day of the same existing test — 0.5 h logged against
  an 8 h window, so no task carries a whole step and `hi` does not exist
- **Then** the bracket has a `lo` and no `hi`
- **Then** `fitStoppingValue([sliver], prior, …)` reports `fitted: true`
- **Then** its `value` is at least the prior

### Claim (pin) — a vacuous lower bound is still dropped

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a sliver day whose best next step has a non-positive marginal, so
  the reading is `λ₀ ≥ 0`
- **Then** `fitStoppingValue` on that day alone reports `fitted: false`
  (`λ₀ ≥ STOP_FIT_MIN` is vacuous)

### Claim (pin) — a day with neither bound is still dropped

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the `empty` day of the same existing test — nothing logged at all
- **Then** `fitStoppingValue([empty], prior, …)` reports `fitted: false` and
  falls back to the prior

### Claim (pin) — an inverted day past the margin is still dropped

`src/lib/business/model/zenith-energy.test.ts`

- **Given** the `grind` day already pinned at §8.10's margin (lo ≈ 0.91,
  hi ≈ 0.26)
- **Then** `fitStoppingValue` on that day alone reports `fitted: false` — it
  contributes no term, one-sided or otherwise
- **Then** the mild-inversion day beside it still enters, at the same midpoint
  and `usedCount` 1

### Claim — a one-sided day is worth less than a two-sided one

`src/lib/business/model/zenith-energy.test.ts`

- **Given** one two-sided day, and the same history plus one one-sided day
- **Then** the posterior std after adding the one-sided day is smaller than
  before it
- **Then** that std is larger than the std after adding a two-sided day whose
  point equals the one-sided day's bound

### Claim — the fit is unique and deterministic

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a history mixing two-sided, upper-bound and lower-bound days
- **Then** two calls return identical values bit for bit
- **Then** the returned `value` lies within `[STOP_FIT_MIN, STOP_FIT_MAX]`
- **Then** the derivative of the objective at the returned value is zero to
  solver tolerance, or the value sits on a bound

### Claim — the censored fit recovers a known λ₀ better than dropping the days

`scripts/censored-stopping-fit.probe.ts` → MATH.md §8.10

- **Given** simulated users at true λ₀ over {0.3 … 1.3} as in
  `scripts/stop-margin-fit-error.probe.ts`, its five day kinds extended with
  the three reachable censored kinds (window-filled, all-completed,
  sliver-only), at n = 3 and n = 12 days per user, seeded
- **Then** report λ₀ recovery RMSE for the shipped drop-censored fit and for
  the censored likelihood, per cell
- **Then** report the share of simulated days each arm uses, and the share of
  users who get `fitted: true` at all
- **Then** report separately the all-censored cell — users whose every day is
  one-sided, where the shipped arm returns the prior and has no fit to compare
- **Then** kill the feature if RMSE does not improve by more than the
  instrument's own resolution (§8.10's 0.110 bracket half-width, against
  σ₀ = 0.25) on the mixed cell

### Claim — the one-sided term's bound direction is respected

`scripts/censored-stopping-fit.probe.ts` → MATH.md §8.10

- **Given** the same simulated users, split by whether their true λ₀ satisfies
  each censored day's revealed bound
- **Then** report how often a one-sided day's bound is violated by the truth
  that generated it — the reconstruction's own error rate on the censored
  categories, which the two-sided bracket-coverage probe never measured

## Out of scope

- **Inverted-past-margin days as `λ₀ ≤ hi`.** §8.10 measured them landing at
  the task curves' characteristic marginal regardless of the truth, so their
  `hi` is contaminated in a consistent direction. They stay dropped.
- **Moving or removing `STOP_INVERSION_MARGIN`.** Settled 2026-08-13 by
  ROADMAP item 28: not derivable, left at 0.25, and the censoring rule
  unchanged. This change does not touch it.
- **Zero-work days.** They are unreachable, not excluded: `readFinishedDays`
  builds a day only from a 🪫 log with `hours > 0`
  ([session-history.ts:226](../../src/lib/business/session-history.ts#L226)),
  so a planned day with nothing logged never becomes a `StopObservation`.
  Reaching them means widening the join the §12 audit shares, and a day with no
  log is indistinguishable from a day the user did not log on.
- **Jointly estimating σ with λ₀.** σ stays fixed at `STOP_NOISE_PRIOR_STD`.
- **Fitting V_T.** Settled in §8.10; unchanged.
- **New UI copy.** The used-day count rises and λ₀ ± std moves; no card
  distinguishes one-sided days, so no new labels and no translations.
- **Validating the censored-day share against a real history.** No export
  exists on this machine, the same block that stalled ROADMAP items 15 and 16.
  This ships on parameter recovery, which the simulation is qualified for, and
  the realized share stays a declared limit.

## Read before building

- [`src/lib/business/model/zenith-energy.ts:1919-1964`](../../src/lib/business/model/zenith-energy.ts#L1919-L1964)
  — `stopIndifferencePoint`: where `lo` and `hi` are computed and where each
  censored category returns `null`, discarding which side existed
- [`src/lib/business/model/zenith-energy.ts:2190-2228`](../../src/lib/business/model/zenith-energy.ts#L2190-L2228)
  — `fitStoppingValue`: the closed form, the σ̂² blend and the posterior std
- [`src/lib/business/model/zenith-energy.ts:1822-1880`](../../src/lib/business/model/zenith-energy.ts#L1822-L1880)
  — `STOP_PRIOR_STRENGTH`, `STOP_NOISE_PRIOR_STD`, `STOP_FIT_MIN`/`MAX`,
  `STOP_INVERSION_MARGIN` and the docblocks that must stop saying all five
  categories are dropped
- [`src/lib/business/model/zenith-energy.ts:1982-2023`](../../src/lib/business/model/zenith-energy.ts#L1982-L2023)
  — `reconstructStopDay`: `candidates` is `openTaskIds`, which is why an
  all-completed day has no `lo`
- [`src/lib/business/model/zenith-energy.test.ts:1478-1560`](../../src/lib/business/model/zenith-energy.test.ts#L1478-L1560)
  — the two pinned tests this changes: `edge` and `sliver` stop being dropped,
  `empty` and `grind` do not
- [`src/lib/business/session-history.ts:219-275`](../../src/lib/business/session-history.ts#L219-L275)
  — `readFinishedDays` and `toStopObservations`: which days can reach the fit
  at all, and where `openTaskIds` comes from
- [`scripts/stop-margin-fit-error.probe.ts`](../../scripts/stop-margin-fit-error.probe.ts)
  — the simulation harness to extend (users, day kinds, RMSE reporting) and its
  replica-validation pattern against the shipped function
- MATH.md §8.10 — the **Censoring** paragraph (whose parenthetical is this
  item), **The fit** block, and the "Probe results … censored/empty/sliver days
  drop to `fitted: false`" line, which this makes false
- MATH.md §8.7 / §8.9 — the ν₀ noise blend and posterior-std construction this
  fit reduces to when nothing is censored
- [`src/lib/business/model/AGENTS.md`](../../src/lib/business/model/AGENTS.md)
  — where this repo prices its interfaces. `stopBracket` is a new public export
  in that layer, and the arithmetic for it belongs there, not in this file
- [`scripts/PROBES.md`](../../scripts/PROBES.md) — add the probe's row;
  `probe-registry.mjs --check` fails lint without it
- [`docs/testing.md:233-251`](../testing.md#L233-L251) — seed the sweep, date
  the number, pin one fixture in the suite
- [`src/lib/business/model/AGENTS.md:188-202`](../../src/lib/business/model/AGENTS.md#L188-L202)
  — the interface arithmetic behind "`zenith-energy.ts` is not worth splitting",
  which prices public surface: this change adds one export (`stopBracket`), and
  that section is where the count is tracked and re-measured
- [`ROADMAP.md`](../../ROADMAP.md) — **item 4's own description is wrong** (see
  Decisions) and is corrected in the landing commit alongside marking it
  shipped; item 28's closing paragraph names this fit as where the remaining
  value is

## Decisions

**MATH.md §8.10 owns the two formulas below from the landing commit onward
(R7).** They are written out here because the builder needs them before §8.10
carries them, and this file is frozen at land while §8.10 is not: if the two
ever disagree, §8.10 is right and this is a snapshot of what was decided today.
What is durable here is the **rejected** half of each decision, which is the
part git cannot reconstruct.

- **A Tobit-style one-sided Gaussian term, σ fixed at
  `STOP_NOISE_PRIOR_STD` = 0.25.** Minimize, over
  `[STOP_FIT_MIN, STOP_FIT_MAX]`:

  ```text
  J(λ) = [ Σ_two (mᵢ − λ)² + λ_p·(λ − λ₀_default)² ] / (2σ₀²)
         − Σ_upper log Φ((hiᵢ − λ)/σ₀)
         − Σ_lower log Φ((λ − loᵢ)/σ₀)
  ```

  Rejected: estimating σ jointly with λ₀, because σ̂² is currently derived
  _after_ the point fit from the residual scatter, and letting the censored
  terms feed it makes the fit circular for a second parameter §8.10 does not
  claim to identify.

- **The scaling is chosen so nothing moves for existing users.** With no
  one-sided days, `∂J/∂λ = 0` is exactly
  `(Σmᵢ + λ_p·λ₀_default)/(n + λ_p)` — σ₀ cancels, so the shipped closed form
  is reproduced bit for bit rather than approximately. Rejected: rescaling the
  prior term to unit weight, which would move every current fit.

- **Solved by bisection on `J′` over the fit bounds.** `J` is strictly convex —
  quadratics plus `−log Φ` of an affine argument, and the Gaussian is
  log-concave — so the minimizer is unique and there is no local-minimum risk
  and no starting point to choose. Rejected: Newton from the closed-form
  value, which buys iterations on a fit that runs once per `$derived` and costs
  a divergence case to reason about.

- **`Φ` is hand-rolled next to the fit.** The repo has no statistics dependency
  (two runtime deps, both Vercel analytics) and needs one function; a
  `log Φ` via a cited rational approximation is smaller than a dependency and
  than an accuracy claim nobody checks. Its own test asserts the approximation
  against known values and that `log Φ` stays finite deep in the left tail.

- **Posterior std keeps σ̂² and gains an effective count.** σ̂² stays
  `(ν₀σ₀² + Σ_two (mᵢ − λ̂)²)/(ν₀ + n_two)`, and
  `std = √(σ̂²/(n_eff + λ_p))` with
  `n_eff = n_two + Σ_one-sided h(z)(h(z) + z)`, `h = φ/Φ`, `z` the day's
  standardized distance from its own bound. That factor is the term's own
  contribution to `J″` and lies in (0, 1), so a one-sided day shrinks the ± by
  less than a two-sided day — the claim above. Rejected: a pure Laplace std
  `σ₀/√(J″)`, which discards the residual-scatter blend and would move the ±
  every existing user already sees.

- **`stopIndifferencePoint` keeps its signature; a new `stopBracket` carries
  the two bounds.** The bracket is what the fit now needs and
  `{ lo, hi }` names it in §8.10's own vocabulary (R3). The midpoint function
  becomes a thin wrapper over it, because four committed probes import it and
  two validate their replicas against it.

- **`usedCount` counts every day that contributes a term.** The Stopping
  Calibration card and the Analytics "Your model" card both print it, and both
  read it as "days this fit used", which stays true. Rejected: keeping it at
  two-sided days, which makes the count silently disagree with the fit.

- **ROADMAP item 4's own sentence is wrong on two of its three categories, and
  the correction lands with this change.** It reads "worked-to-edge, zero-work
  and inverted days currently drop out of the §8.10 fit". Zero-work days never
  reach the fit at all (`readFinishedDays` skips a log with `hours <= 0`, so
  such a day is not an observation), and inverted-past-margin days stay dropped
  on purpose per §8.10 and item 28. The categories this actually recovers are
  worked-to-the-window-edge, every-task-completed and sliver-only. ROADMAP is
  the living document, so item 4's text is fixed in the landing commit, not
  reported as a note (AGENTS.md §0).

- **If the mixed cell fails the gate but the all-censored cell clears it
  widely, this item does not ship on that.** A fit that only helps users whose
  every day is one-sided is a different, narrower feature; it comes back
  scoped to that rather than landing under this gate.

## Open questions

None.
