import { describe, expect, it } from 'vitest';
import { auditPlanAdherence, type PlanAuditDay } from '$lib/business/model/plan-audit';
import {
	calculatePooledAllocations,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	type UserConstants,
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	optimizeSchedule,
	type EnergyParams,
	type EnergyTaskInput,
} from '$lib/business/model/zenith-energy';

const tasks: EnergyTaskInput[] = [
	{
		id: 1,
		title: 'boxing',
		difficulty: 10,
		enjoyment: 10,
		cognitiveDemand: 0.2,
		physicalDemand: 1,
	},
	{
		id: 2,
		title: 'guitar',
		difficulty: 6,
		enjoyment: 9,
		cognitiveDemand: 0.4,
		physicalDemand: 0.3,
	},
	{
		id: 3,
		title: 'reading',
		difficulty: 4,
		enjoyment: 7,
		cognitiveDemand: 0.5,
		physicalDemand: 0.05,
	},
];

const day = (workedHours: { taskId: number; hours: number }[]): PlanAuditDay => ({
	tasks,
	windowHours: 8,
	workedHours,
	switchCost: 0.25,
	pools: DEFAULT_CAPACITY_POOLS,
});

describe('auditPlanAdherence', () => {
	it('a day worked exactly as the classic plan scores classic overlap 1', () => {
		const plan = calculatePooledAllocations(
			tasks.map((t) => ({
				title: t.title,
				difficulty: t.difficulty,
				enjoyment: t.enjoyment,
				cognitiveWeight: t.cognitiveDemand,
				physicalWeight: t.physicalDemand,
			})),
			8,
			DEFAULT_CAPACITY_POOLS,
			DEFAULT_USER_CONSTANTS,
			0.25,
		);

		const worked = tasks
			.map((t, i) => ({
				taskId: t.id,
				hours: plan[i].allocatedHours,
			}))
			.filter((w) => w.hours > 0);

		const audit = auditPlanAdherence([day(worked)], DEFAULT_ENERGY_PARAMS);
		expect(audit.usedCount).toBe(1);
		expect(audit.classicOverlap).toBeCloseTo(1, 12);
		expect(audit.classicTaskSpread).toBeCloseTo(audit.actualTaskSpread, 12);
	});

	it('a day worked exactly as the energy plan scores energy overlap 1', () => {
		const plan = optimizeSchedule(tasks, 8, DEFAULT_ENERGY_PARAMS);
		const byTask = new Map<number, number>();

		for (const b of plan.blocks) {
			if (b.taskId !== null) byTask.set(b.taskId, (byTask.get(b.taskId) ?? 0) + b.hours);
		}

		const worked = [...byTask].map(([taskId, hours]) => ({
			taskId,
			hours,
		}));

		const audit = auditPlanAdherence([day(worked)], DEFAULT_ENERGY_PARAMS);
		expect(audit.usedCount).toBe(1);
		expect(audit.energyOverlap).toBeCloseTo(1, 12);
	});

	it('task spread reads concentration: one task → 1, equal three-way split → 3', () => {
		const concentrated = auditPlanAdherence(
			[
				day([
					{
						taskId: 1,
						hours: 4,
					},
				]),
			],
			DEFAULT_ENERGY_PARAMS,
		);

		expect(concentrated.actualTaskSpread).toBeCloseTo(1, 12);

		const spread = auditPlanAdherence(
			[
				day([
					{
						taskId: 1,
						hours: 2,
					},
					{
						taskId: 2,
						hours: 2,
					},
					{
						taskId: 3,
						hours: 2,
					},
				]),
			],
			DEFAULT_ENERGY_PARAMS,
		);

		expect(spread.actualTaskSpread).toBeCloseTo(3, 12);
	});

	it('overlaps stay in [0,1] and disjoint compositions score low', () => {
		// All hours on the task the plans value least still yields a valid audit
		const audit = auditPlanAdherence(
			[
				day([
					{
						taskId: 3,
						hours: 6,
					},
				]),
			],
			DEFAULT_ENERGY_PARAMS,
		);

		for (const r of audit.days) {
			expect(r.classicOverlap).toBeGreaterThanOrEqual(0);
			expect(r.classicOverlap).toBeLessThanOrEqual(1);
			expect(r.energyOverlap).toBeGreaterThanOrEqual(0);
			expect(r.energyOverlap).toBeLessThanOrEqual(1);
		}

		// The classic plan funds more than reading alone, so overlap < 1
		expect(audit.classicOverlap).toBeLessThan(1);
	});

	it('skips uninformative days: no logged work, unknown tasks, zero window', () => {
		const noWork = day([]);

		const unknownTask = day([
			{
				taskId: 99,
				hours: 2,
			},
		]);

		const zeroWindow = {
			...day([
				{
					taskId: 1,
					hours: 2,
				},
			]),
			windowHours: 0,
		};

		const audit = auditPlanAdherence([noWork, unknownTask, zeroWindow], DEFAULT_ENERGY_PARAMS);
		expect(audit.usedCount).toBe(0);
		expect(audit.days).toEqual([]);
		expect(audit.classicOverlap).toBe(0);
	});

	// A finished day is scored against the fit recorded THAT day, so
	// an early day is not compared against plans built from months of later logs.
	describe('per-day fit', () => {
		/** Nothing like the defaults, so a plan built on it cannot coincide with one. */
		const drained: EnergyParams = {
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: 1.9,
			alphaPhys: 1.9,
			recoveryRate: 0.1,
		};

		// c₁ negative and c₂ positive inverts which task reaches flow soonest. A
		// uniformly slower plane does NOT discriminate: overlap compares SHARES, and
		// scaling every ϕ scales every T* with it (measured — all three tasks keep
		// their share of an 8 h day).
		const invertedPlane: UserConstants = {
			c1: -0.3,
			c2: 0.8,
			c3: 0.4,
		};

		const worked = [
			{
				taskId: 1,
				hours: 2,
			},
			{
				taskId: 2,
				hours: 3,
			},
		];

		it("scores the day under the fit it carries, not the caller's live one", () => {
			const carried = auditPlanAdherence(
				[
					{
						...day(worked),
						fit: {
							params: DEFAULT_ENERGY_PARAMS,
							constants: DEFAULT_USER_CONSTANTS,
						},
					},
				],
				drained,
				invertedPlane,
			);

			const asIfLive = auditPlanAdherence([day(worked)], DEFAULT_ENERGY_PARAMS);
			const underLive = auditPlanAdherence([day(worked)], drained, invertedPlane);

			expect(carried.days[0]).toEqual(asIfLive.days[0]);
			// …and the two calibrations really do plan the day differently, or the
			// assertion above would hold however the fit were threaded.
			expect(carried.energyOverlap).not.toBeCloseTo(underLive.energyOverlap, 3);
			expect(carried.classicOverlap).not.toBeCloseTo(underLive.classicOverlap, 3);
		});

		// The posterior is what makes the classic allocator hedge ϕ-uncertainty
		// (§5.1), and a snapshot that dropped it would audit an early day as though
		// the user had been perfectly certain — the bias, restored.
		//
		// A TIGHT window is what makes the hedge visible: with 8 h every task is
		// funded near its T* either way, so the shares — and the overlap — coincide.
		const tightDay = (fit: PlanAuditDay['fit']): PlanAuditDay => ({
			...day(worked),
			windowHours: 2,
			fit,
		});

		it('threads the day fit posterior into the classic plan', () => {
			const uncertain = auditPlanAdherence(
				[
					tightDay({
						params: DEFAULT_ENERGY_PARAMS,
						constants: DEFAULT_USER_CONSTANTS,
						posterior: {
							covariance: [
								[4, 0, 0],
								[0, 4, 0],
								[0, 0, 4],
							],
							sigma2: 4,
						},
					}),
				],
				DEFAULT_ENERGY_PARAMS,
			);

			const certain = auditPlanAdherence(
				[
					tightDay({
						params: DEFAULT_ENERGY_PARAMS,
						constants: DEFAULT_USER_CONSTANTS,
					}),
				],
				DEFAULT_ENERGY_PARAMS,
			);

			expect(uncertain.classicOverlap).not.toBeCloseTo(certain.classicOverlap, 3);
		});

		it('falls back to the live fit for a day with no recorded snapshot', () => {
			const mixed = auditPlanAdherence(
				[
					day(worked),
					{
						...day(worked),
						fit: {
							params: DEFAULT_ENERGY_PARAMS,
							constants: DEFAULT_USER_CONSTANTS,
						},
					},
				],
				drained,
				invertedPlane,
			);

			const [live, carried] = mixed.days;
			expect(mixed.usedCount).toBe(2);
			expect(live).not.toEqual(carried);
			expect(live).toEqual(auditPlanAdherence([day(worked)], drained, invertedPlane).days[0]);
		});
	});

	it('aggregates as the mean over used days', () => {
		const one = auditPlanAdherence(
			[
				day([
					{
						taskId: 1,
						hours: 4,
					},
				]),
			],
			DEFAULT_ENERGY_PARAMS,
		);

		const other = auditPlanAdherence(
			[
				day([
					{
						taskId: 2,
						hours: 2,
					},
					{
						taskId: 3,
						hours: 2,
					},
				]),
			],
			DEFAULT_ENERGY_PARAMS,
		);

		const both = auditPlanAdherence(
			[
				day([
					{
						taskId: 1,
						hours: 4,
					},
				]),
				day([
					{
						taskId: 2,
						hours: 2,
					},
					{
						taskId: 3,
						hours: 2,
					},
				]),
			],
			DEFAULT_ENERGY_PARAMS,
		);

		expect(both.usedCount).toBe(2);
		expect(both.classicOverlap).toBeCloseTo((one.classicOverlap + other.classicOverlap) / 2, 12);

		expect(both.actualTaskSpread).toBeCloseTo(
			(one.actualTaskSpread + other.actualTaskSpread) / 2,
			12,
		);
	});
});
