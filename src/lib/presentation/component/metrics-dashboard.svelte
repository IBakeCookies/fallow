<script lang="ts">
	import type { Metric } from '$lib/presentation/type';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import { Badge } from '$lib/presentation/component/ui/badge';
	import { STATUS } from '$lib/presentation/utils/status';

	interface Props {
		metrics: Metric[];
		momentum: number | null;
	}

	let { metrics, momentum }: Props = $props();

	// A reading's band is otherwise carried by colour alone (WCAG 1.4.1), so
	// each judged band also gets text only a screen reader hears. NEUTRAL is
	// left out on purpose: `text-ty-primary` is the default value colour and
	// says nothing — silence is the honest equivalent.
	const bandLabel: Record<string, () => string> = {
		[STATUS.SUCCESS.color]: m.metric_band_optimal,
		[STATUS.WARNING.color]: m.metric_band_caution,
		[STATUS.CRITICAL.color]: m.metric_band_critical
	};
</script>

<div class="rounded-2xl border bg-surface-card p-box-md sm:p-box-xl backdrop-blur shadow-card">
	<!-- Momentum -->
	<div class="flex items-center justify-between mb-text-md">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<span
						class="text-xs text-ty-secondary cursor-help underline decoration-ty-ghost decoration-dotted underline-offset-4"
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

	<div class="border-t border-line-soft my-grid-sm"></div>

	<!-- All Metrics flat list with separators between sections -->
	<div>
		{#each metrics as item, i (item.label)}
			{#if i > 0 && item.section}
				<div class="border-t border-line-soft my-grid-sm"></div>
			{/if}
			<div
				class="px-box-sm py-box-2xs flex justify-between items-baseline rounded-lg transition hover:bg-surface-hover"
			>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<span
								class="text-xs text-ty-secondary cursor-help underline decoration-ty-ghost decoration-dotted underline-offset-4"
							>
								{item.label}
							</span>
						</Tooltip.Trigger>
						<Tooltip.Content side="left">
							<p>{item.description}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
				<span class="text-sm font-semibold capitalize {item.valStyle}">{item.value}</span>
				<!-- Sibling, not nested: keeps the value element's text content exactly
				     the reading, which is what the e2e assertions and any consumer of
				     the rendered number match on. A screen reader reads the two in
				     sequence either way. -->
				{#if bandLabel[item.valStyle]}
					<span class="sr-only">({bandLabel[item.valStyle]()})</span>
				{/if}
			</div>
		{/each}
	</div>
</div>
