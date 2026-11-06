/**
 * Whether an hour-of-day term in the recovery rate (§8.9) can be read off ☕
 * rest pairs — ROADMAP item 47, the reading `circadian-residual.probe.ts` found
 * impossible on the 🪫 side, where the fresh-start approximation manufactures
 * an afternoon term and the ceiling a coefficient must clear is that artefact.
 * §8.9's law reads BOTH endpoints of a break and assumes no starting level, so
 * the question here is what sets the ceiling instead, and whether anything a
 * logger could hold clears it. With real rating noise nothing does at 40 or
 * 120 days, and at 260 only a term peaking where the noise's own shape sits.
 *
 * THE GENERATOR IS THE MODEL. Every day is chained from full reservoirs through
 * the shipped `simulateReservoirs` one block at a time, sessions at the default
 * α, and r taken from r(h) = r₀·(1 + a·cos(2π(h − 16)/24)) at each block's
 * midpoint hour — on every block, since r is in the law during work too, though
 * a pair reads only its break. A pair is the reservoirs at a break's two ends,
 * each of its four ratings noised at `DRAIN_NOISE_PRIOR_STD` on its own and
 * quantized to the stored 0–10 notches: the two fuzzy ratings
 * `RECOVERY_NOISE_PRIOR_STD` is sized for. A break is whatever the gap between
 * two sessions is, in quarter hours the ☕ editor's whole minutes reach, and
 * `createdAt` is its end. The reading is the app's — `fitRecoveryRate` over
 * every pair at `DEFAULT_ENERGY_PARAMS` — and its residual, prediction less
 * rating so that faster recovery reads positive, is regressed on
 * [1, cos(2πh/24), sin(2πh/24)] at the break's midpoint, `createdAt` less half
 * the break, over the observations the fit itself kept. That regression and
 * the ceiling (the max over 40 a = 0 seeds) are copied unchanged from
 * `circadian-residual.probe.ts`, so the two files read one quantity; a copy,
 * because `scripts/` imports nothing but `$lib`.
 *
 * Three day structures. `fixed` and `jittered` are the 🪫 probe's — a 09:00
 * start or one drawn 06:00–12:00, 2–4 sessions on the 45-minute lattice,
 * quarter-hour gaps — with every gap logged, the ☕ log that logger would hold.
 * `clustered` puts the breaks where people take them: lunch starting
 * 12:00–13:00 for 30–60 minutes, then 15:00–16:00 for 15–30. Volume is the 40-,
 * 120- and 260-day prefix of one seeded history; 260 days with every break
 * logged, over 500 pairs, is a best case and not a typical log.
 *
 * Figures below are read off THIS file's own run (2026-11-06). Every one of
 * them is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and the only assertions: at a = 0 with no rating
 * noise the fit recovers r̂ 0.7184 / 0.7191 / 0.7152 against 0.7 (fixed /
 * jittered / clustered, 260 days: 2.6% / 2.7% / 2.2%), and the amplitude it
 * reads, 0.0052 / 0.0033 / 0.0306, sits under each routine's noised ceiling.
 *
 * READING 1 — the null. At a = 0 (amplitude in drained-fraction units; peak =
 * the circular mean of the seeds' peak hours with its resultant R; near16 =
 * the share of seeds within ±3 h of 16:00; |design| = the determinant of the
 * normalized normal equations, 0.2500 for rows spread around the clock):
 *
 *                     ceiling  median         peak  near16  |design|  pairs
 *     fixed      40    0.1942  0.0682  4.8h R=0.18     35%   1.27e-2     81
 *               120    0.0916  0.0317  4.2h R=0.17     25%   1.31e-2    241
 *               260    0.0892  0.0214  4.9h R=0.45     15%   1.32e-2    521
 *     jittered   40    0.0849  0.0329  0.8h R=0.26     20%   3.53e-2     78
 *               120    0.0546  0.0218  2.1h R=0.27     10%   3.54e-2    239
 *               260    0.0347  0.0160  4.8h R=0.29     10%   3.52e-2    515
 *     clustered  40    1.0203  0.3389 23.0h R=0.09     45%   1.51e-4     80
 *               120    0.5671  0.1427 23.5h R=0.34     35%   1.58e-4    240
 *               260    0.3694  0.0832 21.3h R=0.44     40%   1.59e-4    520
 *
 * NOT AN ARTEFACT OF THE 🪫 KIND. Turn the rating noise off and the 260-day
 * null falls to a median 0.0052 / 0.0033 / 0.0306 at R 0.14 / 0.24 / 0.15, so
 * the model manufactures nothing here. What the noise leaves has a weak shape of
 * its own, and it points AWAY from the afternoon: fixed and jittered peak at
 * 4.8h–4.9h with 10%–15% of seeds near 16:00 at 260 days, and every ceiling falls
 * with volume. The clustered breaks sit at 20–21
 * distinct clock hours against the routines' 47–104, and |design| 1.51e-4 to
 * 1.59e-4 against 1.27e-2 to 3.54e-2 is what divides their amplitude: their
 * 260-day ceiling 0.3694 is above the jittered routine's 40-day one, 0.0849.
 * The fit drops 23%–24% of the observations (18% clustered) for a 0
 * before-rating, and the mean before-rating is 2.21–2.27 notches (2.75–2.77
 * clustered): these breaks start shallow.
 *
 * READING 2 — the smallest true amplitude that clears it. Median amplitude at
 * 260 days with the share of seeds above that routine's ceiling, then the same
 * days with no rating noise, scored against the ceiling of their OWN noiseless
 * null — a perfect rater's reading:
 *
 *     a                      0.00         0.10          0.20          0.35          0.50
 *     fixed           0.0214 (0%)  0.0181 (0%)   0.0184 (0%)   0.0174 (0%)   0.0202 (0%)
 *       noiseless     0.0052 (0%)  0.0075 (0%)  0.0137 (13%)  0.0201 (70%)  0.0245 (90%)
 *     jittered        0.0160 (0%)  0.0139 (3%)   0.0160 (5%)   0.0166 (8%)   0.0175 (8%)
 *       noiseless     0.0033 (0%) 0.0057 (23%) 0.0122 (100%) 0.0204 (100%) 0.0294 (100%)
 *     clustered       0.0832 (0%)  0.0834 (0%)   0.0803 (0%)   0.1011 (0%)   0.0986 (0%)
 *       noiseless     0.0306 (0%) 0.0252 (15%)   0.0290 (0%)   0.0377 (3%)  0.0456 (25%)
 *
 * With the noise on, no a up to 0.5 has a median above the ceiling in any of
 * the nine routine × volume cells. With it off, the routines' term is plainly
 * there: the smallest visible a is 0.35 / 0.2 at 260 days (fixed / jittered,
 * against noiseless ceilings 0.0174 / 0.0081), 0.5 / 0.2 at 120 days, and 0.35
 * on the jittered routine even at 40, where fixed clears nothing. On the
 * clustered breaks no a clears at any volume, its 260-day noiseless ceiling
 * being 0.0693. So the two kinds of day meet different barriers. On the
 * routines it is the rating noise: a pair's sensitivity to r scales with how
 * drained its break began, and the whole a = 0.5 signal, 0.0245 / 0.0294, is
 * smaller than the 0.0892 / 0.0347 ceilings the noise sets. On the clustered
 * breaks it is the design, which a perfect rater does not fix.
 *
 * The noised amplitude barely moves with a — 0.0214 → 0.0202 fixed and
 * 0.0160 → 0.0175 jittered, a = 0.1 reading BELOW a = 0 on both — which is
 * consistent with the noise's own shape, peaking near 05:00 opposite the 16:00
 * truth, cancelling the term before adding to it; reading 2b runs the term at
 * that phase. What the term moves is the PHASE, most at volume: near16 rises
 * from 15% / 10% at a = 0 to 45% / 68% at a = 0.5 at 260 days (fixed /
 * jittered), from 25% / 10% to 50% / 57% at 120, and from 35% / 20% to
 * 40% / 45% at 40.
 *
 * READING 2b — the same term peaking at 04:00 instead, where the noise's shape
 * sits, on the jittered routine against its own 16:00-arm ceilings:
 *
 *     a                      0.00         0.10         0.20         0.35         0.50
 *     40 days         0.0329 (0%)  0.0380 (3%)  0.0377 (5%) 0.0504 (10%) 0.0604 (20%)
 *     120 days        0.0218 (0%)  0.0225 (3%)  0.0268 (5%) 0.0326 (18%) 0.0461 (35%)
 *     260 days        0.0160 (0%)  0.0174 (5%) 0.0223 (13%) 0.0297 (28%) 0.0443 (75%)
 *
 * The 16:00 phase is a choice and here it decides the amplitude reading: a term
 * that ADDS to the noise's shape clears at a = 0.5 on 260 days — 75% of seeds —
 * where the afternoon one clears nowhere. It is still not a reading a user can
 * take short of the best case: no cell at 40 or 120 days clears, and its phase
 * is the null's own, 43% of a = 0 seeds already peaking within ±3 h of 04:00 at
 * 260 days, so its phase cannot tell it from the noise.
 *
 * READING 3 — a pair rated late, `createdAt` up to an hour after the break
 * ends, uniformly. It moves nothing the verdict reads: 260-day ceilings
 * 0.0832 / 0.0343 / 0.3227 against the prompt 0.0892 / 0.0347 / 0.3694, no a
 * clearing on any routine, and the jittered a = 0.5 peak at 17.0h against the
 * prompt 16.6h, near16 70% against 68%.
 *
 * WHAT THE NULL SAYS ABOUT §8.9's OWN FIT, which this file did not set out to
 * read (ROADMAP M132): with noise on both ratings and no term in the truth, the
 * median r̂ is 0.7279 / 0.7310 / 0.8574 at 260 days and the clustered one 0.8920
 * at 40, against 0.7; noiseless, 0.7184 / 0.7191 / 0.7152. The rating noise
 * lifts r̂, most on the clustered routine. `energy-fit-prequential.probe.ts`
 * differs: its before-rating is exact, and drawn 1–10, so the fit never drops a
 * pair. Nothing here attributes it.
 *
 * WHAT WOULD FALSIFY WHAT. If the noiseless null had kept a clock shape, the
 * rest law would carry an artefact too and the ceiling would be the model's; it
 * falls to 0.0033–0.0306. If the noiseless term had stayed under its own
 * ceiling on the routines too, the barrier would be the design everywhere and a
 * better rater no way in; it clears there from a = 0.35 / 0.2 at 260 days and
 * stays under only on the clustered breaks. If a term in the noise's own phase
 * had stayed under the ceiling as well, the 16:00 phase would not matter; it
 * clears at 260 days. And if any noised cell at 40 or 120 days had cleared, the
 * "no" would hold only past those volumes; none does.
 *
 * A probe, not a test. Every figure moves with the rating noise
 * (`DRAIN_NOISE_PRIOR_STD`, the generator's), with the r fit's prior strength,
 * noise prior and bounds (`RECOVERY_PRIOR_STRENGTH`,
 * `RECOVERY_NOISE_PRIOR_STD`, `RECOVERY_FIT_MIN`/`RECOVERY_FIT_MAX`), with
 * `restRecoveryMultiplier`, and with the default α and the session draw, which
 * set how drained a break starts and so how large the signal can be — a logger
 * whose breaks start deeper has more of it, and nothing here runs one. The
 * estimator weights every residual alike, as the 🪫 probe's does; one weighted
 * by each pair's sensitivity to r would hear the deep breaks louder and is not
 * run, so the "no" is this estimator's. The ceiling is a MAX over 40 seeds,
 * the noisiest statistic here.
 *
 * The rule for a real user's pairs is the 🪫 probe's: an hour-of-day term is
 * readable when their recovered amplitude clears a ceiling measured on a
 * synthetic a = 0 logger with THEIR structure — break clock spread, volume, and
 * here the depth their breaks start at — never when it clears zero.
 *
 * Usage: npm run probe -- scripts/rest-circadian-residual.probe.ts
 */

import { describe, expect, it } from 'vitest';
import { toRestObservations } from '$lib/business/model/energy-calibration';
import {
	DEFAULT_ENERGY_PARAMS,
	DRAIN_NOISE_PRIOR_STD,
	fitRecoveryRate,
	predictDrainAfterRest,
	simulateReservoirs,
	type ReservoirDemand,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import type { RestObservationRecord } from '$lib/data/type';

const DAYS = 260;
/** Logged days, read as prefixes of one seeded history: what a user holds after that long. */
const VOLUMES = [40, 120, DAYS];
const SEEDS = 40;
const BASE_SEED = 0xc0ffee;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
/** a in r(h) = r₀·(1 + a·cos(2π(h − 16)/24)), as a share of the default rate. */
const AMPLITUDES = [0, 0.1, 0.2, 0.35, 0.5];
/** A choice, not a finding — kept at the 🪫 probe's so only the a column has to cross. */
const TRUE_PEAK_HOUR = 16;
/** Its opposite, run once, since the a = 0 reading carries structure of its own near there. */
const OPPOSITE_PEAK_HOUR = 4;
const FIXED_START_HOUR = 9;
/** The late arm stamps `createdAt` this long after the break, uniformly. */
const MAX_LAG_HOURS = 1;
const NEAR_PEAK_HOURS = 3;
const SINGULAR_DETERMINANT = 1e-9;
const TRUE_RATE = DEFAULT_ENERGY_PARAMS.recoveryRate;

/**
 * `fixed` and `jittered` are the 🪫 probe's two day structures, every gap
 * between sessions logged as a pair. `clustered` puts the day's breaks where
 * people take them: lunch, then mid-afternoon.
 */
type Routine = 'fixed' | 'jittered' | 'clustered';

const ROUTINES: Routine[] = ['fixed', 'jittered', 'clustered'];

interface Arm {
	routine: Routine;
	amplitude: number;
	peakHour: number;
	/** Each of the four ratings a pair holds; 0 in the noiseless control only. */
	noiseStd: number;
	/** `createdAt` lags the break's end by up to MAX_LAG_HOURS instead of matching it. */
	isLate: boolean;
}

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
	// Only ISO ORDER is load-bearing: a volume is every record dated before isoDate(v).
	const month = Math.floor(day / 31);
	const dayOfMonth = (day % 31) + 1;

	return `2026-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

const notch = (fraction: number): number => Math.max(0, Math.min(10, Math.round(fraction * 10)));

/** The circadian law on r, evaluated at one block's MIDPOINT clock hour. */
const rateAt = (arm: Arm, hour: number): number =>
	TRUE_RATE * (1 + arm.amplitude * Math.cos((2 * Math.PI * (hour - arm.peakHour)) / 24));

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

/** One day's worked sessions; every gap between two of them is a break. */
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

		// The 🪫 probe's midnight rule: a session that would run past it is never worked.
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

/** One block through the SHIPPED simulator at the r its midpoint hour gets. */
function stepBlock(
	block: ScheduleBlock,
	demand: ReservoirDemand,
	startHour: number,
	arm: Arm,
	cog: number,
	phys: number,
): { endCog: number; endPhys: number } {
	return simulateReservoirs([block], [demand], {
		...DEFAULT_ENERGY_PARAMS,
		recoveryRate: rateAt(arm, startHour + block.hours / 2),
		initialCog: cog,
		initialPhys: phys,
	});
}

/**
 * A logged history of ☕ pairs, each day chained block by block from full
 * reservoirs: session, break, session, … Both ratings of a pair are the
 * reservoirs at the break's two ends, each noised and quantized to the 0–10
 * notches on its own. The random stream is drawn the same way in every arm, so
 * a seed works the same days under every amplitude, noise and lag.
 */
function synthesize(arm: Arm, seed: number): RestObservationRecord[] {
	const random = mulberry32(seed);
	const records: RestObservationRecord[] = [];

	for (let day = 0; day < DAYS; day++) {
		const sessions = sessionsOf(arm.routine, random);
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

				({ endCog: cog, endPhys: phys } = stepBlock(
					{
						taskId: null,
						hours,
					},
					session.demand,
					clock,
					arm,
					cog,
					phys,
				));

				const noise = [gaussian(random), gaussian(random), gaussian(random), gaussian(random)];
				const lag = MAX_LAG_HOURS * random();

				records.push({
					date: isoDate(day),
					hours,
					mindBefore: notch(1 - before.cog + arm.noiseStd * noise[0]),
					mindAfter: notch(1 - cog + arm.noiseStd * noise[1]),
					bodyBefore: notch(1 - before.phys + arm.noiseStd * noise[2]),
					bodyAfter: notch(1 - phys + arm.noiseStd * noise[3]),
					createdAt:
						day * MILLISECONDS_PER_DAY +
						(session.start + (arm.isLate ? lag : 0)) * MILLISECONDS_PER_HOUR,
				});
			}

			({ endCog: cog, endPhys: phys } = stepBlock(
				{
					taskId: session.demand.id,
					hours: session.hours,
				},
				session.demand,
				session.start,
				arm,
				cog,
				phys,
			));

			clock = session.start + session.hours;
		}
	}

	return records;
}

/** The break's midpoint as the record can place it: `createdAt` read as the break's end. */
const breakHour = (record: RestObservationRecord): number =>
	(((record.createdAt / MILLISECONDS_PER_HOUR - record.hours / 2) % 24) + 24) % 24;

// ================== The 🪫 probe's hour-term estimator, unchanged ==================

interface Point {
	hour: number;
	residual: number;
}

const determinant = (m: number[][]): number =>
	m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
	m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
	m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

function solve3(matrix: number[][], rhs: number[]): number[] | null {
	const det = determinant(matrix);

	if (Math.abs(det) < SINGULAR_DETERMINANT) return null;

	return [0, 1, 2].map(
		(column) =>
			determinant(matrix.map((row, r) => row.map((value, j) => (j === column ? rhs[r] : value)))) /
			det,
	);
}

const peakHourOf = (cosine: number, sine: number): number =>
	((((Math.atan2(sine, cosine) * 24) / (2 * Math.PI)) % 24) + 24) % 24;

interface HourTerm {
	/** √(b_c² + b_s²) — NaN when the rows cannot identify the term. */
	amplitude: number;
	peakHour: number;
	intercept: number;
	/** |normalized normal equations|: ¼ for rows spread around the clock, → 0 as they crowd one arc. */
	determinant: number;
	distinctHours: number;
	pointCount: number;
}

/** Least squares of the residual on [1, cos(2πh/24), sin(2πh/24)], normal equations as MEANS. */
function fitHourTerm(points: Point[]): HourTerm {
	const hours = new Set<number>();

	const matrix = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	];

	const rhs = [0, 0, 0];

	for (const point of points) {
		hours.add(point.hour);

		const basis = [
			1,
			Math.cos((2 * Math.PI * point.hour) / 24),
			Math.sin((2 * Math.PI * point.hour) / 24),
		];

		for (let i = 0; i < 3; i++) {
			rhs[i] += basis[i] * point.residual;

			for (let j = 0; j < 3; j++) matrix[i][j] += basis[i] * basis[j];
		}
	}

	for (let i = 0; i < 3; i++) {
		rhs[i] /= points.length;

		for (let j = 0; j < 3; j++) matrix[i][j] /= points.length;
	}

	const beta = solve3(matrix, rhs);

	if (beta === null)
		return {
			amplitude: Number.NaN,
			peakHour: Number.NaN,
			intercept: Number.NaN,
			determinant: determinant(matrix),
			distinctHours: hours.size,
			pointCount: points.length,
		};

	const [intercept, cosine, sine] = beta;

	return {
		amplitude: Math.sqrt(cosine * cosine + sine * sine),
		peakHour: peakHourOf(cosine, sine),
		intercept,
		determinant: determinant(matrix),
		distinctHours: hours.size,
		pointCount: points.length,
	};
}

const UNIFORM_DESIGN = fitHourTerm(
	Array.from({
		length: 240,
	}).map((_, step) => ({
		hour: step * 0.1,
		residual: 0,
	})),
).determinant;

// ================== The reading ==================

interface Reading {
	/** The app's own r̂: `fitRecoveryRate` over every pair, at the default as fallback and prior. */
	rate: number;
	term: HourTerm;
	pairs: number;
	/** Share of observations the fit drops — a 0 before-rating, nothing to recover. */
	droppedShare: number;
	/** Mean before-rating in notches, mind and body: how drained the breaks start. */
	meanBefore: number;
}

function readPairs(records: RestObservationRecord[]): Reading {
	const fit = fitRecoveryRate(toRestObservations(records), TRUE_RATE, DEFAULT_ENERGY_PARAMS);

	// The fit's own filter, so the hour term reads exactly the observations r̂ did.
	// Signed as recovery beyond r̂'s — prediction less rating — so a faster r at
	// 16:00 recovers at 16:00 rather than twelve hours away.
	const points = records.flatMap((record) =>
		toRestObservations([record])
			.filter((observation) => observation.drainedBefore > 0 && observation.hours > 0)
			.map((observation) => ({
				hour: breakHour(record),
				residual:
					predictDrainAfterRest(observation, fit.rate, DEFAULT_ENERGY_PARAMS) -
					observation.drainedAfter,
			})),
	);

	return {
		rate: fit.rate,
		term: fitHourTerm(points),
		pairs: records.length,
		droppedShare: 1 - points.length / (2 * records.length),
		meanBefore:
			records.reduce((sum, record) => sum + record.mindBefore + record.bodyBefore, 0) /
			(2 * records.length),
	};
}

/** [seed][volume index] */
type Cell = Reading[][];

const cellOf = (arm: Arm): Cell =>
	Array.from({
		length: SEEDS,
	}).map((_, seed) => {
		const records = synthesize(arm, BASE_SEED + seed);

		return VOLUMES.map((volume) =>
			readPairs(records.filter((record) => record.date < isoDate(volume))),
		);
	});

const armOf = (routine: Routine, amplitude: number, isLate: boolean): Arm => ({
	routine,
	amplitude,
	peakHour: TRUE_PEAK_HOUR,
	noiseStd: DRAIN_NOISE_PRIOR_STD,
	isLate,
});

/** Indexed [routine][amplitude index]. */
const cells = ROUTINES.map((routine) =>
	AMPLITUDES.map((amplitude) => cellOf(armOf(routine, amplitude, false))),
);

/** The best-conditioned routine with the truth peaking opposite. */
const opposite = AMPLITUDES.map((amplitude) =>
	cellOf({
		...armOf('jittered', amplitude, false),
		peakHour: OPPOSITE_PEAK_HOUR,
	}),
);

const late = ROUTINES.map((routine) =>
	AMPLITUDES.map((amplitude) => cellOf(armOf(routine, amplitude, true))),
);

/** No rating noise: at a = 0 whatever is left is the quantizer's, above it the whole signal. */
const noiseless = ROUTINES.map((routine) =>
	AMPLITUDES.map((amplitude) =>
		cellOf({
			...armOf(routine, amplitude, false),
			noiseStd: 0,
		}),
	),
);

// ================== Summaries ==================

const median = (values: number[]): number => {
	const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);

	return sorted.length === 0 ? Number.NaN : sorted[Math.floor(sorted.length / 2)];
};

const readingsAt = (cell: Cell, volume: number): Reading[] => cell.map((seed) => seed[volume]);

const amplitudesOf = (cell: Cell, volume: number): number[] =>
	readingsAt(cell, volume).map((reading) => reading.term.amplitude);

/** The null's ceiling: the largest amplitude the a = 0 seeds produced. */
const ceilingOf = (cell: Cell, volume: number): number =>
	Math.max(...amplitudesOf(cell, volume).filter((value) => Number.isFinite(value)));

const shareAbove = (cell: Cell, volume: number, ceiling: number): number =>
	amplitudesOf(cell, volume).filter((value) => value > ceiling).length / SEEDS;

const hourDistance = (a: number, b: number): number => {
	const gap = Math.abs(a - b) % 24;

	return Math.min(gap, 24 - gap);
};

/** Circular mean of the seeds' peak hours, its resultant R, and the share near the truth's. */
function peakSummary(
	cell: Cell,
	volume: number,
	truePeak = TRUE_PEAK_HOUR,
): { hour: number; resultant: number; shareNear: number } {
	const peaks = readingsAt(cell, volume)
		.map((reading) => reading.term.peakHour)
		.filter((peak) => Number.isFinite(peak));

	const angles = peaks.map((peak) => (2 * Math.PI * peak) / 24);
	const cosine = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
	const sine = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;

	return {
		hour: peakHourOf(cosine, sine),
		resultant: Math.sqrt(cosine * cosine + sine * sine),
		shareNear:
			peaks.filter((peak) => hourDistance(peak, truePeak) <= NEAR_PEAK_HOURS).length / peaks.length,
	};
}

const row = (label: string, cells_: string[]): string =>
	`  ${label.padEnd(16)}${cells_.map((cell) => cell.padStart(16)).join('')}`;

const peakCell = (summary: { hour: number; resultant: number }): string =>
	`${summary.hour.toFixed(1)}h R=${summary.resultant.toFixed(2)}`;

const percent = (share: number): string => `${(100 * share).toFixed(0)}%`;

/** The smallest a whose MEDIAN amplitude clears the ceiling; -1 when none does. */
const smallestVisible = (sweep: Cell[], volume: number, ceiling: number): number =>
	AMPLITUDES.findIndex(
		(amplitude, a) => amplitude > 0 && median(amplitudesOf(sweep[a], volume)) > ceiling,
	);

function printNull(label: string, cell: Cell, volume: number): void {
	const readings = readingsAt(cell, volume);
	const peak = peakSummary(cell, volume);

	console.log(
		`[§8.9] ${label}: ceiling ${ceilingOf(cell, volume).toFixed(4)}, median ` +
			`${median(amplitudesOf(cell, volume)).toFixed(4)}, median intercept ` +
			`${median(readings.map((reading) => reading.term.intercept)).toFixed(4)}, peak ` +
			`${peakCell(peak)} (${percent(peak.shareNear)} within ±${NEAR_PEAK_HOURS} h of ` +
			`${TRUE_PEAK_HOUR}:00); median r̂ ${median(readings.map((reading) => reading.rate)).toFixed(4)} ` +
			`against ${TRUE_RATE}; ${median(readings.map((reading) => reading.pairs))} pairs, ` +
			`${median(readings.map((reading) => reading.term.pointCount))} observations kept ` +
			`(${percent(median(readings.map((reading) => reading.droppedShare)))} dropped), mean ` +
			`before-rating ${median(readings.map((reading) => reading.meanBefore)).toFixed(2)} at ` +
			`${median(readings.map((reading) => reading.term.distinctHours))} distinct clock hours, ` +
			`|design| ${median(readings.map((reading) => reading.term.determinant)).toExponential(2)}`,
	);
}

function printSweep(
	label: string,
	sweep: Cell[],
	volume: number,
	ceiling = ceilingOf(sweep[0], volume),
	truePeak = TRUE_PEAK_HOUR,
): void {
	console.log(
		`[§8.9] ${label}: median amplitude (share of ${SEEDS} seeds above the ${ceiling.toFixed(4)} ` +
			`ceiling), circular-mean peak with R, share peaking within ±${NEAR_PEAK_HOURS} h of ` +
			`${truePeak}:00`,
	);

	console.log(
		row(
			'a',
			AMPLITUDES.map((amplitude) => amplitude.toFixed(2)),
		),
	);

	console.log(
		row(
			'amplitude',
			sweep.map(
				(cell) =>
					`${median(amplitudesOf(cell, volume)).toFixed(4)} (${percent(shareAbove(cell, volume, ceiling))})`,
			),
		),
	);

	console.log(
		row(
			'peak',
			sweep.map((cell) => peakCell(peakSummary(cell, volume, truePeak))),
		),
	);

	console.log(
		row(
			`near${truePeak}`,
			sweep.map((cell) => percent(peakSummary(cell, volume, truePeak).shareNear)),
		),
	);

	const visible = smallestVisible(sweep, volume, ceiling);

	console.log(
		visible === -1
			? `[§8.9] ${label}: no a up to ${AMPLITUDES[AMPLITUDES.length - 1]} has a median amplitude ` +
					`above the ceiling`
			: `[§8.9] ${label}: smallest visible a = ${AMPLITUDES[visible]} ` +
					`(${percent(shareAbove(sweep[visible], volume, ceiling))} of seeds clear it)`,
	);
}

const FULL = VOLUMES.length - 1;

describe('MATH.md §8.9 — whether an hour-of-day recovery term can be read off ☕ pairs', () => {
	it('self-check: a = 0, no rating noise — the fit recovers the generator', () => {
		for (const [index, routine] of ROUTINES.entries()) {
			const rate = median(readingsAt(noiseless[index][0], FULL).map((reading) => reading.rate));
			const amplitude = median(amplitudesOf(noiseless[index][0], FULL));
			const ceiling = ceilingOf(cells[index][0], FULL);

			console.log(
				`[§8.9] self-check ${routine}, ${DAYS} days: median r̂ ${rate.toFixed(4)} against ` +
					`${TRUE_RATE} (${((100 * (rate - TRUE_RATE)) / TRUE_RATE).toFixed(1)}%), median ` +
					`amplitude ${amplitude.toFixed(4)} against the noised a = 0 ceiling ${ceiling.toFixed(4)}`,
			);

			// Load-bearing: if §8.9's own law cannot recover the generator, no cell below means anything.
			expect(Math.abs(rate - TRUE_RATE)).toBeLessThan(0.1 * TRUE_RATE);
			expect(amplitude).toBeLessThan(ceiling);
		}
	});

	it('reading 1 — the null: what a truth with no hour term shows, per routine and volume', () => {
		console.log(
			`[§8.9] rows spread uniformly around the clock read |design| ${UNIFORM_DESIGN.toFixed(4)}`,
		);

		for (const [index, routine] of ROUTINES.entries()) {
			for (const [volume, days] of VOLUMES.entries())
				printNull(`${routine}, ${days} days, a = 0`, cells[index][0], volume);

			printNull(`${routine}, ${DAYS} days, a = 0, noiseless`, noiseless[index][0], FULL);
		}
	});

	it('reading 2 — the smallest true amplitude that clears it', () => {
		for (const [index, routine] of ROUTINES.entries()) {
			for (const [volume, days] of VOLUMES.entries())
				printSweep(`${routine}, ${days} days`, cells[index], volume);

			// A perfect rater, against the ceiling a perfect rater's own null sets.
			for (const [volume, days] of VOLUMES.entries())
				printSweep(`${routine}, ${days} days, noiseless`, noiseless[index], volume);
		}
	});

	it(`reading 2b — the truth peaking at ${OPPOSITE_PEAK_HOUR}:00 instead`, () => {
		for (const [volume, days] of VOLUMES.entries())
			printSweep(
				`jittered, ${days} days, peak ${OPPOSITE_PEAK_HOUR}:00`,
				opposite,
				volume,
				ceilingOf(cells[1][0], volume),
				OPPOSITE_PEAK_HOUR,
			);
	});

	it('reading 3 — a pair rated late: createdAt up to an hour after the break', () => {
		for (const [index, routine] of ROUTINES.entries()) {
			printNull(`${routine}, ${DAYS} days, a = 0, late`, late[index][0], FULL);
			printSweep(`${routine}, ${DAYS} days, late`, late[index], FULL);
		}
	});
});
