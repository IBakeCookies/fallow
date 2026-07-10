<script lang="ts">
	import { browser } from '$app/environment';
	import * as Card from '$lib/components/ui/card';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Badge } from '$lib/components/ui/badge';
	import { calculateTaskAllocations, productivityGain, DEFAULT_USER_CONSTANTS } from '$lib/zenith';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import TaskItem from '$lib/components/TaskItem.svelte';
	import type { TaskType } from '$lib/types/business/taskType';

	type Task = {
		id: number;
		title: string;
		difficulty: number;
		enjoyment: number;
		taskType: TaskType;
		createdAt: string;
		completed: boolean;
	};

	const storageKey = 'zenith-daily-tasks';

	let initialStorage = { tasks: [], availableHours: 0 };
	let isLoadingTasks = $state(true);

	if (browser) {
		try {
			const stored = localStorage.getItem(storageKey);
			if (stored) initialStorage = JSON.parse(stored);
		} catch (e) {
			console.error('Failed to parse localStorage', e);
		} finally {
			isLoadingTasks = false;
		}
	}

	let tasks = $state<Task[]>(initialStorage.tasks || []);
	let availableHours = $state<number>(initialStorage.availableHours || 0);

	const STATUS = {
		SUCCESS: { label: 'Optimal', color: 'text-indigo-400' },
		NEUTRAL: { label: 'Nominal', color: 'text-zinc-200' },
		WARNING: { label: 'Caution', color: 'text-amber-400' },
		CRITICAL: { label: 'Critical', color: 'text-red-400' }
	};

	function getStatusBiggerBetter(val: number) {
		if (val >= 75) return STATUS.SUCCESS;
		if (val >= 50) return STATUS.NEUTRAL;
		if (val >= 25) return STATUS.WARNING;
		return STATUS.CRITICAL;
	}

	function getStatusSmallerBetter(val: number) {
		if (val <= 25) return STATUS.SUCCESS;
		if (val <= 50) return STATUS.NEUTRAL;
		if (val <= 75) return STATUS.WARNING;
		return STATUS.CRITICAL;
	}

	const today = new Date().toISOString().slice(0, 10);

	const totalTasks = $derived(tasks.length);
	const completedTasks = $derived(tasks.filter((task) => task.completed).length);

	// Use Zenith algorithm for optimal time allocation
	const suggestedTasks = $derived.by(() => {
		const budget = Number(availableHours) || 0;

		if (tasks.length === 0) return [];

		// Convert tasks to Zenith input format
		const taskInputs = tasks.map((task) => ({
			title: task.title,
			difficulty: task.difficulty,
			enjoyment: task.enjoyment
		}));

		// Get optimal allocations from Zenith algorithm
		const allocations = calculateTaskAllocations(taskInputs, budget, DEFAULT_USER_CONSTANTS);

		// Merge allocations back with full task data
		return tasks
			.map((task, index) => {
				const alloc = allocations[index];
				return {
					...task,
					suggestedHours: alloc.allocatedHours,
					// Priority score based on flow potential (high difficulty + high enjoyment)
					priorityScore: Number((alloc.avgProductivity * 10).toFixed(1)),
					// Zenith-specific metrics
					flowStateTime: alloc.phi, // Time to reach flow state (hours)
					trueEffort: alloc.E,
					trueEnjoyability: alloc.beta,
					peakProductivity: alloc.peakProductivity,
					avgProductivity: alloc.avgProductivity
				};
			})
			.sort((a, b) => b.priorityScore - a.priorityScore);
	});

	// Productivity gain from Zenith vs naive allocation
	const zenithGain = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (tasks.length === 0 || budget <= 0) return { optimized: 0, naive: 0, gainPercent: 0 };

		const taskInputs = tasks.map((task) => ({
			title: task.title,
			difficulty: task.difficulty,
			enjoyment: task.enjoyment
		}));

		return productivityGain(taskInputs, budget, DEFAULT_USER_CONSTANTS);
	});

	const activeTasks = $derived(suggestedTasks.filter((t) => !t.completed));

	const remainingSuggestedHours = $derived(
		activeTasks.reduce((sum, task) => sum + task.suggestedHours, 0).toFixed(2)
	);

	const completionRate = $derived.by(() => {
		if (!completedTasks || !suggestedTasks.length) return 0;

		const totalPossiblePriority = suggestedTasks.reduce((sum, t) => sum + t.priorityScore, 0);
		const actualCompletedPriority = suggestedTasks
			.filter((t) => t.completed)
			.reduce((sum, t) => sum + t.priorityScore, 0);

		if (!totalPossiblePriority) return 0;
		return Math.round((actualCompletedPriority / totalPossiblePriority) * 100);
	});

	const yieldIndex = $derived.by(() => {
		if (!completedTasks) return 0;

		const maxPossiblePriority = suggestedTasks
			.slice(0, Math.max(1, completedTasks))
			.reduce((sum, t) => sum + t.priorityScore, 0);

		const actualCompletedPriority = suggestedTasks
			.filter((t) => t.completed)
			.reduce((sum, t) => sum + t.priorityScore, 0);

		if (!maxPossiblePriority) return 0;
		return Math.min(100, Math.round((actualCompletedPriority / maxPossiblePriority) * 100));
	});

	// Flow Coverage: count of tasks that reach flow state (t ≥ ϕ)
	const flowCoverage = $derived.by(() => {
		if (!activeTasks.length) return { reached: 0, total: 0 };
		const reached = activeTasks.filter((t) => t.suggestedHours >= t.flowStateTime).length;
		return { reached, total: activeTasks.length };
	});

	// Human Capacity: biological limits on productive work
	// Cognitive: ~4h/day (Cal Newport, Anders Ericsson research)
	// Physical: ~6h/day (occupational health research)
	const humanCapacity = $derived.by(() => {
		if (!activeTasks.length) return { percent: 0, limitType: 'none' };

		// Calculate cognitive demand (full for COG, half for Hybrid)
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

		const cogSaturation = Math.round((cogDemand / 4) * 100); // 4h limit
		const physSaturation = Math.round((physDemand / 6) * 100); // 6h limit

		// Report the binding constraint
		if (cogSaturation >= physSaturation) {
			return { percent: cogSaturation, limitType: 'cognitive' };
		}
		return { percent: physSaturation, limitType: 'physical' };
	});

	const bottleneckTask = $derived.by(() => {
		if (!activeTasks.length) return 'None Detected';
		return activeTasks.reduce((worst, current) => {
			const worstRatio = worst.difficulty / (worst.enjoyment || 1);
			const currentRatio = current.difficulty / (current.enjoyment || 1);
			return currentRatio > worstRatio ? current : worst;
		}).title;
	});

	// Time Scarcity: ratio of task demand to available hours
	// Higher = too many/hard tasks for the time budget
	const timeScarcity = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!totalTasks) return 0;
		if (budget === 0) return 100;

		const totalDemand = tasks.reduce((sum, t) => sum + Math.sqrt(t.difficulty), 0);
		const demandPerHour = totalDemand / budget;

		// Scale: 0-10 demand/hour maps to 0-100%
		return Math.min(100, Math.max(0, Math.round(demandPerHour * 10)));
	});

	const burnoutRisk = $derived.by(() => {
		if (!activeTasks.length) return 0;

		// Use Zenith model: strain = E/β (inverse of initial productivity p₀ = β/E)
		// Average E/β ≈ 2 across all possible inputs, so baseline = 2
		// Tasks with E/β > 2 are above-average strain
		const totalNetStrain = activeTasks.reduce((sum, t) => {
			const strainFactor = t.trueEffort / t.trueEnjoyability; // E/β = 1/p₀
			const netStrain = Math.max(0, strainFactor - 2); // Only count above-average strain
			return sum + netStrain * t.suggestedHours;
		}, 0);

		// Scale to 0-100%: 3 net-strain-hours = 100% burnout risk
		return Math.min(100, Math.round((totalNetStrain / 3) * 100));
	});

	const cognitiveLoad = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!activeTasks.length || !budget) return 0;

		const mentalHours = activeTasks
			.filter((t) => t.taskType === 'Cognitive' || t.taskType === 'Hybrid')
			.reduce((sum, t) => sum + t.suggestedHours * (t.taskType === 'Cognitive' ? 1 : 0.5), 0);

		return Math.min(100, Math.round((mentalHours / budget) * 100));
	});

	const physicalLoad = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!activeTasks.length || !budget) return 0;

		const physicalHours = activeTasks
			.filter((t) => t.taskType === 'Physical' || t.taskType === 'Hybrid')
			.reduce((sum, t) => sum + t.suggestedHours * (t.taskType === 'Physical' ? 1 : 0.5), 0);

		return Math.min(100, Math.round((physicalHours / budget) * 100));
	});

	const energyBalance = $derived.by(() => {
		// 50 = perfectly balanced, <50 = physical heavy, >50 = mental heavy
		if (!activeTasks.length) return 50;
		const mentalWeight = cognitiveLoad;
		const physicalWeight = physicalLoad;
		const total = mentalWeight + physicalWeight;
		if (!total) return 50;
		return Math.round((mentalWeight / total) * 100);
	});

	const frictionIndex = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!activeTasks.length || !budget) return 0;

		const totalFriction = activeTasks.reduce((sum, t) => {
			const gap = t.difficulty - t.enjoyment;
			return sum + (gap > 0 ? gap * t.suggestedHours : 0);
		}, 0);

		// Dynamic max friction: Assumes a "bad" day averages a gap of 4 across all hours
		const MAX_EXPECTED_FRICTION = budget * 4;

		return Math.min(100, Math.max(0, Math.round((totalFriction / MAX_EXPECTED_FRICTION) * 100)));
	});

	const dailyQuadrant = $derived.by(() => {
		if (!totalTasks) return 0; // 'Unallocated'

		const diff = tasks.reduce((sum, t) => sum + t.difficulty, 0) / totalTasks;
		const enj = tasks.reduce((sum, t) => sum + t.enjoyment, 0) / totalTasks;

		if (diff >= 5.5 && enj >= 5.5) return 75; // 'Optimal State'
		if (diff >= 5.5 && enj < 5.5) return 50; // 'High Expenditure'
		if (diff < 5.5 && enj >= 5.5) return 25; // 'Low Strain'
		return 0; // 'Suboptimal'
	});

	const budgetConvergence = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!totalTasks || !activeTasks.length) return 100; // No tasks to schedule
		if (budget === 0) return 0; // Tasks exist but no time budget allocated

		const fragmentedTasks = activeTasks.filter((t) => t.suggestedHours < 0.25).length;
		const convergenceScore = Math.max(
			0,
			100 - Math.round((fragmentedTasks / activeTasks.length) * 100)
		);
		return convergenceScore;
	});

	const momentum = $derived(
		totalTasks
			? Math.round(
					tasks.reduce((sum, task) => sum + task.enjoyment - task.difficulty, 0) / totalTasks
				)
			: 0
	);

	// Deep Work Ratio: % of time on high-difficulty cognitive tasks
	const deepWorkRatio = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!budget || !activeTasks.length) return 0;

		const deepHours = activeTasks
			.filter((t) => t.difficulty >= 7 && t.taskType === 'Cognitive')
			.reduce((sum, t) => sum + t.suggestedHours, 0);
		return Math.round((deepHours / budget) * 100);
	});

	// Quick Wins: count of easy, enjoyable tasks for momentum building
	const quickWins = $derived(
		activeTasks.filter((t) => t.difficulty <= 3 && t.enjoyment >= 5).length
	);

	// Task Variety: diversity of task types (prevents cognitive fatigue)
	const taskVariety = $derived.by(() => {
		if (!activeTasks.length) return 100;
		const types = new Set(activeTasks.map((t) => t.taskType));
		return Math.round((types.size / 3) * 100); // 3 possible types
	});

	// Grind Density: % of tasks where difficulty exceeds enjoyment
	const grindDensity = $derived.by(() => {
		if (!activeTasks.length) return 0;
		const grindTasks = activeTasks.filter((t) => t.difficulty > t.enjoyment);
		return Math.round((grindTasks.length / activeTasks.length) * 100);
	});

	// Reward Density: % of time on enjoyable tasks (enjoyment >= 6)
	// Research suggests 40-60% rewarding work is sustainable
	const rewardDensity = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!budget || !activeTasks.length) return 0;

		const rewardingHours = activeTasks
			.filter((t) => t.enjoyment >= 6)
			.reduce((sum, t) => sum + t.suggestedHours, 0);
		return Math.round((rewardingHours / budget) * 100);
	});

	// Recovery Ratio: ratio of low-effort tasks to high-effort tasks
	// Ultradian rhythm research suggests ~1 recovery per 2-3 hard tasks
	const recoveryRatio = $derived.by(() => {
		if (!activeTasks.length) return 'N/A';

		const hardTasks = activeTasks.filter((t) => t.difficulty >= 7).length;
		const easyTasks = activeTasks.filter((t) => t.difficulty <= 4).length;

		if (hardTasks === 0) return 'No strain';
		if (easyTasks === 0 && hardTasks > 0) return '0:' + hardTasks;
		return easyTasks + ':' + hardTasks;
	});

	const averageDifficulty = $derived(
		totalTasks ? Math.round(tasks.reduce((sum, task) => sum + task.difficulty, 0) / totalTasks) : 0
	);

	const averageEnjoyment = $derived(
		totalTasks ? Math.round(tasks.reduce((sum, task) => sum + task.enjoyment, 0) / totalTasks) : 0
	);

	// Key insights - most important metrics shown prominently
	const keyInsights = $derived([
		{
			label: 'Zenith Gain',
			value: zenithGain.gainPercent,
			displayValue: `+${zenithGain.gainPercent}%`,
			description:
				'Productivity improvement from Zenith optimization vs. naive equal time split. Based on the Lagrange multiplier solution.',
			status:
				zenithGain.gainPercent >= 15
					? 'success'
					: zenithGain.gainPercent >= 5
						? 'neutral'
						: 'warning',
			showProgress: true,
			maxValue: 50
		},
		{
			label: 'Completion Rate',
			value: completionRate,
			displayValue: `${completionRate}%`,
			description:
				'Priority-weighted progress. High-value tasks contribute more to this percentage than low-priority ones.',
			status: completionRate >= 75 ? 'success' : completionRate >= 50 ? 'neutral' : 'warning',
			showProgress: true,
			maxValue: 100
		},
		{
			label: 'Burnout Risk',
			value: burnoutRisk,
			displayValue: `${burnoutRisk}%`,
			description:
				'Based on Zenith strain ratio (E/β). Tasks where effort exceeds enjoyability accumulate net drain. 3 strain-hours = 100% risk.',
			status:
				burnoutRisk <= 25
					? 'success'
					: burnoutRisk <= 50
						? 'neutral'
						: burnoutRisk <= 75
							? 'warning'
							: 'critical',
			showProgress: true,
			maxValue: 100
		},
		{
			label: 'Flow Coverage',
			value:
				flowCoverage.total > 0 ? Math.round((flowCoverage.reached / flowCoverage.total) * 100) : 0,
			displayValue: `${flowCoverage.reached}/${flowCoverage.total}`,
			description:
				'Tasks that reach flow state (allocated time ≥ ϕ). Low coverage means too many tasks for budget — drop tasks or add hours.',
			status:
				flowCoverage.total === 0
					? 'neutral'
					: flowCoverage.reached === flowCoverage.total
						? 'success'
						: flowCoverage.reached >= flowCoverage.total / 2
							? 'neutral'
							: 'warning',
			showProgress: true,
			maxValue: 100
		}
	]);

	// Categorized metrics for collapsible sections
	const metricCategories = $derived([
		{
			id: 'performance',
			title: 'Performance',
			icon: '📊',
			metrics: [
				{
					label: 'Yield Index',
					value: `${yieldIndex}%`,
					numericValue: yieldIndex,
					description:
						'Did you complete the highest-priority tasks? Compares your completed work against the optimal selection.',
					status: getStatusBiggerBetter(yieldIndex)
				},
				{
					label: 'Schedule Integrity',
					value: `${budgetConvergence}%`,
					numericValue: budgetConvergence,
					description:
						'Detects fragmentation. Drops if tasks get less than 15 minutes, or if no time budget is set.',
					status: getStatusBiggerBetter(budgetConvergence)
				},
				{
					label: 'Day Profile',
					value:
						dailyQuadrant >= 75
							? 'Flow Zone'
							: dailyQuadrant >= 50
								? 'Grind Mode'
								: dailyQuadrant >= 25
									? 'Cruise'
									: 'Routine',
					description:
						"Your day's character based on average difficulty and enjoyment. Flow Zone = challenging and engaging, Grind Mode = demanding work, Cruise = light and enjoyable, Routine = low-key tasks.",
					status: STATUS.NEUTRAL
				},
				{
					label: 'Avg Difficulty',
					value: `${averageDifficulty}/10`,
					numericValue: averageDifficulty * 10,
					description:
						'Average difficulty across all tasks. Higher values indicate more challenging workload.',
					status: STATUS.NEUTRAL
				},
				{
					label: 'Avg Enjoyment',
					value: `${averageEnjoyment}/10`,
					numericValue: averageEnjoyment * 10,
					description:
						'Average enjoyment across all tasks. Higher values indicate more engaging work.',
					status: STATUS.NEUTRAL
				}
			]
		},
		{
			id: 'energy',
			title: 'Energy & Sustainability',
			icon: '⚡',
			metrics: [
				{
					label: 'Human Capacity',
					value: `${humanCapacity.percent}%`,
					numericValue: humanCapacity.percent,
					description: `${humanCapacity.limitType === 'cognitive' ? 'Cognitive' : 'Physical'} limit (${humanCapacity.limitType === 'cognitive' ? '4h' : '6h'}/day). >100% exceeds sustainable human performance.`,
					status:
						humanCapacity.percent <= 75
							? STATUS.SUCCESS
							: humanCapacity.percent <= 100
								? STATUS.NEUTRAL
								: STATUS.CRITICAL
				},
				{
					label: 'Cognitive Load',
					value: `${cognitiveLoad}%`,
					numericValue: cognitiveLoad,
					description: 'Percentage of your day allocated to mental/cognitive tasks.',
					status: getStatusSmallerBetter(cognitiveLoad > 70 ? cognitiveLoad : 0)
				},
				{
					label: 'Physical Load',
					value: `${physicalLoad}%`,
					numericValue: physicalLoad,
					description: 'Percentage of your day allocated to physical tasks.',
					status: getStatusSmallerBetter(physicalLoad > 70 ? physicalLoad : 0)
				},
				{
					label: 'Energy Balance',
					value:
						energyBalance > 60
							? 'Cognitive Heavy'
							: energyBalance < 40
								? 'Physical Heavy'
								: 'Balanced',
					description:
						'Distribution of cognitive vs physical work. Alternating types extends total productive hours.',
					status: energyBalance > 60 || energyBalance < 40 ? STATUS.WARNING : STATUS.SUCCESS
				},
				{
					label: 'Recovery Ratio',
					value: recoveryRatio,
					description:
						'Easy tasks (≤4) per hard tasks (≥7). Aim for 1:2 or 1:3 ratio for ultradian rhythm recovery.',
					status:
						recoveryRatio === 'No strain' || recoveryRatio === 'N/A'
							? STATUS.NEUTRAL
							: recoveryRatio.startsWith('0:')
								? STATUS.WARNING
								: STATUS.SUCCESS
				}
			]
		},
		{
			id: 'focus',
			title: 'Flow & Focus',
			icon: '🎯',
			metrics: [
				{
					label: 'Deep Work',
					value: `${deepWorkRatio}%`,
					numericValue: deepWorkRatio,
					description:
						'Percentage of time allocated to high-difficulty cognitive tasks requiring sustained focus.',
					status: getStatusBiggerBetter(deepWorkRatio)
				},
				{
					label: 'Task Variety',
					value: `${taskVariety}%`,
					numericValue: taskVariety,
					description:
						'Diversity of task types (Cognitive/Physical/Hybrid). Mixing types prevents fatigue.',
					status: getStatusBiggerBetter(taskVariety)
				},
				{
					label: 'Quick Wins',
					value: `${quickWins}`,
					description:
						'Count of easy, enjoyable tasks available for momentum building and motivation boosts.',
					status: quickWins > 0 ? STATUS.SUCCESS : STATUS.NEUTRAL
				}
			]
		},
		{
			id: 'time',
			title: 'Time Management',
			icon: '⏱️',
			metrics: [
				{
					label: 'Time Scarcity',
					value: `${timeScarcity}%`,
					numericValue: timeScarcity,
					description:
						'How stretched is your time budget? Higher values mean too many tasks for the hours available.',
					status: getStatusSmallerBetter(timeScarcity)
				},
				{
					label: 'Primary Bottleneck',
					value: bottleneckTask,
					description:
						'The active task displaying the worst friction (highest difficulty relative to enjoyment).',
					status: bottleneckTask !== 'None Detected' ? STATUS.WARNING : STATUS.NEUTRAL
				}
			]
		},
		{
			id: 'analysis',
			title: 'Task Analysis',
			icon: '🔬',
			metrics: [
				{
					label: 'Friction Index',
					value: `${frictionIndex}%`,
					numericValue: frictionIndex,
					description:
						'Measures structural day resistance based on tasks with high difficulty but low enjoyment.',
					status: getStatusSmallerBetter(frictionIndex)
				},
				{
					label: 'Grind Density',
					value: `${grindDensity}%`,
					numericValue: grindDensity,
					description:
						'Percentage of tasks where difficulty exceeds enjoyment. High values signal willpower drain.',
					status: getStatusSmallerBetter(grindDensity)
				},
				{
					label: 'Reward Density',
					value: `${rewardDensity}%`,
					numericValue: rewardDensity,
					description:
						'Percentage of time on enjoyable tasks (≥6). Sustainable productivity needs 40-60% rewarding work.',
					status:
						rewardDensity >= 40 && rewardDensity <= 70
							? STATUS.SUCCESS
							: rewardDensity < 40
								? STATUS.WARNING
								: STATUS.NEUTRAL
				}
			]
		}
	]);

	// Legacy flat metrics array (kept for compatibility)
	const metrics = $derived([
		{
			label: 'Zenith Gain',
			value: `+${zenithGain.gainPercent}%`,
			description:
				'Productivity improvement from Zenith optimization vs. naive equal time split. Based on the Lagrange multiplier solution.',
			valStyle:
				zenithGain.gainPercent >= 15
					? STATUS.SUCCESS.color
					: zenithGain.gainPercent >= 5
						? STATUS.NEUTRAL.color
						: STATUS.WARNING.color
		},
		{
			label: 'Yield Index',
			value: `${yieldIndex}%`,
			description:
				'Did you complete the highest-priority tasks? Compares your completed work against the optimal selection.',
			valStyle: getStatusBiggerBetter(yieldIndex).color
		},
		{
			label: 'Completion Rate',
			value: `${completionRate}%`,
			description:
				'Priority-weighted progress. High-value tasks contribute more to this percentage than low-priority ones.',
			valStyle: getStatusBiggerBetter(completionRate).color
		},
		{
			label: 'Flow Coverage',
			value: `${flowCoverage.reached}/${flowCoverage.total}`,
			description:
				'Tasks that reach flow state (allocated time ≥ ϕ). Low coverage means too many tasks for budget — drop tasks or add hours.',
			valStyle:
				flowCoverage.total === 0
					? STATUS.NEUTRAL.color
					: flowCoverage.reached === flowCoverage.total
						? STATUS.SUCCESS.color
						: flowCoverage.reached >= flowCoverage.total / 2
							? STATUS.NEUTRAL.color
							: STATUS.WARNING.color
		},
		{
			label: 'Human Capacity',
			value: `${humanCapacity.percent}%`,
			description: `${humanCapacity.limitType === 'cognitive' ? 'Cognitive' : 'Physical'} limit (${humanCapacity.limitType === 'cognitive' ? '4h' : '6h'}/day). >100% exceeds sustainable human performance.`,
			valStyle:
				humanCapacity.percent <= 75
					? STATUS.SUCCESS.color
					: humanCapacity.percent <= 100
						? STATUS.NEUTRAL.color
						: STATUS.CRITICAL.color
		},
		{
			label: 'Time Scarcity',
			value: `${timeScarcity}%`,
			description:
				'How stretched is your time budget? Higher values mean too many tasks for the hours available.',
			valStyle: getStatusSmallerBetter(timeScarcity).color
		},
		{
			label: 'Primary Bottleneck',
			value: bottleneckTask,
			description:
				'The active task displaying the worst friction (highest difficulty relative to enjoyment).',
			valStyle: bottleneckTask !== 'None Detected' ? STATUS.WARNING.color : STATUS.NEUTRAL.color
		},
		{
			label: 'Burnout Risk',
			value: `${burnoutRisk}%`,
			description:
				'Based on Zenith strain ratio (E/β). Only above-average strain (E/β > 2) accumulates. 3 strain-hours = 100% risk.',
			valStyle: getStatusSmallerBetter(burnoutRisk).color
		},
		{
			label: 'Cognitive Load',
			value: `${cognitiveLoad}%`,
			description: 'Percentage of your day allocated to mental/cognitive tasks.',
			valStyle: getStatusSmallerBetter(cognitiveLoad > 70 ? cognitiveLoad : 0).color
		},
		{
			label: 'Physical Load',
			value: `${physicalLoad}%`,
			description: 'Percentage of your day allocated to physical tasks.',
			valStyle: getStatusSmallerBetter(physicalLoad > 70 ? physicalLoad : 0).color
		},
		{
			label: 'Energy Balance',
			value:
				energyBalance > 60 ? 'Cognitive Heavy' : energyBalance < 40 ? 'Physical Heavy' : 'Balanced',
			description:
				'Distribution of Cognitive vs physical work. Alternating types extends total productive hours.',
			valStyle:
				energyBalance > 60 || energyBalance < 40 ? STATUS.WARNING.color : STATUS.SUCCESS.color
		},
		{
			label: 'Schedule Integrity',
			value: `${budgetConvergence}%`,
			description:
				'Detects fragmentation. Drops if tasks get less than 15 minutes, or if no time budget is set.',
			valStyle: getStatusBiggerBetter(budgetConvergence).color
		},
		{
			label: 'Friction Index',
			value: `${frictionIndex}%`,
			description:
				'Measures structural day resistance based on tasks with high difficulty but low enjoyment.',
			valStyle: getStatusSmallerBetter(frictionIndex).color
		},
		{
			label: 'Deep Work',
			value: `${deepWorkRatio}%`,
			description:
				'Percentage of time allocated to high-difficulty cognitive tasks requiring sustained focus.',
			valStyle: getStatusBiggerBetter(deepWorkRatio).color
		},
		{
			label: 'Quick Wins',
			value: `${quickWins}`,
			description:
				'Count of easy, enjoyable tasks available for momentum building and motivation boosts.',
			valStyle: quickWins > 0 ? STATUS.SUCCESS.color : STATUS.NEUTRAL.color
		},
		{
			label: 'Task Variety',
			value: `${taskVariety}%`,
			description:
				'Diversity of task types (Cognitive/Physical/Hybrid). Mixing types prevents fatigue.',
			valStyle: getStatusBiggerBetter(taskVariety).color
		},
		{
			label: 'Grind Density',
			value: `${grindDensity}%`,
			description:
				'Percentage of tasks where difficulty exceeds enjoyment. High values signal willpower drain.',
			valStyle: getStatusSmallerBetter(grindDensity).color
		},
		{
			label: 'Reward Density',
			value: `${rewardDensity}%`,
			description:
				'Percentage of time on enjoyable tasks (≥6). Sustainable productivity needs 40-60% rewarding work.',
			valStyle:
				rewardDensity >= 40 && rewardDensity <= 70
					? STATUS.SUCCESS.color
					: rewardDensity < 40
						? STATUS.WARNING.color
						: STATUS.NEUTRAL.color
		},
		{
			label: 'Recovery Ratio',
			value: recoveryRatio,
			description:
				'Easy tasks (≤4) per hard tasks (≥7). Aim for 1:2 or 1:3 ratio for ultradian rhythm recovery.',
			valStyle:
				recoveryRatio === 'No strain' || recoveryRatio === 'N/A'
					? STATUS.NEUTRAL.color
					: recoveryRatio.startsWith('0:')
						? STATUS.WARNING.color
						: STATUS.SUCCESS.color
		},
		{
			label: 'Day Profile',
			value:
				dailyQuadrant >= 75
					? 'Flow Zone'
					: dailyQuadrant >= 50
						? 'Grind Mode'
						: dailyQuadrant >= 25
							? 'Cruise'
							: 'Routine',
			description:
				"Your day's character based on average difficulty and enjoyment. Flow Zone = challenging and engaging, Grind Mode = demanding work, Cruise = light and enjoyable, Routine = low-key tasks.",
			valStyle: STATUS.NEUTRAL.color
		}
	]);

	function addTask(taskData: {
		title: string;
		difficulty: number;
		enjoyment: number;
		taskType: TaskType;
	}) {
		tasks = [
			{
				id: Date.now(),
				title: taskData.title,
				difficulty: taskData.difficulty,
				enjoyment: taskData.enjoyment,
				taskType: taskData.taskType,
				createdAt: today,
				completed: false
			},
			...tasks
		];
	}

	function toggleTask(id: number) {
		tasks = tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task));
	}

	function removeTask(id: number) {
		tasks = tasks.filter((task) => task.id !== id);
	}

	$effect(() => {
		if (browser) {
			localStorage.setItem(storageKey, JSON.stringify({ tasks, availableHours }));
		}
	});
</script>

<svelte:head>
	<title>Zenith Daily Tracker</title>
	<meta
		name="description"
		content="Track your daily tasks with difficulty and enjoyment scores inspired by the Zenith Gradient idea."
	/>
</svelte:head>

{#if !isLoadingTasks}
	<main
		class="min-h-screen bg-black/70 text-zinc-300 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 font-sans"
	>
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<!-- Header -->
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center gap-4">
					<h1 class="text-2xl font-bold text-zinc-100">Zenith</h1>
					<div class="flex items-center gap-2 text-sm text-zinc-400">
						<span class="font-medium text-zinc-200">{completedTasks}</span>/<span>{totalTasks}</span
						> tasks
					</div>
				</div>
			</div>

			<!-- Side-by-side layout -->
			<div class="grid gap-6 lg:grid-cols-3 items-start">
				<!-- Left: Tasks (2 cols) -->
				<div class="space-y-6 lg:col-span-2">
					<!-- Task Form -->
					<TaskForm onsubmit={addTask} />

					<!-- Task List -->
					<div
						class="space-y-2 rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl shadow-sm"
					>
						<h2 class="text-lg font-bold text-zinc-200">Tasks</h2>
						{#if suggestedTasks.length === 0}
							<div class="flex flex-col items-center justify-center py-12 text-center">
								<div class="text-zinc-600 mb-2">
									<svg
										class="w-12 h-12 mx-auto"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.5"
											d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
										/>
									</svg>
								</div>
								<p class="text-sm text-zinc-400">No tasks deployed yet</p>
								<p class="text-xs text-zinc-500 mt-1">Add a task above to begin tracking</p>
							</div>
						{/if}
						{#each suggestedTasks as task (task.id)}
							<TaskItem
								id={task.id}
								title={task.title}
								difficulty={task.difficulty}
								enjoyment={task.enjoyment}
								taskType={task.taskType}
								completed={task.completed}
								priorityScore={task.priorityScore}
								suggestedHours={task.suggestedHours}
								ontoggle={toggleTask}
								onremove={removeTask}
							/>
						{/each}
					</div>
				</div>

				<!-- Right: Time Budget + Metrics -->
				<div class="space-y-4 lg:sticky lg:top-8">
					<!-- Time Budget -->
					<Card.Root class="border-white/10 bg-white/3 backdrop-blur-xl">
						<Card.Header class="pb-2">
							<Card.Title class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
								Time Budget
							</Card.Title>
						</Card.Header>
						<Card.Content class="pt-0">
							<div class="relative">
								<input
									type="number"
									step="0.25"
									min="0"
									bind:value={availableHours}
									class="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
								/>
								<span class="absolute right-8 top-2.5 text-xs font-medium text-zinc-500">HRS</span>
							</div>
							<p class="text-xs text-zinc-500 mt-2">Allocated: {remainingSuggestedHours}h</p>
						</Card.Content>
					</Card.Root>

					<!-- Metrics -->
					<div class="rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
						<!-- Momentum -->
						<div class="flex items-center justify-between mb-4">
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<span
											class="text-xs text-zinc-400 cursor-help underline decoration-dotted underline-offset-2"
										>
											Momentum
										</span>
									</Tooltip.Trigger>
									<Tooltip.Content
										side="right"
										class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
									>
										<p>
											Average enjoyment minus difficulty. Upward = sustainable pace, Reset Reqd =
											burnout risk.
										</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
							<Badge
								variant={momentum > 0 ? 'default' : momentum < 0 ? 'destructive' : 'secondary'}
								class={momentum > 0
									? 'bg-indigo-500/20 text-indigo-300'
									: momentum < 0
										? 'bg-amber-500/20 text-amber-300'
										: ''}
							>
								{momentum > 0 ? 'Upward' : momentum < 0 ? 'Reset Reqd' : 'Stable'}
							</Badge>
						</div>

						<div class="border-t border-zinc-800 my-3"></div>

						<!-- All Metrics flat list with separators -->
						<div>
							{#each metrics as item, i}
								{#if i === 4 || i === 7 || i === 11 || i === 13 || i === 16}
									<div class="border-t border-zinc-800 my-3"></div>
								{/if}
								<div
									class="px-3 py-2 flex justify-between items-baseline rounded-lg transition hover:bg-white/[0.04]"
								>
									<Tooltip.Provider>
										<Tooltip.Root>
											<Tooltip.Trigger>
												<span
													class="text-xs text-zinc-400 cursor-help underline decoration-dotted underline-offset-2"
												>
													{item.label}
												</span>
											</Tooltip.Trigger>
											<Tooltip.Content
												side="right"
												class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
											>
												<p>{item.description}</p>
											</Tooltip.Content>
										</Tooltip.Root>
									</Tooltip.Provider>
									<span class="text-sm font-semibold capitalize {item.valStyle}">
										{item.value}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	</main>
{/if}
