import { describe, expect, it } from 'vitest';
import { summarizeDeferDestination } from '$lib/business/model/metric/defer-destination';
import { calculateSuggestedTasks } from '$lib/business/model/metric/calculation';
import { DEFAULT_CAPACITY_POOLS, DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

const task = (id: number, over: Partial<Task> = {}): Task => ({
	id,
	title: `T${id}`,
	physicalDifficulty: 3,
	mentalDifficulty: 8,
	enjoyment: 5,
	createdAt: '2026-08-12',
	completed: false,
	...over,
});

/** The destination's own inputs, switch-cost-free so the funded set is the budget's. */
const destination = (tasks: Task[], availableHours: number) => ({
	tasks,
	availableHours,
	switchCost: 0,
	pools: DEFAULT_CAPACITY_POOLS,
	constants: DEFAULT_USER_CONSTANTS,
});

describe('summarizeDeferDestination', () => {
	// The same rule `unfundedTaskIds` reads by (plan-advice.ts): the allocator is
	// blind to `completed`, so a ticked-off task keeps its hours and would be
	// counted as work the day still funds.
	it('counts the funded tasks its own plan gives hours to, never a completed one', () => {
		const tasks = [
			task(1),
			task(2, {
				completed: true,
			}),
		];

		const input = destination(tasks, 8);

		// Not vacuous: the allocator really does fund the completed task.
		const plan = calculateSuggestedTasks(
			tasks,
			input.availableHours,
			input.switchCost,
			input.pools,
			input.constants,
		);

		expect(plan.every((planned) => planned.suggestedHours > 0)).toBe(true);

		expect(summarizeDeferDestination(input)).toEqual({
			taskCount: 1,
			budgetHours: 8,
			fundedCount: 1,
		});
	});

	// A task the day has no hours left for is on the list and not in the plan, so
	// the two counts differ — which is the whole reason the line prints both.
	it('leaves an open task the budget funds nothing out of the funded count', () => {
		const summary = summarizeDeferDestination(destination([task(1), task(2), task(3)], 0.25));

		expect(summary.taskCount).toBe(3);
		expect(summary.fundedCount).toBe(1);
	});

	// The commonest destination there is: a day nobody has opened. The hours are
	// still an answer — the prefill the move would write (ROADMAP item 16).
	it('reads a day with no tasks as nothing planned, on the hours it opens with', () => {
		expect(summarizeDeferDestination(destination([], 6))).toEqual({
			taskCount: 0,
			budgetHours: 6,
			fundedCount: 0,
		});
	});
});
