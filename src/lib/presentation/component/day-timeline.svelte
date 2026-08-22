<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { BAND_BAR_CLASS, bandLabel } from '$lib/presentation/utils/band';
	import type { DayTimeline } from '$lib/presentation/utils/day-timeline';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	let { startLabel, totalHours, minimumBlockWidths, blocks }: DayTimeline = $props();

	const share = (hours: number) => hours / totalHours;
</script>

<section class="card-shell px-box-md py-box-sm sm:px-box-xl">
	<div class="flex items-baseline justify-between gap-grid-xs">
		<h3 class="shrink-0 text-xs font-semibold text-ty-secondary uppercase tracking-wider">
			{m.day_timeline_title()}
		</h3>
		{#if startLabel}
			<span class="text-xs text-ty-silent tabular-nums">
				{m.day_timeline_start({
					start: startLabel,
				})}
			</span>
		{/if}
	</div>
	{#if blocks.length === 0}
		<p class="mt-text-md text-sm text-ty-secondary">{m.day_timeline_empty()}</p>
	{:else}
		<!-- Inside the strip: the legend names marks, and a day with none reads a
		     sentence about nothing. -->
		<p class="mt-text-2xs text-xs text-ty-silent">{m.day_timeline_legend()}</p>
		<!-- The strip scrolls sideways in its own container and the DOCUMENT does not —
		     the ledger's pattern (task-list-card.svelte). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- a scrollable region has to be
		     scrollable by keyboard, and a block is not focusable -->
		<div class="nice-scrollbar mt-text-md overflow-x-auto" tabindex="0">
			<!-- The floor is the TRACK's width, so every block keeps its share of the day and
			     the strip grows rather than a block shrinking below reading. 8rem is the widest
			     line a block stacks at `text-2xs` — the flow sentence, measured at 111px — plus
			     the block's own 14px inset, so a 15-minute allocation still reads whole. -->
			<div
				class="relative h-24"
				style="width: max(100%, calc(var(--spacing-day-block) * {minimumBlockWidths}))"
			>
				{#each blocks as block (block.id)}
					{@const label = bandLabel(block.band)}
					<div
						class="absolute inset-y-0 flex flex-col justify-between gap-text-2xs rounded-md border bg-surface-inset px-box-3xs py-text-2xs"
						style="left: {share(block.startOffset) * 100}%; width: {share(block.hours) * 100}%"
					>
						<p class="truncate text-2xs text-ty-primary">
							<span class="text-ty-secondary">#{block.position}</span>
							{block.title}
						</p>
						<p class="truncate text-2xs text-ty-secondary tabular-nums">
							{formatDuration(block.hours)}
						</p>
						<!-- How far the allocation gets toward flow arrival: the band's own fill,
						     so the strip and the metric rows colour the same reading. -->
						<div class="h-1 w-full rounded-full bg-surface-card">
							<div
								class="h-full rounded-full {BAND_BAR_CLASS[block.band]}"
								style="width: {Math.min(1, block.hours / block.flowHours) * 100}%"
							></div>
						</div>
						<p class="truncate text-2xs text-ty-secondary">
							{block.band === 'success'
								? m.day_timeline_flow_reached({
										duration: formatDuration(block.flowHours),
									})
								: m.day_timeline_flow_short({
										duration: formatDuration(block.flowHours - block.hours),
									})}
						</p>
						<!-- Colour is otherwise the only thing separating the two bands (WCAG 1.4.1). -->
						{#if label}
							<span class="sr-only">{label}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>
