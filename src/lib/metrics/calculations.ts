import {
	calculateTaskAllocations,
	productivityGain,
	DEFAULT_USER_CONSTANTS,
	DEFAULT_SWITCH_COST
} from '$lib/zenith';
import type { TaskType } from '$lib/types/business/taskType';

export type Task = {
	id: number;
	title: string;
	difficulty: number;
	enjoyment: number;
	taskType: TaskType;
	createdAt: string;
	completed: boolean;
};

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

export function calculateSuggestedTasks(
	tasks: Task[],
	availableHours: number,
	switchCost: number = DEFAULT_SWITCH_COST
): SuggestedTask[] {
	const budget = Number(availableHours) || 0;
	if (tasks.length === 0) return [];

	const taskInputs = tasks.map((task) => ({
		title: task.title,
		difficulty: task.difficulty,
		enjoyment: task.enjoyment
	}));

	const allocations = calculateTaskAllocations(
		taskInputs,
		budget,
		DEFAULT_USER_CONSTANTS,
		switchCost
	);

	return tasks
		.map((task, index) => {
			const alloc = allocations[index];
			return {
				...task,
				suggestedHours: alloc.allocatedHours,
				priorityScore: Number((alloc.avgProductivity * 10).toFixed(1)),
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
	switchCost: number = DEFAULT_SWITCH_COST
): ZenithGain {
	const budget = Number(availableHours) || 0;
	if (tasks.length === 0 || budget <= 0) return { optimized: 0, naive: 0, gainPercent: 0 };

	const taskInputs = tasks.map((task) => ({
		title: task.title,
		difficulty: task.difficulty,
		enjoyment: task.enjoyment
	}));

	return productivityGain(taskInputs, budget, DEFAULT_USER_CONSTANTS, switchCost);
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

	const maxPossiblePriority = suggestedTasks
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
 * From the Zenith model, optimal stopping time is ~3.16 × ϕ (flow state time).
 * However, for "flow coverage" we check if tasks reach flow state (ϕ),
 * meaning you at least hit peak productivity before the allocation ends.
 *
 * A task "reaches flow" if allocatedTime ≥ ϕ (you get to experience flow state).
 * For optimal productivity, you'd want allocatedTime ≈ 3.16 × ϕ.
 */
export function calculateFlowCoverage(activeTasks: SuggestedTask[]): {
	reached: number;
	total: number;
	optimal: number; // Tasks with enough time for optimal stopping
} {
	if (!activeTasks.length) return { reached: 0, total: 0, optimal: 0 };

	const OPTIMAL_MULTIPLIER = 3.16;

	// Task reaches flow state if allocated time ≥ ϕ
	const reached = activeTasks.filter(
		(t) => t.suggestedHours > 0 && t.suggestedHours >= t.flowStateTime
	).length;

	// Task has optimal allocation if allocated time ≥ 3.16 × ϕ
	const optimal = activeTasks.filter(
		(t) => t.suggestedHours > 0 && t.suggestedHours >= OPTIMAL_MULTIPLIER * t.flowStateTime
	).length;

	return { reached, total: activeTasks.length, optimal };
}

export function calculateHumanCapacity(activeTasks: SuggestedTask[]): {
	percent: number;
	limitType: string;
} {
	if (!activeTasks.length) return { percent: 0, limitType: 'none' };

	const cognitiveHours = activeTasks
		.filter((t) => t.taskType === 'Cognitive')
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	const hybridHours = activeTasks
		.filter((t) => t.taskType === 'Hybrid')
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	const physicalHours = activeTasks
		.filter((t) => t.taskType === 'Physical')
		.reduce((sum, t) => sum + t.suggestedHours, 0);

	const cogDemand = cognitiveHours + hybridHours * 0.5;
	const physDemand = physicalHours + hybridHours * 0.5;

	const cogSaturation = Math.round((cogDemand / 4) * 100);
	const physSaturation = Math.round((physDemand / 6) * 100);

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
	switchCost: number = DEFAULT_SWITCH_COST
): number {
	const budget = Number(availableHours) || 0;
	if (!tasks.length) return 0;
	if (budget === 0) return 100;

	// Use Zenith constants (inline to avoid circular deps)
	const c1 = DEFAULT_USER_CONSTANTS.c1;
	const c2 = DEFAULT_USER_CONSTANTS.c2;
	const c3 = DEFAULT_USER_CONSTANTS.c3;

	// Calculate total flow state time demand (Σϕ)
	const totalFlowDemand = tasks.reduce((sum, t) => {
		const E = (4 / 9) * t.difficulty + 5 / 9; // mapEffort
		const beta = (1 / 9) * t.enjoyment + 8 / 9; // mapEnjoyability
		const phi = Math.max(0.1, c1 * E + c2 * beta + c3);
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
 * - Optimal stopping time ≈ 3.16 × ϕ (flow state time)
 * - Strain factor = E/β (inverse of initial productivity p₀ = β/E)
 * - Working past optimal time leads to diminishing returns and burnout
 *
 * Burnout risk combines two factors:
 * 1. **Overwork**: Time allocated beyond optimal (3.16×ϕ) weighted by strain
 * 2. **Base strain**: High E/β tasks inherently drain more energy
 *
 * Formula:
 *   For each task:
 *     optimalTime = 3.16 × ϕ
 *     overworkRatio = max(0, allocatedTime - optimalTime) / optimalTime
 *     strainFactor = E/β (using mapped Zenith values)
 *     baseStrain = max(0, strainFactor - 1) × hours  (drain above neutral)
 *     overworkStrain = overworkRatio × strainFactor × hours
 *
 *   totalRisk = (baseStrain + overworkStrain × 2) / CAPACITY × 100
 *
 * The overwork component is weighted 2× because working in the diminishing
 * returns zone accelerates burnout faster than baseline strain.
 */
export function calculateBurnoutRisk(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;

	// Strain-hours capacity until 100% burnout risk
	// Calibrated so a full day of high-strain overworked tasks = 100%
	const STRAIN_CAPACITY = 5;
	const OPTIMAL_TIME_MULTIPLIER = 3.16; // From Zenith model derivation

	const { baseStrain, overworkStrain } = activeTasks.reduce(
		(acc, t) => {
			const E = t.trueEffort; // Mapped effort (1-5)
			const beta = t.trueEnjoyability; // Mapped enjoyability (1-2)
			const phi = t.flowStateTime; // Time to flow state
			const hours = t.suggestedHours;

			// Strain factor: E/β = 1/p₀ (inverse of initial productivity)
			// When E/β > 1, task drains more than baseline
			const strainFactor = E / beta;

			// Base strain: energy drain from high-effort/low-enjoyment tasks
			const taskBaseStrain = Math.max(0, strainFactor - 1) * hours;

			// Overwork: time spent past the optimal stopping point
			const optimalTime = OPTIMAL_TIME_MULTIPLIER * phi;
			const overworkTime = Math.max(0, hours - optimalTime);
			const overworkRatio = optimalTime > 0 ? overworkTime / optimalTime : 0;

			// Overwork strain: diminishing returns zone accelerates burnout
			const taskOverworkStrain = overworkRatio * strainFactor * hours;

			// Task type modifier: cognitive tasks are more draining
			const typeMultiplier =
				t.taskType === 'Cognitive' ? 1.3 : t.taskType === 'Hybrid' ? 1.15 : 1.0;

			return {
				baseStrain: acc.baseStrain + taskBaseStrain * typeMultiplier,
				overworkStrain: acc.overworkStrain + taskOverworkStrain * typeMultiplier
			};
		},
		{ baseStrain: 0, overworkStrain: 0 }
	);

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
 * Cognitive tasks count fully, Hybrid tasks count as 50% cognitive.
 */
export function calculateCognitiveLoad(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length || !budget) return 0;

	const mentalHours = activeTasks
		.filter((t) => t.taskType === 'Cognitive' || t.taskType === 'Hybrid')
		.reduce((sum, t) => sum + t.suggestedHours * (t.taskType === 'Cognitive' ? 1 : 0.5), 0);

	return Math.min(100, Math.round((mentalHours / budget) * 100));
}

/**
 * Calculate physical load: what % of your time budget is physical work?
 *
 * Uses budget as denominator (same rationale as cognitive load).
 * Physical tasks count fully, Hybrid tasks count as 50% physical.
 */
export function calculatePhysicalLoad(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length || !budget) return 0;

	const physicalHours = activeTasks
		.filter((t) => t.taskType === 'Physical' || t.taskType === 'Hybrid')
		.reduce((sum, t) => sum + t.suggestedHours * (t.taskType === 'Physical' ? 1 : 0.5), 0);

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
 * Friction = Σ max(0, E - β) × hours
 *
 * E ranges [1-5], β ranges [1-2], so max gap is 4 (E=5, β=1).
 * Scaled so a full day of max-friction tasks = 100%.
 */
export function calculateFrictionIndex(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length || !budget) return 0;

	const totalFriction = activeTasks.reduce((sum, t) => {
		// Use mapped Zenith values for consistency
		const gap = t.trueEffort - t.trueEnjoyability; // E - β
		return sum + (gap > 0 ? gap * t.suggestedHours : 0);
	}, 0);

	// Max friction: E=5, β=1 → gap=4, times full budget
	const MAX_EXPECTED_FRICTION = budget * 4;
	return Math.min(100, Math.max(0, Math.round((totalFriction / MAX_EXPECTED_FRICTION) * 100)));
}

export function calculateDailyQuadrant(tasks: Task[]): number {
	if (!tasks.length) return 0;

	const diff = tasks.reduce((sum, t) => sum + t.difficulty, 0) / tasks.length;
	const enj = tasks.reduce((sum, t) => sum + t.enjoyment, 0) / tasks.length;

	if (diff >= 5.5 && enj >= 5.5) return 75;
	if (diff >= 5.5 && enj < 5.5) return 50;
	if (diff < 5.5 && enj >= 5.5) return 25;
	return 0;
}

export function calculateBudgetConvergence(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length) return 100;
	if (budget === 0) return 0;

	// Tasks with less time than a context switch are too fragmented
	const fragmentedTasks = activeTasks.filter((t) => t.suggestedHours < DEFAULT_SWITCH_COST).length;
	return Math.max(0, 100 - Math.round((fragmentedTasks / activeTasks.length) * 100));
}

/**
 * Calculate momentum: average net enjoyment across tasks
 *
 * Uses RAW user values (enjoyment - difficulty) because the Zenith mapped
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
		return sum + (task.enjoyment - task.difficulty);
	}, 0);

	return Math.round(totalNetEnjoyment / tasks.length);
}

export function calculateDeepWorkRatio(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!budget || !activeTasks.length) return 0;

	const deepHours = activeTasks
		.filter((t) => t.difficulty >= 7 && t.taskType === 'Cognitive')
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((deepHours / budget) * 100);
}

export function calculateQuickWins(activeTasks: SuggestedTask[]): number {
	return activeTasks.filter((t) => t.difficulty <= 3 && t.enjoyment >= 5).length;
}

export function calculateTaskVariety(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 100;
	const types = new Set(activeTasks.map((t) => t.taskType));
	return Math.round((types.size / 3) * 100);
}

/**
 * Calculate grind density: percentage of tasks where difficulty exceeds enjoyment
 *
 * Uses RAW user values (difficulty > enjoyment) because the Zenith mapped
 * ranges are asymmetric (E ∈ [1,5], β ∈ [1,2]) and would incorrectly flag
 * most tasks as "grinds" even when enjoyment > difficulty.
 *
 * A "grind" task is one where difficulty > enjoyment (feels like a chore).
 */
export function calculateGrindDensity(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;
	// Use raw values for intuitive user-facing metric
	const grindTasks = activeTasks.filter((t) => t.difficulty > t.enjoyment);
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
		.filter((t) => t.enjoyment >= t.difficulty)
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((sustainableHours / budget) * 100);
}

export function calculateRecoveryRatio(activeTasks: SuggestedTask[]): string {
	if (!activeTasks.length) return 'N/A';

	const hardTasks = activeTasks.filter((t) => t.difficulty >= 7).length;
	const easyTasks = activeTasks.filter((t) => t.difficulty <= 4).length;

	if (hardTasks === 0) return 'No strain';
	if (easyTasks === 0 && hardTasks > 0) return '0:' + hardTasks;
	return easyTasks + ':' + hardTasks;
}

export function calculateAverageDifficulty(tasks: Task[]): number {
	if (!tasks.length) return 0;
	return Math.round(tasks.reduce((sum, task) => sum + task.difficulty, 0) / tasks.length);
}

export function calculateAverageEnjoyment(tasks: Task[]): number {
	if (!tasks.length) return 0;
	return Math.round(tasks.reduce((sum, task) => sum + task.enjoyment, 0) / tasks.length);
}
