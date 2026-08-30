# Prequential ϕ scorecard — the probe

**Kind:** model · **Status:** landed 2026-08-30 · **Roadmap:** item 19

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Outcome — measured (2026-08-30)

`scripts/phi-prequential-skill.probe.ts` was built and run. Both of item 19's
kill gates are answered, in opposite directions, and **three of the six Claims
below were falsified as written** — the probe reports what it found instead of
what they predicted, and that is the record. The deferred reading is
[ROADMAP.md](../../ROADMAP.md) item 34; MATH.md §5 carries the scoring
convention and the probe header carries every number.

The gates:

- **Gate 1 (kill if MAE_fitted ≥ MAE_default through n ≈ 40) — NOT met.** The
  fitted plane beats the defaults at the first fit and at every n after it,
  settling ≈0.21 h better. There is a real reading to show.
- **Gate 2 (ship only Σδ̂² if coverage sits inside 60–75% at every n ≥ 10) —
  met.** Coverage runs 65.9–67.6% across those bins against a 68.3% nominal, so
  the band is correct and unremarkable and a coverage row would say nothing.

The three Claims the run falsified, and what replaced them:

- **Claim 2** ("the curves agree to within the run's own spread at the smallest
  n") holds at n = 0 **only**, where the fallback IS the defaults and the gap is
  identically zero. By the first log the gap is 7 run-spreads wide. The ridge
  anchors the fit at the defaults; it does not hold it there, and "≈0 at small
  n by construction" was true of one degenerate bin, not of a regime.
- **Claim 4** ("the band over-covers at small n, and the over-coverage decays")
  is false in both halves. Under a prior-matched truth the band is calibrated at
  n = 0 by construction, so there is no excess to decay. Small-n coverage
  instead reads how far the user sits from the defaults RELATIVE to the prior
  width: a user at half the prior std over-covers (86.9%), one at twice it
  UNDER-covers (45.2%), and both converge by n ≈ 10–15. Nor is the approach
  monotone — |excess| rises again in 3, 5 and 2 of the 11 steps of the three
  arms. Item 19 named σ̂² as the mechanism; the mechanism is the prior's width,
  and σ̂ moves below σ₀ as readily as above (0.250 → 0.228 at n = 2, which is
  where the coverage dip sits).
- **Claim 6**'s second half was mis-worded: "Σδ̂² sits at the σ₀² baseline"
  should have read "at the NO-OFFSET baseline, against σ₀²". It reads
  0.000037 h² against σ₀² = 0.0625 h², which is the intended result.

Two things the run added that the spec did not ask for and a reader needs:

- Σδ̂² recovers **0.849 and 0.836** of the between-title variance that survived
  the ϕ ≥ 0.1 h floor — both ≈ (1 − 1/G) with G = 6 titles, the shrinkage a
  shared plane imposes. A real-log reading is biased low by that factor, and by
  the floor on top of it where ϕ is short.
- Every coverage cell now carries its binomial Monte-Carlo error. Only the
  n = 2 dip (57.7%, 4.8 standard errors) is a real departure from nominal; the
  n = 0 cell's 65.8% is 1.4 and says nothing.

Everything below is what was decided on the planning date, unchanged.

## Goal

Nothing the user sees changes. This measures, out-of-sample, whether the fitted
ϕ plane has ever predicted a ⚡ log better than `DEFAULT_USER_CONSTANTS` did,
and whether `phiPredictionStd`'s ±1σ band covers at its nominal rate — the two
numbers ROADMAP item 19 makes the reading conditional on. It also produces
Σδ̂², the between-title residual variance, which is item 6's re-open gate.

The build is one probe, one MATH.md note and one registry row. **No reading
ships from this spec**: item 19's kill gates are decided on the numbers this
run prints, and the surface is planned separately once they are known.

## Claims

`scripts/phi-prequential-skill.probe.ts` → MATH.md §5

Prequential means: walk a ⚡ history in date order; for each log, fit on logs
dated **strictly before** its own date, aged against that date, and score the
held-out log against that fit. n is the number of logs the fit had seen, so
each claim below is read as a curve over n, not one number.

### Claim — the fitted plane's out-of-sample skill against the defaults

- **Given** seeded synthetic users whose true ϕ plane is drawn away from
  `DEFAULT_USER_CONSTANTS`, logging at the model's own noise floor
  (σ₀ = 0.25 h), swept over history lengths through n ≈ 40 and beyond
- **Then** prequential MAE of the fitted plane, and of the defaults, at each n —
  reported as both curves and their difference, with the n at which the fitted
  curve first falls below the default one

### Claim — skill is ≈ 0 at small n by construction, not by accident

- **Given** the same sweep, with the ridge prior anchored at the defaults
  (λ = 4, MATH.md §5)
- **Then** the fitted and default MAE curves agree to within the run's own
  seed-to-seed spread at the smallest n, and separate only as Σw grows

### Claim — coverage of the ±1σ predictive band

- **Given** the same walk, each held-out log scored against
  `phiPredictionStd(E, β, posterior)` of the fit that predicted it
- **Then** the share of logs falling inside ±1σ, per n, against the 68.3%
  nominal — reported for every n, and read as a verdict only at n ≥ 10

### Claim — the band over-covers at small n, and the over-coverage decays

- **Given** the same coverage curve, with σ̂² the ν₀ = 4 blend toward
  σ₀ = 0.25 h (MATH.md §5)
- **Then** coverage at the smallest n exceeds its value at the largest n, and
  the excess shrinks monotonically in Σw up to the run's noise — σ̂² is a prior,
  not a floor

### Claim — between-title residual variance, against σ₀² = 0.25 h

- **Given** the retained prequential residuals, grouped by `taskTitle`
- **Then** the between-title component of residual variance (Σδ̂²) against
  σ₀² = 0.0625 h², reported per synthetic regime — including a regime with a
  deliberate per-title ϕ offset, so the statistic is shown to detect one it is
  given

### Claim — self-check: the estimator recovers its own noise floor

- **Given** a synthetic user generated **from** the model at σ₀ = 0.25 h with
  no per-title offset
- **Then** the recovered residual scale matches σ₀ and Σδ̂² sits at the
  σ₀² baseline. A mismatch here invalidates every cell above, and is printed
  first (the `phi-error-price.probe.ts` convention)

## Out of scope

- **Any UI.** No card, row, column or copy. Where the reading lands — the
  analytics "Your model" card, its own card, the dashboard's flow calibration
  card — is deferred to a second `/plan` once the gates are answered, and so is
  whether it lands at all.
- **The ±1σ band beside the point ϕ on the task card** (`task-item.svelte`),
  which item 19 folds in. It is a separate user-visible change on both task
  screens with its own column and width questions.
- **A Σδ̂² UI row.** Probe output only.
- **Re-opening ROADMAP item 6** (per-task ϕ offsets). This spec delivers the
  gate statistic; acting on it is item 6's own decision and is settled until
  then (AGENTS.md §4).
- **A real-log arm.** Probes here are synthetic-only and read no user data.
- **Any change to `fitUserConstants`, `phiPredictionStd` or the fit's callers.**
  The probe reads the shipped functions; if it needs a seam, that is a finding
  to report, not to build.

## Read before building

- `src/lib/business/model/zenith.ts` — `fitUserConstants` (the weighted ridge,
  the σ̂² blend, `effectiveCount` = Σw), `phiPredictionStd` (σ̂² + xᵀΣx — the
  band this scores), `phiParameterStd` (the xᵀΣx half the allocator uses; NOT
  what a coverage claim scores against), `PHI_RECENCY_HALF_LIFE_DAYS`,
  `DEFAULT_USER_CONSTANTS`, `calculateFlowStateTime`, `mapEffort`,
  `mapEnjoyability`
- `src/lib/business/session-history.ts` — `fitFrom`, the causal window the
  backtest reproduces: it filters `o.date < day` and passes
  `ageDays: daysBetween(o.date, day)`. Private; the probe calls
  `fitUserConstants` directly with the same two rules
- `src/lib/business/session-history.test.ts` — "excludes the report date's own
  ⚡ logs" and "ages ⚡ logs against the report date (§5.2)". Both of item 19's
  "easy to get wrong" corrections are already pinned here; do not re-pin them
- `src/lib/data/type/index.ts` — `FlowObservationRecord`, for the row shape the
  synthetic histories imitate, `taskTitle` included
- MATH.md §5 — the posterior, λ = 4, σ̂² = (ν₀σ₀² + Σwᵢrᵢ²)/(ν₀ + Σwᵢ) with
  ν₀ = 4 and σ₀ = 0.25 h, and the predictive std. **This is the section that
  gains the scoring-convention note** (what prequential means here, what is
  held out, what MAE and coverage are computed against). Derivation only — R7:
  no run output in MATH.md, the numbers live in the probe header
- MATH.md §5.2 — the recency weights and why Σw, not n, is the data mass; the
  sweep's x-axis has to say which of the two it is plotting
- `scripts/phi-error-price.probe.ts` — the header convention (claim, figures,
  date read off its own run) and the load-bearing self-check printed first;
  also item 6's other gate, which this run's Σδ̂² completes
- `scripts/post-recency-weighting.probe.ts` — the §5.2 measurement shape and
  the reference-task convention
- `scripts/PROBES.md` — a committed probe with no row fails `npm run lint`
  (`node scripts/probe-registry.mjs --check`); the table is checked, not
  generated, so write the row by hand
- `docs/testing.md` — probes are not tests, run under `npm run probe`, and
  assertions are optional because the output is the result
- `ROADMAP.md` item 19 — correct the stale sentence named in Decisions below,
  in this change's landing commit

## Decisions

- **Probe only; the reading is a second spec.** — Item 19's gates decide
  whether anything is worth showing and, if so, which of three readings. Writing
  the card first and gating it in review means building a surface the run may
  delete. Rejected: one spec with a conditional build, because "ship the
  scorecard unless the probe says otherwise" puts the copy in the diff before
  the number that justifies it exists.
- **Item 19's two "easy to get wrong" corrections are already made in shipped
  code.** — The item warns that "`session-history.ts`'s two flow readers base
  `ageDays` on today", so a backtest must be careful to age against each log's
  own date. That mechanism moved with the causal fit window (2026-08-08):
  `fitFrom(observations, day)` is parameterized by `day` and already computes
  `date < day` plus `daysBetween(o.date, day)`. Both call sites happen to pass
  today, which is correct for them. The backtest therefore needs no new
  plumbing and no new pin — `session-history.test.ts` holds both. **Correct that
  sentence in ROADMAP item 19 in the landing commit** rather than planning
  around it.
- **The walk is by distinct log date, not by row.** — `date < day` excludes a
  log's same-day siblings, so same-date logs are all predicted by the same fit
  and n advances in date blocks. That is what the app does; scoring a log
  against a fit that saw its sibling would measure a model the user never ran.
- **Coverage is scored against `phiPredictionStd`, not `phiParameterStd`.** —
  The claim is about a NEW measurement, which carries σ̂². `phiParameterStd` is
  the allocator's hedging term and deliberately omits it (MATH.md §5.1);
  scoring coverage with it would report a band nothing predicts.
- **Synthetic only.** — Item 19 asks for "synthetic users at the model's own
  noise floor plus real logs". Probes here read no user data and none is
  committed. Rejected: an env-var arm reading a `backup-repository` JSON export,
  because it is machinery for a run that happens once and cannot be reproduced
  by anyone else — if a real-log reading is wanted, it is the shipped card's
  job, which is exactly what the gates decide.
- **Kill gates are recorded, not enforced.** — The probe prints the curves; the
  verdict against item 19's two gates (MAE_fitted ≥ MAE_default through n ≈ 40;
  coverage inside 60–75% at every n ≥ 10) goes in the probe header and is
  reported back, not asserted. A probe that fails a build on a moving number is
  the thing `docs/testing.md` separates probes from tests to prevent.

## Open questions

None.
