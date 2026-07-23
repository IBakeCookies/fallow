<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { FlowObservationRecord } from '$lib/business/type';
	import LogList from './log-list.svelte';

	interface Props {
		modelStatus: string; // e.g. "Personalized from 7 flow logs"
		flowLogs?: FlowObservationRecord[];
		ondeletelog?: (id: number) => void;
		onresetlogs?: () => void;
	}

	let { modelStatus, flowLogs = [], ondeletelog, onresetlogs }: Props = $props();
</script>

<div class="rounded-2xl border bg-surface-card backdrop-blur shadow-card p-box-md sm:p-box-xl">
	<LogList
		label={modelStatus}
		title={m.budget_model_tooltip()}
		items={flowLogs}
		confirmLabel={m.budget_reset_confirm({ count: flowLogs.length })}
		resetLabel={m.budget_reset_personalization()}
		resetTitle={m.budget_reset_title()}
		onreset={onresetlogs}
	>
		{#snippet row(log)}
			<span class="truncate">
				<span class="text-ty-silent">{log.date}</span>
				<span class="capitalize"> · {log.taskTitle}</span>
			</span>
			<span class="flex shrink-0 items-center gap-text-xs">
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
		{/snippet}
	</LogList>
</div>
