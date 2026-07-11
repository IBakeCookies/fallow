<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';
	import { getTaskNature } from '$lib/metrics/calculations';
	import { OPTIMAL_PHI_MULTIPLIER } from '$lib/zenith';

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
		{ key: 'physicalDifficulty', label: 'Physical Diff', min: 0, accent: 'accent-emerald-400' },
		{ key: 'mentalDifficulty', label: 'Mental Diff', min: 0, accent: 'accent-blue-400' },
		{ key: 'enjoyment', label: 'Enjoyment', min: 1, accent: 'accent-indigo-400' }
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
		nature === 'cognitive' ? 'COG' : nature === 'physical' ? 'PHY' : 'HYB'
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
			? 'Cognitive task — mental difficulty dominates, draws on the cognitive capacity pool'
			: nature === 'physical'
				? 'Physical task — physical difficulty dominates, draws on the physical capacity pool'
				: 'Hybrid task — balanced mental and physical demands, draws on both capacity pools'
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
								<p>
									Suggested run order — alternates cognitive and physical work so the resting energy
									system recovers
								</p>
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
							<p>
								Your slider inputs: Physical difficulty, Mental difficulty, Enjoyment — hover the
								task and use ✎ to change them
							</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<span class="text-zinc-700">|</span>
					<Tooltip.Root>
						<Tooltip.Trigger class="cursor-help">
							effort {trueEffort.toFixed(1)} · flow @ {formatHours(flowStateTime)} · stop by {formatHours(
								optimalStopTime
							)}
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>
								What the Zenith model derived from your sliders: true effort E (1–5), time to reach
								flow state ϕ, and the optimal stopping time (1.79×ϕ) beyond which average
								productivity declines
							</p>
						</Tooltip.Content>
					</Tooltip.Root>
					{#if flowMinutes}
						<Tooltip.Root>
							<Tooltip.Trigger class="cursor-help font-medium text-amber-400">
								⚡ {flowMinutes}m
							</Tooltip.Trigger>
							<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
								<p>
									Measured minutes-to-flow you logged for this task — data points like this
									personalize the model's c₁,c₂,c₃ constants (least-squares fit)
								</p>
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
							<div class="text-[10px] text-zinc-500">prio {priorityScore}</div>
						</Tooltip.Trigger>
						<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
							<p>
								Suggested time allocation for today, and the task's priority score (intrinsic value
								× 10) that drives it
							</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}

				<div
					class="flex items-center gap-1 transition-opacity {editing || loggingFlow
						? 'opacity-100'
						: 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'}"
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
									placeholder="min"
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
									aria-label="Log time to flow"
								>
									⚡
								</Tooltip.Trigger>
								<Tooltip.Content class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
									<p>
										Log how many minutes it took to get into flow — measured data points personalize
										the model's c₁,c₂,c₃ constants
									</p>
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
								aria-label="Edit task"
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
								<p>Edit title, difficulty and enjoyment</p>
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
							aria-label="Delete task"
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
							<p>Remove task</p>
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
					Title
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
						Cancel
					</Button>
					<Button size="xs" type="submit" disabled={!editDraft.title.trim()}>Save</Button>
				</div>
			</form>
		{/if}
	</div>
</Tooltip.Provider>
