import { describe, expect, it } from 'vitest';
import { auditPlanAdherence, type PlanAuditDay } from './plan-audit';
import {
	calculatePooledAllocations,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS
} from './zenith';
import { DEFAULT_ENERGY_PARAMS, optimizeSchedule, type EnergyTaskInput } from './zenith-energy';

const tasks: EnergyTaskInput[] = [
	{
		id: 1,
		title: 'boxing',
		difficulty: 10,
		enjoyment: 10,
		cognitiveDemand: 0.2,
		physicalDemand: 1
	},
	{
		id: 2,
		title: 'guitar',
		difficulty: 6,
		enjoyment: 9,
		cognitiveDemand: 0.4,
		physicalDemand: 0.3
	},
	{
		id: 3,
		title: 'reading',
		difficulty: 4,
		enjoyment: 7,
		cognitiveDemand: 0.5,
		physicalDemand: 0.05
	}
];

const day = (workedHours: { taskId: number; hours: number }[]): PlanAuditDay => ({
	tasks,
	windowHours: 8,
	workedHours,
	switchCost: 0.25,
	pools: DEFAULT_CAPACITY_POOLS
});

describe('auditPlanAdherence', () => {
	it('a day worked exactly as the classic plan scores classic overlap 1', () => {
		const plan = calculatePooledAllocations(
			tasks.map((t) => ({
				title: t.title,
				difficulty: t.difficulty,
				enjoyment: t.enjoyment,
				cognitiveWeight: t.cognitiveDemand,
				physicalWeight: t.physicalDemand
			})),
			8,
			DEFAULT_CAPACITY_POOLS,
			DEFAULT_USER_CONSTANTS,
			0.25
		);
		const worked = tasks
			.map((t, i) => ({ taskId: t.id, hours: plan[i].allocatedHours }))
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
		const worked = [...byTask].map(([taskId, hours]) => ({ taskId, hours }));
		const audit = auditPlanAdherence([day(worked)], DEFAULT_ENERGY_PARAMS);
		expect(audit.usedCount).toBe(1);
		expect(audit.energyOverlap).toBeCloseTo(1, 12);
	});

	it('task spread reads concentration: one task → 1, equal three-way split → 3', () => {
		const concentrated = auditPlanAdherence(
			[day([{ taskId: 1, hours: 4 }])],
			DEFAULT_ENERGY_PARAMS
		);
		expect(concentrated.actualTaskSpread).toBeCloseTo(1, 12);
		const spread = auditPlanAdherence(
			[
				day([
					{ taskId: 1, hours: 2 },
					{ taskId: 2, hours: 2 },
					{ taskId: 3, hours: 2 }
				])
			],
			DEFAULT_ENERGY_PARAMS
		);
		expect(spread.actualTaskSpread).toBeCloseTo(3, 12);
	});

	it('overlaps stay in [0,1] and disjoint compositions score low', () => {
		// All hours on the task the plans value least still yields a valid audit
		const audit = auditPlanAdherence([day([{ taskId: 3, hours: 6 }])], DEFAULT_ENERGY_PARAMS);
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
		const unknownTask = day([{ taskId: 99, hours: 2 }]);
		const zeroWindow = { ...day([{ taskId: 1, hours: 2 }]), windowHours: 0 };
		const audit = auditPlanAdherence([noWork, unknownTask, zeroWindow], DEFAULT_ENERGY_PARAMS);
		expect(audit.usedCount).toBe(0);
		expect(audit.days).toEqual([]);
		expect(audit.classicOverlap).toBe(0);
	});

	it('aggregates as the mean over used days', () => {
		const one = auditPlanAdherence([day([{ taskId: 1, hours: 4 }])], DEFAULT_ENERGY_PARAMS);
		const other = auditPlanAdherence(
			[
				day([
					{ taskId: 2, hours: 2 },
					{ taskId: 3, hours: 2 }
				])
			],
			DEFAULT_ENERGY_PARAMS
		);
		const both = auditPlanAdherence(
			[
				day([{ taskId: 1, hours: 4 }]),
				day([
					{ taskId: 2, hours: 2 },
					{ taskId: 3, hours: 2 }
				])
			],
			DEFAULT_ENERGY_PARAMS
		);
		expect(both.usedCount).toBe(2);
		expect(both.classicOverlap).toBeCloseTo((one.classicOverlap + other.classicOverlap) / 2, 12);
		expect(both.actualTaskSpread).toBeCloseTo(
			(one.actualTaskSpread + other.actualTaskSpread) / 2,
			12
		);
	});
});
