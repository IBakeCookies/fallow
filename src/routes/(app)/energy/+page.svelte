<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { segmentedToggleVariants } from '$lib/presentation/component/segmented-toggle-variants';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import EnergyChart from '$lib/presentation/component/energy-chart.svelte';
	import LogList from '$lib/presentation/component/log-list.svelte';
	import {
		DEFAULT_ENERGY_PARAMS,
		optimizeSchedule,
		evaluateSchedule,
		sampleTrajectory,
		fitDrainRate,
		fitRecoveryRate,
		fitStoppingValue,
		type EnergyParams,
		type EnergyTaskInput,
		type ScheduleBlock,
		type StopObservation
	} from '$lib/business/model/zenith-energy';
	import { readStopObservations } from '$lib/business/store/session-history';
	import {
		type Task,
		getEffectiveDifficulty,
		calculateSuggestedTasks,
		calculateInterleavedOrder
	} from '$lib/business/model/metric/calculation';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';

	const PARAMS_KEY = 'zenith-energy-params';
	const VIEW_KEY = 'zenith-energy-view';

	// Tasks, budget, pools and personalized constants come live from the shared
	// session store — edits here save to the same daily session as the main
	// page, and the schedule re-optimizes as you drag a slider.
	const session = getSessionStore();
	const tasks = $derived(session.tasks);
	const activeTasks = $derived(session.activeTasks);
	const switchCost = $derived(session.switchCost);
	const pools = $derived(session.pools);
	const userConstants = $derived(session.userConstants);

	// Day window follows today's budget until overridden — the override is
	// lab-local and never written back to the session.
	let windowOverride = $state<number | null>(null);
	const windowHours = $derived(windowOverride ?? (session.availableHours || 8));

	// Model parameters are local to the lab (localStorage, not the session —
	// the lab never writes them to the main app's data)
	let params = $state<EnergyParams>({ ...DEFAULT_ENERGY_PARAMS });
	let paramsLoaded = $state(false);

	// The plan card's lower region: energy chart or the schedule detail list.
	// The timeline bar and the summary stats stay visible in both views.
	let planView = $state<'chart' | 'schedule'>('chart');

	function setPlanView(view: 'chart' | 'schedule') {
		planView = view;
		try {
			localStorage.setItem(VIEW_KEY, view);
		} catch {
			// private-mode storage failures just lose the preference
		}
	}

	// Persisted params are user-reachable JSON: accept only finite numbers for
	// known keys, so corrupt-but-parseable data (e.g. {"recoveryRate":"abc"})
	// can't reach the model.
	function sanitizeParams(raw: unknown): EnergyParams {
		const p: EnergyParams = { ...DEFAULT_ENERGY_PARAMS };
		if (raw && typeof raw === 'object') {
			for (const key of Object.keys(p) as (keyof EnergyParams)[]) {
				const v = (raw as Record<string, unknown>)[key];
				if (typeof v === 'number' && Number.isFinite(v)) p[key] = v;
			}
		}
		return p;
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem(PARAMS_KEY);
			if (saved) params = sanitizeParams(JSON.parse(saved));
			const savedView = localStorage.getItem(VIEW_KEY);
			if (savedView === 'chart' || savedView === 'schedule') planView = savedView;
		} catch (e) {
			console.error('Failed to load energy lab params', e);
		}
		paramsLoaded = true;
	});

	$effect(() => {
		if (browser && paramsLoaded) {
			localStorage.setItem(PARAMS_KEY, JSON.stringify(params));
		}
	});

	// Optimize over ALL tasks (completed included), matching the main page's
	// allocator: checking a task done must not reshuffle the day's plan.
	const energyTasks = $derived<EnergyTaskInput[]>(
		tasks.map((t) => ({
			id: t.id,
			title: t.title,
			difficulty: getEffectiveDifficulty(t),
			enjoyment: t.enjoyment,
			cognitiveDemand: t.mentalDifficulty / 10,
			physicalDemand: t.physicalDifficulty / 10
		}))
	);

	const plan = $derived(optimizeSchedule(energyTasks, windowHours, params, userConstants));
	const trajectory = $derived(
		sampleTrajectory(plan.blocks, energyTasks, windowHours, params, userConstants)
	);

	// The classic allocator's plan (same math as the main page), evaluated under
	// THIS model: interleaved run order, switch costs as rest gaps.
	const classicEval = $derived.by(() => {
		if (windowHours <= 0 || energyTasks.length === 0) return null;
		const suggested = calculateSuggestedTasks(
			tasks,
			windowHours,
			switchCost,
			pools,
			userConstants,
			session.constantsFit.posterior
		);
		// Completed tasks stay in: both plans simulate the full intended day,
		// otherwise the comparison strips work from the classic side only.
		const funded = calculateInterleavedOrder(suggested);
		if (funded.length === 0) return null;
		const blocks: ScheduleBlock[] = [];
		funded.forEach((t, i) => {
			if (i > 0 && switchCost > 0) blocks.push({ taskId: null, hours: switchCost });
			blocks.push({ taskId: t.id, hours: t.suggestedHours });
		});
		return evaluateSchedule(blocks, energyTasks, windowHours, params, userConstants);
	});

	const outputVsClassic = $derived(
		classicEval && classicEval.totalOutput > 0
			? Math.round(
					((plan.evaluation.totalOutput - classicEval.totalOutput) / classicEval.totalOutput) * 100
				)
			: null
	);

	// ---------- Live task editing ----------

	type SliderKey = 'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment';

	const sliders = [
		{
			key: 'physicalDifficulty',
			label: 'P',
			title: m.energy_slider_physical(),
			min: 0,
			accent: 'accent-body',
			color: 'text-body/80'
		},
		{
			key: 'mentalDifficulty',
			label: 'M',
			title: m.energy_slider_mental(),
			min: 0,
			accent: 'accent-mind',
			color: 'text-mind/80'
		},
		{
			key: 'enjoyment',
			label: 'E',
			title: m.energy_slider_enjoyment(),
			min: 1,
			accent: 'accent-brand',
			color: 'text-brand/80'
		}
	] as const;

	function setTaskValue(id: number, key: SliderKey, value: number) {
		const changes: Partial<Pick<Task, SliderKey>> = {};
		changes[key] = value;
		session.updateTask(id, changes);
	}

	// ---------- Drain calibration (α fit from end-of-session ratings) ----------

	const drainObservations = $derived(session.drainObservations);

	// The fit conditions on the CURRENT recovery parameters (that conditioning
	// is what makes α identifiable at all — MATH.md §8.7), so dragging a
	// recovery slider legitimately re-fits. The prior anchors to the model
	// DEFAULTS, not the current inputs, mirroring fitUserConstants.
	const drainLawParams = $derived({
		recoveryRate: params.recoveryRate,
		restRecoveryMultiplier: params.restRecoveryMultiplier,
		microRecoveryFraction: params.microRecoveryFraction
	});
	const cogDrainFit = $derived(
		fitDrainRate(
			drainObservations.map((o) => ({
				demand: o.cognitiveDemand,
				hours: o.hours,
				drainedFraction: o.mindDrain / 10
			})),
			DEFAULT_ENERGY_PARAMS.alphaCog,
			drainLawParams
		)
	);
	const physDrainFit = $derived(
		fitDrainRate(
			drainObservations.map((o) => ({
				demand: o.physicalDemand,
				hours: o.hours,
				drainedFraction: o.bodyDrain / 10
			})),
			DEFAULT_ENERGY_PARAMS.alphaPhys,
			drainLawParams
		)
	);

	const round2 = (x: number) => Math.round(x * 100) / 100;
	const fitApplied = $derived(
		(!cogDrainFit.fitted || Math.abs(params.alphaCog - round2(cogDrainFit.alpha)) < 1e-9) &&
			(!physDrainFit.fitted || Math.abs(params.alphaPhys - round2(physDrainFit.alpha)) < 1e-9)
	);

	function applyDrainFit() {
		if (cogDrainFit.fitted) params.alphaCog = round2(cogDrainFit.alpha);
		if (physDrainFit.fitted) params.alphaPhys = round2(physDrainFit.alpha);
	}

	// Inline per-task rating editor (🪫): mirrors the main page's ⚡ editor,
	// including its minutes-based duration input (the record stores hours).
	let drainDraft = $state<{
		taskId: number;
		minutes: number | null;
		mind: number | null;
		body: number | null;
	} | null>(null);

	const todaysDrainLog = (taskId: number) =>
		drainObservations.find((o) => o.date === session.today && o.taskId === taskId);

	function openDrainLog(taskId: number) {
		const existing = todaysDrainLog(taskId);
		drainDraft = {
			taskId,
			minutes: existing ? Math.round(existing.hours * 60) : null,
			mind: existing?.mindDrain ?? null,
			body: existing?.bodyDrain ?? null
		};
	}

	function saveDrainLog() {
		if (!drainDraft) return;
		const minutes = Number(drainDraft.minutes);
		const mind = Number(drainDraft.mind);
		const body = Number(drainDraft.body);
		if (!minutes || minutes <= 0 || !Number.isFinite(mind) || !Number.isFinite(body)) return;
		session.logDrain(
			drainDraft.taskId,
			minutes / 60,
			Math.min(10, Math.max(0, mind)),
			Math.min(10, Math.max(0, body))
		);
		drainDraft = null;
	}

	// ---------- Recovery calibration (r fit from pre/post-rest pairs) ----------

	const restObservations = $derived(session.restObservations);

	// During pure rest the reservoir law loses α entirely (drain decays as
	// d_before·e^(−r·m·g) — MATH.md §8.9), so this fit needs no drain
	// parameters: it conditions only on the rest multiplier (rest data
	// identifies the product r·m). Both reservoirs' ratings feed the ONE
	// shared recovery rate, and the α fit above then conditions on it —
	// fitting r first makes that conditioning well-founded, not circular.
	const recoveryFit = $derived(
		fitRecoveryRate(
			restObservations.flatMap((o) => [
				{ drainedBefore: o.mindBefore / 10, drainedAfter: o.mindAfter / 10, hours: o.hours },
				{ drainedBefore: o.bodyBefore / 10, drainedAfter: o.bodyAfter / 10, hours: o.hours }
			]),
			DEFAULT_ENERGY_PARAMS.recoveryRate,
			{ restRecoveryMultiplier: params.restRecoveryMultiplier }
		)
	);

	const recoveryFitApplied = $derived(
		!recoveryFit.fitted || Math.abs(params.recoveryRate - round2(recoveryFit.rate)) < 1e-9
	);

	function applyRecoveryFit() {
		if (recoveryFit.fitted) params.recoveryRate = round2(recoveryFit.rate);
	}

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
		if (!minutes || minutes <= 0) return;
		const rating = (value: number | null) =>
			Math.min(10, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
		session.logRest(
			minutes / 60,
			rating(restDraft.mindBefore),
			rating(restDraft.mindAfter),
			rating(restDraft.bodyBefore),
			rating(restDraft.bodyAfter)
		);
		restDraft = null;
	}

	// ---------- Stopping calibration (λ₀ fit from finished days) ----------

	// Past days' stop decisions: each day's 🪫 worked minutes joined with that
	// day's stored session (MATH.md §8.10). Re-derived when the drain logs
	// change (deleting a past rating must refit); today's logs never enter —
	// an unfinished day has not revealed its stop yet.
	let stopObservations = $state<StopObservation[]>([]);
	// Version guard against out-of-order async completions (same pattern as
	// the calendar page's loadVersion): only the latest read may land.
	let stopLoadVersion = 0;
	$effect(() => {
		void drainObservations;
		const version = ++stopLoadVersion;
		readStopObservations(session.today).then((obs) => {
			if (version === stopLoadVersion) stopObservations = obs;
		});
	});

	// Conditions on ALL current dynamics params (α, r, m, b, satiety) and the
	// user-owned terminal energy value — so a conditioning-slider change
	// legitimately re-fits, like the drain fit re-fitting under new recovery
	// sliders. The extraction itself is λ₀-free (no circularity with the
	// current free-time slider). Prior anchors to the model DEFAULT.
	const stopFit = $derived(
		fitStoppingValue(stopObservations, DEFAULT_ENERGY_PARAMS.freeTimeValue, params, userConstants)
	);

	const stopFitApplied = $derived(
		!stopFit.fitted || Math.abs(params.freeTimeValue - round2(stopFit.value)) < 1e-9
	);

	function applyStopFit() {
		if (stopFit.fitted) params.freeTimeValue = round2(stopFit.value);
	}

	// ---------- Presentation helpers ----------

	const PALETTE = [
		'#818cf8',
		'#34d399',
		'#fbbf24',
		'#fb7185',
		'#38bdf8',
		'#e879f9',
		'#a3e635',
		'#fb923c'
	];
	const taskColor = $derived(
		new Map(energyTasks.map((t, i) => [t.id, PALETTE[i % PALETTE.length]]))
	);
	const colorOf = (taskId: number | null) =>
		taskId === null ? '#3f3f46' : (taskColor.get(taskId) ?? '#71717a');

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

	const plannedHours = $derived(plan.blocks.reduce((sum, b) => sum + b.hours, 0));
	const trailingFreeHours = $derived(Math.max(0, windowHours - plannedHours));
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
						class="mb-text-2xs block w-fit cursor-help text-xs text-ty-secondary underline decoration-dotted underline-offset-2"
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
		class="mt-text-sm w-full rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand-strong transition hover:bg-brand/20 disabled:cursor-default disabled:border-border disabled:bg-transparent disabled:text-ty-silent"
		{disabled}
		{title}
		{onclick}
	>
		{label}
	</button>
{/snippet}

{#if !session.isLoading && paramsLoaded}
	<div class="mb-text-xl">
		<div class="flex items-center gap-grid-md">
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
			<span
				class="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning-strong"
			>
				{m.energy_experimental()}
			</span>
		</div>
	</div>

	{#if tasks.length === 0}
		<div class="space-y-grid-xl">
			<div class="rounded-2xl border bg-surface-card p-box-2xl text-center">
				<p class="text-ty-secondary">{m.energy_no_open_tasks()}</p>
				<p class="mt-text-2xs text-sm text-ty-silent">
					{m.energy_no_open_tasks_hint()}
				</p>
			</div>
			<TaskForm onsubmit={(t) => session.addTask(t)} />
		</div>
	{:else}
		<div class="space-y-grid-xl">
			{#if activeTasks.length === 0}
				<!-- All done: the optimizer needs an open task, but the list below
				     stays visible so a task can be un-checked or added -->
				<div class="rounded-2xl border bg-surface-card p-box-2xl text-center">
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
									free: formatDuration(plan.evaluation.leisureHours)
								})}
							</span>
							<div class="flex rounded-lg border bg-surface-page/40 p-0.5 text-xs">
								<button
									type="button"
									aria-pressed={planView === 'chart'}
									class={segmentedToggleVariants({ tone: 'plan', active: planView === 'chart' })}
									onclick={() => setPlanView('chart')}
								>
									{m.energy_view_chart()}
								</button>
								<button
									type="button"
									aria-pressed={planView === 'schedule'}
									class={segmentedToggleVariants({ tone: 'plan', active: planView === 'schedule' })}
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
									class="flex min-w-0 items-center justify-center border-r border-black/40 last:border-r-0"
									style="width: {(block.hours / windowHours) * 100}%; background-color: {colorOf(
										block.taskId
									)}{block.taskId === null ? '66' : 'B3'}"
									title={m.energy_block_tooltip({
										title: block.title,
										start: formatClock(block.start),
										end: formatClock(block.start + block.hours),
										duration: formatDuration(block.hours)
									})}
								>
									{#if block.hours / windowHours > 0.07}
										<span class="truncate px-1.5 text-xs font-medium text-ty-primary">
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
										duration: formatDuration(trailingFreeHours)
									})}
								>
									{#if trailingFreeHours / windowHours > 0.07}
										<span class="truncate px-1.5 text-xs text-ty-silent">{m.energy_free()}</span>
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
											<span
												class="w-20 shrink-0 text-right text-xs tabular-nums text-brand-strong/80"
											>
												{m.energy_output_suffix({ output: block.output.toFixed(2) })}
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
											{formatClock(plannedHours)}–{formatClock(windowHours)}
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
						<div class="mt-text-lg grid grid-cols-2 gap-grid-md border-t pt-box-md sm:grid-cols-4">
							<div>
								<p class="text-lg font-semibold text-ty-primary">
									{plan.evaluation.totalOutput.toFixed(1)}
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
									<p class="text-xs text-ty-silent">
										{m.energy_vs_classic()}
									</p>
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
									<li
										class="group rounded-lg p-2 transition hover:bg-surface-card"
										class:opacity-50={task.completed}
									>
										<div class="flex items-center gap-grid-xs">
											<input
												type="checkbox"
												checked={task.completed}
												onchange={() => session.toggleTask(task.id)}
												class="h-4 w-4 cursor-pointer rounded border-line-strong bg-input text-success focus:ring-brand/20"
											/>
											<span
												class="h-2.5 w-2.5 shrink-0 rounded-full"
												style="background-color: {colorOf(task.id)}"
											></span>
											<span
												class="min-w-0 flex-1 truncate text-sm font-medium capitalize {task.completed
													? 'text-ty-silent line-through'
													: 'text-ty-primary'}"
											>
												{task.title}
											</span>
											{#if !task.completed}
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
																		: openDrainLog(task.id)}
															>
																🪫
															</button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content side="top">
														<p>{m.energy_log_drain_tooltip()}</p>
													</Tooltip.Content>
												</Tooltip.Root>
											{/if}
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
														class="flex items-center gap-2 text-2xs text-ty-silent"
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
															class="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-line-strong {s.accent}"
														/>
														<span class="w-4 text-right tabular-nums text-ty-secondary">
															{task[s.key]}
														</span>
													</label>
												{/each}
											</div>
											{#if drainDraft?.taskId === task.id}
												{@const draft = drainDraft}
												<form
													class="mt-text-xs ml-7 flex flex-wrap items-center gap-x-grid-xs gap-y-grid-2xs rounded-lg border border-flow/20 bg-surface-page/40 px-2.5 py-2 text-2xs text-ty-silent"
													onsubmit={(e) => (e.preventDefault(), saveDrainLog())}
												>
													<span class="text-ty-secondary">{m.energy_drain_form_title()}</span>
													<label class="flex items-center gap-grid-2xs">
														{m.energy_drain_worked_label()}
														<!-- svelte-ignore a11y_autofocus -->
														<input
															type="number"
															min="1"
															max="960"
															placeholder={m.task_minutes_placeholder()}
															autofocus
															bind:value={draft.minutes}
															class="w-14 rounded border border-flow/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-flow/60"
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
																		class="w-12 rounded border border-mind/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-mind/60"
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
																		class="w-12 rounded border border-body/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-body/60"
																	/>
																</label>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="top">
															<p>{m.energy_drain_body_title()}</p>
														</Tooltip.Content>
													</Tooltip.Root>
													<span class="ml-auto flex items-center gap-grid-2xs">
														<button type="submit" class="px-1 text-flow hover:text-flow">
															✓
														</button>
														<button
															type="button"
															class="px-1 text-ty-silent hover:text-ty-secondary"
															onclick={() => (drainDraft = null)}
														>
															✕
														</button>
													</span>
												</form>
											{/if}
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
									onclick={() => (params = { ...DEFAULT_ENERGY_PARAMS })}
								>
									{m.energy_reset_defaults()}
								</button>
							</div>
							<div class="space-y-grid-md">
								{@render paramRow({
									id: 'window-hours',
									label: m.energy_day_window(),
									hint: m.energy_day_window_hint(),
									value: windowHours,
									onchange: (v) => (windowOverride = v),
									min: 0,
									max: 24,
									step: 0.5,
									unit: m.unit_hours()
								})}
								{@render paramRow({
									id: 'alpha-cog',
									label: m.energy_cognitive_drain(),
									hint: m.energy_cognitive_drain_hint(),
									value: params.alphaCog,
									onchange: (v) => (params.alphaCog = v),
									min: 0.05,
									max: 2,
									step: 0.05,
									unit: '/h',
									accent: 'focus-within:border-mind/50'
								})}
								{@render paramRow({
									id: 'alpha-phys',
									label: m.energy_physical_drain(),
									hint: m.energy_physical_drain_hint(),
									value: params.alphaPhys,
									onchange: (v) => (params.alphaPhys = v),
									min: 0.05,
									max: 2,
									step: 0.05,
									unit: '/h',
									accent: 'focus-within:border-body/50'
								})}
								{@render paramRow({
									id: 'recovery-rate',
									label: m.energy_recovery_rate(),
									hint: m.energy_recovery_rate_hint(),
									value: params.recoveryRate,
									onchange: (v) => (params.recoveryRate = v),
									min: 0.1,
									max: 3,
									step: 0.1,
									unit: '/h'
								})}
								{@render paramRow({
									id: 'free-time-value',
									label: m.energy_free_time_value(),
									hint: m.energy_free_time_value_hint(),
									value: params.freeTimeValue,
									onchange: (v) => (params.freeTimeValue = v),
									min: 0,
									max: 3,
									step: 0.1,
									unit: 'out/h'
								})}
								{@render paramRow({
									id: 'terminal-value',
									label: m.energy_evening_energy(),
									hint: m.energy_evening_energy_hint(),
									value: params.terminalEnergyValue,
									onchange: (v) => (params.terminalEnergyValue = v),
									min: 0,
									max: 5,
									step: 0.25,
									unit: 'out'
								})}
								{@render paramRow({
									id: 'satiety-scale',
									label: m.energy_satiety(),
									hint: m.energy_satiety_hint(),
									value: params.satietyScale,
									onchange: (v) => (params.satietyScale = v),
									min: 0,
									max: 5,
									step: 0.25,
									unit: '×'
								})}
								{@render paramRow({
									id: 'micro-recovery',
									label: m.energy_micro_recovery(),
									hint: m.energy_micro_recovery_hint(),
									value: Number((params.microRecoveryFraction * 100).toFixed(1)),
									onchange: (v) => (params.microRecoveryFraction = v / 100),
									min: 0,
									max: 30,
									step: 1,
									unit: '%'
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
											<span class="tabular-nums text-mind-strong/90">
												{m.energy_fit_value({
													alpha: cogDrainFit.alpha.toFixed(2),
													std: (cogDrainFit.alphaStd ?? 0).toFixed(2),
													count: cogDrainFit.usedCount
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
													alpha: physDrainFit.alpha.toFixed(2),
													std: (physDrainFit.alphaStd ?? 0).toFixed(2),
													count: physDrainFit.usedCount
												})}
											</span>
										{:else}
											<span class="text-ty-silent">{m.energy_fit_no_signal()}</span>
										{/if}
									</div>
								</div>

								{#if cogDrainFit.fitted || physDrainFit.fitted}
									{@render applyFitButton(
										fitApplied ? m.energy_fit_applied() : m.energy_apply_fit(),
										fitApplied,
										m.energy_apply_fit_title(),
										applyDrainFit
									)}
								{/if}

								<div class="mt-text-sm border-t pt-box-sm">
									<LogList
										label={m.energy_drain_log_count({ count: drainObservations.length })}
										items={drainObservations}
										confirmLabel={m.energy_reset_drain_confirm({ count: drainObservations.length })}
										resetLabel={m.energy_reset_drain_logs()}
										resetTitle={m.energy_reset_drain_title()}
										onreset={() => session.resetDrainLogs()}
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
													onclick={() => session.deleteDrainLog(log.id!)}
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
													bodyAfter: null
												})}
								>
									{restDraft ? m.common_cancel() : `☕ ${m.energy_log_rest()}`}
								</button>
							</div>

							{#if restDraft}
								<form
									class="mt-text-sm flex flex-wrap items-center gap-x-grid-xs gap-y-grid-2xs rounded-lg border border-info/20 bg-surface-page/40 px-2.5 py-2 text-2xs text-ty-silent"
									onsubmit={(e) => (e.preventDefault(), saveRestLog())}
								>
									<label class="flex items-center gap-grid-2xs">
										{m.energy_rest_rested_label()}
										<!-- svelte-ignore a11y_autofocus -->
										<input
											type="number"
											min="1"
											max="480"
											placeholder={m.task_minutes_placeholder()}
											autofocus
											bind:value={restDraft.minutes}
											class="w-14 rounded border border-info/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-info/60"
										/>
									</label>
									<span class="flex items-center gap-grid-2xs">
										{m.energy_rest_before_label()}
										<label class="flex items-center gap-grid-2xs" title={m.energy_rest_mind_title()}>
											<span class="font-medium text-mind/80">
												{m.energy_drain_mind_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.mindBefore}
												class="w-12 rounded border border-mind/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-mind/60"
											/>
										</label>
										<label class="flex items-center gap-grid-2xs" title={m.energy_rest_body_title()}>
											<span class="font-medium text-body/80">
												{m.energy_drain_body_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.bodyBefore}
												class="w-12 rounded border border-body/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-body/60"
											/>
										</label>
									</span>
									<span class="flex items-center gap-grid-2xs">
										{m.energy_rest_after_label()}
										<label class="flex items-center gap-grid-2xs" title={m.energy_rest_mind_title()}>
											<span class="font-medium text-mind/80">
												{m.energy_drain_mind_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.mindAfter}
												class="w-12 rounded border border-mind/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-mind/60"
											/>
										</label>
										<label class="flex items-center gap-grid-2xs" title={m.energy_rest_body_title()}>
											<span class="font-medium text-body/80">
												{m.energy_drain_body_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.bodyAfter}
												class="w-12 rounded border border-body/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-body/60"
											/>
										</label>
									</span>
									<span class="ml-auto flex items-center gap-grid-2xs">
										<button type="submit" class="px-1 text-info hover:text-info-strong">✓</button>
										<button
											type="button"
											class="px-1 text-ty-silent hover:text-ty-secondary"
											onclick={() => (restDraft = null)}
										>
											✕
										</button>
									</span>
								</form>
							{/if}

							{#if restObservations.length === 0}
								<p class="mt-text-sm text-xs text-ty-silent">{m.energy_recovery_calibration_empty()}</p>
							{:else}
								<div class="mt-text-sm flex items-baseline justify-between gap-text-xs text-xs">
									<span class="text-ty-silent">{m.energy_recovery_rate()}</span>
									{#if recoveryFit.fitted}
										<span class="tabular-nums text-info-strong/90">
											{m.energy_recovery_fit_value({
												rate: recoveryFit.rate.toFixed(2),
												std: (recoveryFit.rateStd ?? 0).toFixed(2),
												count: recoveryFit.usedCount
											})}
										</span>
									{:else}
										<span class="text-ty-silent">{m.energy_fit_no_signal()}</span>
									{/if}
								</div>

								{#if recoveryFit.fitted}
									{@render applyFitButton(
										recoveryFitApplied
											? m.energy_recovery_fit_applied()
											: m.energy_apply_recovery_fit(),
										recoveryFitApplied,
										m.energy_apply_recovery_fit_title(),
										applyRecoveryFit
									)}
								{/if}

								<div class="mt-text-sm border-t pt-box-sm">
									<LogList
										label={m.energy_rest_log_count({ count: restObservations.length })}
										items={restObservations}
										confirmLabel={m.energy_reset_rest_confirm({ count: restObservations.length })}
										resetLabel={m.energy_reset_rest_logs()}
										resetTitle={m.energy_reset_rest_title()}
										onreset={() => session.resetRestLogs()}
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
													onclick={() => session.deleteRestLog(log.id!)}
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

							{#if stopObservations.length === 0}
								<p class="mt-text-sm text-xs text-ty-silent">{m.energy_stop_calibration_empty()}</p>
							{:else if !stopFit.fitted}
								<p class="mt-text-sm text-xs text-ty-silent">{m.energy_stop_calibration_censored()}</p>
							{:else}
								<div class="mt-text-sm flex items-baseline justify-between gap-text-xs text-xs">
									<span class="text-ty-silent">{m.energy_free_time_value()}</span>
									<span class="tabular-nums text-info-strong/90">
										{m.energy_stop_fit_value({
											value: stopFit.value.toFixed(2),
											std: (stopFit.valueStd ?? 0).toFixed(2),
											count: stopFit.usedCount
										})}
									</span>
								</div>

								{@render applyFitButton(
									stopFitApplied ? m.energy_stop_fit_applied() : m.energy_apply_stop_fit(),
									stopFitApplied,
									m.energy_apply_stop_fit_title(),
									applyStopFit
								)}
							{/if}
						</div>
					</Tooltip.Provider>
				</div>
			</div>
		</div>
	{/if}
{/if}
