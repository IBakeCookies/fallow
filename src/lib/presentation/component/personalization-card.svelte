<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { FlowObservationRecord } from '$lib/business/type';

	interface Props {
		modelStatus: string; // e.g. "Personalized from 7 flow logs"
		flowLogs?: FlowObservationRecord[];
		ondeletelog?: (id: number) => void;
		onresetlogs?: () => void;
	}

	let { modelStatus, flowLogs = [], ondeletelog, onresetlogs }: Props = $props();

	// Expandable list of the measured data points behind the personalized
	// constants, with per-log delete and a two-step reset.
	let open = $state(false);
	let confirmingReset = $state(false);
	const logsNewestFirst = $derived([...flowLogs].reverse());
</script>

<div class="rounded-2xl border bg-surface-card backdrop-blur shadow-card p-box-md sm:p-6">
	<button
		type="button"
		aria-expanded={open}
		class="flex w-full items-center justify-between gap-2 text-left text-xs text-ty-silent transition hover:text-ty-secondary disabled:cursor-default disabled:hover:text-ty-silent"
		disabled={flowLogs.length === 0}
		title={m.budget_model_tooltip()}
		onclick={() => {
			open = !open;
			confirmingReset = false;
		}}
	>
		<span>{modelStatus}</span>
		{#if flowLogs.length > 0}
			<span class="shrink-0 text-lg leading-none text-ty-silent">{open ? '▴' : '▾'}</span>
		{/if}
	</button>

	{#if open && flowLogs.length > 0}
		<ul class="mt-2 space-y-1">
			{#each logsNewestFirst as log (log.id)}
				<li
					class="flex items-center justify-between gap-2 rounded bg-surface-card px-2 py-1 text-xs text-ty-secondary"
				>
					<span class="truncate">
						<span class="text-ty-silent">{log.date}</span>
						<span class="capitalize"> · {log.taskTitle}</span>
					</span>
					<span class="flex shrink-0 items-center gap-2">
						<span class="font-medium text-flow/90">⚡ {Math.round(log.phiHours * 60)}m</span>
						{#if ondeletelog}
							<button
								type="button"
								aria-label={m.budget_delete_log_aria()}
								title={m.budget_delete_log_title()}
								class="text-ty-silent transition hover:text-danger"
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
						<span class="text-ty-silent">
							{m.budget_reset_confirm({ count: flowLogs.length })}
						</span>
						<button
							type="button"
							class="font-medium text-danger hover:text-danger-strong"
							onclick={() => {
								onresetlogs?.();
								confirmingReset = false;
								open = false;
							}}
						>
							{m.common_reset()}
						</button>
						<button
							type="button"
							class="text-ty-silent hover:text-ty-secondary"
							onclick={() => (confirmingReset = false)}
						>
							{m.common_cancel()}
						</button>
					</span>
				{:else}
					<button
						type="button"
						class="text-xs text-ty-silent transition hover:text-danger"
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
