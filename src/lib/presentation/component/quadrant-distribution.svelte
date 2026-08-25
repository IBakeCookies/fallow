<script lang="ts">
	/* How the range's days split across the four day profiles: one stacked bar, then
	   a legend that repeats every profile — including the ones with no days, which is
	   why the legend and the bar are two separate loops.

	   Every colour is a token read as a raw `var()` off the plain `:root` properties
	   in base.css, not a `--color-*` @theme alias: the aliases are tree-shaken to the
	   names Tailwind's scanner literally sees, and these are named from JS. Same
	   rationale as `series-color.ts`. */

	import * as m from '$lib/paraglide/messages.js';
	import type { DailyQuadrant } from '$lib/business/model/metric/calculation';

	interface Props {
		counts: Record<DailyQuadrant, number>;
	}

	let { counts }: Props = $props();

	// The bar's 100% is the days that HAVE a profile, which is exactly what `counts`
	// sums to: a day booking no hours has no profile and is counted nowhere, so the
	// range's day count would understate every share. Derived here and not taken as
	// a prop, because a `total` disagreeing with `counts` draws segments that miss
	// 100% — "Segments tile the bar" then pins a shape rather than a caller.
	const total = $derived(Object.values(counts).reduce((sum, count) => sum + count, 0));

	const QUADRANTS: { key: DailyQuadrant; label: string; color: string }[] = [
		{
			key: 'flow',
			label: m.quadrant_flow(),
			color: 'var(--flow)',
		},
		{
			key: 'cruise',
			label: m.quadrant_cruise(),
			color: 'var(--info)',
		},
		{
			// Not `--warning`, the token the name asks for: `--flow` is an amber domain
			// accent and so is `--warning`, in base.css and in most of themes.css, which
			// left two of the four segments the same colour (identical on a dozen themes).
			key: 'grind',
			label: m.quadrant_grind(),
			color: 'var(--danger)',
		},
		{
			key: 'routine',
			label: m.quadrant_routine(),
			color: 'var(--series-rest)',
		},
	];

	const shareLabel = (label: string, count: number) =>
		count === 1
			? m.ana_quadrant_count_one({
					label,
				})
			: m.ana_quadrant_count_other({
					label,
					count,
				});
</script>

<div class="mt-text-md flex h-3 w-full gap-text-3xs overflow-hidden rounded-full">
	{#each QUADRANTS as quadrant (quadrant.key)}
		{#if counts[quadrant.key] > 0}
			<div
				style="width: {(counts[quadrant.key] / total) * 100}%; background: {quadrant.color}"
				title={shareLabel(quadrant.label, counts[quadrant.key])}
			></div>
		{/if}
	{/each}
</div>

<div class="mt-text-sm flex flex-wrap gap-x-grid-lg gap-y-grid-2xs">
	{#each QUADRANTS as quadrant (quadrant.key)}
		<div class="flex items-center gap-grid-2xs text-xs">
			<span class="h-2 w-2 rounded-full" style="background: {quadrant.color}"></span>
			<span class="text-ty-secondary">{quadrant.label}</span>
			<span class="font-medium text-ty-primary" style="font-variant-numeric: tabular-nums">
				{counts[quadrant.key]}
			</span>
		</div>
	{/each}
</div>
