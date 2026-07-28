import { describe, it, expect } from 'vitest';
import {
	calibrateEnergyParams,
	RESERVOIR_CYCLE_HOURS,
	seedMorningReservoirs,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations,
} from '$lib/business/model/energy-calibration';
import {
	DEFAULT_ENERGY_PARAMS,
	fitDrainRate,
	fitRecoveryRate,
} from '$lib/business/model/zenith-energy';
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
	...over,
});

const restRecord = (over: Partial<RestObservationRecord> = {}): RestObservationRecord => ({
	date: '2026-07-20',
	hours: 0.5,
	mindBefore: 8,
	mindAfter: 5,
	bodyBefore: 4,
	bodyAfter: 1,
	createdAt: 0,
	...over,
});

describe('record → observation mappings', () => {
	it('maps the 0–10 ratings to [0,1] fractions and leaves the demands alone', () => {
		const records = [drainRecord()];

		expect(toCognitiveDrainObservations(records)).toEqual([
			{
				demand: 0.8,
				hours: 2,
				drainedFraction: 0.6,
			},
		]);

		expect(toPhysicalDrainObservations(records)).toEqual([
			{
				demand: 0.3,
				hours: 2,
				drainedFraction: 0.2,
			},
		]);
	});

	it('flattens each rest pair into both reservoirs, which share the one recovery rate', () => {
		expect(toRestObservations([restRecord()])).toEqual([
			{
				drainedBefore: 0.8,
				drainedAfter: 0.5,
				hours: 0.5,
			},
			{
				drainedBefore: 0.4,
				drainedAfter: 0.1,
				hours: 0.5,
			},
		]);
	});
});

describe('calibrateEnergyParams', () => {
	const rest = [
		restRecord(),
		restRecord({
			hours: 1,
			mindBefore: 9,
			mindAfter: 4,
		}),
	];

	const drain = [
		drainRecord(),
		drainRecord({
			hours: 3,
			cognitiveDemand: 0.5,
			mindDrain: 8,
			bodyDrain: 5,
		}),
	];

	// R3 guard: the Energy Lab feeds the same records through the same mappings
	// in its own sequence, so a mapping change must move both or neither.
	it('feeds the fits exactly the shared mappings, in the §8.7/§8.9 order', () => {
		const calibration = calibrateEnergyParams(rest, drain);

		const recovery = fitRecoveryRate(
			toRestObservations(rest),
			DEFAULT_ENERGY_PARAMS.recoveryRate,
			DEFAULT_ENERGY_PARAMS,
		);

		// Recovery is fitted FIRST, and the drain fits condition on its result.
		const conditioned = {
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: recovery.rate,
		};

		expect(calibration.recovery).toEqual(recovery);

		expect(calibration.cognitiveDrain).toEqual(
			fitDrainRate(toCognitiveDrainObservations(drain), conditioned.alphaCog, conditioned),
		);

		expect(calibration.physicalDrain).toEqual(
			fitDrainRate(toPhysicalDrainObservations(drain), conditioned.alphaPhys, conditioned),
		);
	});

	it('carries the seed through untouched for everything it did not fit', () => {
		const seed = {
			...DEFAULT_ENERGY_PARAMS,
			freeTimeValue: 1.23,
			satietyScale: 0.77,
		};

		const { params } = calibrateEnergyParams([], [], seed);

		// No logs → no fit succeeds → the seed comes back whole.
		expect(params).toEqual(seed);
		expect(params).not.toBe(seed);
	});
});

describe('seedMorningReservoirs (MATH.md §11.9)', () => {
	// Slow enough that a night does not fully heal — the regime where
	// carry-over is visible at all.
	const slowRecovery = {
		...DEFAULT_ENERGY_PARAMS,
		recoveryRate: 0.1,
	};

	it('returns the params untouched when the previous day has no worked hours', () => {
		expect(seedMorningReservoirs(slowRecovery, [])).toBe(slowRecovery);

		expect(
			seedMorningReservoirs(slowRecovery, [
				drainRecord({
					hours: 0,
				}),
			]),
		).toBe(slowRecovery);
	});

	it('matches the closed-form law: work from fresh, then rest out the 24 h cycle', () => {
		const hours = 8;

		const seeded = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours,
				cognitiveDemand: 1,
				physicalDemand: 0.5,
			}),
		]);

		// Independent oracle: C_work = eq + (1−eq)·e^(−ρh) with
		// ρ = α·w + r′·g, g = 1−(1−b)·w, eq = r′·g/ρ; then the night pulls
		// toward 1 at ρ_rest = r′ (gate is 1 at demand 0).
		const morning = (w: number, alpha: number) => {
			const rPrime = slowRecovery.recoveryRate * slowRecovery.restRecoveryMultiplier;
			const gate = 1 - (1 - slowRecovery.microRecoveryFraction) * w;
			const rho = alpha * w + rPrime * gate;
			const eq = (rPrime * gate) / rho;
			const afterWork = eq + (1 - eq) * Math.exp(-rho * hours);

			return 1 + (afterWork - 1) * Math.exp(-rPrime * (RESERVOIR_CYCLE_HOURS - hours));
		};

		expect(seeded.initialCog).toBeCloseTo(morning(1, slowRecovery.alphaCog), 12);
		expect(seeded.initialPhys).toBeCloseTo(morning(0.5, slowRecovery.alphaPhys), 12);
		expect(seeded.initialCog).toBeLessThan(1);

		// Only the two starting levels move; the calibration itself is untouched.
		expect({
			...seeded,
			initialCog: 1,
			initialPhys: 1,
		}).toEqual(slowRecovery);
	});

	it('heals completely overnight at default recovery — carry-over needs fitted evidence', () => {
		const seeded = seedMorningReservoirs(DEFAULT_ENERGY_PARAMS, [
			drainRecord({
				hours: 10,
				cognitiveDemand: 1,
				physicalDemand: 1,
			}),
		]);

		expect(seeded.initialCog).toBeGreaterThan(0.999);
		expect(seeded.initialPhys).toBeGreaterThan(0.999);
	});

	it('is monotone: a longer previous day starts the morning lower', () => {
		const morningCog = (hours: number) =>
			seedMorningReservoirs(slowRecovery, [
				drainRecord({
					hours,
					cognitiveDemand: 1,
				}),
			]).initialCog;

		const levels = [2, 6, 10, 16].map(morningCog);

		for (let i = 1; i < levels.length; i++) {
			expect(levels[i]).toBeLessThan(levels[i - 1]);
		}
	});

	it('stays a valid level when the logs claim the whole cycle was worked', () => {
		const seeded = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 26,
				cognitiveDemand: 1,
				physicalDemand: 1,
			}),
		]);

		expect(seeded.initialCog).toBeGreaterThan(0);
		expect(seeded.initialCog).toBeLessThan(1);
		expect(seeded.initialPhys).toBeGreaterThan(0);
		expect(seeded.initialPhys).toBeLessThan(1);
	});
});
