<script lang="ts">
	interface Props {
		availableHours: number;
		switchCost: number;
		cognitivePool: number;
		physicalPool: number;
		remainingSuggestedHours: string;
		planSlackHours: number;
		modelStatus?: string; // e.g. "Personalized from 7 flow logs"
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		cognitivePool = $bindable(),
		physicalPool = $bindable(),
		remainingSuggestedHours,
		planSlackHours,
		modelStatus
	}: Props = $props();

	// Display switch cost in minutes but store in hours
	let switchCostMinutes = $derived(Math.round(switchCost * 60));

	function updateSwitchCost(minutes: number) {
		switchCost = minutes / 60;
	}
</script>

<div class="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl shadow-2xl p-6">
	<h3 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-4">Time Budget</h3>
	<div class="flex gap-0">
		<div class="flex-1 pr-4">
			<label class="text-xs text-zinc-500 mb-1 block">Available Hours</label>
			<div class="relative">
				<input
					type="number"
					step="0.25"
					min="0"
					bind:value={availableHours}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
				/>
				<span class="absolute right-8 top-2.5 text-xs font-medium text-zinc-500">HRS</span>
			</div>
			<p class="text-xs text-zinc-500 mt-2">Allocated: {remainingSuggestedHours}h</p>
			{#if planSlackHours > 0.05}
				<p
					class="text-xs text-amber-400/80 mt-1"
					title="The plan deliberately stops short of your budget: each task is capped at its optimal stopping time (1.79×ϕ, where average productivity peaks) and by your cognitive/physical capacity pools. The unused hours are recovery time, not lost time."
				>
					{planSlackHours.toFixed(2)}h left unplanned — capped by optimal stopping times &amp;
					capacity pools
				</p>
			{/if}
		</div>
		<div class="w-px bg-white/10 self-stretch mx-4"></div>
		<div class="flex-1 pl-4">
			<label class="text-xs text-zinc-500 mb-1 block">Switch Cost (per task change)</label>
			<div class="relative">
				<input
					type="number"
					step="5"
					min="0"
					max="60"
					value={switchCostMinutes}
					oninput={(e) => updateSwitchCost(Number(e.currentTarget.value))}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
				/>
				<span class="absolute right-8 top-2.5 text-xs font-medium text-zinc-500">MIN</span>
			</div>
			<p class="text-xs text-zinc-600 mt-2">Context-switching overhead per transition</p>
		</div>
	</div>

	<div class="mt-5 pt-4 border-t border-white/10 flex gap-0">
		<div class="flex-1 pr-4">
			<label for="cognitive-pool" class="text-xs text-zinc-500 mb-1 block">Cognitive Capacity</label>
			<div class="relative">
				<input
					id="cognitive-pool"
					type="number"
					step="0.5"
					min="0"
					max="16"
					bind:value={cognitivePool}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500/50"
				/>
				<span class="absolute right-8 top-2.5 text-xs font-medium text-zinc-500">HRS</span>
			</div>
			<p class="text-xs text-zinc-600 mt-2">Intense mental work you sustain per day (~4h)</p>
		</div>
		<div class="w-px bg-white/10 self-stretch mx-4"></div>
		<div class="flex-1 pl-4">
			<label for="physical-pool" class="text-xs text-zinc-500 mb-1 block">Physical Capacity</label>
			<div class="relative">
				<input
					id="physical-pool"
					type="number"
					step="0.5"
					min="0"
					max="16"
					bind:value={physicalPool}
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
				/>
				<span class="absolute right-8 top-2.5 text-xs font-medium text-zinc-500">HRS</span>
			</div>
			<p class="text-xs text-zinc-600 mt-2">Intense physical work you sustain per day (~6h)</p>
		</div>
	</div>

	{#if modelStatus}
		<p
			class="mt-4 pt-3 border-t border-white/10 text-xs text-zinc-500"
			title="The model's flow-state constants (c₁, c₂, c₃) are fitted to your measured time-to-flow data via least squares once enough ⚡ logs exist; until then it uses the article's defaults"
		>
			{modelStatus}
		</p>
	{/if}
</div>
