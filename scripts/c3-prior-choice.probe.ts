/**
 * `c₃ = 0.5` is an unmeasured prior where the article runs 0, and the statistic
 * nominated to choose between the two has one of them installed as its own prior
 * mean: `fitUserConstants`'s `fallback` is the ridge's c₀ as well as the
 * zero-log fallback, so a fitted ĉ₃ is pulled toward whichever value is already
 * there. Four numbers move: how much of a fitted ĉ₃ is the logger's own data at
 * each log count, what the wrong prior costs out of sample, what it costs in the
 * T* the user is shown and in the plan a day is solved into, and whether one
 * logger can tell from their own logs which of the two their history prefers.
 *
 * THE GENERATOR IS THE MODEL: ϕ = c₁E + c₂β + c₃ + N(0, σ₀ = 0.25 h) on sliders
 * drawn as integers 1–10 through `mapEffort`/`mapEnjoyability`, so every (E, β)
 * is one the app can produce. The drawn log is clamped at ZERO — what
 * `persisted.ts` validates `phiHours` to — and never at the 0.1 h floor, which
 * the app applies to its PREDICTION and never to a log: clamping a log there
 * would truncate the low tail, and asymmetrically across exactly the arms this
 * decision is about. Per arm the truth SETS c₃ and draws c₁, c₂ from the model's
 * own prior (σ₀/√λ = 0.125 with λ = 4). The estimator is the app's own causal
 * window, reproduced: at each distinct log date, fit on the logs dated STRICTLY
 * BEFORE it and aged against it (`session-history.ts`'s `fitFrom`, at a past
 * day), so same-date logs share one fit and n advances in date blocks. Every
 * cell is read TWICE on the same logs — once with `fallback` = the defaults,
 * once with `{...defaults, c3: 0}` — which is the whole flip, through the
 * shipped surface, with no patched module and no mock. 500 loggers × 80 logs per
 * arm, mulberry32; the plan arm is 60 loggers × one 5-task day.
 *
 * Figures below are read off THIS file's own run (2026-09-15). Every one of them
 * is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and the only assertions here. With the prior sitting
 * exactly on the truth, the rms PREQUENTIAL error at n ≥ 35 — √(σ₀² + the
 * plane's own remaining error²), deflated where the clamp fires, and not σ̂ —
 * settles at 0.2538 h (prior 0.5 on a truth of 0.5) and 0.2475 h (prior 0 on a
 * truth of 0) against σ₀ = 0.25 h, margins 0.0038 h and 0.0025 h against a
 * tolerance of 0.0125 h; ĉ₃ reads 0.4962 and 0.0088, margins 0.0038 and 0.0088
 * against a tolerance of 0.02. The non-negative clamp fires on 4.98% / 1.47% /
 * 0.31% / 0.00% of the logs at true c₃ = 0.00 / 0.25 / 0.50 / 1.00, which is the
 * asymmetry the 0-arm's larger ĉ₃ margin sits on. If either statistic missed,
 * the generator and the fit would disagree and no cell below would mean anything.
 *
 * READING 1 — WHAT A FITTED ĉ₃ ACTUALLY READS. It is a ridge blend, and the run
 * prints the share of the distance from the installed prior to the truth that
 * the blend has covered, by log count:
 *
 *     travelled             n = 0      1  10-14  30-44    65+
 *     true 0.00  prior 0.5   0.0%   6.7%  20.2%  31.8%  40.6%
 *     true 0.25  prior 0.5   0.0%   7.2%  20.0%  31.2%  40.5%
 *                prior 0     0.0%   6.7%  21.4%  35.5%  44.6%
 *     true 0.50  prior 0     0.0%   6.7%  20.6%  32.3%  41.8%
 *     true 1.00  prior 0.5   0.0%   6.8%  21.5%  34.1%  43.1%
 *                prior 0     0.0%   6.7%  21.0%  33.6%  42.8%
 *
 * After 65+ logs the fit has closed under half the distance from the installed
 * prior to the truth — 40.5% to 44.6% — so a fitted ĉ₃ is still an affine
 * function of the number it was installed with at every log count read here.
 *
 * THE ERROR LANDS IN ĉ₃; WHAT SURVIVES IT IS THE PLANE. ĉ₃ carries much the
 * largest bias of the three coefficients, and ĉ₁ and ĉ₂ move against it — the
 * intercept's column is 1 at every row while E ∈ [1,5] and β ∈ [1,2] carry the
 * variation, and both are strictly positive, so the normal equations have no
 * zero off-diagonal. All at n ≥ 65, ensemble means:
 *
 *                          bias ĉ₁  bias ĉ₂  bias ĉ₃   bias ϕ̂   sd ĉ₃
 *     true 0.00  prior 0.5 -0.0346  -0.1139   0.2969   0.0181  0.0925
 *                prior 0   -0.0084   0.0156   0.0096   0.0043  0.0906
 *     true 0.50  prior 0.5  0.0004   0.0016  -0.0030   0.0007  0.0927
 *                prior 0    0.0267   0.1312  -0.2908  -0.0125  0.0947
 *
 * A wrong prior leaves ĉ₃ off by +0.2969 where it is installed too high and by
 * −0.2908 where it is installed too low, while the plane those coefficients
 * predict with is off by only 0.0181 h and −0.0125 h. The two matched rows are
 * the control: ĉ₃ reads 0.0096 and −0.0030 there. So the intercept is the
 * direction this design informs least, and reading a c₃ decision off ĉ₃ reads
 * the one coefficient the data moves least.
 *
 * The sd column is the second reason it cannot decide: 0.0925 against 0.0906 and
 * 0.0927 against 0.0947. The posterior width barely moves with the prior while
 * the mean it is centred on moves by the biases above.
 *
 * Reading 1 is the one reading here that cannot carry a per-logger share: every
 * statistic in it is a distance to the TRUTH, and no logger has that.
 *
 * READING 2 — THE PRICE OUT OF SAMPLE, which is the decision statistic. Mean
 * prequential |ϕ − ϕ̂| in hours, both priors on the same logs, with the
 * whole-run spread of Δ across 8 disjoint logger stripes:
 *
 *     n                        0       1   10-14     65+
 *     true 0.00  prior 0.5  0.5938  0.3244  0.2219  0.2025
 *                prior 0    0.3919  0.2828  0.2094  0.1971
 *                Δ(0.5−0)   0.2019  0.0416  0.0125  0.0054
 *                ± run      0.0119  0.0056  0.0019  0.0005
 *     true 0.25  Δ(0.5−0)  -0.0178  0.0065 -0.0055  0.0002
 *                ± run      0.0108  0.0071  0.0011  0.0003
 *     true 0.50  Δ(0.5−0)  -0.2075 -0.0525 -0.0107 -0.0048
 *                ± run      0.0150  0.0067  0.0019  0.0005
 *     true 1.00  Δ(0.5−0)  -0.4501 -0.1010 -0.0368 -0.0141
 *                ± run      0.0056  0.0062  0.0018  0.0006
 *
 * The ensemble price is overwhelmingly a fresh-user price: 0.2019 h at n = 0 and
 * 0.4501 h at true c₃ = 1, against 0.0054 h and 0.0141 h by n ≥ 65. Every one of
 * those four cells is many run spreads wide, so the shrinkage is the estimator's
 * and not the seed's. The equidistant arm is the null the instrument should read
 * and does: its Δ at 65+ is 0.0002 against a spread of 0.0003.
 *
 * AND ONE LOGGER CAN READ IT, GIVEN THEIR WHOLE HISTORY. The share of loggers
 * whose OWN comparison prefers the 0.5 prior, computed two ways — on that bin's
 * held-out logs alone, and cumulatively on every held-out log they have so far:
 *
 *     true 0.00  pick bin   31.4%  39.8%  37.6%  34.0%
 *                pick cum   31.4%  29.8%  19.2%   9.4%
 *     true 0.25  pick bin   50.4%  48.9%  54.8%  48.8%
 *                pick cum   50.4%  48.9%  51.4%  49.4%
 *     true 0.50  pick bin   70.4%  62.3%  61.9%  63.4%
 *                pick cum   70.4%  73.0%  81.2%  90.4%
 *     true 1.00  pick bin   95.2%  74.0%  83.2%  86.6%
 *                pick cum   95.2%  96.8%  99.6% 100.0%
 *
 * The per-bin row converges in none of the four arms; the cumulative row
 * converges in all three where one prior is nearer, and correctly does not in
 * the equidistant one. A logger comparing two priors uses every held-out prediction
 * they have, and that comparison converges: the wrong prior is preferred by 9.4% of true-0 loggers
 * at 65+ logs, the right one by 90.4% of true-0.5 loggers and by 100.0% of
 * true-1.0 loggers from n = 20-29 on. The equidistant arm is the calibration and
 * stays on the coin throughout, 48.9%–52.4%. So a real logger's own history CAN
 * decide this, it just cannot decide it from one bin of it — and the ensemble
 * gap at 65+ (0.0054 h) is far too small to be what carries the verdict; the
 * SIGN is consistent per logger even where the size is not.
 *
 * READING 3 — THE FRESH USER, where the whole ensemble price sits. Two stop
 * times, at n = 0 (the fit IS the fallback and the posterior IS the prior, so
 * the §5.1 hedge is at its largest): `TaskAllocation.optimalHours`, the hedged
 * number the card actually shows, and the §3 closed form, which no component
 * calls. Both over all 100 slider cells:
 *
 *     hedged  gap      min 15.4 (difficulty 1, enjoyment 10) / median 54.4 /
 *                      max 58.3 (difficulty 3, enjoyment 7) minutes
 *             relative min 21.0% (10, 1) / median 43.2% / max 315.0% (1, 1)
 *     closed  gap      min 43.8 (difficulty 1, enjoyment 10) / median 52.5 /
 *                      max 53.3 (difficulty 10, enjoyment 2) minutes
 *             relative min 19.5% (10, 1) / median 38.0% / max 480.0% (1, 10)
 *
 * The number the user is shown is the hedged one: a fresh user's T* is 15.4 to
 * 58.3 minutes longer under the 0.5 prior, 21.0% to 315.0% longer in relative
 * terms, with a median of 54.4 minutes and 43.2%.
 *
 * "Hardest on easy tasks in relative terms" is a claim about a quantity, so the
 * run prints it per cell rather than asserting it. It holds in DIFFICULTY on
 * both readings and the two disagree about enjoyment (relative price %, rows
 * difficulty, columns enjoyment 1-10):
 *
 *     hedged Eᵤ = 1    315.0  286.0  227.8  214.8  202.3  190.8  180.7  172.9  169.0  157.7
 *     hedged Eᵤ = 10    21.0   21.2   21.4   21.7   21.9   22.2   22.5   22.7   23.0   23.3
 *     closed Eᵤ = 1    156.2  170.5  187.5  208.3  234.4  267.9  312.5  375.0  468.7  480.0
 *     closed Eᵤ = 10    19.5   19.7   19.9   20.2   20.4   20.6   20.8   21.1   21.3   21.6
 *
 * Down the difficulty axis the price falls by an order of magnitude on both. ALONG
 * the enjoyment axis the hedged row FALLS (315.0 → 157.7) where the closed one
 * RISES (156.2 → 480.0), so the enjoyment half of that claim is a property of
 * the unhedged form and does not survive into the number the card prints.
 *
 * The ϕ ≥ 0.1h PREDICTION floor binds in 1 of the 100 cells under the 0 prior —
 * difficulty 1, enjoyment 10 — and in none under the 0.5 prior. That is the same
 * cell BOTH gap minima sit in, 43.8 and 15.4 minutes, and the same cell the
 * closed reading's 480.0% maximum sits in. So the one floored cell is both the
 * smallest absolute price and the largest relative one, and the floor moves both
 * ends of the closed reading rather than just the end it is usually blamed for.
 *
 * THE GAP DECAYS WITH LOGS, and it decays differently for different truths —
 * median over 40 loggers × the 100 cells of the HEDGED |T*(0.5) − T*(0)| in
 * minutes, at the first causal fit whose n reaches each column, with ONE seed
 * across the four arms so their designs are identical, and the §3 closed form
 * beneath it as the control:
 *
 *     n                        0      1      5     20     40     65
 *     hedged  true 0.00    54.36  13.34   8.69   5.84   4.80   4.16
 *             true 0.25    54.36  14.24   9.23   6.17   5.03   4.27
 *             true 0.50    54.36  14.91   9.49   6.28   5.08   4.28
 *             true 1.00    54.36  15.52   9.57   6.33   5.08   4.29
 *     closed  true 0.00    52.52  14.27   9.08   6.02   4.93   4.18
 *             true 0.25    52.52  14.49   9.38   6.17   5.01   4.27
 *             true 0.50    52.52  14.58   9.47   6.23   5.04   4.27
 *             true 1.00    52.52  14.59   9.50   6.23   5.04   4.27
 *
 * With the design held identical the two fits differ by
 * (XᵀWX + λI)⁻¹·λ·Δc₀ — a function of the design and never of the measured ϕ —
 * so Δĉ is EXACTLY equal across the four arms, and the closed T* is exactly
 * linear in ϕ. The closed rows are therefore the floor's alone: the ϕ ≥ 0.1h
 * PREDICTION floor can only clamp the lower of the two ϕ̂, which happens where
 * the truth sits low and closes the gap by doing it — 14.27 against 14.59 at
 * n = 1. The hedged rows separate further in both directions, 13.34 and 15.52
 * at the same column, so the §5.1 hedge carries a dependence on where the truth
 * sits of its own, on top of the floor's. Both orderings are monotone in the
 * truth at every column from n = 1 on. Neither reaches zero — 4.16–4.29 minutes
 * hedged at n = 65, because λ = 4 pseudo-observations never leave.
 *
 * Per logger, the min-max across the 40 loggers of each logger's OWN median gap
 * is 54.4-54.4 at n = 0 (with no data every logger IS the fallback, so this is
 * one number and not an average of many), 7.2-23.5 at n = 1 and 3.7-5.1 at
 * n = 65 on the true-0 arm. The pooled median is representative by n = 65 and is
 * not at n = 1.
 *
 * READING 4 — THE PLAN PRICE, through the shipped `calculatePooledAllocations`
 * at `DEFAULT_CAPACITY_POOLS`, which is the path the app solves a day on and the
 * one a uniform intercept shift acts on hardest: it lengthens every T* together,
 * which is exactly what a capacity pool binds against. A day solved under the
 * constants each prior fits, scored under the logger's TRUE constants, against
 * the SAME day solved under the truth. Mean % below at n = 0, as 0.5-prior /
 * 0-prior, over `phi-error-price.probe.ts`'s budget grid:
 *
 *     budget     true 0.00   true 0.25   true 0.50   true 1.00
 *      1h        0.20/0.18   0.08/0.06   0.07/0.06   0.09/0.10
 *      2h        0.23/0.08   0.14/0.08   0.08/0.12   0.05/0.29
 *      4h        0.49/0.25   0.22/0.10   0.11/0.08   0.09/0.20
 *      6h        0.75/0.35   0.29/0.11   0.12/0.11   0.07/0.28
 *     10h        1.55/0.80   0.57/0.26   0.22/0.26   0.16/0.55
 *
 * One seed draws the 60 days for all four arms, so they differ only in the
 * truth's c₃ — which is exactly why they are not the same size day: mean Σ T*
 * under the truth runs 14.90 h, 17.07 h, 19.26 h and 23.64 h, so a budget is a
 * different share of the day in each and only WITHIN an arm are two cells
 * comparable. The plan price is small
 * everywhere: the worst cell over every truth, budget and log count is 1.55% for
 * the 0.5 prior and 0.80% for the 0 prior.
 *
 * THE SAME |Δϕ| IS NOT THE SAME PRICE, read where it can be read cleanly: the
 * EQUIDISTANT arm, where both priors are 0.25 off in opposite directions on the
 * same logs, the same days and the same day size. How much MORE the 0.5 prior's
 * plan costs, with the whole-run spread over 6 disjoint logger stripes, at n = 0:
 *
 *     1h 0.016±0.010   2h 0.059±0.050   4h 0.116±0.059
 *     6h 0.180±0.062   10h 0.311±0.159
 *
 * All five are positive and every one exceeds its own run spread: the prior
 * installed 0.25 h too HIGH costs the plan more than the one installed 0.25 h
 * too LOW, on the same logs and the same day. Against its own spread the gap
 * stands widest at 6 h (0.180±0.062) and narrowest at 2 h (0.059±0.050), so the
 * direction is consistent across the grid while its size is not.
 *
 * AT SMALL BUDGETS MOST LOGGERS GET THE SAME DAY EITHER WAY, and the budget is
 * the whole story: at n = 0 the share of the 60 loggers whose two plans are the
 * identical day runs 97% at 1 h, 75% at 2 h, 60% at 4 h, 35% at 6 h and 23% at
 * 10 h. (At n = 0 both plans are functions of the priors alone, so that column
 * is the same in all four arms.) What separates the two plans as the budget
 * grows is not measured here — the 15-minute block lattice and the 0.25 h switch
 * cost both act on it, and nothing printed tells them apart.
 *
 * WHAT WOULD FALSIFY WHAT. If reading 1's travelled share had reached ≈100% by
 * the log counts this run reads, ĉ₃ would be the logger's number; instead it
 * reads 40.5%–44.6% at 65+. If the prior's error had stayed out of ĉ₃, the
 * coefficient bias would have been small; instead it is the largest of the three
 * (+0.2969 / −0.2908) and it is the PLANE that survives at 0.0181 h / −0.0125 h.
 * If the cumulative pick row had stayed inside the per-bin one's band, no
 * logger could decide this from their own history; instead it runs 31.4% → 9.4% and
 * 70.4% → 90.4% while the per-bin row does not move, and the equidistant arm
 * holds the coin at 48.9%–52.4% — which is what says the convergence is signal
 * and not drift. If the T* decay had been one number whatever the truth, the
 * fresh-user gap would describe every logger; under one seed the n = 1 column
 * separates monotonically, 13.34 / 14.24 / 14.91 / 15.52. And if the plan price
 * had been large, the choice would matter past the fresh-user window; instead
 * the worst cell anywhere is 1.55%.
 *
 * A probe, not a test. Every figure moves with the ridge prior strength
 * (`RIDGE_PRIOR_STRENGTH` = 4, which is what makes a prior 4 pseudo-observations
 * that never leave), with the noise prior (`FLOW_NOISE_PRIOR_STD` = σ₀ = 0.25 h,
 * doubly — it is both the fit's floor and this generator's noise), with the
 * ν₀ = 4 blend, with the §5.2 half-life the walk ages logs under, with the
 * ϕ ≥ 0.1 h prediction floor, the slider maps, `DEFAULT_CAPACITY_POOLS` and
 * `DEFAULT_SWITCH_COST` in reading 4, and with `DEFAULT_USER_CONSTANTS` itself,
 * since the truth's c₁ and c₂ are drawn around it. Neither λ nor the §5.2
 * half-life is swept here: this reads the prior's MEAN at the shipped strength
 * and decay.
 *
 * WHAT IS A CHOICE. The truth grid {0, 0.25, 0.5, 1.0} — both candidates, their
 * midpoint, and one point past 0.5 so the 0-prior is read where it is the wrong
 * one — with no truth below 0, so the grid's worst case is 0.5 away from the 0.5
 * prior and 1.0 away from the 0 prior. The 500 × 80 volume, the 40-logger decay
 * subset and the 60-logger plan arm. The plan arm carries NO posterior on either
 * side: the axis under test is the prior's mean, and §5.1 hedging would move
 * both plans through σ̂ instead — reading 3 is where the hedge is read, and there
 * it is read through the shipped seam.
 *
 * WHAT IS A BEST CASE. The generator is the fit's own model — an exactly linear
 * plane, exactly Gaussian noise at exactly the σ₀ the fit assumes, and c₁, c₂
 * drawn from exactly the prior it shrinks toward. Every recovery above is
 * therefore the friendliest case the estimator will ever see, and nothing here
 * measures what a misspecified ϕ does to any of it.
 *
 * The rule a real decision has to be read against: ĉ₃ itself is not the decider,
 * at any log count read here. The statistic that does decide is the cumulative
 * out-of-sample comparison on one logger's whole history, and it needs a real
 * history to be run on — every share above is measured on a synthetic logger
 * whose truth is known. What the run settles without needing that: the ensemble
 * price is a fresh-user price, paid in a T* the card shows as 15.4–58.3 minutes
 * longer and 21.0%–315.0% longer in relative terms, and the plan behind it never
 * moves by more than 1.55%.
 *
 * Usage: npm run probe -- scripts/c3-prior-choice.probe.ts
 */

import { describe, expect, it } from 'vitest';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	type FitPosterior,
	type UserConstants,
	calculateFlowStateTime,
	calculatePooledAllocations,
	calculateTaskAllocations,
	calculateTotalProductivity,
	findOptimalSingleTaskTime,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
} from '$lib/business/model/zenith';

/** The stopwatch noise floor the synthetic loggers log at (MATH.md §5). */
const SIGMA_0 = 0.25;
/** σ₀/√λ with λ = 4 — the prior width c₁ and c₂ are drawn from (MATH.md §5). */
const PRIOR_COEFFICIENT_STD = 0.125;
/** Where the app floors its PREDICTION (`calculateFlowStateTime`), never a log. */
const PHI_FLOOR = 0.1;
/**
 * What a stored ⚡ log is validated to: `persisted.ts` gives `phiHours` a
 * NON_NEGATIVE validator, so three minutes is a loggable time-to-flow. Clamping
 * the generator at the PREDICTION floor instead would truncate the low tail, and
 * asymmetrically across exactly the arms this decision is about.
 */
const LOG_FLOOR = 0;
const USERS = 500;
const LOGS_PER_USER = 80;
/** Both candidates, their midpoint, and one point past 0.5 — a choice, not a finding. */
const TRUE_C3 = [0, 0.25, 0.5, 1];

/**
 * The two installable prior means. `fitUserConstants`'s `fallback` is the
 * ridge's c₀ as well as the zero-log fallback, so this IS the flip — no patched
 * module, no mock.
 */
const PRIORS = [
	{
		label: '0.5',
		constants: DEFAULT_USER_CONSTANTS,
	},
	{
		label: '0',
		constants: {
			...DEFAULT_USER_CONSTANTS,
			c3: 0,
		},
	},
];

/** Lower edges of the n bins every curve is reported over. */
const BIN_EDGES = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 65];
/** Where the ridge has stopped moving, so the self-check reads the estimator and not the prior. */
const SETTLED_MIN_N = 35;
/** Tolerances the self-check asserts, with the margin printed beside each. */
const SCALE_TOLERANCE = 0.05;
const C3_TOLERANCE = 0.02;
/**
 * Disjoint stripes every gap this run turns a claim on is read against
 * (`phi-prequential-skill.probe.ts`, claim 2). A stripe is a 1/STRIPES share of
 * the loggers, so the sd ACROSS stripes is √STRIPES times what a re-seeded whole
 * run would move by; both this file's spreads are the whole-run figure.
 */
const STRIPES = 8;
const PLAN_STRIPES = 6;
/** Sliders are integers 1–10, so every (E, β) below is one the app can produce. */
const SLIDER_NOTCHES = 10;
const DECAY_USERS = 40;
/** Log counts the T* gap is re-read at: the first causal fit whose n reaches each. */
const DECAY_N = [0, 1, 5, 20, 40, 65];
/** One seed for all four decay arms, so the DESIGN is identical across them. */
const DECAY_SEED = 0xc3de00;
const PLAN_USERS = 60;
const PLAN_N = [0, 10, 40];
const TASKS_PER_DAY = 5;
/**
 * The neighbouring price probe's budget grid (`phi-error-price.probe.ts`), so
 * the two readings are comparable — a global intercept shift is not a per-task
 * ϕ error.
 */
const PLAN_BUDGETS = [1, 2, 4, 6, 10];
/** Reading 4's cells carry two numbers each, so they need more room than an n-bin cell. */
const PLAN_COLUMN = 13;
const MILLISECONDS_PER_DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 0, 1);

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Box–Muller, so the noise floor is the model's own Gaussian one. */
function gaussian(random: () => number): number {
	return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

const isoDate = (dayIndex: number): string =>
	new Date(EPOCH + dayIndex * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);

const daysBetween = (from: string, to: string): number =>
	(Date.parse(to) - Date.parse(from)) / MILLISECONDS_PER_DAY;

const mean = (values: number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: number[]): number =>
	[...values].sort((x, y) => x - y)[Math.floor(values.length / 2)];

/**
 * The spread a whole re-seeded run would move this statistic by: the sd across
 * `stripes` disjoint stripes of the loggers, divided by √stripes.
 */
const runSpread = (perStripe: number[]): number => {
	const centre = mean(perStripe);

	return Math.sqrt(mean(perStripe.map((value) => (value - centre) ** 2)) / perStripe.length);
};

const toMinutes = (hours: number): number => 60 * hours;

const drawTruth = (random: () => number, c3: number): UserConstants => ({
	c1: DEFAULT_USER_CONSTANTS.c1 + PRIOR_COEFFICIENT_STD * gaussian(random),
	c2: DEFAULT_USER_CONSTANTS.c2 + PRIOR_COEFFICIENT_STD * gaussian(random),
	c3,
});

/** The stored ⚡ row the synthetic histories imitate (`FlowObservationRecord`). */
interface SyntheticLog {
	date: string;
	E: number;
	beta: number;
	phiHours: number;
	/** What the truth's OWN plane predicts here — the reference the plane bias is read against. */
	truePhi: number;
	/** Whether the log was clamped at the validator's non-negative floor. */
	isClamped: boolean;
}

function drawHistory(random: () => number, truth: UserConstants): SyntheticLog[] {
	let dayIndex = 0;

	return Array.from(
		{
			length: LOGS_PER_USER,
		},
		() => {
			// A quarter of logs land on a day that already has one, so the walk meets
			// the same-date blocks `date < day` groups together.
			dayIndex += random() < 0.25 ? 0 : 1 + Math.floor(random() * 7);

			const E = mapEffort(1 + Math.floor(random() * SLIDER_NOTCHES));
			const beta = mapEnjoyability(1 + Math.floor(random() * SLIDER_NOTCHES));
			const measured = truth.c1 * E + truth.c2 * beta + truth.c3 + SIGMA_0 * gaussian(random);

			return {
				date: isoDate(dayIndex),
				E,
				beta,
				phiHours: Math.max(LOG_FLOOR, measured),
				truePhi: calculateFlowStateTime(E, beta, truth),
				isClamped: measured < LOG_FLOOR,
			};
		},
	);
}

interface FitBlock {
	day: string;
	n: number;
	/** One fit per entry of `PRIORS`, on the same logs — both directions, always. */
	fits: ReturnType<typeof fitUserConstants>[];
}

/**
 * The app's own causal window, reproduced: at each distinct log date, fit on the
 * logs dated STRICTLY BEFORE it and aged against it (`session-history.ts`'s
 * `fitFrom`, parameterized by `day`), so same-date logs share one fit and n
 * advances in date blocks.
 */
function walk(logs: SyntheticLog[]): FitBlock[] {
	return [...new Set(logs.map((log) => log.date))].sort().map((day) => {
		const observations = logs
			.filter((log) => log.date < day)
			.map((log) => ({
				E: log.E,
				beta: log.beta,
				phi: log.phiHours,
				ageDays: daysBetween(log.date, day),
			}));

		return {
			day,
			n: observations.length,
			fits: PRIORS.map((prior) => fitUserConstants(observations, prior.constants)),
		};
	});
}

/** The causal fit a logger would have had once their history reached `targetN` logs. */
const fitBlockAt = (blocks: FitBlock[], targetN: number): FitBlock =>
	blocks.find((block) => block.n >= targetN) ?? blocks[blocks.length - 1];

const binIndex = (n: number): number => {
	const index = BIN_EDGES.findIndex((edge) => n < edge);

	return index === -1 ? BIN_EDGES.length - 1 : index - 1;
};

const binLabel = (index: number): string => {
	const low = BIN_EDGES[index];
	const high = BIN_EDGES[index + 1];

	if (high === undefined) return `${low}+`;

	return high - low === 1 ? `${low}` : `${low}-${high - 1}`;
};

/**
 * A running mean per (prior, n bin). The sweep accumulates instead of keeping
 * four arms × 40k prediction rows alive at once.
 */
type Grid = {
	sum: number;
	count: number;
}[][];

const emptyGrid = (): Grid =>
	PRIORS.map(() =>
		BIN_EDGES.map(() => ({
			sum: 0,
			count: 0,
		})),
	);

function record(grid: Grid, prior: number, bin: number, value: number): void {
	grid[prior][bin].sum += value;
	grid[prior][bin].count += 1;
}

const curve = (grid: Grid, prior: number): number[] =>
	grid[prior].map((cell) => cell.sum / cell.count);

/** The same mean, split by the logger's stripe, so every gap carries a spread. */
type StripedGrid = {
	sum: number;
	count: number;
}[][][];

const emptyStripedGrid = (): StripedGrid =>
	PRIORS.map(() =>
		BIN_EDGES.map(() =>
			Array.from(
				{
					length: STRIPES,
				},
				() => ({
					sum: 0,
					count: 0,
				}),
			),
		),
	);

interface Arm {
	trueC3: number;
	/** Prediction-binned: mean |ϕ − ϕ̂| out of sample. */
	mae: Grid;
	maeStripes: StripedGrid;
	/** Prediction-binned: ϕ̂ − ϕ_true at the held-out log's own (E, β). */
	planeBias: Grid;
	/** Fit-binned, one row per date block: the coefficients themselves. */
	c1Bias: Grid;
	c2Bias: Grid;
	c3Hat: Grid;
	c3Sd: Grid;
	/** Share of loggers whose own held-out error in THAT BIN alone is lower under the 0.5 prior. */
	pick: number[];
	/** The same comparison over every held-out prediction the logger has so far. */
	pickCumulative: number[];
	/** Per prior at n ≥ SETTLED_MIN_N: the two statistics the self-check asserts. */
	settledSquares: number[];
	settledSquareCount: number;
	settledC3: number[];
	settledC3Count: number;
	/** Share of the arm's logs the non-negative validator clamped. */
	clampedShare: number;
}

/**
 * Every log of one date block, scored against the two fits that block produced —
 * into the arm's ensemble grids and into the logger's OWN running comparison,
 * which is the only one they could run on their own history.
 */
function scoreBlock(
	arm: Arm,
	block: FitBlock,
	blockLogs: SyntheticLog[],
	stripe: number,
	ownError: number[][],
	ownCount: number[],
): void {
	const bin = binIndex(block.n);

	for (const log of blockLogs) {
		block.fits.forEach((fit, prior) => {
			const predicted = calculateFlowStateTime(log.E, log.beta, fit.constants);
			const error = log.phiHours - predicted;

			record(arm.mae, prior, bin, Math.abs(error));
			record(arm.planeBias, prior, bin, predicted - log.truePhi);
			arm.maeStripes[prior][bin][stripe].sum += Math.abs(error);
			arm.maeStripes[prior][bin][stripe].count += 1;
			ownError[bin][prior] += Math.abs(error);

			if (block.n >= SETTLED_MIN_N) arm.settledSquares[prior] += error * error;
		});

		ownCount[bin] += 1;

		if (block.n >= SETTLED_MIN_N) arm.settledSquareCount += 1;
	}
}

function sweep(seed: number, trueC3: number): Arm {
	const random = mulberry32(seed);

	const arm: Arm = {
		trueC3,
		mae: emptyGrid(),
		maeStripes: emptyStripedGrid(),
		planeBias: emptyGrid(),
		c1Bias: emptyGrid(),
		c2Bias: emptyGrid(),
		c3Hat: emptyGrid(),
		c3Sd: emptyGrid(),
		pick: BIN_EDGES.map(() => 0),
		pickCumulative: BIN_EDGES.map(() => 0),
		settledSquares: PRIORS.map(() => 0),
		settledSquareCount: 0,
		settledC3: PRIORS.map(() => 0),
		settledC3Count: 0,
		clampedShare: 0,
	};

	const pickTotal = BIN_EDGES.map(() => 0);

	for (let user = 0; user < USERS; user++) {
		const truth = drawTruth(random, trueC3);
		const logs = drawHistory(random, truth);

		arm.clampedShare += logs.filter((log) => log.isClamped).length / (USERS * LOGS_PER_USER);

		// The logger's own out-of-sample comparison, which is the only one they
		// could run on their own history: |error| summed per n bin, per prior.
		const ownError = BIN_EDGES.map(() => PRIORS.map(() => 0));
		const ownCount = BIN_EDGES.map(() => 0);

		for (const block of walk(logs)) {
			const bin = binIndex(block.n);

			block.fits.forEach((fit, prior) => {
				record(arm.c1Bias, prior, bin, fit.constants.c1 - truth.c1);
				record(arm.c2Bias, prior, bin, fit.constants.c2 - truth.c2);
				record(arm.c3Hat, prior, bin, fit.constants.c3);
				record(arm.c3Sd, prior, bin, Math.sqrt(fit.posterior.covariance[2][2]));

				if (block.n >= SETTLED_MIN_N) arm.settledC3[prior] += fit.constants.c3;
			});

			if (block.n >= SETTLED_MIN_N) arm.settledC3Count += 1;

			scoreBlock(
				arm,
				block,
				logs.filter((candidate) => candidate.date === block.day),
				user % STRIPES,
				ownError,
				ownCount,
			);
		}

		let cumulative0 = 0;
		let cumulative1 = 0;

		ownCount.forEach((count, bin) => {
			cumulative0 += ownError[bin][0];
			cumulative1 += ownError[bin][1];

			if (count === 0) return;

			pickTotal[bin] += 1;

			if (ownError[bin][0] < ownError[bin][1]) arm.pick[bin] += 1;

			if (cumulative0 < cumulative1) arm.pickCumulative[bin] += 1;
		});
	}

	arm.pick = arm.pick.map((picks, bin) => picks / pickTotal[bin]);
	arm.pickCumulative = arm.pickCumulative.map((picks, bin) => picks / pickTotal[bin]);

	return arm;
}

const row = (label: string, cells: string[], width = 8): string =>
	`  ${label.padEnd(13)}${cells.map((cell) => cell.padStart(width)).join('')}`;

const binHeader = (): string =>
	row(
		'n',
		BIN_EDGES.map((_, index) => binLabel(index)),
	);

/**
 * The share of the distance from the installed prior to the truth that ĉ₃ has
 * covered. Undefined where the prior IS the truth, and printed as such.
 */
const travelled = (c3Hat: number, prior: number, truth: number): string =>
	prior === truth ? '—' : `${(100 * ((c3Hat - prior) / (truth - prior))).toFixed(1)}%`;

/** The 100 slider cells every T* reading is taken over. */
const SLIDER_CELLS = Array.from(
	{
		length: SLIDER_NOTCHES,
	},
	(_, difficultyIndex) =>
		Array.from(
			{
				length: SLIDER_NOTCHES,
			},
			(_, enjoymentIndex) => ({
				title: 't',
				difficulty: difficultyIndex + 1,
				enjoyment: enjoymentIndex + 1,
			}),
		),
).flat();

/**
 * The stop time the plan card actually shows: `TaskAllocation.optimalHours`, the
 * §5.1-hedged one, read through the shipped empty-plan seam so the ϕ-uncertainty
 * cap is the app's and not a re-implementation of it. The §3 closed form beside
 * it is the pure ϕ-shift reading, and no component calls it.
 */
const hedgedStopTimes = (constants: UserConstants, posterior: FitPosterior): number[] =>
	calculateTaskAllocations(SLIDER_CELLS, 0, constants, DEFAULT_SWITCH_COST, posterior).map(
		(allocation) => allocation.optimalHours,
	);

const closedStopTimes = (constants: UserConstants): number[] =>
	SLIDER_CELLS.map((task) => findOptimalSingleTaskTime(task, constants));

/** One task as the app derives it from the sliders (`toPooledInputs`). */
const drawPooledTask = (random: () => number, index: number) => {
	// Both demand sliders admit 0, and `getEffectiveDifficulty` is what turns the
	// pair into the difficulty the model reads.
	const mentalDifficulty = Math.floor(random() * (SLIDER_NOTCHES + 1));
	const physicalDifficulty = Math.floor(random() * (SLIDER_NOTCHES + 1));

	return {
		title: `t${index + 1}`,
		difficulty: getEffectiveDifficulty({
			mentalDifficulty,
			physicalDifficulty,
		}),
		enjoyment: 1 + Math.floor(random() * SLIDER_NOTCHES),
		cognitiveWeight: mentalDifficulty / 10,
		physicalWeight: physicalDifficulty / 10,
	};
};

const arms = TRUE_C3.map((trueC3, index) => sweep(0xc30000 + index, trueC3));

/** The arm whose truth each prior sits exactly on — where the self-check reads. */
const matchedArm = PRIORS.map(
	(prior) => arms[TRUE_C3.findIndex((trueC3) => trueC3 === prior.constants.c3)],
);

describe('MATH.md §1 — whether a fitted c₃ can choose between 0 and 0.5', () => {
	it('self-check: with the prior on the truth, the prequential error settles at the noise floor', () => {
		const scales = PRIORS.map((_, prior) =>
			Math.sqrt(matchedArm[prior].settledSquares[prior] / matchedArm[prior].settledSquareCount),
		);

		const recovered = PRIORS.map(
			(_, prior) => matchedArm[prior].settledC3[prior] / matchedArm[prior].settledC3Count,
		);

		PRIORS.forEach((prior, index) => {
			console.log(
				`[§1] self-check, prior ${prior.constants.c3} on a truth of ${matchedArm[index].trueC3}: ` +
					`rms prequential error at n ≥ ${SETTLED_MIN_N} = ${scales[index].toFixed(4)} h ` +
					`against σ₀ = ${SIGMA_0} h (margin ` +
					`${Math.abs(scales[index] - SIGMA_0).toFixed(4)} h against a tolerance of ` +
					`${(SCALE_TOLERANCE * SIGMA_0).toFixed(4)} h), mean ĉ₃ = ${recovered[index].toFixed(4)} ` +
					`against ${matchedArm[index].trueC3} (margin ` +
					`${Math.abs(recovered[index] - matchedArm[index].trueC3).toFixed(4)} against a ` +
					`tolerance of ${C3_TOLERANCE}), non-negative clamp firing on ` +
					`${(100 * matchedArm[index].clampedShare).toFixed(2)}% of that arm's logs`,
			);
		});

		const valid = PRIORS.every(
			(_, index) =>
				Math.abs(scales[index] - SIGMA_0) < SCALE_TOLERANCE * SIGMA_0 &&
				Math.abs(recovered[index] - matchedArm[index].trueC3) < C3_TOLERANCE,
		);

		console.log(
			valid
				? '[§1] self-check VALID — the walk recovers the generator it was given'
				: '[§1] self-check INVALID — every cell below is measuring something else',
		);

		// Load-bearing: a walk that cannot recover σ₀ and its own c₃ from a
		// prior-matched generator is not reading the fit, and no cell below means
		// anything.
		PRIORS.forEach((_, index) => {
			expect(Math.abs(scales[index] - SIGMA_0)).toBeLessThan(SCALE_TOLERANCE * SIGMA_0);
			expect(Math.abs(recovered[index] - matchedArm[index].trueC3)).toBeLessThan(C3_TOLERANCE);
		});
	});

	it('reading 1 — what a fitted ĉ₃ reads: the logger’s data blended with the installed prior', () => {
		console.log(
			`[§1] the non-negative log clamp fires on ` +
				`${arms.map((arm) => `${(100 * arm.clampedShare).toFixed(2)}%`).join(' / ')} of the ` +
				`logs at true c₃ = ${TRUE_C3.map((value) => value.toFixed(2)).join(' / ')}.`,
		);

		console.log(
			`[§1] ${USERS} loggers × ${LOGS_PER_USER} logs per arm. ` +
				`travel = share of (prior → truth) that ĉ₃ has covered; sd ĉ₃ = √Σ₃₃ of the ` +
				`posterior; bias rows are fit-binned (ĉ) and prediction-binned (ϕ̂) means.`,
		);

		for (const arm of arms) {
			console.log(`[§1] true c₃ = ${arm.trueC3.toFixed(2)}:`);
			console.log(binHeader());

			for (const [prior, { label, constants }] of PRIORS.entries()) {
				console.log(
					row(
						`travel ${label}`,
						curve(arm.c3Hat, prior).map((value) => travelled(value, constants.c3, arm.trueC3)),
					),
				);
			}

			for (const [prior, { label }] of PRIORS.entries()) {
				console.log(
					row(
						`sd ĉ₃ ${label}`,
						curve(arm.c3Sd, prior).map((value) => value.toFixed(4)),
					),
				);
			}

			for (const [name, grid] of [
				['ĉ₁', arm.c1Bias],
				['ĉ₂', arm.c2Bias],
			] as const) {
				for (const [prior, { label }] of PRIORS.entries()) {
					console.log(
						row(
							`bias ${name} ${label}`,
							curve(grid, prior).map((value) => value.toFixed(4)),
						),
					);
				}
			}

			for (const [prior, { label }] of PRIORS.entries()) {
				console.log(
					row(
						`bias ĉ₃ ${label}`,
						curve(arm.c3Hat, prior).map((value) => (value - arm.trueC3).toFixed(4)),
					),
				);
			}

			for (const [prior, { label }] of PRIORS.entries()) {
				console.log(
					row(
						`bias ϕ̂ ${label}`,
						curve(arm.planeBias, prior).map((value) => value.toFixed(4)),
					),
				);
			}
		}
	});

	it('reading 2 — the price out of sample, and whether one logger could read it', () => {
		console.log(
			`[§1] prequential MAE in hours by n, both priors on the same logs, with the whole-run ` +
				`spread of Δ across ${STRIPES} disjoint logger stripes. pick = share of the ${USERS} ` +
				`loggers whose own comparison comes out better under the 0.5 prior — "bin" on that ` +
				`bin's held-out logs alone, "cum" on every held-out log they have up to it.`,
		);

		for (const arm of arms) {
			const curves = PRIORS.map((_, prior) => curve(arm.mae, prior));
			const distances = PRIORS.map((prior) => Math.abs(arm.trueC3 - prior.constants.c3));

			const nearer =
				distances[0] === distances[1]
					? 'neither — equidistant'
					: PRIORS[distances[0] < distances[1] ? 0 : 1].label;

			console.log(`[§1] true c₃ = ${arm.trueC3.toFixed(2)} (nearer prior: ${nearer}):`);
			console.log(binHeader());

			for (const [prior, { label }] of PRIORS.entries()) {
				console.log(
					row(
						`prior ${label}`,
						curves[prior].map((value) => value.toFixed(4)),
					),
				);
			}

			console.log(
				row(
					'Δ(0.5−0)',
					curves[0].map((value, index) => (value - curves[1][index]).toFixed(4)),
				),
			);

			console.log(
				row(
					'± run',
					BIN_EDGES.map((_, bin) =>
						runSpread(
							Array.from(
								{
									length: STRIPES,
								},
								(_, stripe) =>
									arm.maeStripes[0][bin][stripe].sum / arm.maeStripes[0][bin][stripe].count -
									arm.maeStripes[1][bin][stripe].sum / arm.maeStripes[1][bin][stripe].count,
							),
						).toFixed(4),
					),
				),
			);

			console.log(
				row(
					'pick bin',
					arm.pick.map((value) => `${(100 * value).toFixed(1)}%`),
				),
			);

			console.log(
				row(
					'pick cum',
					arm.pickCumulative.map((value) => `${(100 * value).toFixed(1)}%`),
				),
			);
		}
	});

	it('reading 3 — the fresh user’s T*, and how the gap decays as logs accumulate', () => {
		const fresh = PRIORS.map((prior) => {
			const fit = fitUserConstants([], prior.constants);

			return {
				closed: closedStopTimes(fit.constants),
				hedged: hedgedStopTimes(fit.constants, fit.posterior),
			};
		});

		const flooredCells = PRIORS.map((prior) =>
			SLIDER_CELLS.filter(
				(task) =>
					calculateFlowStateTime(
						mapEffort(task.difficulty),
						mapEnjoyability(task.enjoyment),
						prior.constants,
					) <= PHI_FLOOR,
			).map((task) => `(difficulty ${task.difficulty}, enjoyment ${task.enjoyment})`),
		);

		console.log(
			`[§1] fresh user (n = 0, the fit IS the fallback and the posterior IS the prior, so the ` +
				`§5.1 hedge is at its largest): T* under the 0.5 prior against the 0 prior over all ` +
				`${SLIDER_CELLS.length} slider cells. "hedged" is TaskAllocation.optimalHours, the ` +
				`number the card shows; "closed" is findOptimalSingleTaskTime, which no component calls.`,
		);

		console.log(
			`  the ϕ ≥ ${PHI_FLOOR}h prediction floor binds in ${flooredCells[1].length} of the ` +
				`${SLIDER_CELLS.length} cells under the 0 prior ` +
				`${flooredCells[1].join(', ') || '—'} and ${flooredCells[0].length} under the 0.5 prior`,
		);

		for (const kind of ['closed', 'hedged'] as const) {
			const cells = SLIDER_CELLS.map((task, index) => ({
				difficulty: task.difficulty,
				enjoyment: task.enjoyment,
				gap: toMinutes(fresh[0][kind][index] - fresh[1][kind][index]),
				relative: (fresh[0][kind][index] - fresh[1][kind][index]) / fresh[1][kind][index],
			}));

			const gaps = cells.map((cell) => cell.gap);
			const relatives = cells.map((cell) => cell.relative);
			const hardest = cells[relatives.indexOf(Math.max(...relatives))];
			const easiest = cells[relatives.indexOf(Math.min(...relatives))];
			const narrowest = cells[gaps.indexOf(Math.min(...gaps))];
			const widest = cells[gaps.indexOf(Math.max(...gaps))];

			console.log(
				`  ${kind} gap      min ${Math.min(...gaps).toFixed(1)} at difficulty ` +
					`${narrowest.difficulty}, enjoyment ${narrowest.enjoyment} / median ` +
					`${median(gaps).toFixed(1)} / max ${Math.max(...gaps).toFixed(1)} at difficulty ` +
					`${widest.difficulty}, enjoyment ${widest.enjoyment} minutes`,
			);

			console.log(
				`  ${kind} relative min ${(100 * Math.min(...relatives)).toFixed(1)}% at difficulty ` +
					`${easiest.difficulty}, enjoyment ${easiest.enjoyment} / median ` +
					`${(100 * median(relatives)).toFixed(1)}% / max ` +
					`${(100 * Math.max(...relatives)).toFixed(1)}% at difficulty ${hardest.difficulty}, ` +
					`enjoyment ${hardest.enjoyment}`,
			);

			console.log(
				`  ${kind} relative price per cell (%), rows difficulty 1-10, columns enjoyment 1-10:`,
			);

			console.log(
				row(
					'βᵤ',
					Array.from(
						{
							length: SLIDER_NOTCHES,
						},
						(_, index) => `${index + 1}`,
					),
				),
			);

			for (let difficulty = 1; difficulty <= SLIDER_NOTCHES; difficulty++) {
				console.log(
					row(
						`Eᵤ = ${difficulty}`,
						cells
							.filter((cell) => cell.difficulty === difficulty)
							.map((cell) => (100 * cell.relative).toFixed(1)),
					),
				);
			}
		}

		console.log(
			`[§1] the decay of the HEDGED gap: median over ${DECAY_USERS} loggers × ` +
				`${SLIDER_CELLS.length} cells of |T*(0.5 prior) − T*(0 prior)| in minutes, at the first ` +
				`causal fit whose n reaches each. One seed for all four arms, so the design — and ` +
				`therefore (XᵀWX + λI)⁻¹·λ·Δc₀ — is identical across them.`,
		);

		console.log(
			row(
				'n',
				DECAY_N.map((target) => `${target}`),
			),
		);

		const perLoggerRange: string[][] = [];
		const closedRows: string[][] = [];

		for (const trueC3 of TRUE_C3) {
			const random = mulberry32(DECAY_SEED);

			const histories = Array.from(
				{
					length: DECAY_USERS,
				},
				() => walk(drawHistory(random, drawTruth(random, trueC3))),
			);

			const byTarget = DECAY_N.map((target) =>
				histories.map((blocks) => {
					const { fits } = fitBlockAt(blocks, target);
					const times = fits.map((fit) => hedgedStopTimes(fit.constants, fit.posterior));

					return SLIDER_CELLS.map((_, cell) =>
						Math.abs(toMinutes(times[0][cell] - times[1][cell])),
					);
				}),
			);

			// The same decay on the §3 closed form, which is exactly linear in ϕ: with
			// the design held identical Δĉ is identical too, so a closed row that does
			// NOT move across the arms says the hedge is what separates the hedged
			// ones, and one that does says the ϕ floor is.
			closedRows.push(
				DECAY_N.map((target) =>
					median(
						histories.flatMap((blocks) => {
							const times = fitBlockAt(blocks, target).fits.map((fit) =>
								closedStopTimes(fit.constants),
							);

							return SLIDER_CELLS.map((_, cell) =>
								Math.abs(toMinutes(times[0][cell] - times[1][cell])),
							);
						}),
					).toFixed(2),
				),
			);

			console.log(
				row(
					`true ${trueC3.toFixed(2)}`,
					byTarget.map((perLogger) => median(perLogger.flat()).toFixed(2)),
				),
			);

			perLoggerRange.push(
				byTarget.map((perLogger) => {
					const own = perLogger.map((cells) => median(cells));

					return `${Math.min(...own).toFixed(1)}-${Math.max(...own).toFixed(1)}`;
				}),
			);
		}

		console.log(
			`[§1] the same decay on the §3 CLOSED form, which is exactly linear in ϕ — so with the ` +
				`design identical across arms the only thing that can move these rows is the ` +
				`ϕ ≥ ${PHI_FLOOR}h prediction floor:`,
		);

		for (const [index, trueC3] of TRUE_C3.entries()) {
			console.log(row(`true ${trueC3.toFixed(2)}`, closedRows[index]));
		}

		console.log(
			`[§1] per logger, the min-max across the ${DECAY_USERS} loggers of each logger's OWN ` +
				`median gap — the only form of this reading a single logger could compute:`,
		);

		for (const [index, trueC3] of TRUE_C3.entries()) {
			console.log(row(`true ${trueC3.toFixed(2)}`, perLoggerRange[index], 12));
		}
	});

	it('reading 4 — the plan price: a day solved under each prior, scored under the truth', () => {
		console.log(
			`[§1] ${PLAN_USERS} loggers per arm, one ${TASKS_PER_DAY}-task day each through the shipped ` +
				`calculatePooledAllocations at DEFAULT_CAPACITY_POOLS, no posterior on either side — the ` +
				`axis under test is the prior MEAN, so both plans are solved on the certainty model. ` +
				`Cells are the mean % below the SAME day solved under the logger's TRUE constants, ` +
				`printed as 0.5-prior / 0-prior.`,
		);

		for (const trueC3 of TRUE_C3) {
			const random = mulberry32(0xc3b100);

			const users = Array.from(
				{
					length: PLAN_USERS,
				},
				() => {
					const truth = drawTruth(random, trueC3);

					return {
						truth,
						tasks: Array.from(
							{
								length: TASKS_PER_DAY,
							},
							(_, index) => drawPooledTask(random, index),
						),
						blocks: walk(drawHistory(random, truth)),
					};
				},
			);

			const priced = PLAN_BUDGETS.map(() => PLAN_N.map(() => PRIORS.map(() => [] as number[])));
			const differences = PLAN_BUDGETS.map(() => PLAN_N.map(() => [] as number[]));
			const wins = PLAN_BUDGETS.map(() => PLAN_N.map(() => 0));
			const ties = PLAN_BUDGETS.map(() => PLAN_N.map(() => 0));

			for (const { truth, tasks, blocks } of users) {
				const fitted = PLAN_N.map((target) => fitBlockAt(blocks, target).fits);

				PLAN_BUDGETS.forEach((budget, budgetIndex) => {
					const solve = (constants: UserConstants) =>
						calculatePooledAllocations(
							tasks,
							budget,
							DEFAULT_CAPACITY_POOLS,
							constants,
							DEFAULT_SWITCH_COST,
						).map((allocation) => allocation.allocatedHours);

					const best = calculateTotalProductivity(tasks, solve(truth), truth);

					fitted.forEach((fits, column) => {
						const plans = fits.map((fit) => solve(fit.constants));
						const scored = plans.map((plan) => calculateTotalProductivity(tasks, plan, truth));

						scored.forEach((value, prior) =>
							priced[budgetIndex][column][prior].push((100 * (best - value)) / best),
						);

						differences[budgetIndex][column].push((100 * (scored[1] - scored[0])) / best);

						if (scored[0] > scored[1]) wins[budgetIndex][column] += 1;

						if (plans[0].every((hours, task) => hours === plans[1][task]))
							ties[budgetIndex][column] += 1;
					});
				});
			}

			const budgetHeader = row(
				'budget',
				PLAN_N.map((target) => `n=${target}`),
				PLAN_COLUMN,
			);

			console.log(
				`[§1] true c₃ = ${trueC3.toFixed(2)}, mean Σ T* under the truth = ` +
					`${mean(users.map(({ truth, tasks }) => tasks.reduce((total, task) => total + findOptimalSingleTaskTime(task, truth), 0))).toFixed(2)}h ` +
					`— mean % below the truth's own plan:`,
			);

			console.log(budgetHeader);

			PLAN_BUDGETS.forEach((budget, budgetIndex) => {
				console.log(
					row(
						`${budget}h`,
						priced[budgetIndex].map(
							(byPrior) => `${mean(byPrior[0]).toFixed(2)}/${mean(byPrior[1]).toFixed(2)}`,
						),
						PLAN_COLUMN,
					),
				);
			});

			console.log(
				`[§1] true c₃ = ${trueC3.toFixed(2)}, how much MORE the 0.5 prior's plan costs than the ` +
					`0 prior's, in % of the truth's own plan (positive = the 0 prior is the better plan), ` +
					`with the whole-run spread over ${PLAN_STRIPES} disjoint logger stripes:`,
			);

			console.log(budgetHeader);

			PLAN_BUDGETS.forEach((budget, budgetIndex) => {
				console.log(
					row(
						`${budget}h`,
						differences[budgetIndex].map((values) => {
							const perStripe = Array.from(
								{
									length: PLAN_STRIPES,
								},
								(_, stripe) => mean(values.filter((_, user) => user % PLAN_STRIPES === stripe)),
							);

							return `${mean(values).toFixed(3)}±${runSpread(perStripe).toFixed(3)}`;
						}),
						PLAN_COLUMN,
					),
				);
			});

			console.log(
				`[§1] true c₃ = ${trueC3.toFixed(2)}, per logger — share strictly better under the 0.5 ` +
					`prior / share whose two plans are the SAME day:`,
			);

			console.log(budgetHeader);

			PLAN_BUDGETS.forEach((budget, budgetIndex) => {
				console.log(
					row(
						`${budget}h`,
						PLAN_N.map(
							(_, column) =>
								`${((100 * wins[budgetIndex][column]) / PLAN_USERS).toFixed(0)}%/` +
								`${((100 * ties[budgetIndex][column]) / PLAN_USERS).toFixed(0)}%`,
						),
						PLAN_COLUMN,
					),
				);
			});
		}
	});
});
