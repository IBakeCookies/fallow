<script lang="ts">
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { buildMetrics } from '$lib/presentation/utils/metric-descriptor';
	import { buildAdviceDisplay } from '$lib/presentation/utils/plan-advice-descriptor';
	import { removeTaskWithUndo } from '$lib/presentation/utils/remove-task-with-undo';
	import {
		removeFlowLogWithUndo,
		removeLogWithUndo,
	} from '$lib/presentation/utils/remove-log-with-undo';
	import {
		drainDraftFromLog,
		newDrainDraft,
		newEditorDraft,
		type DrainDraft,
		type EditorDraft,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import PageHeader from '$lib/presentation/component/page-header.svelte';
	import TaskList from '$lib/presentation/component/task-list.svelte';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';
	import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';
	import FallowExplainer from '$lib/presentation/component/fallow-explainer.svelte';
	import { setDailyPlanStore } from '$lib/business/store/daily-plan-store.svelte';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { fromISO } from '$lib/business/utils/date';

	const session = getSessionStore();
	const observations = getEnergyObservationStore();

	const plan = setDailyPlanStore(session, observations);

	const today = $derived(session.today);
	const selectedDate = $derived(session.selectedDate);
	const isViewingPast = $derived(session.isViewingPast);
	const isViewingFuture = $derived(session.isViewingFuture);
	const tasks = $derived(session.tasks);

	// Gates logging, not correcting. Why: presentation/AGENTS.md, "Both corrections are
	// offered on any day the page shows, a new measurement only today".
	const canLog = $derived(selectedDate === today);

	let flowDrafts = $state<Record<number, EditorDraft>>({});
	let drainDrafts = $state<Record<number, DrainDraft>>({});

	const openFlowLog = (taskId: number, source: EditorSource) =>
		(flowDrafts[taskId] = newEditorDraft(source));

	const closeFlowLog = (taskId: number) => {
		delete flowDrafts[taskId];
	};

	const openDrainLog = (taskId: number, source: EditorSource) =>
		(drainDrafts[taskId] = newDrainDraft(source));

	const editDrainLog = (taskId: number, log: Persisted<DrainObservationRecord>) =>
		(drainDrafts[taskId] = drainDraftFromLog(log));

	const closeDrainLog = (taskId: number) => {
		delete drainDrafts[taskId];
	};

	// Undo restores the task under its original id, so a surviving draft re-opens with it.
	function removeTask(taskId: number) {
		closeFlowLog(taskId);
		closeDrainLog(taskId);
		removeTaskWithUndo(session, taskId);
	}

	const drainLogs = $derived(observations.drainLogsOn(selectedDate));
	const flowLogs = $derived(session.flowMinutesOn(selectedDate));

	function saveFlowLog(taskId: number, minutes: number) {
		session.logFlow(taskId, minutes);
		closeFlowLog(taskId);
	}

	function clearFlowLog(taskId: number) {
		removeFlowLogWithUndo(session, taskId);
		closeFlowLog(taskId);
	}

	// Re-logging a correction would count the session's hours twice (MATH.md §18).
	function saveDrainLog(taskId: number, entry: { hours: number; mind: number; body: number }) {
		const recordId = drainDrafts[taskId]?.recordId;

		if (recordId === undefined) {
			observations.logDrain(taskId, entry.hours, entry.mind, entry.body);
		} else {
			observations.editDrainLog(recordId, entry.hours, entry.mind, entry.body);
		}

		closeDrainLog(taskId);
	}

	function deleteDrainLog(taskId: number, recordId: number) {
		removeLogWithUndo(session, observations, 'drain', recordId);
		closeDrainLog(taskId);
	}

	const daily = $derived(plan.daily);
	const metrics = $derived(buildMetrics(daily, session.pools, plan.remainingDay));
	const remainingSuggestedHours = $derived(daily.remainingSuggestedHours.toFixed(2));
	const advice = $derived(plan.advice ? buildAdviceDisplay(plan.advice, getDateLocale()) : null);

	// /?date=<today> renders the same view as / — collapse to the canonical URL. Also
	// fires when a viewed date BECOMES today at midnight rollover.
	const dateParam = $derived(page.url.searchParams.get('date'));
	$effect(() => {
		if (browser && dateParam === today) {
			goto(localizeHref(resolve('/')), {
				replaceState: true,
				noScroll: true,
				keepFocus: true,
			});
		}
	});

	// Navigate to a day; the store follows the URL and loads it.
	function gotoDate(newDate: string) {
		goto(localizeHref(newDate === today ? resolve('/') : `${resolve('/')}?date=${newDate}`), {
			noScroll: true,
			keepFocus: true,
		});
	}

	function formatDisplayDate(dateStr: string): string {
		return fromISO(dateStr).toLocaleDateString(getDateLocale(), {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		});
	}
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
		inLanguage: [...locales],
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD',
		},
	}}
/>

<PageHeader
	completedTasks={daily.completedTasks}
	totalTasks={daily.totalTasks}
	{selectedDate}
	{today}
	ondatechange={gotoDate}
	yesterdaySession={session.yesterdaySession}
	routines={session.routines}
	currentTasks={tasks}
	onimport={(t) => session.importTasks(t)}
	onimportdate={(d) => session.importFromDate(d)}
	onsaveroutine={(name) => session.saveCurrentAsRoutine(name)}
	ondeleteroutine={(id) => session.deleteRoutine(id)}
/>

{#snippet addTaskForm()}
	<TaskForm
		onsubmit={(t) => session.addTask(t)}
		suggest={(query) => session.suggestTitles(query)}
		isOpen={tasks.length === 0}
	/>
{/snippet}

<!-- Outside the grid: full width is what lets the bar's four inputs sit on one
     row instead of stacking 2×2 in the narrower task column. -->
<div class="space-y-grid-lg min-h-screen">
	{#if isViewingFuture}
		<div class="p-box-md rounded-xl border border-info/20 bg-info/5 text-info-strong text-sm">
			<span class="font-medium">{m.banner_future_title()}</span>
			{m.banner_future_body({
				date: formatDisplayDate(selectedDate),
			})}
		</div>
	{/if}

	{#if isViewingPast}
		<div
			class="p-box-md rounded-xl border border-warning/20 bg-warning/5 text-warning-strong text-sm"
		>
			<span class="font-medium">{m.banner_past_title()}</span>
			{m.banner_past_body()}
		</div>
	{:else}
		<!-- Keyed so each day asks once whether it needs its constraints open: the hours
		     read 0 until a day lands (forever on the server, which has no IndexedDB), so
		     asking any earlier opens the panel for every visitor. -->
		{#key session.loadedDate}
			<DayConstraintsBar
				bind:availableHours={session.availableHours}
				bind:switchCost={session.switchCost}
				bind:cognitivePool={session.cognitivePool}
				bind:physicalPool={session.physicalPool}
				{remainingSuggestedHours}
				planSlackHours={daily.planSlackHours}
				constantsFitted={session.constantsFit.fitted}
				flowLogs={session.flowObservations}
				pendingFlowLogs={session.pendingFlowLogCount}
				{canLog}
				onresetlogs={() => session.resetFlowLogs()}
				isOpen={session.loadedDate !== null && session.availableHours <= 0}
			/>
		{/key}
	{/if}

	<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
		<!-- `min-w-0`: a grid item's automatic minimum is its content's min-content
		     width, and "Next" holds a `nowrap` title, so without this the column is
		     sized by the longest task name and the whole page scrolls sideways on a
		     phone. It is what lets that title's `truncate` fire at all. -->
		<div class="space-y-grid-lg lg:col-span-2 min-w-0">
			<TaskList
				suggestedTasks={daily.suggestedTasks}
				runOrder={daily.runOrder}
				remainingDay={plan.remainingDay}
				nextTaskTitle={plan.remainingDay?.nextTask?.title}
				ontoggle={(id) => session.toggleTask(id)}
				onremove={isViewingPast ? undefined : removeTask}
				{flowDrafts}
				{flowLogs}
				onflowopen={canLog ? openFlowLog : undefined}
				onflowedit={openFlowLog}
				onflowclose={closeFlowLog}
				onlogflow={saveFlowLog}
				onflowdelete={clearFlowLog}
				{drainDrafts}
				{drainLogs}
				ondrainopen={canLog ? openDrainLog : undefined}
				ondrainclose={closeDrainLog}
				ondrainsave={saveDrainLog}
				ondrainedit={editDrainLog}
				ondraindelete={deleteDrainLog}
				onupdate={isViewingPast
					? undefined
					: (taskId, changes) => session.updateTask(taskId, changes)}
				form={isViewingPast ? undefined : addTaskForm}
			/>

			{#if !isViewingPast && tasks.length > 0}
				<PlanAdviceCard
					{advice}
					isBusy={plan.isAdviceBusy}
					isStale={plan.isAdviceStale}
					hasError={plan.hasAdviceError}
					oncheck={() => plan.computeAdvice()}
					onapply={(id) => session.moveTaskToTomorrow(id)}
					onapplybudget={(hours) => (session.availableHours = hours)}
				/>
			{/if}
		</div>

		<div class="space-y-grid-md lg:sticky lg:top-page">
			<MetricsDashboard {metrics} momentum={daily.totalTasks > 0 ? daily.momentum : null} />
		</div>
	</div>
</div>

<FallowExplainer />
