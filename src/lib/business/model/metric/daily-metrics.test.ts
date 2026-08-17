import { describe, expect, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { calculateZenithGain } from '$lib/business/model/metric/calculation';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-07-26',
		completed: false,
		...overrides,
	};
}

function input(tasks: Task[], overrides: Partial<DailyMetricsInput> = {}): DailyMetricsInput {
	return {
		tasks,
		availableHours: 8,
		switchCost: 0.25,
		pools: DEFAULT_CAPACITY_POOLS,
		constants: DEFAULT_USER_CONSTANTS,
		energyParams: DEFAULT_ENERGY_PARAMS,
		...overrides,
	};
}

const TASKS = [
	makeTask({
		id: 1,
		title: 'Write spec',
		mentalDifficulty: 8,
		physicalDifficulty: 1,
		enjoyment: 7,
	}),
	makeTask({
		id: 2,
		title: 'Gym',
		mentalDifficulty: 1,
		physicalDifficulty: 8,
		enjoyment: 4,
	}),
	makeTask({
		id: 3,
		title: 'Email',
		mentalDifficulty: 3,
		physicalDifficulty: 1,
		enjoyment: 2,
	}),
];

describe('calculateDailyMetrics', () => {
	it('returns zeroed, N/A-able values for an empty day instead of throwing', () => {
		const metrics = calculateDailyMetrics(
			input([], {
				availableHours: 0,
			}),
		);

		expect(metrics.totalTasks).toBe(0);
		expect(metrics.suggestedTasks).toEqual([]);
		expect(metrics.activeTasks).toEqual([]);
		expect(metrics.runOrder.size).toBe(0);
		expect(metrics.planSlackHours).toBe(0);
		expect(metrics.zenithGain.gainPercent).toBe(0);
	});

	it('ranks and scores a day whose hours have not been entered yet', () => {
		// availableHours 0 with real tasks — the default order of operations, since
		// the day saves as soon as a task exists. Every priority score used to read
		// 0 here, which left the list in input order and made both
		// priority-weighted metrics report 0% on a day with completions (MATH.md
		// §3).
		const withOneDone = TASKS.map((task, i) => ({
			...task,
			completed: i === 0,
		}));

		const metrics = calculateDailyMetrics(
			input(withOneDone, {
				availableHours: 0,
			}),
		);

		const scores = metrics.suggestedTasks.map((t) => t.priorityScore);

		expect(scores).toHaveLength(3);
		expect(scores.every((score) => score > 0)).toBe(true);
		expect([...scores].sort((a, b) => b - a)).toEqual(scores);

		// Nothing is planned, but the day is still scored on what got done.
		expect(metrics.suggestedTasks.every((t) => t.suggestedHours === 0)).toBe(true);
		expect(metrics.runOrder.size).toBe(0);
		expect(metrics.completionRate).toBeGreaterThan(0);
		expect(metrics.yieldIndex).toBeGreaterThan(0);
	});

	it('plans the day: allocates within budget and numbers the run order', () => {
		const metrics = calculateDailyMetrics(input(TASKS));

		expect(metrics.totalTasks).toBe(3);
		expect(metrics.remainingSuggestedHours).toBeGreaterThan(0);
		expect(metrics.remainingSuggestedHours).toBeLessThanOrEqual(8);
		expect([...metrics.runOrder.values()].sort()).toEqual([1, 2, 3]);
	});

	it('accounts for every budgeted hour: allocation + switch overhead + slack = budget', () => {
		const metrics = calculateDailyMetrics(input(TASKS));
		const funded = metrics.suggestedTasks.filter((t) => t.suggestedHours > 0);
		const allocated = funded.reduce((sum, t) => sum + t.suggestedHours, 0);
		const overhead = funded.length > 1 ? (funded.length - 1) * 0.25 : 0;

		expect(allocated + overhead + metrics.planSlackHours).toBeCloseTo(8, 6);
	});

	// The scope split is load-bearing (MATH.md §11.7/§11.8): plan-scoped metrics
	// describe the day you committed to, so checking a task off must not move
	// them — its hours stay allocated. Getting this wrong made burnout risk RISE
	// when work got done.
	it('keeps plan-scoped metrics fixed when a task is completed', () => {
		const before = calculateDailyMetrics(input(TASKS));

		const after = calculateDailyMetrics(
			input(
				TASKS.map((t) =>
					t.id === 2
						? {
								...t,
								completed: true,
							}
						: t,
				),
			),
		);

		expect(after.burnoutRisk).toBe(before.burnoutRisk);
		expect(after.cognitiveLoad).toBe(before.cognitiveLoad);
		expect(after.physicalLoad).toBe(before.physicalLoad);
		expect(after.humanCapacity.percent).toBe(before.humanCapacity.percent);
		expect(after.deepWorkRatio).toBe(before.deepWorkRatio);
		// The run order is one of them (§11.8, rescoped 2026-08-18): the `#N` badges are
		// the plan's sequence, and the list renders rows in it, so a depleting order
		// moved every row below the one just ticked off.
		expect(after.runOrder).toEqual(before.runOrder);
	});

	it('moves active-scoped metrics when a task is completed', () => {
		const before = calculateDailyMetrics(input(TASKS));

		const after = calculateDailyMetrics(
			input(
				TASKS.map((t) =>
					t.id === 2
						? {
								...t,
								completed: true,
							}
						: t,
				),
			),
		);

		expect(after.activeTasks).toHaveLength(2);
		expect(after.completedTasks).toBe(1);
		expect(after.completionRate).toBeGreaterThan(before.completionRate);
	});

	// Regression (2026-08-07, MATH.md §23.1): checking off the day's only physical
	// task used to blank the bottleneck to null with cognitive work still ahead —
	// its axis came from the PLAN (still physical: the completed task keeps its
	// hours) while its candidates came from what was LEFT (no physical draw at
	// all). Deleting that same task re-pointed the row correctly, so the two
	// gestures disagreed. Both are pinned here, against each other.
	it('re-points the bottleneck when the last task on its axis is completed', () => {
		const pools = {
			cognitiveHours: 4,
			physicalHours: 2,
		};

		const day = [
			makeTask({
				id: 1,
				title: 'Design error boundary',
				mentalDifficulty: 8,
				physicalDifficulty: 0,
			}),
			makeTask({
				id: 2,
				title: 'Move the boxes',
				mentalDifficulty: 0,
				physicalDifficulty: 10,
			}),
			makeTask({
				id: 3,
				title: 'Code review',
				mentalDifficulty: 5,
				physicalDifficulty: 0,
			}),
		];

		const bottleneck = (tasks: Task[]) =>
			calculateDailyMetrics(
				input(tasks, {
					pools,
				}),
			).bottleneckTask;

		expect(bottleneck(day)).toEqual({
			title: 'Move the boxes',
			limitType: 'physical',
		});

		const completed = bottleneck(
			day.map((task) =>
				task.id === 2
					? {
							...task,
							completed: true,
						}
					: task,
			),
		);

		expect(completed).toEqual({
			title: 'Design error boundary',
			limitType: 'cognitive',
		});

		expect(bottleneck(day.filter((task) => task.id !== 2))).toEqual(completed);
	});

	// The dashboard solves the allocation once and hands it to Zenith Gain, which
	// used to re-solve it from the same inputs (2ⁿ enumeration, twice, inside a
	// $derived). Reusing it may not move the number: hours are paired to tasks by
	// index, so handing over the priority-sorted array instead of the input-order
	// one charges each task the wrong task's time.
	//
	// The reversed list is the case that actually catches that, and it is here for
	// that reason: priority is intrinsic, so for TASKS as listed the plan order
	// already IS the input order and a mix-up would be invisible. The other four
	// pin the early returns and the constrained paths.
	it('reports the same gain as a Zenith Gain that solves the day for itself', () => {
		const cases: DailyMetricsInput[] = [
			input(TASKS),
			input(TASKS, {
				availableHours: 2,
			}),
			input(TASKS, {
				switchCost: 1,
			}),
			input(TASKS, {
				pools: {
					cognitiveHours: 1.5,
					physicalHours: 1,
				},
			}),
			input([...TASKS].reverse()),
		];

		for (const metricsInput of cases) {
			const { tasks, availableHours, switchCost, pools, constants, posterior } = metricsInput;

			expect(calculateDailyMetrics(metricsInput).zenithGain).toEqual(
				calculateZenithGain(tasks, availableHours, switchCost, pools, constants, posterior),
			);
		}
	});

	// §14 prices every lever as ΔΣP̄/ΣP̄ and reads ΣP̄ off zenithGain.optimized.
	// The identity behind that had no fixture; §14 claimed the two agree "to the
	// last digit" when they are 1–2 ulps apart on ~a fifth of days, because
	// calculateTotalProductivity adds in the tasks' own order while the plan comes
	// back priority-sorted (scripts/adv1-plan-advice-frontier.probe.ts, 2026-08-06).
	it('zenithGain.optimized is Σ avgProductivity over the funded tasks (§14)', () => {
		const metrics = calculateDailyMetrics(input(TASKS));

		const summed = metrics.suggestedTasks
			.filter((task) => task.suggestedHours > 0)
			.reduce((total, task) => total + task.avgProductivity, 0);

		expect(metrics.suggestedTasks.filter((task) => task.suggestedHours > 0).length).toBeGreaterThan(
			1,
		);

		expect(metrics.zenithGain.optimized).toBeCloseTo(summed, 12);
	});

	it('hedges with the fit posterior without changing the shape of the plan', () => {
		const plain = calculateDailyMetrics(input(TASKS));

		const hedged = calculateDailyMetrics(
			input(TASKS, {
				posterior: {
					covariance: [
						[0.05, 0, 0],
						[0, 0.05, 0],
						[0, 0, 0.05],
					],
					sigma2: 0.09,
				},
			}),
		);

		expect(hedged.suggestedTasks).toHaveLength(plain.suggestedTasks.length);
		expect(hedged.remainingSuggestedHours).toBeLessThanOrEqual(8);
	});
});
