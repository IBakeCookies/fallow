<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import TimeBudgetCard from '$lib/components/TimeBudgetCard.svelte';
	import MetricsDashboard from '$lib/components/MetricsDashboard.svelte';
	import { STATUS, getStatusBiggerBetter, getStatusSmallerBetter } from '$lib/metrics/status';
	import {
		calculateSuggestedTasks,
		calculateInterleavedOrder,
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
		calculateRecoveryRatio,
		calculateAveragePhysicalDifficulty,
		calculateAverageMentalDifficulty,
		calculateAverageEnjoyment
	} from '$lib/metrics/calculations';
	import { getSessionStore } from '$lib/store/session-store.svelte';

	// Shared daily session (tasks, budget, pools + persistence) — set in the
	// (app) layout, also consumed live by the Energy Lab.
	const session = getSessionStore();

	// Local aliases so the metric formulas below read like the math they encode
	const today = $derived(session.today);
	const selectedDate = $derived(session.selectedDate);
	const isViewingPast = $derived(session.isViewingPast);
	const isViewingFuture = $derived(session.isViewingFuture);
	const tasks = $derived(session.tasks);
	const availableHours = $derived(session.availableHours);
	const switchCost = $derived(session.switchCost);
	const pools = $derived(session.pools);
	const flowObservations = $derived(session.flowObservations);
	const userConstants = $derived(session.userConstants);

	// /?date=<today> renders the same view as / — collapse to the canonical
	// URL. Also fires when a viewed date BECOMES today at midnight rollover.
	const dateParam = $derived(page.url.searchParams.get('date'));
	$effect(() => {
		if (browser && dateParam === today) {
			goto('/', { replaceState: true, noScroll: true, keepFocus: true });
		}
	});

	// Navigate to a day; the store follows the URL and loads it.
	function gotoDate(newDate: string) {
		goto(newDate === today ? '/' : `/?date=${newDate}`, { noScroll: true, keepFocus: true });
	}

	function formatDisplayDate(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Core derived values
	const totalTasks = $derived(tasks.length);
	const completedTasksCount = $derived(tasks.filter((task) => task.completed).length);

	const modelStatus = $derived(
		session.constantsFit.fitted
			? `Model personalized from ${flowObservations.length} time-to-flow log${
					flowObservations.length === 1 ? '' : 's'
				} (⚡) — blended with the defaults, sharpens as you log more`
			: flowObservations.length > 0
				? `Your ${flowObservations.length} flow log${
						flowObservations.length === 1 ? '' : 's'
					} produced an implausible fit (predicted flow times over 16h) — using default constants. Check the logs below for mistakes.`
				: 'Model uses default constants — log time-to-flow (⚡) on tasks to start personalizing'
	);

	const suggestedTasks = $derived(
		calculateSuggestedTasks(tasks, availableHours, switchCost, pools, userConstants)
	);
	const activeTasks = $derived(suggestedTasks.filter((t) => !t.completed));

	// Hours the plan deliberately leaves unspent (optimal stopping + pool caps).
	// Switch overhead counts only tasks that actually received time, matching
	// the allocator.
	const planSlackHours = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		const fundedCount = suggestedTasks.filter((t) => t.suggestedHours > 0).length;
		const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;
		const effectiveBudget = Math.max(0, budget - overhead);
		const allocated = suggestedTasks.reduce((sum, t) => sum + t.suggestedHours, 0);
		return Math.max(0, effectiveBudget - allocated);
	});

	// Suggested run order: alternates cognitive/physical tasks so the resting
	// energy system recovers (dual-pool model). Map of task id → 1-based position.
	const runOrder = $derived(
		new Map(calculateInterleavedOrder(activeTasks).map((t, i) => [t.id, i + 1]))
	);

	const remainingSuggestedHours = $derived(
		(
			Math.round(activeTasks.reduce((sum, task) => sum + task.suggestedHours, 0) * 100) / 100
		).toFixed(2)
	);

	// Metric calculations
	const zenithGain = $derived(
		calculateZenithGain(tasks, availableHours, switchCost, pools, userConstants)
	);
	const completionRate = $derived(calculateCompletionRate(suggestedTasks));
	const yieldIndex = $derived(calculateYieldIndex(suggestedTasks));
	const flowCoverage = $derived(calculateFlowCoverage(activeTasks));
	const humanCapacity = $derived(calculateHumanCapacity(activeTasks, pools));
	const bottleneckTask = $derived(calculateBottleneckTask(activeTasks));
	const timeScarcity = $derived(
		calculateTimeScarcity(tasks, availableHours, switchCost, userConstants)
	);
	const burnoutRisk = $derived(calculateBurnoutRisk(activeTasks, availableHours, switchCost));
	const cognitiveLoad = $derived(calculateCognitiveLoad(activeTasks, availableHours));
	const physicalLoad = $derived(calculatePhysicalLoad(activeTasks, availableHours));
	const energyBalance = $derived(calculateEnergyBalance(cognitiveLoad, physicalLoad));
	const frictionIndex = $derived(calculateFrictionIndex(activeTasks));
	const dailyQuadrant = $derived(calculateDailyQuadrant(tasks));
	const budgetConvergence = $derived(
		calculateBudgetConvergence(activeTasks, availableHours, switchCost)
	);
	const momentum = $derived(calculateMomentum(tasks));
	const deepWorkRatio = $derived(calculateDeepWorkRatio(activeTasks, availableHours));
	const quickWins = $derived(calculateQuickWins(activeTasks));
	const taskVariety = $derived(calculateTaskVariety(activeTasks));
	const grindDensity = $derived(calculateGrindDensity(activeTasks));
	const rewardDensity = $derived(calculateRewardDensity(activeTasks, availableHours));
	const recoveryRatio = $derived(calculateRecoveryRatio(activeTasks));

	// Averages
	const averagePhysicalDifficulty = $derived(calculateAveragePhysicalDifficulty(tasks));
	const averageMentalDifficulty = $derived(calculateAverageMentalDifficulty(tasks));
	const averageEnjoyment = $derived(calculateAverageEnjoyment(tasks));

	// Empty-state guards: metrics that are undefined without tasks/budget show N/A
	const hasTasks = $derived(tasks.length > 0);
	const hasActive = $derived(activeTasks.length > 0);
	const hasBudget = $derived(availableHours > 0);
	const NA = { value: 'N/A', valStyle: STATUS.NEUTRAL.color };

	// Metrics array for dashboard
	const metrics = $derived([
		{
			label: 'Zenith Gain',
			description:
				'Productivity improvement from Zenith optimization vs. naive equal time split. Based on the Lagrange multiplier solution.',
			...(hasTasks && hasBudget
				? {
						value: `+${zenithGain.gainPercent}%`,
						valStyle:
							zenithGain.gainPercent >= 15
								? STATUS.SUCCESS.color
								: zenithGain.gainPercent >= 5
									? STATUS.NEUTRAL.color
									: STATUS.WARNING.color
					}
				: NA)
		},
		{
			label: 'Yield Index',
			description:
				'Did you complete the highest-priority tasks? Compares your completed work against the optimal selection.',
			...(completedTasksCount > 0
				? { value: `${yieldIndex}%`, valStyle: getStatusBiggerBetter(yieldIndex).color }
				: NA)
		},
		{
			label: 'Completion Rate',
			description:
				'Priority-weighted progress. High-value tasks contribute more to this percentage than low-priority ones.',
			...(hasTasks
				? { value: `${completionRate}%`, valStyle: getStatusBiggerBetter(completionRate).color }
				: NA)
		},
		{
			label: 'Flow Coverage',
			description:
				'Tasks that reach flow state (allocated time ≥ ϕ). Low coverage means too many tasks for budget — drop tasks or add hours.',
			...(hasActive && hasBudget
				? {
						value: `${flowCoverage.reached}/${flowCoverage.total}`,
						valStyle:
							flowCoverage.reached === flowCoverage.total
								? STATUS.SUCCESS.color
								: flowCoverage.reached >= flowCoverage.total / 2
									? STATUS.NEUTRAL.color
									: STATUS.WARNING.color
					}
				: NA)
		},
		{
			label: 'Human Capacity',
			description: `${humanCapacity.limitType === 'cognitive' ? 'Cognitive' : 'Physical'} limit (${humanCapacity.limitType === 'cognitive' ? pools.cognitiveHours : pools.physicalHours}h/day, configurable in Time Budget). The allocator enforces these pools, so suggested plans stay ≤100% — this shows how much of your sustainable capacity the plan uses.`,
			...(hasActive && hasBudget
				? {
						value: `${humanCapacity.percent}%`,
						valStyle:
							humanCapacity.percent <= 75
								? STATUS.SUCCESS.color
								: humanCapacity.percent <= 100
									? STATUS.NEUTRAL.color
									: STATUS.CRITICAL.color
					}
				: NA)
		},
		{
			label: 'Time Scarcity',
			description:
				'How stretched is your time budget? Higher values mean too many tasks for the hours available.',
			...(hasTasks
				? { value: `${timeScarcity}%`, valStyle: getStatusSmallerBetter(timeScarcity).color }
				: NA)
		},
		{
			label: 'Primary Bottleneck',
			value: bottleneckTask,
			description:
				'The task requiring the most energy to reach flow state (highest effort-to-enjoyability ratio in Zenith terms).',
			valStyle: bottleneckTask !== 'None Detected' ? STATUS.WARNING.color : STATUS.NEUTRAL.color
		},
		{
			label: 'Burnout Risk',
			description:
				'Strain accumulates when difficulty > enjoyment (weighted by mental intensity), plus budget overhang: hours you plan beyond the optimal workload (1.79×ϕ per task) land in the diminishing-returns zone and count double. 5 strain-hours = 100% risk.',
			...(hasActive && hasBudget
				? { value: `${burnoutRisk}%`, valStyle: getStatusSmallerBetter(burnoutRisk).color }
				: NA)
		},
		{
			label: 'Cognitive Load',
			description: 'Percentage of your day allocated to mental/cognitive tasks.',
			...(hasActive && hasBudget
				? {
						value: `${cognitiveLoad}%`,
						valStyle: getStatusSmallerBetter(cognitiveLoad > 70 ? cognitiveLoad : 0).color
					}
				: NA)
		},
		{
			label: 'Physical Load',
			description: 'Percentage of your day allocated to physical tasks.',
			...(hasActive && hasBudget
				? {
						value: `${physicalLoad}%`,
						valStyle: getStatusSmallerBetter(physicalLoad > 70 ? physicalLoad : 0).color
					}
				: NA)
		},
		{
			label: 'Energy Balance',
			description:
				'Distribution of Cognitive vs physical work. Alternating types extends total productive hours.',
			...(hasActive && hasBudget
				? {
						value:
							energyBalance > 60
								? 'Cognitive Heavy'
								: energyBalance < 40
									? 'Physical Heavy'
									: 'Balanced',
						valStyle:
							energyBalance > 60 || energyBalance < 40 ? STATUS.WARNING.color : STATUS.SUCCESS.color
					}
				: NA)
		},
		{
			label: 'Schedule Integrity',
			description:
				'Detects fragmentation. Drops if tasks get less than 15 minutes, or if no time budget is set.',
			...(hasActive
				? {
						value: `${budgetConvergence}%`,
						valStyle: getStatusBiggerBetter(budgetConvergence).color
					}
				: NA)
		},
		{
			label: 'Friction Index',
			description:
				'Share of your allocated time spent on high-difficulty, low-enjoyment work (time-weighted average of E−β). 100% = every planned hour is maximum-friction work.',
			...(hasActive && hasBudget
				? { value: `${frictionIndex}%`, valStyle: getStatusSmallerBetter(frictionIndex).color }
				: NA)
		},
		{
			label: 'Deep Work',
			description:
				'Percentage of time allocated to high mental difficulty (≥7) tasks requiring sustained focus.',
			...(hasActive && hasBudget
				? { value: `${deepWorkRatio}%`, valStyle: getStatusBiggerBetter(deepWorkRatio).color }
				: NA)
		},
		{
			label: 'Quick Wins',
			description:
				'Count of easy, enjoyable tasks available for momentum building and motivation boosts.',
			...(hasActive
				? {
						value: `${quickWins}`,
						valStyle: quickWins > 0 ? STATUS.SUCCESS.color : STATUS.NEUTRAL.color
					}
				: NA)
		},
		{
			label: 'Task Variety',
			description:
				'Diversity across mental/physical spectrum. Mixing cognitive, physical, and balanced tasks prevents fatigue.',
			...(hasActive
				? { value: `${taskVariety}%`, valStyle: getStatusBiggerBetter(taskVariety).color }
				: NA)
		},
		{
			label: 'Grind Density',
			description:
				'Percentage of tasks where difficulty exceeds enjoyment. High values signal willpower drain.',
			...(hasActive
				? { value: `${grindDensity}%`, valStyle: getStatusSmallerBetter(grindDensity).color }
				: NA)
		},
		{
			label: 'Sustainable Work',
			description:
				'Percentage of time on tasks where enjoyment ≥ difficulty. Higher = more energizing workday.',
			...(hasActive && hasBudget
				? { value: `${rewardDensity}%`, valStyle: getStatusBiggerBetter(rewardDensity).color }
				: NA)
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
			description:
				"Your day's character based on average difficulty and enjoyment. Flow Zone = challenging and engaging, Grind Mode = demanding work, Cruise = light and enjoyable, Routine = low-key tasks.",
			...(hasTasks
				? {
						value: {
							flow: 'Flow Zone',
							grind: 'Grind Mode',
							cruise: 'Cruise',
							routine: 'Routine'
						}[dailyQuadrant],
						valStyle: STATUS.NEUTRAL.color
					}
				: NA)
		},
		{
			label: 'Avg Physical Diff',
			description: 'Average physical difficulty across all tasks.',
			...(hasTasks
				? { value: `${averagePhysicalDifficulty}/10`, valStyle: STATUS.NEUTRAL.color }
				: NA)
		},
		{
			label: 'Avg Mental Diff',
			description: 'Average mental/cognitive difficulty across all tasks.',
			...(hasTasks
				? { value: `${averageMentalDifficulty}/10`, valStyle: STATUS.NEUTRAL.color }
				: NA)
		},
		{
			label: 'Avg Enjoyment',
			description: 'Average enjoyment across all tasks. Higher values indicate more engaging work.',
			...(hasTasks ? { value: `${averageEnjoyment}/10`, valStyle: STATUS.NEUTRAL.color } : NA)
		}
	]);
</script>

<svelte:head>
	<title>Zenith — Smart Daily Time Allocation</title>
	<meta
		name="description"
		content="Zenith allocates your daily time budget across tasks using the Zenith Gradient algorithm — balancing effort, enjoyment, and flow state to maximize productivity."
	/>
	<link rel="canonical" href={page.url.origin + page.url.pathname} />
	<meta name="theme-color" content="#000000" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Zenith" />
	<meta property="og:title" content="Zenith — Smart Daily Time Allocation" />
	<meta
		property="og:description"
		content="Allocate your daily time budget across tasks with the Zenith Gradient algorithm — balancing effort, enjoyment, and flow state to maximize productivity."
	/>
	<meta property="og:url" content={page.url.origin + page.url.pathname} />
	<meta
		property="og:image"
		content={page.url.origin + '/dark-textured-black-background-red-purple.jpg'}
	/>

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Zenith — Smart Daily Time Allocation" />
	<meta
		name="twitter:description"
		content="Allocate your daily time budget across tasks with the Zenith Gradient algorithm."
	/>
	<meta
		name="twitter:image"
		content={page.url.origin + '/dark-textured-black-background-red-purple.jpg'}
	/>
</svelte:head>

{#if !session.isLoading}
	<PageHeader
		completedTasks={completedTasksCount}
		{totalTasks}
		{selectedDate}
		{today}
		ondatechange={gotoDate}
		yesterdaySession={session.yesterdaySession}
		routines={session.routines}
		currentTasks={tasks}
		onimport={(t) => session.importTasks(t)}
		onsaveroutine={(name) => session.saveCurrentAsRoutine(name)}
		ondeleteroutine={(id) => session.deleteRoutine(id)}
	/>

	<div class="grid gap-6 lg:grid-cols-3 items-start">
		<div class="space-y-6 lg:col-span-2">
			{#if !isViewingPast}
				{#if isViewingFuture}
					<div
						class="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sky-300/80 text-sm"
					>
						<span class="font-medium">Planning ahead:</span> tasks and budget you set here are
						saved to {formatDisplayDate(selectedDate)} — open it on that day to work the plan.
					</div>
				{/if}
				<TimeBudgetCard
					bind:availableHours={session.availableHours}
					bind:switchCost={session.switchCost}
					bind:cognitivePool={session.cognitivePool}
					bind:physicalPool={session.physicalPool}
					{remainingSuggestedHours}
					{planSlackHours}
					{modelStatus}
					flowLogs={flowObservations}
					ondeletelog={(id) => session.deleteFlowLog(id)}
					onresetlogs={() => session.resetFlowLogs()}
					startOpen={availableHours <= 0}
				/>
				<TaskForm onsubmit={(t) => session.addTask(t)} startOpen={tasks.length === 0} />
			{:else}
				<div
					class="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300/80 text-sm"
				>
					<span class="font-medium">Viewing a past day:</span> you can still check tasks on or
					off (forgot one before midnight? fix it here — changes are saved), but adding or
					editing tasks is only possible on today.
				</div>
			{/if}
			<TaskList
				{suggestedTasks}
				{runOrder}
				ontoggle={(id) => session.toggleTask(id)}
				onremove={isViewingPast ? () => {} : (id) => session.removeTask(id)}
				onlogflow={selectedDate === today ? (id, minutes) => session.logFlow(id, minutes) : undefined}
				onupdate={isViewingPast ? undefined : (id, changes) => session.updateTask(id, changes)}
			/>
		</div>

		<div class="space-y-4 lg:sticky lg:top-8">
			<MetricsDashboard {metrics} momentum={hasTasks ? momentum : null} />
		</div>
	</div>
{/if}
