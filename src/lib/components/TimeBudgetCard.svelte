<script lang="ts">
	import { NumberInput } from '$lib/components/ui/number-input';
	import type { FlowObservationRecord } from '$lib/storage/db';

	interface Props {
		availableHours: number;
		switchCost: number;
		cognitivePool: number;
		physicalPool: number;
		remainingSuggestedHours: string;
		planSlackHours: number;
		modelStatus?: string; // e.g. "Personalized from 7 flow logs"
		flowLogs?: FlowObservationRecord[];
		ondeletelog?: (id: number) => void;
		onresetlogs?: () => void;
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		cognitivePool = $bindable(),
		physicalPool = $bindable(),
		remainingSuggestedHours,
		planSlackHours,
		modelStatus,
		flowLogs = [],
		ondeletelog,
		onresetlogs
	}: Props = $props();

	// Display switch cost in minutes but store in hours
	let switchCostMinutes = $derived(Math.round(switchCost * 60));

	function updateSwitchCost(minutes: number) {
		switchCost = minutes / 60;
	}

	// Flow-log manager: expandable list of the measured data points behind the
	// personalized constants, with per-log delete and a two-step reset.
	let logsOpen = $state(false);
	let confirmingReset = $state(false);
	const logsNewestFirst = $derived([...flowLogs].reverse());
</script>

<div class="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl shadow-2xl p-6">
	<h3 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-4">Time Budget</h3>
	<div class="flex gap-0">
		<div class="flex-1 pr-4">
			<label for="available-hours" class="text-xs text-zinc-500 mb-1 block">Available Hours</label>
			<NumberInput
				id="available-hours"
				value={availableHours}
				onchange={(v) => (availableHours = v)}
				min={0}
				max={24}
				step={0.25}
				unit="hrs"
				accent="focus-within:border-indigo-500/50"
			/>
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
			<label for="switch-cost" class="text-xs text-zinc-500 mb-1 block">
				Switch Cost (per task change)
			</label>
			<NumberInput
				id="switch-cost"
				value={switchCostMinutes}
				onchange={updateSwitchCost}
				min={0}
				max={60}
				step={5}
				unit="min"
				accent="focus-within:border-indigo-500/50"
			/>
			<p class="text-xs text-zinc-600 mt-2">Context-switching overhead per transition</p>
		</div>
	</div>

	<div class="mt-5 pt-4 border-t border-white/10 flex gap-0">
		<div class="flex-1 pr-4">
			<label for="cognitive-pool" class="text-xs text-zinc-500 mb-1 block">Cognitive Capacity</label
			>
			<NumberInput
				id="cognitive-pool"
				value={cognitivePool}
				onchange={(v) => (cognitivePool = v)}
				min={0}
				max={16}
				step={0.5}
				unit="hrs"
				accent="focus-within:border-blue-500/50"
			/>
			<p class="text-xs text-zinc-600 mt-2">Intense mental work you sustain per day (~4h)</p>
		</div>
		<div class="w-px bg-white/10 self-stretch mx-4"></div>
		<div class="flex-1 pl-4">
			<label for="physical-pool" class="text-xs text-zinc-500 mb-1 block">Physical Capacity</label>
			<NumberInput
				id="physical-pool"
				value={physicalPool}
				onchange={(v) => (physicalPool = v)}
				min={0}
				max={16}
				step={0.5}
				unit="hrs"
				accent="focus-within:border-emerald-500/50"
			/>
			<p class="text-xs text-zinc-600 mt-2">Intense physical work you sustain per day (~6h)</p>
		</div>
	</div>

	{#if modelStatus}
		<div class="mt-4 pt-3 border-t border-white/10">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-2 text-left text-xs text-zinc-500 transition hover:text-zinc-300 disabled:cursor-default disabled:hover:text-zinc-500"
				disabled={flowLogs.length === 0}
				title="The model's flow-state constants (c₁, c₂, c₃) are a ridge least-squares fit of your measured time-to-flow data, anchored to the article's defaults. Click to manage the logged data points."
				onclick={() => {
					logsOpen = !logsOpen;
					confirmingReset = false;
				}}
			>
				<span>{modelStatus}</span>
				{#if flowLogs.length > 0}
					<span class="shrink-0 text-zinc-600">{logsOpen ? '▴' : '▾'}</span>
				{/if}
			</button>

			{#if logsOpen && flowLogs.length > 0}
				<ul class="mt-2 space-y-1">
					{#each logsNewestFirst as log (log.id)}
						<li
							class="flex items-center justify-between gap-2 rounded bg-white/3 px-2 py-1 text-xs text-zinc-400"
						>
							<span class="truncate">
								<span class="text-zinc-600">{log.date}</span>
								<span class="capitalize"> · {log.taskTitle}</span>
							</span>
							<span class="flex shrink-0 items-center gap-2">
								<span class="font-medium text-amber-400/90"
									>⚡ {Math.round(log.phiHours * 60)}m</span
								>
								{#if ondeletelog}
									<button
										type="button"
										aria-label="Delete this flow log"
										title="Remove this data point — the model refits without it"
										class="text-zinc-600 transition hover:text-red-400"
										onclick={() => ondeletelog?.(log.id!)}
									>
										✕
									</button>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
				{#if onresetlogs}
					<div class="mt-2 flex justify-end">
						{#if confirmingReset}
							<span class="flex items-center gap-2 text-xs">
								<span class="text-zinc-500">
									Delete all {flowLogs.length} logs and revert to defaults?
								</span>
								<button
									type="button"
									class="font-medium text-red-400 hover:text-red-300"
									onclick={() => {
										onresetlogs?.();
										confirmingReset = false;
										logsOpen = false;
									}}
								>
									Reset
								</button>
								<button
									type="button"
									class="text-zinc-500 hover:text-zinc-300"
									onclick={() => (confirmingReset = false)}
								>
									Cancel
								</button>
							</span>
						{:else}
							<button
								type="button"
								class="text-xs text-zinc-600 transition hover:text-red-400"
								title="Delete all flow logs — the constants are always derived from the logs (never stored), so the model reverts to the article defaults"
								onclick={() => (confirmingReset = true)}
							>
								Reset personalization
							</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
