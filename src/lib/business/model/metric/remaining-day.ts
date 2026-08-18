/**
 * What is left of today, re-planned from the hours already spent on it
 * (MATH.md §35).
 *
 * The plan is a whole-day recommendation and stays one: it answers "what does
 * today look like as designed", so completing a task must not move it (§11.8).
 * This is the other question — "it is 2pm and the morning did not go to plan;
 * what are the hours left worth?" — and it is a **next-up** reading: it is
 * solved from a prefix of hours the user actually worked, against the budget and
 * the capacity those hours have already spent.
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
import {
	calculateInterleavedOrder,
	calculatePoolSaturation,
	toPooledInputs,
} from '$lib/business/model/metric/calculation';
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
	/**
	 * Where to go now: position 1 of the run order over the funded remainder, or
	 * `null` when the remainder funds nothing. Sequenced by the one
	 * `calculateInterleavedOrder` the `#N` badges use rather than an independent
	 * `argmax Δᵢ(1)` — two definitions of "next" would be free to disagree
	 * (AGENTS.md R3, MATH.md §35).
	 */
	nextTask: Task | null;
	/**
	 * What the hours already worked have spent of the pool they load hardest — the
	 * executed counterpart to Human Capacity's planned saturation (MATH.md §35).
	 * Exact; the display rounds.
	 */
	capacity: {
		limitType: 'cognitive' | 'physical';
		/** Over 100 on a day worked past its pool, which a plan can never be. */
		percentSpent: number;
	};
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
	// hours, so the draw is over the whole day's list — wider than the candidate
	// set built below.
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

	// Only a task that is BOTH finished and logged leaves the candidate set: its
	// hours are known, they come off the budget below, and it cannot take more.
	//
	// A task finished WITHOUT a log stays in, and that is the whole point.
	// Dropping it would refund hours and a switch the day may well have spent —
	// on the evidence of a checkbox, which is not an hours instrument. Left in, it
	// keeps drawing the share the plan gave it, which is the day's presumption
	// that it cost roughly what was suggested. It also makes ticking a box
	// inputs-identical to not ticking it, so no other task's number can move
	// (MATH.md §35). Its own share is solved but never reported: the presumption
	// is an accounting device, not a recommendation to work a finished task.
	const isSpent = (task: Task) => task.completed && (workedHours.get(task.id) ?? 0) > 0;
	const candidates = tasks.filter((task) => !isSpent(task));
	// The day's switch bill is over the tasks the DAY funds — every task with
	// hours on it, plus whatever the remainder newly starts (MATH.md §35).
	// `calculatePooledAllocations` charges for the started tasks it can see; a
	// spent task never reaches it, so its switch is charged off the budget here.
	const finishedStarted = tasks.length - candidates.length;
	// The pool those hours load hardest, on the same call Human Capacity names its
	// axis with (MATH.md §20) — the burn-down reads it and the solve below spends
	// against it, so the two cannot disagree about the day (AGENTS.md R3).
	const binding = calculatePoolSaturation(drawn, pools);

	// Clamped: an overrun day funds nothing, it does not fund negatively.
	const poolsLeft = {
		cognitiveHours: Math.max(0, pools.cognitiveHours - drawn.cognitiveHours),
		physicalHours: Math.max(0, pools.physicalHours - drawn.physicalHours),
	};

	const allocations = calculatePooledAllocations(
		toPooledInputs(candidates),
		Math.max(0, budget - workedTotal - finishedStarted * input.switchCost),
		poolsLeft,
		input.constants,
		input.switchCost,
		input.posterior,
		candidates.map((task) => workedHours.get(task.id) ?? 0),
	);

	const hoursByTask = new Map<number, number>();
	// The same set, carrying what sequencing needs. Priority is the intrinsic
	// P̄(T*) the plan rescales to a printed 1 dp figure (MATH.md §3) — un-rescaled
	// here, which is strictly finer: the rounding ties values this order separates.
	const funded = [] as (Task & { suggestedHours: number; priorityScore: number })[];

	allocations.forEach((allocation, index) => {
		const task = candidates[index];

		if (!task.completed && allocation.allocatedHours > 0) {
			hoursByTask.set(task.id, allocation.allocatedHours);

			funded.push({
				...task,
				suggestedHours: allocation.allocatedHours,
				priorityScore: allocation.optimalAvgProductivity,
			});
		}
	});

	return {
		workedHours: workedTotal,
		remainingHours: Math.max(0, budget - workedTotal),
		hoursByTask,
		plannedHours: [...hoursByTask.values()].reduce((sum, hours) => sum + hours, 0),
		// Over `funded`, not `candidates`: a task ticked done without a log keeps an
		// accounting share that is deliberately never reported, and naming it would
		// send the user back to work they just finished.
		nextTask: calculateInterleavedOrder(funded)[0] ?? null,
		capacity: {
			limitType: binding.limitType,
			percentSpent: binding.percent,
		},
	};
}
