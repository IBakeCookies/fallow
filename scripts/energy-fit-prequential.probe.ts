/**
 * Whether the three energy fits have ever predicted anything out of sample
 * (ROADMAP item 39). §5 walks the ⚡ history in date order and reports what the
 * fitted ϕ plane was worth against `DEFAULT_USER_CONSTANTS`; α (§8.7), r (§8.9)
 * and λ₀ (§8.10) have no such reading, only a posterior ± that §8.10's
 * common-mode bullet and ROADMAP M108 say answers a narrower question than it
 * looks like. This runs §5's own convention over all three: at each distinct log
 * date d, fit on the observations dated STRICTLY BEFORE d, then score every
 * observation dated d — so a row is never predicted from its same-day sibling,
 * and n advances in date blocks. Two grades, both §5's: SKILL is the fitted
 * predictor's mean absolute error against the DEFAULT predictor's on the same
 * held-out observations (neither curve alone is interpretable, both being
 * dominated by σ̂), and COVERAGE is the share of held-out values inside ±1σ of
 * the PREDICTIVE std √(σ̂² + s²·std²) against a 68.3% nominal — predictive, not
 * parameter, because what is being covered is a new measurement and carries the
 * observation noise.
 *
 * WHAT EACH FIT PREDICTS, since the three observables differ. α predicts a 🪫
 * row's drained fraction from a full reservoir, as `fitDrainRate` reads it; r
 * predicts a ☕ pair's post-rest rating from its pre-rest one; λ₀'s prediction is
 * the IDENTITY, so a finished day is scored on |m_d − λ̂₀| against its own
 * indifference point. The three fits report the std they produced and not the σ̂
 * behind it, so σ̂ is recovered here from std² = σ̂²/(Σs² + λ) over the
 * observations each fit used, with dD/dα by central difference on the shipped
 * prediction and dr analytically; at n = 0 the unfitted return states the prior,
 * σ̂ = σ₀ and std = σ₀/√λ, which is what the n = 0 column reads.
 *
 * THE POPULATION IS THE MODEL'S OWN PRIOR, drawn at 0.5× / 1× / 2× the width
 * σ₀/√λ each fit's band assumes and held inside that fit's bounds — at 1× the
 * draw is exactly the prior, where coverage is a property of the ESTIMATOR
 * rather than of a chosen spread. Skill is not: it reads how far the population
 * sits from the defaults, so the three arms are the reading and no single one of
 * them is. Every row is one the app could hold — 40 logged days a user, 1–3
 * chained sessions a day (so §8.7's fresh-start artifact is IN the data, which
 * is the point: what is graded is the app's fit on the rows the app holds). The
 * α walk therefore FITS on §8.7's filtered rows and SCORES on every row of the
 * held-out day, mid-day sessions included — the app's own asymmetry, a user
 * reading one α̂ against sessions it never fitted on. Demands on the ten slider notches, ratings noised at each fit's own σ₀ and
 * quantized to the stored 0–10 notches. 60 users for α and r, 40 × 12 finished
 * days for λ₀, seeded.
 *
 * Figures below are read off THIS file's own run (2026-09-18). Every one of them
 * is printed by the run; the only arithmetic done on them here is reading a
 * drained fraction as a share of a 0–10 notch.
 *
 * SELF-CHECK, printed first and the only assertions: at n ≥ 30 the α walk's
 * prequential MAE reads 0.1077 against the σ₀ = 0.15 the ratings were noised at,
 * over 2424 held-out observations. Every `obs` count in this file is in
 * OBSERVATIONS, which is not the number of logs: one 🪫 row is two observations,
 * its mind rating and its body one, and so is one ☕ pair. The `n` AXIS is each
 * fit's own `usedCount`, and for α that now counts DAYS (§8.7's row filter), so
 * a 40-day user cannot reach past the 30-44 bin — which is why α's table is
 * three columns shorter than r's. A Gaussian's MAE is 0.798σ and the 0–10 quantizer
 * pulls it below that, so the band is wide; miss it and the fit and the
 * generator are not the same model.
 *
 * α (§8.7) at 1× the prior width — truth rms 0.2602 from the default, 13% of
 * draws held by the fit bounds, all 9550 held-out observations scorable. Errors
 * are drained fractions, so 0.01 is a tenth of a 0–10 notch:
 *
 *     n            0      1      2    3-4    5-7    8-9  10-14  15-19  20-29  30-44
 *     fitted  0.1370 0.1340 0.1213 0.1230 0.1137 0.1113 0.1149 0.1112 0.1095 0.1077
 *     default 0.1370 0.1314 0.1394 0.1433 0.1392 0.1373 0.1451 0.1471 0.1415 0.1414
 *     Δ       0.0000 0.0026 -.0182 -.0204 -.0255 -.0260 -.0302 -.0359 -.0320 -.0337
 *     cover    80.5%  71.1%  70.9%  66.7%  69.6%  67.1%  66.0%  67.9%  69.1%  68.1%
 *     obs        246    256    230    472    714    484   1184   1206   2334   2424
 *
 * **The α fit predicts, and it is worth about a third of a notch.** The fitted
 * curve falls below the default one from n = 2 and settles ≈0.034 drained
 * fraction better — a third of one 0–10 rating notch, against ratings the user
 * enters in whole notches. It saturates by n ≈ 10–15 and buys nothing after.
 *
 * **And it is NEGATIVE at the FIRST day for a user near the defaults.** At
 * 0.5× the prior width Δ reads +0.0095 at n = 1 before turning over at n = 2; at
 * 1× it is +0.0026 at n = 1; at 2× it is negative everywhere from the first day.
 * So the first 🪫 day makes the prediction WORSE for exactly the user the
 * defaults already described, which is
 * the same shape §5 handles for ϕ by withholding the reading below
 * `SKILL_MIN_SCORED_LOGS` — and the α cards withhold nothing. The row filter
 * shortened this: the whole-log fit was still negative at n = 2 in this arm.
 *
 * **α's band is calibrated.** Coverage sits between 65.9% and 73.4% at every
 * n ≥ 1 in all three arms against 68.3% nominal, with no drift in n. Only n = 0
 * departs, and the direction is the prior's: 89.0% at 0.5× the prior width,
 * 80.5% at 1×, 72.0% at 2× — a user closer to the defaults than λ believes is
 * over-covered by a band that is all prior, and the excess is gone by the first
 * fit. That the ± is honest about SCATTER is not a contradiction of ROADMAP item
 * 43's finding that it cannot see the fresh-start DISPLACEMENT: this walk scores
 * against the ratings the generator produced, which carry that artifact, and
 * item 43 scores against α itself, which does not.
 *
 * r (§8.9) at 1× the prior width — truth rms 0.7725 from the default, 20% of
 * draws held by the fit bounds, all 4800 held-out observations scorable. n skips
 * 1: one ☕ record is TWO observations, mind and body, so the count advances in
 * pairs:
 *
 *     n            0      2    3-4    5-7    8-9  10-14  15-19  20-29  30-44  45-64    65+
 *     fitted  0.1815 0.1545 0.1461 0.1496 0.1522 0.1440 0.1422 0.1337 0.1421 0.1303 0.1433
 *     default 0.1815 0.1730 0.1828 0.1903 0.1963 0.1837 0.1884 0.1807 0.1920 0.1887 0.1948
 *     Δ       0.0000 -.0185 -.0367 -.0407 -.0441 -.0398 -.0462 -.0470 -.0499 -.0584 -.0515
 *     cover    83.3%  78.3%  77.5%  70.8%  68.3%  70.3%  67.5%  71.8%  69.3%  72.3%  66.4%
 *     obs        120    120    120    120    120    360    240    600    960   1200    840
 *
 * **The r fit predicts more than α's and needs more data to do it.** Δ settles
 * ≈0.05 of a drained fraction — half a notch — but does not level off until
 * n ≈ 15-19, where α's is done by 10-14. The near-default arm shows the same
 * sign flip: +0.0154 at n = 2 at 0.5× the prior width. Its band over-covers
 * longer than α's, 83.3% → 78.3% → 77.5% before settling near nominal at n ≥ 5,
 * which is the prior width being wide relative to where a real r sits.
 *
 * λ₀ (§8.10) at 1× the prior width — truth rms 0.2175 from the default, 176 of
 * the 480 days the 40 users worked scorable (37%):
 *
 *     n            0      1      2    3-4    5-7    8-9  10-14
 *     fitted  0.1746 0.1157 0.0593 0.0560 0.0579 0.0590 0.0633
 *     default 0.1746 0.1998 0.1849 0.2198 0.2726 0.3485 0.3919
 *     Δ       0.0000 -.0841 -.1256 -.1639 -.2147 -.2895 -.3286
 *     cover    90.0%  96.3% 100.0% 100.0% 100.0% 100.0% 100.0%
 *     obs         30     27     25     37     39     15      3
 *
 * **λ₀'s skill is the largest of the three and its band is the least
 * informative.** Two days move the prediction from 0.1746 to 0.0593 — the
 * prediction is the identity, so a day point is a direct measurement of the
 * quantity and three of them nearly pin it. Against that, coverage is 100% from
 * n = 2 at every spread but the widest, and it is 100% because the band is far
 * wider than the scatter: `STOP_NOISE_PRIOR_STD` = 0.25 is blended in at ν₀ = 4
 * and the residuals here are a quarter of it. **That is a property of this
 * generator and not a verdict on the shipped ±**: §8.10 sizes that σ₀ from
 * lattice quantization AND day-to-day mood in the stop decision, and these days
 * are the optimizer's own plans, so they carry the first and none of the second.
 * A real logger's scatter is what the band is for, and nothing here measures it.
 * The skill column is flattered the same way and for the same reason.
 *
 * **What the walk says about λ₀'s SAMPLE is not flattered.** The run prints the
 * scorable share beside each arm: 30% / 37% / 44% of the 480 worked days yield
 * an indifference point at all — the rest are one-sided, clock-censored or past
 * the inversion margin — against 100% for α and r, whose every observation is
 * informative. So the fit's n grows at roughly a third the rate of the user's
 * logging, and the 8-9 and 10-14 bins above are 15 and 3 days wide.
 *
 * WHAT WOULD FALSIFY WHAT. If any Δ column had stayed at or above zero through
 * the bins a real user reaches, that fit would have no measured skill and the
 * card that prints it would be printing nothing — none does past n = 3-4. If
 * skill had arrived only at 2× the prior width, it would be an artifact of
 * placing the population far from the defaults; α and r both show it at 0.5×
 * too, α from n = 2 and r from n = 3-4. If coverage had drifted with n, the ± would be
 * mis-specified in the way a band that ignores parameter uncertainty is; α's
 * does not move and r's converges from above. If the n = 0 column had departed
 * from nominal in the SAME direction at every spread, the prior width would be
 * simply wrong rather than a statement about distance; it runs 89.0% → 72.0% as
 * the population moves out. And if the two grades had agreed on λ₀ — high skill
 * with calibrated coverage — the fit would be the strongest of the three rather
 * than the one whose instrument this generator cannot exercise.
 *
 * A probe, not a test. Every figure moves with the prior means the three fits
 * shrink toward (`DEFAULT_ENERGY_PARAMS`), with each fit's λ and σ₀
 * (`DRAIN_PRIOR_STRENGTH`/`DRAIN_NOISE_PRIOR_STD`,
 * `RECOVERY_PRIOR_STRENGTH`/`RECOVERY_NOISE_PRIOR_STD`,
 * `STOP_PRIOR_STRENGTH`/`STOP_NOISE_PRIOR_STD`) — doubly, since each σ₀ is both
 * its fit's noise floor, the generator's own noise, and the width the population
 * is drawn at — with the ν₀ they are blended in at
 * (`CALIBRATION_NOISE_PRIOR_WEIGHT`), with the fit bounds (the arms report what
 * share of draws they held), with the 0–10 quantization and the linear rating
 * map, and for λ₀ with `STOP_INVERSION_MARGIN` and the optimizer itself. The
 * whole reading is a perfect-model one: the generator's law IS the fit's law, so
 * what is graded is the estimator and never whether the law is right. And it is
 * a CONDITIONER-EXACT one for α: the fit is handed the generator's own r, where
 * the app hands it a fitted one, so nothing here carries §8.7's conditioning
 * error forward. And it is a STATIONARY population — every user's truth is fixed
 * for the 40 days — so
 * nothing here reads drift; §5.2's scope question has its own instrument in
 * `energy-fit-recency.probe.ts`. What this one adds to that question is where
 * each fit's skill saturates, since past saturation a fit that sheds old logs
 * sheds data it was no longer using.
 *
 * Usage: npm run probe -- scripts/energy-fit-prequential.probe.ts
 */

import { describe, expect, it } from 'vitest';
import {
	keepDayFirstDrainRows,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations,
} from '$lib/business/model/energy-calibration';
import {
	ALPHA_FIT_MAX,
	ALPHA_FIT_MIN,
	DEFAULT_ENERGY_PARAMS,
	DRAIN_NOISE_PRIOR_STD,
	DRAIN_PRIOR_STRENGTH,
	fitDrainRate,
	fitRecoveryRate,
	fitStoppingValue,
	optimizeSchedule,
	RECOVERY_FIT_MAX,
	RECOVERY_FIT_MIN,
	RECOVERY_NOISE_PRIOR_STD,
	RECOVERY_PRIOR_STRENGTH,
	simulateReservoirs,
	STOP_FIT_MAX,
	STOP_FIT_MIN,
	STOP_NOISE_PRIOR_STD,
	STOP_PRIOR_STRENGTH,
	stopIndifferencePoint,
	type EnergyParams,
	type EnergyTaskInput,
	type ReservoirDemand,
	type ScheduleBlock,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS, type UserConstants } from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { DrainObservationRecord, RestObservationRecord, Task } from '$lib/data/type';

const CONSTANTS: UserConstants = DEFAULT_USER_CONSTANTS;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');
const BASE_SEED = 0x5eed17;
const RATING_USERS = 60;
const RATING_DAYS = 40;
const STOP_USERS = 40;
const STOP_DAYS = 12;
/**
 * How far a drawn population sits from the defaults, as a multiple of the fit's
 * OWN prior width σ₀/√λ — the width its posterior band assumes. At 1× the draw
 * is the model's own prior, where coverage is a property of the estimator
 * rather than of a chosen spread.
 */
const SPREADS = [0.5, 1, 2];

/** n = observations the fit had seen, binned as §5's ϕ scorecard bins it. */
const BINS: { label: string; min: number; max: number }[] = [
	{
		label: '0',
		min: 0,
		max: 0,
	},
	{
		label: '1',
		min: 1,
		max: 1,
	},
	{
		label: '2',
		min: 2,
		max: 2,
	},
	{
		label: '3-4',
		min: 3,
		max: 4,
	},
	{
		label: '5-7',
		min: 5,
		max: 7,
	},
	{
		label: '8-9',
		min: 8,
		max: 9,
	},
	{
		label: '10-14',
		min: 10,
		max: 14,
	},
	{
		label: '15-19',
		min: 15,
		max: 19,
	},
	{
		label: '20-29',
		min: 20,
		max: 29,
	},
	{
		label: '30-44',
		min: 30,
		max: 44,
	},
	{
		label: '45-64',
		min: 45,
		max: 64,
	},
	{
		label: '65+',
		min: 65,
		max: Infinity,
	},
];

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function gaussian(random: () => number): number {
	return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

function isoDate(day: number): string {
	// Built by hand rather than with Date so the probe stays deterministic and
	// dependency-free; only ISO ORDER is load-bearing.
	const month = Math.floor(day / 31);
	const dayOfMonth = (day % 31) + 1;

	return `2026-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

/** A 0–10 rating as the app stores it. */
const notch = (fraction: number): number => Math.max(0, Math.min(10, Math.round(fraction * 10)));

const mean = (values: number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length;

const rootMeanSquare = (values: number[]): number =>
	Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);

/** Drawn from the fit's own prior, then held inside the bounds that fit can return. */
function drawTruth(random: () => number, spread: number, prior: Prior): number {
	const drawn = prior.mean + spread * (prior.noise / Math.sqrt(prior.strength)) * gaussian(random);

	return Math.min(Math.max(drawn, prior.min), prior.max);
}

interface Prior {
	mean: number;
	/** σ₀, the fit's noise floor */
	noise: number;
	/** λ, the ridge weight — σ₀/√λ is the width the posterior band assumes */
	strength: number;
	min: number;
	max: number;
}

const ALPHA_COG_PRIOR: Prior = {
	mean: DEFAULT_ENERGY_PARAMS.alphaCog,
	noise: DRAIN_NOISE_PRIOR_STD,
	strength: DRAIN_PRIOR_STRENGTH,
	min: ALPHA_FIT_MIN,
	max: ALPHA_FIT_MAX,
};

const ALPHA_PHYS_PRIOR: Prior = {
	...ALPHA_COG_PRIOR,
	mean: DEFAULT_ENERGY_PARAMS.alphaPhys,
};

const RATE_PRIOR: Prior = {
	mean: DEFAULT_ENERGY_PARAMS.recoveryRate,
	noise: RECOVERY_NOISE_PRIOR_STD,
	strength: RECOVERY_PRIOR_STRENGTH,
	min: RECOVERY_FIT_MIN,
	max: RECOVERY_FIT_MAX,
};

const LAMBDA_PRIOR: Prior = {
	mean: DEFAULT_ENERGY_PARAMS.freeTimeValue,
	noise: STOP_NOISE_PRIOR_STD,
	strength: STOP_PRIOR_STRENGTH,
	min: STOP_FIT_MIN,
	max: STOP_FIT_MAX,
};

// ================== The one prequential convention ==================

/**
 * One held-out observation, scored against the fit that had seen only the dates
 * strictly BEFORE its own — §5's walk, applied to a 1-D energy fit. Held out is
 * the whole date block, so a row is never predicted from its same-day sibling.
 */
interface Scored {
	/** Observations the fit had seen — §5's n, which every reading is binned on */
	n: number;
	fittedError: number;
	defaultError: number;
	/** The held-out value fell inside ±1σ of the fit's own PREDICTIVE std */
	isCovered: boolean;
}

interface Walk {
	scored: Scored[];
	/** rms distance of the drawn truths from the default, in the fit's own units */
	distance: number;
	/** Share of draws the fit's bounds held back from the prior's own tail */
	boundedShare: number;
	/** Observations the population produced, of which `scored` are the ones a fit could grade */
	offered: number;
}

/**
 * The noise scale behind a 1-D fit's reported std: std = √(σ̂²/(Σs² + λ)), so
 * σ̂² = std²·(Σs² + λ) over the observations that fit used. Recomputed here
 * because the three fits report the std they produced and not the σ̂ behind it,
 * and §5's coverage convention needs both: a NEW observation's predictive std
 * is √(σ̂² + s²·std²), which carries the observation noise the parameter band
 * deliberately omits.
 */
const noiseVarianceFrom = (std: number, sumSquaredSensitivity: number, strength: number): number =>
	std * std * (sumSquaredSensitivity + strength);

const sumOfSquares = (values: number[]): number =>
	values.reduce((sum, value) => sum + value * value, 0);

/** What an unfitted return states: the prior is all there is (σ̂ = σ₀, std = σ₀/√λ). */
const priorPosterior = (prior: Prior) => ({
	noiseVariance: prior.noise * prior.noise,
	std: prior.noise / Math.sqrt(prior.strength),
});

interface BinReading {
	label: string;
	count: number;
	fitted: number;
	default: number;
	coverage: number;
}

const binsOf = (scored: Scored[]): BinReading[] =>
	BINS.map((bin) => {
		const inBin = scored.filter((s) => s.n >= bin.min && s.n <= bin.max);

		return {
			label: bin.label,
			count: inBin.length,
			fitted: mean(inBin.map((s) => s.fittedError)),
			default: mean(inBin.map((s) => s.defaultError)),
			coverage: inBin.filter((s) => s.isCovered).length / inBin.length,
		};
	}).filter((bin) => bin.count > 0);

function printWalk(title: string, walk: Walk): void {
	const bins = binsOf(walk.scored);
	const cell = (value: string) => value.padStart(8);

	console.log(
		`${title}: truth rms ${walk.distance.toFixed(4)} from the default, ` +
			`${(100 * walk.boundedShare).toFixed(0)}% of draws held by the fit bounds, ` +
			`${walk.scored.length} of ${walk.offered} held-out observations scorable ` +
			`(${((100 * walk.scored.length) / walk.offered).toFixed(0)}%)`,
	);

	console.log(`    n       ${bins.map((b) => cell(b.label)).join('')}`);
	console.log(`    fitted  ${bins.map((b) => cell(b.fitted.toFixed(4))).join('')}`);
	console.log(`    default ${bins.map((b) => cell(b.default.toFixed(4))).join('')}`);

	console.log(`    Δ       ${bins.map((b) => cell((b.fitted - b.default).toFixed(4))).join('')}`);

	console.log(`    cover   ${bins.map((b) => cell(`${(100 * b.coverage).toFixed(1)}%`)).join('')}`);

	console.log(`    obs     ${bins.map((b) => cell(String(b.count))).join('')}`);
}

// ================== α — the 🪫 drain ratings ==================

/**
 * One row's drained fraction as the app predicts it: from a FULL reservoir, at
 * this α. The two reservoirs are independent in the law, so one α drives both
 * and the caller reads the side it asked for.
 */
function predictDrain(row: DrainObservationRecord, alpha: number, isCognitive: boolean): number {
	const task: ReservoirDemand = {
		id: row.taskId,
		cognitiveDemand: row.cognitiveDemand,
		physicalDemand: row.physicalDemand,
	};

	const { endCog, endPhys } = simulateReservoirs(
		[
			{
				taskId: row.taskId,
				hours: row.hours,
			},
		],
		[task],
		{
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: alpha,
			alphaPhys: alpha,
			initialCog: 1,
			initialPhys: 1,
		},
	);

	return 1 - (isCognitive ? endCog : endPhys);
}

const DERIVATIVE_STEP = 1e-4;

/** dD/dα by central difference on the shipped prediction — the fit's own sensitivity. */
const drainSensitivity = (
	row: DrainObservationRecord,
	alpha: number,
	isCognitive: boolean,
): number =>
	(predictDrain(row, alpha + DERIVATIVE_STEP, isCognitive) -
		predictDrain(row, alpha - DERIVATIVE_STEP, isCognitive)) /
	(2 * DERIVATIVE_STEP);

/**
 * A logged 🪫 history, each day chained block by block from full reservoirs:
 * session, rest gap, session. The fresh-start artifact §8.7 names is therefore
 * IN the data, which is the point — what is being graded is the app's fit on
 * the rows the app actually holds.
 */
function synthesizeDrain(
	seed: number,
	alphaCog: number,
	alphaPhys: number,
): DrainObservationRecord[] {
	const random = mulberry32(seed);
	const rows: DrainObservationRecord[] = [];

	for (let day = 0; day < RATING_DAYS; day++) {
		const date = isoDate(day);
		const sessions = 1 + Math.floor(random() * 3);
		let hour = 8 + 0.25 * Math.floor(random() * 9);
		let cog = 1;
		let phys = 1;

		for (let session = 0; session < sessions; session++) {
			const hours = 0.75 * (1 + Math.floor(random() * 4));

			const demand: ReservoirDemand = {
				id: session + 1,
				cognitiveDemand: (1 + Math.floor(random() * 10)) / 10,
				physicalDemand: (1 + Math.floor(random() * 10)) / 10,
			};

			const gap = session === 0 ? 0 : 0.25 * (1 + Math.floor(random() * 8));

			if (hour + gap + hours > 24) break;

			const step = (block: ScheduleBlock) =>
				simulateReservoirs([block], [demand], {
					...DEFAULT_ENERGY_PARAMS,
					alphaCog,
					alphaPhys,
					initialCog: cog,
					initialPhys: phys,
				});

			if (gap > 0) {
				({ endCog: cog, endPhys: phys } = step({
					taskId: null,
					hours: gap,
				}));

				hour += gap;
			}

			({ endCog: cog, endPhys: phys } = step({
				taskId: demand.id,
				hours,
			}));

			hour += hours;

			rows.push({
				date,
				taskId: demand.id,
				taskTitle: `t${demand.id}`,
				hours,
				cognitiveDemand: demand.cognitiveDemand,
				physicalDemand: demand.physicalDemand,
				mindDrain: notch(1 - cog + DRAIN_NOISE_PRIOR_STD * gaussian(random)),
				bodyDrain: notch(1 - phys + DRAIN_NOISE_PRIOR_STD * gaussian(random)),
				createdAt: day * MILLISECONDS_PER_DAY + hour * MILLISECONDS_PER_HOUR,
			});
		}
	}

	return rows;
}

function walkDrain(rows: DrainObservationRecord[], isCognitive: boolean): Scored[] {
	const prior = isCognitive ? ALPHA_COG_PRIOR : ALPHA_PHYS_PRIOR;
	const toObservations = isCognitive ? toCognitiveDrainObservations : toPhysicalDrainObservations;
	const dates = [...new Set(rows.map((row) => row.date))].sort();
	const scored: Scored[] = [];

	for (const date of dates) {
		// The rows the app's own fit would read: one a day per reservoir (§8.7).
		const prefix = keepDayFirstDrainRows(
			rows.filter((row) => row.date < date),
			toObservations,
		);

		const fit = fitDrainRate(toObservations(prefix), prior.mean, DEFAULT_ENERGY_PARAMS);

		const posterior =
			fit.alphaStd === undefined
				? priorPosterior(prior)
				: {
						noiseVariance: noiseVarianceFrom(
							fit.alphaStd,
							sumOfSquares(
								prefix
									.filter(
										(row) =>
											row.hours > 0 && (isCognitive ? row.cognitiveDemand : row.physicalDemand) > 0,
									)
									.map((row) => drainSensitivity(row, fit.alpha, isCognitive)),
							),
							prior.strength,
						),
						std: fit.alphaStd,
					};

		for (const row of rows.filter((row) => row.date === date)) {
			const observed = (isCognitive ? row.mindDrain : row.bodyDrain) / 10;
			const fittedError = Math.abs(observed - predictDrain(row, fit.alpha, isCognitive));
			const sensitivity = drainSensitivity(row, fit.alpha, isCognitive);

			scored.push({
				n: fit.usedCount,
				fittedError,
				defaultError: Math.abs(observed - predictDrain(row, prior.mean, isCognitive)),
				isCovered:
					fittedError <=
					Math.sqrt(
						posterior.noiseVariance + sensitivity * sensitivity * posterior.std * posterior.std,
					),
			});
		}
	}

	return scored;
}

// ================== r — the ☕ pre/post-rest pairs ==================

function synthesizeRest(seed: number, rate: number): RestObservationRecord[] {
	const random = mulberry32(seed);
	const records: RestObservationRecord[] = [];
	const m = DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;

	for (let day = 0; day < RATING_DAYS; day++) {
		const hours = 0.25 * (1 + Math.floor(random() * 8));
		const mindBefore = 1 + Math.floor(random() * 10);
		const bodyBefore = 1 + Math.floor(random() * 10);
		const decay = Math.exp(-rate * m * hours);

		records.push({
			date: isoDate(day),
			hours,
			mindBefore,
			mindAfter: notch((mindBefore / 10) * decay + RECOVERY_NOISE_PRIOR_STD * gaussian(random)),
			bodyBefore,
			bodyAfter: notch((bodyBefore / 10) * decay + RECOVERY_NOISE_PRIOR_STD * gaussian(random)),
			createdAt: day * MILLISECONDS_PER_DAY,
		});
	}

	return records;
}

function walkRest(records: RestObservationRecord[]): Scored[] {
	const m = DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;
	const dates = [...new Set(records.map((record) => record.date))].sort();
	const scored: Scored[] = [];

	const predict = (rate: number, before: number, hours: number) =>
		before * Math.exp(-rate * m * hours);

	const sensitivity = (rate: number, before: number, hours: number) =>
		-before * m * hours * Math.exp(-rate * m * hours);

	for (const date of dates) {
		const prefix = toRestObservations(records.filter((record) => record.date < date));
		const fit = fitRecoveryRate(prefix, RATE_PRIOR.mean, DEFAULT_ENERGY_PARAMS);

		const posterior =
			fit.rateStd === undefined
				? priorPosterior(RATE_PRIOR)
				: {
						noiseVariance: noiseVarianceFrom(
							fit.rateStd,
							sumOfSquares(
								prefix
									.filter((o) => o.drainedBefore > 0 && o.hours > 0)
									.map((o) => sensitivity(fit.rate, o.drainedBefore, o.hours)),
							),
							RATE_PRIOR.strength,
						),
						std: fit.rateStd,
					};

		for (const observation of toRestObservations(
			records.filter((record) => record.date === date),
		)) {
			const { drainedBefore, drainedAfter, hours } = observation;
			const fittedError = Math.abs(drainedAfter - predict(fit.rate, drainedBefore, hours));
			const s = sensitivity(fit.rate, drainedBefore, hours);

			scored.push({
				n: fit.usedCount,
				fittedError,
				defaultError: Math.abs(drainedAfter - predict(RATE_PRIOR.mean, drainedBefore, hours)),
				isCovered:
					fittedError <= Math.sqrt(posterior.noiseVariance + s * s * posterior.std * posterior.std),
			});
		}
	}

	return scored;
}

// ================== λ₀ — the finished days ==================

function drawTask(random: () => number, id: number): EnergyTaskInput {
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	const task: Task = {
		id,
		title: `t${id}`,
		mentalDifficulty: slider(0),
		physicalDifficulty: slider(0),
		enjoyment: slider(1),
		createdAt: '2026-08-25',
		completed: false,
	};

	return toEnergyTask(task);
}

/** The plan as the 🪫 log would hold it: one row per session, rest passing on the clock. */
function observationFrom(
	tasks: EnergyTaskInput[],
	windowHours: number,
	blocks: ScheduleBlock[],
): StopObservation {
	const workedHours: StopObservation['workedHours'] = [];
	let clock = 0;

	for (const block of blocks) {
		clock += block.hours;

		if (block.taskId === null) continue;

		workedHours.push({
			taskId: block.taskId,
			hours: block.hours,
			endedAt: ORIGIN + clock * MILLISECONDS_PER_HOUR,
		});
	}

	return {
		tasks,
		windowHours,
		workedHours,
	};
}

/** Finished days worked to the user's OWN true λ₀, one day per date. */
function synthesizeStopDays(seed: number, lambda: number): StopObservation[] {
	const random = mulberry32(seed);

	const params: EnergyParams = {
		...DEFAULT_ENERGY_PARAMS,
		freeTimeValue: lambda,
	};

	const days: StopObservation[] = [];

	while (days.length < STOP_DAYS) {
		const tasks = Array.from(
			{
				length: 2 + Math.floor(random() * 3),
			},
			(_, i) => drawTask(random, i + 1),
		);

		const windowHours = 6 + Math.round(random() * 8);
		const blocks = optimizeSchedule(tasks, windowHours, params, CONSTANTS).blocks;

		if (blocks.every((block) => block.taskId === null)) continue;

		days.push(observationFrom(tasks, windowHours, blocks));
	}

	return days;
}

/**
 * λ₀'s walk, where the prediction is the IDENTITY: a day's own indifference
 * point is what the fit predicts, so a held-out day is scored on |m_d − λ̂₀|.
 * A day the extraction refuses (one-sided, clock- or inversion-censored) is not
 * an observation, exactly as it is none to the fit. Every day is read under the
 * DEFAULT dynamics — what a mis-fitted α does to this fit is ROADMAP item 43's
 * question, and reading the days under the truth would answer it here by
 * accident.
 */
function walkStop(days: StopObservation[]): Scored[] {
	const scored: Scored[] = [];

	for (const [index, day] of days.entries()) {
		const point = stopIndifferencePoint(day, DEFAULT_ENERGY_PARAMS, CONSTANTS);

		if (point === null) continue;

		const fit = fitStoppingValue(
			days.slice(0, index),
			LAMBDA_PRIOR.mean,
			DEFAULT_ENERGY_PARAMS,
			CONSTANTS,
		);

		const posterior =
			fit.valueStd === undefined
				? priorPosterior(LAMBDA_PRIOR)
				: {
						// Sensitivity is exactly 1 per day (§8.10), so Σs² IS the day count.
						noiseVariance: noiseVarianceFrom(fit.valueStd, fit.usedCount, STOP_PRIOR_STRENGTH),
						std: fit.valueStd,
					};

		const fittedError = Math.abs(point - fit.value);

		scored.push({
			n: fit.usedCount,
			fittedError,
			defaultError: Math.abs(point - LAMBDA_PRIOR.mean),
			isCovered: fittedError <= Math.sqrt(posterior.noiseVariance + posterior.std * posterior.std),
		});
	}

	return scored;
}

// ================== The three populations ==================

function walkOver(
	users: number,
	spread: number,
	priors: Prior[],
	run: (seed: number, truths: number[]) => { scored: Scored[]; offered: number },
): Walk {
	const scored: Scored[] = [];
	const distances: number[] = [];
	const bounded: boolean[] = [];
	let offered = 0;

	for (let user = 0; user < users; user++) {
		const draw = mulberry32(BASE_SEED + user * 7919);

		const truths = priors.map((prior) => {
			const value = drawTruth(draw, spread, prior);

			distances.push(value - prior.mean);
			bounded.push(value === prior.min || value === prior.max);

			return value;
		});

		const walked = run(BASE_SEED + user * 104_729, truths);

		scored.push(...walked.scored);
		offered += walked.offered;
	}

	return {
		scored,
		distance: rootMeanSquare(distances),
		boundedShare: bounded.filter(Boolean).length / bounded.length,
		offered,
	};
}

const drainWalkAt = (spread: number): Walk =>
	walkOver(RATING_USERS, spread, [ALPHA_COG_PRIOR, ALPHA_PHYS_PRIOR], (seed, truths) => {
		const rows = synthesizeDrain(seed, truths[0], truths[1]);

		return {
			scored: [...walkDrain(rows, true), ...walkDrain(rows, false)],
			// Both reservoirs of every logged row: nothing about a 🪫 row is
			// uninformative here, so α's share is 100% and it is the contrast the
			// λ₀ walk's own share is read against.
			offered: 2 * rows.length,
		};
	});

const restWalkAt = (spread: number): Walk =>
	walkOver(RATING_USERS, spread, [RATE_PRIOR], (seed, truths) => {
		const records = synthesizeRest(seed, truths[0]);

		// One logged rest is two observations of the one shared rate.
		return {
			scored: walkRest(records),
			offered: 2 * records.length,
		};
	});

const stopWalkAt = (spread: number): Walk =>
	walkOver(STOP_USERS, spread, [LAMBDA_PRIOR], (seed, truths) => {
		const days = synthesizeStopDays(seed, truths[0]);

		return {
			scored: walkStop(days),
			offered: days.length,
		};
	});

describe('prequential scores for the three energy fits (ROADMAP item 39)', () => {
	const drain = SPREADS.map(drainWalkAt);
	const rest = SPREADS.map(restWalkAt);
	const stop = SPREADS.map(stopWalkAt);

	it('self-check — the α walk recovers its own rating noise once the fit is fed', () => {
		const late = drain[1].scored.filter((s) => s.n >= 30);
		const recovered = mean(late.map((s) => s.fittedError));

		console.log(
			`[§8.7] α at n ≥ 30: prequential MAE ${recovered.toFixed(4)} against the σ₀ = ` +
				`${DRAIN_NOISE_PRIOR_STD} the ratings were noised at, over ${late.length} held-out observations`,
		);

		// Mean absolute error of a Gaussian is σ·√(2/π) = 0.798σ; the 0–10 quantizer
		// rounds the observation onto a grid the continuous prediction misses by
		// less, which pulls it further down, and the fresh-start residual the fit
		// could not absorb pushes back up. The
		// band is what says the walk is predicting at the RATING's own scale — miss
		// it and the fit and the generator are not the same model, and every cell
		// below is noise.
		expect(recovered).toBeGreaterThan(0.6 * DRAIN_NOISE_PRIOR_STD);
		expect(recovered).toBeLessThan(1.5 * DRAIN_NOISE_PRIOR_STD);
	});

	it('α — the 🪫 drain rates, out of sample', () => {
		for (const [index, spread] of SPREADS.entries())
			printWalk(`[§8.7] α at ${spread}× the prior width`, drain[index]);
	});

	it('r — the ☕ recovery rate, out of sample', () => {
		for (const [index, spread] of SPREADS.entries())
			printWalk(`[§8.9] r at ${spread}× the prior width`, rest[index]);
	});

	it('λ₀ — the stop decisions, out of sample', () => {
		for (const [index, spread] of SPREADS.entries())
			printWalk(`[§8.10] λ₀ at ${spread}× the prior width`, stop[index]);
	});
});
