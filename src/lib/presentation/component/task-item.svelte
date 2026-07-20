<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button, buttonVariants } from '$lib/presentation/component/ui/button';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { cn } from '$lib/presentation/utils';
	import { getTaskNature } from '$lib/business/model/metric/calculation';

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
		// Per-task optimal stopping time T* from the allocator (model v2:
		// task-dependent — no longer reconstructable as a fixed 1.79 × ϕ)
		optimalStopHours: number;
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
		optimalStopHours,
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
			accent: 'accent-body'
		},
		{
			key: 'mentalDifficulty',
			label: m.form_mental_difficulty(),
			min: 0,
			accent: 'accent-mind'
		},
		{ key: 'enjoyment', label: m.form_enjoyment(), min: 1, accent: 'accent-brand' }
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

	const optimalStopTime = $derived(optimalStopHours);

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
			? 'bg-mind/20 text-mind'
			: nature === 'physical'
				? 'bg-body/20 text-body'
				: 'bg-mixed/20 text-mixed'
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
		class="group rounded-lg border border-transparent bg-transparent p-3 transition hover:border-line-soft hover:bg-surface-card"
	>
		<div class="flex items-start gap-grid-xs">
			<input
				type="checkbox"
				checked={completed}
				onchange={() => ontoggle(id)}
				class="mt-0.5 h-4 w-4 cursor-pointer rounded border-line-strong bg-input text-success focus:ring-brand/20"
			/>

			<div class="min-w-0 flex-1" class:opacity-60={completed}>
				<div class="flex flex-wrap items-center gap-2">
					{#if runOrder !== undefined && !completed}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="cursor-help rounded bg-flow/15 px-1.5 py-0.5 text-xs font-semibold text-flow"
							>
								#{runOrder}
							</Tooltip.Trigger>
							<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
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
						<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
							<p>{natureDescription}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<h3
						class:text-ty-silent={completed}
						class:line-through={completed}
						class="truncate text-sm font-medium text-ty-primary capitalize"
					>
						{title}
					</h3>
				</div>

				<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ty-silent">
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help">
							<span class="font-medium text-body/80">P {physicalDifficulty}</span>
							<span class="text-ty-ghost">·</span>
							<span class="font-medium text-mind/80">M {mentalDifficulty}</span>
							<span class="text-ty-ghost">·</span>
							<span class="font-medium text-brand/80">E {enjoyment}</span>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
							<p>{m.task_inputs_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<span class="text-ty-ghost">|</span>
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help">
							{m.task_derived_values({
								effort: trueEffort.toFixed(1),
								flow: formatHours(flowStateTime),
								stop: formatHours(optimalStopTime)
							})}
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
							<p>{m.task_derived_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					{#if flowMinutes}
						<Tooltip.Root>
							<Tooltip.Trigger class="cursor-help font-medium text-flow">
								⚡ {flowMinutes}m
							</Tooltip.Trigger>
							<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
								<p>{m.task_flow_badge_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-grid-xs">
				{#if !completed}
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help text-right">
							<div class="text-sm font-semibold text-ty-primary">
								{formatHours(suggestedHours)}
							</div>
							<div class="text-2xs text-ty-silent">
								{m.task_priority({ score: priorityScore })}
							</div>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
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
									class="w-14 rounded border border-flow/30 bg-input px-1.5 py-0.5 text-xs text-ty-primary outline-none focus:border-flow/60"
								/>
								<Button variant="ghost" size="icon-xs" type="submit" class="text-flow">✓</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									type="button"
									onclick={() => (loggingFlow = false)}
									class="text-ty-silent"
								>
									✕
								</Button>
							</form>
						{:else}
							<Tooltip.Root>
								<Tooltip.Trigger
									class={cn(
										buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
										flowMinutes ? 'text-flow' : 'text-ty-silent hover:text-flow'
									)}
									onclick={openFlowLog}
									aria-label={m.task_log_flow_aria()}
								>
									⚡
								</Tooltip.Trigger>
								<Tooltip.Content
									class="max-w-xs bg-surface-page border-line-strong text-ty-primary"
								>
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
									editing ? 'text-success' : 'text-ty-silent hover:text-success'
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
							<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
								<p>{m.task_edit_tooltip()}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					<Tooltip.Root>
						<Tooltip.Trigger
							class={cn(
								buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
								'text-ty-silent hover:text-danger'
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
						<Tooltip.Content class="max-w-xs bg-surface-page border-line-strong text-ty-primary">
							<p>{m.task_remove_tooltip()}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
			</div>
		</div>

		{#if editing}
			<form
				class="mt-3 ml-7 space-y-grid-md rounded-lg border bg-surface-page/40 p-box-md"
				onsubmit={(e) => (e.preventDefault(), saveEdit())}
			>
				<label class="block text-xs font-medium text-ty-secondary">
					{m.task_title_label()}
					<input
						type="text"
						bind:value={editDraft.title}
						required
						class="mt-1.5 w-full rounded-lg border border-line-strong bg-input px-3 py-2 text-sm text-ty-primary placeholder:text-ty-silent outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/50"
					/>
				</label>

				<div class="grid gap-grid-md sm:grid-cols-3">
					{#each editSliders as slider (slider.key)}
						<div class="space-y-2">
							<div class="flex justify-between text-xs font-medium">
								<span class="text-ty-secondary">{slider.label}</span>
								<span class="text-ty-primary">{editDraft[slider.key]}</span>
							</div>
							<input
								type="range"
								min={slider.min}
								max="10"
								bind:value={editDraft[slider.key]}
								class="h-1 w-full cursor-pointer appearance-none rounded-full bg-line-strong {slider.accent}"
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
