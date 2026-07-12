import {
	calculatePooledAllocations,
	pooledProductivityGain,
	mapEffort,
	mapEnjoyability,
	calculateFlowStateTime,
	OPTIMAL_PHI_MULTIPLIER,
	OPTIMAL_AVG_FRACTION,
	DEFAULT_USER_CONSTANTS,
	DEFAULT_SWITCH_COST,
	DEFAULT_CAPACITY_POOLS,
	type CapacityPools,
	type UserConstants
} from '../zenith';
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
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): SuggestedTask[] {
	const budget = Number(availableHours) || 0;
	if (tasks.length === 0) return [];

	// Dual-pool allocation: respects the time budget AND the separate
	// cognitive/physical daily capacity pools, so the plan never schedules an
	// unsustainable day (e.g. 8h of max-intensity mental work).
	const allocations = calculatePooledAllocations(
		toPooledInputs(tasks),
		budget,
		pools,
		constants,
		switchCost
	);

	return tasks
		.map((task, index) => {
			const alloc = allocations[index];
			// Priority is the task's INTRINSIC value: its average productivity at
			// its own optimal stopping time, P̄(1.79ϕ) = (a+p₀)×OPTIMAL_AVG_FRACTION.
			// Allocation-independent, so a great task the pools zeroed out still
			// ranks by what it's worth, not by what this plan could give it.
			// (peakProductivity = (a+p₀)/e, so ×e recovers a+p₀.)
			const intrinsicValue = alloc.peakProductivity * Math.E * OPTIMAL_AVG_FRACTION;
			return {
				...task,
				suggestedHours: alloc.allocatedHours,
				priorityScore: Number((intrinsicValue * 10).toFixed(1)),
				flowStateTime: alloc.phi,
				trueEffort: alloc.E,
				trueEnjoyability: alloc.beta,
				peakProductivity: alloc.peakProductivity,
				avgProductivity: alloc.avgProductivity
			};
		})
		.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function calculateZenithGain(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): ZenithGain {
	const budget = Number(availableHours) || 0;
	if (tasks.length === 0 || budget <= 0) return { optimized: 0, naive: 0, gainPercent: 0 };

	// Same dual-pool optimizer that produces the suggested plan, so the gain
	// shown describes the plan shown (not a separate single-constraint solve).
	return pooledProductivityGain(toPooledInputs(tasks), budget, pools, constants, switchCost);
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
 * From the Zenith model, optimal stopping time is ≈1.79 × ϕ (flow state time).
 * However, for "flow coverage" we check if tasks reach flow state (ϕ),
 * meaning you at least hit peak productivity before the allocation ends.
 *
 * A task "reaches flow" if allocatedTime ≥ ϕ (you get to experience flow state).
 * For optimal productivity, you'd want allocatedTime ≈ 1.79 × ϕ.
 */
export function calculateFlowCoverage(activeTasks: SuggestedTask[]): {
	reached: number;
	total: number;
	optimal: number; // Tasks with enough time for optimal stopping
} {
	if (!activeTasks.length) return { reached: 0, total: 0, optimal: 0 };

	// Task reaches flow state if allocated time ≥ ϕ
	const reached = activeTasks.filter(
		(t) => t.suggestedHours > 0 && t.suggestedHours >= t.flowStateTime
	).length;

	// Task has optimal allocation if allocated time ≥ (OPTIMAL_PHI_MULTIPLIER) × ϕ.
	// Tolerance of half the 0.01h rounding quantum: a fully-funded task gets
	// exactly 1.79ϕ allocated, and display rounding must not flip it to "not
	// optimal" when it lands a hair below the threshold.
	const ROUNDING_EPS = 0.005;
	const optimal = activeTasks.filter(
		(t) =>
			t.suggestedHours > 0 &&
			t.suggestedHours >= OPTIMAL_PHI_MULTIPLIER * t.flowStateTime - ROUNDING_EPS
	).length;

	return { reached, total: activeTasks.length, optimal };
}

export function calculateHumanCapacity(
	activeTasks: SuggestedTask[],
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS
): {
	percent: number;
	limitType: string;
} {
	if (!activeTasks.length) return { percent: 0, limitType: 'none' };

	// Weight hours by how demanding each dimension is (0-10 scale → 0-1 weight)
	const cogDemand = activeTasks.reduce(
		(sum, t) => sum + (t.mentalDifficulty / 10) * t.suggestedHours,
		0
	);
	const physDemand = activeTasks.reduce(
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
export function calculateBottleneckTask(activeTasks: SuggestedTask[]): string {
	if (!activeTasks.length) return 'None Detected';
	return activeTasks.reduce((worst, current) => {
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
 * Uses ϕ (flow state time) as the baseline demand per task, NOT 3.16×ϕ (optimal).
 * This is more realistic because:
 * - 3.16×ϕ would mean ~4-5 hours per task (humans only have ~4 productive hours/day)
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
 * Calculate burnout risk using the Zenith productivity model
 *
 * Based on the mathematical model where:
 * - Optimal stopping time ≈ 1.79 × ϕ (flow state time)
 * - Strain factor = E/β (inverse of initial productivity p₀ = β/E)
 * - Working past optimal time leads to diminishing returns and burnout
 *
 * Burnout risk combines two factors:
 * 1. **Base strain**: High E/β tasks inherently drain more energy
 * 2. **Overwork (budget overhang)**: The allocator caps every suggestion at the
 *    optimal stopping time (≈1.79×ϕ), so suggested hours themselves never
 *    overwork you. The overwork risk instead comes from the PLANNED budget:
 *    hours the user intends to work beyond the model's total optimal workload
 *    (Σ 1.79×ϕᵢ) would be spent in the diminishing-returns zone.
 *
 * Formula:
 *   For each task:
 *     strainFactor = E/β (using mapped Zenith values)
 *     baseStrain = max(0, strainFactor - 1) × hours  (drain above neutral)
 *
 *   overhang = max(0, effectiveBudget - Σᵢ 1.79×ϕᵢ)
 *   overworkStrain = overhang × (plan-weighted average strainFactor)
 *
 *   totalRisk = (baseStrain + overworkStrain × 2) / CAPACITY × 100
 *
 * The overwork component is weighted 2× because working in the diminishing
 * returns zone accelerates burnout faster than baseline strain.
 */
export function calculateBurnoutRisk(
	activeTasks: SuggestedTask[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST
): number {
	if (!activeTasks.length) return 0;

	// Strain-hours capacity until 100% burnout risk
	// Calibrated so a full day of high-strain overworked tasks = 100%
	const STRAIN_CAPACITY = 5;

	let baseStrain = 0;
	let totalOptimal = 0; // Σ optimal stopping times (1.79×ϕ per task)
	let weightedStrainSum = 0; // strain × cogIntensity, weighted by plan share
	let totalPlannedHours = 0;

	for (const t of activeTasks) {
		const E = t.trueEffort; // Mapped effort (1-5)
		const beta = t.trueEnjoyability; // Mapped enjoyability (1-2)
		const hours = t.suggestedHours;

		// Strain factor: E/β = 1/p₀ (inverse of initial productivity)
		// When E/β > 1, task drains more than baseline
		const strainFactor = E / beta;

		// Multiplier based on cognitive intensity: mental work is more draining
		// mentalDifficulty 10 → 1.3x, mentalDifficulty 1 → 1.0x
		const cognitiveIntensity = 1.0 + (t.mentalDifficulty / 10) * 0.3;

		// Base strain: energy drain from high-effort/low-enjoyment tasks
		baseStrain += Math.max(0, strainFactor - 1) * hours * cognitiveIntensity;

		totalOptimal += OPTIMAL_PHI_MULTIPLIER * t.flowStateTime;
		weightedStrainSum += strainFactor * cognitiveIntensity * hours;
		totalPlannedHours += hours;
	}

	// Overwork: planned budget beyond the total optimal workload. Overhang hours
	// are assumed to land on tasks in proportion to their share of the plan.
	// Switches only happen between tasks that actually receive time.
	const budget = Number(availableHours) || 0;
	const fundedCount = activeTasks.filter((t) => t.suggestedHours > 0).length;
	const switchOverhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;
	const effectiveBudget = Math.max(0, budget - switchOverhead);
	const overhang = Math.max(0, effectiveBudget - totalOptimal);

	// Plan-weighted average strain (falls back to simple average for empty plans)
	const avgStrain =
		totalPlannedHours > 0
			? weightedStrainSum / totalPlannedHours
			: activeTasks.reduce((s, t) => s + t.trueEffort / t.trueEnjoyability, 0) / activeTasks.length;

	const overworkStrain = overhang * avgStrain;

	// Overwork strain weighted 2× (diminishing returns zone is worse)
	const totalStrain = baseStrain + overworkStrain * 2;

	return Math.min(100, Math.round((totalStrain / STRAIN_CAPACITY) * 100));
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
export function calculateCognitiveLoad(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length || !budget) return 0;

	// Weight hours by mental difficulty (0-10 → 0-1)
	const mentalHours = activeTasks.reduce(
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
export function calculatePhysicalLoad(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length || !budget) return 0;

	// Weight hours by physical difficulty (0-10 → 0-1)
	const physicalHours = activeTasks.reduce(
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
 * Uses mapped Zenith values (E, β) for consistency with the productivity model.
 * Friction = Σ max(0, E - β) × hours, normalized by ALLOCATED time (not budget):
 * the index is the time-weighted average friction of the work you'll actually
 * do, so 100% is reachable — it means every allocated hour is max-friction
 * (E=5, β=1 → gap=4) work.
 */
export function calculateFrictionIndex(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;

	const totalAllocated = activeTasks.reduce((sum, t) => sum + t.suggestedHours, 0);
	if (totalAllocated <= 0) return 0;

	const totalFriction = activeTasks.reduce((sum, t) => {
		// Use mapped Zenith values for consistency
		const gap = t.trueEffort - t.trueEnjoyability; // E - β
		return sum + (gap > 0 ? gap * t.suggestedHours : 0);
	}, 0);

	// Max gap: E=5, β=1 → 4 per allocated hour
	const MAX_EXPECTED_FRICTION = totalAllocated * 4;
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

export function calculateBudgetConvergence(
	activeTasks: SuggestedTask[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length) return 100;
	if (budget === 0) return 0;

	// Tasks with less time than a context switch are too fragmented
	const fragmentedTasks = activeTasks.filter((t) => t.suggestedHours < switchCost).length;
	return Math.max(0, 100 - Math.round((fragmentedTasks / activeTasks.length) * 100));
}

/**
 * Calculate momentum: average net enjoyment across tasks
 *
 * Uses RAW user values (enjoyment - effective difficulty) because the Zenith mapped
 * ranges are asymmetric (E ∈ [1,5], β ∈ [1,2]) and would almost always
 * show negative momentum even for enjoyable tasks.
 *
 * Positive = tasks are more enjoyable than difficult (sustainable)
 * Negative = tasks are more difficult than enjoyable (draining)
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

export function calculateDeepWorkRatio(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!budget || !activeTasks.length) return 0;

	// Deep work: high mental difficulty tasks (cognitive intensity ≥ 7)
	const deepHours = activeTasks
		.filter((t) => t.mentalDifficulty >= 7)
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((deepHours / budget) * 100);
}

export function calculateQuickWins(activeTasks: SuggestedTask[]): number {
	// Quick wins: low effective difficulty, decent enjoyment
	return activeTasks.filter((t) => getEffectiveDifficulty(t) <= 3 && t.enjoyment >= 5).length;
}

/**
 * Calculate task variety: diversity of task characteristics
 *
 * Measures spread across cognitive/physical spectrum.
 * High variety = mix of mental and physical tasks (better for sustained energy).
 */
export function calculateTaskVariety(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;

	// Count tasks by their dominant characteristic
	const natures = activeTasks.map((t) => getTaskNature(t));
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
export function calculateInterleavedOrder(activeTasks: SuggestedTask[]): SuggestedTask[] {
	const remaining = activeTasks
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
export function calculateGrindDensity(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;
	// Use raw values for intuitive user-facing metric
	const grindTasks = activeTasks.filter((t) => getEffectiveDifficulty(t) > t.enjoyment);
	return Math.round((grindTasks.length / activeTasks.length) * 100);
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
export function calculateRewardDensity(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!budget || !activeTasks.length) return 0;

	const sustainableHours = activeTasks
		.filter((t) => t.enjoyment >= getEffectiveDifficulty(t))
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((sustainableHours / budget) * 100);
}

export function calculateRecoveryRatio(activeTasks: SuggestedTask[]): string {
	if (!activeTasks.length) return 'N/A';

	const hardTasks = activeTasks.filter((t) => getEffectiveDifficulty(t) >= 7).length;
	const easyTasks = activeTasks.filter((t) => getEffectiveDifficulty(t) <= 4).length;

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
