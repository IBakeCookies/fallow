<script lang="ts">
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import type { TitleRating } from '$lib/business/model/title-memory';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { buildDayTimeline } from '$lib/presentation/utils/day-timeline';
	import { buildMetrics } from '$lib/presentation/utils/metric-descriptor';
	import {
		buildAdviceDisplay,
		describeDeferDestination,
	} from '$lib/presentation/utils/plan-advice-descriptor';
	import { removeTaskWithUndo } from '$lib/presentation/utils/remove-task-with-undo';
	import {
		carryUnfinishedWithUndo,
		moveTaskToTomorrowWithUndo,
	} from '$lib/presentation/utils/carry-with-undo';
	import { getDemoHref } from '$lib/presentation/utils/demo-link';
	import {
		removeFlowLogWithUndo,
		removeLogWithUndo,
	} from '$lib/presentation/utils/remove-log-with-undo';
	import {
		claimPendingMinutes,
		drainDraftFromLog,
		newDrainDraft,
		newEditorDraft,
		spendsPendingMinutes,
		type DrainDraft,
		type EditorDraft,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import TaskFormPreview from '$lib/presentation/component/task-form-preview.svelte';
	import DayActions from '$lib/presentation/component/day-actions.svelte';
	import TaskList from '$lib/presentation/component/task-list.svelte';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';
	import DayLegend from '$lib/presentation/component/day-legend.svelte';
	import DayTimeline from '$lib/presentation/component/day-timeline.svelte';
	import MetricHeadlineStrip from '$lib/presentation/component/metric-headline-strip.svelte';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';
	import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';
	import FallowExplainer from '$lib/presentation/component/fallow-explainer.svelte';
	import { setDailyPlanStore } from '$lib/business/store/daily-plan-store.svelte';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { getEnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import { getSessionTimerStore } from '$lib/business/store/session-timer-store.svelte';
	import { fromISO } from '$lib/business/utils/date';
	import { getPendingMinutes, suggestTargetMinutes } from '$lib/business/utils/session-timer';

	const session = getSessionStore();
	const observations = getEnergyObservationStore();
	const timerStore = getSessionTimerStore();
	const lab = getEnergyLabStore();

	const plan = setDailyPlanStore(session, observations);

	const today = $derived(session.today);
	const selectedDate = $derived(session.selectedDate);
	const isViewingPast = $derived(session.isViewingPast);
	const isViewingFuture = $derived(session.isViewingFuture);
	const tasks = $derived(session.tasks);

	// Gates logging, not correcting. Why: presentation/AGENTS.md, "Both writers are
	// offered on any day up to today, the timer only today".
	// Not on the example day: a ⚡ or 🪫 rating is a real measurement, and one taken
	// against a fabricated task would land in the visitor's own model fit.
	const canLog = $derived(selectedDate <= today && !session.isDemo);

	let flowDrafts = $state<Record<number, EditorDraft>>({});
	let drainDrafts = $state<Record<number, DrainDraft>>({});

	const openFlowLog = (taskId: number, source: EditorSource) =>
		(flowDrafts[taskId] = newEditorDraft(source));

	const closeFlowLog = (taskId: number) => {
		delete flowDrafts[taskId];
	};

	// The timer's minutes were counted today, so only today's 🪫 may take or spend them.
	const pendingMinutes = $derived(isViewingPast ? null : getPendingMinutes(timerStore.timer));

	const openDrainLog = (taskId: number, source: EditorSource) =>
		(drainDrafts[taskId] = newDrainDraft(source, claimPendingMinutes(drainDrafts, pendingMinutes)));

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

	// The advisor's move drops the row too, so its editors go the same way: an open
	// 🪫 draft left behind holds the stopped timer's minutes (`claimPendingMinutes`)
	// against a row that is no longer on the day.
	function moveTaskToTomorrow(taskId: number) {
		closeFlowLog(taskId);
		closeDrainLog(taskId);
		moveTaskToTomorrowWithUndo(session, taskId);
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

	// Re-logging a correction would count the session's hours twice.
	function saveDrainLog(taskId: number, entry: { hours: number; mind: number; body: number }) {
		const draft = drainDrafts[taskId];

		if (draft.recordId === undefined) {
			observations.logDrain(taskId, entry.hours, entry.mind, entry.body);

			// One stop funds one log: the editor that claimed the reading is the one that
			// spends it — no other row's append, and no correction.
			if (spendsPendingMinutes(draft, pendingMinutes)) timerStore.timer = null;
		} else {
			observations.editDrainLog(draft.recordId, entry.hours, entry.mind, entry.body);
		}

		closeDrainLog(taskId);
	}

	function deleteDrainLog(taskId: number, recordId: number) {
		removeLogWithUndo(session, observations, 'drain', recordId);
		closeDrainLog(taskId);
	}

	const daily = $derived(plan.daily);
	const metrics = $derived(buildMetrics(daily, session.pools, plan.remainingDay));
	// The two inputs every headline reading is gated on in `buildMetrics`.
	const hasPlan = $derived(daily.totalTasks > 0 && daily.budgetHours > 0);
	const remainingSuggestedHours = $derived(daily.remainingSuggestedHours.toFixed(2));
	const timeline = $derived(
		buildDayTimeline({
			suggestedTasks: daily.suggestedTasks,
			runOrder: daily.runOrder,
			switchCost: session.switchCost,
			availableHours: daily.budgetHours,
		}),
	);
	const advice = $derived(plan.advice ? buildAdviceDisplay(plan.advice, getDateLocale()) : null);
	const destination = $derived(describeDeferDestination(plan.deferDestination));

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

<!-- The app bar already draws the name, so this one is for the document: the
     explainer below opens at `<h2>` and an indexed page needs an `<h1>` above it. -->
<h1 class="sr-only">{m.app_name()}</h1>

{#snippet dayActions()}
	<DayActions
		{selectedDate}
		{today}
		yesterdaySession={session.yesterdaySession}
		routines={session.routines}
		currentTasks={tasks}
		bind:timer={timerStore.timer}
		getSuggestedMinutes={() => suggestTargetMinutes(lab.stopAdvice)}
		onimport={(t) => session.importTasks(t)}
		onimportdate={(d) => session.importFromDate(d)}
		onsaveroutine={(name) => session.saveCurrentAsRoutine(name)}
		ondeleteroutine={(id) => session.deleteRoutine(id)}
		carryCount={session.carryableCount}
		oncarry={() => carryUnfinishedWithUndo(session)}
	/>
{/snippet}

<!-- The axis, withheld on an empty day: the card's own empty state already says there
     is nothing, and "nothing is funded" would say it a second time. -->
{#snippet dayStrip()}
	<DayTimeline {...timeline} class="m-0" />
{/snippet}

{#snippet dayFoot()}
	<DayLegend switchHours={session.switchCost} />
{/snippet}

<!-- No `{#key}` and no "is it open" reading of the day: the card mounts this in a
     dialog, which renders it only while open, so every opening is already a fresh
     form and nothing has to know whether the day has landed. -->
{#snippet addTaskForm(close: () => void)}
	<TaskForm
		oncancel={close}
		onsubmit={(t) => {
			session.addTask(t);
			// The panel's ranking is now about the day before this task, and the dialog
			// this deploy came from is still open, so its own mount cannot catch that.
			plan.computeNextTasks();
		}}
		suggest={(query) => session.suggestTitles(query)}
		tagVocabulary={session.tagVocabulary}
		ondraftchange={(d) => (plan.previewDraft = d)}
		preview={draftPreview}
	/>
{/snippet}

{#snippet draftPreview(pick: (rating: TitleRating) => void)}
	<TaskFormPreview
		impact={plan.draftImpact}
		nextTasks={plan.nextTasks}
		hasNextTaskRoom={plan.hasNextTaskRoom}
		onnexttasks={() => plan.computeNextTasks()}
		onpicknexttask={pick}
	/>
{/snippet}

<div class="space-y-grid-lg min-h-screen">
	{#if isViewingFuture}
		<div class="p-box-md rounded-xl border border-info-tint bg-info-wash text-info-strong text-sm">
			<span class="font-medium">{m.banner_future_title()}</span>
			{m.banner_future_body({
				date: formatDisplayDate(selectedDate),
			})}
		</div>
	{/if}

	<!-- A day that is not today says so before anything it changes: the banner is
	     the first thing read, above the readings it qualifies. -->
	{#if isViewingPast}
		<div
			class="p-box-md rounded-xl border border-warning-tint bg-warning-wash text-warning-strong text-sm"
		>
			<span class="font-medium">{m.banner_past_title()}</span>
			{m.banner_past_body()}
		</div>
	{/if}

	<!-- The verdict comes before the setup that produces it, so a returning user
	     reads how today stands without scrolling past the plan — but only once
	     there is a plan to judge. With no tasks or no budget all four tiles read
	     N/A, and four N/As above the card that would fix them is the worst first
	     thing the app can show. -->
	{#if hasPlan}
		<MetricHeadlineStrip {metrics} momentum={daily.totalTasks > 0 ? daily.momentum : null} />
	{/if}

	<!-- Keyed so each day asks once whether it needs its constraints open: the hours
	     read 0 until a day lands (forever on the server, which has no IndexedDB), so
	     asking any earlier opens the panel for every visitor. -->
	{#key session.loadedDate}
		<DayConstraintsBar
			bind:availableHours={session.availableHours}
			bind:switchCost={session.switchCost}
			bind:cognitivePool={session.cognitivePool}
			bind:physicalPool={session.physicalPool}
			fittedCognitivePool={plan.fittedPools.cognitiveHours}
			fittedPhysicalPool={plan.fittedPools.physicalHours}
			{remainingSuggestedHours}
			planSlackHours={daily.planSlackHours}
			planSwitchHours={daily.planSwitchHours}
			isOpen={session.loadedDate !== null && session.availableHours <= 0}
		/>
	{/key}

	<!-- The ledger takes the whole width and the full readings sit under it: they
	     are what you read after the plan, not beside it. Only the verdict strip
	     goes above, and it is four tiles rather than the grid that used to put the
	     first task past the fold at every desktop size. -->
	<div class="space-y-grid-xl">
		<div class="space-y-grid-lg">
			<TaskList
				suggestedTasks={daily.suggestedTasks}
				runOrder={daily.runOrder}
				viewedDate={selectedDate}
				constantsFitted={session.constantsFit.fitted}
				tagVocabulary={session.tagVocabulary}
				remainingDay={plan.remainingDay}
				nextTaskId={plan.remainingDay?.nextTask?.id}
				ontoggle={(id) => session.toggleTask(id)}
				onremove={removeTask}
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
				onupdate={(taskId, changes) => session.updateTask(taskId, changes)}
				form={addTaskForm}
				strip={daily.suggestedTasks.length ? dayStrip : undefined}
				{timeline}
				foot={timeline.blocks.length ? dayFoot : undefined}
				actions={dayActions}
				exampleDayHref={session.isDemo || isViewingPast ? undefined : getDemoHref()}
			/>

			<MetricsDashboard {metrics} />

			{#if !isViewingPast && tasks.length > 0}
				<PlanAdviceCard
					{advice}
					isBusy={plan.isAdviceBusy}
					isStale={plan.isAdviceStale}
					{destination}
					hasError={plan.hasAdviceError}
					oncheck={() => plan.computeAdvice()}
					onapply={moveTaskToTomorrow}
					onapplybudget={(hours) => (session.availableHours = hours)}
				/>
			{/if}
		</div>
	</div>
</div>

<FallowExplainer />
