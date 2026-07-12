<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { NumberInput } from '$lib/presentation/component/ui/number-input';
	import type { FlowObservationRecord } from '$lib/business/type';

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
		modelStatus,
		flowLogs = [],
		ondeletelog,
		onresetlogs,
		startOpen = true
	}: Props = $props();

	// svelte-ignore state_referenced_locally -- deliberately initial-value only
	let open = $state(startOpen);

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

<div class="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl shadow-2xl p-4 sm:p-6">
	<button
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between gap-3 text-left"
	>
		<h3 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
			{m.budget_title()}
		</h3>
		<span class="flex min-w-0 items-center gap-3 text-xs text-zinc-500">
			{#if !open}
				<span class="truncate">
					{m.budget_summary({ hours: availableHours, planned: remainingSuggestedHours })}{planSlackHours >
					0.05
						? ` · ${m.budget_summary_free({ slack: planSlackHours.toFixed(2) })}`
						: ''}
				</span>
			{/if}
			<span class="shrink-0 text-zinc-600">{open ? '▴' : '▾'}</span>
		</span>
	</button>
	{#if open}
	<div class="flex flex-col sm:flex-row mt-4">
		<div class="flex-1 sm:pr-4">
			<label for="available-hours" class="text-xs text-zinc-500 mb-1 block">
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
				accent="focus-within:border-indigo-500/50"
			/>
			<p class="text-xs text-zinc-500 mt-2">
				{m.budget_allocated({ hours: remainingSuggestedHours })}
			</p>
			{#if planSlackHours > 0.05}
				<p class="text-xs text-amber-400/80 mt-1" title={m.budget_unplanned_title()}>
					{m.budget_unplanned({ hours: planSlackHours.toFixed(2) })}
				</p>
			{/if}
		</div>
		<div
			class="my-4 h-px w-full bg-white/10 sm:my-0 sm:mx-4 sm:h-auto sm:w-px sm:self-stretch"
		></div>
		<div class="flex-1 sm:pl-4">
			<label for="switch-cost" class="text-xs text-zinc-500 mb-1 block">
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
				accent="focus-within:border-indigo-500/50"
			/>
			<p class="text-xs text-zinc-600 mt-2">{m.budget_switch_cost_hint()}</p>
		</div>
	</div>

	<div class="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row">
		<div class="flex-1 sm:pr-4">
			<label for="cognitive-pool" class="text-xs text-zinc-500 mb-1 block">
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
				accent="focus-within:border-blue-500/50"
			/>
			<p class="text-xs text-zinc-600 mt-2">{m.budget_cognitive_hint()}</p>
		</div>
		<div
			class="my-4 h-px w-full bg-white/10 sm:my-0 sm:mx-4 sm:h-auto sm:w-px sm:self-stretch"
		></div>
		<div class="flex-1 sm:pl-4">
			<label for="physical-pool" class="text-xs text-zinc-500 mb-1 block">
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
				accent="focus-within:border-emerald-500/50"
			/>
			<p class="text-xs text-zinc-600 mt-2">{m.budget_physical_hint()}</p>
		</div>
	</div>

	{#if modelStatus}
		<div class="mt-4 pt-3 border-t border-white/10">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-2 text-left text-xs text-zinc-500 transition hover:text-zinc-300 disabled:cursor-default disabled:hover:text-zinc-500"
				disabled={flowLogs.length === 0}
				title={m.budget_model_tooltip()}
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
										aria-label={m.budget_delete_log_aria()}
										title={m.budget_delete_log_title()}
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
									{m.budget_reset_confirm({ count: flowLogs.length })}
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
									{m.common_reset()}
								</button>
								<button
									type="button"
									class="text-zinc-500 hover:text-zinc-300"
									onclick={() => (confirmingReset = false)}
								>
									{m.common_cancel()}
								</button>
							</span>
						{:else}
							<button
								type="button"
								class="text-xs text-zinc-600 transition hover:text-red-400"
								title={m.budget_reset_title()}
								onclick={() => (confirmingReset = true)}
							>
								{m.budget_reset_personalization()}
							</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
	{/if}
</div>
