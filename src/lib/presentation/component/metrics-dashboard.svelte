<script lang="ts">
	import type { Metric } from '$lib/presentation/type';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { Badge } from '$lib/presentation/component/ui/badge';

	interface Props {
		metrics: Metric[];
		momentum: number | null;
	}

	let { metrics, momentum }: Props = $props();
</script>

<div class="rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
	<!-- Momentum -->
	<div class="flex items-center justify-between mb-text-md">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<span
						class="text-xs text-ty-secondary cursor-help underline decoration-dotted underline-offset-2"
					>
						{m.momentum_label()}
					</span>
				</Tooltip.Trigger>
				<Tooltip.Content side="left">
					<p>{m.momentum_tooltip()}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<Badge
			variant={momentum !== null && momentum > 0
				? 'default'
				: momentum !== null && momentum < 0
					? 'destructive'
					: 'secondary'}
			class={momentum !== null && momentum > 0
				? 'bg-success/20 text-success-strong'
				: momentum !== null && momentum < 0
					? 'bg-warning/20 text-warning-strong'
					: ''}
		>
			{momentum === null
				? m.na_value()
				: momentum > 0
					? m.momentum_upward()
					: momentum < 0
						? m.momentum_reset_required()
						: m.momentum_stable()}
		</Badge>
	</div>

	<div class="border-t border-line-strong my-grid-sm"></div>

	<!-- All Metrics flat list with separators between sections -->
	<div>
		{#each metrics as item, i (item.label)}
			{#if i > 0 && item.section}
				<div class="border-t border-line-strong my-grid-sm"></div>
			{/if}
			<div
				class="px-3 py-2 flex justify-between items-baseline rounded-lg transition hover:bg-surface-card"
			>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<span
								class="text-xs text-ty-secondary cursor-help underline decoration-dotted underline-offset-2"
							>
								{item.label}
							</span>
						</Tooltip.Trigger>
						<Tooltip.Content side="left">
							<p>{item.description}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
				<span class="text-sm font-semibold capitalize {item.valStyle}">
					{item.value}
				</span>
			</div>
		{/each}
	</div>
</div>
