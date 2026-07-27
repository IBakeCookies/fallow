/**
 * Calibration facade: run a user's logs through the energy-model fits in one
 * call, so the main page's Burnout Risk and the Energy Lab share one
 * orchestration instead of copy-pasting the mapping + fit sequence.
 */

import {
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	fitRecoveryRate,
	type DrainObservation,
	type DrainRateFit,
	type EnergyParams,
	type RecoveryRateFit,
	type RestObservation
} from './zenith-energy';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';

// The stored 0–10 ratings → the fits' [0,1] fractions. Exported because the
// Energy Lab runs the same records through the same fits in a different
// sequence (R3: one definition per concept) — only the sequence differs.

export function toCognitiveDrainObservations(
	records: DrainObservationRecord[]
): DrainObservation[] {
	return records.map((o) => ({
		demand: o.cognitiveDemand,
		hours: o.hours,
		drainedFraction: o.mindDrain / 10
	}));
}

export function toPhysicalDrainObservations(records: DrainObservationRecord[]): DrainObservation[] {
	return records.map((o) => ({
		demand: o.physicalDemand,
		hours: o.hours,
		drainedFraction: o.bodyDrain / 10
	}));
}

/** Both reservoirs' pairs feed the ONE shared recovery rate, so this flattens. */
export function toRestObservations(records: RestObservationRecord[]): RestObservation[] {
	return records.flatMap((o) => [
		{ drainedBefore: o.mindBefore / 10, drainedAfter: o.mindAfter / 10, hours: o.hours },
		{ drainedBefore: o.bodyBefore / 10, drainedAfter: o.bodyAfter / 10, hours: o.hours }
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
	seed: EnergyParams = DEFAULT_ENERGY_PARAMS
): EnergyCalibration {
	const p = { ...seed };
	const recovery = fitRecoveryRate(toRestObservations(rest), p.recoveryRate, p);
	if (recovery.fitted) p.recoveryRate = recovery.rate;
	const cognitiveDrain = fitDrainRate(toCognitiveDrainObservations(drain), p.alphaCog, p);
	if (cognitiveDrain.fitted) p.alphaCog = cognitiveDrain.alpha;
	const physicalDrain = fitDrainRate(toPhysicalDrainObservations(drain), p.alphaPhys, p);
	if (physicalDrain.fitted) p.alphaPhys = physicalDrain.alpha;
	return { params: p, recovery, cognitiveDrain, physicalDrain };
}

/** The composed params alone — see calibrateEnergyParams for the fit details. */
export function fitEnergyParams(
	rest: RestObservationRecord[],
	drain: DrainObservationRecord[],
	seed: EnergyParams = DEFAULT_ENERGY_PARAMS
): EnergyParams {
	return calibrateEnergyParams(rest, drain, seed).params;
}
