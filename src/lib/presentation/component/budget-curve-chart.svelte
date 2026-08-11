<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { BudgetCurve } from '$lib/business/model/zenith-energy';
	import { formatDuration } from '$lib/presentation/utils/duration-format';

	interface Props {
		curve: BudgetCurve;
		/** The window the day is set to now, marked so the reader can place themselves. */
		currentBudget: number;
	}

	let { curve, currentBudget }: Props = $props();

	// Same measured-viewBox rule as energy-chart.svelte: the viewBox is in real
	// CSS pixels, so axis type and stroke widths are one size at every card width.
	// Holds only while the measured wrapper stays padding-free.
	let width = $state(720);
	const height = $derived(Math.min(260, Math.max(160, width * 0.22)));

	const PAD_L = 34;
	const PAD_R = 10;
	const PAD_T = 12;
	const PAD_B = 22;
	const plotW = $derived(width - PAD_L - PAD_R);
	const plotH = $derived(height - PAD_T - PAD_B);

	// Break-even is 0 and NOT λ₀: `valuePerHour` already has the free time an extra
	// hour costs charged out of it, so a λ₀ line here would charge it twice — and
	// the two readings disagree by hours (MATH.md §8.12). The baseline below is the
	// comparison; λ₀ is reported as a price in the copy instead.
	const maxValue = $derived(Math.max(...curve.points.map((p) => p.valuePerHour), 1e-9) * 1.15);
	// `valuePerHour` cannot go below zero (it is the slope of a majorant of a
	// non-decreasing level), so the domain floor is headroom, not data: without it
	// break-even lands exactly on `PAD_T + plotH`, where every hour gridline ends,
	// and the line the whole chart is read against renders as the x-axis with the
	// post-knee tail lying on top of it.
	const floor = $derived(-maxValue * 0.12);
	const xAt = (b: number) => PAD_L + (b / curve.maxBudgetHours) * plotW;
	const yAt = (v: number) => PAD_T + (1 - (v - floor) / (maxValue - floor)) * plotH;

	// A STEP series, not a polyline. `valuePerHour` is not a sample of a smooth
	// function at `budgetHours` — it is the value of the whole lattice step
	// `(b − step, b]` (MATH.md §8.12). Interpolating between the samples invents
	// intermediate values the model never produced and, worse, puts the visual
	// zero-crossing one step RIGHT of `recommendedHours`: the segment from the
	// last positive point down to the first zero crosses at `knee + step`, beside
	// a "Suggested window" guide drawn at `knee`. Drawn as steps, the drop to zero
	// lands exactly on the guide, because the zero step BEGINS at `knee`.
	//
	// EVERY swept budget is drawn, the first included: its predecessor is the
	// do-nothing day (MATH.md §8.12), so it carries a measured marginal rather than
	// a zero standing in for a missing one — and it is the steepest step there is.
	// Its own step therefore begins at budget 0, on the y-axis.
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

	// A vertical guide, not a dot on the line: the recommendation names the whole
	// lattice step it ends, and the step series below draws the drop to zero
	// beginning exactly there.
	const recommendedX = $derived(
		curve.recommendedHours === null ? null : xAt(curve.recommendedHours),
	);

	// The reader's own window, when the sweep reached it. Past the cap there is no
	// honest place to draw it — clamping to the right edge would claim it sits at
	// `maxBudgetHours` — so the legend says so in words instead (docs/testing.md: the
	// bound is never silent).
	const isBudgetOnScale = $derived(currentBudget > 0 && currentBudget <= curve.maxBudgetHours);

	// The suggestion sentence is only true when there IS one: on the two null
	// branches nothing on this chart is "the suggested one", and on the
	// no-window-is-worth-working branch the whole series sits at zero, so a
	// screen reader would be told to look for a point above it that does not exist.
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
		const step = Math.max(1, Math.ceil(curve.maxBudgetHours / Math.max(1, Math.floor(plotW / 44))));
		const ticks = [];

		for (let h = step; h <= curve.maxBudgetHours; h += step) ticks.push(h);

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
		<!-- The window the day is set to now: quieter than the readings — it locates
		     the reader, it does not claim anything — but on the ink token, not on
		     `line-strong`. That resolves to `--border` (α 0.18–0.30 in every theme),
		     which at the default 1px under a 40%-duty dash is ~1.4:1 against the
		     card: a marker the reader has to hunt for is not a locator. -->
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

		<!-- Break-even. The one line the curve IS read against: at zero, another hour
		     of window adds exactly what the free time it costs was worth.

		     Drawn AFTER the curve, and DASHED, because past the knee `valuePerHour`
		     is exactly 0 and the two coincide for most of the width. Solid-under lost
		     the reference; solid-over lost the curve, so the tail read as a chart that
		     had simply stopped. A long dash keeps this reading as one continuous rule
		     while the brand stroke shows through the gaps — which is the honest
		     picture: the curve is not gone, it is resting on break-even. -->
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
			<!-- The dash pattern is the line's, so the swatch carries it too. A raw var()
			     names the unprefixed token (STYLE.md), never the --color-* alias. -->
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
		<!-- No swatch: there is no line to key. Off the scale the reader still needs
		     to know WHERE they are, or a chart with no locator reads as a bug. -->
		<span>
			{m.energy_curve_legend_now_offscale({
				hours: formatDuration(currentBudget),
				max: formatDuration(curve.maxBudgetHours),
			})}
		</span>
	{/if}
</div>
