<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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

<Story name="Twelve hour window">
	{#snippet template(args)}
		<div class="max-w-3xl rounded-2xl border bg-surface-card p-box-xl backdrop-blur shadow-card">
			<EnergyChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- Past 14 h the hour ticks step by 2 instead of 1 -->
<Story
	name="Sixteen hour window"
	args={{
		trajectory: buildTrajectory(16),
		windowHours: 16,
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-2xl border bg-surface-card p-box-xl backdrop-blur shadow-card">
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
		<div class="max-w-3xl rounded-2xl border bg-surface-card p-box-xl backdrop-blur shadow-card">
			<EnergyChart {...args} />
		</div>
	{/snippet}
</Story>
