<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button, buttonVariants } from '$lib/presentation/component/ui/button';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { cn } from '$lib/presentation/utils';
	import { getTaskNature } from '$lib/business/model/metric/calculation';
	import { OPTIMAL_PHI_MULTIPLIER } from '$lib/business/model/zenith';

	interface Props {
		id: number;
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
		completed: boolean;
		priorityScore: number;
		suggestedHours: number;
		trueEffort: number;
		flowStateTime: number;
		runOrder?: number;
		flowMinutes?: number;
		ontoggle: (id: number) => void;
		onremove: (id: number) => void;
		onlogflow?: (id: number, minutes: number) => void;
		onupdate?: (
			id: number,
			changes: {
				title: string;
				physicalDifficulty: number;
				mentalDifficulty: number;
				enjoyment: number;
			}
		) => void;
	}

	let {
		id,
		title,
		physicalDifficulty,
		mentalDifficulty,
		enjoyment,
		completed,
		priorityScore,
		suggestedHours,
		trueEffort,
		flowStateTime,
		runOrder,
		flowMinutes,
		ontoggle,
		onremove,
		onlogflow,
		onupdate
	}: Props = $props();

	// Inline "log time-to-flow" editor (⚡): feeds the c₁,c₂,c₃ personalization
	let loggingFlow = $state(false);
	let flowMinutesInput = $state<number | null>(null);

	// Inline task editor (✎): re-tune the sliders after the task is added
	let editing = $state(false);
	let editDraft = $state({
		title: '',
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5
	});

	const editSliders = [
		{
			key: 'physicalDifficulty',
			label: m.form_physical_difficulty(),
			min: 0,
			accent: 'accent-emerald-400'
		},
		{ key: 'mentalDifficulty', label: m.form_mental_difficulty(), min: 0, accent: 'accent-blue-400' },
		{ key: 'enjoyment', label: m.form_enjoyment(), min: 1, accent: 'accent-indigo-400' }
	] as const;

	function openEdit() {
		editDraft = { title, physicalDifficulty, mentalDifficulty, enjoyment };
		loggingFlow = false;
		editing = true;
	}

	function saveEdit() {
		const nextTitle = editDraft.title.trim();
		if (!nextTitle || !onupdate) return;
		onupdate(id, { ...editDraft, title: nextTitle });
		editing = false;
	}

	function openFlowLog() {
		flowMinutesInput = flowMinutes ?? null;
		editing = false;
		loggingFlow = true;
	}

	function saveFlowLog() {
		const minutes = Number(flowMinutesInput);
		if (!minutes || minutes <= 0 || !onlogflow) return;
		onlogflow(id, minutes);
		loggingFlow = false;
	}

	function formatHours(decimalHour: number): string {
		let hours = Math.floor(decimalHour);
		let minutes = Math.round((decimalHour - hours) * 60);
		if (minutes === 60) {
			hours += 1;
			minutes = 0;
		}
		if (hours === 0) return `${minutes}m`;
		return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
	}

	const optimalStopTime = $derived(OPTIMAL_PHI_MULTIPLIER * flowStateTime);

	const nature = $derived(getTaskNature({ physicalDifficulty, mentalDifficulty }));
	const natureLabel = $derived(
		nature === 'cognitive'
			? m.task_nature_cognitive_label()
			: nature === 'physical'
				? m.task_nature_physical_label()
				: m.task_nature_hybrid_label()
	);
	const natureClass = $derived(
		nature === 'cognitive'
			? 'bg-blue-500/20 text-blue-400'
			: nature === 'physical'
				? 'bg-emerald-500/20 text-emerald-400'
				: 'bg-violet-500/20 text-violet-400'
	);
	const natureDescription = $derived(
		nature === 'cognitive'
			? m.task_nature_cognitive_description()
			: nature === 'physical'
				? m.task_nature_physical_description()
				: m.task_nature_hybrid_description()
	);
</script>

<Tooltip.Provider delayDuration={150}>
	<div
		class="group rounded-lg border border-transparent bg-transparent p-3 transition hover:border-white/5 hover:bg-white/3"
	>
		<div class="flex items-start gap-3">
			<input
				type="checkbox"
				checked={completed}
				onchange={() => ontoggle(id)}
				class="mt-0.5 h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-indigo-500/20"
			/>

			<div class="min-w-0 flex-1" class:opacity-60={completed}>
				<div class="flex flex-wrap items-center gap-2">
					{#if runOrder !== undefined && !completed}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="cursor-help rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400"
							>
								#{runOrder}
							</Tooltip.Trigger>
							<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
								<p>{m.task_run_order_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help">
							<Badge class="border-transparent uppercase tracking-wide {natureClass}">
								{natureLabel}
							</Badge>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>{natureDescription}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<h3
						class:text-zinc-500={completed}
						class:line-through={completed}
						class="truncate text-sm font-medium text-zinc-100 capitalize"
					>
						{title}
					</h3>
				</div>

				<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help">
							<span class="font-medium text-emerald-400/80">P {physicalDifficulty}</span>
							<span class="text-zinc-700">·</span>
							<span class="font-medium text-blue-400/80">M {mentalDifficulty}</span>
							<span class="text-zinc-700">·</span>
							<span class="font-medium text-indigo-400/80">E {enjoyment}</span>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>{m.task_inputs_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<span class="text-zinc-700">|</span>
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help">
							{m.task_derived_values({
								effort: trueEffort.toFixed(1),
								flow: formatHours(flowStateTime),
								stop: formatHours(optimalStopTime)
							})}
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>{m.task_derived_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					{#if flowMinutes}
						<Tooltip.Root>
							<Tooltip.Trigger class="cursor-help font-medium text-amber-400">
								⚡ {flowMinutes}m
							</Tooltip.Trigger>
							<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
								<p>{m.task_flow_badge_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-3">
				{#if !completed}
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help text-right">
							<div class="text-sm font-semibold text-zinc-100">
								{formatHours(suggestedHours)}
							</div>
							<div class="text-[10px] text-zinc-500">
								{m.task_priority({ score: priorityScore })}
							</div>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>{m.task_allocation_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				<div
					class="flex items-center gap-1 transition-opacity {editing || loggingFlow
						? 'opacity-100'
						: 'opacity-0 [@media(hover:none)]:opacity-100 focus-within:opacity-100 group-hover:opacity-100'}"
				>
					{#if onlogflow}
						{#if loggingFlow}
							<form
								class="flex items-center gap-1"
								onsubmit={(e) => (e.preventDefault(), saveFlowLog())}
							>
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="number"
									min="1"
									max="960"
									placeholder={m.task_minutes_placeholder()}
									autofocus
									bind:value={flowMinutesInput}
									class="w-14 rounded border border-amber-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-amber-500/60"
								/>
								<Button variant="ghost" size="icon-xs" type="submit" class="text-amber-400">
									✓
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									type="button"
									onclick={() => (loggingFlow = false)}
									class="text-zinc-600"
								>
									✕
								</Button>
							</form>
						{:else}
							<Tooltip.Root>
								<Tooltip.Trigger
									class={cn(
										buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
										flowMinutes ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400'
									)}
									onclick={openFlowLog}
									aria-label={m.task_log_flow_aria()}
								>
									⚡
								</Tooltip.Trigger>
								<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
									<p>{m.task_log_flow_tooltip()}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					{/if}

					{#if onupdate}
						<Tooltip.Root>
							<Tooltip.Trigger
								class={cn(
									buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
									editing ? 'text-emerald-400' : 'text-zinc-600 hover:text-emerald-400'
								)}
								onclick={() => (editing ? (editing = false) : openEdit())}
								aria-label={m.task_edit_aria()}
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l12.682-12.68z"
									/>
								</svg>
							</Tooltip.Trigger>
							<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
								<p>{m.task_edit_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
								'text-zinc-600 hover:text-red-400'
							)}
							onclick={() => onremove(id)}
							aria-label={m.task_remove_aria()}
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>{m.task_remove_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
			</div>
		</div>

		{#if editing}
			<form
				class="mt-3 ml-7 space-y-4 rounded-lg border border-white/10 bg-zinc-900/40 p-4"
				onsubmit={(e) => (e.preventDefault(), saveEdit())}
			>
				<label class="block text-xs font-medium text-zinc-400">
					{m.task_title_label()}
					<input
						type="text"
						bind:value={editDraft.title}
						required
						class="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
					/>
				</label>

				<div class="grid gap-4 sm:grid-cols-3">
					{#each editSliders as slider (slider.key)}
						<div class="space-y-2">
							<div class="flex justify-between text-xs font-medium">
								<span class="text-zinc-400">{slider.label}</span>
								<span class="text-zinc-100">{editDraft[slider.key]}</span>
							</div>
							<input
								type="range"
								min={slider.min}
								max="10"
								bind:value={editDraft[slider.key]}
								class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 {slider.accent}"
							/>
						</div>
					{/each}
				</div>

				<div class="flex justify-end gap-2">
					<Button variant="ghost" size="xs" type="button" onclick={() => (editing = false)}>
						{m.common_cancel()}
					</Button>
					<Button size="xs" type="submit" disabled={!editDraft.title.trim()}>
						{m.common_save()}
					</Button>
				</div>
			</form>
		{/if}
	</div>
</Tooltip.Provider>
