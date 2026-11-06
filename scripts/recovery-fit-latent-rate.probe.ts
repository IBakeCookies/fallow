/**
 * Whether §8.9 should fit the latent rate instead of the shipped least squares —
 * ROADMAP M132's open question. `recovery-fit-noise-bias.probe.ts` attributed
 * the shipped reading to the before-rating's noise and the after-rating's 0
 * floor; this prices one fit that models both, against the shipped one, on the
 * same days.
 *
 * B is the shipped `fitRecoveryRate`. A, the candidate, gives each pair an
 * unseen true before-level x on a 0.02 grid with weights w; both ratings are
 * Gaussian-noised at an ASSUMED std and notched given x, the after one at
 * x·e^(−r·m·g). It maximizes the likelihood summed over x, fitting w and r
 * together (EM on w, golden section on r) with no prior on r. A needs the
 * rating noise as a number and the app has only `DRAIN_NOISE_PRIOR_STD`, so A
 * assumes it; the rater's real noise is what the readings vary. A′ is A with
 * the noise fitted too, by a golden-section step on it each round within 0.02
 * to 0.5, starting at `DRAIN_NOISE_PRIOR_STD`.
 *
 * THE DAYS ARE THE NOISE-BIAS PROBE'S, generator and seeds copied unchanged.
 * Each rater noise scales the same draws, so every reading reads the same
 * breaks and the same errors at different sizes, and A, A′ and B are handed
 * identical rows in every cell; B's own filter drops a 0 before-rating.
 *
 * Figures below are read off THIS file's own run (2026-11-06). Every one of
 * them is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and the only assertions: handed the true
 * before-levels' histogram as w, A's median reads 0.6935 / 0.6935 / 0.6981
 * against 0.7 at 260 days (fixed / jittered / clustered), so the likelihood is
 * right when told w; and 25 against 75 rounds of the ascent differ by at most
 * 0.0005 over 4 seeds at 260 days, noise 0.15. Handed the same w, A′ reads r̂
 * 0.6918 to 0.7105 over the three rater noises, and σ̂ 0.1495 to 0.1501 at
 * 0.15, 0.1000 to 0.1010 at 0.1 and 0.1985 to 0.2005 at 0.2; with w fitted,
 * its 25 against 75 rounds differ by at most 0.0013 at any of the three.
 *
 * The readings: median error against 0.7, root mean square error, and the
 * seeds of 40 on which A lands closer than B.
 *
 * READING 1 — rater noise 0.15, what A assumes:
 *
 *                     B median     B rms   A median     A rms   A closer
 *     fixed      40     0.0492    0.0942     0.0257    0.1131      15/40
 *               120     0.0426    0.0669    -0.0038    0.0697      20/40
 *               260     0.0279    0.0488    -0.0089    0.0459      22/40
 *     jittered   40     0.0158    0.1221    -0.0099    0.1410      17/40
 *               120     0.0283    0.0680     0.0098    0.0797      18/40
 *               260     0.0310    0.0563    -0.0073    0.0587      23/40
 *     clustered  40     0.1920    0.2005     0.0007    0.1172      32/40
 *               120     0.1687    0.1784    -0.0078    0.0730      35/40
 *               260     0.1574    0.1651    -0.0034    0.0396      40/40
 *
 * READING 2 — rater noise 0.1, A still assuming 0.15:
 *
 *     fixed      40     0.0553    0.0728     0.1386    0.1871       4/40
 *               120     0.0317    0.0466     0.1277    0.1393       2/40
 *               260     0.0324    0.0375     0.1139    0.1262       0/40
 *     jittered   40     0.0266    0.0896     0.1007    0.1546      12/40
 *               120     0.0301    0.0548     0.1082    0.1457       0/40
 *               260     0.0304    0.0461     0.1187    0.1322       0/40
 *     clustered  40     0.0861    0.1179     0.0354    0.0854      31/40
 *               120     0.0968    0.1059     0.0207    0.0572      35/40
 *               260     0.0940    0.0991     0.0252    0.0403      40/40
 *
 * READING 3 — rater noise 0.2, A still assuming 0.15:
 *
 *     fixed      40     0.0493    0.1147    -0.0396    0.1367      19/40
 *               120     0.0468    0.0802    -0.0985    0.1161      14/40
 *               260     0.0358    0.0565    -0.1003    0.1042      11/40
 *     jittered   40     0.0410    0.1647    -0.1084    0.1841      15/40
 *               120     0.0260    0.0931    -0.0844    0.1220      15/40
 *               260     0.0351    0.0689    -0.1022    0.1132       9/40
 *     clustered  40     0.2454    0.2649    -0.0500    0.1424      30/40
 *               120     0.2446    0.2490    -0.0238    0.0946      34/40
 *               260     0.2235    0.2339    -0.0267    0.0582      40/40
 *
 * When A's assumption is right, it removes the lift on the clustered breaks
 * and lands closer than B on 15/40 to 23/40 seeds on the routines. When it is
 * wrong by 0.05 either way, A reads high at noise 0.1 (median error 0.1007 to
 * 0.1386 on the routines, against B's 0.0266 to 0.0553) and low at 0.2 (-0.1084
 * to -0.0396, against B's 0.0260 to 0.0493), and on the routines it lands
 * closer than B on at most 19 of 40 seeds in any cell, and on none at 260 days
 * with noise 0.1. On the clustered breaks it stays closer at every noise and
 * volume, 30/40 to 40/40. So A as priced trades B's lift on one kind of day for
 * a miss of its own on the other.
 *
 * READING 4 — A′, fitting the noise, at each rater noise (B's columns for the
 * same cells are readings 1–3's):
 *
 *                   A′ median    A′ rms   σ̂ median  A′ closer
 *   noise 0.15
 *     fixed      40     0.0092    0.1082     0.1465      17/40
 *               120    -0.0071    0.0716     0.1484      19/40
 *               260    -0.0047    0.0456     0.1491      22/40
 *     jittered   40    -0.0188    0.1451     0.1476      13/40
 *               120     0.0019    0.0783     0.1482      21/40
 *               260    -0.0085    0.0595     0.1499      22/40
 *     clustered  40     0.0058    0.1177     0.1523      30/40
 *               120    -0.0081    0.0737     0.1504      35/40
 *               260    -0.0037    0.0397     0.1504      40/40
 *   noise 0.1
 *     fixed      40     0.0206    0.0667     0.0978      24/40
 *               120     0.0018    0.0404     0.0982      25/40
 *               260    -0.0037    0.0264     0.0997      27/40
 *     jittered   40    -0.0123    0.0932     0.0957      19/40
 *               120    -0.0011    0.0500     0.0984      22/40
 *               260    -0.0030    0.0394     0.0998      26/40
 *     clustered  40    -0.0060    0.0731     0.1001      30/40
 *               120    -0.0046    0.0465     0.1005      33/40
 *               260    -0.0030    0.0278     0.1006      40/40
 *   noise 0.2
 *     fixed      40     0.0091    0.1564     0.1961      17/40
 *               120    -0.0238    0.0983     0.1979      14/40
 *               260    -0.0118    0.0578     0.1987      23/40
 *     jittered   40    -0.0162    0.2070     0.1958      15/40
 *               120    -0.0105    0.1245     0.1973      16/40
 *               260    -0.0139    0.0815     0.1998      17/40
 *     clustered  40     0.0100    0.1476     0.2024      31/40
 *               120     0.0018    0.1002     0.2016      36/40
 *               260     0.0088    0.0554     0.1999      40/40
 *
 * The pairs carry the noise: A′'s σ̂ median reads 0.1465 to 0.1523 at 0.15,
 * 0.0957 to 0.1006 at 0.1 and 0.1958 to 0.2024 at 0.2, and the run prints it
 * on a bound in 0/40 fits in every cell. A′'s median error stays between
 * -0.0238 and 0.0206 in every cell, so neither B's lift nor A's miss shows in
 * it. Its rms against B's on the routines turns on the noise: at 0.1 it is
 * below B's in every routine cell but jittered at 40 days (0.0932 against
 * 0.0896), at 0.15 above in every one but fixed at 260 days (0.0456 against
 * 0.0488), and at 0.2 above in all six (0.0578 to 0.2070, against B's 0.0565
 * to 0.1647). On the routines it lands closer than B on 13/40 to 22/40 at
 * 0.15, 19/40 to 27/40 at 0.1 and 14/40 to 23/40 at 0.2; on the clustered
 * breaks on 30/40 to 40/40 at every noise.
 *
 * Fixed before this reading ran: the pairs carry the noise only if A′'s σ̂
 * median at 260 days on the routines lands within 0.02 of the rater noise at
 * all three noises and never on a bound; A′ beats B only if, beyond that, its
 * median error on the routines is no larger in size than B's in every cell and
 * it lands closer on the clustered breaks on 30/40 or better; anything else
 * keeps B. The noise half holds (figures under WHAT WOULD FALSIFY WHAT), and so
 * does the clustered half. The routine half misses one cell, noise 0.15,
 * jittered, 40 days: -0.0188 against B's 0.0158. By that rule B stays.
 *
 * WHAT WOULD FALSIFY WHAT. If A had missed 0.7 when handed the true w, the
 * likelihood would be wrong and no reading would mean anything; it reads
 * 0.6935–0.6981. If A had stayed near 0.7 on the routines at noise 0.1 and 0.2
 * too, the noise assumption would not matter there; its median error reads
 * 0.1007 to 0.1386 and -0.1084 to -0.0396. If
 * A's clustered win had gone at a wrong noise, A would have no case at all; it
 * holds at 30/40 or better. If A′'s σ̂ had drifted from the rater noise or sat
 * on a bound, the pairs would not carry the noise and A′ would be A with extra
 * steps; at 260 days on the routines it reads 0.1491 to 0.1499 at 0.15, 0.0997
 * to 0.0998 at 0.1 and 0.1987 to 0.1998 at 0.2, on a bound in 0/40.
 *
 * A probe, not a test. Every figure moves with the generator (the default α,
 * the session draw, `restRecoveryMultiplier`) and with the noise model: A is
 * graded in a world whose noise is Gaussian, alike on both ratings and on
 * every rater, and nothing here runs any other. The truth is r = 0.7, B's own
 * prior mean, which favours B's ridge; A has no prior but starts its ascent
 * there, and A′ starts its noise at `DRAIN_NOISE_PRIOR_STD`, which is reading
 * 1's truth. No ± is derived.
 * Slow; run it alone.
 *
 * Usage: npm run probe -- scripts/recovery-fit-latent-rate.probe.ts
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DRAIN_NOISE_PRIOR_STD,
	fitRecoveryRate,
	simulateReservoirs,
	type ReservoirDemand,
} from '$lib/business/model/zenith-energy';
import { RECOVERY_FIT_MAX, RECOVERY_FIT_MIN } from '$lib/business/utils/energy-fit-bounds';

const DAYS = 260;
const VOLUMES = [40, 120, DAYS];
const SEEDS = 40;
const BASE_SEED = 0xc0ffee;
const FIXED_START_HOUR = 9;
const TRUE_RATE = DEFAULT_ENERGY_PARAMS.recoveryRate;
const MULTIPLIER = DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;
/** What the candidate assumes of every rating, whatever the rater's real noise. */
const ASSUMED_NOISE = DRAIN_NOISE_PRIOR_STD;
/** The rater's real noise: the assumed one, then a steadier and a shakier hand. */
const RATER_NOISES = [ASSUMED_NOISE, 0.1, 0.2];
/** A′'s search range for the rating noise; it starts at ASSUMED_NOISE, the only number the app has. */
const NOISE_FIT_MIN = 0.02;
const NOISE_FIT_MAX = 0.5;

/** The latent before-level's support, in drained-fraction steps of 0.02. */
const LATENT_GRID = Array.from(
	{
		length: 51,
	},
	(_, index) => index / 50,
);

const ROUNDS = 25;
const EM_STEPS = 30;
const GOLDEN_STEPS = 40;
const CONVERGENCE_SEEDS = 4;

type Routine = 'fixed' | 'jittered' | 'clustered';

const ROUTINES: Routine[] = ['fixed', 'jittered', 'clustered'];

// ================== The circadian probe's generator, unchanged at a = 0 ==================

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

const quarter = (random: () => number, count: number): number =>
	0.25 * Math.floor(random() * count);

const demandOf = (random: () => number, id: number): ReservoirDemand => ({
	id,
	cognitiveDemand: (1 + Math.floor(random() * 10)) / 10,
	physicalDemand: (1 + Math.floor(random() * 10)) / 10,
});

interface Session {
	start: number;
	hours: number;
	demand: ReservoirDemand;
}

function sessionsOf(routine: Routine, random: () => number): Session[] {
	if (routine === 'clustered') {
		const start = 8 + quarter(random, 9);
		const lunch = 12 + quarter(random, 5);
		const lunchEnd = lunch + 0.5 + quarter(random, 3);
		const afternoon = 15 + quarter(random, 5);
		const afternoonEnd = afternoon + 0.25 + quarter(random, 2);
		const end = 17 + quarter(random, 7);

		return [
			[start, lunch],
			[lunchEnd, afternoon],
			[afternoonEnd, end],
		].map(([from, to], index) => ({
			start: from,
			hours: to - from,
			demand: demandOf(random, index + 1),
		}));
	}

	const sessions: Session[] = [];
	const count = 2 + Math.floor(random() * 3);
	let hour = routine === 'fixed' ? FIXED_START_HOUR : 6 + quarter(random, 25);

	for (let index = 0; index < count; index++) {
		const hours = 0.75 * (1 + Math.floor(random() * 4));
		const demand = demandOf(random, index + 1);
		const gap = index === 0 ? 0 : 0.25 * (1 + Math.floor(random() * 8));

		if (hour + gap + hours > 24) break;

		sessions.push({
			start: hour + gap,
			hours,
			demand,
		});

		hour += gap + hours;
	}

	return sessions;
}

function stepBlock(
	taskId: number | null,
	hours: number,
	demand: ReservoirDemand,
	cog: number,
	phys: number,
): { endCog: number; endPhys: number } {
	return simulateReservoirs(
		[
			{
				taskId,
				hours,
			},
		],
		[demand],
		{
			...DEFAULT_ENERGY_PARAMS,
			initialCog: cog,
			initialPhys: phys,
		},
	);
}

/** One reservoir's side of a logged break: the truth, and the two noise draws its ratings get. */
interface TruePair {
	day: number;
	hours: number;
	before: number;
	after: number;
	beforeNoise: number;
	afterNoise: number;
}

function synthesize(routine: Routine, seed: number): TruePair[] {
	const random = mulberry32(seed);
	const pairs: TruePair[] = [];

	for (let day = 0; day < DAYS; day++) {
		const sessions = sessionsOf(routine, random);
		let cog = 1;
		let phys = 1;
		let clock = sessions[0].start;

		for (const [index, session] of sessions.entries()) {
			if (index > 0) {
				const hours = session.start - clock;

				const before = {
					cog,
					phys,
				};

				({ endCog: cog, endPhys: phys } = stepBlock(null, hours, session.demand, cog, phys));

				const noise = [gaussian(random), gaussian(random), gaussian(random), gaussian(random)];
				// The circadian probe's late-arm lag, drawn so the stream stays aligned.
				random();

				pairs.push(
					{
						day,
						hours,
						before: 1 - before.cog,
						after: 1 - cog,
						beforeNoise: noise[0],
						afterNoise: noise[1],
					},
					{
						day,
						hours,
						before: 1 - before.phys,
						after: 1 - phys,
						beforeNoise: noise[2],
						afterNoise: noise[3],
					},
				);
			}

			({ endCog: cog, endPhys: phys } = stepBlock(
				session.demand.id,
				session.hours,
				session.demand,
				cog,
				phys,
			));

			clock = session.start + session.hours;
		}
	}

	return pairs;
}

// ================== The two estimators ==================

/** One reservoir's side of a pair as stored: 0–10 notches and the break length. */
interface Row {
	before: number;
	after: number;
	hours: number;
}

const toNotch = (fraction: number): number => Math.max(0, Math.min(10, Math.round(fraction * 10)));

const observe = (pairs: TruePair[], noise: number): Row[] =>
	pairs.map((pair) => ({
		before: toNotch(pair.before + noise * pair.beforeNoise),
		after: toNotch(pair.after + noise * pair.afterNoise),
		hours: pair.hours,
	}));

/** B: the shipped §8.9 fit over the same rows. */
const fitShipped = (rows: Row[]): number =>
	fitRecoveryRate(
		rows.map((row) => ({
			drainedBefore: row.before / 10,
			drainedAfter: row.after / 10,
			hours: row.hours,
		})),
		TRUE_RATE,
		DEFAULT_ENERGY_PARAMS,
	).rate;

/** erfc by its Chebyshev fit, fractional error under 1.2e-7 — Numerical Recipes' erfcc. */
function complementaryErrorFunction(x: number): number {
	const t = 1 / (1 + 0.5 * Math.abs(x));

	const value =
		t *
		Math.exp(
			-x * x -
				1.26551223 +
				t *
					(1.00002368 +
						t *
							(0.37409196 +
								t *
									(0.09678418 +
										t *
											(-0.18628806 +
												t *
													(0.27886807 +
														t *
															(-1.13520398 +
																t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
		);

	return x >= 0 ? value : 2 - value;
}

const normalCdf = (z: number): number => 0.5 * complementaryErrorFunction(-z / Math.SQRT2);

/** P(stored notch n | true drained fraction v): Gaussian noise at std σ, rounded, clamped to 0–10. */
function notchProbability(n: number, v: number, sigma: number): number {
	const upper = n === 10 ? 1 : normalCdf(((n + 0.5) / 10 - v) / sigma);
	const lower = n === 0 ? 0 : normalCdf(((n - 0.5) / 10 - v) / sigma);

	return Math.max(upper - lower, Number.MIN_VALUE);
}

/** Rows that share a before notch, an after notch and a break length share a likelihood. */
interface Cell {
	before: number;
	after: number;
	hours: number;
	count: number;
}

function cellsOf(rows: Row[]): Cell[] {
	const cells = new Map<string, Cell>();

	for (const row of rows) {
		const key = `${row.before}|${row.after}|${row.hours}`;
		const cell = cells.get(key);

		if (cell) cell.count++;
		else
			cells.set(key, {
				...row,
				count: 1,
			});
	}

	return [...cells.values()];
}

function goldenSection(objective: (value: number) => number, from: number, to: number): number {
	let low = from;
	let high = to;

	for (let step = 0; step < GOLDEN_STEPS; step++) {
		const left = low + 0.382 * (high - low);
		const right = low + 0.618 * (high - low);

		if (objective(left) < objective(right)) high = right;
		else low = left;
	}

	return (low + high) / 2;
}

interface LatentFit {
	rate: number;
	noise: number;
}

/**
 * A: the latent-rate candidate. Each pair has an unseen true before-level x on
 * LATENT_GRID with weight w(x); both ratings are noised and notched given x,
 * the after one at x·e^(−r·m·g). The likelihood sums over x, and r and w are
 * fitted together by coordinate ascent — EM steps on w, golden section on r —
 * unless `weights` hands it w. No prior on r. A holds the noise at
 * ASSUMED_NOISE; A′ (`withNoiseFit`) adds a golden-section step on it each round.
 */
function fitLatent(
	rows: Row[],
	{
		weights: fixedWeights,
		rounds = ROUNDS,
		withNoiseFit = false,
	}: { weights?: number[]; rounds?: number; withNoiseFit?: boolean } = {},
): LatentFit {
	const cells = cellsOf(rows);

	const tableAt = (decay: number, sigma: number): number[][] =>
		Array.from(
			{
				length: 11,
			},
			(_, n) => LATENT_GRID.map((x) => notchProbability(n, x * decay, sigma)),
		);

	const beforeAt = (sigma: number): number[][] => {
		const table = tableAt(1, sigma);

		return cells.map((cell) => table[cell.before]);
	};

	const afterAt = (rate: number, sigma: number): number[][] => {
		const byHours = new Map<number, number[][]>();

		return cells.map((cell) => {
			let table = byHours.get(cell.hours);

			if (!table) {
				table = tableAt(Math.exp(-rate * MULTIPLIER * cell.hours), sigma);
				byHours.set(cell.hours, table);
			}

			return table[cell.after];
		});
	};

	const negativeLogLikelihood = (
		weights: number[],
		before: number[][],
		after: number[][],
	): number =>
		-cells.reduce((sum, cell, i) => {
			let likelihood = 0;

			for (let j = 0; j < LATENT_GRID.length; j++)
				likelihood += weights[j] * before[i][j] * after[i][j];

			return sum + cell.count * Math.log(likelihood);
		}, 0);

	/** One EM step on w: each cell's posterior over x, pooled. */
	const stepWeights = (weights: number[], before: number[][], after: number[][]): number[] => {
		const next = LATENT_GRID.map(() => 0);

		for (const [i, cell] of cells.entries()) {
			const joint = LATENT_GRID.map((_, j) => weights[j] * before[i][j] * after[i][j]);
			const total = joint.reduce((sum, value) => sum + value, 0);

			for (let j = 0; j < LATENT_GRID.length; j++) next[j] += (cell.count * joint[j]) / total;
		}

		return next.map((value) => value / rows.length);
	};

	let weights = fixedWeights ?? LATENT_GRID.map(() => 1 / LATENT_GRID.length);
	let rate = TRUE_RATE;
	let noise = ASSUMED_NOISE;

	for (let round = 0; round < rounds; round++) {
		const before = beforeAt(noise);

		if (!fixedWeights) {
			const after = afterAt(rate, noise);

			for (let step = 0; step < EM_STEPS; step++) weights = stepWeights(weights, before, after);
		}

		const current = weights;
		const sigma = noise;

		rate = goldenSection(
			(candidate) => negativeLogLikelihood(current, before, afterAt(candidate, sigma)),
			RECOVERY_FIT_MIN,
			RECOVERY_FIT_MAX,
		);

		if (withNoiseFit) {
			const fitted = rate;

			noise = goldenSection(
				(candidate) =>
					negativeLogLikelihood(current, beforeAt(candidate), afterAt(fitted, candidate)),
				NOISE_FIT_MIN,
				NOISE_FIT_MAX,
			);
		}
	}

	return {
		rate,
		noise,
	};
}

/** The TRUE before-levels' histogram on LATENT_GRID — the w no logger could hand the fit. */
function trueWeightsOf(pairs: TruePair[]): number[] {
	const weights = LATENT_GRID.map(() => 1e-6);

	for (const pair of pairs)
		weights[Math.round(Math.max(0, Math.min(1, pair.before)) * (LATENT_GRID.length - 1))] += 1;

	const total = weights.reduce((sum, value) => sum + value, 0);

	return weights.map((value) => value / total);
}

// ================== Summaries ==================

const median = (values: number[]): number =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const rootMeanSquare = (values: number[]): number =>
	Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);

const f4 = (value: number): string => value.toFixed(4);

const histories = ROUTINES.map((routine) =>
	Array.from(
		{
			length: SEEDS,
		},
		(_, seed) => synthesize(routine, BASE_SEED + seed),
	),
);

const prefix = (pairs: TruePair[], days: number): TruePair[] =>
	pairs.filter((pair) => pair.day < days);

/** Both estimators on identical rows, per seed: errors against the generator's r. */
function compare(index: number, noise: number, days: number): string {
	const shipped: number[] = [];
	const latent: number[] = [];

	for (const pairs of histories[index]) {
		const rows = observe(prefix(pairs, days), noise);
		shipped.push(fitShipped(rows) - TRUE_RATE);
		latent.push(fitLatent(rows).rate - TRUE_RATE);
	}

	const closer = latent.filter((error, seed) => Math.abs(error) < Math.abs(shipped[seed])).length;

	return (
		`B median error ${f4(median(shipped))}, rms ${f4(rootMeanSquare(shipped))} | ` +
		`A median error ${f4(median(latent))}, rms ${f4(rootMeanSquare(latent))} | ` +
		`A closer on ${closer}/${SEEDS}`
	);
}

/** A′ on the same rows, per seed: its errors, its fitted noise, and how often it lands closer than B. */
function compareNoiseFitted(index: number, noise: number, days: number): string {
	const shipped: number[] = [];
	const latent: number[] = [];
	const noises: number[] = [];

	for (const pairs of histories[index]) {
		const rows = observe(prefix(pairs, days), noise);

		const fit = fitLatent(rows, {
			withNoiseFit: true,
		});

		shipped.push(fitShipped(rows) - TRUE_RATE);
		latent.push(fit.rate - TRUE_RATE);
		noises.push(fit.noise);
	}

	const closer = latent.filter((error, seed) => Math.abs(error) < Math.abs(shipped[seed])).length;

	const onBound = noises.filter(
		(value) => value < NOISE_FIT_MIN + 1e-3 || value > NOISE_FIT_MAX - 1e-3,
	).length;

	return (
		`A′ median error ${f4(median(latent))}, rms ${f4(rootMeanSquare(latent))}, ` +
		`σ̂ median ${f4(median(noises))}, on a bound ${onBound}/${SEEDS} | ` +
		`A′ closer than B on ${closer}/${SEEDS}`
	);
}

describe('MATH.md §8.9 — a latent-rate fit against the shipped one (ROADMAP M132)', () => {
	it('self-check: handed the true before-levels, the likelihood recovers the generator; the ascent has settled', () => {
		for (const [index, routine] of ROUTINES.entries()) {
			const oracle = median(
				histories[index].map(
					(pairs) =>
						fitLatent(observe(pairs, ASSUMED_NOISE), {
							weights: trueWeightsOf(pairs),
						}).rate,
				),
			);

			const settled = histories[index]
				.slice(0, CONVERGENCE_SEEDS)
				.map((pairs) => observe(pairs, ASSUMED_NOISE))
				.map((rows) =>
					Math.abs(
						fitLatent(rows).rate -
							fitLatent(rows, {
								rounds: 3 * ROUNDS,
							}).rate,
					),
				);

			const worst = Math.max(...settled);

			console.log(
				`[§8.9] self-check ${routine}, ${DAYS} days: true-weights r̂ ${f4(oracle)} against ${TRUE_RATE}; ` +
					`${ROUNDS} against ${3 * ROUNDS} rounds differ by at most ${f4(worst)} over ${CONVERGENCE_SEEDS} seeds`,
			);

			// Load-bearing: a likelihood that misses r when told w cannot be graded on whether it finds w.
			expect(Math.abs(oracle - TRUE_RATE)).toBeLessThan(0.02);
			expect(worst).toBeLessThan(0.005);
		}
	});

	it('self-check: A′, handed the true before-levels, recovers r and the noise; its ascent has settled', () => {
		for (const noise of RATER_NOISES)
			for (const [index, routine] of ROUTINES.entries()) {
				const oracle = histories[index].map((pairs) =>
					fitLatent(observe(pairs, noise), {
						weights: trueWeightsOf(pairs),
						withNoiseFit: true,
					}),
				);

				const rate = median(oracle.map((fit) => fit.rate));
				const sigma = median(oracle.map((fit) => fit.noise));

				const settled = histories[index].slice(0, CONVERGENCE_SEEDS).map((pairs) => {
					const rows = observe(pairs, noise);

					const short = fitLatent(rows, {
						withNoiseFit: true,
					});

					const long = fitLatent(rows, {
						withNoiseFit: true,
						rounds: 3 * ROUNDS,
					});

					return Math.max(Math.abs(short.rate - long.rate), Math.abs(short.noise - long.noise));
				});

				const worst = Math.max(...settled);

				console.log(
					`[§8.9] self-check A′ noise ${noise} ${routine}, ${DAYS} days: true-weights r̂ ${f4(rate)}, σ̂ ${f4(sigma)}; ` +
						`${ROUNDS} against ${3 * ROUNDS} rounds differ by at most ${f4(worst)} over ${CONVERGENCE_SEEDS} seeds`,
				);

				expect(Math.abs(rate - TRUE_RATE)).toBeLessThan(0.02);
				expect(Math.abs(sigma - noise)).toBeLessThan(0.01);
				expect(worst).toBeLessThan(0.005);
			}
	});

	for (const [reading, noise] of RATER_NOISES.entries())
		it(`reading ${reading + 1} — rater noise ${noise}, A assuming ${ASSUMED_NOISE}`, () => {
			for (const [index, routine] of ROUTINES.entries())
				for (const days of VOLUMES)
					console.log(
						`[§8.9] noise ${noise} ${routine.padEnd(10)}${String(days).padStart(4)} days: ${compare(index, noise, days)}`,
					);
		});

	it('reading 4 — A′, which fits the noise too, at each rater noise', () => {
		for (const noise of RATER_NOISES)
			for (const [index, routine] of ROUTINES.entries())
				for (const days of VOLUMES)
					console.log(
						`[§8.9] A′ noise ${noise} ${routine.padEnd(10)}${String(days).padStart(4)} days: ${compareNoiseFitted(index, noise, days)}`,
					);
	});
});
