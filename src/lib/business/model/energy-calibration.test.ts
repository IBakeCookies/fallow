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

	// Two rows for ONE task became possible with MATH.md §18's per-session rows,
	// and the demands go into `simulateReservoirs` keyed by id — so sharing the
	// taskId let the later row's demands re-rate the earlier session, which is
	// what capturing demands at logging time exists to prevent (§8.7).
	it("keeps each session's own demands when a task is rated twice in a day", () => {
		const twoSessions = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.9,
			}),
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.2,
			}),
		]);

		// The same two sessions, told apart by task, are the same day's work.
		const twoTasks = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 3,
				cognitiveDemand: 0.9,
			}),
			drainRecord({
				taskId: 2,
				hours: 3,
				cognitiveDemand: 0.2,
			}),
		]);

		expect(twoSessions.initialCog).toBeCloseTo(twoTasks.initialCog, 12);

		// ...and NOT the reading where the second row's lighter demand applies to
		// both blocks, which is what a taskId-keyed lookup collapses to.
		const bothLight = seedMorningReservoirs(slowRecovery, [
			drainRecord({
				hours: 6,
				cognitiveDemand: 0.2,
			}),
		]);

		expect(twoSessions.initialCog).toBeLessThan(bothLight.initialCog);
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

describe('as-of-day vs whole-history fit (MATH.md §12.1)', () => {
	// Pins `scripts/fit-snapshot-drift.probe.ts`. §12.1's entire case for the
	// `fitSnapshots` store is that an early day audited against the CURRENT fit
	// is audited against a drain rate its own logs never supported. Nothing in
	// the suite measured that; the numbers behind it (0.3069 / 0.4973) were
	// prose from a probe that was thrown away.
	const drainingDay = (day: number, alpha: number): DrainObservationRecord[] =>
		[0, 1, 2].map((i) => {
			const hours = 1 + (i % 3) * 0.5;
			const demand = 0.5 + (i % 4) * 0.1;

			return drainRecord({
				date: `2026-${String(1 + Math.floor(day / 28)).padStart(2, '0')}-${String((day % 28) + 1).padStart(2, '0')}`,
				taskId: i + 1,
				hours,
				cognitiveDemand: demand,
				physicalDemand: demand * 0.6,
				mindDrain: Math.round((1 - Math.exp(-alpha * demand * hours)) * 10),
				bodyDrain: 2,
				createdAt: day * 86_400_000 + i,
			});
		});

	const historyFor = (days: number, alphaOn: (day: number) => number): DrainObservationRecord[] =>
		Array.from(
			{
				length: days,
			},
			(_, day) => drainingDay(day, alphaOn(day)),
		).flat();

	const alphaCogOf = (drain: DrainObservationRecord[]) =>
		calibrateEnergyParams([], drain).params.alphaCog;

	it("a drifting user's day-10 fit is far below the whole-history fit", () => {
		const days = 120;
		const drifting = historyFor(days, (day) => 0.25 + (0.55 - 0.25) * (day / days));
		const early = alphaCogOf(drifting.filter((r) => r.createdAt < 10 * 86_400_000));
		const whole = alphaCogOf(drifting);

		// The bias the store exists to remove: auditing day 10 against `whole`
		// prices it at a drain rate its own logs never saw.
		expect(whole).toBeGreaterThan(early * 1.2);
	});

	it('and a NON-drifting user shows no such gap — the effect is the drift', () => {
		const days = 120;
		const flat = historyFor(days, () => 0.4);
		const early = alphaCogOf(flat.filter((r) => r.createdAt < 10 * 86_400_000));
		const whole = alphaCogOf(flat);

		// Control. Without this the test above would also pass on a fit that is
		// simply unstable at small n, which is a different (and cheaper) problem.
		expect(Math.abs(whole - early) / early).toBeLessThan(0.1);
	});
});
