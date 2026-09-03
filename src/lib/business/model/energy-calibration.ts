/**
 * Calibration facade: run a user's logs through the energy-model fits in one
 * call, so the main page's Burnout Risk and the Energy Lab share one
 * orchestration instead of copy-pasting the mapping + fit sequence.
 */

import {
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	fitRecoveryRate,
	simulateReservoirs,
	type DrainObservation,
	type DrainRateFit,
	type EnergyParams,
	type RecoveryRateFit,
	type RestObservation,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';

// The stored 0–10 ratings → the fits' [0,1] fractions. Exported because the
// Energy Lab runs the same records through the same fits in a different
// sequence (R3: one definition per concept) — only the sequence differs.

export function toCognitiveDrainObservations(
	records: DrainObservationRecord[],
): DrainObservation[] {
	return records.map((o) => ({
		demand: o.cognitiveDemand,
		hours: o.hours,
		drainedFraction: o.mindDrain / 10,
	}));
}

export function toPhysicalDrainObservations(records: DrainObservationRecord[]): DrainObservation[] {
	return records.map((o) => ({
		demand: o.physicalDemand,
		hours: o.hours,
		drainedFraction: o.bodyDrain / 10,
	}));
}

/** Both reservoirs' pairs feed the ONE shared recovery rate, so this flattens. */
export function toRestObservations(records: RestObservationRecord[]): RestObservation[] {
	return records.flatMap((o) => [
		{
			drainedBefore: o.mindBefore / 10,
			drainedAfter: o.mindAfter / 10,
			hours: o.hours,
		},
		{
			drainedBefore: o.bodyBefore / 10,
			drainedAfter: o.bodyAfter / 10,
			hours: o.hours,
		},
	]);
}

/** The composed params plus the per-fit details (± std, used counts) behind them. */
export interface EnergyCalibration {
	/** `seed` with every successful fit applied — what the planners consume */
	params: EnergyParams;
	recovery: RecoveryRateFit;
	cognitiveDrain: DrainRateFit;
	physicalDrain: DrainRateFit;
}

/**
 * Calibrate energy-model parameters from a user's rest (☕) and drain (🪫) logs.
 *
 * Applies the MATH.md §8.7/§8.9 fit ordering: recovery is fitted FIRST (it is
 * α-free — rest data identifies r·m), then the two drain rates are fitted
 * conditioned on that recovery, which is what makes α identifiable at all. The
 * stored 0–10 ratings are mapped to the fits' [0,1] fractions here. Starts from
 * `seed` (default DEFAULT_ENERGY_PARAMS, the anchor the Burnout Risk metric
 * uses) and overwrites only the parameters whose fit succeeded — everything
 * else is carried through untouched.
 */
export function calibrateEnergyParams(
	rest: RestObservationRecord[],
	drain: DrainObservationRecord[],
	seed: EnergyParams = DEFAULT_ENERGY_PARAMS,
): EnergyCalibration {
	const p = {
		...seed,
	};

	const recovery = fitRecoveryRate(toRestObservations(rest), p.recoveryRate, p);

	if (recovery.fitted) p.recoveryRate = recovery.rate;

	const cognitiveDrain = fitDrainRate(toCognitiveDrainObservations(drain), p.alphaCog, p);

	if (cognitiveDrain.fitted) p.alphaCog = cognitiveDrain.alpha;

	const physicalDrain = fitDrainRate(toPhysicalDrainObservations(drain), p.alphaPhys, p);

	if (physicalDrain.fitted) p.alphaPhys = physicalDrain.alpha;

	return {
		params: p,
		recovery,
		cognitiveDrain,
		physicalDrain,
	};
}

/**
 * One work-start-to-work-start cycle. No clock times are stored, so this is
 * the only anchor available: everything not worked in the cycle recovers at
 * the §8.1 rest law (evening leisure and sleep alike).
 */
export const RESERVOIR_CYCLE_HOURS = 24;

/**
 * Overnight reservoir carry-over: seed a day's starting
 * reservoir levels from the previous day's 🪫 drain logs. Each log carries the
 * worked hours and the demands captured at logging time, so the previous day
 * is simulated from fresh reservoirs through the §8.1/§8.5 law, then rests
 * through the remainder of the 24 h cycle. Starting fresh is the one-day
 * lookback: the day before yesterday reaches this morning attenuated by two
 * nights of recovery (< 1 % at the r fit floor after two 16 h gaps; the bound is
 * the gap's, so a pair of 19 h days keeps ~22 %), so recursing is noise.
 *
 * No logs → `params` unchanged (a fresh morning, the previous behavior).
 * Under default recovery a full night heals completely — carry-over becomes
 * visible exactly when the user's own ☕ fit says recovery is slow.
 */
export function seedMorningReservoirs(
	params: EnergyParams,
	previousDayDrain: DrainObservationRecord[],
): EnergyParams {
	const worked = previousDayDrain.filter((o) => o.hours > 0);

	if (!worked.length) return params;

	// One block per ROW, keyed by the row's position rather than its taskId.
	// A task rated twice in a day is two sessions with their own demands
	// captured at their own logging times (MATH.md §8.7), and
	// `simulateReservoirs` looks demands up by id — so sharing an id would let
	// the later row's demands re-rate the earlier session, which is exactly
	// what capturing demands at logging time exists to prevent. The id is only
	// ever that lookup key here; nothing downstream reads it back.
	const blocks: ScheduleBlock[] = worked.map((o, i) => ({
		taskId: i,
		hours: o.hours,
	}));

	const workedHours = worked.reduce((sum, o) => sum + o.hours, 0);
	const gap = RESERVOIR_CYCLE_HOURS - workedHours;

	if (gap > 0)
		blocks.push({
			taskId: null,
			hours: gap,
		});

	const { endCog, endPhys } = simulateReservoirs(
		blocks,
		worked.map((o, i) => ({
			id: i,
			cognitiveDemand: o.cognitiveDemand,
			physicalDemand: o.physicalDemand,
		})),
		{
			...params,
			initialCog: 1,
			initialPhys: 1,
		},
	);

	return {
		...params,
		initialCog: endCog,
		initialPhys: endPhys,
	};
}

/** The composed params alone — see calibrateEnergyParams for the fit details. */
export function fitEnergyParams(
	rest: RestObservationRecord[],
	drain: DrainObservationRecord[],
	seed: EnergyParams = DEFAULT_ENERGY_PARAMS,
): EnergyParams {
	return calibrateEnergyParams(rest, drain, seed).params;
}

/** Fewest informative rows a title needs before it can be ranked (MATH.md §8.14). */
export const DRAIN_RANKING_MIN_LOGS = 3;

export interface DrainRankingEnd {
	taskTitle: string;
	/** The title's own fitted α, anchored to the user's global one */
	alpha: number;
}

/** Both ends or neither — a ranking of one title has no ends (MATH.md §8.14). */
export interface DrainRankingPair {
	most: DrainRankingEnd;
	least: DrainRankingEnd;
}

export interface DrainRanking {
	cognitive: DrainRankingPair | null;
	physical: DrainRankingPair | null;
	/** 🪫 rows the causal window held back: today's, and any dated past it. */
	deferredCount: number;
}

/**
 * Which task title drains each reservoir fastest per hour of its own declared
 * demand, and which slowest, over the rows in [`rangeStart`, `today`) —
 * MATH.md §8.14, which owns the prior anchor, the day's-first-row restriction
 * and the three gates. `params` supplies both the recovery constants the fit
 * conditions on and the global α̂ each title's fit is anchored to, so it must be
 * the user's CALIBRATED params and not the defaults.
 */
export function rankDrainByTask(
	drain: DrainObservationRecord[],
	rangeStart: string,
	today: string,
	params: EnergyParams,
): DrainRanking {
	// One row per DAY, not per day-and-title: §8.7's law assumes the session
	// started on a full reservoir, so only the day's earliest rating satisfies the
	// assumption the fit makes about it (MATH.md §8.14).
	const dayFirst = new Map<string, DrainObservationRecord>();

	for (const row of drain) {
		if (row.date < rangeStart || row.date >= today) continue;

		const held = dayFirst.get(row.date);

		if (held === undefined || row.createdAt < held.createdAt) dayFirst.set(row.date, row);
	}

	// The title frozen onto the record, because each day's instance of a routine
	// task carries a fresh `taskId`.
	const byTitle = new Map<string, DrainObservationRecord[]>();

	for (const row of dayFirst.values()) {
		const held = byTitle.get(row.taskTitle);

		if (held) held.push(row);
		else byTitle.set(row.taskTitle, [row]);
	}

	return {
		cognitive: rankReservoir(byTitle, toCognitiveDrainObservations, params.alphaCog, params),
		physical: rankReservoir(byTitle, toPhysicalDrainObservations, params.alphaPhys, params),
		deferredCount: drain.filter((row) => row.date >= today).length,
	};
}

/** One reservoir's ends, or nothing if §8.14's three gates do not all pass. */
function rankReservoir(
	byTitle: Map<string, DrainObservationRecord[]>,
	toObservations: (records: DrainObservationRecord[]) => DrainObservation[],
	anchorAlpha: number,
	params: EnergyParams,
): DrainRankingPair | null {
	const fits: { taskTitle: string; fit: DrainRateFit }[] = [];

	for (const [taskTitle, records] of byTitle) {
		const fit = fitDrainRate(toObservations(records), anchorAlpha, params);

		if (fit.fitted && fit.usedCount >= DRAIN_RANKING_MIN_LOGS)
			fits.push({
				taskTitle,
				fit,
			});
	}

	if (fits.length < 2) return null;

	const most = fits.reduce((a, b) => (b.fit.alpha > a.fit.alpha ? b : a));
	const least = fits.reduce((a, b) => (b.fit.alpha < a.fit.alpha ? b : a));

	// §8.7 leaves the std optional for a fit that did not converge. Narrowing it
	// here fails the gate closed rather than reading its absence as certainty.
	if (most.fit.alphaStd === undefined || least.fit.alphaStd === undefined) return null;

	if (most.fit.alpha - least.fit.alpha <= most.fit.alphaStd + least.fit.alphaStd) return null;

	return {
		most: {
			taskTitle: most.taskTitle,
			alpha: most.fit.alpha,
		},
		least: {
			taskTitle: least.taskTitle,
			alpha: least.fit.alpha,
		},
	};
}
