<script lang="ts">
	/* One calibrated parameter over the days its fit was recorded (MATH.md §12) —
	   the sparkline beside each row of the "Your model" card.

	   The DEFAULT is part of the drawn range, and drawn: auto-scaling to the data
	   alone turns a fit that has barely moved into a dramatic climb, and there is
	   no axis here to say otherwise. Dashed rather than a second hue, the way
	   `energy-chart.svelte` separates its two lines. */

	interface Props {
		/** Ascending by recorded day; at least two, or the caller renders nothing */
		values: number[];
		defaultValue: number;
		/** An <svg role="img"> has no other accessible name */
		ariaLabel: string;
	}

	let { values, defaultValue, ariaLabel }: Props = $props();

	const CHART = {
		w: 64,
		h: 18,
		pad: 2,
	};

	const scale = $derived.by(() => {
		const low = Math.min(defaultValue, ...values);
		const high = Math.max(defaultValue, ...values);
		const span = high - low;
		const plotH = CHART.h - 2 * CHART.pad;

		// A fit that never moved off its default has zero span: pin it to the middle
		// rather than dividing by it, which would draw every y as NaN.
		return (value: number) =>
			span > 0 ? CHART.pad + (1 - (value - low) / span) * plotH : CHART.h / 2;
	});

	const xAt = $derived(
		(index: number) => CHART.pad + (index / (values.length - 1)) * (CHART.w - 2 * CHART.pad),
	);

	const path = $derived(
		values
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${scale(v).toFixed(1)}`)
			.join(''),
	);

	const defaultY = $derived(scale(defaultValue).toFixed(1));
</script>

<svg
	viewBox="0 0 {CHART.w} {CHART.h}"
	class="h-4.5 w-16 shrink-0"
	role="img"
	aria-label={ariaLabel}
>
	<line
		x1={CHART.pad}
		x2={CHART.w - CHART.pad}
		y1={defaultY}
		y2={defaultY}
		class="stroke-line-strong"
		stroke-width="1"
		stroke-dasharray="3 2"
	/>
	<path d={path} fill="none" stroke-width="1.5" stroke-linejoin="round" class="stroke-brand" />
</svg>
