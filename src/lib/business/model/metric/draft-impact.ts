/**
 * What the task being typed would do to the day, priced before it is deployed:
 * the hours the plan would give it, where it would run, and what the day's two
 * pools and its unspent hours would read afterwards.
 *
 * One solve, not a family: the day it joins is the baseline the caller already
 * has (`plan-advice.ts` reuses it the same way), so the reading costs exactly
 * the plan the draft is in.
 */

import type { CapacityPools } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';
import {
	calculateInterleavedOrder,
	calculatePlanSlackHours,
	calculatePoolDraw,
	calculatePoolSaturation,
	calculateTaskPlan,
} from '$lib/business/model/metric/calculation';
import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';

/**
 * Everything about a draft the allocator reads. Not its title, its tags or its
 * must-do flag: none of the three reaches a solve.
 */
export type DraftTask = Pick<
	Task,
	'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment' | 'importance'
>;

/** A day-level reading as the draft moves it. */
export interface DraftChange {
	before: number;
	after: number;
}

export interface DraftImpact {
	/** Hours the plan gives the draft — 0 when it funds nothing. */
	suggestedHours: number;
	priorityScore: number;
	/** 1-based slot in the run order the draft joins; `null` when unfunded. */
	position: number | null;
	/** Tasks that slot counts against. */
	fundedCount: number;
	cognitivePercent: DraftChange;
	physicalPercent: DraftChange;
	slackHours: DraftChange;
}

/**
 * The draft solved into the day. `baseline` is the current plan, which every
 * caller already has; it is only recomputed here so the function stays usable
 * on its own.
 */
export function calculateDraftImpact(
	input: DailyMetricsInput,
	draft: DraftTask,
	baseline: DailyMetrics = calculateDailyMetrics(input),
): DraftImpact {
	const { tasks, availableHours, switchCost, pools, constants, posterior } = input;
	// One past every id the day holds: an id the day already uses would price the
	// draft as the task it collided with. Not `nextTaskId`'s business — that rule
	// is about ids a day KEEPS (business/AGENTS.md), and this one exists only so
	// the solve's own output can be found again.
	const draftId = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;

	// FIRST, because `SessionStore.addTask` prepends. The allocator's sort is
	// stable over the priority score rounded to 1 dp, so input position orders
	// every tie — and that decides the run slot, and on a tight budget which
	// tie-mate is funded at all. Appended, this reads a plan the deploy does not
	// produce.
	const { suggestedTasks } = calculateTaskPlan(
		[
			{
				...draft,
				id: draftId,
				title: '',
				createdAt: '',
				completed: false,
			},
			...tasks,
		],
		availableHours,
		switchCost,
		pools,
		constants,
		posterior,
	);

	const planned = suggestedTasks.find((task) => task.id === draftId)!;
	const order = calculateInterleavedOrder(suggestedTasks);
	const position = order.findIndex((task) => task.id === draftId);

	return {
		suggestedHours: planned.suggestedHours,
		priorityScore: planned.priorityScore,
		position: position < 0 ? null : position + 1,
		fundedCount: order.length,
		...poolChange(baseline.suggestedTasks, suggestedTasks, pools),
		slackHours: {
			before: baseline.planSlackHours,
			after: calculatePlanSlackHours(suggestedTasks, availableHours, switchCost),
		},
	};
}

function poolChange(
	before: DailyMetrics['suggestedTasks'],
	after: DailyMetrics['suggestedTasks'],
	pools: CapacityPools,
): Pick<DraftImpact, 'cognitivePercent' | 'physicalPercent'> {
	const saturation = (tasks: DailyMetrics['suggestedTasks']) =>
		calculatePoolSaturation(calculatePoolDraw(tasks), pools);

	const from = saturation(before);
	const to = saturation(after);

	return {
		cognitivePercent: {
			before: from.cognitivePercent,
			after: to.cognitivePercent,
		},
		physicalPercent: {
			before: from.physicalPercent,
			after: to.physicalPercent,
		},
	};
}
