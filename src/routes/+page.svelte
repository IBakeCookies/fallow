<script lang="ts">
	import { browser } from '$app/environment';

	type Task = {
		id: number;
		title: string;
		difficulty: number;
		enjoyment: number;
		taskType: 'Cognitive' | 'physical' | 'Hybrid';
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
	let draft = $state({
		title: '',
		difficulty: 5,
		enjoyment: 5,
		taskType: 'Cognitive' as 'Cognitive' | 'physical' | 'Hybrid'
	});

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

	const suggestedTasks = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		const weights = tasks.map((task) => Math.sqrt(task.difficulty));
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

		return tasks
			.map((task, index) => {
				const weight = weights[index];
				const suggestedHours =
					totalWeight && budget > 0 ? Number(((weight / totalWeight) * budget).toFixed(2)) : 0;
				return {
					...task,
					suggestedHours,
					priorityScore: Number((task.enjoyment + task.difficulty / 2).toFixed(1))
				};
			})
			.sort((a, b) => b.priorityScore - a.priorityScore);
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

	const flowStatePercentage = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!budget || !activeTasks.length) return 0;

		const flowHours = activeTasks
			.filter((t) => t.difficulty >= 6 && t.enjoyment >= 6)
			.reduce((sum, t) => sum + t.suggestedHours, 0);
		return Math.min(100, Math.round((flowHours / budget) * 100));
	});

	const bottleneckTask = $derived.by(() => {
		if (!activeTasks.length) return 'None Detected';
		return activeTasks.reduce((worst, current) => {
			const worstRatio = worst.difficulty / (worst.enjoyment || 1);
			const currentRatio = current.difficulty / (current.enjoyment || 1);
			return currentRatio > worstRatio ? current : worst;
		}).title;
	});

	const timeElasticity = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!totalTasks) return 0;
		if (budget === 0) return 100;

		const totalWeight = tasks.reduce((sum, t) => sum + Math.sqrt(t.difficulty), 0);
		const shadowPrice = totalWeight / budget;

		const MIN_PRICE = 0;
		const MAX_PRICE = 10;

		const normalized = ((shadowPrice - MIN_PRICE) / (MAX_PRICE - MIN_PRICE)) * 100;
		return Math.min(100, Math.max(0, Math.round(normalized)));
	});

	const burnoutRisk = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		if (!activeTasks.length || !budget) return 0;

		// Mental tasks weighted 1.5x for cognitive burnout
		const weightedStrainHours = activeTasks
			.filter((t) => t.difficulty >= 7)
			.reduce((sum, t) => {
				const typeMultiplier =
					t.taskType === 'Cognitive' ? 1.5 : t.taskType === 'Hybrid' ? 1.25 : 1;
				return sum + t.suggestedHours * typeMultiplier;
			}, 0);

		// Risk = % of day spent on high-strain tasks, scaled so 50% of day = 100% risk
		return Math.min(100, Math.round((weightedStrainHours / (budget * 0.5)) * 100));
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
			.filter((t) => t.taskType === 'physical' || t.taskType === 'Hybrid')
			.reduce((sum, t) => sum + t.suggestedHours * (t.taskType === 'physical' ? 1 : 0.5), 0);

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
		if (!activeTasks.length) return 0;

		const totalFriction = activeTasks.reduce((sum, t) => {
			const gap = t.difficulty - t.enjoyment;
			return sum + (gap > 0 ? gap * t.suggestedHours : 0);
		}, 0);

		// Dynamic max friction: Assumes a "bad" day averages a gap of 4 across all hours
		const budget = Number(availableHours) || 1;
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

	const averageDifficulty = $derived(
		totalTasks ? Math.round(tasks.reduce((sum, task) => sum + task.difficulty, 0) / totalTasks) : 0
	);

	const averageEnjoyment = $derived(
		totalTasks ? Math.round(tasks.reduce((sum, task) => sum + task.enjoyment, 0) / totalTasks) : 0
	);

	const metrics = $derived([
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
			label: 'Flow Density',
			value: `${flowStatePercentage}%`,
			description:
				'The percentage of your time budget allocated to tasks that are both highly challenging and highly enjoyable.',
			valStyle: getStatusBiggerBetter(flowStatePercentage).color
		},
		{
			label: 'Time Scarcity',
			value: `${timeElasticity}%`,
			description:
				'How stretched is your time budget? Higher values mean too many tasks for the hours available.',
			valStyle: getStatusSmallerBetter(timeElasticity).color
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
				'Strain forecast. Mental tasks weighted 1.5x. Risk increases when high-difficulty work exceeds 50% of your day.',
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

	function addTask() {
		const title = draft.title.trim();
		if (!title) return;

		tasks = [
			{
				id: Date.now(),
				title,
				difficulty: draft.difficulty,
				enjoyment: draft.enjoyment,
				taskType: draft.taskType,
				createdAt: today,
				completed: false
			},
			...tasks
		];
		draft = { title: '', difficulty: 5, enjoyment: 5, taskType: 'Cognitive' };
	}

	function toggleTask(id: number) {
		tasks = tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task));
	}

	function removeTask(id: number) {
		tasks = tasks.filter((task) => task.id !== id);
	}

	function decimalHourToMinutes(decimalHour: number): string {
		const hours = Math.floor(decimalHour);
		const minutes = Math.round((decimalHour - hours) * 60);
		return `${hours}h ${minutes}m`;
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
		class="min-h-screen bg-zinc-950 text-zinc-300 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 font-sans"
	>
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<section class="grid gap-4 grid-cols-2 lg:grid-cols-4">
				{#each [{ label: 'Total Tasks', value: totalTasks }, { label: 'Completed', value: completedTasks }, { label: 'Avg Difficulty', value: `${averageDifficulty}/10` }, { label: 'Engagement Score', value: `${averageEnjoyment}/10` }] as metric}
					<div
						class="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 backdrop-blur-xl shadow-lg shadow-black/20"
					>
						<div class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
							{metric.label}
						</div>
						<div class="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
							{metric.value}
						</div>
					</div>
				{/each}
			</section>

			<div class="mt-6 grid gap-6 lg:grid-cols-3 items-start">
				<div class="space-y-6 lg:col-span-2 order-1">
					<!-- Input Form: Sleek and Minimal -->
					<form
						class="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl shadow-2xl"
						onsubmit={(e) => {
							e.preventDefault();
							addTask();
						}}
					>
						<label class="text-xs font-medium text-zinc-400">
							Task Definition
							<input
								type="text"
								bind:value={draft.title}
								placeholder="Enter task parameters..."
								class="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
							/>
						</label>

						<div class="mt-5">
							<div class="text-xs font-medium text-zinc-400 mb-2">Task Type</div>
							<div class="flex gap-2">
								{#each ['Cognitive', 'physical', 'Hybrid'] as type}
									<button
										type="button"
										onclick={() => (draft.taskType = type)}
										class="flex-1 px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all {draft.taskType ===
										type
											? 'bg-indigo-500 text-white'
											: 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'}"
									>
										{type === 'Cognitive'
											? '🧠 Cognitive'
											: type === 'physical'
												? '💪 Physical'
												: '⚡ Hybrid'}
									</button>
								{/each}
							</div>
						</div>

						<div class="text-sm mt-5 grid gap-5 sm:grid-cols-2">
							<div class="space-y-2">
								<div class="flex justify-between text-xs font-medium">
									<span class="text-zinc-400">Difficulty Factor</span>
									<span class="text-zinc-100">{draft.difficulty}</span>
								</div>
								<input
									type="range"
									min="1"
									max="10"
									bind:value={draft.difficulty}
									class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-400"
								/>
							</div>

							<div class="space-y-2">
								<div class="flex justify-between text-xs font-medium">
									<span class="text-zinc-400">Engagement Target</span>
									<span class="text-zinc-100">{draft.enjoyment}</span>
								</div>
								<input
									type="range"
									min="1"
									max="10"
									bind:value={draft.enjoyment}
									class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-400"
								/>
							</div>
						</div>

						<div class="mt-6 flex justify-end">
							<button
								class="cursor-pointer rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 active:scale-95 shadow-sm"
							>
								Deploy Task
							</button>
						</div>
					</form>

					<!-- Task List: Professional Data Rows -->
					<div
						class="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl shadow-sm"
					>
						<h1 class="text-lg font-bold text-zinc-200">Tasks</h1>
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
							<div
								class="group flex items-center justify-between rounded-lg border border-transparent bg-transparent p-3 transition hover:border-white/5 hover:bg-white/[0.02]"
							>
								<div class="flex items-center gap-4">
									<input
										type="checkbox"
										checked={task.completed}
										onchange={() => toggleTask(task.id)}
										class="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/20"
									/>
									<div class="flex items-center gap-2">
										<span class="text-sm" title={task.taskType || 'Cognitive'}>
											{task.taskType === 'physical'
												? '💪'
												: task.taskType === 'Hybrid'
													? '⚡'
													: '🧠'}
										</span>
										<h3
											class:text-zinc-500={task.completed}
											class:line-through={task.completed}
											class="text-sm font-medium text-zinc-100 capitalize"
										>
											{task.title}
										</h3>
									</div>
								</div>

								<div class="flex items-center gap-2">
									<span
										class="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-xs font-medium text-zinc-400"
										>Diff: {task.difficulty}</span
									>
									<span
										class="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-xs font-medium text-zinc-400"
										>Engagement: {task.enjoyment}</span
									>
									<span
										class="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-xs font-medium text-zinc-400"
										>Score: {task.priorityScore}</span
									>
									<span
										class="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-xs font-medium text-zinc-400"
										>{decimalHourToMinutes(task.suggestedHours)}</span
									>

									<button
										onclick={() => removeTask(task.id)}
										class="ml-2 text-zinc-600 hover:text-red-400 transition"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											></path></svg
										>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Right Sidebar Analytics -->
				<div class="space-y-4 lg:col-span-1 order-2 lg:sticky lg:top-8">
					<div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
						<div class="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
							<h3 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
								Allocation
							</h3>
							<div class="text-xs text-zinc-400">
								Avail: <span class="font-medium text-zinc-200">{remainingSuggestedHours}h</span>
							</div>
						</div>
						<div class="relative">
							<input
								type="number"
								step="0.25"
								min="0"
								bind:value={availableHours}
								class="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
							/>
							<span class="absolute right-3 top-2.5 text-xs font-medium text-zinc-500">HRS</span>
						</div>
					</div>

					<div class="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
						<div class="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
							<h4 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
								Momentum Vector
							</h4>
							<span
								class="text-xs font-medium uppercase tracking-wide {momentum > 0
									? 'text-indigo-400'
									: momentum < 0
										? 'text-amber-400'
										: 'text-zinc-400'}"
							>
								{momentum > 0 ? 'Upward' : momentum < 0 ? 'Reset Reqd' : 'Stable'}
							</span>
						</div>

						<div class="space-y-1">
							{#each metrics as item, i}
								<div
									class="{item.valStyle} px-3 py-2.5 flex justify-between items-baseline group cursor-help rounded-lg transition {i %
										2 ===
									0
										? 'bg-white/[0.02]'
										: ''} hover:bg-white/[0.04]"
									title={item.description}
								>
									<span class="text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
										{item.label}
									</span>

									<span class="relative text-sm font-semibold capitalize">
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
