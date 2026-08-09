<script lang="ts">
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
		newDrainDraft,
		type DrainDraft,
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

	// Shared daily session (tasks, budget, pools + persistence) — set in the
	// (app) layout, also consumed live by the Energy Lab.
	const session = getSessionStore();
	const observations = getEnergyObservationStore();

	// The whole dashboard — plan and metrics — from the business layer. The
	// per-metric task scoping and thresholds live there and in
	// metric-descriptor; this page only renders what comes back.
	const plan = setDailyPlanStore(session, observations);

	const today = $derived(session.today);
	const selectedDate = $derived(session.selectedDate);
	const isViewingPast = $derived(session.isViewingPast);
	const isViewingFuture = $derived(session.isViewingFuture);
	const tasks = $derived(session.tasks);

	// One value, three consumers that must agree: only today's session can be measured
	// — both stores stamp an observation with the LIVE clock's today, never the viewed
	// day, so a ⚡ or 🪫 logged while browsing a past day would misdate itself. The
	// callbacks and the bar's prompt for them therefore appear and vanish together, so
	// the prompt never points at a button no task renders.
	const canLog = $derived(selectedDate === today);

	// The open 🪫 editors, by task — one per row, like ⚡: ticking two tasks off ends two
	// sessions, and each gets its prompt. Owned here rather than by the row for the
	// reason in `DrainDraft`, and shaped exactly like the Lab's so the two screens
	// cannot drift apart again. A draft whose row is gone (delete, date change, midnight
	// rollover) is inert: it is keyed by that task and nothing else reads it.
	let drainDrafts = $state<Record<number, DrainDraft>>({});

	const openDrainLog = (id: number, source: EditorSource) =>
		(drainDrafts[id] = newDrainDraft(source));

	const closeDrainLog = (id: number) => {
		delete drainDrafts[id];
	};

	// Correcting a rating is the Lab's calibration card, which is where the day's ratings
	// are listed; this screen only adds sessions.
	const drainMeasured = $derived(observations.drainMeasuredToday);

	function saveDrainLog(id: number, entry: { hours: number; mind: number; body: number }) {
		observations.logDrain(id, entry.hours, entry.mind, entry.body);
		closeDrainLog(id);
	}

	const daily = $derived(plan.daily);
	const metrics = $derived(buildMetrics(daily, session.pools));
	const remainingSuggestedHours = $derived(daily.remainingSuggestedHours.toFixed(2));
	const advice = $derived(plan.advice ? buildAdviceDisplay(plan.advice, getDateLocale()) : null);

	// /?date=<today> renders the same view as / — collapse to the canonical
	// URL. Also fires when a viewed date BECOMES today at midnight rollover.
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

<!-- Lives in the task-list card so adding and reading the plan are one place;
     passed as a snippet rather than imported there, per the components-take-props
     rule. -->
{#snippet addTaskForm()}
	<TaskForm
		onsubmit={(t) => session.addTask(t)}
		suggest={(query) => session.suggestTitles(query)}
		isOpen={tasks.length === 0}
	/>
{/snippet}

<!-- The day's banner and constraints span both columns: they scope the whole
     page, and full width is what lets the four inputs sit on one row instead of
     stacking 2×2 inside the narrower task column. -->
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
		<!-- Keyed on the loaded day, so each day gets a fresh bar that asks once whether
		     it needs its constraints open. `loadedDate` is the only honest moment to ask:
		     the hours read 0 until a day lands — forever on the server, which has no
		     IndexedDB — and reading them any earlier opens the panel for every visitor,
		     including the one whose day is already set. -->
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
				ondeletelog={(id) => session.deleteFlowLog(id)}
				onresetlogs={() => session.resetFlowLogs()}
				isOpen={session.loadedDate !== null && session.availableHours <= 0}
			/>
		{/key}
	{/if}

	<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
		<div class="space-y-grid-lg lg:col-span-2">
			<TaskList
				suggestedTasks={daily.suggestedTasks}
				runOrder={daily.runOrder}
				remainingDay={plan.remainingDay}
				ontoggle={(id) => session.toggleTask(id)}
				onremove={isViewingPast ? undefined : (id) => removeTaskWithUndo(session, id)}
				onlogflow={canLog ? (id, minutes) => session.logFlow(id, minutes) : undefined}
				{drainDrafts}
				{drainMeasured}
				ondrainopen={canLog ? openDrainLog : undefined}
				ondrainclose={canLog ? closeDrainLog : undefined}
				ondrainsave={canLog ? saveDrainLog : undefined}
				onupdate={isViewingPast ? undefined : (id, changes) => session.updateTask(id, changes)}
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
