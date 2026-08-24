<script lang="ts">
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
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
		removeFlowLogWithUndo,
		removeLogWithUndo,
	} from '$lib/presentation/utils/remove-log-with-undo';
	import {
		getPendingMinutes,
		readSessionTimer,
		writeSessionTimer,
		type SessionTimer,
	} from '$lib/presentation/utils/session-timer';
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
	import DayActions from '$lib/presentation/component/day-actions.svelte';
	import TaskList from '$lib/presentation/component/task-list.svelte';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';
	import DayTimeline from '$lib/presentation/component/day-timeline.svelte';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';
	import PlanAdviceCard from '$lib/presentation/component/plan-advice-card.svelte';
	import FlowCalibrationCard from '$lib/presentation/component/flow-calibration-card.svelte';
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

	// The day's timer is this page's state, not a store's: the control on the Tasks
	// card and the 🪫 editor its reading fills are both here.
	// svelte-ignore state_referenced_locally -- the day the page opened on
	let sessionTimer = $state<SessionTimer | null>(browser ? readSessionTimer(today) : null);

	// `today` is live — midnight, or a tab refocused the next morning — and minutes
	// counted yesterday cannot fill today's 🪫 log. The read at init cannot cover it: a
	// page left open never reaches it again.
	$effect(() => {
		if (sessionTimer !== null && sessionTimer.startedOn !== today) sessionTimer = null;
	});

	$effect(() => {
		writeSessionTimer(sessionTimer);
	});

	const openFlowLog = (taskId: number, source: EditorSource) =>
		(flowDrafts[taskId] = newEditorDraft(source));

	const closeFlowLog = (taskId: number) => {
		delete flowDrafts[taskId];
	};

	const openDrainLog = (taskId: number, source: EditorSource) =>
		(drainDrafts[taskId] = newDrainDraft(
			source,
			claimPendingMinutes(drainDrafts, getPendingMinutes(sessionTimer)),
		));

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
		const draft = drainDrafts[taskId];

		if (draft.recordId === undefined) {
			observations.logDrain(taskId, entry.hours, entry.mind, entry.body);

			// One stop funds one log: the editor that claimed the reading is the one that
			// spends it — no other row's append, and no correction.
			if (spendsPendingMinutes(draft, getPendingMinutes(sessionTimer))) sessionTimer = null;
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
		bind:timer={sessionTimer}
		onimport={(t) => session.importTasks(t)}
		onimportdate={(d) => session.importFromDate(d)}
		onsaveroutine={(name) => session.saveCurrentAsRoutine(name)}
		ondeleteroutine={(id) => session.deleteRoutine(id)}
	/>
{/snippet}

<!-- Withheld on an empty day: the card's own empty state already says there is
     nothing, and the strip's "nothing is funded" would say it a second time. -->
{#snippet dayStrip()}
	<DayTimeline {...timeline} />
{/snippet}

{#snippet addTaskForm()}
	<!-- Keyed like the constraints bar: the task count reads 0 until a day lands, so a
	     form sampled any earlier opens for every visitor. -->
	{#key session.loadedDate}
		<TaskForm
			onsubmit={(t) => session.addTask(t)}
			suggest={(query) => session.suggestTitles(query)}
			isOpen={session.loadedDate !== null && tasks.length === 0}
		/>
	{/key}
{/snippet}

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
				isOpen={session.loadedDate !== null && session.availableHours <= 0}
			/>
		{/key}
	{/if}

	<!-- The ledger takes the whole width and the readings sit under it: twelve columns
	     have nowhere to go in two thirds of a page, and the metrics are what you read
	     after the plan, not beside it. -->
	<div class="space-y-grid-xl">
		<div class="space-y-grid-lg">
			<TaskList
				suggestedTasks={daily.suggestedTasks}
				runOrder={daily.runOrder}
				viewedDate={selectedDate}
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
				strip={daily.suggestedTasks.length ? dayStrip : undefined}
				actions={dayActions}
			/>

			<MetricsDashboard {metrics} momentum={daily.totalTasks > 0 ? daily.momentum : null} />

			<!-- What the model was fitted from, then what it makes of today: the fit is a
			     standing statement and reads first, the advice is the day's own reading.
			     Half each. -->
			<div class="grid gap-grid-lg lg:grid-cols-2">
				<FlowCalibrationCard
					constantsFitted={session.constantsFit.fitted}
					logCount={session.flowObservations.length}
					pendingLogs={session.pendingFlowLogCount}
					onresetlogs={() => session.resetFlowLogs()}
				/>

				{#if !isViewingPast && tasks.length > 0}
					<div>
						<PlanAdviceCard
							{advice}
							isBusy={plan.isAdviceBusy}
							isStale={plan.isAdviceStale}
							{destination}
							hasError={plan.hasAdviceError}
							oncheck={() => plan.computeAdvice()}
							onapply={(id) => session.moveTaskToTomorrow(id)}
							onapplybudget={(hours) => (session.availableHours = hours)}
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<FallowExplainer />
