<script lang="ts">
	import { onMount } from 'svelte';
	import { logError } from '$lib/logger';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import { removeTaskWithUndo } from '$lib/presentation/utils/remove-task-with-undo';
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
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { seriesColors } from '$lib/presentation/utils/series-color';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';
	import { Button } from '$lib/presentation/component/ui/button';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import TaskFormEnergyPreview from '$lib/presentation/component/task-form-energy-preview.svelte';
	import DayActions from '$lib/presentation/component/day-actions.svelte';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import { getEnergyTaskColumns } from '$lib/presentation/utils/ledger-column';
	import EnergyChart from '$lib/presentation/component/energy-chart.svelte';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';
	import PlanTimelineBar from '$lib/presentation/component/plan-timeline-bar.svelte';
	import PlanScheduleList from '$lib/presentation/component/plan-schedule-list.svelte';
	import PlanSummary from '$lib/presentation/component/plan-summary.svelte';
	import BudgetCurveCard from '$lib/presentation/component/budget-curve-card.svelte';
	import StopAdvisorCard from '$lib/presentation/component/stop-advisor-card.svelte';
	import ParamRow from '$lib/presentation/component/param-row.svelte';
	import { BUDGET_BOUNDS } from '$lib/presentation/utils/budget-bounds';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';
	import FitLogSummary from '$lib/presentation/component/fit-log-summary.svelte';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { getEnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import { getSessionTimerStore } from '$lib/business/store/session-timer-store.svelte';
	import { getPendingMinutes } from '$lib/business/utils/session-timer';
	import type { DrainObservationRecord, Persisted } from '$lib/business/type';

	const VIEW_KEY = 'zenith-energy-view';

	const decimal = (value: number, digits: number) => formatDecimals(value, digits, getDateLocale());

	const session = getSessionStore();
	const completedTaskIds = $derived(session.tasks.filter((t) => t.completed).map((t) => t.id));

	const observations = getEnergyObservationStore();

	const lab = getEnergyLabStore();

	const timerStore = getSessionTimerStore();

	const tasks = $derived(lab.scheduledTasks);
	const hasTasks = $derived(tasks.length > 0);
	const params = $derived(lab.params);
	const plan = $derived(lab.plan);
	const trajectory = $derived(lab.trajectory);
	const windowHours = $derived(session.availableHours);
	const trailingFreeHours = $derived(lab.trailingFreeHours);
	const valueVsClassic = $derived(lab.valueVsClassic);
	const cogDrainFit = $derived(lab.cognitiveDrainFit);
	const physDrainFit = $derived(lab.physicalDrainFit);
	const recoveryFit = $derived(lab.recoveryFit);
	const pendingRestLogs = $derived(lab.pendingRestLogCount);
	const stopFit = $derived(lab.stoppingFit);
	const stopAdvice = $derived(lab.stopAdvice);
	const budgetCurve = $derived(lab.budgetCurve);
	// The lookup always resolves; '' only satisfies the type where the verdict carries no task.
	const stopTaskTitle = $derived(
		stopAdvice !== null && stopAdvice.verdict !== 'window-full'
			? (tasks.find((t) => t.id === stopAdvice.taskId)?.title ?? '')
			: '',
	);

	let planView = $state<'chart' | 'schedule'>('chart');
	const planViewItems = $derived([
		{
			value: 'chart' as const,
			label: m.energy_view_chart(),
		},
		{
			value: 'schedule' as const,
			label: m.energy_schedule(),
		},
	]);

	function setPlanView(view: 'chart' | 'schedule') {
		planView = view;

		try {
			localStorage.setItem(VIEW_KEY, view);
		} catch {
			// private-mode storage failures just lose the preference
		}
	}

	onMount(() => {
		// Why: presentation/AGENTS.md, "The Lab's task list reads in schedule order, snapshotted per visit"
		lab.resnapshotOrder();

		try {
			const savedView = localStorage.getItem(VIEW_KEY);

			if (savedView === 'chart' || savedView === 'schedule') planView = savedView;
		} catch (e) {
			logError('Failed to load energy lab view preference', e);
		}
	});

	// ---------- Drain calibration (α fit from end-of-session ratings) ----------

	const drainObservations = $derived(observations.drainObservations);

	// Why: presentation/AGENTS.md, "Both editors are open only while the PAGE holds a draft for that task"
	let flowDrafts = $state<Record<number, EditorDraft>>({});
	let drainDrafts = $state<Record<number, DrainDraft>>({});

	const openFlowLog = (taskId: number, source: EditorSource) =>
		(flowDrafts[taskId] = newEditorDraft(source));

	const closeFlowLog = (taskId: number) => {
		delete flowDrafts[taskId];
	};

	function saveFlowLog(taskId: number, minutes: number) {
		session.logFlow(taskId, minutes);
		closeFlowLog(taskId);
	}

	function clearFlowLog(taskId: number) {
		removeFlowLogWithUndo(session, taskId);
		closeFlowLog(taskId);
	}

	const closeDrainLog = (taskId: number) => {
		delete drainDrafts[taskId];
	};

	// ✕ then Undo restores the task under its original id, so a surviving draft re-opens with it.
	function removeTask(taskId: number) {
		closeFlowLog(taskId);
		closeDrainLog(taskId);
		removeTaskWithUndo(session, taskId);
	}

	// This route is today-only — a dated URL redirects (`energy/+page.ts`).
	const drainLogs = $derived(observations.drainLogsOn(session.today));
	const flowLogs = $derived(session.flowMinutesOn(session.today));

	// The stopped timer seeds the 🪫 editors here under the same claim (one stop funds
	// one log), whichever screen stopped it.
	const openDrainLog = (taskId: number, source: EditorSource) =>
		(drainDrafts[taskId] = newDrainDraft(
			source,
			claimPendingMinutes(drainDrafts, getPendingMinutes(timerStore.timer)),
		));

	const editDrainLog = (taskId: number, log: Persisted<DrainObservationRecord>) =>
		(drainDrafts[taskId] = drainDraftFromLog(log));

	// Only the draft remembers whether a chip opened it, so new-vs-correction is the page's.
	function saveDrainLog(taskId: number, entry: { hours: number; mind: number; body: number }) {
		const draft = drainDrafts[taskId];

		if (draft.recordId === undefined) {
			observations.logDrain(taskId, entry.hours, entry.mind, entry.body);

			if (spendsPendingMinutes(draft, getPendingMinutes(timerStore.timer))) timerStore.timer = null;
		} else {
			observations.editDrainLog(draft.recordId, entry.hours, entry.mind, entry.body);
		}

		closeDrainLog(taskId);
	}

	function deleteDrainLog(taskId: number, recordId: number) {
		removeLogWithUndo(session, observations, 'drain', recordId);
		closeDrainLog(taskId);
	}

	// ---------- Recovery calibration (r fit from pre/post-rest pairs) ----------

	const restObservations = $derived(observations.restObservations);

	// ☕ has no task row to hang off, and nothing outside the form gates on its draft.
	let restFormOpen = $state(false);

	function saveRestLog(entry: {
		hours: number;
		mindBefore: number;
		mindAfter: number;
		bodyBefore: number;
		bodyAfter: number;
	}) {
		observations.logRest(
			entry.hours,
			entry.mindBefore,
			entry.mindAfter,
			entry.bodyBefore,
			entry.bodyAfter,
		);

		restFormOpen = false;
	}

	// ---------- Presentation helpers ----------

	// Each fit, formatted for the parameter row it fits: `null` where the logs carry no
	// signal, `undefined` where there are no logs to carry one.
	const drainReading = (fit: typeof cogDrainFit) =>
		drainObservations.length === 0
			? undefined
			: fit.fitted
				? m.energy_fit_value({
						value: decimal(fit.alpha, 2),
						std: decimal(fit.alphaStd ?? 0, 2),
						count: fit.usedCount,
					})
				: null;

	const cogDrainReading = $derived(drainReading(cogDrainFit));
	const physDrainReading = $derived(drainReading(physDrainFit));

	const recoveryReading = $derived(
		restObservations.length === 0
			? undefined
			: recoveryFit.fitted
				? m.energy_fit_value({
						value: decimal(recoveryFit.rate, 2),
						std: decimal(recoveryFit.rateStd ?? 0, 2),
						count: recoveryFit.usedCount,
					})
				: null,
	);

	const stopReading = $derived(
		lab.stopObservationCount === 0
			? undefined
			: stopFit.fitted
				? m.energy_fit_value({
						value: decimal(stopFit.value, 2),
						std: decimal(stopFit.valueStd ?? 0, 2),
						count: stopFit.usedCount,
					})
				: null,
	);

	// One hue per task, shared by the timeline, the schedule list and the rows.
	const colors = $derived(seriesColors(lab.energyTasks.map((t) => t.id)));

	// Null with no plan: "no hours" against every task would be a claim the optimizer never made.
	const plannedFor = (taskId: number) =>
		plan.evaluation.blocks.length === 0 ? null : (lab.allocatedHoursByTask.get(taskId) ?? 0);

	function focusDayWindow() {
		document.getElementById('window-hours')?.focus();
	}
</script>

<SeoHead title={m.energy_title_head()} description={m.energy_meta_description()} />

{#snippet dayActions()}
	<div class="flex flex-wrap items-center gap-grid-xs">
		<!-- ☕ is a log of the day like ⏱ and 🪫, so it is typed here and not on the card
		     that reads its fit — which also puts it outside `hasTasks`. -->
		<button
			type="button"
			class="shrink-0 text-xs transition {restFormOpen
				? 'text-ty-silent hover:text-ty-secondary'
				: 'text-info/90 hover:text-info-strong'}"
			onclick={() => (restFormOpen = !restFormOpen)}
		>
			{restFormOpen ? m.common_cancel() : `☕ ${m.energy_log_rest()}`}
		</button>
		<DayActions
			selectedDate={session.selectedDate}
			today={session.today}
			yesterdaySession={session.yesterdaySession}
			routines={session.routines}
			currentTasks={session.tasks}
			bind:timer={timerStore.timer}
			onimport={(t) => session.importTasks(t)}
			onimportdate={(d) => session.importFromDate(d)}
			onsaveroutine={(name) => session.saveCurrentAsRoutine(name)}
			ondeleteroutine={(id) => session.deleteRoutine(id)}
		/>
	</div>
{/snippet}

{#snippet restForm()}
	{#if restFormOpen}
		<RestLogForm onsave={saveRestLog} oncancel={() => (restFormOpen = false)} />
	{/if}
{/snippet}

{#snippet addTaskForm(close: () => void)}
	<TaskForm
		oncancel={close}
		onsubmit={(t) => session.addTask(t)}
		suggest={(query) => session.suggestTitles(query)}
		tagVocabulary={session.tagVocabulary}
		withMustDoToday={false}
		ondraftchange={(d) => (lab.previewDraft = d)}
		preview={draftPrice}
		action={priceButton}
	/>
{/snippet}

{#snippet draftPrice()}
	<TaskFormEnergyPreview
		impact={lab.draftImpact}
		isBusy={lab.isDraftBusy}
		hasWindow={windowHours > 0}
	/>
{/snippet}

<!-- No window, no plan to price: the panel says so instead, and the press it
     would have to offer has nothing to solve. -->
{#snippet priceButton()}
	{#if windowHours > 0}
		<Button
			variant="outline"
			type="button"
			disabled={lab.previewDraft === null || lab.isDraftBusy}
			onclick={() => lab.computeDraftImpact(lab.previewDraft!)}
		>
			{m.form_impact_price()}
		</Button>
	{/if}
{/snippet}

{#snippet taskRows()}
	{#each tasks as task (task.id)}
		<EnergyTaskRow
			title={task.title}
			completed={task.completed}
			physicalDifficulty={task.physicalDifficulty}
			mentalDifficulty={task.mentalDifficulty}
			enjoyment={task.enjoyment}
			mustDoToday={task.mustDoToday}
			importance={task.importance}
			tags={task.tags}
			color={colors.colorOf(task.id)}
			trueEffort={task.trueEffort}
			plannedHours={plannedFor(task.id)}
			flowMinutes={flowLogs.get(task.id)}
			drainLogs={drainLogs.get(task.id) ?? []}
			flowDraft={flowDrafts[task.id] ?? null}
			drainDraft={drainDrafts[task.id] ?? null}
			ontoggle={() => session.toggleTask(task.id)}
			onremove={() => removeTask(task.id)}
			onflowopen={(source) => openFlowLog(task.id, source)}
			onflowedit={() => openFlowLog(task.id, 'button')}
			onflowclose={() => closeFlowLog(task.id)}
			onlogflow={(minutes) => saveFlowLog(task.id, minutes)}
			onflowdelete={() => clearFlowLog(task.id)}
			ondrainopen={(source) => openDrainLog(task.id, source)}
			ondrainclose={() => closeDrainLog(task.id)}
			ondrainsave={(entry) => saveDrainLog(task.id, entry)}
			ondrainedit={(log) => editDrainLog(task.id, log)}
			ondraindelete={(recordId) => deleteDrainLog(task.id, recordId)}
			onupdate={(edit) => session.updateTask(task.id, edit)}
		/>
	{/each}
{/snippet}

<!-- The nav's active link already draws the page's name, so this one is for the
     document: the explainer at the foot opens at `<h2>` and an indexed page needs an
     `<h1>` above it. -->
<h1 class="sr-only">{m.energy_heading()}</h1>

<!-- The level between the page title and the cards, which all head themselves at
     `<h3>`: nothing in the design draws it, and without it the outline skips. -->
<h2 class="sr-only">{m.energy_sections_heading()}</h2>

{#if session.isLoading || !lab.isLoaded}
	<!-- The pre-read state is not neutral: an empty list reads as "no open tasks" over a plan
	     the user has, and the parameter rows would show defaults before their saved values land. -->
	<div class="space-y-grid-lg" aria-hidden="true">
		<div class="card-shell p-box-md sm:p-box-xl">
			<div class="skeleton-block h-4 w-24"></div>
			<div class="skeleton-block mt-text-md h-102 w-full"></div>
		</div>
		<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
			<div class="space-y-grid-lg lg:col-span-2">
				<div class="card-shell p-box-md sm:p-box-xl">
					<div class="skeleton-block h-4 w-44"></div>
					<div class="skeleton-block mt-text-md h-74 w-full"></div>
				</div>
				<div class="card-shell p-box-md sm:p-box-xl">
					<div class="skeleton-block h-4 w-32"></div>
					<div class="skeleton-block mt-text-md h-52 w-full"></div>
				</div>
			</div>
			<div class="space-y-grid-lg">
				{#each [0, 1, 2, 3] as index (index)}
					<div class="card-shell p-box-md sm:p-box-xl">
						<div class="skeleton-block h-4 w-28"></div>
						<div class="skeleton-block mt-text-md h-11 w-full"></div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<Tooltip.Provider>
		<div class="space-y-grid-lg">
			<!-- The plan first and full width: it is the screen's answer, and the ledger
			     keeps its adjacency to the parameters by sharing a column, not the page's
			     top. An empty day has no plan and starts at the list. -->
			{#if hasTasks}
				<div class="card-shell p-box-md sm:p-box-xl">
					<div class="mb-text-sm flex flex-wrap items-center justify-between gap-grid-xs">
						<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
							{m.energy_optimized_day()}
						</h3>
						<!-- "0m work · 0m free" and a view switch over an empty region are
						     furniture the day window has not earned yet. -->
						{#if windowHours > 0}
							<div class="flex items-center gap-grid-xs">
								<span class="text-xs text-ty-silent">
									{m.energy_work_free_summary({
										work: formatDuration(plan.evaluation.workHours),
										free: formatDuration(plan.evaluation.leisureHours),
									})}
								</span>
								<SegmentedToggle
									items={planViewItems}
									value={planView}
									onchange={setPlanView}
									label={m.energy_view_group()}
									tone="plan"
								/>
							</div>
						{/if}
					</div>
					{#if windowHours > 0}
						<PlanTimelineBar
							blocks={plan.evaluation.blocks}
							{windowHours}
							{trailingFreeHours}
							{colors}
							{completedTaskIds}
						/>

						<div>
							{#if planView === 'chart'}
								<EnergyChart {trajectory} {windowHours} />
							{:else}
								<PlanScheduleList
									blocks={plan.evaluation.blocks}
									{windowHours}
									{trailingFreeHours}
									plannedHours={lab.plannedHours}
									{colors}
									locale={getDateLocale()}
									{completedTaskIds}
								/>
							{/if}
						</div>

						<PlanSummary
							totalOutput={decimal(plan.evaluation.totalOutput, 1)}
							endCog={plan.evaluation.workEndCog}
							endPhys={plan.evaluation.workEndPhys}
							workHours={plan.evaluation.workHours}
							{valueVsClassic}
						/>
					{:else}
						<button
							type="button"
							class="hint-underline text-sm text-ty-secondary transition hover:text-ty-primary"
							onclick={focusDayWindow}
						>
							{m.energy_set_window()}
						</button>
					{/if}
				</div>
			{/if}

			<!-- One grid and not two, so the read-outs stack at their own heights beside
			     the wide column. With no tasks there is nothing to read out. -->
			<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
				<div class="space-y-grid-lg {hasTasks ? 'lg:col-span-2' : 'lg:col-span-3'}">
					<TaskListCard
						form={addTaskForm}
						heading={dayActions}
						strip={restForm}
						columns={getEnergyTaskColumns()}
						rows={hasTasks ? taskRows : null}
					/>

					<!-- Everything past the list describes a plan, so an empty day stops here:
					     the list's form is where the first task gets typed. -->
					{#if hasTasks}
						<div class="card-shell p-box-md sm:p-box-xl">
							<div class="gap-text-xs flex flex-wrap items-baseline justify-between">
								<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
									{m.energy_model_parameters()}
								</h3>

								<div class="flex flex-wrap items-center gap-grid-xs">
									<!-- One button for all four fits because their ORDER is the math (MATH.md
						§8.7/§8.9/§8.10): separate buttons let the user apply them in an order
						that leaves a parameter stale. -->
									{#if lab.hasFit}
										<button
											type="button"
											class="text-xs transition {lab.fitsApplied
												? 'cursor-default text-ty-silent'
												: 'text-brand/90 hover:text-brand-strong'}"
											disabled={lab.fitsApplied}
											title={m.energy_apply_fits_title()}
											onclick={() => lab.applyFits()}
										>
											{lab.fitsApplied ? m.energy_fits_applied() : m.energy_apply_fits()}
										</button>
									{/if}

									<button
										type="button"
										class="text-xs text-ty-silent transition hover:text-ty-secondary"
										title={m.energy_reset_defaults_title()}
										onclick={() => lab.resetParams()}
									>
										{m.energy_reset_defaults()}
									</button>
								</div>
							</div>

							<!-- A grid and not `columns-*`: column flow can break a stepper across a
					     column boundary, and a stepper is a control, not a paragraph. -->
							<div class="mt-text-md grid gap-grid-md sm:grid-cols-2 xl:grid-cols-3">
								<!-- The window is the session's budget, not a lab param — hence step 0.25
					     and not 0.5: the stepper rounds to its own step's decimals, so a 6.25h
					     day set on the main page would come back 6.8 after one click here. -->
								<ParamRow
									id="window-hours"
									label={m.energy_day_window()}
									hint={m.energy_day_window_hint()}
									value={windowHours}
									onchange={(v) => (session.availableHours = v)}
									min={BUDGET_BOUNDS.min}
									max={BUDGET_BOUNDS.max}
									step={BUDGET_BOUNDS.step}
									unit={m.unit_hours()}
								/>
								<ParamRow
									id="alpha-cog"
									label={m.energy_cognitive_drain()}
									hint={m.energy_cognitive_drain_hint()}
									value={params.alphaCog}
									onchange={(v) => lab.setParam('alphaCog', v)}
									min={0.05}
									max={2}
									step={0.05}
									unit={m.unit_per_hour()}
									accent="focus-within:border-mind/50"
									fit={cogDrainReading}
								/>
								<ParamRow
									id="alpha-phys"
									label={m.energy_physical_drain()}
									hint={m.energy_physical_drain_hint()}
									value={params.alphaPhys}
									onchange={(v) => lab.setParam('alphaPhys', v)}
									min={0.05}
									max={2}
									step={0.05}
									unit={m.unit_per_hour()}
									accent="focus-within:border-body/50"
									fit={physDrainReading}
								/>
								<ParamRow
									id="recovery-rate"
									label={m.energy_recovery_rate()}
									hint={m.energy_recovery_rate_hint()}
									value={params.recoveryRate}
									onchange={(v) => lab.setParam('recoveryRate', v)}
									min={0.1}
									max={3}
									step={0.1}
									unit={m.unit_per_hour()}
									fit={recoveryReading}
								/>
								<ParamRow
									id="free-time-value"
									label={m.energy_free_time_value()}
									hint={m.energy_free_time_value_hint()}
									value={params.freeTimeValue}
									onchange={(v) => lab.setParam('freeTimeValue', v)}
									min={0}
									max={3}
									step={0.1}
									unit={m.unit_output_per_hour()}
									fit={stopReading}
								/>
								<ParamRow
									id="terminal-value"
									label={m.energy_evening_energy()}
									hint={m.energy_evening_energy_hint()}
									value={params.terminalEnergyValue}
									onchange={(v) => lab.setParam('terminalEnergyValue', v)}
									min={0}
									max={5}
									step={0.25}
									unit={m.unit_output()}
								/>
								<ParamRow
									id="satiety-scale"
									label={m.energy_satiety()}
									hint={m.energy_satiety_hint()}
									value={params.satietyScale}
									onchange={(v) => lab.setParam('satietyScale', v)}
									min={0}
									max={5}
									step={0.25}
									unit="×"
								/>
								<ParamRow
									id="micro-recovery"
									label={m.energy_micro_recovery()}
									hint={m.energy_micro_recovery_hint()}
									value={Number((params.microRecoveryFraction * 100).toFixed(1))}
									onchange={(v) => lab.setParam('microRecoveryFraction', v / 100)}
									min={0}
									max={30}
									step={1}
									unit="%"
								/>
							</div>
						</div>
					{/if}
				</div>

				{#if hasTasks}
					<div class="space-y-grid-lg">
						<!-- The live stop advisor (MATH.md §8.11): today's 🪫 logs priced against
						     free time — first, as the only one of the four that reads on today. -->
						{#if stopAdvice !== null}
							<StopAdvisorCard
								advice={stopAdvice}
								taskTitle={stopTaskTitle}
								freeTimeValue={params.freeTimeValue}
								locale={getDateLocale()}
							/>
						{/if}

						<!-- Recovery calibration: the ☕ pairs behind r, and the editor that adds one -->
						<CalibrationCard
							title={m.energy_recovery_calibration()}
							hint={m.energy_recovery_calibration_hint()}
						>
							{#if restObservations.length === 0}
								<p class="mt-text-sm text-xs text-ty-silent">
									{m.energy_recovery_calibration_empty()}
								</p>
							{:else}
								{#if pendingRestLogs > 0}
									<p class="mt-text-sm text-xs text-ty-silent">
										{pendingRestLogs === 1
											? m.energy_rest_pending_one()
											: m.energy_rest_pending({
													count: pendingRestLogs,
												})}
									</p>
								{/if}

								<div class="mt-text-sm border-t border-line-soft pt-box-sm">
									<FitLogSummary
										label={m.energy_rest_log_count({
											count: restObservations.length,
										})}
										count={restObservations.length}
										confirmLabel={m.energy_reset_rest_confirm({
											count: restObservations.length,
										})}
										resetLabel={m.energy_reset_rest_logs()}
										resetTitle={m.energy_reset_rest_title()}
										onreset={() => observations.resetRestLogs()}
									/>
								</div>
							{/if}
						</CalibrationCard>

						<!-- Stopping calibration: which past days λ₀ could read, and which it could not -->
						<CalibrationCard
							title={m.energy_stop_calibration()}
							hint={m.energy_stop_calibration_hint()}
						>
							{#if lab.stopObservationCount === 0}
								<p class="mt-text-sm text-xs text-ty-silent">
									{m.energy_stop_calibration_empty()}
								</p>
							{:else if !stopFit.fitted}
								<p class="mt-text-sm text-xs text-ty-silent">
									{m.energy_stop_calibration_censored()}
								</p>
							{/if}

							{#if stopFit.clockCensoredCount > 0}
								<p class="mt-text-sm text-xs text-ty-silent">
									{stopFit.clockCensoredCount === 1
										? m.energy_stop_out_of_clock_one()
										: m.energy_stop_out_of_clock({
												count: stopFit.clockCensoredCount,
											})}
								</p>
							{/if}

							{#if stopFit.unreadBreaksCount > 0}
								<p class="mt-text-sm text-xs text-ty-silent">
									{stopFit.unreadBreaksCount === 1
										? m.energy_stop_unread_breaks_one()
										: m.energy_stop_unread_breaks({
												count: stopFit.unreadBreaksCount,
											})}
								</p>
							{/if}

							<!-- λ₀ has no log store of its own to count or reset, so the days it read are
						     all this card has left once the fit reads on its parameter's row. -->
							{#if lab.stopObservationCount > 0}
								<p class="mt-text-sm border-t border-line-soft pt-box-sm text-xs text-ty-silent">
									{m.energy_stop_observation_count({
										count: lab.stopObservationCount,
									})}
								</p>
							{/if}
						</CalibrationCard>
					</div>
				{/if}
			</div>

			<!-- Full width and last: the sweep answers a question about the whole day, and
			     its chart is wider than the column beside it. Gated on `hasTasks` because
			     an always-rendered card would otherwise offer a sweep on a day with
			     nothing to sweep. -->
			{#if hasTasks}
				<BudgetCurveCard
					curve={budgetCurve}
					isBusy={lab.isCurveBusy}
					isStale={lab.isCurveStale}
					hasError={lab.hasCurveError}
					currentBudget={windowHours}
					locale={getDateLocale()}
					oncheck={() => lab.computeBudgetCurve()}
					onapply={(hours) => (session.availableHours = hours)}
				/>
			{/if}
		</div>
	</Tooltip.Provider>
{/if}

<!-- Outside the load gate, like `fallow-explainer.svelte` on `/` and for its reason:
     this is the route's only prose, and in the heading's tooltip it reached no crawler
     and no reader who did not hover, because bits-ui mounts tooltip content on open. -->
<section class="card-shell mt-section-lg p-box-md text-ty-secondary sm:p-box-xl">
	<div class="max-w-3xl space-y-text-sm">
		<h2 class="text-xl font-bold text-ty-primary">{m.about_how_title()}</h2>
		<p class="text-sm leading-relaxed">
			{m.energy_intro_1()}
			<span class="font-medium text-ty-primary">{m.energy_intro_highlight_1()}</span>
			{m.energy_intro_2()}
			<span class="font-medium text-ty-primary">{m.energy_intro_highlight_2()}</span>
			{m.energy_intro_3()}
		</p>
	</div>
</section>
