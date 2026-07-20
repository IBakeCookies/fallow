<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';

	interface Props {
		availableHours: number;
		switchCost: number;
		cognitivePool: number;
		physicalPool: number;
		remainingSuggestedHours: string;
		planSlackHours: number;
		// Collapsed, the card is a one-line summary (budget · planned · slack)
		// so the task list stays above the fold. Inputs are occasional-use.
		startOpen?: boolean;
	}

	let {
		availableHours = $bindable(),
		switchCost = $bindable(),
		cognitivePool = $bindable(),
		physicalPool = $bindable(),
		remainingSuggestedHours,
		planSlackHours,
		startOpen = true
	}: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(startOpen);

	// Display switch cost in minutes but store in hours
	let switchCostMinutes = $derived(Math.round(switchCost * 60));

	function updateSwitchCost(minutes: number) {
		switchCost = minutes / 60;
	}
</script>

<div class="rounded-2xl border bg-surface-card backdrop-blur shadow-card p-box-md sm:p-6">
	<button
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between gap-grid-xs text-left"
	>
		<h3 class="text-xs font-semibold text-ty-secondary uppercase tracking-wider">
			{m.budget_title()}
		</h3>
		<span class="flex min-w-0 items-center gap-grid-xs text-xs text-ty-silent">
			{#if !open}
				<span class="truncate">
					{m.budget_summary({
						hours: availableHours,
						planned: remainingSuggestedHours
					})}{planSlackHours > 0.05
						? ` · ${m.budget_summary_free({ slack: planSlackHours.toFixed(2) })}`
						: ''}
				</span>
			{/if}
			<span class="shrink-0 text-lg leading-none text-ty-silent">{open ? '▴' : '▾'}</span>
		</span>
	</button>
	{#if open}
		<div class="flex flex-col sm:flex-row mt-4">
			<div class="flex-1 sm:pr-4">
				<label for="available-hours" class="text-xs text-ty-silent mb-1 block">
					{m.budget_available_hours()}
				</label>
				<NumberInput
					id="available-hours"
					value={availableHours}
					onchange={(v) => (availableHours = v)}
					min={0}
					max={24}
					step={0.25}
					unit={m.unit_hours()}
					accent="focus-within:border-brand/50"
				/>
				<p class="text-xs text-ty-silent mt-2">
					{m.budget_allocated({ hours: remainingSuggestedHours })}
				</p>
				{#if planSlackHours > 0.05}
					<p class="text-xs text-warning/80 mt-1" title={m.budget_unplanned_title()}>
						{m.budget_unplanned({ hours: planSlackHours.toFixed(2) })}
					</p>
				{/if}
			</div>
			<div
				class="my-4 h-px w-full bg-border sm:my-0 sm:mx-4 sm:h-auto sm:w-px sm:self-stretch"
			></div>
			<div class="flex-1 sm:pl-4">
				<label for="switch-cost" class="text-xs text-ty-silent mb-1 block">
					{m.budget_switch_cost()}
				</label>
				<NumberInput
					id="switch-cost"
					value={switchCostMinutes}
					onchange={updateSwitchCost}
					min={0}
					max={60}
					step={5}
					unit={m.unit_minutes()}
					accent="focus-within:border-brand/50"
				/>
				<p class="text-xs text-ty-silent mt-2">{m.budget_switch_cost_hint()}</p>
			</div>
		</div>

		<div class="mt-5 pt-4 border-t flex flex-col sm:flex-row">
			<div class="flex-1 sm:pr-4">
				<label for="cognitive-pool" class="text-xs text-ty-silent mb-1 block">
					{m.budget_cognitive_capacity()}
				</label>
				<NumberInput
					id="cognitive-pool"
					value={cognitivePool}
					onchange={(v) => (cognitivePool = v)}
					min={0}
					max={16}
					step={0.5}
					unit={m.unit_hours()}
					accent="focus-within:border-mind/50"
				/>
				<p class="text-xs text-ty-silent mt-2">{m.budget_cognitive_hint()}</p>
			</div>
			<div
				class="my-4 h-px w-full bg-border sm:my-0 sm:mx-4 sm:h-auto sm:w-px sm:self-stretch"
			></div>
			<div class="flex-1 sm:pl-4">
				<label for="physical-pool" class="text-xs text-ty-silent mb-1 block">
					{m.budget_physical_capacity()}
				</label>
				<NumberInput
					id="physical-pool"
					value={physicalPool}
					onchange={(v) => (physicalPool = v)}
					min={0}
					max={16}
					step={0.5}
					unit={m.unit_hours()}
					accent="focus-within:border-body/50"
				/>
				<p class="text-xs text-ty-silent mt-2">{m.budget_physical_hint()}</p>
			</div>
		</div>
	{/if}
</div>
