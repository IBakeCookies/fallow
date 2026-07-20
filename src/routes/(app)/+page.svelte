<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import PageHeader from '$lib/presentation/component/page-header.svelte';
	import TaskList from '$lib/presentation/component/task-list.svelte';
	import TimeBudgetCard from '$lib/presentation/component/time-budget-card.svelte';
	import PersonalizationCard from '$lib/presentation/component/personalization-card.svelte';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';
	import FallowExplainer from '$lib/presentation/component/fallow-explainer.svelte';
	import {
		STATUS,
		getStatusBiggerBetter,
		getStatusSmallerBetter
	} from '$lib/presentation/utils/status';
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
		calculateScheduleIntegrity,
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
	} from '$lib/business/model/metric/calculation';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';

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
		return new Date(dateStr + 'T12:00:00').toLocaleDateString(getDateLocale(), {
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
			? flowObservations.length === 1
				? m.model_status_personalized_one()
				: m.model_status_personalized({ count: flowObservations.length })
			: flowObservations.length > 0
				? flowObservations.length === 1
					? m.model_status_implausible_one()
					: m.model_status_implausible({ count: flowObservations.length })
				: m.model_status_default()
	);

	// The fit posterior makes the allocator hedge ϕ-uncertainty (MATH.md §5.1):
	// barely-measured tasks plan slightly shorter/lower than well-measured ones.
	const phiPosterior = $derived(session.constantsFit.posterior);
	const suggestedTasks = $derived(
		calculateSuggestedTasks(tasks, availableHours, switchCost, pools, userConstants, phiPosterior)
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
		calculateZenithGain(tasks, availableHours, switchCost, pools, userConstants, phiPosterior)
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
	const scheduleIntegrity = $derived(
		calculateScheduleIntegrity(activeTasks, availableHours, switchCost)
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
	const NA = { value: m.na_value(), valStyle: STATUS.NEUTRAL.color };

	// Metrics array for dashboard
	const metrics = $derived([
		{
			label: m.metric_zenith_gain(),
			description: m.metric_zenith_gain_desc(),
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
			label: m.metric_yield_index(),
			description: m.metric_yield_index_desc(),
			...(completedTasksCount > 0
				? { value: `${yieldIndex}%`, valStyle: getStatusBiggerBetter(yieldIndex).color }
				: NA)
		},
		{
			label: m.metric_completion_rate(),
			description: m.metric_completion_rate_desc(),
			...(hasTasks
				? { value: `${completionRate}%`, valStyle: getStatusBiggerBetter(completionRate).color }
				: NA)
		},
		{
			label: m.metric_flow_coverage(),
			description: m.metric_flow_coverage_desc(),
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
			label: m.metric_human_capacity(),
			description: m.metric_human_capacity_desc({
				type:
					humanCapacity.limitType === 'cognitive'
						? m.metric_type_cognitive()
						: m.metric_type_physical(),
				hours: humanCapacity.limitType === 'cognitive' ? pools.cognitiveHours : pools.physicalHours
			}),
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
			label: m.metric_time_scarcity(),
			description: m.metric_time_scarcity_desc(),
			...(hasTasks
				? { value: `${timeScarcity}%`, valStyle: getStatusSmallerBetter(timeScarcity).color }
				: NA)
		},
		{
			label: m.metric_bottleneck(),
			value: bottleneckTask === 'None Detected' ? m.metric_none_detected() : bottleneckTask,
			description: m.metric_bottleneck_desc(),
			valStyle: bottleneckTask !== 'None Detected' ? STATUS.WARNING.color : STATUS.NEUTRAL.color
		},
		{
			label: m.metric_burnout_risk(),
			description: m.metric_burnout_risk_desc(),
			...(hasActive && hasBudget
				? { value: `${burnoutRisk}%`, valStyle: getStatusSmallerBetter(burnoutRisk).color }
				: NA)
		},
		{
			label: m.metric_cognitive_load(),
			description: m.metric_cognitive_load_desc(),
			...(hasActive && hasBudget
				? {
						value: `${cognitiveLoad}%`,
						valStyle: getStatusSmallerBetter(cognitiveLoad > 70 ? cognitiveLoad : 0).color
					}
				: NA)
		},
		{
			label: m.metric_physical_load(),
			description: m.metric_physical_load_desc(),
			...(hasActive && hasBudget
				? {
						value: `${physicalLoad}%`,
						valStyle: getStatusSmallerBetter(physicalLoad > 70 ? physicalLoad : 0).color
					}
				: NA)
		},
		{
			label: m.metric_energy_balance(),
			description: m.metric_energy_balance_desc(),
			...(hasActive && hasBudget
				? {
						value:
							energyBalance > 60
								? m.metric_cognitive_heavy()
								: energyBalance < 40
									? m.metric_physical_heavy()
									: m.metric_balanced(),
						valStyle:
							energyBalance > 60 || energyBalance < 40 ? STATUS.WARNING.color : STATUS.SUCCESS.color
					}
				: NA)
		},
		{
			label: m.metric_schedule_integrity(),
			description: m.metric_schedule_integrity_desc(),
			...(hasActive
				? {
						value: `${scheduleIntegrity}%`,
						valStyle: getStatusBiggerBetter(scheduleIntegrity).color
					}
				: NA)
		},
		{
			label: m.metric_friction_index(),
			description: m.metric_friction_index_desc(),
			...(hasActive && hasBudget
				? { value: `${frictionIndex}%`, valStyle: getStatusSmallerBetter(frictionIndex).color }
				: NA)
		},
		{
			label: m.metric_deep_work(),
			description: m.metric_deep_work_desc(),
			...(hasActive && hasBudget
				? { value: `${deepWorkRatio}%`, valStyle: getStatusBiggerBetter(deepWorkRatio).color }
				: NA)
		},
		{
			label: m.metric_quick_wins(),
			description: m.metric_quick_wins_desc(),
			...(hasActive
				? {
						value: `${quickWins}`,
						valStyle: quickWins > 0 ? STATUS.SUCCESS.color : STATUS.NEUTRAL.color
					}
				: NA)
		},
		{
			label: m.metric_task_variety(),
			description: m.metric_task_variety_desc(),
			...(hasActive
				? { value: `${taskVariety}%`, valStyle: getStatusBiggerBetter(taskVariety).color }
				: NA)
		},
		{
			label: m.metric_grind_density(),
			description: m.metric_grind_density_desc(),
			...(hasActive
				? { value: `${grindDensity}%`, valStyle: getStatusSmallerBetter(grindDensity).color }
				: NA)
		},
		{
			label: m.metric_sustainable_work(),
			description: m.metric_sustainable_work_desc(),
			...(hasActive && hasBudget
				? { value: `${rewardDensity}%`, valStyle: getStatusBiggerBetter(rewardDensity).color }
				: NA)
		},
		{
			label: m.metric_recovery_ratio(),
			value:
				recoveryRatio === 'No strain'
					? m.metric_no_strain()
					: recoveryRatio === 'N/A'
						? m.na_value()
						: recoveryRatio,
			description: m.metric_recovery_ratio_desc(),
			valStyle:
				recoveryRatio === 'No strain' || recoveryRatio === 'N/A'
					? STATUS.NEUTRAL.color
					: recoveryRatio.startsWith('0:')
						? STATUS.WARNING.color
						: STATUS.SUCCESS.color
		},
		{
			label: m.metric_day_profile(),
			description: m.metric_day_profile_desc(),
			...(hasTasks
				? {
						value: {
							flow: m.quadrant_flow(),
							grind: m.quadrant_grind(),
							cruise: m.quadrant_cruise(),
							routine: m.quadrant_routine()
						}[dailyQuadrant],
						valStyle: STATUS.NEUTRAL.color
					}
				: NA)
		},
		{
			label: m.metric_avg_physical(),
			description: m.metric_avg_physical_desc(),
			...(hasTasks
				? { value: `${averagePhysicalDifficulty}/10`, valStyle: STATUS.NEUTRAL.color }
				: NA)
		},
		{
			label: m.metric_avg_mental(),
			description: m.metric_avg_mental_desc(),
			...(hasTasks
				? { value: `${averageMentalDifficulty}/10`, valStyle: STATUS.NEUTRAL.color }
				: NA)
		},
		{
			label: m.metric_avg_enjoyment(),
			description: m.metric_avg_enjoyment_desc(),
			...(hasTasks ? { value: `${averageEnjoyment}/10`, valStyle: STATUS.NEUTRAL.color } : NA)
		}
	]);
</script>

<SeoHead
	title={m.page_title()}
	description={m.page_meta_description()}
	jsonLd={{
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: m.app_name(),
		description: m.page_meta_description(),
		applicationCategory: 'ProductivityApplication',
		operatingSystem: 'Any',
		browserRequirements: 'Requires JavaScript',
		inLanguage: ['en', 'de'],
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	}}
/>

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
				<div class="p-box-md rounded-xl border border-info/20 bg-info/5 text-info-strong/80 text-sm">
					<span class="font-medium">{m.banner_future_title()}</span>
					{m.banner_future_body({ date: formatDisplayDate(selectedDate) })}
				</div>
			{/if}
			<TimeBudgetCard
				bind:availableHours={session.availableHours}
				bind:switchCost={session.switchCost}
				bind:cognitivePool={session.cognitivePool}
				bind:physicalPool={session.physicalPool}
				{remainingSuggestedHours}
				{planSlackHours}
				startOpen={availableHours <= 0}
			/>
			<PersonalizationCard
				{modelStatus}
				flowLogs={flowObservations}
				ondeletelog={(id) => session.deleteFlowLog(id)}
				onresetlogs={() => session.resetFlowLogs()}
			/>
			<TaskForm onsubmit={(t) => session.addTask(t)} startOpen={tasks.length === 0} />
		{:else}
			<div
				class="p-box-md rounded-xl border border-warning/20 bg-warning/5 text-warning-strong/80 text-sm"
			>
				<span class="font-medium">{m.banner_past_title()}</span>
				{m.banner_past_body()}
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

<FallowExplainer />
