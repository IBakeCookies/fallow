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
		drainDraftFromLog,
		newDrainDraft,
		newEditorDraft,
		type DrainDraft,
		type EditorDraft,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';
	import { formatDuration } from '$lib/presentation/utils/duration-format';
	import { seriesColors } from '$lib/presentation/utils/series-color';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import EnergyChart from '$lib/presentation/component/energy-chart.svelte';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';
	import PlanTimelineBar from '$lib/presentation/component/plan-timeline-bar.svelte';
	import PlanScheduleList from '$lib/presentation/component/plan-schedule-list.svelte';
	import PlanSummary from '$lib/presentation/component/plan-summary.svelte';
	import BudgetCurveCard from '$lib/presentation/component/budget-curve-card.svelte';
	import StopAdvisorCard from '$lib/presentation/component/stop-advisor-card.svelte';
	import ParamRow from '$lib/presentation/component/param-row.svelte';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';
	import FitRow from '$lib/presentation/component/fit-row.svelte';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';
	import FitLogSummary from '$lib/presentation/component/fit-log-summary.svelte';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { getEnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import type { DrainObservationRecord, Persisted } from '$lib/business/type';

	const VIEW_KEY = 'zenith-energy-view';

	const decimal = (value: number, digits: number) => formatDecimals(value, digits, getDateLocale());

	const session = getSessionStore();
	const activeTasks = $derived(session.activeTasks);

	const observations = getEnergyObservationStore();

	const lab = getEnergyLabStore();

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
	const stopFit = $derived(lab.stoppingFit);
	const stopAdvice = $derived(lab.stopAdvice);
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

	const openDrainLog = (taskId: number, source: EditorSource) =>
		(drainDrafts[taskId] = newDrainDraft(source));

	const editDrainLog = (taskId: number, log: Persisted<DrainObservationRecord>) =>
		(drainDrafts[taskId] = drainDraftFromLog(log));

	// Only the draft remembers whether a chip opened it, so new-vs-correction is the page's.
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

{#snippet addTaskForm()}
	<TaskForm
		onsubmit={(t) => session.addTask(t)}
		suggest={(query) => session.suggestTitles(query)}
		isOpen={!hasTasks}
		showMustDoToday={false}
	/>
{/snippet}

{#snippet taskRows()}
	{#each tasks as task (task.id)}
		<li>
			<EnergyTaskRow
				title={task.title}
				completed={task.completed}
				physicalDifficulty={task.physicalDifficulty}
				mentalDifficulty={task.mentalDifficulty}
				enjoyment={task.enjoyment}
				mustDoToday={task.mustDoToday}
				color={colors.colorOf(task.id)}
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
				onchange={(edit) => session.updateTask(task.id, edit)}
			/>
		</li>
	{/each}
{/snippet}

<!-- Outside the load gate: the title reads nothing, and it is what keeps the route
     from painting blank for the frame before IndexedDB answers. -->
<div class="mb-text-xl">
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<h1 {...props} class="hint-underline inline-flex text-2xl font-bold text-ty-primary">
						{m.energy_heading()}
					</h1>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" align="start" class="max-w-md">
				<p>
					{m.energy_intro_1()}
					<span class="font-medium text-ty-primary">{m.energy_intro_highlight_1()}</span>
					{m.energy_intro_2()}
					<span class="font-medium text-ty-primary">{m.energy_intro_highlight_2()}</span>
					{m.energy_intro_3()}
				</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>

{#if session.isLoading || !lab.isLoaded}
	<!-- The pre-read state is not neutral: an empty list reads as "no open tasks" over a plan
	     the user has, and the parameter rows would show defaults before their saved values land. -->
	<div class="space-y-grid-lg" aria-hidden="true">
		<div class="card-shell p-box-md sm:p-box-xl">
			<div class="skeleton-block h-4 w-44"></div>
			<div class="skeleton-block mt-text-md h-124 w-full"></div>
		</div>
		<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
			<div class="card-shell p-box-md sm:p-box-xl lg:col-span-2">
				<div class="skeleton-block h-4 w-24"></div>
				<div class="skeleton-block mt-text-md h-70 w-full"></div>
			</div>
			<div class="card-shell p-box-md sm:p-box-xl">
				<div class="skeleton-block h-4 w-28"></div>
				<div class="skeleton-block mt-text-md h-144 w-full"></div>
			</div>
		</div>
	</div>
{:else}
	<div class="space-y-grid-lg">
		<!-- Everything above the list describes a plan; only the list's card stays on an
		     empty day, because its form is where the first task gets typed. -->
		{#if hasTasks}
			{#if activeTasks.length === 0}
				<!-- The optimizer needs an open task; the list stays so one can be un-checked or added -->
				<div class="card-shell p-box-2xl text-center">
					<p class="text-ty-secondary">{m.energy_all_done()}</p>
					<p class="mt-text-2xs text-sm text-ty-silent">{m.energy_all_done_hint()}</p>
				</div>
			{:else}
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
							class="hint-underline cursor-default text-sm text-ty-secondary transition hover:text-ty-primary"
							onclick={focusDayWindow}
						>
							{m.energy_set_window()}
						</button>
					{/if}
				</div>

				<!-- The day's LENGTH, priced (MATH.md §8.12) — outside the `windowHours > 0`
				     gate on purpose: the curve is the answer to "what window should I set". -->
				<BudgetCurveCard
					curve={lab.budgetCurve}
					isBusy={lab.isCurveBusy}
					isStale={lab.isCurveStale}
					hasError={lab.hasCurveError}
					currentBudget={windowHours}
					locale={getDateLocale()}
					oncheck={() => lab.computeBudgetCurve()}
					onapply={(hours) => (session.availableHours = hours)}
				/>
			{/if}
		{/if}

		<Tooltip.Provider>
			<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
				<!-- Full width on an empty day: two thirds of a card beside a third of
				     nothing reads as a layout bug. -->
				<div class={hasTasks ? 'lg:col-span-2' : 'lg:col-span-3'}>
					<TaskListCard form={addTaskForm} rows={hasTasks ? taskRows : null} />
				</div>
				{#if hasTasks}
					<div class="space-y-grid-lg">
						<!-- The live stop advisor (MATH.md §8.11): today's 🪫 logs priced against
						     free time. In the side column so it never pushes the task list down. -->
						{#if stopAdvice !== null}
							<StopAdvisorCard
								advice={stopAdvice}
								taskTitle={stopTaskTitle}
								freeTimeValue={params.freeTimeValue}
								locale={getDateLocale()}
							/>
						{/if}
						<div class="card-shell p-box-md sm:p-box-xl">
							<div class="mb-text-md flex items-baseline justify-between">
								<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
									{m.energy_model_parameters()}
								</h3>
								<div class="flex shrink-0 items-baseline gap-text-md">
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
							<div class="space-y-grid-md">
								<!-- The window is the session's budget, not a lab param — hence step 0.25
							     and not 0.5: the stepper rounds to its own step's decimals, so a 6.25h
							     day set on the main page would come back 6.8 after one click here. -->
								<ParamRow
									id="window-hours"
									label={m.energy_day_window()}
									hint={m.energy_day_window_hint()}
									value={windowHours}
									onchange={(v) => (session.availableHours = v)}
									min={0}
									max={24}
									step={0.25}
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

						<!-- Drain calibration: fitted α from end-of-session ratings -->
						<CalibrationCard title={m.energy_calibration()} hint={m.energy_calibration_hint()}>
							{#if drainObservations.length === 0}
								<p class="mt-text-sm text-xs text-ty-silent">{m.energy_calibration_empty()}</p>
							{:else}
								<div class="mt-text-sm space-y-text-xs">
									<FitRow
										label={m.energy_cognitive_drain()}
										tone="mind"
										value={cogDrainFit.fitted
											? m.energy_fit_value({
													alpha: decimal(cogDrainFit.alpha, 2),
													std: decimal(cogDrainFit.alphaStd ?? 0, 2),
													count: cogDrainFit.usedCount,
												})
											: null}
									/>
									<FitRow
										label={m.energy_physical_drain()}
										tone="body"
										value={physDrainFit.fitted
											? m.energy_fit_value({
													alpha: decimal(physDrainFit.alpha, 2),
													std: decimal(physDrainFit.alphaStd ?? 0, 2),
													count: physDrainFit.usedCount,
												})
											: null}
									/>
								</div>

								<div class="mt-text-sm border-t border-line-soft pt-box-sm">
									<FitLogSummary
										label={m.energy_drain_log_count({
											count: drainObservations.length,
										})}
										count={drainObservations.length}
										confirmLabel={m.energy_reset_drain_confirm({
											count: drainObservations.length,
										})}
										resetLabel={m.energy_reset_drain_logs()}
										resetTitle={m.energy_reset_drain_title()}
										onreset={() => observations.resetDrainLogs()}
									/>
								</div>
							{/if}
						</CalibrationCard>

						<!-- Recovery calibration: fitted r from pre/post-rest rating pairs -->
						<CalibrationCard
							title={m.energy_recovery_calibration()}
							hint={m.energy_recovery_calibration_hint()}
						>
							{#snippet action()}
								<button
									type="button"
									class="shrink-0 text-xs transition {restFormOpen
										? 'text-ty-silent hover:text-ty-secondary'
										: 'text-info/90 hover:text-info-strong'}"
									onclick={() => (restFormOpen = !restFormOpen)}
								>
									{restFormOpen ? m.common_cancel() : `☕ ${m.energy_log_rest()}`}
								</button>
							{/snippet}

							{#if restFormOpen}
								<RestLogForm onsave={saveRestLog} oncancel={() => (restFormOpen = false)} />
							{/if}

							{#if restObservations.length === 0}
								<p class="mt-text-sm text-xs text-ty-silent">
									{m.energy_recovery_calibration_empty()}
								</p>
							{:else}
								<div class="mt-text-sm flex items-baseline justify-between gap-text-xs text-xs">
									<span class="text-ty-silent">{m.energy_recovery_rate()}</span>
									{#if recoveryFit.fitted}
										<span class="tabular-nums text-info-strong">
											{m.energy_recovery_fit_value({
												rate: decimal(recoveryFit.rate, 2),
												std: decimal(recoveryFit.rateStd ?? 0, 2),
												count: recoveryFit.usedCount,
											})}
										</span>
									{:else}
										<span class="text-ty-silent">{m.energy_fit_no_signal()}</span>
									{/if}
								</div>

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

						<!-- Stopping calibration: fitted λ₀ from finished days' stop decisions -->
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
							{:else}
								<div class="mt-text-sm flex items-baseline justify-between gap-text-xs text-xs">
									<span class="text-ty-silent">{m.energy_free_time_value()}</span>
									<span class="tabular-nums text-info-strong">
										{m.energy_stop_fit_value({
											value: decimal(stopFit.value, 2),
											std: decimal(stopFit.valueStd ?? 0, 2),
											count: stopFit.usedCount,
										})}
									</span>
								</div>
							{/if}
						</CalibrationCard>
					</div>
				{/if}
			</div>
		</Tooltip.Provider>
	</div>
{/if}
