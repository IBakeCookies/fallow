/**
 * Why §8.9's r̂ reads high when both ratings of a ☕ pair carry noise — ROADMAP
 * M132, which `rest-circadian-residual.probe.ts` found and did not attribute.
 *
 * THE DAYS ARE THAT PROBE'S. The generator, seed and draw order are copied
 * from its a = 0 arm, so seed for seed this file reads the same breaks; its
 * shipped arm reproduces that probe's median r̂ at 260 days. Every day is chained
 * from full reservoirs through the shipped `simulateReservoirs`, and a pair is
 * the true drained fraction at a break's two ends, per reservoir. What changes
 * between arms is only how a true pair becomes the observation the fit reads.
 *
 * Two estimators. The SHIPPED fit is `fitRecoveryRate` at the default as
 * fallback and prior, with its own filter and clamps. The BARE fit is plain
 * least squares on the same rest law with no prior, no clamp and no filter, so
 * one mechanism can be switched on at a time.
 *
 * Figures below are read off THIS file's own run (2026-11-06). Every one of
 * them is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and the only assertions: with exact ratings both
 * fits read 0.7000 on every routine, and the bare fit with zero-mean noise on
 * the after-rating alone reads 0.7007 / 0.7002 / 0.6961 (fixed / jittered /
 * clustered, 260 days) — noise in the observed variable is not the bias.
 *
 * READING 1 — the two mechanisms, bare fit, 260 days:
 *
 *                      exact  before noised  after noised  after noised, floored
 *     fixed           0.7000         0.9750        0.7007                 0.5324
 *     jittered        0.7000         0.9741        0.7002                 0.5314
 *     clustered       0.7000         0.9585        0.6961                 0.6325
 *
 * Noise on the before-rating is errors in variables: the fit takes d_before as
 * exact, so the decay factor it reads is attenuated toward 0 and r̂ reads high.
 * Noise on the after-rating is harmless until the 0 floor censors it upward
 * where a break ends nearly recovered; then recovery reads slower and r̂ low. A
 * noised after-rating falls below 0 in 33.0% / 32.9% of pairs on the routines
 * and 20.9% on the clustered breaks, which keep less of the floor's pull.
 *
 * READING 2 — the shipped fit, per volume. Median r̂ (median ±, seeds whose r̂
 * is within 2σ of 0.7 by its own ±):
 *
 *                      both noised             before only   after only   noiseless
 *     fixed      40    0.7492 (0.0843, 38/40)  0.9384        0.5653       0.7146
 *               120    0.7426 (0.0479, 36/40)  0.9544        0.5571       0.7173
 *               260    0.7279 (0.0322, 31/40)  0.9479        0.5515       0.7184
 *     jittered   40    0.7158 (0.0818, 35/40)  0.9446        0.5266       0.7198
 *               120    0.7283 (0.0475, 36/40)  0.9576        0.5529       0.7223
 *               260    0.7310 (0.0322, 30/40)  0.9522        0.5407       0.7191
 *     clustered  40    0.8920 (0.0927, 21/40)  0.9632        0.6455       0.7155
 *               120    0.8687 (0.0523,  8/40)  0.9418        0.6402       0.7130
 *               260    0.8574 (0.0352,  0/40)  0.9361        0.6458       0.7152
 *
 * The shipped reading is the two mechanisms netted against each other. On the
 * session-gap routines the floor nearly cancels the lift; on the clustered
 * breaks it does not, and the fit's own ± covers the truth less as pairs
 * accrue: 21/40 seeds within 2σ of 0.7 at 40 days, 8/40 at 120, 0/40 at 260.
 * With no noise the quantizer alone reads 0.7130–0.7223.
 *
 * `energy-fit-prequential.probe.ts` cannot see this: its before-rating is exact.
 * Its prequential grade scores predicting the typed after-rating from the typed
 * before-rating, which is the quantity the shipped fit minimizes, attenuation
 * included; the planner and §8.7's α fit read r̂ as the rate itself.
 *
 * WHAT WOULD FALSIFY WHAT. If the bare fit with noise on the after-rating alone
 * had moved off 0.7, the bias would be the rest law's nonlinearity and not the
 * observation model; it reads 0.6961–0.7007. If the before-only arm had stayed
 * near 0.7, errors in variables would not be the lift; it reads 0.9585–0.9750.
 * If the floored arm had read like the unfloored one, the floor would not be
 * what pulls the routines back; it reads 0.5314–0.6325.
 *
 * A probe, not a test. Every figure moves with the rating noise
 * (`DRAIN_NOISE_PRIOR_STD`, the generator's), with the r fit's prior, bounds and
 * filter, with `restRecoveryMultiplier`, and with the default α and the session
 * draw, which set how drained a break starts and how recovered it ends — the
 * two things that size the two mechanisms. The suite pins the direction of the
 * lift ("recovery-rate calibration (fitRecoveryRate, MATH.md §8.9)" in
 * `zenith-energy.test.ts`).
 *
 * Usage: npm run probe -- scripts/recovery-fit-noise-bias.probe.ts
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DRAIN_NOISE_PRIOR_STD,
	fitRecoveryRate,
	simulateReservoirs,
	type RecoveryRateFit,
	type ReservoirDemand,
	type RestObservation,
} from '$lib/business/model/zenith-energy';
import { RECOVERY_FIT_MAX, RECOVERY_FIT_MIN } from '$lib/business/utils/energy-fit-bounds';

const DAYS = 260;
const VOLUMES = [40, 120, DAYS];
const SEEDS = 40;
const BASE_SEED = 0xc0ffee;
const FIXED_START_HOUR = 9;
const TRUE_RATE = DEFAULT_ENERGY_PARAMS.recoveryRate;
const MULTIPLIER = DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;
const NOISE = DRAIN_NOISE_PRIOR_STD;

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

// ================== Observation models ==================

/** The stored rating: noised, rounded to a notch, clamped to 0–10, read back as a fraction. */
const notch = (fraction: number): number =>
	Math.max(0, Math.min(10, Math.round(fraction * 10))) / 10;

interface Observation {
	label: string;
	before: (pair: TruePair) => number;
	after: (pair: TruePair) => number;
}

const noisedBefore = (pair: TruePair): number => pair.before + NOISE * pair.beforeNoise;
const noisedAfter = (pair: TruePair): number => pair.after + NOISE * pair.afterNoise;

const EXACT: Observation = {
	label: 'exact',
	before: (pair) => pair.before,
	after: (pair) => pair.after,
};

const AFTER_NOISED: Observation = {
	label: 'after noised',
	before: (pair) => pair.before,
	after: noisedAfter,
};

/** Through the shipped fit, which drops a 0 before-rating and clamps both to [0, 1]. */
const SHIPPED: Observation[] = [
	{
		label: 'both noised',
		before: (pair) => notch(noisedBefore(pair)),
		after: (pair) => notch(noisedAfter(pair)),
	},
	{
		label: 'before only',
		before: (pair) => notch(noisedBefore(pair)),
		after: (pair) => notch(pair.after),
	},
	{
		label: 'after only',
		before: (pair) => notch(pair.before),
		after: (pair) => notch(noisedAfter(pair)),
	},
	{
		label: 'noiseless',
		before: (pair) => notch(pair.before),
		after: (pair) => notch(pair.after),
	},
	EXACT,
];

/** Through the bare fit: one mechanism at a time, nothing rounded, nothing dropped. */
const BARE: Observation[] = [
	EXACT,
	{
		label: 'before noised',
		before: noisedBefore,
		after: (pair) => pair.after,
	},
	AFTER_NOISED,
	{
		label: 'after noised, floored',
		before: (pair) => pair.before,
		after: (pair) => Math.max(0, noisedAfter(pair)),
	},
];

const observe = (pairs: TruePair[], observation: Observation): RestObservation[] =>
	pairs.map((pair) => ({
		drainedBefore: observation.before(pair),
		drainedAfter: observation.after(pair),
		hours: pair.hours,
	}));

/** Least squares on d_after = d_before·e^(−r·m·g) alone, by golden section over the fit's bounds. */
function fitBare(observations: RestObservation[]): number {
	const loss = (rate: number): number =>
		observations.reduce((sum, o) => {
			const residual = o.drainedAfter - o.drainedBefore * Math.exp(-rate * MULTIPLIER * o.hours);

			return sum + residual * residual;
		}, 0);

	let low = RECOVERY_FIT_MIN;
	let high = RECOVERY_FIT_MAX;

	for (let step = 0; step < 100; step++) {
		const left = low + 0.382 * (high - low);
		const right = low + 0.618 * (high - low);

		if (loss(left) < loss(right)) high = right;
		else low = left;
	}

	return (low + high) / 2;
}

const fitShipped = (observations: RestObservation[]): RecoveryRateFit =>
	fitRecoveryRate(observations, TRUE_RATE, DEFAULT_ENERGY_PARAMS);

// ================== Summaries ==================

const median = (values: number[]): number =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

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

const bareMedian = (
	routineHistories: TruePair[][],
	observation: Observation,
	days = DAYS,
): number =>
	median(routineHistories.map((pairs) => fitBare(observe(prefix(pairs, days), observation))));

const shippedFits = (
	routineHistories: TruePair[][],
	observation: Observation,
	days: number,
): RecoveryRateFit[] =>
	routineHistories.map((pairs) => fitShipped(observe(prefix(pairs, days), observation)));

describe('MATH.md §8.9 — what lifts r̂ when both ratings of a ☕ pair are noised (ROADMAP M132)', () => {
	it('self-check: exact ratings recover the generator, and after-rating noise alone is unbiased', () => {
		for (const [index, routine] of ROUTINES.entries()) {
			const shipped = median(shippedFits(histories[index], EXACT, DAYS).map((fit) => fit.rate));
			const bare = bareMedian(histories[index], EXACT);
			const afterNoised = bareMedian(histories[index], AFTER_NOISED);

			console.log(
				`[§8.9] self-check ${routine}, ${DAYS} days: exact ratings read shipped ${shipped.toFixed(4)}, ` +
					`bare ${bare.toFixed(4)}; bare with after-rating noise alone ${afterNoised.toFixed(4)}, against ${TRUE_RATE}`,
			);

			// Load-bearing: if exact ratings do not read the generator, no arm below isolates anything.
			expect(Math.abs(shipped - TRUE_RATE)).toBeLessThan(1e-3);
			expect(Math.abs(bare - TRUE_RATE)).toBeLessThan(1e-3);
			expect(Math.abs(afterNoised - TRUE_RATE)).toBeLessThan(0.02);
		}
	});

	it('reading 1 — the two mechanisms, one at a time (bare fit)', () => {
		console.log(`[§8.9] bare fit, ${DAYS} days: ${BARE.map((arm) => arm.label).join(' | ')}`);

		for (const [index, routine] of ROUTINES.entries()) {
			const floored =
				histories[index].flat().filter((pair) => noisedAfter(pair) < 0).length /
				histories[index].flat().length;

			console.log(
				`[§8.9]   ${routine.padEnd(10)} ${BARE.map((arm) => bareMedian(histories[index], arm).toFixed(4)).join('  ')}` +
					`  — a noised after-rating falls below 0 in ${(100 * floored).toFixed(1)}%`,
			);
		}
	});

	it('reading 2 — the shipped fit per volume, and whether its own ± covers the truth', () => {
		console.log(
			`[§8.9] shipped fit: median r̂ (median ±, seeds within 2σ of ${TRUE_RATE}) per arm: ${SHIPPED.map(
				(arm) => arm.label,
			).join(' | ')}`,
		);

		for (const [index, routine] of ROUTINES.entries()) {
			for (const days of VOLUMES) {
				const cells = SHIPPED.map((arm) => {
					const fits = shippedFits(histories[index], arm, days);

					const covered = fits.filter(
						(fit) => Math.abs(fit.rate - TRUE_RATE) <= 2 * (fit.rateStd ?? 0),
					).length;

					return (
						`${median(fits.map((fit) => fit.rate)).toFixed(4)} ` +
						`(${median(fits.map((fit) => fit.rateStd ?? Number.NaN)).toFixed(4)}, ${covered}/${SEEDS})`
					);
				});

				console.log(
					`[§8.9]   ${routine.padEnd(10)}${String(days).padStart(4)}  ${cells.join('  ')}`,
				);
			}
		}
	});
});
