<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { BudgetCurve } from '$lib/business/model/zenith-energy';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	interface Props {
		curve: BudgetCurve;
		currentBudget: number;
	}

	let { curve, currentBudget }: Props = $props();

	// The viewBox is in real CSS pixels, so axis type and stroke widths are one size
	// at every card width — holds only while the measured wrapper stays padding-free.
	let width = $state(720);
	const height = $derived(Math.min(260, Math.max(160, width * 0.22)));

	const PAD_L = 34;
	const PAD_R = 10;
	const PAD_T = 12;
	const PAD_B = 22;
	const plotW = $derived(width - PAD_L - PAD_R);
	const plotH = $derived(height - PAD_T - PAD_B);

	const maxValue = $derived(Math.max(...curve.points.map((p) => p.valuePerHour), 1e-9) * 1.15);
	// Headroom, not data: `valuePerHour` cannot go below zero, so without a floor
	// break-even lands on `PAD_T + plotH` and reads as the x-axis, tail on top of it.
	const floor = $derived(-maxValue * 0.12);
	const xAt = (b: number) => PAD_L + (b / curve.maxBudgetHours) * plotW;
	const yAt = (v: number) => PAD_T + (1 - (v - floor) / (maxValue - floor)) * plotH;

	// A STEP series, not a polyline: `valuePerHour` is the value of the whole lattice
	// step `(b − step, b]` (MATH.md §8.12), so interpolating would put the visual
	// zero-crossing one step RIGHT of the "Suggested window" guide drawn at `knee`.
	// The first point is drawn too, its step beginning at budget 0: its predecessor
	// is the do-nothing day, so it carries a measured marginal.
	const step = $derived(
		curve.points.length > 1 ? curve.points[1].budgetHours - curve.points[0].budgetHours : 0,
	);

	const curvePath = $derived(
		curve.points
			.map((p, i) => {
				const left = xAt(p.budgetHours - step).toFixed(1);
				const right = xAt(p.budgetHours).toFixed(1);
				const y = yAt(p.valuePerHour).toFixed(1);

				return `${i === 0 ? 'M' : 'L'}${left},${y}L${right},${y}`;
			})
			.join(''),
	);

	const recommendedX = $derived(
		curve.recommendedHours === null ? null : xAt(curve.recommendedHours),
	);

	// Past the cap there is no honest place to draw it — clamping to the right edge
	// would claim it sits at `maxBudgetHours` — so the legend says so in words.
	const isBudgetOnScale = $derived(currentBudget > 0 && currentBudget <= curve.maxBudgetHours);

	const ariaLabel = $derived.by(() => {
		const shape = m.energy_curve_chart_aria({
			max: formatDuration(curve.maxBudgetHours),
		});

		if (curve.recommendedHours === null) return shape;

		const suggested = m.energy_curve_chart_aria_recommended({
			hours: formatDuration(curve.recommendedHours),
		});

		return `${shape} ${suggested}`;
	});

	// One label per ~44px of plot, so a narrow axis thins out rather than
	// overprinting its own numbers.
	const hourTicks = $derived.by(() => {
		const tickStep = Math.max(
			1,
			Math.ceil(curve.maxBudgetHours / Math.max(1, Math.floor(plotW / 44))),
		);

		const ticks = [];

		for (let h = tickStep; h <= curve.maxBudgetHours; h += tickStep) ticks.push(h);

		return ticks;
	});
</script>

<div class="mt-text-md" bind:clientWidth={width}>
	<svg
		viewBox="0 0 {width} {height}"
		style="height: {height}px"
		class="w-full"
		role="img"
		aria-label={ariaLabel}
	>
		{#each hourTicks as h (h)}
			<line x1={xAt(h)} y1={PAD_T} x2={xAt(h)} y2={PAD_T + plotH} class="stroke-line-soft" />
			<text x={xAt(h)} y={height - 6} class="fill-ty-silent" font-size="9" text-anchor="middle">
				{h}h
			</text>
		{/each}
		<!-- On the ink token, not `line-strong`: that resolves to `--border`, which
		     under a dash is ~1.4:1 against the card (STYLE.md, the ink contrast budget). -->
		{#if isBudgetOnScale}
			<line
				x1={xAt(currentBudget)}
				y1={PAD_T}
				x2={xAt(currentBudget)}
				y2={PAD_T + plotH}
				class="stroke-ty-silent"
				stroke-width="1.5"
				stroke-dasharray="2 3"
			/>
		{/if}

		<path d={curvePath} fill="none" stroke-width="1.8" class="stroke-brand" />

		<!-- Break-even is 0, not λ₀: `valuePerHour` already charges out the free time an
		     extra hour costs, so a λ₀ line here would charge it twice (MATH.md §8.12).
		     Drawn AFTER the curve and DASHED: past the knee `valuePerHour` is exactly 0,
		     so the two coincide and only the gaps keep the brand stroke visible. -->
		<line
			x1={PAD_L}
			y1={yAt(0)}
			x2={PAD_L + plotW}
			y2={yAt(0)}
			class="stroke-info"
			stroke-width="1.5"
			stroke-dasharray="7 4"
		/>
		<text x={PAD_L - 6} y={yAt(0) + 3} class="fill-info-strong" font-size="9" text-anchor="end"
			>0</text
		>

		{#if recommendedX !== null}
			<line
				x1={recommendedX}
				y1={PAD_T}
				x2={recommendedX}
				y2={PAD_T + plotH}
				class="stroke-brand"
				stroke-width="1.5"
				stroke-dasharray="5 3"
			/>
		{/if}
	</svg>
</div>
<div class="mt-text-2xs flex flex-wrap gap-grid-md text-xs text-ty-silent">
	<span class="flex items-center gap-grid-2xs">
		<span class="h-0.5 w-4 rounded-full bg-brand"></span>
		{m.energy_curve_legend_value()}
	</span>
	<span class="flex items-center gap-grid-2xs">
		<span
			class="h-0.5 w-4"
			style="background: repeating-linear-gradient(90deg, var(--info) 0 7px, transparent 7px 11px)"
		></span>
		{m.energy_curve_legend_break_even()}
	</span>
	{#if curve.recommendedHours !== null}
		<span class="flex items-center gap-grid-2xs">
			<!-- A raw var() names the unprefixed token, never the --color-* alias (STYLE.md). -->
			<span
				class="h-0.5 w-4"
				style="background: repeating-linear-gradient(90deg, var(--brand) 0 5px, transparent 5px 8px)"
			></span>
			{m.energy_curve_legend_recommended()}
		</span>
	{/if}
	{#if isBudgetOnScale}
		<span class="flex items-center gap-grid-2xs">
			<span
				class="h-0.5 w-4"
				style="background: repeating-linear-gradient(90deg, var(--ty-silent) 0 2px, transparent 2px 5px)"
			></span>
			{m.energy_curve_legend_now({
				hours: formatDuration(currentBudget),
			})}
		</span>
	{:else if currentBudget > 0}
		<!-- Off the scale there is no line to key, but the reader still needs a locator. -->
		<span>
			{m.energy_curve_legend_now_offscale({
				hours: formatDuration(currentBudget),
				max: formatDuration(curve.maxBudgetHours),
			})}
		</span>
	{/if}
</div>
