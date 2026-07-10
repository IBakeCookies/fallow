<script lang="ts">
	import * as Card from '$lib/components/ui/card';

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

<Card.Root class="border-white/10 bg-white/[0.02] backdrop-blur-xl">
	<Card.Header class="pb-2">
		<Card.Title class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
			Time Budget
		</Card.Title>
	</Card.Header>
	<Card.Content class="pt-0 space-y-3">
		<div>
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
		</div>
		<div>
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
			<p class="text-xs text-zinc-600 mt-1">Context-switching overhead per transition</p>
		</div>
		<p class="text-xs text-zinc-500">Allocated: {remainingSuggestedHours}h</p>
	</Card.Content>
</Card.Root>
