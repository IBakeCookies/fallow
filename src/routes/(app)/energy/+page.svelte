<script lang="ts">
	import { onMount } from 'svelte';
	import { logError } from '$lib/logger';
	import * as m from '$lib/paraglide/messages.js';
	import { getDateLocale } from '$lib/presentation/utils/locale.svelte';
	import { showToast } from '$lib/presentation/utils/toast';
	import {
		completionPromptAction,
		MEASUREMENT_FORM_CLASS,
		MEASUREMENT_MINUTES_CLASS,
		type EditorSource,
	} from '$lib/presentation/utils/measurement-prompt';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { segmentedToggleVariants } from '$lib/presentation/component/segmented-toggle-variants';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import EnergyChart from '$lib/presentation/component/energy-chart.svelte';
	import LogList from '$lib/presentation/component/log-list.svelte';
	import type { Task } from '$lib/business/type';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';
	import { getEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { setEnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import { getStorageStatusStore } from '$lib/business/store/storage-status.svelte';

	const VIEW_KEY = 'zenith-energy-view';

	// Decimals follow the active locale, like the clock labels do — otherwise a
	// German reader gets "1.5" where the rest of the page says "1,5".
	function formatDecimals(value: number, digits: number): string {
		return value.toLocaleString(getDateLocale(), {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		});
	}

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

	// The plan card's lower region: energy chart or the schedule detail list.
	// The timeline bar and the summary stats stay visible in both views. A pure
	// view preference, so localStorage is the right home — unlike the model
	// params, losing it costs nothing and it has no place in a data backup.
	let planView = $state<'chart' | 'schedule'>('chart');

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

	// ---------- Live task editing ----------

	type SliderKey = 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment';

	const sliders = [
		{
			key: 'physicalDifficulty',
			label: 'P',
			title: m.energy_slider_physical(),
			min: 0,
			accent: 'accent-body',
			color: 'text-body/80',
		},
		{
			key: 'mentalDifficulty',
			label: 'M',
			title: m.energy_slider_mental(),
			min: 0,
			accent: 'accent-mind',
			color: 'text-mind/80',
		},
		{
			key: 'enjoyment',
			label: 'E',
			title: m.energy_slider_enjoyment(),
			min: 1,
			accent: 'accent-brand',
			color: 'text-brand/80',
		},
	] as const;

	function setTaskValue(id: number, key: SliderKey, value: number) {
		const changes: Partial<Pick<Task, SliderKey>> = {};
		changes[key] = value;
		session.updateTask(id, changes);
	}

	// ---------- Drain calibration (α fit from end-of-session ratings) ----------

	const drainObservations = $derived(observations.drainObservations);

	// Inline per-task rating editor (🪫). Minutes in, hours stored. What it shares with
	// the main page's ⚡ editor is exported, not mirrored: `completionPromptAction` for
	// the behaviour, `MEASUREMENT_*_CLASS` for the look.
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

	function saveDrainLog() {
		if (!drainDraft) return;

		const minutes = Number(drainDraft.minutes);
		const { mind, body } = drainDraft;

		if (!minutes || minutes <= 0) return;

		// An empty rating is not a rating of 0 — `Number(null)` is a finite 0, so ✓ with
		// only the minutes filled used to record "worked 90 minutes, felt entirely fresh"
		// and bias the α fit toward no drain. 0 is legitimate, so the test is emptiness,
		// not falsiness. `required` on the fields is what makes the refusal visible.
		if (mind === null || body === null) return;

		observations.logDrain(
			drainDraft.taskId,
			minutes / 60,
			Math.min(10, Math.max(0, mind)),
			Math.min(10, Math.max(0, body)),
		);

		drainDraft = null;
	}

	// ---------- Recovery calibration (r fit from pre/post-rest pairs) ----------

	const restObservations = $derived(observations.restObservations);

	// Inline rest-pair editor (☕): lives in the calibration card — a break
	// has no task row to hang off.
	let restDraft = $state<{
		minutes: number | null;
		mindBefore: number | null;
		mindAfter: number | null;
		bodyBefore: number | null;
		bodyAfter: number | null;
	} | null>(null);

	function saveRestLog() {
		if (!restDraft) return;

		const minutes = Number(restDraft.minutes);
		const { mindBefore, mindAfter, bodyBefore, bodyAfter } = restDraft;

		if (!minutes || minutes <= 0) return;

		// Same as `saveDrainLog`, and worse: MATH.md §8.9 reads the pair as a decay
		// (`d_after = d_before · e^(−r·m·g)`), so a blank "after" invents "the break left
		// me at zero", which fits r → ∞ and drags the estimate to its upper bound.
		if (mindBefore === null || mindAfter === null || bodyBefore === null || bodyAfter === null)
			return;

		const rating = (value: number) => Math.min(10, Math.max(0, value));

		observations.logRest(
			minutes / 60,
			rating(mindBefore),
			rating(mindAfter),
			rating(bodyBefore),
			rating(bodyAfter),
		);

		restDraft = null;
	}

	// ---------- Presentation helpers ----------

	// The categorical scale lives in the token layer (base.css --series-*), not
	// here, so it is themeable in one place and pairs with --series-ink.
	//
	// These reference the raw --series-N properties from base.css :root, NOT the
	// --color-series-N @theme aliases: @theme variables are tree-shaken to the ones
	// Tailwind can statically see, and a name built in a template literal is
	// invisible to its scanner, so the alias form would resolve to nothing here.
	// The :root properties are plain CSS and always emitted.
	const PALETTE = Array.from(
		{
			length: 8,
		},
		(_, i) => `var(--series-${i + 1})`,
	);
	const taskColor = $derived(
		new Map(lab.energyTasks.map((t, i) => [t.id, PALETTE[i % PALETTE.length]])),
	);
	const colorOf = (taskId: number | null) =>
		taskId === null ? 'var(--series-rest)' : (taskColor.get(taskId) ?? 'var(--series-rest)');
	// Alpha has to be applied with color-mix now that the colours are var()
	// references — a hex-suffix like `${colour}B3` only works on literal hex.
	const colorOfAlpha = (taskId: number | null, percent: number) =>
		`color-mix(in oklch, ${colorOf(taskId)} ${percent}%, transparent)`;

	function formatDuration(hours: number): string {
		const totalMinutes = Math.round(hours * 60);
		const h = Math.floor(totalMinutes / 60);
		const m = totalMinutes % 60;

		if (h === 0) return `${m}m`;

		return m === 0 ? `${h}h` : `${h}h ${m}m`;
	}

	function formatClock(hours: number): string {
		const totalMinutes = Math.round(hours * 60);
		const h = Math.floor(totalMinutes / 60);
		const m = totalMinutes % 60;

		return `${h}:${String(m).padStart(2, '0')}`;
	}
</script>

<SeoHead title={m.energy_title_head()} description={m.energy_meta_description()} />

{#snippet paramRow(p: {
	id: string;
	label: string;
	hint: string;
	value: number;
	onchange: (v: number) => void;
	min: number;
	max: number;
	step: number;
	unit: string;
	accent?: string;
})}
	<div>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<label
						{...props}
						for={p.id}
						class="mb-text-2xs block w-fit cursor-help text-xs text-ty-secondary underline decoration-ty-ghost decoration-dotted underline-offset-4"
					>
						{p.label}
					</label>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left">
				<p>{p.hint}</p>
			</Tooltip.Content>
		</Tooltip.Root>
		<NumberInput
			id={p.id}
			value={p.value}
			onchange={p.onchange}
			min={p.min}
			max={p.max}
			step={p.step}
			unit={p.unit}
			accent={p.accent}
		/>
	</div>
{/snippet}

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
						<h1
							{...props}
							class="cursor-help text-2xl font-bold text-ty-primary underline decoration-ty-ghost decoration-dotted underline-offset-4"
						>
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
		<div class="space-y-grid-xl">
			<div
				class="rounded-2xl border bg-surface-card p-box-2xl text-center backdrop-blur shadow-card"
			>
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
		<div class="space-y-grid-xl">
			{#if activeTasks.length === 0}
				<!-- All done: the optimizer needs an open task, but the list below
				     stays visible so a task can be un-checked or added -->
				<div
					class="rounded-2xl border bg-surface-card p-box-2xl text-center backdrop-blur shadow-card"
				>
					<p class="text-ty-secondary">{m.energy_all_done()}</p>
					<p class="mt-text-2xs text-sm text-ty-silent">{m.energy_all_done_hint()}</p>
				</div>
			{:else}
				<!-- Timeline -->
				<div
					class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur"
				>
					<div class="mb-text-sm flex flex-wrap items-center justify-between gap-grid-xs">
						<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
							{m.energy_optimized_day()}
						</h3>
						<div class="flex items-center gap-grid-xs">
							<span class="text-xs text-ty-silent">
								{m.energy_work_free_summary({
									work: formatDuration(plan.evaluation.workHours),
									free: formatDuration(plan.evaluation.leisureHours),
								})}
							</span>
							<div class="flex rounded-lg border bg-surface-page/40 p-text-3xs text-xs">
								<button
									type="button"
									aria-pressed={planView === 'chart'}
									class={segmentedToggleVariants({
										tone: 'plan',
										active: planView === 'chart',
									})}
									onclick={() => setPlanView('chart')}
								>
									{m.energy_view_chart()}
								</button>
								<button
									type="button"
									aria-pressed={planView === 'schedule'}
									class={segmentedToggleVariants({
										tone: 'plan',
										active: planView === 'schedule',
									})}
									onclick={() => setPlanView('schedule')}
								>
									{m.energy_schedule()}
								</button>
							</div>
						</div>
					</div>
					{#if windowHours > 0}
						<div class="flex h-12 w-full overflow-hidden rounded-lg border">
							{#each plan.evaluation.blocks as block (block.start)}
								<div
									class="flex min-w-0 items-center justify-center border-r border-series-ink/40 last:border-r-0"
									style="width: {(block.hours / windowHours) *
										100}%; background-color: {colorOfAlpha(
										block.taskId,
										block.taskId === null ? 40 : 70,
									)}"
									title={m.energy_block_tooltip({
										title: block.title,
										start: formatClock(block.start),
										end: formatClock(block.start + block.hours),
										duration: formatDuration(block.hours),
									})}
								>
									{#if block.hours / windowHours > 0.07}
										<!-- series-ink, not ty-primary: ty-primary flips to white on the
										     31 dark themes and disappears on these fixed pastel fills -->
										<span class="truncate px-box-3xs text-xs font-medium text-series-ink">
											{block.title}
										</span>
									{/if}
								</div>
							{/each}
							{#if trailingFreeHours > 1e-6}
								<div
									class="flex min-w-0 items-center justify-center bg-transparent"
									style="width: {(trailingFreeHours / windowHours) * 100}%"
									title={m.energy_free_time_tooltip({
										duration: formatDuration(trailingFreeHours),
									})}
								>
									{#if trailingFreeHours / windowHours > 0.07}
										<span class="truncate px-box-3xs text-xs text-ty-silent">{m.energy_free()}</span
										>
									{/if}
								</div>
							{/if}
						</div>
						<div class="mt-text-2xs flex justify-between text-2xs text-ty-silent">
							<span>0:00</span>
							<span>{formatClock(windowHours)}</span>
						</div>
					{:else}
						<p class="text-sm text-ty-silent">{m.energy_set_window()}</p>
					{/if}

					<!-- Toggled region: energy chart ↔ schedule detail. The timeline bar
					     above and the summary stats below stay put in both views. -->
					{#if windowHours > 0}
						{#if planView === 'chart'}
							<EnergyChart {trajectory} {windowHours} />
						{:else if plan.evaluation.blocks.length === 0}
							<p class="mt-text-md text-sm text-ty-silent">
								{m.energy_nothing_scheduled()}
							</p>
						{:else}
							<ul class="mt-text-md space-y-text-xs">
								{#each plan.evaluation.blocks as block (block.start)}
									<li class="flex items-center gap-grid-xs text-sm">
										<span
											class="h-2.5 w-2.5 shrink-0 rounded-full"
											style="background-color: {colorOf(block.taskId)}"
										></span>
										<span class="w-24 shrink-0 tabular-nums text-ty-silent">
											{formatClock(block.start)}–{formatClock(block.start + block.hours)}
										</span>
										<span
											class="min-w-0 flex-1 truncate {block.taskId === null
												? 'text-ty-silent italic'
												: 'text-ty-primary'}"
										>
											{block.title}
										</span>
										<span class="shrink-0 text-xs text-ty-silent">
											{formatDuration(block.hours)}
										</span>
										{#if block.taskId !== null}
											<span class="w-20 shrink-0 text-right text-xs tabular-nums text-brand-strong">
												{m.energy_output_suffix({
													output: formatDecimals(block.output, 2),
												})}
											</span>
										{:else}
											<span class="w-20 shrink-0 text-right text-xs text-ty-silent">
												{m.energy_recovery()}
											</span>
										{/if}
									</li>
								{/each}
								{#if trailingFreeHours > 1e-6}
									<li class="flex items-center gap-grid-xs text-sm">
										<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-line-strong"
										></span>
										<span class="w-24 shrink-0 tabular-nums text-ty-silent">
											{formatClock(lab.plannedHours)}–{formatClock(windowHours)}
										</span>
										<span class="flex-1 text-ty-silent italic">{m.energy_free_time()}</span>
										<span class="shrink-0 text-xs text-ty-silent">
											{formatDuration(trailingFreeHours)}
										</span>
										<span class="w-20"></span>
									</li>
								{/if}
							</ul>
						{/if}

						<!-- Summary: the objective readout, visible in both views -->
						<div
							class="mt-text-lg grid grid-cols-2 gap-grid-md border-t border-line-soft pt-box-md sm:grid-cols-4"
						>
							<div>
								<p class="text-lg font-semibold text-ty-primary">
									{formatDecimals(plan.evaluation.totalOutput, 1)}
								</p>
								<p class="text-xs text-ty-silent">{m.energy_total_output()}</p>
							</div>
							<div>
								<p class="text-lg font-semibold text-ty-primary">
									{Math.round(plan.evaluation.endCog * 100)}% /
									{Math.round(plan.evaluation.endPhys * 100)}%
								</p>
								<p class="text-xs text-ty-silent">{m.energy_end_energy()}</p>
							</div>
							<div>
								<p class="text-lg font-semibold text-ty-primary">
									{formatDuration(plan.evaluation.workHours)}
								</p>
								<p class="text-xs text-ty-silent">{m.energy_planned_work()}</p>
							</div>
							<div>
								{#if outputVsClassic !== null}
									<p
										class="text-lg font-semibold {outputVsClassic >= 0
											? 'text-success'
											: 'text-warning'}"
									>
										{outputVsClassic >= 0 ? '+' : ''}{outputVsClassic}%
									</p>
									<!-- The only reading on this page that switch cost and the capacity
									     pools reach at all: they constrain the rival plan, never the
									     schedule above. Said out loud, or the number moves for no
									     visible reason when those are edited on the main page.

									     A tooltip and not `title=`: two sentences is past what a native
									     tooltip shows, touch shows one never, and the dotted underline is
									     what tells anyone it is there — the same treatment every other
									     explained label on this page gets. `child` keeps the tile's
									     <p>value</p><p>label</p> shape, which the e2e reads by preceding
									     sibling. -->
									<Tooltip.Provider delayDuration={150}>
										<Tooltip.Root>
											<Tooltip.Trigger>
												{#snippet child({ props })}
													<p
														{...props}
														class="w-fit cursor-help text-xs text-ty-silent underline decoration-ty-ghost decoration-dotted underline-offset-4"
													>
														{m.energy_vs_classic()}
													</p>
												{/snippet}
											</Tooltip.Trigger>
											<Tooltip.Content class="max-w-md">
												<p>{m.energy_vs_classic_title()}</p>
											</Tooltip.Content>
										</Tooltip.Root>
									</Tooltip.Provider>
								{:else}
									<p class="text-lg font-semibold text-ty-silent">—</p>
									<p class="text-xs text-ty-silent">{m.energy_no_classic()}</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div class="grid gap-grid-xl lg:grid-cols-3 items-start">
				<div class="space-y-grid-xl lg:col-span-2">
					<!-- Tasks: shared with the main page, edited live -->
					<div
						class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur"
					>
						<div class="mb-text-2xs flex items-baseline justify-between gap-grid-xs">
							<h3 class="text-xs font-semibold tracking-wider text-ty-secondary uppercase">
								{m.energy_tasks()}
							</h3>
							<span class="text-xs text-ty-silent">{m.energy_shared_note()}</span>
						</div>
						<p class="mb-text-sm text-xs text-ty-silent">
							{m.energy_drag_hint()}
						</p>
						<Tooltip.Provider delayDuration={150}>
							<ul class="space-y-text-2xs">
								{#each tasks as task (task.id)}
									<!-- The completed look dims the task's own identity, never the whole row:
									     it used to sit on the <li>, which faded the 🪫 rating that only exists
									     for a finished session into looking disabled. Same split as
									     task-item.svelte, which dims its title block alone. -->
									<li class="group rounded-lg p-box-2xs transition hover:bg-surface-hover">
										<div class="flex items-center gap-grid-xs">
											<input
												type="checkbox"
												checked={task.completed}
												onchange={() => onCompletionChange(task.id, task.completed)}
												aria-label={m.task_toggle_aria({
													title: task.title,
												})}
												class="h-4 w-4 cursor-pointer appearance-auto accent-brand focus:ring-2 focus:ring-brand/40"
											/>
											<span
												class="h-2.5 w-2.5 shrink-0 rounded-full"
												class:opacity-50={task.completed}
												style="background-color: {colorOf(task.id)}"
											></span>
											<span
												class:opacity-50={task.completed}
												class="min-w-0 flex-1 truncate text-sm font-medium capitalize {task.completed
													? 'text-ty-silent line-through'
													: 'text-ty-primary'}"
											>
												{task.title}
											</span>
											<!-- Deliberately NOT hidden on a completed task, unlike the sliders
											     below: finishing one is the commonest way a session ends, and
											     the drain rating is the whole point of the row. -->
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															{...props}
															type="button"
															aria-label={m.energy_log_drain_aria()}
															class="shrink-0 transition {todaysDrainLog(task.id)
																? 'text-flow'
																: 'text-ty-silent opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 hover:text-flow'}"
															onclick={() =>
																drainDraft?.taskId === task.id
																	? (drainDraft = null)
																	: openDrainLog(task.id, 'button')}
														>
															🪫
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content side="top">
													<p>{m.energy_log_drain_tooltip()}</p>
												</Tooltip.Content>
											</Tooltip.Root>
											<button
												type="button"
												aria-label={m.task_remove_aria()}
												title={m.task_remove_tooltip()}
												class="shrink-0 text-ty-silent opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
												onclick={() => session.removeTask(task.id)}
											>
												✕
											</button>
										</div>
										{#if !task.completed}
											<div class="mt-text-xs ml-7 grid gap-x-grid-lg gap-y-grid-2xs sm:grid-cols-3">
												{#each sliders as s (s.key)}
													<label
														class="flex items-center gap-text-xs text-2xs text-ty-silent"
														title={s.title}
													>
														<span class="w-3 font-medium {s.color}">{s.label}</span>
														<input
															type="range"
															min={s.min}
															max="10"
															value={task[s.key]}
															oninput={(e) =>
																setTaskValue(task.id, s.key, Number(e.currentTarget.value))}
															class="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-surface-inset {s.accent}"
														/>
														<span class="w-4 text-right tabular-nums text-ty-secondary">
															{task[s.key]}
														</span>
													</label>
												{/each}
											</div>
										{/if}
										{#if drainDraft?.taskId === task.id}
											{@const draft = drainDraft}
											<form
												class={MEASUREMENT_FORM_CLASS}
												onsubmit={(e) => (e.preventDefault(), saveDrainLog())}
											>
												<span class="text-ty-secondary">{m.energy_drain_form_title()}</span>
												<label class="flex items-center gap-grid-2xs">
													{m.energy_drain_worked_label()}
													<input
														type="number"
														min="1"
														max="960"
														placeholder={m.task_minutes_placeholder()}
														{@attach (node) => {
															if (focusDrainInput) node.focus();
														}}
														bind:value={draft.minutes}
														required
														class={MEASUREMENT_MINUTES_CLASS}
													/>
												</label>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<label {...props} class="flex items-center gap-grid-2xs">
																<span class="font-medium text-mind/80">
																	{m.energy_drain_mind_label()}
																</span>
																<input
																	type="number"
																	min="0"
																	max="10"
																	step="1"
																	bind:value={draft.mind}
																	required
																	class="w-12 rounded-sm border border-mind/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-mind/60"
																/>
															</label>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content side="top">
														<p>{m.energy_drain_mind_title()}</p>
													</Tooltip.Content>
												</Tooltip.Root>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<label {...props} class="flex items-center gap-grid-2xs">
																<span class="font-medium text-body/80">
																	{m.energy_drain_body_label()}
																</span>
																<input
																	type="number"
																	min="0"
																	max="10"
																	step="1"
																	bind:value={draft.body}
																	required
																	class="w-12 rounded-sm border border-body/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-body/60"
																/>
															</label>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content side="top">
														<p>{m.energy_drain_body_title()}</p>
													</Tooltip.Content>
												</Tooltip.Root>
												<span class="ml-auto flex items-center gap-grid-2xs">
													<button type="submit" class="px-text-2xs text-flow hover:text-flow">
														✓
													</button>
													<button
														type="button"
														class="px-text-2xs text-ty-silent hover:text-ty-secondary"
														onclick={() => (drainDraft = null)}
													>
														✕
													</button>
												</span>
											</form>
										{/if}
									</li>
								{/each}
							</ul>
						</Tooltip.Provider>
						<div class="mt-text-sm">
							<TaskForm onsubmit={(t) => session.addTask(t)} startOpen={false} />
						</div>
					</div>
				</div>

				<!-- Parameters + calibration -->
				<div class="space-y-grid-lg">
					<Tooltip.Provider delayDuration={150}>
						<div
							class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur"
						>
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
								{@render paramRow({
									id: 'window-hours',
									label: m.energy_day_window(),
									hint: m.energy_day_window_hint(),
									value: windowHours,
									onchange: (v) => (session.availableHours = v),
									min: 0,
									max: 24,
									step: 0.25,
									unit: m.unit_hours(),
								})}
								{@render paramRow({
									id: 'alpha-cog',
									label: m.energy_cognitive_drain(),
									hint: m.energy_cognitive_drain_hint(),
									value: params.alphaCog,
									onchange: (v) => lab.setParam('alphaCog', v),
									min: 0.05,
									max: 2,
									step: 0.05,
									unit: m.unit_per_hour(),
									accent: 'focus-within:border-mind/50',
								})}
								{@render paramRow({
									id: 'alpha-phys',
									label: m.energy_physical_drain(),
									hint: m.energy_physical_drain_hint(),
									value: params.alphaPhys,
									onchange: (v) => lab.setParam('alphaPhys', v),
									min: 0.05,
									max: 2,
									step: 0.05,
									unit: m.unit_per_hour(),
									accent: 'focus-within:border-body/50',
								})}
								{@render paramRow({
									id: 'recovery-rate',
									label: m.energy_recovery_rate(),
									hint: m.energy_recovery_rate_hint(),
									value: params.recoveryRate,
									onchange: (v) => lab.setParam('recoveryRate', v),
									min: 0.1,
									max: 3,
									step: 0.1,
									unit: m.unit_per_hour(),
								})}
								{@render paramRow({
									id: 'free-time-value',
									label: m.energy_free_time_value(),
									hint: m.energy_free_time_value_hint(),
									value: params.freeTimeValue,
									onchange: (v) => lab.setParam('freeTimeValue', v),
									min: 0,
									max: 3,
									step: 0.1,
									unit: m.unit_output_per_hour(),
								})}
								{@render paramRow({
									id: 'terminal-value',
									label: m.energy_evening_energy(),
									hint: m.energy_evening_energy_hint(),
									value: params.terminalEnergyValue,
									onchange: (v) => lab.setParam('terminalEnergyValue', v),
									min: 0,
									max: 5,
									step: 0.25,
									unit: m.unit_output(),
								})}
								{@render paramRow({
									id: 'satiety-scale',
									label: m.energy_satiety(),
									hint: m.energy_satiety_hint(),
									value: params.satietyScale,
									onchange: (v) => lab.setParam('satietyScale', v),
									min: 0,
									max: 5,
									step: 0.25,
									unit: '×',
								})}
								{@render paramRow({
									id: 'micro-recovery',
									label: m.energy_micro_recovery(),
									hint: m.energy_micro_recovery_hint(),
									value: Number((params.microRecoveryFraction * 100).toFixed(1)),
									onchange: (v) => lab.setParam('microRecoveryFraction', v / 100),
									min: 0,
									max: 30,
									step: 1,
									unit: '%',
								})}
							</div>
						</div>

						<!-- Drain calibration: fitted α from end-of-session ratings -->
						<div
							class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur"
						>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<h3
											{...props}
											class="w-fit cursor-help text-xs font-semibold tracking-wider text-ty-secondary uppercase underline decoration-ty-ghost decoration-dotted underline-offset-4"
										>
											{m.energy_calibration()}
										</h3>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="left">
									<p>{m.energy_calibration_hint()}</p>
								</Tooltip.Content>
							</Tooltip.Root>

							{#if drainObservations.length === 0}
								<p class="mt-text-sm text-xs text-ty-silent">{m.energy_calibration_empty()}</p>
							{:else}
								<div class="mt-text-sm space-y-text-xs">
									<div class="flex items-baseline justify-between gap-text-xs text-xs">
										<span class="text-ty-silent">{m.energy_cognitive_drain()}</span>
										{#if cogDrainFit.fitted}
											<span class="tabular-nums text-mind-strong">
												{m.energy_fit_value({
													alpha: formatDecimals(cogDrainFit.alpha, 2),
													std: formatDecimals(cogDrainFit.alphaStd ?? 0, 2),
													count: cogDrainFit.usedCount,
												})}
											</span>
										{:else}
											<span class="text-ty-silent">{m.energy_fit_no_signal()}</span>
										{/if}
									</div>
									<div class="flex items-baseline justify-between gap-text-xs text-xs">
										<span class="text-ty-silent">{m.energy_physical_drain()}</span>
										{#if physDrainFit.fitted}
											<span class="tabular-nums text-body/90">
												{m.energy_fit_value({
													alpha: formatDecimals(physDrainFit.alpha, 2),
													std: formatDecimals(physDrainFit.alphaStd ?? 0, 2),
													count: physDrainFit.usedCount,
												})}
											</span>
										{:else}
											<span class="text-ty-silent">{m.energy_fit_no_signal()}</span>
										{/if}
									</div>
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
													onclick={() => observations.deleteDrainLog(log.id!)}
												>
													✕
												</button>
											</span>
										{/snippet}
									</LogList>
								</div>
							{/if}
						</div>

						<!-- Recovery calibration: fitted r from pre/post-rest rating pairs -->
						<div
							class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur"
						>
							<div class="flex items-baseline justify-between gap-grid-xs">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<h3
												{...props}
												class="w-fit cursor-help text-xs font-semibold tracking-wider text-ty-secondary uppercase underline decoration-ty-ghost decoration-dotted underline-offset-4"
											>
												{m.energy_recovery_calibration()}
											</h3>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content side="left">
										<p>{m.energy_recovery_calibration_hint()}</p>
									</Tooltip.Content>
								</Tooltip.Root>
								<button
									type="button"
									class="shrink-0 text-xs transition {restDraft
										? 'text-ty-silent hover:text-ty-secondary'
										: 'text-info/90 hover:text-info-strong'}"
									onclick={() =>
										(restDraft = restDraft
											? null
											: {
													minutes: null,
													mindBefore: null,
													mindAfter: null,
													bodyBefore: null,
													bodyAfter: null,
												})}
								>
									{restDraft ? m.common_cancel() : `☕ ${m.energy_log_rest()}`}
								</button>
							</div>

							{#if restDraft}
								<form
									class="mt-text-sm flex flex-wrap items-center gap-x-grid-xs gap-y-grid-2xs rounded-lg border border-info/20 bg-surface-page/40 px-box-xs py-box-2xs text-2xs text-ty-silent"
									onsubmit={(e) => (e.preventDefault(), saveRestLog())}
								>
									<label class="flex items-center gap-grid-2xs">
										{m.energy_rest_rested_label()}
										<!-- Always focuses: the ☕ button is the only way in, so the caret is
										     always asked for. Not `autofocus` — see `focusDrainInput`. -->
										<input
											type="number"
											min="1"
											max="480"
											placeholder={m.task_minutes_placeholder()}
											{@attach (node) => node.focus()}
											bind:value={restDraft.minutes}
											required
											class="w-14 rounded-sm border border-info/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-info/60"
										/>
									</label>
									<span class="flex items-center gap-grid-2xs">
										{m.energy_rest_before_label()}
										<label
											class="flex items-center gap-grid-2xs"
											title={m.energy_rest_mind_title()}
										>
											<span class="font-medium text-mind/80">
												{m.energy_drain_mind_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.mindBefore}
												required
												class="w-12 rounded-sm border border-mind/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-mind/60"
											/>
										</label>
										<label
											class="flex items-center gap-grid-2xs"
											title={m.energy_rest_body_title()}
										>
											<span class="font-medium text-body/80">
												{m.energy_drain_body_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.bodyBefore}
												required
												class="w-12 rounded-sm border border-body/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-body/60"
											/>
										</label>
									</span>
									<span class="flex items-center gap-grid-2xs">
										{m.energy_rest_after_label()}
										<label
											class="flex items-center gap-grid-2xs"
											title={m.energy_rest_mind_title()}
										>
											<span class="font-medium text-mind/80">
												{m.energy_drain_mind_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.mindAfter}
												required
												class="w-12 rounded-sm border border-mind/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-mind/60"
											/>
										</label>
										<label
											class="flex items-center gap-grid-2xs"
											title={m.energy_rest_body_title()}
										>
											<span class="font-medium text-body/80">
												{m.energy_drain_body_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.bodyAfter}
												required
												class="w-12 rounded-sm border border-body/30 bg-input px-box-3xs py-text-3xs text-xs text-ty-primary outline-none focus:border-body/60"
											/>
										</label>
									</span>
									<span class="ml-auto flex items-center gap-grid-2xs">
										<button type="submit" class="px-text-2xs text-info hover:text-info-strong"
											>✓</button
										>
										<button
											type="button"
											class="px-text-2xs text-ty-silent hover:text-ty-secondary"
											onclick={() => (restDraft = null)}
										>
											✕
										</button>
									</span>
								</form>
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
												rate: formatDecimals(recoveryFit.rate, 2),
												std: formatDecimals(recoveryFit.rateStd ?? 0, 2),
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
													onclick={() => observations.deleteRestLog(log.id!)}
												>
													✕
												</button>
											</span>
										{/snippet}
									</LogList>
								</div>
							{/if}
						</div>

						<!-- Stopping calibration: fitted λ₀ from finished days' stop decisions -->
						<div
							class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl shadow-card backdrop-blur"
						>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<h3
											{...props}
											class="w-fit cursor-help text-xs font-semibold tracking-wider text-ty-secondary uppercase underline decoration-ty-ghost decoration-dotted underline-offset-4"
										>
											{m.energy_stop_calibration()}
										</h3>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="left">
									<p>{m.energy_stop_calibration_hint()}</p>
								</Tooltip.Content>
							</Tooltip.Root>

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
											value: formatDecimals(stopFit.value, 2),
											std: formatDecimals(stopFit.valueStd ?? 0, 2),
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
						</div>
					</Tooltip.Provider>
				</div>
			</div>
		</div>
	{/if}
{/if}
