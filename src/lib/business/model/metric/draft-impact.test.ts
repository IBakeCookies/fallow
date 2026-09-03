import { describe, expect, it } from 'vitest';
import { calculateDraftImpact, type DraftTask } from '$lib/business/model/metric/draft-impact';
import {
	calculateDailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-09-03',
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
];

const DRAFT: DraftTask = {
	physicalDifficulty: 8,
	mentalDifficulty: 3,
	enjoyment: 9,
};

describe('calculateDraftImpact', () => {
	it('prices the draft as an extra task the day does not have yet', () => {
		// A day with hours to spare, so the draft's own hours come out of the slack
		// and not only out of what the other two were holding.
		const day = input(TASKS, {
			availableHours: 12,
		});

		const baseline = calculateDailyMetrics(day);
		const impact = calculateDraftImpact(day, DRAFT, baseline);

		// The same day typed out by hand, with the draft deployed as a real task —
		// PREPENDED, because that is where `SessionStore.addTask` puts it. The
		// reading is only worth showing if it is the plan the user is about to get.
		const deployed = calculateDailyMetrics(
			input(
				[
					makeTask({
						id: 3,
						title: 'Boxing training',
						...DRAFT,
					}),
					...TASKS,
				],
				{
					availableHours: 12,
				},
			),
		);

		const asTask = deployed.suggestedTasks.find((task) => task.id === 3)!;

		expect(impact.suggestedHours).toBeCloseTo(asTask.suggestedHours, 6);
		expect(impact.priorityScore).toBeCloseTo(asTask.priorityScore, 6);
		expect(impact.position).toBe(deployed.runOrder.get(3));
		expect(impact.fundedCount).toBe(deployed.runOrder.size);

		// The day it joins is the one that was solved: before is the baseline's own
		// reading, after is the plan with the draft in it.
		expect(impact.slackHours.before).toBeCloseTo(baseline.planSlackHours, 6);
		expect(impact.slackHours.after).toBeCloseTo(deployed.planSlackHours, 6);
		expect(impact.slackHours.after).toBeLessThan(impact.slackHours.before);

		// A physical draft loads the physical pool and leaves the cognitive one
		// where the day already had it, or the two rows are one reading twice.
		expect(impact.physicalPercent.after).toBeGreaterThan(impact.physicalPercent.before);
		expect(impact.cognitivePercent.before).toBeGreaterThan(impact.physicalPercent.before);
	});

	/* The allocator sorts on the priority score rounded to 1 dp with a stable
	   sort, so tasks inside one rounding bucket are ordered by INPUT POSITION —
	   which then decides the run slot, and on a tight budget which tie-mate gets
	   funded at all. This day is such a tie (20.8 / 20.8 / 20.7), so it fails if
	   the draft is solved anywhere but where `addTask` puts it. */
	it('prices the draft where a deploy would put it, not at the end of the list', () => {
		const tasks = [
			makeTask({
				id: 1,
				title: 'Write spec',
				physicalDifficulty: 3,
				mentalDifficulty: 5,
				enjoyment: 9,
			}),
			makeTask({
				id: 2,
				title: 'Move lab boxes',
				physicalDifficulty: 7,
				mentalDifficulty: 3,
				enjoyment: 6,
			}),
		];

		const draft: DraftTask = {
			physicalDifficulty: 6,
			mentalDifficulty: 4,
			enjoyment: 7,
		};

		const day = input(tasks, {
			availableHours: 4,
		});

		const impact = calculateDraftImpact(day, draft);

		const deployed = calculateDailyMetrics(
			input(
				[
					makeTask({
						id: 3,
						title: 'Boxing training',
						...draft,
					}),
					...tasks,
				],
				{
					availableHours: 4,
				},
			),
		);

		const asTask = deployed.suggestedTasks.find((task) => task.id === 3)!;

		expect(impact.suggestedHours).toBeCloseTo(asTask.suggestedHours, 6);
		expect(impact.position).toBe(deployed.runOrder.get(3));
	});

	it('reads an unfunded draft as no hours and no slot', () => {
		// Two hours already claimed by four tasks the draft cannot outbid.
		const day = input(
			[...Array(4).keys()].map((index) =>
				makeTask({
					id: index + 1,
					title: `Ship ${index + 1}`,
					mentalDifficulty: 8,
					physicalDifficulty: 2,
					enjoyment: 9,
					importance: 'high',
				}),
			),
			{
				availableHours: 2,
			},
		);

		const impact = calculateDraftImpact(day, {
			physicalDifficulty: 1,
			mentalDifficulty: 1,
			enjoyment: 1,
			importance: 'low',
		});

		expect(impact.suggestedHours).toBe(0);
		expect(impact.position).toBeNull();
		expect(impact.slackHours.after).toBeCloseTo(impact.slackHours.before, 6);
		expect(impact.cognitivePercent.after).toBeCloseTo(impact.cognitivePercent.before, 6);
		expect(impact.physicalPercent.after).toBeCloseTo(impact.physicalPercent.before, 6);
	});

	it('prices the first task of an empty day', () => {
		const impact = calculateDraftImpact(input([]), DRAFT);

		expect(impact.suggestedHours).toBeGreaterThan(0);
		expect(impact.position).toBe(1);
		expect(impact.fundedCount).toBe(1);
		expect(impact.cognitivePercent.before).toBe(0);
		expect(impact.physicalPercent.after).toBeGreaterThan(0);
	});

	it('reads a pool of zero hours as unloaded rather than infinite', () => {
		// Injured → no physical capacity. Every task here draws on it, so the plan
		// funds nothing at all: both rows read 0% off `calculatePoolSaturation`'s
		// no-demand arm, where a bare division would give 0/0.
		const impact = calculateDraftImpact(
			input(TASKS, {
				pools: {
					...DEFAULT_CAPACITY_POOLS,
					physicalHours: 0,
				},
			}),
			DRAFT,
		);

		expect(impact.physicalPercent.after).toBe(0);
		expect(impact.cognitivePercent.after).toBe(0);
		expect(impact.suggestedHours).toBe(0);
	});
});
