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

export function calculateFlowCoverage(activeTasks: SuggestedTask[]): {
	reached: number;
	total: number;
} {
	if (!activeTasks.length) return { reached: 0, total: 0 };
	const reached = activeTasks.filter((t) => t.suggestedHours >= t.flowStateTime).length;
	return { reached, total: activeTasks.length };
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

export function calculateBottleneckTask(activeTasks: SuggestedTask[]): string {
	if (!activeTasks.length) return 'None Detected';
	return activeTasks.reduce((worst, current) => {
		const worstRatio = worst.difficulty / (worst.enjoyment || 1);
		const currentRatio = current.difficulty / (current.enjoyment || 1);
		return currentRatio > worstRatio ? current : worst;
	}).title;
}

export function calculateTimeScarcity(tasks: Task[], availableHours: number): number {
	const budget = Number(availableHours) || 0;
	if (!tasks.length) return 0;
	if (budget === 0) return 100;

	const totalDemand = tasks.reduce((sum, t) => sum + Math.sqrt(t.difficulty), 0);
	const demandPerHour = totalDemand / budget;

	return Math.min(100, Math.max(0, Math.round(demandPerHour * 10)));
}

export function calculateBurnoutRisk(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;

	const totalNetStrain = activeTasks.reduce((sum, t) => {
		const strainFactor = t.trueEffort / t.trueEnjoyability;
		const netStrain = Math.max(0, strainFactor - 2);
		return sum + netStrain * t.suggestedHours;
	}, 0);

	return Math.min(100, Math.round((totalNetStrain / 3) * 100));
}

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

export function calculateFrictionIndex(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!activeTasks.length || !budget) return 0;

	const totalFriction = activeTasks.reduce((sum, t) => {
		const gap = t.difficulty - t.enjoyment;
		return sum + (gap > 0 ? gap * t.suggestedHours : 0);
	}, 0);

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

	const fragmentedTasks = activeTasks.filter((t) => t.suggestedHours < 0.25).length;
	return Math.max(0, 100 - Math.round((fragmentedTasks / activeTasks.length) * 100));
}

export function calculateMomentum(tasks: Task[]): number {
	if (!tasks.length) return 0;
	return Math.round(
		tasks.reduce((sum, task) => sum + task.enjoyment - task.difficulty, 0) / tasks.length
	);
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

export function calculateGrindDensity(activeTasks: SuggestedTask[]): number {
	if (!activeTasks.length) return 0;
	const grindTasks = activeTasks.filter((t) => t.difficulty > t.enjoyment);
	return Math.round((grindTasks.length / activeTasks.length) * 100);
}

export function calculateRewardDensity(
	activeTasks: SuggestedTask[],
	availableHours: number
): number {
	const budget = Number(availableHours) || 0;
	if (!budget || !activeTasks.length) return 0;

	const rewardingHours = activeTasks
		.filter((t) => t.enjoyment >= 6)
		.reduce((sum, t) => sum + t.suggestedHours, 0);
	return Math.round((rewardingHours / budget) * 100);
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
