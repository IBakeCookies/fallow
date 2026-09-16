/**
 * What §8.14's earliest-🪫-row-per-day filter does to the WHOLE-LOG α fit, read
 * on the four things that consume α̂ (ROADMAP item 43). §8.7's fresh-start
 * approximation biases α̂ upward, `circadian-residual.probe.ts` reading 4 priced
 * that bias against a chained start and against this filter, and what it never
 * read is the ± the app prints beside α̂ — the quantity §8.14's gate reads
 * as well as the point — nor what the two arms do to λ₀, to the pool offer, or
 * to the per-title ranking. Volume is the axis reading 4 never swept and the one
 * this trade turns on: the filter keeps one row a day and throws the rest away.
 *
 * THE GENERATOR IS THE MODEL: every day is chained through the SHIPPED
 * `simulateReservoirs` one block at a time — session, rest gap, session — each
 * block's end levels carried into the next block's `initialCog`/`initialPhys`,
 * and each session's α taken from the seed's true rate times its TITLE's own
 * multiplier (0.7 / 0.9 / 1.1 / 1.4 over four titles), so §8.14 has a true order
 * to be right or wrong about. Every row is one the app could hold: 2–4 sessions
 * a day, session hours on the 45-minute lattice, gaps in quarter hours, demands
 * on the ten slider notches, the rating 1 − C_end noised at
 * `DRAIN_NOISE_PRIOR_STD` and quantized to the 0–10 notches stored, `createdAt`
 * stamped at the session's END, and no session worked past midnight, so no row's
 * log moment falls on a later day than the one it is filed under (the moments
 * are a synthetic epoch and only their ORDER is load-bearing). Every day
 * starts at FULL reservoirs, so what is measured is the artifact that
 * accumulates WITHIN a day and never overnight carry-over. Two routines, a fixed
 * 09:00 start and a start drawn 06:00–12:00; two truths, one AT the fit's prior
 * mean and one off it, because at the prior mean the ridge pulls toward the
 * right answer and would flatter whichever arm leans on it hardest. Both arms
 * are `fitDrainRate` at `DEFAULT_ENERGY_PARAMS` — the generator's own recovery
 * rate — so the fit conditions on the TRUE r and no reading below is a mis-fit
 * r's. 40 seeds a cell, 20 / 60 / 260 logged days.
 *
 * Figures below are read off THIS file's own run (2026-09-16). Every one of them
 * is printed by the run; none is computed by hand.
 *
 * SELF-CHECK, printed first and the only assertions: on 260 day-first rows —
 * every one of which starts at C = 1, which is §8.7's own model exactly — the
 * fit recovers α_cog 0.3585 against 0.35 and α_phys 0.3064 against 0.3. If those
 * miss, the generator and the fit disagree and every cell below is noise. What
 * is left in them is this generator's own residue: titles drain at 0.7×–1.3× the
 * seed's rate and the fit is nonlinear, so a mean-1 multiplier set does not
 * cancel exactly. It is the floor under the day-first column below, and the
 * whole-log column stands several times above it.
 *
 * READING 1 — the point and the ± beside it. `cover` is the share of the 40
 * seeds whose own α̂ ± σ̂ contains the truth, against the 68.3% a 1σ band is
 * nominally worth; `rows` is the median `usedCount` each arm fit on:
 *
 *                         median α̂  median err    RMSE  mean σ̂  cover   rows
 *     fixed, α 0.35 / 0.3 (the prior mean)
 *      20d α_cog  shipped     0.4074     +0.0574  0.0670  0.0386    40%     60
 *          α_cog  day-first   0.3691     +0.0191  0.0759  0.0594    45%     20
 *          α_phys shipped     0.3394     +0.0394  0.0532  0.0332    33%     60
 *          α_phys day-first   0.3171     +0.0171  0.0633  0.0509    55%     20
 *      60d α_cog  shipped     0.3895     +0.0395  0.0474  0.0216    13%    181
 *          α_cog  day-first   0.3705     +0.0205  0.0405  0.0334    60%     60
 *          α_phys shipped     0.3354     +0.0354  0.0415  0.0193    18%    181
 *          α_phys day-first   0.3137     +0.0137  0.0347  0.0305    55%     60
 *     260d α_cog  shipped     0.3852     +0.0352  0.0370  0.0103     0%    778
 *          α_cog  day-first   0.3532     +0.0032  0.0165  0.0164    73%    260
 *          α_phys shipped     0.3351     +0.0351  0.0368  0.0094     0%    778
 *          α_phys day-first   0.3083     +0.0083  0.0203  0.0149    55%    260
 *     jittered, α 0.5 / 0.45 (off the prior mean)
 *      20d α_cog  shipped     0.5420     +0.0420  0.0665  0.0475    48%     59
 *          α_cog  day-first   0.4838     -0.0162  0.0853  0.0714    55%     20
 *          α_phys shipped     0.4862     +0.0362  0.0538  0.0436    55%     59
 *          α_phys day-first   0.4399     -0.0101  0.0760  0.0658    53%     20
 *      60d α_cog  shipped     0.5381     +0.0381  0.0498  0.0278    30%    179
 *          α_cog  day-first   0.5003     +0.0003  0.0523  0.0444    60%     60
 *          α_phys shipped     0.4868     +0.0368  0.0439  0.0254    23%    179
 *          α_phys day-first   0.4606     +0.0106  0.0457  0.0400    50%     60
 *     260d α_cog  shipped     0.5450     +0.0450  0.0481  0.0134     3%    781
 *          α_cog  day-first   0.4959     -0.0041  0.0267  0.0210    68%    260
 *          α_phys shipped     0.4936     +0.0436  0.0457  0.0123     0%    781
 *          α_phys day-first   0.4496     -0.0004  0.0207  0.0191    60%    260
 *
 * (The run prints all four routine × truth blocks; two are reproduced here and
 * the other two carry the same shape.)
 *
 * THE ± IS WHERE THE TWO ARMS SEPARATE, AND IT SEPARATES THE WRONG WAY FOR THE
 * SHIPPED ONE. Over the eight routine × truth × reservoir cells at each volume,
 * the shipped fit's band covers the truth on 33–60% of seeds at 20 days, 13–30%
 * at 60, and **0–3% at 260** — it narrows on a point that does not move, so more
 * logging makes the printed ± more confident and no more correct. That is
 * M108's shape, read here on α where the truth is known. The day-first band
 * reads 45–65% / 50–78% / 50–73% and has no trend in volume at all: short of the
 * 68.3% nominal on average (a cell mean of 56% / 63% / 62%), so it is not a
 * band to trust to the letter either, but it is a band that stops describing the
 * fit's error only in the way any 1σ reading does.
 *
 * THE POINT TRADES BIAS FOR VARIANCE, AND THE TRADE TURNS OVER BETWEEN 20 AND
 * 60 DAYS. At 260 days the filter removes 76%–99% of the median bias — its
 * residue is the self-check's, and the sign is no longer reliably positive —
 * and cuts RMSE by 1.8×–2.2× on all eight cells. At 60 days it wins six of
 * eight. At 20 days it loses **all eight**: bias still smaller, RMSE larger,
 * because 20 rows is where halving the data mass costs more than the artifact
 * does. Nothing here is a free repair, and the volume a reader is at decides
 * which way it points.
 *
 * READING 2 — §8.13's pool offer, the one place a user SEES α̂. Median offered
 * hours, the median error against the pool the true α maps to, and how many of
 * the 40 seeds the map withheld an offer from (out of domain, or over the
 * field's ceiling):
 *
 *     fixed, truth at the prior mean: true pool 4.37 h / 5.31 h
 *      20d pool_cog  shipped   3.60 h, -0.77 h, RMSE 0.79 h, withheld 0/40
 *          pool_cog  day-first 4.10 h, -0.27 h, RMSE 0.95 h, withheld 0/40
 *          pool_phys shipped   4.50 h, -0.81 h, RMSE 0.95 h, withheld 0/40
 *          pool_phys day-first 4.90 h, -0.41 h, RMSE 1.41 h, withheld 1/40
 *      60d pool_cog  shipped   3.85 h, -0.52 h, RMSE 0.60 h, withheld 0/40
 *          pool_cog  day-first 4.10 h, -0.27 h, RMSE 0.67 h, withheld 0/40
 *          pool_phys shipped   4.60 h, -0.71 h, RMSE 0.77 h, withheld 0/40
 *          pool_phys day-first 5.00 h, -0.31 h, RMSE 0.74 h, withheld 0/40
 *     260d pool_cog  shipped   3.90 h, -0.47 h, RMSE 0.49 h, withheld 0/40
 *          pool_cog  day-first 4.30 h, -0.07 h, RMSE 0.26 h, withheld 0/40
 *          pool_phys shipped   4.60 h, -0.71 h, RMSE 0.72 h, withheld 0/40
 *          pool_phys day-first 5.10 h, -0.21 h, RMSE 0.42 h, withheld 0/40
 *
 * The map is monotone in α and the arms inherit reading 1 exactly, including its
 * crossover: shipped is the better offer on all eight cells at 20 days, the two
 * split at 60, and day-first wins all eight at 260. What does not cross over is
 * the direction of the miss — the shipped offer sits a quarter hour to three
 * quarters of one SHORT of the user's own pool at every volume and never
 * converges, while the day-first offer lands inside a quarter hour of it by 260
 * days on every cell. The filter also reaches the map's own gate where the whole
 * log never does: over the 48 cells the run prints, the only two withheld offers
 * are day-first ones, a single seed of 40 at 20 days in each, whose fitted α fell
 * inside `CAPACITY_MAP_POLE_MARGIN`.
 *
 * READING 3 — §8.14's per-title ranking, whose ONLY moving part here is the
 * anchor: its per-title fits already read each day's earliest row, so this arm
 * changes the α̂ the ridge shrinks each title toward and nothing else. `ranked`
 * is the share of seeds where all three gates passed, `ends` the share where the
 * printed pair is the generator's own fastest and slowest title:
 *
 *                            shipped            day-first
 *     fixed,  20d cog    ranked 53%, ends 18%   ranked 48%, ends 13%
 *             60d cog    ranked 85%, ends 53%   ranked 85%, ends 53%
 *            260d cog    ranked 100%, ends 78%  ranked 100%, ends 78%
 *     jitt.,  20d phys   ranked 57%, ends 15%   ranked 53%, ends 13%
 *             60d phys   ranked 95%, ends 50%   ranked 95%, ends 53%
 *            260d phys   ranked 100%, ends 88%  ranked 100%, ends 88%
 *
 * Across all 24 volume × routine × truth × reservoir cells the two anchors never
 * differ by more than two seeds of 40, in either direction, and agree exactly on
 * 17 of them. The ranking is INERT to the anchor's bias, and the reason is in
 * §8.14's own construction: a common shift in the prior mean moves both ends the
 * same way, while the gate tests their DIFFERENCE. What the ranking is not inert
 * to is volume — 13–33% of seeds name both true ends at 20 days against 78–98%
 * at 260 — so whatever a change to the global fit is worth, it is not worth it
 * here.
 *
 * READING 4 — §8.10's λ₀, which conditions on α. Each seed's own α̂ from its 60
 * logged days is handed to `fitStoppingValue` over 8 finished days that a user
 * with a known λ₀ worked under the TRUE dynamics, against the same fit run at
 * the true α:
 *
 *                              median err    RMSE   used days  days ≠ true α's
 *     truth at the prior mean
 *       α true                    -0.0094  0.0818     5.5/8                 —
 *       α shipped                 -0.0293  0.1009     5.5/8              0/40
 *       α day-first               -0.0173  0.0915     5.5/8              0/40
 *     truth off the prior mean
 *       α true                    -0.0033  0.0784       8/8                 —
 *       α shipped                 -0.0239  0.0885       8/8              0/40
 *       α day-first               +0.0072  0.0803       8/8              0/40
 *
 * Conditioning on a biased α costs λ₀ real accuracy — 0.0818 → 0.1009 RMSE at
 * the prior mean — and the filter recovers 49% of that gap there and 81% off it,
 * landing within 0.002 of the true-α fit's RMSE in the second case. And the last
 * column is counted rather than inferred from the medians: on not one of the 40
 * seeds does either arm leave the fit a different NUMBER of days than the true α
 * would, so every censor drops the same day under all three and what moves is
 * the point alone.
 *
 * THE FOURTH CONSUMER IS NOT MEASURED HERE BECAUSE IT CANNOT BE. `fitSnapshots`
 * stores the params a past day was planned under, and what changes under a new
 * estimator is what those stored numbers MEAN: a snapshot written by the whole-
 * log fit and one written by a filtered fit are two different estimates of the
 * same α, so a history that spans the change is not a series. That is a
 * migration question, not a number, and no sweep answers it.
 *
 * WHAT WOULD FALSIFY WHAT. If the shipped band had covered the truth at a rate
 * near nominal, the ± would be reporting what it claims and the whole
 * bias-versus-variance trade would be a matter of RMSE alone; it reads 0–3% at
 * 260 days instead. If the day-first arm had won at every volume, the filter
 * would be a free repair and this would be a build with no gate; it loses all
 * eight cells at 20 days. If the anchor had moved §8.14's ranking, a change to
 * the global fit would have had to be priced against a user-visible ordering
 * too; it moves it by at most two seeds. If λ₀ had been insensitive to α, three
 * of the four consumers would have been cosmetic; its RMSE moves by a quarter.
 * And if the off-prior truth had reversed any of those signs, every conclusion
 * would have been the prior's rather than the estimator's; it reverses none.
 *
 * A probe, not a test. Every figure moves with the ridge prior the two α fits
 * share (`DRAIN_PRIOR_STRENGTH`) and the prior means they shrink toward
 * (`DEFAULT_ENERGY_PARAMS`' alphaCog/alphaPhys), with `DRAIN_NOISE_PRIOR_STD` —
 * doubly, since it is both the fit's noise floor and the generator's rating
 * noise — and the ν₀ it is blended in at (`CALIBRATION_NOISE_PRIOR_WEIGHT`),
 * with the fit bounds, with the 0–10 notch quantization and the linear rating
 * map, and with the rest of `DEFAULT_ENERGY_PARAMS`, which the generator draws
 * its recovery constants from. Reading 2 moves with `CAPACITY_FLOOR` and
 * `CAPACITY_MAP_POLE_MARGIN` as well, which is why the α columns are printed
 * beside the hours; reading 3 with `DRAIN_RANKING_MIN_LOGS` and the title
 * multipliers chosen here, which average 1 by construction but are a spread
 * nobody measured on a real user;
 * reading 4 with `STOP_PRIOR_STRENGTH`, `STOP_NOISE_PRIOR_STD` and
 * `STOP_INVERSION_MARGIN`. The whole reading is a perfect-model one: the
 * generator's law IS the fit's law, so what is measured is the start level and
 * nothing else about whether the law is right. And it assumes a complete logger
 * — every worked session leaves a row — where a user who skips rows gives the
 * filter a day's earliest LOGGED row that is not the day's earliest WORKED one;
 * `circadian-residual.probe.ts` prices that arm and the filter degrades under
 * it.
 *
 * Usage: npm run probe -- scripts/drain-fit-day-first.probe.ts
 */

import { describe, expect, it } from 'vitest';
import {
	DRAIN_RANKING_MIN_LOGS,
	offerFittedPools,
	rankDrainByTask,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	type EnergyCalibration,
} from '$lib/business/model/energy-calibration';
import {
	capacityFromDrainRate,
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	DRAIN_NOISE_PRIOR_STD,
	fitDrainRate,
	fitStoppingValue,
	optimizeSchedule,
	simulateReservoirs,
	type DrainRateFit,
	type EnergyParams,
	type EnergyTaskInput,
	type ReservoirDemand,
	type ScheduleBlock,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS, type UserConstants } from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { DrainObservationRecord, Task } from '$lib/data/type';

const SEEDS = 40;
const BASE_SEED = 0xd1f157;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const CONSTANTS: UserConstants = DEFAULT_USER_CONSTANTS;
const STEP = DEFAULT_STEP_HOURS;
const ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');
/** Logged days a history holds: the filter costs rows, so volume is the axis. */
const VOLUMES = [20, 60, 260];
const FIXED_START_HOUR = 9;
/** The §8.14 reading's window: wider than any generated history, so it holds every row. */
const RANGE_START = '2026-01-01';
const RANGE_END = '2027-01-01';
/**
 * Per-title drain multipliers on the seed's true α, so §8.14's ranking has a
 * true order to be right or wrong about. They average exactly 1 and titles are
 * drawn uniformly, so the rate the GLOBAL fit targets stays the seed's own —
 * an asymmetric set would put a constant offset inside every error column
 * below and be read as bias. The residue of that, which the fit's own
 * nonlinearity leaves behind, is what the self-check prints.
 */
const TITLE_MULTIPLIERS = [0.7, 0.9, 1.1, 1.3];
const FASTEST_TITLE = 't4';
const SLOWEST_TITLE = 't1';
/** True λ₀s the stop days are generated at, one per seed in rotation. */
const LAMBDAS = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
/** Finished days a seed contributes to the λ₀ fit. */
const STOP_DAYS = 8;

type Reservoir = 'cog' | 'phys';

const RESERVOIRS: Reservoir[] = ['cog', 'phys'];

/** Whole log, or §8.14's earliest 🪫 row per day handed to the same fit. */
type Arm = 'shipped' | 'day-first';

const ARMS: Arm[] = ['shipped', 'day-first'];

type Routine = 'fixed' | 'jittered';

const ROUTINES: Routine[] = ['fixed', 'jittered'];

interface Truth {
	label: string;
	cog: number;
	phys: number;
}

/**
 * Two truths. At the defaults the fit's prior mean SITS on the truth, which
 * flatters the arm that leans on the prior — so the off-default truth is where
 * a conclusion that only holds at the prior would break.
 */
const TRUTHS: Truth[] = [
	{
		label: 'at the prior mean',
		cog: DEFAULT_ENERGY_PARAMS.alphaCog,
		phys: DEFAULT_ENERGY_PARAMS.alphaPhys,
	},
	{
		label: 'off the prior mean',
		cog: 0.5,
		phys: 0.45,
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

/** Box–Muller, so the rating noise is the Gaussian §8.7's σ₀ prices. */
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

const median = (values: number[]): number => {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const mean = (values: number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length;

const rootMeanSquare = (values: number[]): number =>
	Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);

const share = (flags: boolean[]): number => flags.filter(Boolean).length / flags.length;

/** One block through the SHIPPED simulator at this title's own drain rate. */
function stepBlock(
	block: ScheduleBlock,
	task: ReservoirDemand,
	truth: Truth,
	multiplier: number,
	cog: number,
	phys: number,
): { endCog: number; endPhys: number } {
	return simulateReservoirs([block], [task], {
		...DEFAULT_ENERGY_PARAMS,
		alphaCog: truth.cog * multiplier,
		alphaPhys: truth.phys * multiplier,
		initialCog: cog,
		initialPhys: phys,
	});
}

/**
 * A logged 🪫 history, each day chained block by block from full reservoirs:
 * session, rest gap, session. Every row is one the app could hold — 45-minute
 * session lattice, quarter-hour gaps, slider-notch demands, ratings noised at
 * σ₀ and quantized to the stored 0–10 notches, `createdAt` at the session's END
 * and never on a later calendar day than the row's own `date`.
 */
function synthesize(
	seed: number,
	routine: Routine,
	truth: Truth,
	days: number,
): DrainObservationRecord[] {
	const random = mulberry32(seed);
	const rows: DrainObservationRecord[] = [];

	for (let day = 0; day < days; day++) {
		const date = isoDate(day);
		const sessions = 2 + Math.floor(random() * 3);
		let hour = routine === 'fixed' ? FIXED_START_HOUR : 6 + 0.25 * Math.floor(random() * 25);
		let cog = 1;
		let phys = 1;

		for (let session = 0; session < sessions; session++) {
			const hours = 0.75 * (1 + Math.floor(random() * 4));
			const title = Math.floor(random() * TITLE_MULTIPLIERS.length);

			const demand: ReservoirDemand = {
				id: session + 1,
				cognitiveDemand: (1 + Math.floor(random() * 10)) / 10,
				physicalDemand: (1 + Math.floor(random() * 10)) / 10,
			};

			const gap = session === 0 ? 0 : 0.25 * (1 + Math.floor(random() * 8));

			if (hour + gap + hours > 24) break;

			if (gap > 0) {
				({ endCog: cog, endPhys: phys } = stepBlock(
					{
						taskId: null,
						hours: gap,
					},
					demand,
					truth,
					1,
					cog,
					phys,
				));

				hour += gap;
			}

			({ endCog: cog, endPhys: phys } = stepBlock(
				{
					taskId: demand.id,
					hours,
				},
				demand,
				truth,
				TITLE_MULTIPLIERS[title],
				cog,
				phys,
			));

			hour += hours;

			rows.push({
				date,
				taskId: demand.id,
				taskTitle: `t${title + 1}`,
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

/** §8.14's filter: each day's earliest row by `createdAt`. */
function dayFirstRows(rows: DrainObservationRecord[]): DrainObservationRecord[] {
	const earliest = new Map<string, DrainObservationRecord>();

	for (const row of rows) {
		const held = earliest.get(row.date);

		if (held === undefined || row.createdAt < held.createdAt) earliest.set(row.date, row);
	}

	return [...earliest.values()];
}

const rowsFor = (arm: Arm, rows: DrainObservationRecord[]): DrainObservationRecord[] =>
	arm === 'day-first' ? dayFirstRows(rows) : rows;

/** The app's own fit, at the TRUE recovery rate — no artifact below is a mis-fit r's. */
function fitBoth(rows: DrainObservationRecord[]): Record<Reservoir, DrainRateFit> {
	return {
		cog: fitDrainRate(
			toCognitiveDrainObservations(rows),
			DEFAULT_ENERGY_PARAMS.alphaCog,
			DEFAULT_ENERGY_PARAMS,
		),
		phys: fitDrainRate(
			toPhysicalDrainObservations(rows),
			DEFAULT_ENERGY_PARAMS.alphaPhys,
			DEFAULT_ENERGY_PARAMS,
		),
	};
}

const paramsAt = (fits: Record<Reservoir, DrainRateFit>): EnergyParams => ({
	...DEFAULT_ENERGY_PARAMS,
	alphaCog: fits.cog.alpha,
	alphaPhys: fits.phys.alpha,
});

/** `offerFittedPools` wants a whole calibration; only the two drain fits are read. */
const calibrationOf = (fits: Record<Reservoir, DrainRateFit>): EnergyCalibration => ({
	params: paramsAt(fits),
	recovery: {
		rate: DEFAULT_ENERGY_PARAMS.recoveryRate,
		fitted: false,
		usedCount: 0,
	},
	cognitiveDrain: fits.cog,
	physicalDrain: fits.phys,
});

// ================== The four consumers ==================

interface PoolReading {
	/** The hours the Day Setup field would offer, or null when the map withholds one */
	offered: number | null;
}

interface RankingReading {
	/** Both ends printed — §8.14's three gates all passed */
	isRanked: boolean;
	/** The printed ends are the generator's own fastest and slowest title */
	isCorrect: boolean;
}

interface SeedRun {
	fits: Record<Arm, Record<Reservoir, DrainRateFit>>;
	pools: Record<Arm, Record<Reservoir, PoolReading>>;
	rankings: Record<Arm, Record<Reservoir, RankingReading>>;
}

function poolOf(fits: Record<Reservoir, DrainRateFit>): Record<Reservoir, PoolReading> {
	const offer = offerFittedPools(calibrationOf(fits));

	return {
		cog: {
			offered: offer.cognitiveHours,
		},
		phys: {
			offered: offer.physicalHours,
		},
	};
}

/**
 * §8.14's reading under one anchor. Its per-title fits already read only each
 * day's earliest row, so the ANCHOR is the whole of what this arm changes.
 */
function rankingOf(
	rows: DrainObservationRecord[],
	fits: Record<Reservoir, DrainRateFit>,
): Record<Reservoir, RankingReading> {
	const ranking = rankDrainByTask(rows, RANGE_START, RANGE_END, paramsAt(fits));

	const read = (pair: ReturnType<typeof rankDrainByTask>['cognitive']): RankingReading => ({
		isRanked: pair !== null,
		isCorrect:
			pair !== null &&
			pair.most.taskTitle === FASTEST_TITLE &&
			pair.least.taskTitle === SLOWEST_TITLE,
	});

	return {
		cog: read(ranking.cognitive),
		phys: read(ranking.physical),
	};
}

function runSeed(seed: number, routine: Routine, truth: Truth, days: number): SeedRun {
	const rows = synthesize(seed, routine, truth, days);

	const fits = {
		shipped: fitBoth(rowsFor('shipped', rows)),
		'day-first': fitBoth(rowsFor('day-first', rows)),
	} as Record<Arm, Record<Reservoir, DrainRateFit>>;

	return {
		fits,
		pools: {
			shipped: poolOf(fits.shipped),
			'day-first': poolOf(fits['day-first']),
		},
		rankings: {
			shipped: rankingOf(rows, fits.shipped),
			'day-first': rankingOf(rows, fits['day-first']),
		},
	};
}

// ================== §8.10's λ₀, conditioned on each α̂ ==================

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

/** The plan as the 🪫 log would hold it: one row per contiguous session, rest passing on the clock. */
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

/** Finished days worked to the user's OWN true λ₀ under the TRUE dynamics. */
function stopDays(seed: number, truth: Truth, lambda: number): StopObservation[] {
	const random = mulberry32(seed);

	const params: EnergyParams = {
		...DEFAULT_ENERGY_PARAMS,
		alphaCog: truth.cog,
		alphaPhys: truth.phys,
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

		if (blocks.filter((b) => b.taskId !== null).reduce((s, b) => s + b.hours, 0) < 3 * STEP)
			continue;

		days.push(observationFrom(tasks, windowHours, blocks));
	}

	return days;
}

/** One printed line: a volume, a reservoir and an arm — flattened so a reading is one loop. */
interface Line {
	days: number;
	reservoir: Reservoir;
	arm: Arm;
}

const LINES: Line[] = VOLUMES.flatMap((days) =>
	RESERVOIRS.flatMap((reservoir) =>
		ARMS.map((arm) => ({
			days,
			reservoir,
			arm,
		})),
	),
);

/** One printed block: a routine and a truth, with the index its cells are keyed by. */
const BLOCKS = ROUTINES.flatMap((routine) =>
	TRUTHS.map((truth, truthIndex) => ({
		routine,
		truth,
		truthIndex,
	})),
);

describe('the day-first filter handed to the whole-log α fit (ROADMAP item 43)', () => {
	const cells = new Map<string, SeedRun[]>();

	const key = (routine: Routine, truthIndex: number, days: number) =>
		`${routine}|${truthIndex}|${days}`;

	for (const routine of ROUTINES)
		for (const [truthIndex, truth] of TRUTHS.entries())
			for (const days of VOLUMES)
				cells.set(
					key(routine, truthIndex, days),
					Array.from(
						{
							length: SEEDS,
						},
						(_, s) =>
							runSeed(BASE_SEED + s * 7919 + truthIndex * 104_729 + days, routine, truth, days),
					),
				);

	const errorsOf = (runs: SeedRun[], arm: Arm, reservoir: Reservoir, truth: Truth): number[] =>
		runs.map((run) => run.fits[arm][reservoir].alpha - truth[reservoir]);

	const stdsOf = (runs: SeedRun[], arm: Arm, reservoir: Reservoir): number[] =>
		runs.map((run) => run.fits[arm][reservoir].alphaStd ?? Number.NaN);

	const coverageOf = (runs: SeedRun[], arm: Arm, reservoir: Reservoir, truth: Truth): number =>
		share(
			runs.map((run) => {
				const fit = run.fits[arm][reservoir];

				return fit.alphaStd !== undefined && Math.abs(fit.alpha - truth[reservoir]) <= fit.alphaStd;
			}),
		);

	it('self-check — the generator and the fit agree where §8.7 assumes they do', () => {
		// One session a day is §8.7's own model exactly: every row starts full, so
		// the only error left is the 0–10 quantizer's and the rating noise's.
		const runs = Array.from(
			{
				length: SEEDS,
			},
			(_, s) =>
				fitBoth(dayFirstRows(synthesize(BASE_SEED + s * 7919 + 260, 'jittered', TRUTHS[0], 260))),
		);

		for (const reservoir of RESERVOIRS) {
			const fitted = median(runs.map((fit) => fit[reservoir].alpha));

			console.log(
				`[§8.7] self-check day-first α_${reservoir} ${fitted.toFixed(4)} against a true ` +
					`${TRUTHS[0][reservoir]}`,
			);

			expect(Math.abs(fitted - TRUTHS[0][reservoir])).toBeLessThan(0.05);
		}
	});

	it('reading 1 — the point, the ± beside it, and what the ± covers', () => {
		for (const { routine, truth, truthIndex } of BLOCKS) {
			console.log(`[§8.7] ${routine}, truth ${truth.label} (α ${truth.cog} / ${truth.phys})`);
			console.log('                        median α̂  median err    RMSE  mean σ̂  cover   rows');

			for (const { days, reservoir, arm } of LINES) {
				const runs = cells.get(key(routine, truthIndex, days))!;
				const errors = errorsOf(runs, arm, reservoir, truth);

				console.log(
					`  ${String(days).padStart(3)}d α_${reservoir.padEnd(4)} ${arm.padEnd(9)}    ` +
						`${median(runs.map((run) => run.fits[arm][reservoir].alpha)).toFixed(4)}     ` +
						`${median(errors) >= 0 ? '+' : ''}${median(errors).toFixed(4)}  ` +
						`${rootMeanSquare(errors).toFixed(4)}  ` +
						`${mean(stdsOf(runs, arm, reservoir)).toFixed(4)}  ` +
						`${(100 * coverageOf(runs, arm, reservoir, truth)).toFixed(0).padStart(4)}%  ` +
						`${String(median(runs.map((run) => run.fits[arm][reservoir].usedCount))).padStart(5)}`,
				);
			}
		}
	});

	it('reading 2 — §8.13’s pool offer, where the user sees α̂ move', () => {
		for (const { routine, truth, truthIndex } of BLOCKS) {
			const truePool = {
				cog: capacityFromDrainRate(truth.cog, DEFAULT_ENERGY_PARAMS)!,
				phys: capacityFromDrainRate(truth.phys, DEFAULT_ENERGY_PARAMS)!,
			};

			console.log(
				`[§8.13] ${routine}, truth ${truth.label}: true pool ` +
					`${truePool.cog.toFixed(2)} h / ${truePool.phys.toFixed(2)} h`,
			);

			for (const { days, reservoir, arm } of LINES) {
				const offered = cells
					.get(key(routine, truthIndex, days))!
					.map((run) => run.pools[arm][reservoir].offered)
					.filter((hours): hours is number => hours !== null);

				const errors = offered.map((hours) => hours - truePool[reservoir]);

				console.log(
					`  ${String(days).padStart(3)}d pool_${reservoir.padEnd(4)} ${arm.padEnd(9)} median ` +
						`${median(offered).toFixed(2)} h, median err ` +
						`${median(errors) >= 0 ? '+' : ''}${median(errors).toFixed(2)} h, RMSE ` +
						`${rootMeanSquare(errors).toFixed(2)} h, withheld ${SEEDS - offered.length}/${SEEDS}`,
				);
			}
		}
	});

	it('reading 3 — §8.14’s ranking, whose only moving part is the anchor', () => {
		for (const { routine, truth, truthIndex } of BLOCKS) {
			console.log(
				`[§8.14] ${routine}, truth ${truth.label}: ends ${FASTEST_TITLE} (×` +
					`${TITLE_MULTIPLIERS[TITLE_MULTIPLIERS.length - 1]}) and ${SLOWEST_TITLE} (×` +
					`${TITLE_MULTIPLIERS[0]}), ${DRAIN_RANKING_MIN_LOGS} rows a title to qualify`,
			);

			for (const { days, reservoir, arm } of LINES) {
				const runs = cells.get(key(routine, truthIndex, days))!;

				console.log(
					`  ${String(days).padStart(3)}d ${reservoir.padEnd(4)} ${arm.padEnd(9)} ranked ` +
						`${(100 * share(runs.map((run) => run.rankings[arm][reservoir].isRanked))).toFixed(0).padStart(3)}%, ` +
						`both ends right ` +
						`${(100 * share(runs.map((run) => run.rankings[arm][reservoir].isCorrect))).toFixed(0).padStart(3)}%`,
				);
			}
		}
	});

	it('reading 4 — §8.10’s λ₀, which conditions on α', () => {
		for (const [truthIndex, truth] of TRUTHS.entries()) {
			const runs = cells.get(key('jittered', truthIndex, VOLUMES[1]))!;

			const errors: Record<string, number[]> = {
				true: [],
				shipped: [],
				'day-first': [],
			};

			const used: Record<string, number[]> = {
				true: [],
				shipped: [],
				'day-first': [],
			};

			for (const [seed, run] of runs.entries()) {
				const lambda = LAMBDAS[seed % LAMBDAS.length];
				const days = stopDays(BASE_SEED + seed * 104_729, truth, lambda);

				const sources: Record<string, EnergyParams> = {
					true: {
						...DEFAULT_ENERGY_PARAMS,
						alphaCog: truth.cog,
						alphaPhys: truth.phys,
					},
					shipped: paramsAt(run.fits.shipped),
					'day-first': paramsAt(run.fits['day-first']),
				};

				for (const [name, params] of Object.entries(sources)) {
					const fit = fitStoppingValue(
						days,
						DEFAULT_ENERGY_PARAMS.freeTimeValue,
						params,
						CONSTANTS,
					);

					errors[name].push(fit.value - lambda);
					used[name].push(fit.usedCount);
				}
			}

			console.log(
				`[§8.10] truth ${truth.label}, ${VOLUMES[1]} logged days of 🪫 behind each α̂, ` +
					`${STOP_DAYS} finished days a seed at true λ₀ ${LAMBDAS.join('/')}`,
			);

			for (const name of ['true', 'shipped', 'day-first'])
				console.log(
					`  λ₀ conditioned on α ${name.padEnd(9)} median err ` +
						`${median(errors[name]) >= 0 ? '+' : ''}${median(errors[name]).toFixed(4)}, RMSE ` +
						`${rootMeanSquare(errors[name]).toFixed(4)}, median used days ` +
						`${median(used[name])}/${STOP_DAYS}`,
				);

			// Whether the arms differ in the POINT alone: a different α moves every
			// censor's threshold too, so the seeds where the day count itself moves
			// are counted rather than inferred from the medians above.
			for (const name of ['shipped', 'day-first'])
				console.log(
					`  seeds where α ${name.padEnd(9)} keeps a different DAY COUNT than the true α: ` +
						`${used[name].filter((count, seed) => count !== used.true[seed]).length}/${SEEDS}`,
				);
		}
	});
});
