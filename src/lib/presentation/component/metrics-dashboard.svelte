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

<div class="rounded-xl border border-white/10 bg-white/3 p-5 backdrop-blur-xl">
	<!-- Momentum -->
	<div class="flex items-center justify-between mb-4">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<span
						class="text-xs text-zinc-400 cursor-help underline decoration-dotted underline-offset-2"
					>
						{m.momentum_label()}
					</span>
				</Tooltip.Trigger>
				<Tooltip.Content side="left" class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
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
				? 'bg-emerald-500/20 text-emerald-300'
				: momentum !== null && momentum < 0
					? 'bg-amber-500/20 text-amber-300'
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

	<div class="border-t border-zinc-800 my-3"></div>

	<!-- All Metrics flat list with separators -->
	<div>
		{#each metrics as item, i}
			{#if i === 4 || i === 7 || i === 11 || i === 13 || i === 16}
				<div class="border-t border-zinc-800 my-3"></div>
			{/if}
			<div
				class="px-3 py-2 flex justify-between items-baseline rounded-lg transition hover:bg-white/4"
			>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<span
								class="text-xs text-zinc-400 cursor-help underline decoration-dotted underline-offset-2"
							>
								{item.label}
							</span>
						</Tooltip.Trigger>
						<Tooltip.Content side="left" class="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200">
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
