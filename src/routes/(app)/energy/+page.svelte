<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import SeoHead from '$lib/presentation/component/seo-head.svelte';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
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

	onMount(() => {
		try {
			const saved = localStorage.getItem(PARAMS_KEY);
			if (saved) params = { ...DEFAULT_ENERGY_PARAMS, ...JSON.parse(saved) };
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

	const energyTasks = $derived<EnergyTaskInput[]>(
		activeTasks.map((t) => ({
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
		const funded = calculateInterleavedOrder(
			suggested.filter((t) => !t.completed && t.suggestedHours > 0)
		);
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
			accent: 'accent-emerald-400',
			color: 'text-emerald-400/80'
		},
		{
			key: 'mentalDifficulty',
			label: 'M',
			title: m.energy_slider_mental(),
			min: 0,
			accent: 'accent-blue-400',
			color: 'text-blue-400/80'
		},
		{
			key: 'enjoyment',
			label: 'E',
			title: m.energy_slider_enjoyment(),
			min: 1,
			accent: 'accent-indigo-400',
			color: 'text-indigo-400/80'
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

	// Ratings manager (list + two-step reset), same pattern as the flow-log list
	let drainLogsOpen = $state(false);
	let confirmingDrainReset = $state(false);
	const drainLogsNewestFirst = $derived([...drainObservations].reverse());

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

	let restLogsOpen = $state(false);
	let confirmingRestReset = $state(false);
	const restLogsNewestFirst = $derived([...restObservations].reverse());

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

	// ---------- Chart geometry ----------

	const CHART_W = 720;
	const CHART_H = 190;
	const PAD_L = 10;
	const PAD_R = 10;
	const PAD_T = 12;
	const PAD_B = 22;
	const plotW = CHART_W - PAD_L - PAD_R;
	const plotH = CHART_H - PAD_T - PAD_B;

	const xAt = (t: number) => PAD_L + (windowHours > 0 ? (t / windowHours) * plotW : 0);
	const yAt = (v: number) => PAD_T + (1 - v) * plotH;

	function linePath(points: { x: number; y: number }[]): string {
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
			.join('');
	}

	const cogPath = $derived(linePath(trajectory.map((p) => ({ x: xAt(p.t), y: yAt(p.cog) }))));
	const physPath = $derived(linePath(trajectory.map((p) => ({ x: xAt(p.t), y: yAt(p.phys) }))));
	const maxRate = $derived(Math.max(...trajectory.map((p) => p.rate), 1e-9));
	const ratePath = $derived.by(() => {
		if (trajectory.length === 0) return '';
		const line = linePath(trajectory.map((p) => ({ x: xAt(p.t), y: yAt(p.rate / maxRate) })));
		const last = trajectory[trajectory.length - 1];
		return `${line}L${xAt(last.t).toFixed(1)},${yAt(0).toFixed(1)}L${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}Z`;
	});
	const hourTicks = $derived.by(() => {
		const stepH = windowHours > 14 ? 2 : 1;
		const ticks = [];
		for (let h = 0; h <= windowHours; h += stepH) ticks.push(h);
		return ticks;
	});
</script>

<SeoHead title={m.energy_title_head()} description={m.energy_meta_description()} />

{#if !session.isLoading && paramsLoaded}
	<div class="mb-6">
		<div class="flex items-center gap-4">
			<!-- The intro paragraph lives in the title's tooltip now — the header
			     stays one line so the plan is what fills the fold. -->
			<Tooltip.Provider delayDuration={150}>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<h1
								{...props}
								class="cursor-help text-2xl font-bold text-zinc-100 underline decoration-zinc-700 decoration-dotted underline-offset-4"
							>
								{m.energy_heading()}
							</h1>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						side="bottom"
						align="start"
						class="max-w-md bg-zinc-900 border-zinc-700 text-zinc-200"
					>
						<p>
							{m.energy_intro_1()}
							<span class="font-medium text-zinc-50">{m.energy_intro_highlight_1()}</span>
							{m.energy_intro_2()}
							<span class="font-medium text-zinc-50">{m.energy_intro_highlight_2()}</span>
							{m.energy_intro_3()}
						</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
			<span
				class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300"
			>
				{m.energy_experimental()}
			</span>
		</div>
	</div>

	{#if activeTasks.length === 0}
		<div class="space-y-6">
			<div class="rounded-2xl border border-white/10 bg-white/3 p-8 text-center">
				<p class="text-zinc-400">{m.energy_no_open_tasks()}</p>
				<p class="mt-1 text-sm text-zinc-500">
					{m.energy_no_open_tasks_hint()}
				</p>
			</div>
			<TaskForm onsubmit={(t) => session.addTask(t)} />
		</div>
	{:else}
		<div class="space-y-6">
			<!-- Timeline -->
			<div
				class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
			>
				<div class="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
					<h3 class="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
						{m.energy_optimized_day()}
					</h3>
					<div class="flex items-center gap-3">
						<span class="text-xs text-zinc-500">
							{m.energy_work_free_summary({
								work: formatDuration(plan.evaluation.workHours),
								free: formatDuration(plan.evaluation.leisureHours)
							})}
						</span>
						<div class="flex rounded-lg border border-white/10 bg-zinc-900/40 p-0.5 text-xs">
							<button
								type="button"
								aria-pressed={planView === 'chart'}
								class="rounded-md px-2.5 py-1 transition {planView === 'chart'
									? 'bg-white/10 text-zinc-100'
									: 'text-zinc-500 hover:text-zinc-300'}"
								onclick={() => setPlanView('chart')}
							>
								{m.energy_view_chart()}
							</button>
							<button
								type="button"
								aria-pressed={planView === 'schedule'}
								class="rounded-md px-2.5 py-1 transition {planView === 'schedule'
									? 'bg-white/10 text-zinc-100'
									: 'text-zinc-500 hover:text-zinc-300'}"
								onclick={() => setPlanView('schedule')}
							>
								{m.energy_schedule()}
							</button>
						</div>
					</div>
				</div>
				{#if windowHours > 0}
					<div class="flex h-12 w-full overflow-hidden rounded-lg border border-white/10">
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
									<span class="truncate px-1.5 text-xs font-medium text-zinc-100">
										{block.title}
									</span>
								{/if}
							</div>
						{/each}
						{#if trailingFreeHours > 1e-6}
							<div
								class="flex min-w-0 items-center justify-center bg-transparent"
								style="width: {(trailingFreeHours / windowHours) * 100}%"
								title={m.energy_free_time_tooltip({ duration: formatDuration(trailingFreeHours) })}
							>
								{#if trailingFreeHours / windowHours > 0.07}
									<span class="truncate px-1.5 text-xs text-zinc-500">{m.energy_free()}</span>
								{/if}
							</div>
						{/if}
					</div>
					<div class="mt-1 flex justify-between text-[10px] text-zinc-500">
						<span>0:00</span>
						<span>{formatClock(windowHours)}</span>
					</div>
				{:else}
					<p class="text-sm text-zinc-500">{m.energy_set_window()}</p>
				{/if}

				<!-- Toggled region: energy chart ↔ schedule detail. The timeline bar
				     above and the summary stats below stay put in both views. -->
				{#if windowHours > 0}
					{#if planView === 'chart'}
						<svg
							viewBox="0 0 {CHART_W} {CHART_H}"
							class="mt-4 w-full"
							role="img"
							aria-label={m.energy_chart_aria()}
						>
							<path d={ratePath} fill="#818cf8" opacity="0.18" />
							{#each hourTicks as h (h)}
								<line
									x1={xAt(h)}
									y1={PAD_T}
									x2={xAt(h)}
									y2={PAD_T + plotH}
									stroke="#ffffff"
									opacity="0.05"
								/>
								<text x={xAt(h)} y={CHART_H - 6} fill="#71717a" font-size="9" text-anchor="middle">
									{h}h
								</text>
							{/each}
							<line
								x1={PAD_L}
								y1={yAt(0)}
								x2={PAD_L + plotW}
								y2={yAt(0)}
								stroke="#ffffff"
								opacity="0.15"
							/>
							<path d={cogPath} fill="none" stroke="#60a5fa" stroke-width="1.8" />
							<path d={physPath} fill="none" stroke="#34d399" stroke-width="1.8" />
						</svg>
						<div class="mt-1 flex gap-4 text-xs text-zinc-500">
							<span class="flex items-center gap-1.5">
								<span class="h-0.5 w-4 rounded bg-blue-400"></span>
								{m.energy_legend_cognitive()}
							</span>
							<span class="flex items-center gap-1.5">
								<span class="h-0.5 w-4 rounded bg-emerald-400"></span>
								{m.energy_legend_physical()}
							</span>
							<span class="flex items-center gap-1.5">
								<span class="h-2 w-4 rounded bg-indigo-400/30"></span>
								{m.energy_legend_output()}
							</span>
						</div>
					{:else if plan.evaluation.blocks.length === 0}
						<p class="mt-4 text-sm text-zinc-500">
							{m.energy_nothing_scheduled()}
						</p>
					{:else}
						<ul class="mt-4 space-y-2">
							{#each plan.evaluation.blocks as block (block.start)}
								<li class="flex items-center gap-3 text-sm">
									<span
										class="h-2.5 w-2.5 shrink-0 rounded-full"
										style="background-color: {colorOf(block.taskId)}"
									></span>
									<span class="w-24 shrink-0 tabular-nums text-zinc-500">
										{formatClock(block.start)}–{formatClock(block.start + block.hours)}
									</span>
									<span
										class="min-w-0 flex-1 truncate {block.taskId === null
											? 'text-zinc-500 italic'
											: 'text-zinc-200'}"
									>
										{block.title}
									</span>
									<span class="shrink-0 text-xs text-zinc-500">
										{formatDuration(block.hours)}
									</span>
									{#if block.taskId !== null}
										<span class="w-20 shrink-0 text-right text-xs tabular-nums text-indigo-300/80">
											{m.energy_output_suffix({ output: block.output.toFixed(2) })}
										</span>
									{:else}
										<span class="w-20 shrink-0 text-right text-xs text-zinc-500">
											{m.energy_recovery()}
										</span>
									{/if}
								</li>
							{/each}
							{#if trailingFreeHours > 1e-6}
								<li class="flex items-center gap-3 text-sm">
									<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-700"></span>
									<span class="w-24 shrink-0 tabular-nums text-zinc-500">
										{formatClock(plannedHours)}–{formatClock(windowHours)}
									</span>
									<span class="flex-1 text-zinc-500 italic">{m.energy_free_time()}</span>
									<span class="shrink-0 text-xs text-zinc-500">
										{formatDuration(trailingFreeHours)}
									</span>
									<span class="w-20"></span>
								</li>
							{/if}
						</ul>
					{/if}

					<!-- Summary: the objective readout, visible in both views -->
					<div class="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 sm:grid-cols-4">
						<div>
							<p class="text-lg font-semibold text-zinc-100">
								{plan.evaluation.totalOutput.toFixed(1)}
							</p>
							<p class="text-xs text-zinc-500">{m.energy_total_output()}</p>
						</div>
						<div>
							<p class="text-lg font-semibold text-zinc-100">
								{Math.round(plan.evaluation.endCog * 100)}% /
								{Math.round(plan.evaluation.endPhys * 100)}%
							</p>
							<p class="text-xs text-zinc-500">{m.energy_end_energy()}</p>
						</div>
						<div>
							<p class="text-lg font-semibold text-zinc-100">
								{formatDuration(plan.evaluation.workHours)}
							</p>
							<p class="text-xs text-zinc-500">{m.energy_planned_work()}</p>
						</div>
						<div>
							{#if outputVsClassic !== null}
								<p
									class="text-lg font-semibold {outputVsClassic >= 0
										? 'text-emerald-400'
										: 'text-amber-400'}"
								>
									{outputVsClassic >= 0 ? '+' : ''}{outputVsClassic}%
								</p>
								<p class="text-xs text-zinc-500">
									{m.energy_vs_classic()}
								</p>
							{:else}
								<p class="text-lg font-semibold text-zinc-500">—</p>
								<p class="text-xs text-zinc-500">{m.energy_no_classic()}</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<div class="grid gap-6 lg:grid-cols-3 items-start">
				<div class="space-y-6 lg:col-span-2">
					<!-- Tasks: shared with the main page, edited live -->
					<div
						class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
					>
						<div class="mb-1 flex items-baseline justify-between gap-3">
							<h3 class="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
								{m.energy_tasks()}
							</h3>
							<span class="text-xs text-zinc-500">{m.energy_shared_note()}</span>
						</div>
						<p class="mb-3 text-xs text-zinc-500">
							{m.energy_drag_hint()}
						</p>
						<ul class="space-y-1">
							{#each tasks as task (task.id)}
								<li
									class="group rounded-lg p-2 transition hover:bg-white/3"
									class:opacity-50={task.completed}
								>
									<div class="flex items-center gap-3">
										<input
											type="checkbox"
											checked={task.completed}
											onchange={() => session.toggleTask(task.id)}
											class="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-indigo-500/20"
										/>
										<span
											class="h-2.5 w-2.5 shrink-0 rounded-full"
											style="background-color: {colorOf(task.id)}"
										></span>
										<span
											class="min-w-0 flex-1 truncate text-sm font-medium capitalize {task.completed
												? 'text-zinc-500 line-through'
												: 'text-zinc-100'}"
										>
											{task.title}
										</span>
										{#if !task.completed}
											<button
												type="button"
												aria-label={m.energy_log_drain_aria()}
												title={m.energy_log_drain_tooltip()}
												class="shrink-0 transition {todaysDrainLog(task.id)
													? 'text-amber-400'
													: 'text-zinc-500 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 hover:text-amber-400'}"
												onclick={() =>
													drainDraft?.taskId === task.id
														? (drainDraft = null)
														: openDrainLog(task.id)}
											>
												🪫
											</button>
										{/if}
										<button
											type="button"
											aria-label={m.task_remove_aria()}
											title={m.task_remove_tooltip()}
											class="shrink-0 text-zinc-500 opacity-0 transition hover:text-red-400 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
											onclick={() => session.removeTask(task.id)}
										>
											✕
										</button>
									</div>
									{#if !task.completed}
										<div class="mt-2 ml-7 grid gap-x-5 gap-y-1.5 sm:grid-cols-3">
											{#each sliders as s (s.key)}
												<label
													class="flex items-center gap-2 text-[11px] text-zinc-500"
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
														class="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 {s.accent}"
													/>
													<span class="w-4 text-right tabular-nums text-zinc-300">
														{task[s.key]}
													</span>
												</label>
											{/each}
										</div>
										{#if drainDraft?.taskId === task.id}
											<form
												class="mt-2 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-amber-500/20 bg-zinc-900/40 px-2.5 py-2 text-[11px] text-zinc-500"
												onsubmit={(e) => (e.preventDefault(), saveDrainLog())}
											>
												<span class="text-zinc-400">{m.energy_drain_form_title()}</span>
												<label class="flex items-center gap-1.5">
													{m.energy_drain_worked_label()}
													<!-- svelte-ignore a11y_autofocus -->
													<input
														type="number"
														min="1"
														max="960"
														placeholder={m.task_minutes_placeholder()}
														autofocus
														bind:value={drainDraft.minutes}
														class="w-14 rounded border border-amber-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-amber-500/60"
													/>
												</label>
												<label
													class="flex items-center gap-1.5"
													title={m.energy_drain_mind_title()}
												>
													<span class="font-medium text-blue-400/80">
														{m.energy_drain_mind_label()}
													</span>
													<input
														type="number"
														min="0"
														max="10"
														step="1"
														bind:value={drainDraft.mind}
														class="w-12 rounded border border-blue-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-blue-500/60"
													/>
												</label>
												<label
													class="flex items-center gap-1.5"
													title={m.energy_drain_body_title()}
												>
													<span class="font-medium text-emerald-400/80">
														{m.energy_drain_body_label()}
													</span>
													<input
														type="number"
														min="0"
														max="10"
														step="1"
														bind:value={drainDraft.body}
														class="w-12 rounded border border-emerald-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-emerald-500/60"
													/>
												</label>
												<span class="ml-auto flex items-center gap-1">
													<button type="submit" class="px-1 text-amber-400 hover:text-amber-300">
														✓
													</button>
													<button
														type="button"
														class="px-1 text-zinc-500 hover:text-zinc-300"
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
						<div class="mt-3">
							<TaskForm onsubmit={(t) => session.addTask(t)} startOpen={false} />
						</div>
					</div>
				</div>

				<!-- Parameters + calibration -->
				<div class="space-y-6">
					<Tooltip.Provider delayDuration={150}>
						<div
							class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
						>
							<div class="mb-4 flex items-baseline justify-between">
								<h3 class="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
									{m.energy_model_parameters()}
								</h3>
								<button
									type="button"
									class="text-xs text-zinc-500 transition hover:text-zinc-300"
									title={m.energy_reset_defaults_title()}
									onclick={() => (params = { ...DEFAULT_ENERGY_PARAMS })}
								>
									{m.energy_reset_defaults()}
								</button>
							</div>
							<div class="space-y-4">
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="window-hours"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_day_window()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_day_window_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="window-hours"
										value={windowHours}
										onchange={(v) => (windowOverride = v)}
										min={0}
										max={24}
										step={0.5}
										unit={m.unit_hours()}
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="alpha-cog"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_cognitive_drain()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_cognitive_drain_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="alpha-cog"
										value={params.alphaCog}
										onchange={(v) => (params.alphaCog = v)}
										min={0.05}
										max={2}
										step={0.05}
										unit="/h"
										accent="focus-within:border-blue-500/50"
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="alpha-phys"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_physical_drain()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_physical_drain_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="alpha-phys"
										value={params.alphaPhys}
										onchange={(v) => (params.alphaPhys = v)}
										min={0.05}
										max={2}
										step={0.05}
										unit="/h"
										accent="focus-within:border-emerald-500/50"
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="recovery-rate"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_recovery_rate()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_recovery_rate_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="recovery-rate"
										value={params.recoveryRate}
										onchange={(v) => (params.recoveryRate = v)}
										min={0.1}
										max={3}
										step={0.1}
										unit="/h"
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="free-time-value"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_free_time_value()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_free_time_value_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="free-time-value"
										value={params.freeTimeValue}
										onchange={(v) => (params.freeTimeValue = v)}
										min={0}
										max={3}
										step={0.1}
										unit="out/h"
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="terminal-value"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_evening_energy()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_evening_energy_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="terminal-value"
										value={params.terminalEnergyValue}
										onchange={(v) => (params.terminalEnergyValue = v)}
										min={0}
										max={5}
										step={0.25}
										unit="out"
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="satiety-scale"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_satiety()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_satiety_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="satiety-scale"
										value={params.satietyScale}
										onchange={(v) => (params.satietyScale = v)}
										min={0}
										max={5}
										step={0.25}
										unit="×"
									/>
								</div>
								<div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<label
													{...props}
													for="micro-recovery"
													class="mb-1 block w-fit cursor-help text-xs text-zinc-400 underline decoration-dotted underline-offset-2"
												>
													{m.energy_micro_recovery()}
												</label>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="left"
											class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
										>
											<p>{m.energy_micro_recovery_hint()}</p>
										</Tooltip.Content>
									</Tooltip.Root>
									<NumberInput
										id="micro-recovery"
										value={Number((params.microRecoveryFraction * 100).toFixed(1))}
										onchange={(v) => (params.microRecoveryFraction = v / 100)}
										min={0}
										max={30}
										step={1}
										unit="%"
									/>
								</div>
							</div>
						</div>

						<!-- Drain calibration: fitted α from end-of-session ratings -->
						<div
							class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
						>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<h3
											{...props}
											class="w-fit cursor-help text-xs font-semibold tracking-wider text-zinc-300 uppercase underline decoration-zinc-700 decoration-dotted underline-offset-4"
										>
											{m.energy_calibration()}
										</h3>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content
									side="left"
									class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
								>
									<p>{m.energy_calibration_hint()}</p>
								</Tooltip.Content>
							</Tooltip.Root>

							{#if drainObservations.length === 0}
								<p class="mt-3 text-xs text-zinc-500">{m.energy_calibration_empty()}</p>
							{:else}
								<div class="mt-3 space-y-2">
									<div class="flex items-baseline justify-between gap-2 text-xs">
										<span class="text-zinc-500">{m.energy_cognitive_drain()}</span>
										{#if cogDrainFit.fitted}
											<span class="tabular-nums text-blue-300/90">
												{m.energy_fit_value({
													alpha: cogDrainFit.alpha.toFixed(2),
													std: (cogDrainFit.alphaStd ?? 0).toFixed(2),
													count: cogDrainFit.usedCount
												})}
											</span>
										{:else}
											<span class="text-zinc-500">{m.energy_fit_no_signal()}</span>
										{/if}
									</div>
									<div class="flex items-baseline justify-between gap-2 text-xs">
										<span class="text-zinc-500">{m.energy_physical_drain()}</span>
										{#if physDrainFit.fitted}
											<span class="tabular-nums text-emerald-300/90">
												{m.energy_fit_value({
													alpha: physDrainFit.alpha.toFixed(2),
													std: (physDrainFit.alphaStd ?? 0).toFixed(2),
													count: physDrainFit.usedCount
												})}
											</span>
										{:else}
											<span class="text-zinc-500">{m.energy_fit_no_signal()}</span>
										{/if}
									</div>
								</div>

								{#if cogDrainFit.fitted || physDrainFit.fitted}
									<button
										type="button"
										class="mt-3 w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-default disabled:border-white/10 disabled:bg-transparent disabled:text-zinc-500"
										disabled={fitApplied}
										title={m.energy_apply_fit_title()}
										onclick={applyDrainFit}
									>
										{fitApplied ? m.energy_fit_applied() : m.energy_apply_fit()}
									</button>
								{/if}

								<div class="mt-3 border-t border-white/10 pt-3">
									<button
										type="button"
										class="flex w-full items-center justify-between gap-2 text-left text-xs text-zinc-500 transition hover:text-zinc-300"
										onclick={() => {
											drainLogsOpen = !drainLogsOpen;
											confirmingDrainReset = false;
										}}
									>
										<span>{m.energy_drain_log_count({ count: drainObservations.length })}</span>
										<span class="shrink-0 text-zinc-500">{drainLogsOpen ? '▴' : '▾'}</span>
									</button>

									{#if drainLogsOpen}
										<ul class="mt-2 space-y-1">
											{#each drainLogsNewestFirst as log (log.id)}
												<li
													class="flex items-center justify-between gap-2 rounded bg-white/3 px-2 py-1 text-xs text-zinc-400"
												>
													<span class="truncate">
														<span class="text-zinc-500">{log.date}</span>
														<span class="capitalize"> · {log.taskTitle}</span>
													</span>
													<span class="flex shrink-0 items-center gap-2 tabular-nums">
														<span class="text-zinc-500">{formatDuration(log.hours)}</span>
														<span class="font-medium text-blue-400/90">M{log.mindDrain}</span>
														<span class="font-medium text-emerald-400/90">B{log.bodyDrain}</span>
														<button
															type="button"
															aria-label={m.energy_delete_drain_log_aria()}
															title={m.energy_delete_drain_log_title()}
															class="text-zinc-500 transition hover:text-red-400"
															onclick={() => session.deleteDrainLog(log.id!)}
														>
															✕
														</button>
													</span>
												</li>
											{/each}
										</ul>
										<div class="mt-2 flex justify-end">
											{#if confirmingDrainReset}
												<span class="flex items-center gap-2 text-xs">
													<span class="text-zinc-500">
														{m.energy_reset_drain_confirm({ count: drainObservations.length })}
													</span>
													<button
														type="button"
														class="font-medium text-red-400 hover:text-red-300"
														onclick={() => {
															session.resetDrainLogs();
															confirmingDrainReset = false;
															drainLogsOpen = false;
														}}
													>
														{m.common_reset()}
													</button>
													<button
														type="button"
														class="text-zinc-500 hover:text-zinc-300"
														onclick={() => (confirmingDrainReset = false)}
													>
														{m.common_cancel()}
													</button>
												</span>
											{:else}
												<button
													type="button"
													class="text-xs text-zinc-500 transition hover:text-red-400"
													title={m.energy_reset_drain_title()}
													onclick={() => (confirmingDrainReset = true)}
												>
													{m.energy_reset_drain_logs()}
												</button>
											{/if}
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Recovery calibration: fitted r from pre/post-rest rating pairs -->
						<div
							class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
						>
							<div class="flex items-baseline justify-between gap-2">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<h3
												{...props}
												class="w-fit cursor-help text-xs font-semibold tracking-wider text-zinc-300 uppercase underline decoration-zinc-700 decoration-dotted underline-offset-4"
											>
												{m.energy_recovery_calibration()}
											</h3>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content
										side="left"
										class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
									>
										<p>{m.energy_recovery_calibration_hint()}</p>
									</Tooltip.Content>
								</Tooltip.Root>
								<button
									type="button"
									class="shrink-0 text-xs transition {restDraft
										? 'text-zinc-500 hover:text-zinc-300'
										: 'text-sky-400/90 hover:text-sky-300'}"
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
									class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-sky-500/20 bg-zinc-900/40 px-2.5 py-2 text-[11px] text-zinc-500"
									onsubmit={(e) => (e.preventDefault(), saveRestLog())}
								>
									<label class="flex items-center gap-1.5">
										{m.energy_rest_rested_label()}
										<!-- svelte-ignore a11y_autofocus -->
										<input
											type="number"
											min="1"
											max="480"
											placeholder={m.task_minutes_placeholder()}
											autofocus
											bind:value={restDraft.minutes}
											class="w-14 rounded border border-sky-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-sky-500/60"
										/>
									</label>
									<span class="flex items-center gap-1.5">
										{m.energy_rest_before_label()}
										<label class="flex items-center gap-1" title={m.energy_rest_mind_title()}>
											<span class="font-medium text-blue-400/80">
												{m.energy_drain_mind_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.mindBefore}
												class="w-12 rounded border border-blue-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-blue-500/60"
											/>
										</label>
										<label class="flex items-center gap-1" title={m.energy_rest_body_title()}>
											<span class="font-medium text-emerald-400/80">
												{m.energy_drain_body_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.bodyBefore}
												class="w-12 rounded border border-emerald-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-emerald-500/60"
											/>
										</label>
									</span>
									<span class="flex items-center gap-1.5">
										{m.energy_rest_after_label()}
										<label class="flex items-center gap-1" title={m.energy_rest_mind_title()}>
											<span class="font-medium text-blue-400/80">
												{m.energy_drain_mind_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.mindAfter}
												class="w-12 rounded border border-blue-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-blue-500/60"
											/>
										</label>
										<label class="flex items-center gap-1" title={m.energy_rest_body_title()}>
											<span class="font-medium text-emerald-400/80">
												{m.energy_drain_body_label()}
											</span>
											<input
												type="number"
												min="0"
												max="10"
												step="1"
												bind:value={restDraft.bodyAfter}
												class="w-12 rounded border border-emerald-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-emerald-500/60"
											/>
										</label>
									</span>
									<span class="ml-auto flex items-center gap-1">
										<button type="submit" class="px-1 text-sky-400 hover:text-sky-300">✓</button>
										<button
											type="button"
											class="px-1 text-zinc-500 hover:text-zinc-300"
											onclick={() => (restDraft = null)}
										>
											✕
										</button>
									</span>
								</form>
							{/if}

							{#if restObservations.length === 0}
								<p class="mt-3 text-xs text-zinc-500">{m.energy_recovery_calibration_empty()}</p>
							{:else}
								<div class="mt-3 flex items-baseline justify-between gap-2 text-xs">
									<span class="text-zinc-500">{m.energy_recovery_rate()}</span>
									{#if recoveryFit.fitted}
										<span class="tabular-nums text-sky-300/90">
											{m.energy_recovery_fit_value({
												rate: recoveryFit.rate.toFixed(2),
												std: (recoveryFit.rateStd ?? 0).toFixed(2),
												count: recoveryFit.usedCount
											})}
										</span>
									{:else}
										<span class="text-zinc-500">{m.energy_fit_no_signal()}</span>
									{/if}
								</div>

								{#if recoveryFit.fitted}
									<button
										type="button"
										class="mt-3 w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-default disabled:border-white/10 disabled:bg-transparent disabled:text-zinc-500"
										disabled={recoveryFitApplied}
										title={m.energy_apply_recovery_fit_title()}
										onclick={applyRecoveryFit}
									>
										{recoveryFitApplied
											? m.energy_recovery_fit_applied()
											: m.energy_apply_recovery_fit()}
									</button>
								{/if}

								<div class="mt-3 border-t border-white/10 pt-3">
									<button
										type="button"
										class="flex w-full items-center justify-between gap-2 text-left text-xs text-zinc-500 transition hover:text-zinc-300"
										onclick={() => {
											restLogsOpen = !restLogsOpen;
											confirmingRestReset = false;
										}}
									>
										<span>{m.energy_rest_log_count({ count: restObservations.length })}</span>
										<span class="shrink-0 text-zinc-500">{restLogsOpen ? '▴' : '▾'}</span>
									</button>

									{#if restLogsOpen}
										<ul class="mt-2 space-y-1">
											{#each restLogsNewestFirst as log (log.id)}
												<li
													class="flex items-center justify-between gap-2 rounded bg-white/3 px-2 py-1 text-xs text-zinc-400"
												>
													<span class="truncate text-zinc-500">{log.date}</span>
													<span class="flex shrink-0 items-center gap-2 tabular-nums">
														<span class="text-zinc-500">{formatDuration(log.hours)}</span>
														<span class="font-medium text-blue-400/90">
															M{log.mindBefore}→{log.mindAfter}
														</span>
														<span class="font-medium text-emerald-400/90">
															B{log.bodyBefore}→{log.bodyAfter}
														</span>
														<button
															type="button"
															aria-label={m.energy_delete_rest_log_aria()}
															title={m.energy_delete_rest_log_title()}
															class="text-zinc-500 transition hover:text-red-400"
															onclick={() => session.deleteRestLog(log.id!)}
														>
															✕
														</button>
													</span>
												</li>
											{/each}
										</ul>
										<div class="mt-2 flex justify-end">
											{#if confirmingRestReset}
												<span class="flex items-center gap-2 text-xs">
													<span class="text-zinc-500">
														{m.energy_reset_rest_confirm({ count: restObservations.length })}
													</span>
													<button
														type="button"
														class="font-medium text-red-400 hover:text-red-300"
														onclick={() => {
															session.resetRestLogs();
															confirmingRestReset = false;
															restLogsOpen = false;
														}}
													>
														{m.common_reset()}
													</button>
													<button
														type="button"
														class="text-zinc-500 hover:text-zinc-300"
														onclick={() => (confirmingRestReset = false)}
													>
														{m.common_cancel()}
													</button>
												</span>
											{:else}
												<button
													type="button"
													class="text-xs text-zinc-500 transition hover:text-red-400"
													title={m.energy_reset_rest_title()}
													onclick={() => (confirmingRestReset = true)}
												>
													{m.energy_reset_rest_logs()}
												</button>
											{/if}
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Stopping calibration: fitted λ₀ from finished days' stop decisions -->
						<div
							class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
						>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<h3
											{...props}
											class="w-fit cursor-help text-xs font-semibold tracking-wider text-zinc-300 uppercase underline decoration-zinc-700 decoration-dotted underline-offset-4"
										>
											{m.energy_stop_calibration()}
										</h3>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content
									side="left"
									class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200"
								>
									<p>{m.energy_stop_calibration_hint()}</p>
								</Tooltip.Content>
							</Tooltip.Root>

							{#if stopObservations.length === 0}
								<p class="mt-3 text-xs text-zinc-500">{m.energy_stop_calibration_empty()}</p>
							{:else if !stopFit.fitted}
								<p class="mt-3 text-xs text-zinc-500">{m.energy_stop_calibration_censored()}</p>
							{:else}
								<div class="mt-3 flex items-baseline justify-between gap-2 text-xs">
									<span class="text-zinc-500">{m.energy_free_time_value()}</span>
									<span class="tabular-nums text-sky-300/90">
										{m.energy_stop_fit_value({
											value: stopFit.value.toFixed(2),
											std: (stopFit.valueStd ?? 0).toFixed(2),
											count: stopFit.usedCount
										})}
									</span>
								</div>

								<button
									type="button"
									class="mt-3 w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-default disabled:border-white/10 disabled:bg-transparent disabled:text-zinc-500"
									disabled={stopFitApplied}
									title={m.energy_apply_stop_fit_title()}
									onclick={applyStopFit}
								>
									{stopFitApplied ? m.energy_stop_fit_applied() : m.energy_apply_stop_fit()}
								</button>
							{/if}
						</div>
					</Tooltip.Provider>
				</div>
			</div>
		</div>
	{/if}
{/if}
