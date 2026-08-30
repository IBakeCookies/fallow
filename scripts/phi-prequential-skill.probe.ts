/**
 * The prequential ϕ scorecard: has the fitted plane ever predicted a ⚡ log
 * better than `DEFAULT_USER_CONSTANTS` did, out of sample, and does
 * `phiPredictionStd`'s ±1σ band cover at its nominal 68.3%? Those are the two
 * numbers ROADMAP item 19 makes its reading conditional on, and the run also
 * prints Σδ̂², the between-title residual variance that is item 6's re-open
 * gate. Nothing user-visible ships from it — the reading is planned separately
 * once these gates are answered.
 *
 * The walk is the app's own causal window, reproduced: logs in date order, each
 * fit reading only logs dated STRICTLY BEFORE the held-out log's date and aged
 * against that date (`session-history.ts`'s `fitFrom`, parameterized by `day`).
 * Same-date logs are therefore all predicted by the same fit, and n advances in
 * date blocks — scoring a log against a fit that saw its sibling would measure
 * a model the user never ran.
 *
 * THE GENERATOR IS THE MODEL, and its truth is drawn from the model's OWN
 * prior: c = defaults + N(0, σ₀²/λ) per coefficient (0.125 with λ = 4), then
 * ϕ = c·x + N(0, σ₀ = 0.25 h), floored at 0.1 h as the model floors its own
 * prediction. That draw is what makes coverage a property of the estimator
 * rather than of a chosen spread, and it puts the drawn user rms 0.4774 h of ϕ
 * from the defaults — 1.91 noise floors — at a mean leverage |x|² of 13.89.
 * Sliders are integers 1–10 through `mapEffort`/`mapEnjoyability`, so every
 * (E, β) is one the app can produce. 500 users × 80 logs, seeded.
 *
 * Figures below are read off THIS file's own run (2026-08-30). Every one of
 * them is printed by the run; none is computed by hand, and the two that were
 * (the 0.44 h spread and |x|² ≈ 12, both plugged in at the mean slider rather
 * than averaged over it) were wrong by 8% and 14% respectively.
 *
 * SELF-CHECK, printed first and load-bearing (the `phi-error-price.probe.ts`
 * convention). On the no-offset regime the recovered residual scale at n ≥ 35
 * is 0.2545 h against σ₀ = 0.25 h, and Σδ̂² = 0.000037 h² against
 * σ₀² = 0.0625 h². If those two miss, every cell below is noise; they are the
 * only assertions here.
 *
 * SKILL (claim 1). Prequential MAE in hours, by n — the log COUNT the fit saw,
 * with mean Σw printed beside the coverage curve since §5.2 makes Σw the data
 * mass and the two diverge as logs age:
 *
 *     n           0      1      2    3-4    5-7    8-9  10-14  15-19  20-29  30-44  45-64    65+
 *     fitted  0.425  0.283  0.276  0.241  0.227  0.221  0.209  0.206  0.206  0.203  0.201  0.205
 *     default 0.425  0.414  0.433  0.421  0.428  0.418  0.425  0.419  0.419  0.415  0.419  0.420
 *     Δ       0.000 -0.131 -0.158 -0.180 -0.201 -0.197 -0.216 -0.213 -0.212 -0.212 -0.218 -0.215
 *
 * The fitted curve falls below the default one at the very first fit (n = 1)
 * and stays below at every n, settling ≈0.21 h better. Item 19's first kill
 * gate — kill if MAE_fitted ≥ MAE_default through n ≈ 40 — is NOT met: the fit
 * has out-of-sample skill in the regime users live in, and half of it arrives
 * with the first log. The gate is read over n = 1…30-44 with n = 0 excluded:
 * there the fit IS the fallback, so fitted = default exactly and the gate's
 * `≥` would be satisfied by a bin in which no fit exists.
 *
 * SMALL-n AGREEMENT (claim 2). The gap and the spread the run itself puts on
 * it (sd over 8 disjoint stripes of the bin, divided by √8 for a whole run):
 *
 *     n = 0 (Σw 0.00): gap  0.0000 h, run spread 0.0000 h
 *     n = 1 (Σw 0.99): gap −0.1306 h, run spread 0.0187 h
 *     n = 2 (Σw 1.98): gap −0.1575 h, run spread 0.0141 h
 *
 * So "skill ≈ 0 at small n by construction" holds EXACTLY at n = 0 and nowhere
 * else: with no logs the fit returns the fallback, which IS the defaults, so
 * the gap is identically zero; by the first log the gap is 7 run-spreads wide.
 * The ridge anchors the fit at the defaults, it does not hold it there.
 *
 * COVERAGE (claim 3). Share of held-out logs inside ±1σ of `phiPredictionStd`
 * (σ̂² + xᵀΣx — NOT `phiParameterStd`), against 68.3% nominal, with the
 * binomial Monte-Carlo error on each cell and the mean σ̂ behind it:
 *
 *     n           0      1      2    3-4    5-7    8-9  10-14  15-19  20-29  30-44  45-64    65+
 *     cover   65.8%  66.5%  57.7%  63.3%  62.7%  61.8%  66.2%  67.0%  65.9%  67.5%  67.6%  66.4%
 *     ± mc     1.8%   2.1%   2.2%   1.5%   1.3%   1.5%   1.0%   0.9%   0.7%   0.5%   0.5%   0.6%
 *     mean Σw  0.00   0.99   1.98   3.46   5.88   8.25  11.55  16.10  22.74  33.15  46.57  58.68
 *     mean σ̂  0.250  0.232  0.228  0.230  0.232  0.234  0.235  0.237  0.239  0.241  0.243  0.245
 *
 * Read against ± mc, only the n = 2 cell is a real departure: 57.7% is 4.8
 * standard errors below nominal, while n = 0's 65.8% is 1.4 and says nothing.
 * Every bin at n ≥ 10 sits between 65.9% and 67.6% against errors of 0.5–1.0pp,
 * so item 19's second gate — coverage inside 60–75% at every n ≥ 10 — IS met:
 * the band is already correct and unremarkable where the gate reads it, and the
 * row a user would see would say nothing.
 *
 * The σ̂ row is the dip's cause, measured rather than asserted: σ̂ starts at
 * σ₀ = 0.250 (n = 0 IS the prior), is pulled to 0.228 at n = 2 by residuals
 * the ridge has already shrunk, and climbs back to 0.245 — its minimum is
 * exactly the bin the coverage minimum sits in. σ̂² is the ν₀ = 4 blend toward
 * σ₀², and a blend is a prior, not a floor: it moves below σ₀ as readily as
 * above.
 *
 * OVER-COVERAGE (claim 4) DOES NOT HOLD, and the run says what does instead.
 * Under the prior-matched draw the band is calibrated at n = 0 by construction,
 * so there is no small-n excess to decay: coverage runs 65.8% → 66.4%. The axis
 * that does move it is how far the user sits from the defaults RELATIVE to the
 * prior width the band assumes:
 *
 *     truth at 0.5× prior std: 86.9% at n = 0 → 66.9% at n ≥ 65
 *     truth at 1.0× prior std: 65.8% at n = 0 → 66.4% at n ≥ 65
 *     truth at 2.0× prior std: 45.2% at n = 0 → 68.4% at n ≥ 65
 *
 * A user closer to the defaults than λ = 4 believes is over-covered (86.9%) and
 * the excess decays as data replaces the prior; a user twice as far is
 * UNDER-covered (45.2%) and the curve rises to nominal from below. Both ends
 * converge by n ≈ 10–15, which is why the gate reads clean at n ≥ 10 whatever
 * the user is. The claim's second half fails too: |excess| rises again in 3, 5
 * and 2 of the 11 steps of the three arms, so the approach to nominal is not
 * monotone in any of them. Item 19 predicted the over-covering half of a
 * two-sided effect and named σ̂² as its mechanism; the run says the mechanism
 * is the prior's WIDTH, and that σ̂ moves in both directions.
 *
 * BETWEEN-TITLE VARIANCE (claim 5), one-way random-effects ANOVA on the
 * fitted residuals retained at n ≥ 10, grouped by `taskTitle` (6 titles/user).
 * The ϕ ≥ 0.1 h floor truncates the largest negative offsets before the fit
 * ever sees them, so the honest denominator is the variance that SURVIVED it,
 * not the sd the draw was given — both are printed:
 *
 *     offset sd 0.00 h ⇒ Σδ̂² = 0.000037 h² = 0.0006 × σ₀²  (floor 0.69%)
 *     offset sd 0.30 h ⇒ Σδ̂² = 0.075867 h² = 1.2139 × σ₀²  (floor 1.83%,
 *                        surviving 0.089338 h², recovery 0.849)
 *     offset sd 0.60 h ⇒ Σδ̂² = 0.275076 h² = 4.4012 × σ₀²  (floor 4.34%,
 *                        surviving 0.329137 h², recovery 0.836)
 *
 * The statistic reads ≈ 0 with no offset and recovers an injected one at
 * 0.849 and 0.836 of what survived the floor — both ≈ (1 − 1/6), the shrinkage
 * a shared plane imposes by absorbing the history's own mean offset across 6
 * titles. Against the DRAWN sd² the same cells read 0.843 and 0.764: the gap
 * between those two is the floor, and a real-log reading of Σδ̂² is biased low
 * by the (1 − 1/G) factor whether or not the floor fires. Item 6 stays closed
 * regardless: it re-opens on REAL logs above the noise floor, and every number
 * here is synthetic.
 *
 * A probe, not a test: the curves move with the ridge prior, the noise prior,
 * the recency half-life and the slider maps. The kill gates are recorded and
 * reported, never asserted — a probe that fails a build on a moving number is
 * what `docs/testing.md` separates probes from tests to prevent.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_USER_CONSTANTS,
	calculateFlowStateTime,
	fitUserConstants,
	mapEffort,
	mapEnjoyability,
	phiPredictionStd,
} from '$lib/business/model/zenith';

/** The stopwatch noise floor the synthetic users log at (MATH.md §5). */
const SIGMA_0 = 0.25;
/** Share of a normal inside ±1σ — what a coverage curve is read against. */
const NOMINAL_COVERAGE = 0.683;
const USERS = 500;
const LOGS_PER_USER = 80;
const TITLES_PER_USER = 6;
/**
 * The model's own prior std per coefficient, σ₀/√λ with λ = 4 (MATH.md §5).
 * Drawing the synthetic truth from exactly this is what makes the coverage
 * reading a property of the estimator rather than of a chosen spread — and it
 * still puts a user ≈0.44 h of ϕ away from the defaults, well past the floor.
 */
const PRIOR_COEFFICIENT_STD = 0.125;
/** Lower edges of the n bins every curve is reported over; 10 is an edge so the n ≥ 10 gate is exact. */
const BIN_EDGES = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 65];
/** Item 19's first gate reads "through n ≈ 40": the last bin edge below it, whose bin straddles 40. */
const GATE_1_MAX_N = 30;
/** Item 19 gates the coverage row here, where a fit exists on any history. */
const COVERAGE_GATE_MIN_N = 10;
/** The generated ϕ is floored as `calculateFlowStateTime` floors its prediction. */
const PHI_FLOOR = 0.1;
/** Below this the plane is still mostly prior, so Σδ̂² would price the prior, not the titles. */
const SIGMA_DELTA_MIN_N = 10;
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

/** The stored ⚡ row the synthetic histories imitate (`FlowObservationRecord`). */
interface SyntheticLog {
	date: string;
	taskTitle: string;
	E: number;
	beta: number;
	phiHours: number;
	/** What this log's title displaced ϕ by, AFTER the floor — the truth Σδ̂² is read against */
	titleOffset: number;
	/** ϕ_true − ϕ_default at this log's own (E, β): how far the drawn user is, here */
	planeDeviation: number;
	/** Whether the ϕ ≥ PHI_FLOOR floor truncated this log */
	phiFloored: boolean;
}

/** One held-out log, scored against the fit that predicted it. */
interface Prediction {
	n: number;
	sumWeight: number;
	fittedError: number;
	defaultError: number;
	predictionStd: number;
	/** σ̂, the noise half of the band — the header attributes the small-n dip to it */
	sigmaHat: number;
	taskTitle: string;
	/** |x|², the leverage one log carries at its own point */
	leverage: number;
	/** The per-title offset this log was drawn with, floor included */
	titleOffset: number;
	/** ϕ_true − ϕ_default at this log's own (E, β) */
	planeDeviation: number;
	/** Whether the ϕ ≥ PHI_FLOOR floor truncated this log */
	phiFloored: boolean;
}

function drawHistory(
	random: () => number,
	user: number,
	coefficientStd: number,
	titleOffsetSpread: number,
): SyntheticLog[] {
	const truth = {
		c1: DEFAULT_USER_CONSTANTS.c1 + coefficientStd * gaussian(random),
		c2: DEFAULT_USER_CONSTANTS.c2 + coefficientStd * gaussian(random),
		c3: DEFAULT_USER_CONSTANTS.c3 + coefficientStd * gaussian(random),
	};

	const titleOffsets = Array.from(
		{
			length: TITLES_PER_USER,
		},
		() => titleOffsetSpread * gaussian(random),
	);

	let dayIndex = 0;

	return Array.from(
		{
			length: LOGS_PER_USER,
		},
		() => {
			// A quarter of logs land on a day that already has one, so the walk meets
			// the same-date blocks `date < day` groups together.
			dayIndex += random() < 0.25 ? 0 : 1 + Math.floor(random() * 7);

			const title = Math.floor(random() * TITLES_PER_USER);
			const E = mapEffort(1 + Math.floor(random() * 10));
			const beta = mapEnjoyability(1 + Math.floor(random() * 10));
			const plane = truth.c1 * E + truth.c2 * beta + truth.c3;
			const defaultPlane = calculateFlowStateTime(E, beta, DEFAULT_USER_CONSTANTS);
			const noise = SIGMA_0 * gaussian(random);
			const phiHours = Math.max(PHI_FLOOR, plane + titleOffsets[title] + noise);

			return {
				date: isoDate(dayIndex),
				taskTitle: `u${user}-t${title}`,
				E,
				beta,
				phiHours,
				// The floor truncates the offset it was drawn with, so the truth Σδ̂²
				// is read against is what SURVIVED it, not what was drawn.
				titleOffset: phiHours - (plane + noise),
				planeDeviation: plane - defaultPlane,
				phiFloored: plane + titleOffsets[title] + noise < PHI_FLOOR,
			};
		},
	);
}

/**
 * The prequential walk: for each distinct log date, fit on the logs dated
 * strictly before it, aged against it, and score that date's logs against that
 * fit — `fitFrom(observations, day)`'s two rules, applied to a past day.
 */
function walk(logs: SyntheticLog[]): Prediction[] {
	const days = [...new Set(logs.map((log) => log.date))].sort();

	return days.flatMap((day) => {
		const seen = logs.filter((log) => log.date < day);

		const fit = fitUserConstants(
			seen.map((log) => ({
				E: log.E,
				beta: log.beta,
				phi: log.phiHours,
				ageDays: daysBetween(log.date, day),
			})),
		);

		return logs
			.filter((log) => log.date === day)
			.map((log) => ({
				n: seen.length,
				sumWeight: fit.effectiveCount,
				fittedError: log.phiHours - calculateFlowStateTime(log.E, log.beta, fit.constants),
				defaultError:
					log.phiHours - calculateFlowStateTime(log.E, log.beta, DEFAULT_USER_CONSTANTS),
				predictionStd: phiPredictionStd(log.E, log.beta, fit.posterior),
				sigmaHat: Math.sqrt(fit.posterior.sigma2),
				taskTitle: log.taskTitle,
				leverage: log.E ** 2 + log.beta ** 2 + 1,
				titleOffset: log.titleOffset,
				planeDeviation: log.planeDeviation,
				phiFloored: log.phiFloored,
			}));
	});
}

/** One seeded regime: `USERS` synthetic histories walked end to end. */
function sweep(seed: number, coefficientStd: number, titleOffsetSpread: number): Prediction[] {
	const random = mulberry32(seed);

	return Array.from(
		{
			length: USERS,
		},
		(_, user) => walk(drawHistory(random, user, coefficientStd, titleOffsetSpread)),
	).flat();
}

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

function byBin(predictions: Prediction[]): Prediction[][] {
	const bins: Prediction[][] = BIN_EDGES.map(() => []);

	for (const prediction of predictions) bins[binIndex(prediction.n)].push(prediction);

	return bins;
}

const mean = (values: number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length;

const mae = (predictions: Prediction[], pick: (p: Prediction) => number): number =>
	mean(predictions.map((p) => Math.abs(pick(p))));

const coverage = (predictions: Prediction[]): number =>
	predictions.filter((p) => Math.abs(p.fittedError) <= p.predictionStd).length / predictions.length;

/**
 * The Monte-Carlo error on a coverage cell: √(p(1−p)/n). Printed beside every
 * curve, because a bin holds a few hundred predictions and a 2σ swing there is
 * wider than the departures from nominal the curve is read for.
 */
const coverageStd = (predictions: Prediction[]): number => {
	const share = coverage(predictions);

	return Math.sqrt((share * (1 - share)) / predictions.length);
};

const row = (label: string, cells: string[]): string =>
	`${label.padEnd(9)}${cells.map((cell) => cell.padStart(7)).join('')}`;

/**
 * Σδ̂², the between-title component of residual variance: the one-way
 * random-effects estimator (MS_between − MS_within)/n̄₀ over the retained
 * residuals grouped by `taskTitle`.
 */
function betweenTitleVariance(
	predictions: Prediction[],
	pick: (p: Prediction) => number = (p) => p.fittedError,
): number {
	const groups = new Map<string, number[]>();

	for (const prediction of predictions) {
		const residuals = groups.get(prediction.taskTitle) ?? [];

		residuals.push(pick(prediction));
		groups.set(prediction.taskTitle, residuals);
	}

	const sized = [...groups.values()].filter((residuals) => residuals.length > 1);
	const total = sized.reduce((sum, residuals) => sum + residuals.length, 0);
	const grandMean = mean(sized.flat());
	let withinSquares = 0;
	let betweenSquares = 0;
	let sizeSquares = 0;

	for (const residuals of sized) {
		const groupMean = mean(residuals);

		withinSquares += residuals.reduce((sum, r) => sum + (r - groupMean) ** 2, 0);
		betweenSquares += residuals.length * (groupMean - grandMean) ** 2;
		sizeSquares += residuals.length ** 2;
	}

	const msWithin = withinSquares / (total - sized.length);
	const msBetween = betweenSquares / (sized.length - 1);
	const n0 = (total - sizeSquares / total) / (sized.length - 1);

	return (msBetween - msWithin) / n0;
}

const baseline = sweep(0x9110e0, PRIOR_COEFFICIENT_STD, 0);
const bins = byBin(baseline);

describe('MATH.md §5 — the prequential ϕ scorecard', () => {
	it('self-check: the estimator recovers its own noise floor', () => {
		const settled = baseline.filter((p) => p.n >= 35);
		const scale = Math.sqrt(mean(settled.map((p) => p.fittedError ** 2)));
		const sigmaDelta = betweenTitleVariance(baseline.filter((p) => p.n >= SIGMA_DELTA_MIN_N));

		console.log(
			`[§5] self-check on a user generated FROM the model, no per-title offset: ` +
				`residual scale at n ≥ 35 = ${scale.toFixed(4)} h against σ₀ = ${SIGMA_0} h, ` +
				`Σδ̂² = ${sigmaDelta.toFixed(6)} h² against σ₀² = ${(SIGMA_0 ** 2).toFixed(4)} h²`,
		);

		console.log(
			Math.abs(scale - SIGMA_0) < 0.05 * SIGMA_0 && Math.abs(sigmaDelta) < 0.1 * SIGMA_0 ** 2
				? '[§5] self-check VALID — the walk recovers the generator it was given'
				: '[§5] self-check INVALID — every curve below is measuring something else',
		);

		// Load-bearing: a walk that cannot recover σ₀ from its own generator is not
		// scoring the model, and no cell below means anything.
		expect(Math.abs(scale - SIGMA_0)).toBeLessThan(0.05 * SIGMA_0);
		expect(Math.abs(sigmaDelta)).toBeLessThan(0.1 * SIGMA_0 ** 2);
	});

	it('the generator: how far a drawn user sits from the defaults, and at what leverage', () => {
		// Both were hand-computed at the mean slider before this printed them, and
		// both were wrong: E|x|² is not |E[x]|², and the rms of a plane evaluated
		// over the slider grid is not its value at the grid's centre.
		const deviation = Math.sqrt(mean(baseline.map((p) => p.planeDeviation ** 2)));

		console.log(
			`[§5] drawn truth against the defaults: rms |ϕ_true − ϕ_default| = ` +
				`${deviation.toFixed(4)} h = ${(deviation / SIGMA_0).toFixed(2)} noise floors; ` +
				`mean |x|² = ${mean(baseline.map((p) => p.leverage)).toFixed(2)} ` +
				`(the leverage one log carries at its own point)`,
		);
	});

	it('claim 1 — the fitted plane out of sample against the defaults', () => {
		const fittedCurve = bins.map((bin) => mae(bin, (p) => p.fittedError));
		const defaultCurve = bins.map((bin) => mae(bin, (p) => p.defaultError));
		const crossing = fittedCurve.findIndex((value, index) => value < defaultCurve[index]);

		// The gate reads "through n ≈ 40", and n = 0 is degenerate: with no logs the
		// fit IS the fallback, so fitted = default exactly and the gate's `≥` is
		// satisfied by a bin in which no fit exists.
		const gated = BIN_EDGES.map((edge, index) => index).filter(
			(index) => BIN_EDGES[index] >= 1 && BIN_EDGES[index] <= GATE_1_MAX_N,
		);

		const gate1Killed = gated.filter((index) => fittedCurve[index] >= defaultCurve[index]);

		console.log(
			`[§5] ${USERS} users × ${LOGS_PER_USER} logs, prequential MAE in hours ` +
				`(x-axis is n, the log COUNT the fit saw; Σw beside the coverage curve):`,
		);

		console.log(
			row(
				'  n',
				bins.map((_, index) => binLabel(index)),
			),
		);

		console.log(
			row(
				'  fitted',
				fittedCurve.map((value) => value.toFixed(3)),
			),
		);

		console.log(
			row(
				'  default',
				defaultCurve.map((value) => value.toFixed(3)),
			),
		);

		console.log(
			row(
				'  Δ',
				fittedCurve.map((value, index) => (value - defaultCurve[index]).toFixed(3)),
			),
		);

		console.log(
			`[§5] fitted first falls below default at n = ${binLabel(crossing)}; ` +
				`item 19 gate 1 (kill if MAE_fitted ≥ MAE_default through n ≈ 40), ` +
				`read over n = ${binLabel(gated[0])}…${binLabel(gated[gated.length - 1])} with the ` +
				`degenerate n = 0 bin excluded: ` +
				`${gate1Killed.length === 0 ? 'NOT met — the fit has skill at every n it reads' : `met at n = ${gate1Killed.map(binLabel).join(', ')}`}`,
		);
	});

	it('claim 2 — small-n agreement against the run’s own seed-to-seed spread', () => {
		const slices = 8;

		for (const index of [0, 1, 2]) {
			// The spread the claim is read against: the same statistic on 8 disjoint
			// stripes of this bin's predictions. A stripe is an eighth of the bin, so
			// the sd ACROSS stripes is √8 times what a re-seeded whole run would move
			// by — both are printed, and the claim is read against the whole-run one.
			const perSlice = Array.from(
				{
					length: slices,
				},
				(_, slice) => {
					const part = bins[index].filter((_, position) => position % slices === slice);

					return mae(part, (p) => p.fittedError) - mae(part, (p) => p.defaultError);
				},
			);

			const gap = mae(bins[index], (p) => p.fittedError) - mae(bins[index], (p) => p.defaultError);
			const sliceMean = mean(perSlice);
			const spread = Math.sqrt(mean(perSlice.map((value) => (value - sliceMean) ** 2)));

			console.log(
				`[§5] n = ${binLabel(index)} (mean Σw = ${mean(bins[index].map((p) => p.sumWeight)).toFixed(2)}): ` +
					`MAE gap = ${gap.toFixed(4)} h against a spread of ${spread.toFixed(4)} h ` +
					`across ${slices} disjoint slices = ${(spread / Math.sqrt(slices)).toFixed(4)} h for a whole run`,
			);
		}
	});

	it('claim 3 — coverage of the ±1σ predictive band', () => {
		const coverageCurve = bins.map((bin) => coverage(bin));

		const outside = bins
			.map((bin, index) => ({
				index,
				value: coverage(bin),
			}))
			.filter(({ index }) => BIN_EDGES[index] >= COVERAGE_GATE_MIN_N)
			.filter(({ value }) => value < 0.6 || value > 0.75);

		console.log(
			`[§5] share inside ±1σ of phiPredictionStd (σ̂² + xᵀΣx), nominal ` +
				`${(100 * NOMINAL_COVERAGE).toFixed(1)}%:`,
		);

		console.log(
			row(
				'  n',
				bins.map((_, index) => binLabel(index)),
			),
		);

		console.log(
			row(
				'  cover',
				coverageCurve.map((value) => `${(100 * value).toFixed(1)}%`),
			),
		);

		console.log(
			row(
				'  ± mc',
				bins.map((bin) => `${(100 * coverageStd(bin)).toFixed(1)}%`),
			),
		);

		console.log(
			row(
				'  mean Σw',
				bins.map((bin) => mean(bin.map((p) => p.sumWeight)).toFixed(2)),
			),
		);

		// The header attributes the small-n dip to σ̂ being pulled below σ₀ by
		// ridge-shrunk residuals. That is a claim about a quantity, so print it.
		console.log(
			row(
				'  mean σ̂',
				bins.map((bin) => mean(bin.map((p) => p.sigmaHat)).toFixed(3)),
			),
		);

		console.log(
			`[§5] item 19 gate 2 (ship only Σδ̂² if coverage sits inside 60–75% at every ` +
				`n ≥ ${COVERAGE_GATE_MIN_N}): ` +
				`${
					outside.length === 0
						? 'met — the band is already unremarkable'
						: `NOT met at n = ${outside
								.map(({ index, value }) => `${binLabel(index)} (${(100 * value).toFixed(1)}%)`)
								.join(', ')}`
				}`,
		);
	});

	it('claim 4 — over-coverage at small n, and how it decays', () => {
		// The claim is about the ν₀ blend, but a prior-matched truth cannot show it:
		// the band is then correct at every n by construction. What the small-n end
		// really reads is how far the user sits from the defaults RELATIVE to the
		// prior the band assumes, so that is the axis this sweeps.
		for (const multiple of [0.5, 1, 2]) {
			const predictions =
				multiple === 1
					? baseline
					: sweep(0x91100c + multiple * 4, multiple * PRIOR_COEFFICIENT_STD, 0);

			const curve = byBin(predictions).map((bin) => coverage(bin));
			const excess = curve.map((value) => value - NOMINAL_COVERAGE);

			// Claim 4's second half — "the excess shrinks monotonically". Counted on
			// |excess| so an under-covering arm is read the same way as an
			// over-covering one, with a 0.5pp deadband against Monte-Carlo jitter.
			const increases = excess.filter(
				(value, index) => index > 0 && Math.abs(value) > Math.abs(excess[index - 1]) + 0.005,
			).length;

			console.log(
				`[§5] truth at ${multiple}× the prior std (${(multiple * PRIOR_COEFFICIENT_STD).toFixed(4)} per coefficient): ` +
					`coverage ${(100 * curve[0]).toFixed(1)}% at n = ${binLabel(0)} → ` +
					`${(100 * curve[curve.length - 1]).toFixed(1)}% at n = ${binLabel(curve.length - 1)}; ` +
					`|excess| rises in ${increases} of ${curve.length - 1} steps, so the decay ` +
					`claim 4 asserts is not monotone here`,
			);

			console.log(
				row(
					'  cover',
					curve.map((value) => `${(100 * value).toFixed(1)}%`),
				),
			);
		}
	});

	it('claim 5 — between-title residual variance, per regime', () => {
		for (const spread of [0, 0.3, 0.6]) {
			const predictions =
				spread === 0
					? baseline
					: sweep(0x9110e0 + Math.round(100 * spread), PRIOR_COEFFICIENT_STD, spread);

			const retained = predictions.filter((p) => p.n >= SIGMA_DELTA_MIN_N);
			const sigmaDelta = betweenTitleVariance(retained);
			// The denominator the recovery ratio is honest against: the offsets that
			// SURVIVED the ϕ ≥ 0.1h floor, not the sd the draw was given. The floor
			// truncates the largest negative offsets, so the drawn sd overstates what
			// the fit could ever have seen.
			const floored = betweenTitleVariance(retained, (p) => p.titleOffset);
			const truncated = retained.filter((p) => p.phiFloored).length / retained.length;

			console.log(
				`[§5] per-title ϕ offset sd ${spread.toFixed(2)} h ⇒ ` +
					`Σδ̂² = ${sigmaDelta.toFixed(6)} h² = ` +
					`${(sigmaDelta / SIGMA_0 ** 2).toFixed(4)} × σ₀² (σ₀² = ${(SIGMA_0 ** 2).toFixed(4)} h², ` +
					`residuals at n ≥ ${SIGMA_DELTA_MIN_N}); drawn sd² = ${(spread ** 2).toFixed(6)} h², ` +
					`surviving the ϕ ≥ ${PHI_FLOOR}h floor = ${floored.toFixed(6)} h² ` +
					`(floor fires on ${(100 * truncated).toFixed(2)}% of logs)` +
					`${spread === 0 ? ' — no offset to recover' : `, so recovery = ${(sigmaDelta / floored).toFixed(3)} of what survived`}`,
			);
		}
	});
});
