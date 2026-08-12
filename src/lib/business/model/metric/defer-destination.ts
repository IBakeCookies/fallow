/**
 * What the day a defer sends to already looks like (ROADMAP item 21): how much
 * is on it, the hours it opens with, and how many of those tasks its own plan
 * funds.
 *
 * A **day-level** reading, and deliberately not a price. It says nothing about
 * what the deferred task would get there: after ROADMAP item 16 the destination's
 * budget is frequently a weekday median rather than a declaration, so a per-task
 * funding claim would be a solve on a guess presented as a promise — the same
 * defect that superseded item 8. It is no part of the advice objective either
 * (MATH.md §14) and prices nothing.
 *
 * One solve, through the classic allocator alone: the funded set needs no energy
 * params, and the §11.9 carry-over seed belongs to the VIEWED day's predecessor,
 * so `calculateDailyMetrics` would have to invent one for another day.
 */

import { calculateSuggestedTasks } from '$lib/business/model/metric/calculation';
import type { CapacityPools, FitPosterior, UserConstants } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';

export interface DeferDestinationInput {
	tasks: Task[];
	availableHours: number;
	switchCost: number;
	pools: CapacityPools;
	constants: UserConstants;
	/** Makes the allocator hedge ϕ-uncertainty (MATH.md §5.1), as the plan does. */
	posterior?: FitPosterior;
}

export interface DeferDestination {
	/** Active tasks, as stored. */
	taskCount: number;
	/** The hours it will open on — declared, or the weekday prefill. */
	budgetHours: number;
	/** How many of those tasks its own plan gives hours to. */
	fundedCount: number;
}

export function summarizeDeferDestination(input: DeferDestinationInput): DeferDestination {
	// Solved over the whole stored list, plan scope (MATH.md §11.8), and counted
	// over the open ones: the allocator is blind to `completed`, so a ticked-off
	// task keeps its hours — the rule `unfundedTaskIds` reads by.
	const plan = calculateSuggestedTasks(
		input.tasks,
		input.availableHours,
		input.switchCost,
		input.pools,
		input.constants,
		input.posterior,
	);

	return {
		taskCount: input.tasks.filter((task) => !task.completed).length,
		budgetHours: input.availableHours,
		fundedCount: plan.filter((task) => !task.completed && task.suggestedHours > 0).length,
	};
}
