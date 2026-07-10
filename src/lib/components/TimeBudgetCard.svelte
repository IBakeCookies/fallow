<script lang="ts">
	interface Props {
		availableHours: number;
		switchCost: number;
		remainingSuggestedHours: string;
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		remainingSuggestedHours
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
</div>
