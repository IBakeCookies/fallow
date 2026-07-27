import { describe, it, expect } from 'vitest';
import {
	calibrateEnergyParams,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations
} from './energy-calibration';
import { DEFAULT_ENERGY_PARAMS, fitDrainRate, fitRecoveryRate } from './zenith-energy';
import type { DrainObservationRecord, RestObservationRecord } from '$lib/data/type';

const drainRecord = (over: Partial<DrainObservationRecord> = {}): DrainObservationRecord => ({
	date: '2026-07-20',
	taskId: 1,
	taskTitle: 'deep work',
	hours: 2,
	cognitiveDemand: 0.8,
	physicalDemand: 0.3,
	mindDrain: 6,
	bodyDrain: 2,
	createdAt: 0,
	...over
});

const restRecord = (over: Partial<RestObservationRecord> = {}): RestObservationRecord => ({
	date: '2026-07-20',
	hours: 0.5,
	mindBefore: 8,
	mindAfter: 5,
	bodyBefore: 4,
	bodyAfter: 1,
	createdAt: 0,
	...over
});

describe('record → observation mappings', () => {
	it('maps the 0–10 ratings to [0,1] fractions and leaves the demands alone', () => {
		const records = [drainRecord()];
		expect(toCognitiveDrainObservations(records)).toEqual([
			{ demand: 0.8, hours: 2, drainedFraction: 0.6 }
		]);
		expect(toPhysicalDrainObservations(records)).toEqual([
			{ demand: 0.3, hours: 2, drainedFraction: 0.2 }
		]);
	});

	it('flattens each rest pair into both reservoirs, which share the one recovery rate', () => {
		expect(toRestObservations([restRecord()])).toEqual([
			{ drainedBefore: 0.8, drainedAfter: 0.5, hours: 0.5 },
			{ drainedBefore: 0.4, drainedAfter: 0.1, hours: 0.5 }
		]);
	});
});

describe('calibrateEnergyParams', () => {
	const rest = [restRecord(), restRecord({ hours: 1, mindBefore: 9, mindAfter: 4 })];
	const drain = [
		drainRecord(),
		drainRecord({ hours: 3, cognitiveDemand: 0.5, mindDrain: 8, bodyDrain: 5 })
	];

	// R3 guard: the Energy Lab feeds the same records through the same mappings
	// in its own sequence, so a mapping change must move both or neither.
	it('feeds the fits exactly the shared mappings, in the §8.7/§8.9 order', () => {
		const calibration = calibrateEnergyParams(rest, drain);

		const recovery = fitRecoveryRate(
			toRestObservations(rest),
			DEFAULT_ENERGY_PARAMS.recoveryRate,
			DEFAULT_ENERGY_PARAMS
		);
		// Recovery is fitted FIRST, and the drain fits condition on its result.
		const conditioned = { ...DEFAULT_ENERGY_PARAMS, recoveryRate: recovery.rate };

		expect(calibration.recovery).toEqual(recovery);
		expect(calibration.cognitiveDrain).toEqual(
			fitDrainRate(toCognitiveDrainObservations(drain), conditioned.alphaCog, conditioned)
		);
		expect(calibration.physicalDrain).toEqual(
			fitDrainRate(toPhysicalDrainObservations(drain), conditioned.alphaPhys, conditioned)
		);
	});

	it('carries the seed through untouched for everything it did not fit', () => {
		const seed = { ...DEFAULT_ENERGY_PARAMS, freeTimeValue: 1.23, satietyScale: 0.77 };
		const { params } = calibrateEnergyParams([], [], seed);

		// No logs → no fit succeeds → the seed comes back whole.
		expect(params).toEqual(seed);
		expect(params).not.toBe(seed);
	});
});
