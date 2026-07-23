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
	type FitPosterior
} from '../zenith';
import {
	simulateReservoirs,
	DEFAULT_ENERGY_PARAMS,
	type EnergyParams,
	type ReservoirDemand,
	type ScheduleBlock
} from '../zenith-energy';
import type { Task } from '$lib/data/type';

// Re-exported so callers of the metric functions get the entity type from the
// same module; the definition lives in the data layer (it is persisted).
export type { Task };

// Spillover: how much the secondary difficulty dimension adds on top of the
// dominant one. A task demanding BOTH body and mind (competitive climbing:
// phys 8, mental 6 → 9.8) is harder than a single-dimension task at the same
// peak (moving boxes: phys 8, mental 0 → 8). 0.3 keeps the secondary dimension
// subordinate: it can never flip which dimension dominates.
const DIFFICULTY_SPILLOVER = 0.3;

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
	task: Pick<Task, 'physicalDifficulty' | 'mentalDifficulty'>
): number {
	const dominant = Math.max(task.physicalDifficulty, task.mentalDifficulty);
	const secondary = Math.min(task.physicalDifficulty, task.mentalDifficulty);
	return Math.min(10, Math.max(1, dominant + DIFFICULTY_SPILLOVER * secondary));
}

/**
 * Determine if a task is primarily cognitive, physical, or balanced.
 * Used for display badges only - not for calculations.
 */
export function getTaskNature(
	task: Pick<Task, 'physicalDifficulty' | 'mentalDifficulty'>
): 'cognitive' | 'physical' | 'balanced' {
	const diff = task.mentalDifficulty - task.physicalDifficulty;
	if (diff >= 3) return 'cognitive';
	if (diff <= -3) return 'physical';
	return 'balanced';
}

export type SuggestedTask = Task & {
	suggestedHours: number;
	priorityScore: number;
	flowStateTime: number;
	trueEffort: number;
	trueEnjoyability: number;
	peakProductivity: number;
	avgProductivity: number;
	optimalHours: number; // Per-task optimal stopping time T* (model v2: task-dependent, no longer a fixed 1.79×ϕ)
};

export type ZenithGain = {
	optimized: number;
	naive: number;
	gainPercent: number;
};

// Pool weights: how hard each clock hour of a task draws on the two energy systems
function toPooledInputs(tasks: Task[]) {
	return tasks.map((task) => ({
		title: task.title,
		difficulty: getEffectiveDifficulty(task),
		enjoyment: task.enjoyment,
		cognitiveWeight: task.mentalDifficulty / 10,
		physicalWeight: task.physicalDifficulty / 10
	}));
}

export function calculateSuggestedTasks(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior
): SuggestedTask[] {
	const budget = Number(availableHours) || 0;
	if (tasks.length === 0) return [];

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
		posterior
	);

	return tasks
		.map((task, index) => {
			const alloc = allocations[index];
			// Priority is the task's INTRINSIC value: its average productivity at
			// its own optimal stopping time, P̄(T*). Allocation-independent, so a
			// great task the pools zeroed out still ranks by what it's worth, not
			// by what this plan could give it. (Model v2: T* and P̄(T*) are
			// task-dependent, so the allocator computes them per task — the old
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
				optimalHours: alloc.optimalHours
			};
		})
		.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function calculateZenithGain(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior
): ZenithGain {
	const budget = Number(availableHours) || 0;
	if (tasks.length === 0 || budget <= 0) return { optimized: 0, naive: 0, gainPercent: 0 };

	// Same dual-pool optimizer that produces the suggested plan, so the gain
	// shown describes the plan shown (not a separate single-constraint solve).
	return pooledProductivityGain(
		toPooledInputs(tasks),
		budget,
		pools,
		constants,
		switchCost,
		posterior
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
 * T* = x*(r)/k ∈ [1.5ϕ, 1.79ϕ]. However, for "flow coverage" we check if
 * tasks reach flow state (ϕ), meaning you at least hit peak productivity
 * before the allocation ends.
 *
 * A task "reaches flow" if allocatedTime ≥ ϕ (you get to experience flow state).
 */
export function calculateFlowCoverage(tasks: SuggestedTask[]): {
	reached: number;
	total: number;
} {
	if (!tasks.length) return { reached: 0, total: 0 };

	// Task reaches flow state if allocated time ≥ ϕ
	const reached = tasks.filter(
		(t) => t.suggestedHours > 0 && t.suggestedHours >= t.flowStateTime
	).length;

	return { reached, total: tasks.length };
}

export function calculateHumanCapacity(
	tasks: SuggestedTask[],
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS
): {
	percent: number;
	limitType: string;
} {
	if (!tasks.length) return { percent: 0, limitType: 'none' };

	// Weight hours by how demanding each dimension is (0-10 scale → 0-1 weight)
	const cogDemand = tasks.reduce((sum, t) => sum + (t.mentalDifficulty / 10) * t.suggestedHours, 0);
	const physDemand = tasks.reduce(
		(sum, t) => sum + (t.physicalDifficulty / 10) * t.suggestedHours,
		0
	);

	// Pools are user-configurable (defaults: cognitive ~4h/day, physical ~6h/day).
	// Note: since the allocator itself enforces these pools, suggested plans
	// saturate near (not beyond) 100% — values >100% can only come from
	// externally-supplied hours.
	// A pool of 0 is valid (e.g. injured → no physical capacity): the allocator
	// keeps demand at 0, so saturation reads 0 rather than dividing by zero.
	const saturation = (demand: number, pool: number): number =>
		pool > 0 ? Math.round((demand / pool) * 100) : demand > 0.001 ? Infinity : 0;
	const cogSaturation = saturation(cogDemand, pools.cognitiveHours);
	const physSaturation = saturation(physDemand, pools.physicalHours);

	if (cogSaturation >= physSaturation) {
		return { percent: cogSaturation, limitType: 'cognitive' };
	}
	return { percent: physSaturation, limitType: 'physical' };
}

/**
 * Find the task with highest strain ratio (E/β)
 *
 * Uses mapped Zenith values for consistency with the productivity model.
 * Higher E/β means lower initial productivity (p₀ = β/E) and more draining.
 */
export function calculateBottleneckTask(tasks: SuggestedTask[]): string {
	if (!tasks.length) return 'None Detected';
	return tasks.reduce((worst, current) => {
		// Use Zenith mapped values (E/β) for consistency
		const worstRatio = worst.trueEffort / worst.trueEnjoyability;
		const currentRatio = current.trueEffort / current.trueEnjoyability;
		return currentRatio > worstRatio ? current : worst;
	}).title;
}

/**
 * Calculate time scarcity: how constrained is the time budget?
 *
 * Question: "Can you reach flow state (ϕ) on each task?"
 *
 * Uses ϕ (flow state time) as the baseline demand per task, NOT T* ≈ 1.5–1.8×ϕ (optimal).
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
	constants: UserConstants = DEFAULT_USER_CONSTANTS
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
 *   reservoir at eq > 0 (defaults: ≈ 87% max for a full cognitive day), and a
 *   0-demand plan reads ~0. The dashboard thresholds are unchanged; readings
 *   simply live on an honest scale now.
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
	params: EnergyParams = DEFAULT_ENERGY_PARAMS
): number {
	if (!suggestedTasks.length) return 0;

	const budget = Number(availableHours) || 0;
	const funded = calculateInterleavedOrder(suggestedTasks);
	const overhead = funded.length > 1 ? (funded.length - 1) * switchCost : 0;
	const allocated = funded.reduce((sum, t) => sum + t.suggestedHours, 0);
	const overhang = Math.max(0, budget - overhead - allocated);

	const blocks: ScheduleBlock[] = [];
	let demands: ReservoirDemand[];

	if (allocated > 0) {
		// Intended overwork lands on the funded tasks in proportion to their
		// share of the plan — the same assumption the heuristic documented.
		const stretch = 1 + overhang / allocated;
		funded.forEach((t, i) => {
			if (i > 0 && switchCost > 0) blocks.push({ taskId: null, hours: switchCost });
			blocks.push({ taskId: t.id, hours: t.suggestedHours * stretch });
		});
		demands = funded.map((t) => ({
			id: t.id,
			cognitiveDemand: t.mentalDifficulty / 10,
			physicalDemand: t.physicalDifficulty / 10
		}));
	} else if (budget > 0) {
		const n = suggestedTasks.length;
		const avgCog = suggestedTasks.reduce((sum, t) => sum + t.mentalDifficulty, 0) / (10 * n);
		const avgPhys = suggestedTasks.reduce((sum, t) => sum + t.physicalDifficulty, 0) / (10 * n);
		blocks.push({ taskId: -1, hours: budget });
		demands = [{ id: -1, cognitiveDemand: avgCog, physicalDemand: avgPhys }];
	} else {
		return 0;
	}

	const { endCog, endPhys } = simulateReservoirs(blocks, demands, params);
	return Math.round(100 * (1 - Math.min(endCog, endPhys)));
}

/**
 * Calculate cognitive load: what % of your time budget is cognitive work?
 *
 * Uses budget as denominator. Switch time is considered "not cognitive work"
 * (a form of mental break/transition), so more tasks = more switching =
 * lower cognitive load per unit time. This is intentional.
 *
 * Weight by mentalDifficulty: high mental difficulty = more cognitive load.
 */
export function calculateCognitiveLoad(tasks: SuggestedTask[], availableHours: number): number {
	const budget = Number(availableHours) || 0;
	if (!tasks.length || !budget) return 0;

	// Weight hours by mental difficulty (0-10 → 0-1)
	const mentalHours = tasks.reduce(
		(sum, t) => sum + t.suggestedHours * (t.mentalDifficulty / 10),
		0
	);

	return Math.min(100, Math.round((mentalHours / budget) * 100));
}

/**
 * Calculate physical load: what % of your time budget is physical work?
 *
 * Uses budget as denominator (same rationale as cognitive load).
 * Weight by physicalDifficulty: high physical difficulty = more physical load.
 */
export function calculatePhysicalLoad(tasks: SuggestedTask[], availableHours: number): number {
	const budget = Number(availableHours) || 0;
	if (!tasks.length || !budget) return 0;

	// Weight hours by physical difficulty (0-10 → 0-1)
	const physicalHours = tasks.reduce(
		(sum, t) => sum + t.suggestedHours * (t.physicalDifficulty / 10),
		0
	);

	return Math.min(100, Math.round((physicalHours / budget) * 100));
}

export function calculateEnergyBalance(cognitiveLoad: number, physicalLoad: number): number {
	const total = cognitiveLoad + physicalLoad;
	if (!total) return 50;
	return Math.round((cognitiveLoad / total) * 100);
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
 * max-friction (difficulty 10, enjoyment 1 → gap 9) work.
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
 * Classify the day by average difficulty × enjoyment:
 * flow = challenging and engaging, grind = demanding but unenjoyable,
 * cruise = light and enjoyable, routine = low-key tasks.
 */
export function calculateDailyQuadrant(tasks: Task[]): DailyQuadrant {
	if (!tasks.length) return 'routine';

	const diff = tasks.reduce((sum, t) => sum + getEffectiveDifficulty(t), 0) / tasks.length;
	const enj = tasks.reduce((sum, t) => sum + t.enjoyment, 0) / tasks.length;

	if (diff >= 5.5 && enj >= 5.5) return 'flow';
	if (diff >= 5.5) return 'grind';
	if (enj >= 5.5) return 'cruise';
	return 'routine';
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
	switchCost: number = DEFAULT_SWITCH_COST
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

export function calculateDeepWorkRatio(tasks: SuggestedTask[], availableHours: number): number {
	const budget = Number(availableHours) || 0;
	if (!budget || !tasks.length) return 0;

	// Deep work: high mental difficulty tasks (cognitive intensity ≥ 7)
	const deepHours = tasks
		.filter((t) => t.mentalDifficulty >= 7)
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((deepHours / budget) * 100);
}

export function calculateQuickWins(tasks: SuggestedTask[]): number {
	// Quick wins: low effective difficulty, decent enjoyment
	return tasks.filter((t) => getEffectiveDifficulty(t) <= 3 && t.enjoyment >= 5).length;
}

/**
 * Calculate task variety: diversity of task characteristics
 *
 * Measures spread across cognitive/physical spectrum.
 * High variety = mix of mental and physical tasks (better for sustained energy).
 */
export function calculateTaskVariety(tasks: SuggestedTask[]): number {
	if (!tasks.length) return 0;

	// Count tasks by their dominant characteristic
	const natures = tasks.map((t) => getTaskNature(t));
	const uniqueNatures = new Set(natures);
	return Math.round((uniqueNatures.size / 3) * 100);
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
 */
export function calculateInterleavedOrder(tasks: SuggestedTask[]): SuggestedTask[] {
	const remaining = tasks
		.filter((t) => t.suggestedHours > 0)
		.sort((a, b) => b.priorityScore - a.priorityScore);
	if (remaining.length <= 2) return remaining;

	const order: SuggestedTask[] = [];
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
 * Calculate grind density: percentage of tasks where difficulty exceeds enjoyment
 *
 * Uses RAW user values (effective difficulty > enjoyment) because the Zenith mapped
 * ranges are asymmetric (E ∈ [1,5], β ∈ [1,2]) and would incorrectly flag
 * most tasks as "grinds" even when enjoyment > difficulty.
 *
 * A "grind" task is one where difficulty > enjoyment (feels like a chore).
 */
export function calculateGrindDensity(tasks: SuggestedTask[]): number {
	if (!tasks.length) return 0;
	// Use raw values for intuitive user-facing metric
	const grindTasks = tasks.filter((t) => getEffectiveDifficulty(t) > t.enjoyment);
	return Math.round((grindTasks.length / tasks.length) * 100);
}

/**
 * Calculate sustainable work %: time on tasks where enjoyment ≥ difficulty
 *
 * Unlike Grind Density (which counts tasks), this measures TIME spent on
 * energizing vs draining work. A task where enjoyment ≥ difficulty is
 * "sustainable" — it gives back as much energy as it takes.
 *
 * Complements:
 * - Avg Enjoyment: overall enjoyment level
 * - Grind Density: % of tasks that are grinds
 * - This: % of TIME that is sustainable
 */
export function calculateRewardDensity(tasks: SuggestedTask[], availableHours: number): number {
	const budget = Number(availableHours) || 0;
	if (!budget || !tasks.length) return 0;

	const sustainableHours = tasks
		.filter((t) => t.enjoyment >= getEffectiveDifficulty(t))
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((sustainableHours / budget) * 100);
}

export function calculateRecoveryRatio(tasks: SuggestedTask[]): string {
	if (!tasks.length) return 'N/A';

	const hardTasks = tasks.filter((t) => getEffectiveDifficulty(t) >= 7).length;
	const easyTasks = tasks.filter((t) => getEffectiveDifficulty(t) <= 4).length;

	if (hardTasks === 0) return 'No strain';
	if (easyTasks === 0 && hardTasks > 0) return '0:' + hardTasks;
	return easyTasks + ':' + hardTasks;
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
