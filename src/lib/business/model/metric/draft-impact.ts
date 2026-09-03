/**
 * What the task being typed would do to the day, priced before it is deployed:
 * the hours the plan would give it, where it would run, what the day's two pools,
 * its unspent hours and its Burnout Risk would read afterwards, and what the
 * day's other tasks lose to it.
 *
 * One solve, not a family: the day it joins is the baseline the caller already
 * has (`plan-advice.ts` reuses it the same way), so the reading costs exactly
 * the plan the draft is in.
 */

import type { CapacityPools } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';
import {
	calculateBurnoutRisk,
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
	/** What the draft takes off the day's other tasks. */
	displaced: {
		hoursTaken: number;
		taskCount: number;
		unfunded: string[];
	};
	burnoutRisk: DraftChange;
}

/**
 * The day's task list with a hypothetical task at the FRONT, and the id it was
 * given — the one definition of how an unsaved task joins a day (AGENTS.md R3),
 * shared by this reading and the next-task ranking.
 *
 * FIRST, because `SessionStore.addTask` prepends. The allocator's sort is stable
 * over the priority score rounded to 1 dp, so input position orders every tie —
 * and that decides the run slot, and on a tight budget which tie-mate is funded
 * at all. Appended, either caller reads a plan the deploy does not produce.
 *
 * The id is one past every id the day holds: an id the day already uses would
 * price the draft as the task it collided with. Not `nextTaskId`'s business —
 * that rule is about ids a day KEEPS (business/AGENTS.md), and this one exists
 * only so the solve's own output can be found again. The title is blank because
 * no title reaches a solve.
 */
export function prependDraft(tasks: Task[], draft: DraftTask): { tasks: Task[]; draftId: number } {
	const draftId = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;

	return {
		draftId,
		tasks: [
			{
				...draft,
				id: draftId,
				title: '',
				createdAt: '',
				completed: false,
			},
			...tasks,
		],
	};
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
	const { tasks, availableHours, switchCost, pools, constants, posterior, energyParams } = input;
	const { tasks: drafted, draftId } = prependDraft(tasks, draft);

	const { suggestedTasks } = calculateTaskPlan(
		drafted,
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
		// A draft the plan funds nothing for takes nothing. The pooled allocator is
		// a heuristic, so the plan it lands on can still move — but that movement is
		// the search's, not the draft's, and reading it as a cost would name a task
		// the day is not actually buying.
		displaced:
			planned.suggestedHours > 0
				? displacement(baseline.activeTasks, suggestedTasks)
				: {
						hoursTaken: 0,
						taskCount: 0,
						unfunded: [],
					},
		// The day's own dashboard reading on both sides: `before` is the baseline's
		// rather than a second derivation of it, and `after` is over the whole
		// drafted plan, the scope `calculateDailyMetrics` uses.
		burnoutRisk: {
			before: baseline.burnoutRisk,
			after: calculateBurnoutRisk(suggestedTasks, availableHours, switchCost, energyParams),
		},
	};
}

/**
 * Active tasks only: a completed task keeps its hours allocated and is not work
 * the user will redo, so naming one as displaced would be a phantom.
 */
function displacement(
	before: DailyMetrics['activeTasks'],
	after: DailyMetrics['suggestedTasks'],
): DraftImpact['displaced'] {
	let hoursTaken = 0;
	let taskCount = 0;
	const unfunded: string[] = [];

	for (const task of before) {
		const hours = after.find((planned) => planned.id === task.id)!.suggestedHours;
		const lost = Math.max(0, task.suggestedHours - hours);

		if (lost > 0) {
			hoursTaken += lost;
			taskCount += 1;
		}

		if (task.suggestedHours > 0 && hours === 0) unfunded.push(task.title);
	}

	return {
		hoursTaken,
		taskCount,
		unfunded,
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
