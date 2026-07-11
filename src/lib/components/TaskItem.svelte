<script lang="ts">
	import { Button } from '$lib/components/ui/button';
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
		onlogflow
	}: Props = $props();

	// Inline "log time-to-flow" editor (⚡): feeds the c₁,c₂,c₃ personalization
	let loggingFlow = $state(false);
	let flowMinutesInput = $state<number | null>(null);

	function openFlowLog() {
		flowMinutesInput = flowMinutes ?? null;
		loggingFlow = true;
	}

	function saveFlowLog() {
		const minutes = Number(flowMinutesInput);
		if (!minutes || minutes <= 0 || !onlogflow) return;
		onlogflow(id, minutes);
		loggingFlow = false;
	}

	function decimalHourToMinutes(decimalHour: number): string {
		const hours = Math.floor(decimalHour);
		const minutes = Math.round((decimalHour - hours) * 60);
		return `${hours}h ${minutes}m`;
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

	const badges = $derived([
		{ label: 'P', value: physicalDifficulty, color: 'text-emerald-400' },
		{ label: 'M', value: mentalDifficulty, color: 'text-blue-400' },
		{ label: 'E', value: enjoyment, color: 'text-indigo-400' },
		{ label: 'Prio', value: priorityScore, color: null },
		{ label: null, value: decimalHourToMinutes(suggestedHours), color: null }
	]);
</script>

<div
	class="group flex items-center justify-between rounded-lg border border-transparent bg-transparent p-3 transition hover:border-white/5 hover:bg-white/3"
>
	<div class="flex items-center gap-4">
		<input
			type="checkbox"
			checked={completed}
			onchange={() => ontoggle(id)}
			class="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/20"
		/>
		<div class="flex items-center gap-2">
			{#if runOrder !== undefined && !completed}
				<span
					class="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400"
					title="Suggested run order (alternates cognitive/physical work so the resting energy system recovers)"
				>
					#{runOrder}
				</span>
			{/if}
			<span
				class="text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded {natureClass}"
				title={nature}
			>
				{natureLabel}
			</span>
			<div>
				<h3
					class:text-zinc-500={completed}
					class:line-through={completed}
					class="text-sm font-medium text-zinc-100 capitalize"
				>
					{title}
				</h3>
				<p
					class="text-[10px] text-zinc-500"
					title="What the Zenith model derived from your sliders: true effort E (1–5), time to reach flow state ϕ, and the optimal stopping time (1.79×ϕ) beyond which average productivity declines"
				>
					E {trueEffort.toFixed(1)} · flow @ {decimalHourToMinutes(flowStateTime)} · stop by {decimalHourToMinutes(
						optimalStopTime
					)}
				</p>
			</div>
		</div>
	</div>

	<div class="flex items-center gap-2">
		{#each badges as badge, badgeIndex (badgeIndex)}
			<span
				class="rounded border border-zinc-800 bg-white/3 px-2 py-0.5 text-xs font-medium {badge.color ||
					'text-zinc-400'}"
			>
				{#if badge.label}{badge.label}:
				{/if}{badge.value}
			</span>
		{/each}

		{#if onlogflow}
			{#if loggingFlow}
				<form class="flex items-center gap-1" onsubmit={(e) => (e.preventDefault(), saveFlowLog())}>
					<input
						type="number"
						min="1"
						max="960"
						placeholder="min"
						bind:value={flowMinutesInput}
						class="w-14 rounded border border-amber-500/30 bg-zinc-900/80 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-amber-500/60"
						title="Minutes it actually took you to get into flow on this task"
					/>
					<Button variant="ghost" size="icon-xs" type="submit" class="text-amber-400">✓</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						type="button"
						onclick={() => (loggingFlow = false)}
						class="text-zinc-600">✕</Button
					>
				</form>
			{:else}
				<button
					onclick={openFlowLog}
					class="rounded border px-2 py-0.5 text-xs font-medium transition {flowMinutes
						? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
						: 'border-zinc-800 bg-white/3 text-zinc-600 hover:text-amber-400'}"
					title="Log how many minutes it took to get into flow — measured data points personalize the model's c₁,c₂,c₃ constants (least-squares fit)"
				>
					⚡{flowMinutes ? ` ${flowMinutes}m` : ''}
				</button>
			{/if}
		{/if}

		<Button
			variant="ghost"
			size="icon-xs"
			onclick={() => onremove(id)}
			class="ml-2 text-zinc-600 hover:text-red-400"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</Button>
	</div>
</div>
