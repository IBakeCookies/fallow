/**
 * What is left of today, re-planned from the hours already spent on it
 * (MATH.md §35).
 *
 * The plan is a whole-day recommendation and stays one: it answers "what does
 * today look like as designed", so completing a task must not move it (§11.8).
 * This is the other question — "it is 2pm and the morning did not go to plan;
 * what are the hours left worth?" — and it is a **next-up** reading: it is
 * solved over the OPEN tasks, from a prefix of hours the user actually worked,
 * against the budget and the capacity those hours have already spent.
 *
 * Deliberately not part of `calculateDailyMetrics`: folding it in there would
 * silently rescope twelve plan-family rows into remaining-day rows, and would
 * put a second 12.4 ms solve (n = 12, `prefix-replan.probe.ts`) inside a
 * `$derived` that re-runs on every keystroke — the cost rule that keeps
 * `budgetMarginal` out of it too (§14.2).
 */

import {
	calculatePooledAllocations,
	type CapacityPools,
	type FitPosterior,
	type UserConstants,
} from '$lib/business/model/zenith';
import { toPooledInputs } from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

export interface RemainingDayInput {
	tasks: Task[];
	availableHours: number;
	switchCost: number;
	pools: CapacityPools;
	constants: UserConstants;
	/** Makes the allocator hedge ϕ-uncertainty (MATH.md §5.1), as the plan does. */
	posterior?: FitPosterior;
	/** Hours logged against each of today's tasks so far (🪫), by task id. */
	workedHours: ReadonlyMap<number, number>;
}

export interface RemainingDay {
	/** Σ hours logged today, over the day's tasks. */
	workedHours: number;
	/** What is left to spend: max(0, budget − worked). */
	remainingHours: number;
	/** Additional hours worth spending, by task id. Open tasks only; a task worth nothing more is absent. */
	hoursByTask: ReadonlyMap<number, number>;
	/** Σ of `hoursByTask` — what the remaining hours are actually worth spending, which is not all of them. */
	plannedHours: number;
}

/**
 * `null` when nothing has been logged today: hours reach the model only through
 * 🪫 logs, so an unlogged day has no prefix to continue from and the plan is
 * already the whole answer. Ticking a task done is not an hours instrument.
 */
export function calculateRemainingDay(input: RemainingDayInput): RemainingDay | null {
	const { tasks, workedHours, pools } = input;
	const budget = Number(input.availableHours) || 0;
	const worked = tasks.map((task) => workedHours.get(task.id) ?? 0);
	const workedTotal = worked.reduce((sum, hours) => sum + hours, 0);

	if (workedTotal <= 0) return null;

	// Every task that was worked spent pool, whether or not it can still take
	// hours — so the draw is over the whole day's list and the candidate set is
	// only the open half.
	const drawn = toPooledInputs(tasks).reduce(
		(draw, { cognitiveWeight, physicalWeight }, index) => ({
			cognitiveHours: draw.cognitiveHours + cognitiveWeight * worked[index],
			physicalHours: draw.physicalHours + physicalWeight * worked[index],
		}),
		{
			cognitiveHours: 0,
			physicalHours: 0,
		},
	);

	const open = tasks.filter((task) => !task.completed);

	// The day's switch bill is over the tasks the DAY funds — every task with
	// hours on it, plus whatever the remainder newly starts (MATH.md §35).
	// `calculatePooledAllocations` charges for the started tasks it can see, which
	// is the open ones; a task that was worked and then ticked done is not a
	// candidate and never reaches it, so its switch is charged off the budget here.
	const finishedStarted = tasks.filter(
		(task) => task.completed && (workedHours.get(task.id) ?? 0) > 0,
	).length;

	const allocations = calculatePooledAllocations(
		toPooledInputs(open),
		Math.max(0, budget - workedTotal - finishedStarted * input.switchCost),
		{
			// Clamped: an overrun day funds nothing, it does not fund negatively.
			cognitiveHours: Math.max(0, pools.cognitiveHours - drawn.cognitiveHours),
			physicalHours: Math.max(0, pools.physicalHours - drawn.physicalHours),
		},
		input.constants,
		input.switchCost,
		input.posterior,
		open.map((task) => workedHours.get(task.id) ?? 0),
	);

	const hoursByTask = new Map<number, number>();

	allocations.forEach((allocation, index) => {
		if (allocation.allocatedHours > 0) hoursByTask.set(open[index].id, allocation.allocatedHours);
	});

	return {
		workedHours: workedTotal,
		remainingHours: Math.max(0, budget - workedTotal),
		hoursByTask,
		plannedHours: [...hoursByTask.values()].reduce((sum, hours) => sum + hours, 0),
	};
}
