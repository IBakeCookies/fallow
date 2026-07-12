<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import {
		DEFAULT_ENERGY_PARAMS,
		optimizeSchedule,
		evaluateSchedule,
		sampleTrajectory,
		type EnergyParams,
		type EnergyTaskInput,
		type ScheduleBlock
	} from '$lib/business/model/zenith-energy';
	import {
		type Task,
		getEffectiveDifficulty,
		calculateSuggestedTasks,
		calculateInterleavedOrder
	} from '$lib/business/model/metric/calculation';
	import { getSessionStore } from '$lib/business/store/session-store.svelte';

	const PARAMS_KEY = 'zenith-energy-params';

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

	onMount(() => {
		try {
			const saved = localStorage.getItem(PARAMS_KEY);
			if (saved) params = { ...DEFAULT_ENERGY_PARAMS, ...JSON.parse(saved) };
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
		const suggested = calculateSuggestedTasks(tasks, windowHours, switchCost, pools, userConstants);
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

<svelte:head>
	<title>{m.energy_title_head()}</title>
	<meta name="description" content={m.energy_meta_description()} />
</svelte:head>

{#if !session.isLoading && paramsLoaded}
	<div class="mb-6">
		<div class="flex items-center gap-4">
			<h1 class="text-2xl font-bold text-zinc-100">{m.energy_heading()}</h1>
			<span
				class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300"
			>
				{m.energy_experimental()}
			</span>
		</div>
		<p class="mt-1 max-w-3xl text-sm text-zinc-500">
			{m.energy_intro_1()}
			<span class="text-zinc-400">{m.energy_intro_highlight_1()}</span>
			{m.energy_intro_2()}
			<span class="text-zinc-400">{m.energy_intro_highlight_2()}</span>
			{m.energy_intro_3()}
		</p>
	</div>

	{#if activeTasks.length === 0}
		<div class="space-y-6">
			<div class="rounded-2xl border border-white/10 bg-white/3 p-8 text-center">
				<p class="text-zinc-400">{m.energy_no_open_tasks()}</p>
				<p class="mt-1 text-sm text-zinc-600">
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
				<div class="mb-3 flex items-baseline justify-between">
					<h3 class="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
						{m.energy_optimized_day()}
					</h3>
					<span class="text-xs text-zinc-500">
						{m.energy_work_free_summary({
							work: formatDuration(plan.evaluation.workHours),
							free: formatDuration(plan.evaluation.leisureHours)
						})}
					</span>
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
									<span class="truncate px-1.5 text-xs text-zinc-600">{m.energy_free()}</span>
								{/if}
							</div>
						{/if}
					</div>
					<div class="mt-1 flex justify-between text-[10px] text-zinc-600">
						<span>0:00</span>
						<span>{formatClock(windowHours)}</span>
					</div>
				{:else}
					<p class="text-sm text-zinc-500">{m.energy_set_window()}</p>
				{/if}

				<!-- Energy & output chart -->
				{#if windowHours > 0}
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
							<text
								x={xAt(h)}
								y={CHART_H - 6}
								fill="#71717a"
								font-size="9"
								text-anchor="middle"
							>
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
							<span class="text-xs text-zinc-600">{m.energy_shared_note()}</span>
						</div>
						<p class="mb-3 text-xs text-zinc-600">
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
										<button
											type="button"
											aria-label={m.task_remove_aria()}
											title={m.task_remove_tooltip()}
											class="shrink-0 text-zinc-600 opacity-0 transition hover:text-red-400 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
									{/if}
								</li>
							{/each}
						</ul>
						<div class="mt-3">
							<TaskForm onsubmit={(t) => session.addTask(t)} startOpen={false} />
						</div>
					</div>

					<!-- Schedule detail -->
					<div
						class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
					>
						<h3 class="mb-4 text-xs font-semibold tracking-wider text-zinc-300 uppercase">
							{m.energy_schedule()}
						</h3>
						{#if plan.evaluation.blocks.length === 0}
							<p class="text-sm text-zinc-500">
								{m.energy_nothing_scheduled()}
							</p>
						{:else}
							<ul class="space-y-2">
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
											<span
												class="w-20 shrink-0 text-right text-xs tabular-nums text-indigo-300/80"
											>
												{m.energy_output_suffix({ output: block.output.toFixed(2) })}
											</span>
										{:else}
											<span class="w-20 shrink-0 text-right text-xs text-zinc-600">
												{m.energy_recovery()}
											</span>
										{/if}
									</li>
								{/each}
								{#if trailingFreeHours > 1e-6}
									<li class="flex items-center gap-3 text-sm">
										<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-700"></span>
										<span class="w-24 shrink-0 tabular-nums text-zinc-600">
											{formatClock(plannedHours)}–{formatClock(windowHours)}
										</span>
										<span class="flex-1 text-zinc-600 italic">{m.energy_free_time()}</span>
										<span class="shrink-0 text-xs text-zinc-600">
											{formatDuration(trailingFreeHours)}
										</span>
										<span class="w-20"></span>
									</li>
								{/if}
							</ul>
						{/if}

						<!-- Summary -->
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
									<p class="text-xs text-zinc-600">{m.energy_no_classic()}</p>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Parameters -->
				<div
					class="rounded-2xl border border-white/10 bg-white/3 p-4 sm:p-6 shadow-2xl backdrop-blur-xl"
				>
					<div class="mb-4 flex items-baseline justify-between">
						<h3 class="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
							{m.energy_model_parameters()}
						</h3>
						<button
							type="button"
							class="text-xs text-zinc-600 transition hover:text-zinc-300"
							title={m.energy_reset_defaults_title()}
							onclick={() => (params = { ...DEFAULT_ENERGY_PARAMS })}
						>
							{m.energy_reset_defaults()}
						</button>
					</div>
					<div class="space-y-4">
						<div>
							<label for="window-hours" class="mb-1 block text-xs text-zinc-500">
								{m.energy_day_window()}
							</label>
							<NumberInput
								id="window-hours"
								value={windowHours}
								onchange={(v) => (windowOverride = v)}
								min={0}
								max={24}
								step={0.5}
								unit={m.unit_hours()}
							/>
							<p class="mt-1 text-xs text-zinc-600">
								{m.energy_day_window_hint()}
							</p>
						</div>
						<div>
							<label for="alpha-cog" class="mb-1 block text-xs text-zinc-500">
								{m.energy_cognitive_drain()}
							</label>
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
							<p class="mt-1 text-xs text-zinc-600">
								{m.energy_cognitive_drain_hint()}
							</p>
						</div>
						<div>
							<label for="alpha-phys" class="mb-1 block text-xs text-zinc-500">
								{m.energy_physical_drain()}
							</label>
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
							<p class="mt-1 text-xs text-zinc-600">{m.energy_physical_drain_hint()}</p>
						</div>
						<div>
							<label for="recovery-rate" class="mb-1 block text-xs text-zinc-500">
								{m.energy_recovery_rate()}
							</label>
							<NumberInput
								id="recovery-rate"
								value={params.recoveryRate}
								onchange={(v) => (params.recoveryRate = v)}
								min={0.1}
								max={3}
								step={0.1}
								unit="/h"
							/>
							<p class="mt-1 text-xs text-zinc-600">{m.energy_recovery_rate_hint()}</p>
						</div>
						<div>
							<label for="free-time-value" class="mb-1 block text-xs text-zinc-500">
								{m.energy_free_time_value()}
							</label>
							<NumberInput
								id="free-time-value"
								value={params.freeTimeValue}
								onchange={(v) => (params.freeTimeValue = v)}
								min={0}
								max={3}
								step={0.1}
								unit="/h"
							/>
							<p class="mt-1 text-xs text-zinc-600">
								{m.energy_free_time_value_hint()}
							</p>
						</div>
						<div>
							<label for="terminal-value" class="mb-1 block text-xs text-zinc-500">
								{m.energy_evening_energy()}
							</label>
							<NumberInput
								id="terminal-value"
								value={params.terminalEnergyValue}
								onchange={(v) => (params.terminalEnergyValue = v)}
								min={0}
								max={5}
								step={0.25}
								unit="out"
							/>
							<p class="mt-1 text-xs text-zinc-600">
								{m.energy_evening_energy_hint()}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}
