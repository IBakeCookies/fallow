import {
	calculatePooledAllocations,
	pooledProductivityGain,
	mapEffort,
	mapEnjoyability,
	calculateFlowStateTime,
	DEFAULT_USER_CONSTANTS,
	DEFAULT_SWITCH_COST,
	DEFAULT_CAPACITY_POOLS,
	type CapacityPools,
	type UserConstants,
	type FitPosterior,
} from '$lib/business/model/zenith';
import {
	simulateReservoirs,
	DEFAULT_ENERGY_PARAMS,
	type EnergyParams,
	type EnergyTaskInput,
	type ReservoirDemand,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

// Spillover: how much the secondary difficulty dimension adds on top of the
// dominant one. A task demanding BOTH body and mind (competitive climbing:
// phys 8, mental 6 → 9.8) is harder than a single-dimension task at the same
// peak (moving boxes: phys 8, mental 0 → 8). 0.3 keeps the secondary dimension
// subordinate: it can never flip which dimension dominates.
const DIFFICULTY_SPILLOVER = 0.3;
// Deep Work's ramp over mental difficulty (MATH.md §26): nothing below 5, the
// whole hour from 9 up, and the metric's former `>= 7` cut sits at half weight.
const DEEP_WORK_FLOOR = 5;
const DEEP_WORK_FULL = 9;

/**
 * Derive effective difficulty for Zenith algorithm.
 * Dominant dimension + spillover from the secondary one:
 *   Eᵤ = min(10, max(p, m) + 0.3 × min(p, m))
 *
 * Clamped to [1, 10]: the UI sliders allow 0 on a single dimension (meaning
 * "no physical/mental component"), but the Zenith model's Eᵤ domain is [1,10]
 * (mapEffort maps [1,10]→[1,5]). A task with BOTH dimensions at 0 would
 * otherwise produce E≈0.56, outside the model's defined range.
 */
export function getEffectiveDifficulty(
	task: Pick<Task, 'physicalDifficulty' | 'mentalDifficulty'>,
): number {
	const dominant = Math.max(task.physicalDifficulty, task.mentalDifficulty);
	const secondary = Math.min(task.physicalDifficulty, task.mentalDifficulty);

	return Math.min(10, Math.max(1, dominant + DIFFICULTY_SPILLOVER * secondary));
}

/**
 * Determine if a task is primarily cognitive, physical, or balanced. Feeds the
 * interleaving metrics below and the task badge, which reads it off
 * `SuggestedTask.nature` — one definition of the ±3 threshold (AGENTS.md R3).
 *
 * ±3 is an absolute gap and it reads correctly across most of the range: at
 * mental 10 / physical 8 the two dimensions really are comparable. It cannot
 * carry the bottom of the range, because the sliders admit 0 (MATH.md §22). At
 * mental 2 / physical 0 the same gap of 2 would call "balanced" a task with no
 * physical component at all — the badge promising both capacity pools while
 * `toEnergyTask` hands the reservoir law `physicalDemand: 0`. So a zero
 * dimension settles the question before the gap is consulted.
 *
 * 0/0 stays balanced: that is an absence, not a mix, and nothing downstream
 * reads it as a rating — `getEffectiveDifficulty` clamps it to 1.
 */
export function getTaskNature(
	task: Pick<Task, 'physicalDifficulty' | 'mentalDifficulty'>,
): 'cognitive' | 'physical' | 'balanced' {
	const diff = task.mentalDifficulty - task.physicalDifficulty;

	if (diff !== 0 && Math.min(task.physicalDifficulty, task.mentalDifficulty) === 0)
		return diff > 0 ? 'cognitive' : 'physical';

	if (diff >= 3) return 'cognitive';

	if (diff <= -3) return 'physical';

	return 'balanced';
}

/**
 * Flagged "don't move off today" (MATH.md §14). Lives here, beside the other
 * facts read straight off a task record, because three unrelated callers must
 * agree on it: the advisor's defer candidates, its unfunded partition, and
 * `SessionStore.moveTaskToTomorrow` — otherwise a task reported as
 * un-deferrable gets offered as a deferral anyway (AGENTS.md R3).
 *
 * The flag says nothing about hours: it removes a task from the defer levers,
 * and the allocator never sees it.
 *
 * `=== true` rather than a truthiness check is defense in depth. `sanitizeTask`
 * already narrows the persisted flag to `true`-or-absent on the read path
 * (R4), so this is what keeps the narrowing honest for tasks built in memory —
 * fixtures, and any future path that skips the sanitizer.
 */
export function isPinned(task: Pick<Task, 'mustDoToday'>): boolean {
	return task.mustDoToday === true;
}

/**
 * The energy model's view of a task: effective difficulty plus the per-hour
 * reservoir demands (sliders are 1–10, the reservoir law wants [0,1]).
 *
 * ONE definition on purpose — the Energy Lab, the stopping-value calibration
 * and the plan-adherence audit must all describe a task identically, or their
 * fits silently disagree with the plan they are calibrating.
 */
export function toEnergyTask(task: Task): EnergyTaskInput {
	return {
		id: task.id,
		title: task.title,
		difficulty: getEffectiveDifficulty(task),
		enjoyment: task.enjoyment,
		cognitiveDemand: task.mentalDifficulty / 10,
		physicalDemand: task.physicalDifficulty / 10,
	};
}

export type SuggestedTask = Task & {
	suggestedHours: number;
	priorityScore: number;
	flowStateTime: number;
	trueEffort: number;
	trueEnjoyability: number;
	peakProductivity: number;
	avgProductivity: number;
	optimalHours: number; // Per-task optimal stopping time, ϕ-uncertainty-hedged (MATH.md §3, §5.1)
	nature: ReturnType<typeof getTaskNature>;
};

/**
 * All `calculateInterleavedOrder` needs of a task: the two dimensions its nature
 * is read from, the hours a solve gave it, and a rank to break ties on.
 * `SuggestedTask` is one; the mid-day re-plan's funded set is the other, ranked
 * by the same intrinsic P̄(T*) before it is rescaled into a priority score
 * (MATH.md §3, §35) — any monotone rescale orders identically.
 */
type OrderableTask = Pick<Task, 'physicalDifficulty' | 'mentalDifficulty'> & {
	suggestedHours: number;
	priorityScore: number;
};

export type ZenithGain = {
	optimized: number;
	naive: number;
	gainPercent: number;
};

// Pool weights: how hard each clock hour of a task draws on the two energy
// systems. Exported because the remaining-day reading (§35) charges the pools
// for hours already worked and must charge them at the same weights the plan
// spends them at (R3).
export function toPooledInputs(tasks: Task[]) {
	return tasks.map((task) => ({
		title: task.title,
		difficulty: getEffectiveDifficulty(task),
		enjoyment: task.enjoyment,
		cognitiveWeight: task.mentalDifficulty / 10,
		physicalWeight: task.physicalDifficulty / 10,
	}));
}

/**
 * The day's plan, solved ONCE: the tasks with their allocations attached (sorted
 * by priority, which is what a screen shows) and the same allocation as bare
 * hours in the INPUT order.
 *
 * Both views exist because the two consumers need different orders and the solve
 * is the expensive part — 2ⁿ funded-subset enumeration, ~50ms at n = 12.
 * `calculateZenithGain` takes the input-order hours, and the order is
 * load-bearing rather than cosmetic: everything downstream pairs hours to tasks
 * **by index** (`calculateTotalProductivity`), so the priority-sorted hours would
 * charge each task the time of whichever task outranked it — a number that is
 * wrong without being obviously wrong. The naive baseline is unaffected either
 * way; it is derived from the task list, not from these hours.
 */
export function calculateTaskPlan(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior,
): { suggestedTasks: SuggestedTask[]; allocatedHours: number[] } {
	const budget = Number(availableHours) || 0;

	if (tasks.length === 0)
		return {
			suggestedTasks: [],
			allocatedHours: [],
		};

	// Dual-pool allocation: respects the time budget AND the separate
	// cognitive/physical daily capacity pools, so the plan never schedules an
	// unsustainable day (e.g. 8h of max-intensity mental work). With a fit
	// posterior the allocator maximizes EXPECTED productivity under each
	// task's ϕ-uncertainty (MATH.md §5.1), so a barely-measured model plans
	// more cautiously than a well-measured one.
	const allocations = calculatePooledAllocations(
		toPooledInputs(tasks),
		budget,
		pools,
		constants,
		switchCost,
		posterior,
	);

	return {
		suggestedTasks: tasks
			.map((task, index) => {
				const alloc = allocations[index];
				// Priority is the task's INTRINSIC value: its average productivity at
				// its own optimal stopping time, P̄(T*). Allocation-independent, so a
				// great task the pools zeroed out still ranks by what it's worth, not
				// by what this plan could give it — and so does every task on a day
				// with no hours entered yet, where it is the only ranking left
				// (MATH.md §3). (Model v2: T* and P̄(T*) are task-dependent, so the
				// allocator computes them per task — the old
				// (a+p₀)×OPTIMAL_AVG_FRACTION reconstruction no longer applies.)
				const intrinsicValue = alloc.optimalAvgProductivity;

				return {
					...task,
					suggestedHours: alloc.allocatedHours,
					priorityScore: Number((intrinsicValue * 10).toFixed(1)),
					flowStateTime: alloc.phi,
					trueEffort: alloc.E,
					trueEnjoyability: alloc.beta,
					peakProductivity: alloc.peakProductivity,
					avgProductivity: alloc.avgProductivity,
					optimalHours: alloc.optimalHours,
					nature: getTaskNature(task),
				};
			})
			.sort((a, b) => b.priorityScore - a.priorityScore),
		allocatedHours: allocations.map((alloc) => alloc.allocatedHours),
	};
}

/** The plan alone, for the callers that have no use for the input-order hours. */
export function calculateSuggestedTasks(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior,
): SuggestedTask[] {
	return calculateTaskPlan(tasks, availableHours, switchCost, pools, constants, posterior)
		.suggestedTasks;
}

export function calculateZenithGain(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior,
	/** This day's already-solved allocation, index-aligned with `tasks`. */
	allocatedHours?: number[],
): ZenithGain {
	const budget = Number(availableHours) || 0;

	if (tasks.length === 0 || budget <= 0)
		return {
			optimized: 0,
			naive: 0,
			gainPercent: 0,
		};

	// Same dual-pool optimizer that produces the suggested plan, so the gain
	// shown describes the plan shown (not a separate single-constraint solve) —
	// and when the caller already has that plan, literally the same solve.
	return pooledProductivityGain(
		toPooledInputs(tasks),
		budget,
		pools,
		constants,
		switchCost,
		posterior,
		allocatedHours,
	);
}

export function calculateCompletionRate(suggestedTasks: SuggestedTask[]): number {
	const completedTasks = suggestedTasks.filter((t) => t.completed).length;

	if (!completedTasks || !suggestedTasks.length) return 0;

	const totalPossiblePriority = suggestedTasks.reduce((sum, t) => sum + t.priorityScore, 0);

	const actualCompletedPriority = suggestedTasks
		.filter((t) => t.completed)
		.reduce((sum, t) => sum + t.priorityScore, 0);

	if (!totalPossiblePriority) return 0;

	return Math.round((actualCompletedPriority / totalPossiblePriority) * 100);
}

export function calculateYieldIndex(suggestedTasks: SuggestedTask[]): number {
	const completedTasks = suggestedTasks.filter((t) => t.completed).length;

	if (!completedTasks) return 0;

	// Sort by priority locally: "best possible" is the top-N tasks by priority,
	// regardless of the order the caller passes tasks in.
	const byPriority = [...suggestedTasks].sort((a, b) => b.priorityScore - a.priorityScore);

	const maxPossiblePriority = byPriority
		.slice(0, Math.max(1, completedTasks))
		.reduce((sum, t) => sum + t.priorityScore, 0);

	const actualCompletedPriority = suggestedTasks
		.filter((t) => t.completed)
		.reduce((sum, t) => sum + t.priorityScore, 0);

	if (!maxPossiblePriority) return 0;

	return Math.min(100, Math.round((actualCompletedPriority / maxPossiblePriority) * 100));
}

/**
 * Calculate flow coverage: tasks that receive enough time for optimal productivity
 *
 * From the Zenith model (v2), each task has its own optimal stopping time
 * T* = x*(r)/k ∈ [1.5194ϕ, 1.7933ϕ]. However, for "flow coverage" we check if
 * tasks reach flow state (ϕ), meaning you at least hit peak productivity
 * before the allocation ends.
 *
 * A task "reaches flow" if allocatedTime ≥ ϕ (you get to experience flow state).
 */
export function calculateFlowCoverage(tasks: SuggestedTask[]): {
	reached: number;
	total: number;
} {
	if (!tasks.length)
		return {
			reached: 0,
			total: 0,
		};

	// Task reaches flow state if allocated time ≥ ϕ
	const reached = tasks.filter(
		(t) => t.suggestedHours > 0 && t.suggestedHours >= t.flowStateTime,
	).length;

	return {
		reached,
		total: tasks.length,
	};
}

/**
 * Which of the two pools a set of demand-weighted hours loads hardest, and how
 * saturated it is. Two readings share it (AGENTS.md R3): Human Capacity, over
 * the hours the plan books, and the remaining day's burn-down, over the hours
 * already worked (MATH.md §20, §35).
 *
 * A pool of 0 is valid (e.g. injured → no physical capacity) and the two callers
 * meet it differently. A plan cannot draw on it — the allocator holds that
 * demand at 0, so saturation reads 0 rather than dividing by zero — but nothing
 * stops the user logging hours against it, and that arm really does return
 * Infinity, which the display gates on.
 *
 * Exact, and the caller rounds: rounding first made every pair inside the same
 * integer a tie and gave the tie to cognitive, so the row named the wrong pool —
 * and its wrong hour count — on 0.57% of days (MATH.md §20).
 */
export function calculatePoolSaturation(
	draw: CapacityPools,
	pools: CapacityPools,
): {
	percent: number;
	limitType: 'cognitive' | 'physical';
} {
	const saturation = (demand: number, pool: number): number =>
		pool > 0 ? (demand / pool) * 100 : demand > 0.001 ? Infinity : 0;

	const cogSaturation = saturation(draw.cognitiveHours, pools.cognitiveHours);
	const physSaturation = saturation(draw.physicalHours, pools.physicalHours);
	const cognitiveBinds = cogSaturation >= physSaturation;

	return {
		percent: cognitiveBinds ? cogSaturation : physSaturation,
		limitType: cognitiveBinds ? 'cognitive' : 'physical',
	};
}

export function calculateHumanCapacity(
	tasks: SuggestedTask[],
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
): {
	percent: number;
	limitType: 'cognitive' | 'physical' | 'none';
} {
	if (!tasks.length)
		return {
			percent: 0,
			limitType: 'none',
		};

	// Weight hours by how demanding each dimension is (0-10 scale → 0-1 weight).
	// Since the allocator itself enforces these pools, suggested plans saturate
	// near (not beyond) 100% — values >100% can only come from externally-supplied
	// hours (MATH.md §20).
	const { percent, limitType } = calculatePoolSaturation(
		{
			cognitiveHours: tasks.reduce(
				(sum, t) => sum + (t.mentalDifficulty / 10) * t.suggestedHours,
				0,
			),
			physicalHours: tasks.reduce(
				(sum, t) => sum + (t.physicalDifficulty / 10) * t.suggestedHours,
				0,
			),
		},
		pools,
	);

	return {
		percent: Math.round(percent),
		limitType,
	};
}

/**
 * The task drawing most on the pool that BINDS the day (MATH.md §23).
 *
 * `calculateHumanCapacity` decides which of the two pools is the day's
 * constraint and how saturated it is; this names the largest single term in
 * that same saturation's numerator — `(difficulty/10)·hours`, the identical
 * demand weight and the identical hours. So it carries no constant of its own:
 * the axis comes from the capacity reading, the quantity is the one already
 * summed there, and the row cannot name a pool that nothing on its list draws
 * on.
 *
 * The axis is solved HERE, off the same list, rather than taken as an argument
 * (MATH.md §23.1, 2026-08-07): the caller passing the plan-scoped axis while
 * passing the active list left the row pointed at a pool the remaining work no
 * longer touched — checking off the day's only physical task blanked the row to
 * "none" with five cognitive tasks still ahead, while DELETING that same task
 * re-pointed it correctly. Same list in, same list out, and the pair cannot
 * drift again. The returned `limitType` is what the display must name, which is
 * Human Capacity's axis only while the day is untouched — that row judges the
 * day AS PLANNED, this one points at what is left (§11.8).
 *
 * Ties keep the earlier task, which on the priority-sorted plan is the more
 * valuable of two identical draws.
 *
 * `null` when nothing on the list draws on either pool — no task, or no funded
 * hours. A sentinel title would collide with a task actually called that, and
 * it is presentation's word to choose anyway.
 */
export function calculateBottleneckTask(
	tasks: SuggestedTask[],
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
): { title: string; limitType: 'cognitive' | 'physical' } | null {
	const { limitType } = calculateHumanCapacity(tasks, pools);

	if (limitType === 'none') return null;

	const draw = (task: SuggestedTask): number =>
		((limitType === 'cognitive' ? task.mentalDifficulty : task.physicalDifficulty) / 10) *
		task.suggestedHours;

	const worst = tasks.reduce<SuggestedTask | null>(
		(acc, task) => (acc === null || draw(task) > draw(acc) ? task : acc),
		null,
	);

	return worst !== null && draw(worst) > 0
		? {
				title: worst.title,
				limitType,
			}
		: null;
}

/**
 * The task that takes longest to reach flow: argmax ϕ (MATH.md §1, §23).
 *
 * ϕ is the model's own warm-up quantity, already solved per task and carried on
 * the plan as `flowStateTime` — nothing is recomputed here. Paired with the
 * hours the plan funded, so the display can say whether the warm-up is actually
 * paid for; that comparison is Flow Coverage's criterion (`hours ≥ ϕ`) narrowed
 * to the single worst task.
 *
 * `null` on an empty list — the reading needs a task to name.
 */
export function calculateLongestWarmUp(
	tasks: SuggestedTask[],
): { title: string; flowStateTime: number; suggestedHours: number } | null {
	if (!tasks.length) return null;

	const slowest = tasks.reduce((acc, task) =>
		task.flowStateTime > acc.flowStateTime ? task : acc,
	);

	return {
		title: slowest.title,
		flowStateTime: slowest.flowStateTime,
		suggestedHours: slowest.suggestedHours,
	};
}

/**
 * Calculate time scarcity: how constrained is the time budget?
 *
 * Question: "Can you reach flow state (ϕ) on each task?"
 *
 * Uses ϕ (flow state time) as the baseline demand per task, NOT T* ≈ 1.52–1.79×ϕ (optimal).
 * This is more realistic because:
 * - T* would mean several hours per task (humans only have ~4 productive hours/day)
 * - ϕ represents the minimum meaningful engagement (reaching flow state)
 *
 * Scarcity = max(0, (total ϕ demand + switch overhead - budget) / total ϕ demand) × 100
 * 0% = budget covers flow state time for all tasks
 * 100% = budget is severely insufficient
 */
export function calculateTimeScarcity(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): number {
	const budget = Number(availableHours) || 0;

	if (!tasks.length) return 0;

	if (budget === 0) return 100;

	// Calculate total flow state time demand (Σϕ) using the shared Zenith model
	const totalFlowDemand = tasks.reduce((sum, t) => {
		const E = mapEffort(getEffectiveDifficulty(t));
		const beta = mapEnjoyability(t.enjoyment);
		const phi = calculateFlowStateTime(E, beta, constants);

		return sum + phi;
	}, 0);

	// Context-switching overhead (uses passed parameter, not hardcoded!)
	const switchOverhead = tasks.length > 1 ? (tasks.length - 1) * switchCost : 0;
	const effectiveBudget = Math.max(0, budget - switchOverhead);
	// Scarcity: how much demand exceeds budget
	const deficit = totalFlowDemand - effectiveBudget;
	const scarcity = deficit > 0 ? (deficit / totalFlowDemand) * 100 : 0;

	return Math.min(100, Math.max(0, Math.round(scarcity)));
}

/**
 * Burnout risk, derived from the energy model (2026-07-20, MATH.md §11.6).
 *
 * The metric simulates the day the user actually intends: the funded tasks in
 * their interleaved run order, switch costs as rest gaps, evolved through the
 * §8.1/§8.5 reservoir law (dC/dτ = −α·w·C + r′·(1−(1−b)·w)·(1−C)). Risk is
 * the depletion of the MOST-DRAINED reservoir at the end of that day:
 *
 *   risk = 100 × (1 − min(C_cog(T), C_phys(T)))
 *
 * min, not a blend: burnout follows the exhausted system — a full physical
 * reservoir does not compensate for a spent cognitive one.
 *
 * This retires the standalone strain-hours heuristic (E/β strain against a
 * fixed 5 strain-hour capacity), which saturated at 100% after ~1.4h of
 * worst-case work and was connected to no calibrated quantity. What the user
 * gets instead:
 * - Personalization: drain (α) and recovery (r) rates fitted from the user's
 *   own 🪫/☕ logs enter via `params` — the capacity connection the heuristic
 *   never had.
 * - Overwork without a magic 2× weight: budget hours beyond the funded plan
 *   (availableHours = hours the user INTENDS to work — the documented §11.3
 *   reading) stretch the funded blocks pro-rata and drain the reservoirs by
 *   simulation.
 * - SEMANTIC CHANGE: enjoyment no longer enters. In the energy model drain is
 *   f(demand, duration); enjoyment shapes output value (warm-up, satiety),
 *   not depletion. Loved-hard and hated-hard days now read the same risk —
 *   the §11.4 "difficulty you love is not friction" boundary, applied here.
 * - 100% is unreachable by design: micro-recovery (§8.5) floors each
 *   reservoir at eq > 0 (defaults: ≈ 87% max for a full cognitive day, sweep
 *   max 82% — probed 2026-08-06, `scripts/burnout-risk.probe.ts`), and a
 *   0-demand plan reads ~0. The dashboard thresholds are unchanged; readings
 *   simply live on an honest scale now. "By design" means by b > 0: the same
 *   probe reads exactly 100% at microRecoveryFraction = 0, which the energy
 *   lab permits.
 *
 * Funded tasks only, as before: a dropped task is one the user won't work
 * (§11.3). If NOTHING is funded but a budget is declared, the intended hours
 * are simulated at the task list's average demands, preserving the old
 * "budget with no plan still warns" behavior.
 */
export function calculateBurnoutRisk(
	suggestedTasks: SuggestedTask[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
): number {
	if (!suggestedTasks.length) return 0;

	const budget = Number(availableHours) || 0;
	// The allocator's own convention (`zenith.ts`: non-positive switch cost means
	// no switching): a negative cost would otherwise GROW the overhang, and since
	// the gap blocks below are only pushed when positive, the simulated span
	// would exceed the declared budget with the difference counted as work.
	const gap = Math.max(0, Number(switchCost) || 0);
	const funded = calculateInterleavedOrder(suggestedTasks);
	const overhead = funded.length > 1 ? (funded.length - 1) * gap : 0;
	const allocated = funded.reduce((sum, t) => sum + t.suggestedHours, 0);
	const overhang = Math.max(0, budget - overhead - allocated);
	const blocks: ScheduleBlock[] = [];
	let demands: ReservoirDemand[];

	if (allocated > 0) {
		// Intended overwork lands on the funded tasks in proportion to their
		// share of the plan — the same assumption the heuristic documented.
		const stretch = 1 + overhang / allocated;

		funded.forEach((t, i) => {
			if (i > 0 && gap > 0)
				blocks.push({
					taskId: null,
					hours: gap,
				});

			blocks.push({
				taskId: t.id,
				hours: t.suggestedHours * stretch,
			});
		});

		demands = funded.map((t) => ({
			id: t.id,
			cognitiveDemand: t.mentalDifficulty / 10,
			physicalDemand: t.physicalDifficulty / 10,
		}));
	} else if (budget > 0) {
		const n = suggestedTasks.length;
		const avgCog = suggestedTasks.reduce((sum, t) => sum + t.mentalDifficulty, 0) / (10 * n);
		const avgPhys = suggestedTasks.reduce((sum, t) => sum + t.physicalDifficulty, 0) / (10 * n);

		blocks.push({
			taskId: -1,
			hours: budget,
		});

		demands = [
			{
				id: -1,
				cognitiveDemand: avgCog,
				physicalDemand: avgPhys,
			},
		];
	} else {
		return 0;
	}

	const { endCog, endPhys } = simulateReservoirs(blocks, demands, params);

	return Math.round(100 * (1 - Math.min(endCog, endPhys)));
}

/**
 * How packed the day is with cognitive work: `Σ hoursᵢ × (mentalᵢ/10) ÷ budget`,
 * as a percent (MATH.md §25).
 *
 * INTENSITY-weighted, not a share of the day's hours: 8h at mental difficulty 5
 * in an 8h day reads 50%, though every hour of it is cognitive work. The
 * numerator is exactly Human Capacity's cognitive draw (§20) — same sum, a
 * different denominator, so the two rows cannot disagree about the same day.
 *
 * Uses the whole budget as denominator. Switch time is considered "not cognitive
 * work" (a form of mental break/transition), so more tasks = more switching =
 * lower cognitive load per unit time. This is intentional.
 *
 * EXACT, not rounded: Energy Balance is a ratio of the two loads and the bands
 * classify it at 40/60, so rounding here moved that classification on 49 of
 * ~3000 seeded days, 1.6% (§25). Rounding is the display's, like Human
 * Capacity's §20 split.
 */
export function calculateCognitiveLoad(tasks: SuggestedTask[], availableHours: number): number {
	return weightedLoad(tasks, availableHours, (t) => t.mentalDifficulty);
}

/**
 * The same reading on the physical dimension (MATH.md §25) — weighted by
 * `physicalDifficulty`, against the same whole-budget denominator. The two are
 * separate systems, so their sum may exceed 100%.
 */
export function calculatePhysicalLoad(tasks: SuggestedTask[], availableHours: number): number {
	return weightedLoad(tasks, availableHours, (t) => t.physicalDifficulty);
}

/**
 * `min(100, ·)` is provably slack for allocator output — Σ hours ≤ budget −
 * overhead and every weight is ≤ 1, and a 3000-day sweep hit 100.000% exactly
 * and never above (MATH.md §25) — and guards a hand-built task list whose hours
 * exceed the budget it is measured against.
 */
function weightedLoad(
	tasks: SuggestedTask[],
	availableHours: number,
	difficulty: (task: SuggestedTask) => number,
): number {
	const budget = Number(availableHours) || 0;

	if (!tasks.length || !budget) return 0;

	const weightedHours = tasks.reduce((sum, t) => sum + t.suggestedHours * (difficulty(t) / 10), 0);

	return Math.min(100, (weightedHours / budget) * 100);
}

/**
 * The cognitive share of the day's total load, 0–100 (50 = even split).
 *
 * Takes the EXACT loads above. Computed from percents already rounded to whole
 * numbers it disagreed with the exact ratio by up to 4.17 pp and flipped the
 * cognitive/physical/balanced classification on 49 of ~3000 seeded days, 1.6%
 * (MATH.md §25).
 *
 * 50 on a zero-load plan is a display sentinel that is also the target, which is
 * why the advisor reads that case as `NaN` instead (MATH.md §14.1 defect 5).
 */
export function calculateEnergyBalance(cognitiveLoad: number, physicalLoad: number): number {
	const total = cognitiveLoad + physicalLoad;

	if (!total) return 50;

	return (cognitiveLoad / total) * 100;
}

/**
 * Calculate friction index: resistance from unenjoyable high-effort tasks
 *
 * Uses RAW user scales (effective difficulty vs enjoyment, both 1-10), like
 * Momentum and Grind Density — and for the same reason (2026-07-18 fix,
 * MATH.md §11.4): the mapped Zenith ranges are asymmetric (E ∈ [1,5],
 * β ∈ [1,2]), so the old mapped gap E − β read a maximum-difficulty task at
 * MAXIMUM enjoyment as 75% friction (E=5, β=2 → gap 3 of 4). Difficulty you
 * love isn't friction; on raw scales that task has gap 0.
 *
 * Friction = Σ max(0, diffᵤ - βᵤ) × hours, normalized by ALLOCATED time (not
 * budget): the index is the time-weighted average friction of the work you'll
 * actually do, so 100% is reachable — it means every allocated hour is
 * max-friction (EFFECTIVE difficulty 10, which spillover also reaches from
 * 8/8, against enjoyment 1 → gap 9) work.
 */
export function calculateFrictionIndex(tasks: SuggestedTask[]): number {
	if (!tasks.length) return 0;

	const totalAllocated = tasks.reduce((sum, t) => sum + t.suggestedHours, 0);

	if (totalAllocated <= 0) return 0;

	const totalFriction = tasks.reduce((sum, t) => {
		const gap = getEffectiveDifficulty(t) - t.enjoyment;

		return sum + (gap > 0 ? gap * t.suggestedHours : 0);
	}, 0);

	// Max gap: difficulty 10, enjoyment 1 → 9 per allocated hour
	const MAX_EXPECTED_FRICTION = totalAllocated * 9;

	return Math.min(100, Math.max(0, Math.round((totalFriction / MAX_EXPECTED_FRICTION) * 100)));
}

export type DailyQuadrant = 'flow' | 'grind' | 'cruise' | 'routine';

/**
 * The cut on each axis is the reading a day rated at the MIDPOINT of its input
 * controls produces (MATH.md §29).
 *
 * Enjoyment is one slider over 1–10, so its midpoint is 5.5. Difficulty is NOT
 * a slider: it is `max + 0.3·min` over two sliders that start at 0 (§11.4,
 * §22), so a task at the midpoint of both reads 5 + 0.3×5. Judging that
 * composite against 5.5 — the old cut, the midpoint of a scale difficulty does
 * not live on — put 91.3% of seeded days above it and collapsed the 2×2 to a
 * threshold on enjoyment alone.
 */
const DEMANDING_CUT = 5 + DIFFICULTY_SPILLOVER * 5;
const ENJOYABLE_CUT = 5.5;

/**
 * The day's two axes, hour-weighted over the tasks the plan funds. `null` when
 * the plan books no hours: a day with no allocated time has no character, and
 * every label would be a claim about work that is not happening.
 */
function quadrantAxes(tasks: SuggestedTask[]): { diff: number; enj: number } | null {
	const funded = tasks.filter((t) => t.suggestedHours > 0);
	const hours = funded.reduce((sum, t) => sum + t.suggestedHours, 0);

	if (hours <= 0) return null;

	return {
		diff: funded.reduce((sum, t) => sum + getEffectiveDifficulty(t) * t.suggestedHours, 0) / hours,
		enj: funded.reduce((sum, t) => sum + t.enjoyment * t.suggestedHours, 0) / hours,
	};
}

/**
 * Classify the day by its hour-weighted difficulty × enjoyment:
 * flow = challenging and engaging, grind = demanding but unenjoyable,
 * cruise = light and enjoyable, routine = low-key tasks.
 *
 * Weighted by allocated hours, over funded tasks only. Plan scope (§11.8) asks
 * what the day looks like AS DESIGNED, and the design is the allocation: an
 * unweighted count let a 15-minute task outvote a 6-hour one and gave the tasks
 * the allocator deliberately declined to fund a vote on the character of the
 * day it built without them (MATH.md §29).
 */
export function calculateDailyQuadrant(tasks: SuggestedTask[]): DailyQuadrant | null {
	const axes = quadrantAxes(tasks);

	if (!axes) return null;

	const enjoyable = axes.enj >= ENJOYABLE_CUT;

	if (axes.diff >= DEMANDING_CUT) return enjoyable ? 'flow' : 'grind';

	return enjoyable ? 'cruise' : 'routine';
}

/**
 * How far the day sits from the nearer cut, in slider points — how much either
 * average would have to move to relabel it. `null` where the quadrant is.
 *
 * The label is a hard cliff on two averages, so a reader cannot tell a day that
 * is squarely one profile from a day that straddles two. Only the advisor asks
 * (MATH.md §29): it may not sell a flip that a rounding-width move undoes.
 */
export function calculateQuadrantMargin(tasks: SuggestedTask[]): number | null {
	const axes = quadrantAxes(tasks);

	if (!axes) return null;

	return Math.min(Math.abs(axes.diff - DEMANDING_CUT), Math.abs(axes.enj - ENJOYABLE_CUT));
}

/**
 * Schedule integrity: the share of the plan's committed time that is
 * productive work rather than context-switch overhead.
 *
 *   convergence = worked / (worked + (m−1)·switchCost) × 100,  m = funded tasks
 *
 * 2026-07-18 redefinition (MATH.md §11.5). The old rule counted tasks with
 * suggestedHours < switchCost as "fragmented" — but the minimum funded
 * allocation is one 15-minute block, which equals the default switch cost, so
 * at default settings the only tasks it could ever flag were DROPPED ones
 * (0 hours). A drop is the opposite of fragmentation: the allocator
 * consolidated the day because that task's switch wasn't worth paying. The
 * ratio above measures fragmentation directly: many small sessions push it
 * down (more switches per worked hour), one long session pushes it to 100.
 */
export function calculateScheduleIntegrity(
	tasks: SuggestedTask[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
): number {
	const budget = Number(availableHours) || 0;

	if (!tasks.length) return 100;

	if (budget === 0) return 0;

	const worked = tasks.reduce((sum, t) => sum + t.suggestedHours, 0);

	if (worked <= 0) return 0; // budget set, but the plan funds nothing

	const fundedCount = tasks.filter((t) => t.suggestedHours > 0).length;
	const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;

	return Math.round((worked / (worked + overhead)) * 100);
}

/**
 * Calculate momentum: average net enjoyment across the remaining tasks
 *
 * Callers pass ACTIVE (uncompleted) tasks, so the metric responds as the day
 * progresses: finish the draining tasks and momentum ticks upward. It is pure
 * affect — no hours, no demand-over-time. Physiological depletion is Burnout
 * Risk's job (§11.6); this measures whether the work ahead motivates.
 *
 * Uses RAW user values (enjoyment - effective difficulty) because the Zenith mapped
 * ranges are asymmetric (E ∈ [1,5], β ∈ [1,2]) and would almost always
 * show negative momentum even for enjoyable tasks.
 *
 * Positive = remaining tasks are more enjoyable than difficult (motivating)
 * Negative = remaining tasks are more difficult than enjoyable (draining)
 *
 * Range: [-9, +9] based on raw 1-10 inputs
 */
export function calculateMomentum(tasks: Task[]): number {
	if (!tasks.length) return 0;

	// Use raw values for intuitive user-facing metric
	const totalNetEnjoyment = tasks.reduce((sum, task) => {
		return sum + (task.enjoyment - getEffectiveDifficulty(task));
	}, 0);

	return Math.round(totalNetEnjoyment / tasks.length);
}

/**
 * Deep Work: what share of the day's budget is time in sustained focus
 * (MATH.md §26). Plan scope (§11.8), whole-budget denominator (§25), exact —
 * `metric-descriptor` rounds for display.
 *
 * The hours are ramped, not cut at a threshold: mental difficulty below
 * DEEP_WORK_FLOOR is not sustained focus, at or above DEEP_WORK_FULL the whole
 * hour is, and the old `>= 7` cut is now the half-weight point instead of a
 * step that swung a full block on one slider point.
 */
export function calculateDeepWorkRatio(tasks: SuggestedTask[], availableHours: number): number {
	const budget = Number(availableHours) || 0;

	if (!budget || !tasks.length) return 0;

	const deepHours = tasks.reduce((sum, t) => sum + t.suggestedHours * deepWorkWeight(t), 0);

	// Slack on allocator output (Σ hᵢ ≤ B − overhead, weights ≤ 1), kept for the
	// same reason as the Load clamp (§25): a hand-built list can break it.
	return Math.min(100, (deepHours / budget) * 100);
}

function deepWorkWeight(task: Pick<Task, 'mentalDifficulty'>): number {
	return Math.min(
		1,
		Math.max(0, (task.mentalDifficulty - DEEP_WORK_FLOOR) / (DEEP_WORK_FULL - DEEP_WORK_FLOOR)),
	);
}

export function calculateQuickWins(tasks: SuggestedTask[]): number {
	// Quick wins: low effective difficulty, decent enjoyment
	return tasks.filter((t) => getEffectiveDifficulty(t) <= 3 && t.enjoyment >= 5).length;
}

/**
 * Suggested run order: alternate cognitive and physical tasks.
 *
 * Rationale (dual-pool model): cognitive and physical fatigue are separate
 * systems, so sequencing a physical task after deep mental work lets the
 * cognitive pool recover while the clock keeps running — the resting
 * dimension recovers instead of accumulating strain.
 *
 * Greedy: start from the highest-priority task, then repeatedly pick the
 * highest-priority remaining task whose nature differs from the previous
 * task's ('balanced' tasks pair with anything). Falls back to plain priority
 * order when no contrasting task remains (e.g. an all-cognitive day).
 *
 * Only tasks with allocated time are sequenced — a 0h task has no session
 * to schedule.
 *
 * Deliberately still a heuristic (MATH.md §16): scored under the energy model —
 * the only objective that reads order at all — this sequence lands within a
 * median 0.47% of the best possible ordering of the same allocation, and the
 * objective-maximizing order moves `calculateBurnoutRisk` by >5 points on a
 * third of days in no consistent direction. One definition for all four
 * consumers: the `#N` badges, burnout's block sequence, the mid-day re-plan's
 * next-up task (MATH.md §35) and `EnergyLabStore`'s classic schedule.
 *
 * The alternation has **no memory of what was just worked** — it starts from a
 * clean slate every time, so on the re-plan it can open with the same nature the
 * user finished a moment ago. Same limitation on the morning badges, where the
 * sequence is read whole and the previous task is the row above.
 */
export function calculateInterleavedOrder<T extends OrderableTask>(tasks: T[]): T[] {
	const remaining = tasks
		.filter((t) => t.suggestedHours > 0)
		.sort((a, b) => b.priorityScore - a.priorityScore);

	if (remaining.length <= 2) return remaining;

	const order: T[] = [];
	let prevNature: ReturnType<typeof getTaskNature> | null = null;

	while (remaining.length > 0) {
		// Prefer the best task that contrasts with the previous nature;
		// 'balanced' contrasts with everything, and anything follows 'balanced'.
		let pick = remaining.findIndex((t) => {
			if (prevNature === null || prevNature === 'balanced') return true;

			const nature = getTaskNature(t);

			return nature !== prevNature;
		});

		if (pick === -1) pick = 0; // no contrast available: plain priority order

		const task = remaining.splice(pick, 1)[0];
		order.push(task);
		prevNature = getTaskNature(task);
	}

	return order;
}

/**
 * Grind density: the share of the day's FUNDED tasks that feel like a chore —
 * effective difficulty above enjoyment (MATH.md §11.10).
 *
 * Uses RAW user scales (effective difficulty vs enjoyment, both 1–10), like
 * Momentum and Friction (§11.4): the mapped Zenith ranges are asymmetric
 * (E ∈ [1,5], β ∈ [1,2]) and would flag most tasks as grinds even when
 * enjoyment beats difficulty.
 *
 * Counts only tasks the plan funds. A dropped task is work the day does not do,
 * so it drains no willpower — and counting it made the advisor's cheapest fix
 * "defer a task you were not going to touch", which improves the reading at
 * Σ P̄ cost 0.00% without changing the day at all (§11.10).
 *
 * `grinds`/`funded` travel with the percent because the value is quantized to
 * 100/`funded` while the band ladder cuts at 25/50/75: on a two-task plan the
 * only readings are 0, 50 and 100, and the row says so instead of implying a
 * precision the count cannot carry.
 */
export function calculateGrindDensity(tasks: SuggestedTask[]): {
	grinds: number;
	funded: number;
	percent: number;
} {
	const funded = tasks.filter((t) => t.suggestedHours > 0);
	const grinds = funded.filter((t) => getEffectiveDifficulty(t) > t.enjoyment).length;

	return {
		grinds,
		funded: funded.length,
		percent: funded.length ? Math.round((grinds / funded.length) * 100) : 0,
	};
}

/**
 * Sustainable Work: the share of the plan's WORKED time spent on tasks whose
 * enjoyment covers their effective difficulty — work that gives back as much
 * energy as it takes.
 *
 * Complements, and the denominator is what separates them (MATH.md §27):
 * - Grind Density: the same predicate over the task COUNT
 * - Friction Index: the size of the gap, not a threshold on it (§11.4)
 * - This: the same predicate over ALLOCATED HOURS
 *
 * Over Σh, not over the budget: unbooked slack and switch overhead are not
 * grind, and pricing them here made 100% unreachable and put a grind-free day
 * in the critical band. How much of the budget the plan commits is Schedule
 * Integrity's and Time Scarcity's reading. Unlike Deep Work (§26), which kept
 * the whole-budget denominator, this row IS bigger-better — so its top arm has
 * to be reachable.
 *
 * Plan scope (§11.8), exact — `metric-descriptor` rounds for display (§25).
 * `null` when the plan funds no hours: there is no worked time to take a share
 * of, and 0 would report a day with no work as a day of pure grind.
 */
export function calculateRewardDensity(tasks: SuggestedTask[]): number | null {
	const workedHours = tasks.reduce((sum, t) => sum + t.suggestedHours, 0);

	if (workedHours <= 0) return null;

	const sustainableHours = tasks
		.filter((t) => t.enjoyment >= getEffectiveDifficulty(t))
		.reduce((sum, t) => sum + t.suggestedHours, 0);

	return (sustainableHours / workedHours) * 100;
}

/**
 * Easy tasks against hard ones — the counts, not the sentence. `null` when
 * there is nothing to count; `hard === 0` is a day with no strain to recover
 * from. Wording and banding are presentation policy.
 */
export function calculateRecoveryRatio(
	tasks: SuggestedTask[],
): { easy: number; hard: number } | null {
	if (!tasks.length) return null;

	return {
		easy: tasks.filter((t) => getEffectiveDifficulty(t) <= 4).length,
		hard: tasks.filter((t) => getEffectiveDifficulty(t) >= 7).length,
	};
}

export function calculateAveragePhysicalDifficulty(tasks: Task[]): number {
	if (!tasks.length) return 0;

	return Math.round(tasks.reduce((sum, task) => sum + task.physicalDifficulty, 0) / tasks.length);
}

export function calculateAverageMentalDifficulty(tasks: Task[]): number {
	if (!tasks.length) return 0;

	return Math.round(tasks.reduce((sum, task) => sum + task.mentalDifficulty, 0) / tasks.length);
}

export function calculateAverageEnjoyment(tasks: Task[]): number {
	if (!tasks.length) return 0;

	return Math.round(tasks.reduce((sum, task) => sum + task.enjoyment, 0) / tasks.length);
}
