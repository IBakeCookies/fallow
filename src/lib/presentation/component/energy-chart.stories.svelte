<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, waitFor } from 'storybook/test';
	import type { TrajectoryPoint } from '$lib/business/model/zenith-energy';
	import EnergyChart from '$lib/presentation/component/energy-chart.svelte';

	/* A plausible reservoir trace rather than a real solve: work, one rest
	   block that lets both reservoirs recover, then work again. */
	function buildTrajectory(windowHours: number): TrajectoryPoint[] {
		const samples = windowHours * 4;
		let cog = 1;
		let phys = 1;

		return Array.from(
			{
				length: samples + 1,
			},
			(_, index) => {
				const t = index / 4;
				const resting = t >= 5 && t < 6;
				const cognitiveDemand = resting ? 0 : 0.8;
				const physicalDemand = resting ? 0 : 0.3;

				cog += (-0.09 * cognitiveDemand * cog + 0.35 * (1 - cognitiveDemand) * (1 - cog)) / 4;
				phys += (-0.05 * physicalDemand * phys + 0.4 * (1 - physicalDemand) * (1 - phys)) / 4;

				return {
					t,
					cog,
					phys,
					rate: resting ? 0 : cog ** 0.8 * phys ** 0.3,
					taskId: resting ? null : 1,
				};
			},
		);
	}

	const { Story } = defineMeta({
		title: 'Component/Energy Chart',
		component: EnergyChart,
		tags: ['autodocs'],
		args: {
			trajectory: buildTrajectory(12),
			windowHours: 12,
		},
	});
</script>

<Story
	name="Twelve hour window"
	play={async ({ canvas, canvasElement }) => {
		// Both reservoirs are fractions of capacity, so the energy axis is labelled
		// as a percentage — unlabelled, the only readable axis was time
		for (const label of ['0%', '50%', '100%']) {
			await expect(canvas.getByText(label)).toBeInTheDocument();
		}

		// `terminal` maps --mind and --body to two greens of the same lightness, so
		// one of the two lines must be dashed as well as coloured
		const svg = canvasElement.querySelector('svg');
		await expect(svg?.querySelectorAll('path[stroke-dasharray]')).toHaveLength(1);
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl p-box-xl">
			<EnergyChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- The hour ticks thin out to fit: one label per ~44px of plot, so a 16 h day
     steps by 2 at this width -->

<Story
	name="Sixteen hour window"
	args={{
		trajectory: buildTrajectory(16),
		windowHours: 16,
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl p-box-xl">
			<EnergyChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- The viewBox is measured in CSS pixels, so at a phone width the plot keeps one
     unit per pixel and the 9px axis type renders at 9px — a fixed viewBox scaled
     to the element squashed both -->
<Story
	name="Phone width"
	play={async ({ canvasElement }) => {
		const svg = canvasElement.querySelector('svg');

		await waitFor(() => {
			const viewBoxWidth = Number(svg?.getAttribute('viewBox')?.split(' ')[2]);
			expect(viewBoxWidth).toBeCloseTo(svg?.getBoundingClientRect().width ?? 0, 0);
			expect(svg?.querySelector('text')?.getBoundingClientRect().height ?? 0).toBeGreaterThan(7);
		});
	}}
>
	{#snippet template(args)}
		<div style="width: 360px">
			<EnergyChart {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Nothing planned"
	args={{
		trajectory: [],
		windowHours: 8,
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl p-box-xl">
			<EnergyChart {...args} />
		</div>
	{/snippet}
</Story>
