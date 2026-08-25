<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import QuadrantDistribution from '$lib/presentation/component/quadrant-distribution.svelte';

	const { Story } = defineMeta({
		title: 'Component/Quadrant Distribution',
		component: QuadrantDistribution,
		tags: ['autodocs'],
		args: {
			counts: {
				flow: 9,
				cruise: 6,
				grind: 3,
				routine: 4,
			},
		},
	});
</script>

<Story name="All four profiles">
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- The invariant /analytics leans on: a day whose plan books no hours has no
     profile and `countQuadrants` counts it nowhere, so the bar's 100% is the SUM
     of the counts and not the days on record — here 11 profiled days out of a longer
     range. Structural since the sum moved inside: nothing a caller passes can put the
     denominator out of step with the segments. -->
<Story
	name="Segments tile the bar"
	args={{
		counts: {
			flow: 5,
			cruise: 3,
			grind: 2,
			routine: 1,
		},
	}}
	play={async ({ canvasElement }) => {
		const widths = [...canvasElement.querySelectorAll('div[title]')].map((segment) =>
			Number.parseFloat((segment as HTMLElement).style.width),
		);

		await expect(widths).toHaveLength(4);
		// Loose only because the CSSOM rounds each width to 5dp; a denominator counting
		// the range's days rather than its profiled ones misses by tens of points.
		await expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 3);
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- One profile fills the bar, and the other three still appear in the legend at 0:
     the reader has to be able to see which profiles exist, not only which they hit -->
<Story
	name="One profile only"
	args={{
		counts: {
			flow: 0,
			cruise: 0,
			grind: 7,
			routine: 0,
		},
	}}
	play={async ({ canvas, canvasElement }) => {
		// Every profile appears in the legend, days or not
		for (const label of ['Flow Zone', 'Cruise', 'Grind Mode', 'Routine']) {
			await expect(canvas.getByText(label)).toBeInTheDocument();
		}

		// Only the profile with days gets a bar segment — a zero-width segment
		// would be invisible but still a hover target
		const segments = canvasElement.querySelectorAll('div[title]');
		await expect(segments).toHaveLength(1);
		await expect(segments[0].getAttribute('title')).toBe('Grind Mode: 7 days');
		await expect(segments[0].getAttribute('style')).toContain('width: 100%');
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- A single day per profile: the count copy goes singular -->
<Story
	name="One day each"
	args={{
		counts: {
			flow: 1,
			cruise: 1,
			grind: 1,
			routine: 1,
		},
	}}
	play={async ({ canvasElement }) => {
		// Each segment is titled with its share, singular here, and a quarter wide
		const segments = [...canvasElement.querySelectorAll('div[title]')];

		await expect(segments.map((segment) => segment.getAttribute('title'))).toEqual([
			'Flow Zone: 1 day',
			'Cruise: 1 day',
			'Grind Mode: 1 day',
			'Routine: 1 day',
		]);

		for (const segment of segments) {
			await expect(segment.getAttribute('style')).toContain('width: 25%');
		}
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>

<!-- No day has a profile yet: an empty bar, a legend of zeros, and no division by
     `total` reaching the width -->
<Story
	name="No days"
	args={{
		counts: {
			flow: 0,
			cruise: 0,
			grind: 0,
			routine: 0,
		},
	}}
	play={async ({ canvas, canvasElement }) => {
		// No segment reaches the `/ total` division, which would be `width: NaN%`
		await expect(canvasElement.querySelectorAll('div[title]')).toHaveLength(0);
		await expect(canvas.getByText('Flow Zone')).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
			<QuadrantDistribution {...args} />
		</div>
	{/snippet}
</Story>
