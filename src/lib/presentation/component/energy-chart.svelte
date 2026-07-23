<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TrajectoryPoint } from '$lib/business/model/zenith-energy';

	interface Props {
		trajectory: TrajectoryPoint[];
		windowHours: number;
	}

	let { trajectory, windowHours }: Props = $props();

	const CHART_W = 720;
	const CHART_H = 190;
	const PAD_L = 10;
	const PAD_R = 10;
	const PAD_T = 12;
	const PAD_B = 22;
	const plotW = CHART_W - PAD_L - PAD_R;
	const plotH = CHART_H - PAD_T - PAD_B;

	const xAt = (t: number) => PAD_L + (windowHours > 0 ? (t / windowHours) * plotW : 0);
	const yAt = (v: number) => PAD_T + (1 - v) * plotH;

	function linePath(points: { x: number; y: number }[]): string {
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
			.join('');
	}

	const cogPath = $derived(linePath(trajectory.map((p) => ({ x: xAt(p.t), y: yAt(p.cog) }))));
	const physPath = $derived(linePath(trajectory.map((p) => ({ x: xAt(p.t), y: yAt(p.phys) }))));
	const maxRate = $derived(Math.max(...trajectory.map((p) => p.rate), 1e-9));
	const ratePath = $derived.by(() => {
		if (trajectory.length === 0) return '';
		const line = linePath(trajectory.map((p) => ({ x: xAt(p.t), y: yAt(p.rate / maxRate) })));
		const last = trajectory[trajectory.length - 1];
		return `${line}L${xAt(last.t).toFixed(1)},${yAt(0).toFixed(1)}L${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}Z`;
	});
	const hourTicks = $derived.by(() => {
		const stepH = windowHours > 14 ? 2 : 1;
		const ticks = [];
		for (let h = 0; h <= windowHours; h += stepH) ticks.push(h);
		return ticks;
	});
</script>

<svg
	viewBox="0 0 {CHART_W} {CHART_H}"
	class="mt-text-md w-full"
	role="img"
	aria-label={m.energy_chart_aria()}
>
	<path d={ratePath} fill="var(--color-brand)" opacity="0.18" />
	{#each hourTicks as h (h)}
		<line x1={xAt(h)} y1={PAD_T} x2={xAt(h)} y2={PAD_T + plotH} stroke="var(--color-line-soft)" />
		<text x={xAt(h)} y={CHART_H - 6} class="fill-ty-silent" font-size="9" text-anchor="middle">
			{h}h
		</text>
	{/each}
	<line
		x1={PAD_L}
		y1={yAt(0)}
		x2={PAD_L + plotW}
		y2={yAt(0)}
		stroke="var(--color-line-strong)"
	/>
	<path d={cogPath} fill="none" stroke="var(--color-mind)" stroke-width="1.8" />
	<path d={physPath} fill="none" stroke="var(--color-body)" stroke-width="1.8" />
</svg>
<div class="mt-text-2xs flex gap-grid-md text-xs text-ty-silent">
	<span class="flex items-center gap-grid-2xs">
		<span class="h-0.5 w-4 rounded bg-mind"></span>
		{m.energy_legend_cognitive()}
	</span>
	<span class="flex items-center gap-grid-2xs">
		<span class="h-0.5 w-4 rounded bg-body"></span>
		{m.energy_legend_physical()}
	</span>
	<span class="flex items-center gap-grid-2xs">
		<span class="h-2 w-4 rounded bg-brand/30"></span>
		{m.energy_legend_output()}
	</span>
</div>
