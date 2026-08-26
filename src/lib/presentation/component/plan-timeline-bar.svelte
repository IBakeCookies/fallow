<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EvaluatedBlock } from '$lib/business/model/zenith-energy';
	import { formatDuration, formatOffset } from '$lib/presentation/utils/duration-format';
	import type { SeriesColors } from '$lib/presentation/utils/series-color';

	interface Props {
		/** In schedule order; `taskId: null` is a rest block. */
		blocks: EvaluatedBlock[];
		/** The day's length, and the denominator of every width. Positive: a zero
		 *  window has no bar to draw, and the page offers the window field instead. */
		windowHours: number;
		/** The tail the optimizer left unplanned — it stopped before the day did. */
		trailingFreeHours: number;
		colors: SeriesColors;
	}

	let { blocks, windowHours, trailingFreeHours, colors }: Props = $props();

	// Under this share a title truncates to an ellipsis, which reads as a rendering
	// fault rather than as a short block. The tooltip still names it.
	const LABEL_MIN_SHARE = 0.07;

	// Floating-point dust, not free time: the optimizer's own hours rarely sum to the
	// window exactly, and a 1e-12 segment is a tooltip nobody can hit.
	const FREE_EPSILON = 1e-6;

	const share = (hours: number) => hours / windowHours;
	const width = (hours: number) => `width: ${share(hours) * 100}%`;
</script>

<div class="flex h-12 w-full overflow-hidden rounded-lg border">
	{#each blocks as block (block.start)}
		<div
			class="flex min-w-0 items-center justify-center border-r border-series-ink/40 last:border-r-0"
			style="{width(block.hours)}; background-color: {colors.colorOf(block.taskId)}"
			title={m.energy_block_tooltip({
				title: block.title,
				start: formatOffset(block.start),
				end: formatOffset(block.start + block.hours),
				duration: formatDuration(block.hours),
			})}
		>
			{#if share(block.hours) > LABEL_MIN_SHARE}
				<!-- series-ink, not ty-primary: the ink is paired with the fill, which
				     each theme's own text colour is not. Capitalized like the task list
				     — one title, one casing. -->
				<span class="truncate px-box-3xs text-xs font-medium capitalize text-series-ink">
					{block.title}
				</span>
			{/if}
		</div>
	{/each}
	{#if trailingFreeHours > FREE_EPSILON}
		<div
			class="flex min-w-0 items-center justify-center bg-transparent"
			style={width(trailingFreeHours)}
			title={m.energy_free_time_tooltip({
				duration: formatDuration(trailingFreeHours),
			})}
		>
			{#if share(trailingFreeHours) > LABEL_MIN_SHARE}
				<span class="truncate px-box-3xs text-xs text-ty-silent">{m.energy_free()}</span>
			{/if}
		</div>
	{/if}
</div>
<div class="mt-text-2xs flex justify-between text-2xs text-ty-silent">
	<span>{formatOffset(0)}</span>
	<span>{formatOffset(windowHours)}</span>
</div>
