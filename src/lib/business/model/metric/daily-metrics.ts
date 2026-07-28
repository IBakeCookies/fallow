/**
 * The whole dashboard in one call: the day's plan plus every derived metric,
 * computed from one consistent set of inputs.
 *
 * This exists so the main page doesn't have to. Each metric below is scoped to
 * a specific task set (all tasks vs. only the open ones) and that choice is
 * load-bearing math (MATH.md §11.7/§11.8) — a page that wires up twenty-five
 * calls by hand can silently mix the two, and nothing can unit-test it there.
 * Numbers only: labels, thresholds and colors are presentation policy and live
 * in `$lib/presentation/utils/metric-descriptor`.
 */

import type { CapacityPools, FitPosterior, UserConstants } from '$lib/business/model/zenith';
import type { EnergyParams } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';
import {
	calculateAverageEnjoyment,
	calculateAverageMentalDifficulty,
	calculateAveragePhysicalDifficulty,
	calculateBottleneckTask,
	calculateBurnoutRisk,
	calculateCognitiveLoad,
	calculateCompletionRate,
	calculateDailyQuadrant,
	calculateDeepWorkRatio,
	calculateEnergyBalance,
	calculateFlowCoverage,
	calculateFrictionIndex,
	calculateGrindDensity,
	calculateHumanCapacity,
	calculateInterleavedOrder,
	calculateMomentum,
	calculatePhysicalLoad,
	calculateQuickWins,
	calculateRecoveryRatio,
	calculateRewardDensity,
	calculateScheduleIntegrity,
	calculateTaskPlan,
	calculateTaskVariety,
	calculateTimeScarcity,
	calculateYieldIndex,
	calculateZenithGain,
	type DailyQuadrant,
	type SuggestedTask,
	type ZenithGain,
} from '$lib/business/model/metric/calculation';

export interface DailyMetricsInput {
	tasks: Task[];
	availableHours: number;
	switchCost: number;
	pools: CapacityPools;
	constants: UserConstants;
	/** Makes the allocator hedge ϕ-uncertainty (MATH.md §5.1). */
	posterior?: FitPosterior;
	/** Energy params for Burnout Risk — defaults refined by the user's logs. */
	energyParams: EnergyParams;
}

export interface DailyMetrics {
	// ----- The plan -----
	suggestedTasks: SuggestedTask[];
	activeTasks: SuggestedTask[];
	/** Task id → 1-based position in the suggested run order. */
	runOrder: Map<number, number>;
	/** Hours the plan deliberately leaves unspent (optimal stopping + pools). */
	planSlackHours: number;
	remainingSuggestedHours: number;
	totalTasks: number;
	completedTasks: number;
	budgetHours: number;

	// ----- Metrics -----
	zenithGain: ZenithGain;
	completionRate: number;
	yieldIndex: number;
	flowCoverage: { reached: number; total: number };
	humanCapacity: ReturnType<typeof calculateHumanCapacity>;
	bottleneckTask: string;
	timeScarcity: number;
	burnoutRisk: number;
	cognitiveLoad: number;
	physicalLoad: number;
	energyBalance: number;
	frictionIndex: number;
	dailyQuadrant: DailyQuadrant;
	scheduleIntegrity: number;
	momentum: number;
	deepWorkRatio: number;
	quickWins: number;
	taskVariety: number;
	grindDensity: number;
	rewardDensity: number;
	recoveryRatio: string;
	averagePhysicalDifficulty: number;
	averageMentalDifficulty: number;
	averageEnjoyment: number;
}

export function calculateDailyMetrics(input: DailyMetricsInput): DailyMetrics {
	const { tasks, availableHours, switchCost, pools, constants, posterior, energyParams } = input;

	// One solve for the whole dashboard. Zenith Gain describes this same plan, so
	// it is handed the allocation rather than re-deriving it: the enumeration is
	// ~55ms at n = 12 and this runs inside a `$derived`, i.e. on every keystroke
	// in the budget field — and once more per candidate when the advisor
	// re-solves the day (MATH.md §14).
	const { suggestedTasks, allocatedHours } = calculateTaskPlan(
		tasks,
		availableHours,
		switchCost,
		pools,
		constants,
		posterior,
	);

	const activeTasks = suggestedTasks.filter((task) => !task.completed);
	// Switch overhead counts only tasks that actually received time, matching
	// the allocator.
	const budget = Number(availableHours) || 0;
	const fundedCount = suggestedTasks.filter((task) => task.suggestedHours > 0).length;
	const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;
	const allocated = suggestedTasks.reduce((sum, task) => sum + task.suggestedHours, 0);
	const planSlackHours = Math.max(0, Math.max(0, budget - overhead) - allocated);
	const cognitiveLoad = calculateCognitiveLoad(suggestedTasks, availableHours);
	const physicalLoad = calculatePhysicalLoad(suggestedTasks, availableHours);

	return {
		suggestedTasks,
		activeTasks,
		// Alternates cognitive/physical tasks so the resting energy system
		// recovers (dual-pool model).
		runOrder: new Map(calculateInterleavedOrder(activeTasks).map((task, i) => [task.id, i + 1])),
		planSlackHours,
		remainingSuggestedHours: activeTasks.reduce((sum, task) => sum + task.suggestedHours, 0),
		totalTasks: tasks.length,
		completedTasks: tasks.filter((task) => task.completed).length,
		budgetHours: budget,

		// Task-set split: metrics describing the DAY'S PLAN take suggestedTasks
		// (all tasks — completing one must not move them, since its hours stay
		// allocated), while remaining-work metrics take activeTasks. Feeding
		// activeTasks against the full budget/pools mixes scopes: e.g. burnout
		// risk ROSE when a task was checked done (its T* left the overhang sum
		// but the budget didn't shrink).
		zenithGain: calculateZenithGain(
			tasks,
			availableHours,
			switchCost,
			pools,
			constants,
			posterior,
			allocatedHours,
		),
		completionRate: calculateCompletionRate(suggestedTasks),
		yieldIndex: calculateYieldIndex(suggestedTasks),
		flowCoverage: calculateFlowCoverage(suggestedTasks),
		humanCapacity: calculateHumanCapacity(suggestedTasks, pools),
		bottleneckTask: calculateBottleneckTask(activeTasks),
		timeScarcity: calculateTimeScarcity(tasks, availableHours, switchCost, constants),
		// Simulates the planned day through the reservoir law (MATH.md §11.6).
		burnoutRisk: calculateBurnoutRisk(suggestedTasks, availableHours, switchCost, energyParams),
		cognitiveLoad,
		physicalLoad,
		energyBalance: calculateEnergyBalance(cognitiveLoad, physicalLoad),
		frictionIndex: calculateFrictionIndex(suggestedTasks),
		dailyQuadrant: calculateDailyQuadrant(tasks),
		scheduleIntegrity: calculateScheduleIntegrity(suggestedTasks, availableHours, switchCost),
		// Momentum and quick wins are deliberately active-scoped ("what's ahead"):
		// completing a task removes it, so they respond as the day progresses
		// (2026-07-20, MATH.md §11.7).
		momentum: calculateMomentum(activeTasks),
		deepWorkRatio: calculateDeepWorkRatio(suggestedTasks, availableHours),
		quickWins: calculateQuickWins(activeTasks),
		taskVariety: calculateTaskVariety(suggestedTasks),
		grindDensity: calculateGrindDensity(suggestedTasks),
		rewardDensity: calculateRewardDensity(suggestedTasks, availableHours),
		recoveryRatio: calculateRecoveryRatio(suggestedTasks),
		averagePhysicalDifficulty: calculateAveragePhysicalDifficulty(tasks),
		averageMentalDifficulty: calculateAverageMentalDifficulty(tasks),
		averageEnjoyment: calculateAverageEnjoyment(tasks),
	};
}
