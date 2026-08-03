<script lang="ts">
	import { onMount } from 'svelte';
	import { logError } from '$lib/logger';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import { showToast } from '$lib/presentation/utils/toast';
	import { removeTaskWithUndo } from '$lib/presentation/utils/remove-task-with-undo';
	import {
		completionPromptAction,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';
	import { formatDuration, formatOffset } from '$lib/presentation/utils/duration-format';
	import { seriesColors } from '$lib/presentation/utils/series-color';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import EnergyChart from '$lib/presentation/component/energy-chart.svelte';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';
	import PlanTimelineBar from '$lib/presentation/component/plan-timeline-bar.svelte';
	import PlanScheduleList from '$lib/presentation/component/plan-schedule-list.svelte';
	import PlanSummary from '$lib/presentation/component/plan-summary.svelte';
	import StopAdvisorCard from '$lib/presentation/component/stop-advisor-card.svelte';
	import ParamRow from '$lib/presentation/component/param-row.svelte';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';
	import FitRow from '$lib/presentation/component/fit-row.svelte';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';
	import LogList from '$lib/presentation/component/log-list.svelte';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { setEnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import { getStorageStatusStore } from '$lib/business/store/storage-status.svelte';

	const VIEW_KEY = 'zenith-energy-view';

	/** Every decimal here is a fitted constant or an output total. */
	const decimal = (value: number, digits: number) => formatDecimals(value, digits, getDateLocale());

	// Tasks, budget, pools and personalized constants come live from the shared
	// session store — edits here save to the same daily session as the main
	// page, and the schedule re-optimizes as you drag a slider.
	const session = getSessionStore();
	const tasks = $derived(session.tasks);
	const activeTasks = $derived(session.activeTasks);

	// A dated `/energy?date=…` never reaches this component: `+page.ts` redirects
	// it to the canonical route before the layout hands the session store a date.

	// The 🪫/☕ measurements that calibrate α and r — their own store, since they
	// are stamped with today rather than the viewed day.
	const observations = getEnergyObservationStore();

	// Model parameters, the optimized plan and the three calibration fits are
	// model orchestration, so they live in the lab store — this page renders
	// them and edits them, nothing more. Params are the lab's own and never
	// written back to the session, but they ARE persisted (IndexedDB, so backup
	// covers them).
	const lab = setEnergyLabStore(session, observations, getStorageStatusStore(), () =>
		showToast.danger(m.energy_params_load_failed()),
	);

	// Aliases so the markup reads in the model's vocabulary
	const params = $derived(lab.params);
	const plan = $derived(lab.plan);
	const trajectory = $derived(lab.trajectory);
	// Read from the session, which is also where the window row writes it — the lab
	// store consumes the same value but does not re-export it.
	const windowHours = $derived(session.availableHours);
	const trailingFreeHours = $derived(lab.trailingFreeHours);
	const outputVsClassic = $derived(lab.outputVsClassic);
	const cogDrainFit = $derived(lab.cognitiveDrainFit);
	const physDrainFit = $derived(lab.physicalDrainFit);
	const recoveryFit = $derived(lab.recoveryFit);
	const stopFit = $derived(lab.stoppingFit);
	const stopAdvice = $derived(lab.stopAdvice);
	// The advisor's ids come from the session's own tasks, so the lookup always
	// resolves; '' only satisfies the type where the verdict carries no task.
	const stopTaskTitle = $derived(
		stopAdvice !== null && stopAdvice.verdict !== 'window-full'
			? (tasks.find((t) => t.id === stopAdvice.taskId)?.title ?? '')
			: '',
	);

	// The plan card's lower region: energy chart or the schedule detail list.
	// The timeline bar and the summary stats stay visible in both views. A pure
	// view preference, so localStorage is the right home — unlike the model
	// params, losing it costs nothing and it has no place in a data backup.
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
		try {
			const savedView = localStorage.getItem(VIEW_KEY);

			if (savedView === 'chart' || savedView === 'schedule') planView = savedView;
		} catch (e) {
			logError('Failed to load energy lab view preference', e);
		}
	});

	// ---------- Drain calibration (α fit from end-of-session ratings) ----------

	const drainObservations = $derived(observations.drainObservations);

	// Which task the 🪫 editor is open for, and the rating it opened on. The fields are
	// drain-log-form.svelte's to collect; what stays here is that there is only ever ONE
	// open editor, because `completionPromptAction` refuses to prompt across any of them
	// — a fact no single row can see.
	let drainDraft = $state<{
		taskId: number;
		minutes: number | null;
		mind: number | null;
		body: number | null;
	} | null>(null);

	// Which of the two ways the editor was opened, because the caret and the withdraw
	// both turn on it — task-item.svelte's `focusFlowInput` carries the full reasons,
	// including why the focus cannot be an `autofocus` attribute.
	let focusDrainInput = $state(false);
	let drainPromptedByCompletion = $state(false);

	// A draft only counts while its row is on screen. `session.tasks` is replaced
	// wholesale by the midnight rollover and by the visibility re-read, so a draft can
	// outlive its row — and it is the whole gate on the prompt below, so an orphan
	// suppressed the prompt for every task with no form left to close. Derived rather
	// than cleared per site, because a rollover has no site to hang it on.
	const liveDrainDraft = $derived.by(() => {
		const draft = drainDraft;

		return draft && tasks.some((t) => t.id === draft.taskId) ? draft : null;
	});

	const todaysDrainLog = (taskId: number) =>
		drainObservations.find((o) => o.date === session.today && o.taskId === taskId);

	function openDrainLog(taskId: number, source: EditorSource) {
		const existing = todaysDrainLog(taskId);

		focusDrainInput = source === 'button';
		drainPromptedByCompletion = source === 'completion';

		drainDraft = {
			taskId,
			minutes: existing ? Math.round(existing.hours * 60) : null,
			mind: existing?.mindDrain ?? null,
			body: existing?.bodyDrain ?? null,
		};
	}

	// Ticking a task off is the end of the session the 🪫 rating describes, so ask
	// here rather than behind the hover-revealed button. The draft is page-level, one
	// editor at a time — so ANY open one blocks the prompt, including another task's,
	// while the withdraw only ever touches this task's own.
	function onCompletionChange(taskId: number, completed: boolean) {
		const draft = liveDrainDraft;

		const action = completionPromptAction({
			finishing: !completed,
			measured: Boolean(todaysDrainLog(taskId)),
			anyEditorOpen: draft !== null,
			promptOpenForThisTask: draft?.taskId === taskId && drainPromptedByCompletion,
		});

		session.toggleTask(taskId);

		if (action === 'open') openDrainLog(taskId, 'completion');

		if (action === 'withdraw') drainDraft = null;
	}

	// The rating itself is the editor's to validate; which task it belongs to is the
	// page's, because the editor is one for the whole list.
	function saveDrainLog(entry: { hours: number; mind: number; body: number }) {
		if (!drainDraft) return;

		observations.logDrain(drainDraft.taskId, entry.hours, entry.mind, entry.body);

		drainDraft = null;
	}

	// ---------- Recovery calibration (r fit from pre/post-rest pairs) ----------

	const restObservations = $derived(observations.restObservations);

	// Inline rest-pair editor (☕): lives in the calibration card — a break has no task
	// row to hang off, and nothing outside it gates on the draft, so the form owns it.
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

	// One hue per task, in plan order, shared by the timeline, the schedule list and
	// the task rows — so all three agree about which task is which.
	const colors = $derived(seriesColors(lab.energyTasks.map((t) => t.id)));

	// What the plan gave each task, for its row in the list below. Null when there
	// is no plan to report on — "no hours" against every task would be a claim the
	// optimizer never made.
	const plannedFor = (taskId: number) =>
		plan.evaluation.blocks.length === 0 ? null : (lab.allocatedHoursByTask.get(taskId) ?? 0);

	// The window field is a card away on a desktop and three on a phone, so the
	// prompt in the empty plan goes there instead of naming it.
	function focusDayWindow() {
		document.getElementById('window-hours')?.focus();
	}
</script>

<SeoHead title={m.energy_title_head()} description={m.energy_meta_description()} />

{#snippet applyFitButton(label: string, disabled: boolean, title: string, onclick: () => void)}
	<button
		type="button"
		class="mt-text-sm w-full rounded-lg border border-brand/30 bg-brand/10 px-box-sm py-box-3xs text-xs font-medium text-brand-strong transition hover:bg-brand/20 disabled:cursor-default disabled:border-border disabled:bg-transparent disabled:text-ty-silent"
		{disabled}
		{title}
		{onclick}
	>
		{label}
	</button>
{/snippet}

{#if !session.isLoading && lab.isLoaded}
	<div class="mb-text-xl">
		<!-- The intro paragraph lives in the title's tooltip now — the header
		     stays one line so the plan is what fills the fold. -->
		<Tooltip.Provider delayDuration={150}>
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

	{#if tasks.length === 0}
		<div class="space-y-grid-lg">
			<div class="card-shell p-box-2xl text-center">
				<p class="text-ty-secondary">{m.energy_no_open_tasks()}</p>
				<p class="mt-text-2xs text-sm text-ty-silent">
					{m.energy_no_open_tasks_hint()}
				</p>
			</div>

			<div class="backdrop-blur">
				<TaskForm onsubmit={(t) => session.addTask(t)} />
			</div>
		</div>
	{:else}
		<div class="space-y-grid-lg">
			{#if activeTasks.length === 0}
				<!-- All done: the optimizer needs an open task, but the list below
				     stays visible so a task can be un-checked or added -->
				<div class="card-shell p-box-2xl text-center">
					<p class="text-ty-secondary">{m.energy_all_done()}</p>
					<p class="mt-text-2xs text-sm text-ty-silent">{m.energy_all_done_hint()}</p>
				</div>
			{:else}
				<!-- Timeline -->
				<div class="card-shell p-box-md sm:p-box-xl">
					<div class="mb-text-sm flex flex-wrap items-center justify-between gap-grid-xs">
						<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
							{m.energy_optimized_day()}
						</h3>
						<!-- Both read the plan, so neither belongs above a card that has none:
						     "0m work · 0m free" and a chart/schedule switch over an empty region
						     are furniture the day window has not earned yet. -->
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
					{:else}
						<button
							type="button"
							class="hint-underline cursor-default text-sm text-ty-secondary transition hover:text-ty-primary"
							onclick={focusDayWindow}
						>
							{m.energy_set_window()}
						</button>
					{/if}

					{#if windowHours > 0}
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
							endCog={plan.evaluation.endCog}
							endPhys={plan.evaluation.endPhys}
							workHours={plan.evaluation.workHours}
							{outputVsClassic}
						/>
					{/if}
				</div>
			{/if}

			<!-- One provider for the whole region: the task rows, the parameter labels
			     and all three calibration headings. -->
			<Tooltip.Provider delayDuration={150}>
				<div class="space-y-grid-lg">
					<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
						<!-- Tasks: shared with the main page, edited live -->
						<div class="card-shell p-box-md sm:p-box-xl lg:col-span-2">
							<div class="mb-text-2xs flex items-baseline justify-between gap-grid-xs">
								<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
									{m.energy_tasks()}
								</h3>
								<span class="text-xs text-ty-silent">{m.energy_shared_note()}</span>
							</div>
							<p class="mb-text-sm text-xs text-ty-silent">
								{m.energy_drag_hint()}
							</p>
							<ul class="space-y-text-2xs">
								{#each tasks as task (task.id)}
									<EnergyTaskRow
										title={task.title}
										completed={task.completed}
										physicalDifficulty={task.physicalDifficulty}
										mentalDifficulty={task.mentalDifficulty}
										enjoyment={task.enjoyment}
										color={colors.colorOf(task.id)}
										plannedHours={plannedFor(task.id)}
										measured={Boolean(todaysDrainLog(task.id))}
										drainDraft={drainDraft?.taskId === task.id ? drainDraft : null}
										focusDrainMinutes={focusDrainInput}
										ontoggle={() => onCompletionChange(task.id, task.completed)}
										onremove={() => removeTaskWithUndo(session, task.id)}
										ondrainclick={() =>
											drainDraft?.taskId === task.id
												? (drainDraft = null)
												: openDrainLog(task.id, 'button')}
										onchange={(changes) => session.updateTask(task.id, changes)}
										ondrainsave={saveDrainLog}
										ondraincancel={() => (drainDraft = null)}
									/>
								{/each}
							</ul>
							<div class="mt-text-sm">
								<TaskForm onsubmit={(t) => session.addTask(t)} isOpen={false} />
							</div>
						</div>
						<div class="space-y-grid-lg">
							<!-- The live stop advisor (MATH.md §8.11): today's 🪫 logs priced
							     against free time. In the side column so it never pushes the
							     task list down. Absent whenever there is nothing to advise on —
							     no window, no tasks, or every task checked off. -->
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
									<button
										type="button"
										class="text-xs text-ty-silent transition hover:text-ty-secondary"
										title={m.energy_reset_defaults_title()}
										onclick={() => lab.resetParams()}
									>
										{m.energy_reset_defaults()}
									</button>
								</div>
								<div class="space-y-grid-md">
									<!-- Not a model param like every row below it: the window IS the
								     session's budget, so this writes the shared value and the main
								     page's Available Hours moves with it. Hence 0.25 and not the
								     coarser 0.5 a lab-local slider could afford: the stepper rounds to
								     its own step's decimals, so a 6.25h day set on the main page would
								     come back 6.8 after one click here. -->
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
						</div>
					</div>

					<!-- The three calibration cards used to stack under the parameters, in a
				     third of the width — while the tasks card beside them ended far higher,
				     leaving ~700px of empty column. -->
					<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
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

								{#if cogDrainFit.fitted || physDrainFit.fitted}
									{@render applyFitButton(
										lab.drainFitApplied ? m.energy_fit_applied() : m.energy_apply_fit(),
										lab.drainFitApplied,
										m.energy_apply_fit_title(),
										() => lab.applyDrainFit(),
									)}
								{/if}

								<div class="mt-text-sm border-t border-line-soft pt-box-sm">
									<LogList
										label={m.energy_drain_log_count({
											count: drainObservations.length,
										})}
										items={drainObservations}
										confirmLabel={m.energy_reset_drain_confirm({
											count: drainObservations.length,
										})}
										resetLabel={m.energy_reset_drain_logs()}
										resetTitle={m.energy_reset_drain_title()}
										onreset={() => observations.resetDrainLogs()}
									>
										{#snippet row(log)}
											<span class="truncate">
												<span class="text-ty-silent">{log.date}</span>
												<span class="capitalize"> · {log.taskTitle}</span>
											</span>
											<span class="flex shrink-0 items-center gap-text-xs tabular-nums">
												<span class="text-ty-silent">{formatDuration(log.hours)}</span>
												<span class="font-medium text-mind/90">M{log.mindDrain}</span>
												<span class="font-medium text-body/90">B{log.bodyDrain}</span>
												<button
													type="button"
													aria-label={m.energy_delete_drain_log_aria()}
													title={m.energy_delete_drain_log_title()}
													class="text-ty-silent transition hover:text-danger"
													onclick={() => observations.deleteDrainLog(log.id)}
												>
													✕
												</button>
											</span>
										{/snippet}
									</LogList>
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

								{#if recoveryFit.fitted}
									{@render applyFitButton(
										lab.recoveryFitApplied
											? m.energy_recovery_fit_applied()
											: m.energy_apply_recovery_fit(),
										lab.recoveryFitApplied,
										m.energy_apply_recovery_fit_title(),
										() => lab.applyRecoveryFit(),
									)}
								{/if}

								<div class="mt-text-sm border-t border-line-soft pt-box-sm">
									<LogList
										label={m.energy_rest_log_count({
											count: restObservations.length,
										})}
										items={restObservations}
										confirmLabel={m.energy_reset_rest_confirm({
											count: restObservations.length,
										})}
										resetLabel={m.energy_reset_rest_logs()}
										resetTitle={m.energy_reset_rest_title()}
										onreset={() => observations.resetRestLogs()}
									>
										{#snippet row(log)}
											<span class="truncate text-ty-silent">{log.date}</span>
											<span class="flex shrink-0 items-center gap-text-xs tabular-nums">
												<span class="text-ty-silent">{formatDuration(log.hours)}</span>
												<span class="font-medium text-mind/90">
													M{log.mindBefore}→{log.mindAfter}
												</span>
												<span class="font-medium text-body/90">
													B{log.bodyBefore}→{log.bodyAfter}
												</span>
												<button
													type="button"
													aria-label={m.energy_delete_rest_log_aria()}
													title={m.energy_delete_rest_log_title()}
													class="text-ty-silent transition hover:text-danger"
													onclick={() => observations.deleteRestLog(log.id)}
												>
													✕
												</button>
											</span>
										{/snippet}
									</LogList>
								</div>
							{/if}
						</CalibrationCard>

						<!-- Stopping calibration: fitted λ₀ from finished days' stop decisions -->
						<CalibrationCard
							title={m.energy_stop_calibration()}
							hint={m.energy_stop_calibration_hint()}
						>
							{#if lab.stopObservationCount === 0}
								<p class="mt-text-sm text-xs text-ty-silent">{m.energy_stop_calibration_empty()}</p>
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

								{@render applyFitButton(
									lab.stoppingFitApplied ? m.energy_stop_fit_applied() : m.energy_apply_stop_fit(),
									lab.stoppingFitApplied,
									m.energy_apply_stop_fit_title(),
									() => lab.applyStoppingFit(),
								)}
							{/if}
						</CalibrationCard>
					</div>
				</div>
			</Tooltip.Provider>
		</div>
	{/if}
{/if}
