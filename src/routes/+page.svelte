<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import TimeBudgetCard from '$lib/components/TimeBudgetCard.svelte';
	import MetricsDashboard from '$lib/components/MetricsDashboard.svelte';
	import {
		STATUS,
		getStatusBiggerBetter,
		getStatusSmallerBetter,
		getStatusInRange
	} from '$lib/metrics/status';
	import {
		type Task,
		calculateSuggestedTasks,
		calculateZenithGain,
		calculateCompletionRate,
		calculateYieldIndex,
		calculateFlowCoverage,
		calculateHumanCapacity,
		calculateBottleneckTask,
		calculateTimeScarcity,
		calculateBurnoutRisk,
		calculateCognitiveLoad,
		calculatePhysicalLoad,
		calculateEnergyBalance,
		calculateFrictionIndex,
		calculateDailyQuadrant,
		calculateBudgetConvergence,
		calculateMomentum,
		calculateDeepWorkRatio,
		calculateQuickWins,
		calculateTaskVariety,
		calculateGrindDensity,
		calculateRewardDensity,
		calculateRecoveryRatio
	} from '$lib/metrics/calculations';
	import { DEFAULT_SWITCH_COST } from '$lib/zenith';
	import {
		initDB,
		saveSession,
		getSession,
		getYesterdaySession,
		getAllRoutines,
		saveRoutine,
		deleteRoutine,
		type DailySession,
		type SavedRoutine
	} from '$lib/storage/db';
	import type { TaskType } from '$lib/types/business/taskType';

	const today = new Date().toISOString().slice(0, 10);

	// State
	let tasks = $state<Task[]>([]);
	let availableHours = $state<number>(0);
	let switchCost = $state<number>(DEFAULT_SWITCH_COST);
	let isLoading = $state(true);
	let yesterdaySession = $state<DailySession | null>(null);
	let routines = $state<SavedRoutine[]>([]);
	let selectedDate = $state(today);

	// Derived: are we viewing historical data?
	const isViewingHistory = $derived(selectedDate !== today);

	// Initialize from IndexedDB
	onMount(async () => {
		if (!browser) return;

		try {
			await initDB();

			// Load today's session (if exists) or start fresh
			const todaySession = await getSession(today);
			if (todaySession) {
				tasks = todaySession.tasks;
				availableHours = todaySession.availableHours;
				switchCost = todaySession.switchCost;
			}

			// Load yesterday for import option
			yesterdaySession = await getYesterdaySession();

			// Load saved routines
			routines = await getAllRoutines();
		} catch (e) {
			console.error('Failed to load from IndexedDB', e);
		} finally {
			isLoading = false;
		}
	});

	// Handle date change for history navigation
	async function handleDateChange(newDate: string) {
		if (!browser) return;

		selectedDate = newDate;

		try {
			const session = await getSession(newDate);
			if (session) {
				tasks = session.tasks;
				availableHours = session.availableHours;
				switchCost = session.switchCost;
			} else {
				// No data for this date
				tasks = [];
				availableHours = 0;
				switchCost = DEFAULT_SWITCH_COST;
			}
		} catch (e) {
			console.error('Failed to load session for date', newDate, e);
		}
	}

	// Core derived values
	const totalTasks = $derived(tasks.length);
	const completedTasksCount = $derived(tasks.filter((task) => task.completed).length);
	const suggestedTasks = $derived(calculateSuggestedTasks(tasks, availableHours, switchCost));
	const activeTasks = $derived(suggestedTasks.filter((t) => !t.completed));

	const remainingSuggestedHours = $derived(
		(
			Math.round(activeTasks.reduce((sum, task) => sum + task.suggestedHours, 0) * 100) / 100
		).toFixed(2)
	);

	// Metric calculations
	const zenithGain = $derived(calculateZenithGain(tasks, availableHours, switchCost));
	const completionRate = $derived(calculateCompletionRate(suggestedTasks));
	const yieldIndex = $derived(calculateYieldIndex(suggestedTasks));
	const flowCoverage = $derived(calculateFlowCoverage(activeTasks));
	const humanCapacity = $derived(calculateHumanCapacity(activeTasks));
	const bottleneckTask = $derived(calculateBottleneckTask(activeTasks));
	const timeScarcity = $derived(calculateTimeScarcity(tasks, availableHours));
	const burnoutRisk = $derived(calculateBurnoutRisk(activeTasks));
	const cognitiveLoad = $derived(calculateCognitiveLoad(activeTasks, availableHours));
	const physicalLoad = $derived(calculatePhysicalLoad(activeTasks, availableHours));
	const energyBalance = $derived(calculateEnergyBalance(cognitiveLoad, physicalLoad));
	const frictionIndex = $derived(calculateFrictionIndex(activeTasks, availableHours));
	const dailyQuadrant = $derived(calculateDailyQuadrant(tasks));
	const budgetConvergence = $derived(calculateBudgetConvergence(activeTasks, availableHours));
	const momentum = $derived(calculateMomentum(tasks));
	const deepWorkRatio = $derived(calculateDeepWorkRatio(activeTasks, availableHours));
	const quickWins = $derived(calculateQuickWins(activeTasks));
	const taskVariety = $derived(calculateTaskVariety(activeTasks));
	const grindDensity = $derived(calculateGrindDensity(activeTasks));
	const rewardDensity = $derived(calculateRewardDensity(activeTasks, availableHours));
	const recoveryRatio = $derived(calculateRecoveryRatio(activeTasks));

	// Averages
	const averageDifficulty = $derived(
		totalTasks ? Math.round(tasks.reduce((sum, task) => sum + task.difficulty, 0) / totalTasks) : 0
	);
	const averageEnjoyment = $derived(
		totalTasks ? Math.round(tasks.reduce((sum, task) => sum + task.enjoyment, 0) / totalTasks) : 0
	);

	// Metrics array for dashboard
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
			valStyle: getStatusInRange(rewardDensity, 40, 60).color
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
		},
		{
			label: 'Avg Difficulty',
			value: `${averageDifficulty}/10`,
			description:
				'Average difficulty across all tasks. Higher values indicate more challenging workload.',
			valStyle: STATUS.NEUTRAL.color
		},
		{
			label: 'Avg Enjoyment',
			value: `${averageEnjoyment}/10`,
			description: 'Average enjoyment across all tasks. Higher values indicate more engaging work.',
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

	function importTasks(importedTasks: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) {
		const newTasks = importedTasks.map((t) => ({
			...t,
			id: Date.now() + Math.random(),
			createdAt: today,
			completed: false
		}));
		tasks = [...newTasks, ...tasks];
	}

	async function handleSaveRoutine(name: string) {
		const routine: SavedRoutine = {
			id: `routine-${Date.now()}`,
			name,
			tasks: tasks.map((t) => ({
				title: t.title,
				difficulty: t.difficulty,
				enjoyment: t.enjoyment,
				taskType: t.taskType
			})),
			createdAt: Date.now()
		};
		await saveRoutine(routine);
		routines = await getAllRoutines();
	}

	async function handleDeleteRoutine(id: string) {
		await deleteRoutine(id);
		routines = await getAllRoutines();
	}

	// Auto-save to IndexedDB (only for today)
	$effect(() => {
		if (browser && !isLoading && selectedDate === today) {
			saveSession({
				date: today,
				tasks,
				availableHours,
				switchCost,
				updatedAt: Date.now()
			}).catch((e) => console.error('Failed to save session', e));
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

{#if !isLoading}
	<main
		class="min-h-screen bg-black/70 text-zinc-300 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 font-sans"
	>
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<PageHeader
				completedTasks={completedTasksCount}
				{totalTasks}
				{selectedDate}
				{today}
				ondatechange={handleDateChange}
				{yesterdaySession}
				{routines}
				currentTasks={tasks}
				onimport={importTasks}
				onsaveroutine={handleSaveRoutine}
				ondeleteroutine={handleDeleteRoutine}
			/>

			<div class="grid gap-6 lg:grid-cols-3 items-start">
				<div class="space-y-6 lg:col-span-2">
					{#if !isViewingHistory}
						<TimeBudgetCard bind:availableHours bind:switchCost {remainingSuggestedHours} />
						<TaskForm onsubmit={addTask} />
					{:else}
						<div
							class="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300/80 text-sm"
						>
							<span class="font-medium">Read-only mode:</span> You're viewing historical data. Return
							to today to add or modify tasks.
						</div>
					{/if}
					<TaskList
						{suggestedTasks}
						ontoggle={isViewingHistory ? () => {} : toggleTask}
						onremove={isViewingHistory ? () => {} : removeTask}
					/>
				</div>

				<div class="space-y-4 lg:sticky lg:top-8">
					<MetricsDashboard {metrics} {momentum} />
				</div>
			</div>
		</div>
	</main>
{/if}
