<script lang="ts">
	/* The analytics completion-rate bars: one slot per day, or per month in the year
	   view. The geometry and the SVG lived in `analytics/+page.svelte`, which meant
	   the two cases that are easy to get wrong had no coverage — a 0% day keeps a
	   2px stub so it reads differently from an unrecorded one, and every slot gets a
	   full-height transparent hover target so a tooltip does not need pixel-perfect
	   aim at a 4px bar.

	   Colours are utility classes, not raw `var()`: STYLE.md's normal path, and the
	   same mechanism `energy-chart.svelte` uses. */

	import type { ChartPoint } from '$lib/presentation/utils/completion-chart-points';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		points: ChartPoint[];
		/** Names the whole plot — an <svg role="img"> has no other accessible name */
		ariaLabel: string;
	}

	let { points, ariaLabel }: Props = $props();

	// Fixed viewBox, responsive via width: 100%
	const CHART = {
		w: 800,
		h: 240,
		top: 12,
		right: 8,
		bottom: 26,
		left: 34,
	};
	const innerW = CHART.w - CHART.left - CHART.right;
	const innerH = CHART.h - CHART.top - CHART.bottom;
	const yTicks = [0, 25, 50, 75, 100];
	const yPos = (v: number) => CHART.top + innerH - (v / 100) * innerH;

	const bars = $derived.by(() => {
		const n = points.length;

		if (n === 0) return [];

		const slot = innerW / n;
		const barW = Math.min(24, slot * 0.65);

		return points.map((point, i) => {
			const slotX = CHART.left + i * slot;
			const x = slotX + (slot - barW) / 2;
			// A 0% day still gets a 2px stub so "0%" and "no data" read differently
			const h = point.value === null ? 0 : Math.max(2, (point.value / 100) * innerH);

			return {
				...point,
				slotX,
				slotW: slot,
				x,
				w: barW,
				y: CHART.top + innerH - h,
				h,
			};
		});
	});

	function barPath(x: number, y: number, w: number, h: number): string {
		// Rounded at the data end, square at the baseline
		const r = Math.min(4, h, w / 2);
		const bottom = y + h;

		return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${bottom} Z`;
	}
</script>

<svg viewBox="0 0 {CHART.w} {CHART.h}" class="mt-text-md w-full" role="img" aria-label={ariaLabel}>
	{#each yTicks as tick (tick)}
		<line
			x1={CHART.left}
			x2={CHART.w - CHART.right}
			y1={yPos(tick)}
			y2={yPos(tick)}
			class="stroke-line-soft"
			stroke-width="1"
		/>
		<text
			x={CHART.left - 8}
			y={yPos(tick) + 3}
			text-anchor="end"
			class="fill-ty-silent"
			font-size="10"
			style="font-variant-numeric: tabular-nums"
		>
			{tick}
		</text>
	{/each}

	{#each bars as bar, i (i)}
		{#if bar.value !== null}
			<path d={barPath(bar.x, bar.y, bar.w, bar.h)} class="fill-brand">
				<title>{bar.full} — {bar.value}% · {bar.sub}</title>
			</path>
		{/if}
		{#if bar.showLabel}
			<text
				x={bar.slotX + bar.slotW / 2}
				y={CHART.h - 8}
				text-anchor="middle"
				class="fill-ty-silent"
				font-size="10"
			>
				{bar.label}
			</text>
		{/if}
		<!-- full-slot hover target so tooltips don't require pixel-perfect aim. The
		     empty case says "no data" from here rather than reusing `sub`, which
		     happens to hold the same words: a caller passing an empty `sub` would
		     otherwise leave a slot whose only tooltip is a dangling dash. -->
		<rect x={bar.slotX} y={CHART.top} width={bar.slotW} height={innerH} fill="transparent">
			<title
				>{bar.full} — {bar.value === null ? m.ana_no_data() : `${bar.value}% · ${bar.sub}`}</title
			>
		</rect>
	{/each}
</svg>
