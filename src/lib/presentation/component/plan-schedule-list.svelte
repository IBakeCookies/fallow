<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EvaluatedBlock } from '$lib/business/model/zenith-energy';
	import { formatDuration, formatOffset } from '$lib/presentation/utils/duration-format';
	import { formatDecimals } from '$lib/presentation/utils/number-format';
	import type { SeriesColors } from '$lib/presentation/utils/series-color';

	interface Props {
		/** In schedule order; `taskId: null` is a rest block. */
		blocks: EvaluatedBlock[];
		/** The day's length, which is where the free-time row ends. */
		windowHours: number;
		/** The tail the optimizer left unplanned. */
		trailingFreeHours: number;
		/** Where the plan stops — the free-time row starts there, not at the last block. */
		plannedHours: number;
		colors: SeriesColors;
		/** The reader's locale tag: each block's output is a decimal. */
		locale: string;
	}

	let { blocks, windowHours, trailingFreeHours, plannedHours, colors, locale }: Props = $props();

	// Same dust threshold as the timeline bar: the optimizer's hours rarely sum to the
	// window exactly, and a 1e-12 row is a line of zeroes.
	const FREE_EPSILON = 1e-6;
</script>

{#if blocks.length === 0}
	<p class="mt-text-md text-sm text-ty-silent">{m.energy_nothing_scheduled()}</p>
{:else}
	<ul class="mt-text-md space-y-text-xs">
		{#each blocks as block (block.start)}
			<li class="flex items-center gap-grid-xs text-sm">
				<span
					class="h-2.5 w-2.5 shrink-0 rounded-full"
					style="background-color: {colors.colorOf(block.taskId)}"
				></span>
				<span class="w-28 shrink-0 tabular-nums text-ty-silent">
					{formatOffset(block.start)}–{formatOffset(block.start + block.hours)}
				</span>
				<span
					class="min-w-0 flex-1 truncate {block.taskId === null
						? 'text-ty-silent italic'
						: 'capitalize text-ty-primary'}"
				>
					{block.title}
				</span>
				<span class="shrink-0 text-xs text-ty-silent">{formatDuration(block.hours)}</span>
				{#if block.taskId === null}
					<!-- Rest has no output to report; it is what makes the next block's output
					     possible, which the column cannot say in a number. -->
					<span class="w-20 shrink-0 text-right text-xs text-ty-silent">{m.energy_recovery()}</span>
				{:else}
					<span class="w-20 shrink-0 text-right text-xs tabular-nums text-brand-strong">
						{m.energy_output_suffix({
							output: formatDecimals(block.output, 2, locale),
						})}
					</span>
				{/if}
			</li>
		{/each}
		{#if trailingFreeHours > FREE_EPSILON}
			<li class="flex items-center gap-grid-xs text-sm">
				<span class="h-2.5 w-2.5 shrink-0 rounded-full border border-line-strong"></span>
				<span class="w-28 shrink-0 tabular-nums text-ty-silent">
					{formatOffset(plannedHours)}–{formatOffset(windowHours)}
				</span>
				<span class="flex-1 text-ty-silent italic">{m.energy_free_time()}</span>
				<span class="shrink-0 text-xs text-ty-silent">{formatDuration(trailingFreeHours)}</span>
				<span class="w-20"></span>
			</li>
		{/if}
	</ul>
{/if}
