# Re-derive `STOP_INVERSION_MARGIN` from measured distributions

**Kind:** model · **Status:** landed 2026-08-13 · **Roadmap:** item 28

Backfilled 2026-08-14 from ROADMAP item 28, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Replace `STOP_INVERSION_MARGIN`'s stipulated value with one derived from
measured distributions. The kill criterion fired: the constant is not
derivable, and it stays at its shipped value.

## Scenarios

### Claim — the λ₀ fit error is flat over the margin's plausible range

`scripts/stop-margin-fit-error.probe.ts` → MATH.md §8.10

- **Given** 90 simulated users (true λ₀ on {0.3 … 1.3}, 12 days each) built
  from five day kinds — the optimizer's plan, a ±1-step mood variant, two
  interruption shapes (a tail cut and an interior run dropped mid-warm-up) and
  a grind on the weakest task — swept at n = 3 and n = 12 days per user, with
  m = 0 and m = ∞ as controls
- **Then** λ₀ fit RMSE is flat in magnitude over m ∈ [0.1, 0.5]: the largest
  movement anywhere is 0.0078 in λ₀ units (0.0012 honest and 0.0078
  contaminated at n = 12; 0.0046 and 0.0049 at n = 3)
- **Then** that movement is 7.1% and 3.1% of the 0.110 bracket half-width the
  instrument already concedes and of σ₀ = 0.25
- **Then** the kept-day share over that range — of all simulated days,
  structural censors included — moves 87.0% → 89.3% honest and 80.5% → 85.7%
  contaminated, so the margin flips almost no verdicts

### Claim — the margin cannot price the contamination it exists for

`scripts/stop-margin-fit-error.probe.ts` → MATH.md §8.10

- **Given** the same sweep
- **Then** interrupted days land at curve scale regardless of the truth (point
  p50 0.985 / 1.031 against 0.880 rational)
- **Then** contamination costs fit error (RMSE 0.0875 honest → 0.1281
  contaminated at n = 12)
- **Then** most interrupted days never invert, so no margin reaches them
- **Then** censoring nothing wins all four cells, by up to 0.0104 at
  contaminated n = 12 — the largest single movement in the sweep

### Claim — an interrupted day need not invert at all

- **Given** a suite fixture: an interrupted day generated from λ₀ = 0.3
- **Then** its bracket does not invert, reading 1.47

## Out of scope

- **Moving the constant.** `STOP_INVERSION_MARGIN` is unchanged. A movement
  this far below the instrument's resolution is no evidence to move it, and
  doing so would touch shipped behaviour and two pinned tests.
- **Changing the censoring rule.** Unchanged, for the same reason.
- **Acting on the probe's own suggestion** that inversion censoring buys the
  fit nothing. The drift is small but not zero and its sign is consistent —
  wider censors less and fits slightly better; the endpoint contrast is
  negative in all four arms and its CI excludes 0 in three — but that rests on
  one arm's margin and sits inside that arm's noise. Recorded, not acted on.
- **The censored-likelihood fit.** §8.10 already flags it; it is where the
  remaining value is, since it would actually use the one-sided days instead of
  discarding them. Not built here.
- **Moving the sweep out of the probe.** One suite fixture pins the new claim;
  the sweep itself stays in the probe.

## Where it landed

- `scripts/stop-margin-fit-error.probe.ts` — the sweep: λ₀ fit RMSE against the
  margin over the simulated users, and both kill checks.
- MATH.md §8.10 — the stopping-value calibration the margin belongs to, and the
  censored-likelihood fit it already flags as the remaining value.

## Decisions

- **The stated sweep was run in full, not narrowed** — λ₀ fit RMSE against the
  margin over 90 simulated users, five day kinds, at n = 3 and n = 12, with
  m = 0 and m = ∞ as controls.
- **"Flat" means flat in magnitude** — that is the defensible claim, not "the
  error bars overlap". The largest movement anywhere is 0.0078 in λ₀ units,
  against a 0.110 bracket half-width and σ₀ = 0.25.
- **Both kill checks were run, not eyeballed** — the flat verdict holds under
  two interruption shapes (30.8% and 28.2% invert, only 18.5% / 22.0% past
  0.25) and under a paired bootstrap of the a-priori endpoint contrast
  RMSE(0.5) − RMSE(0.1).
- **The sharper result is that the margin cannot price the contamination it
  exists for.** Interrupted days really do land at curve scale regardless of
  the truth, and contamination really does cost fit error — but most
  interrupted days never invert, so no margin reaches them. Censoring nothing
  wins all four cells.
- **The residue is recorded, not acted on.** The sign of the drift is
  consistent, so the probe's own suggestion is that inversion censoring buys
  the fit nothing — a stronger claim than "the constant does not matter". It
  rests on one arm's margin and sits inside that arm's noise. Rejected: acting
  on it, because it would touch shipped behaviour and two pinned tests on
  evidence below the instrument's resolution.
- **One suite fixture pins the new claim** — an interrupted day whose bracket
  does not invert at all, reading 1.47 against the λ₀ = 0.3 that generated it.
  The sweep stays in the probe.

## Open questions

None — landed.
