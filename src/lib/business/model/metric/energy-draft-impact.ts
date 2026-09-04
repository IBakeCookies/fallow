/**
 * What the task being typed would do to the OPTIMIZED day, priced before it is
 * deployed: the hours the optimizer would give it, where in the window they
 * run, what Total Output and the end-of-day reservoirs would read afterwards,
 * and what the day's other tasks lose to it.
 *
 * The energy-mode sibling of `draft-impact.ts` — the same draft and the same
 * question under a different plan, so the three shared shapes come from there.
 * One solve: the baseline is the plan the caller already holds.
 */

import type { UserConstants } from '$lib/business/model/zenith';
import type { Task } from '$lib/data/type';
import {
	optimizeSchedule,
	type EnergyParams,
	type OptimizeResult,
	type ScheduleEvaluation,
} from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import {
	prependDraft,
	type DraftChange,
	type DraftDisplacement,
	type DraftTask,
} from '$lib/business/model/metric/draft-impact';

export interface EnergyDraftImpactInput {
	tasks: Task[];
	windowHours: number;
	params: EnergyParams;
	constants: UserConstants;
}

export interface EnergyDraftImpact {
	/** Hours the optimizer funds the draft — 0 when it funds none. */
	suggestedHours: number;
	/** Hours into the window its first block starts; `null` when it has none. */
	startHour: number | null;
	totalOutput: DraftChange;
	/** Both reservoirs at the end of the last WORKED block — the pair `PlanSummary` prints. */
	endCog: DraftChange;
	endPhys: DraftChange;
	/** What the draft takes off the day's other tasks. */
	displaced: DraftDisplacement;
}

/**
 * The draft optimized into the day. `baseline` is that day's current plan,
 * which the caller already holds — passing it is what keeps this one solve
 * rather than two.
 */
export function calculateEnergyDraftImpact(
	input: EnergyDraftImpactInput,
	draft: DraftTask,
	baseline: OptimizeResult,
): EnergyDraftImpact | null {
	const { tasks, windowHours, params, constants } = input;

	// The page refuses to draw a plan without a window, so there is none to price.
	if (windowHours <= 0) return null;

	const { tasks: drafted, draftId } = prependDraft(tasks, draft);

	const { evaluation } = optimizeSchedule(
		drafted.map(toEnergyTask),
		windowHours,
		params,
		constants,
	);

	const after = hoursByTask(evaluation);
	const suggestedHours = after.get(draftId) ?? 0;
	const firstBlock = evaluation.blocks.find((block) => block.taskId === draftId);

	return {
		suggestedHours,
		startHour: firstBlock?.start ?? null,
		totalOutput: {
			before: baseline.evaluation.totalOutput,
			after: evaluation.totalOutput,
		},
		endCog: {
			before: baseline.evaluation.workEndCog,
			after: evaluation.workEndCog,
		},
		endPhys: {
			before: baseline.evaluation.workEndPhys,
			after: evaluation.workEndPhys,
		},
		// A draft the optimizer funds nothing for takes nothing. It is a seeded
		// local search, so the plan it lands on can still move — but that movement
		// is the search's, not the draft's, and reading it as a cost would name
		// hours the day is not buying.
		displaced:
			suggestedHours > 0
				? displacement(tasks, hoursByTask(baseline.evaluation), after)
				: {
						hoursTaken: 0,
						taskCount: 0,
						unfunded: [],
					},
	};
}

/**
 * Active tasks only: a completed task keeps its hours allocated and is not work
 * the user will redo, so naming one as displaced would be a phantom.
 */
function displacement(
	tasks: Task[],
	before: Map<number, number>,
	after: Map<number, number>,
): DraftDisplacement {
	let hoursTaken = 0;
	let taskCount = 0;
	const unfunded: string[] = [];

	for (const task of tasks) {
		if (task.completed) continue;

		const had = before.get(task.id) ?? 0;
		const has = after.get(task.id) ?? 0;
		const lost = Math.max(0, had - has);

		if (lost > 0) {
			hoursTaken += lost;
			taskCount += 1;
		}

		if (had > 0 && has === 0) unfunded.push(task.title);
	}

	return {
		hoursTaken,
		taskCount,
		unfunded,
	};
}

/** The plan summed per task, off the partition the timeline draws. */
function hoursByTask(evaluation: ScheduleEvaluation): Map<number, number> {
	const hours = new Map<number, number>();

	for (const block of evaluation.blocks) {
		if (block.taskId === null) continue;

		hours.set(block.taskId, (hours.get(block.taskId) ?? 0) + block.hours);
	}

	return hours;
}
