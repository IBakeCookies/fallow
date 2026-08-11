<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TrajectoryPoint } from '$lib/business/model/zenith-energy';

	interface Props {
		trajectory: TrajectoryPoint[];
		windowHours: number;
	}

	let { trajectory, windowHours }: Props = $props();

	// The viewBox is in real CSS pixels, so type and strokes are one size at every
	// card width — true only while the measured wrapper stays padding-free:
	// `clientWidth` counts padding, the `w-full` svg does not.
	let width = $state(720);
	const height = $derived(Math.min(300, Math.max(180, width * 0.26)));

	const PAD_L = 30;
	const PAD_R = 10;
	const PAD_T = 12;
	const PAD_B = 22;
	const plotW = $derived(width - PAD_L - PAD_R);
	const plotH = $derived(height - PAD_T - PAD_B);

	const xAt = (t: number) => PAD_L + (windowHours > 0 ? (t / windowHours) * plotW : 0);
	const yAt = (v: number) => PAD_T + (1 - v) * plotH;

	const seriesPath = (pick: (p: TrajectoryPoint) => number) =>
		trajectory
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.t).toFixed(1)},${yAt(pick(p)).toFixed(1)}`)
			.join('');

	const cogPath = $derived(seriesPath((p) => p.cog));
	const physPath = $derived(seriesPath((p) => p.phys));
	const maxRate = $derived(Math.max(...trajectory.map((p) => p.rate), 1e-9));
	const ratePath = $derived.by(() => {
		if (trajectory.length === 0) return '';

		const line = seriesPath((p) => p.rate / maxRate);
		const last = trajectory[trajectory.length - 1];

		return `${line}L${xAt(last.t).toFixed(1)},${yAt(0).toFixed(1)}L${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}Z`;
	});
	// The percentage axis is the two reservoirs'. The output area is NOT — it is
	// scaled to its own peak (`rate / maxRate`), which is why its legend says so.
	const ENERGY_TICKS = [0, 0.5, 1];
	const hourTicks = $derived.by(() => {
		// One label per ~44px of plot, so a narrow axis thins out instead of
		// overprinting its own numbers.
		const step = Math.max(1, Math.ceil(windowHours / Math.max(1, Math.floor(plotW / 44))));
		const ticks = [];
		for (let h = 0; h <= windowHours; h += step) ticks.push(h);

		return ticks;
	});
</script>

<div class="mt-text-md" bind:clientWidth={width}>
	<svg
		viewBox="0 0 {width} {height}"
		style="height: {height}px"
		class="w-full"
		role="img"
		aria-label={m.energy_chart_aria()}
	>
		<!-- The fill opacity here must stay in step with the legend swatch below. -->
		<path d={ratePath} class="fill-brand/20" />
		{#each ENERGY_TICKS as v (v)}
			<line x1={PAD_L} y1={yAt(v)} x2={PAD_L + plotW} y2={yAt(v)} class="stroke-line-soft" />
			<text x={PAD_L - 6} y={yAt(v) + 3} class="fill-ty-silent" font-size="9" text-anchor="end">
				{v * 100}%
			</text>
		{/each}
		{#each hourTicks as h (h)}
			<line x1={xAt(h)} y1={PAD_T} x2={xAt(h)} y2={PAD_T + plotH} class="stroke-line-soft" />
			<text x={xAt(h)} y={height - 6} class="fill-ty-silent" font-size="9" text-anchor="middle">
				{h}h
			</text>
		{/each}
		<line x1={PAD_L} y1={yAt(0)} x2={PAD_L + plotW} y2={yAt(0)} class="stroke-line-strong" />
		<path d={cogPath} fill="none" stroke-width="1.8" class="stroke-mind" />
		<!-- `terminal` maps --mind and --body to two greens of the same lightness,
		     so the dash is the only thing separating the two lines there. -->
		<path d={physPath} fill="none" stroke-width="1.8" stroke-dasharray="5 3" class="stroke-body" />
	</svg>
</div>
<div class="mt-text-2xs flex flex-wrap gap-grid-md text-xs text-ty-silent">
	<span class="flex items-center gap-grid-2xs">
		<span class="h-0.5 w-4 rounded-full bg-mind"></span>
		{m.energy_legend_cognitive()}
	</span>
	<span class="flex items-center gap-grid-2xs">
		<!-- Why: STYLE.md, "Two namespaces" — a raw var() names the unprefixed one. -->
		<span
			class="h-0.5 w-4"
			style="background: repeating-linear-gradient(90deg, var(--body) 0 5px, transparent 5px 8px)"
		></span>
		{m.energy_legend_physical()}
	</span>
	<span class="flex items-center gap-grid-2xs">
		<span class="h-2 w-4 rounded-full bg-brand/20"></span>
		{m.energy_legend_output()}
	</span>
</div>
