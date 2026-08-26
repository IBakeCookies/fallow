<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { EvaluatedBlock } from '$lib/business/model/zenith-energy';
	import PlanTimelineBar from '$lib/presentation/component/plan-timeline-bar.svelte';
	import { seriesColors } from '$lib/presentation/utils/series-color';

	const block = (
		taskId: number | null,
		title: string,
		start: number,
		hours: number,
	): EvaluatedBlock => ({
		taskId,
		title,
		start,
		hours,
		output: 2.4,
		cogAfter: 0.6,
		physAfter: 0.7,
	});

	const colors = seriesColors([1, 2, 3]);

	const { Story } = defineMeta({
		title: 'Component/Plan Timeline Bar',
		component: PlanTimelineBar,
		tags: ['autodocs'],
	});
</script>

<!-- A worked day: two sessions around a break, planned to the end of the window.
     The 1e-9 tail is the optimizer's floating-point dust, not free time. -->
<Story
	name="Full window"
	args={{
		blocks: [
			block(1, 'boxing', 0, 2.25),
			block(null, 'rest', 2.25, 0.75),
			block(2, 'writing', 3, 3),
			block(3, 'inbox', 6, 2),
		],
		windowHours: 8,
		trailingFreeHours: 1e-9,
		colors,
	}}
	play={async ({ canvas }) => {
		// A block's width IS its share of the day window, named by offsets and duration
		await expect(canvas.getByTitle('boxing — 0h–2h 15m (2h 15m)')).toHaveAttribute(
			'style',
			expect.stringContaining('width: 28.125%'),
		);

		await expect(canvas.getByTitle('writing — 3h–6h (3h)')).toHaveAttribute(
			'style',
			expect.stringContaining('width: 37.5%'),
		);

		// Rest takes the rest colour, a lighter fill than worked time
		await expect(canvas.getByTitle(/^rest/)).toHaveAttribute(
			'style',
			expect.stringContaining('var(--series-rest)'),
		);

		await expect(canvas.getByTitle(/boxing/)).toHaveAttribute(
			'style',
			expect.stringContaining('var(--series-1)'),
		);

		// The axis is elapsed hours from the start of the window, not wall-clock times
		await expect(canvas.getByText('0h')).toBeVisible();
		await expect(canvas.getByText('8h')).toBeVisible();

		// The dust tail draws no free-time segment nobody could see or hover
		expect(canvas.queryByTitle(/Free time/)).not.toBeInTheDocument();
	}}
/>

<!-- The optimizer stopped before the day did: the tail is free time, unfilled -->
<Story
	name="With free time"
	args={{
		blocks: [block(1, 'boxing', 0, 2), block(null, 'rest', 2, 0.5), block(2, 'writing', 2.5, 2.5)],
		windowHours: 8,
		trailingFreeHours: 3,
		colors,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByTitle('Free time — 3h')).toBeInTheDocument();
		await expect(canvas.getByText('free')).toBeVisible();
	}}
/>

<!-- Blocks under ~7% of the day carry no label — it would render as an ellipsis.
     The tooltip still names them. -->
<Story
	name="Slivers"
	args={{
		blocks: [
			block(1, 'boxing', 0, 0.25),
			block(2, 'writing', 0.25, 7.25),
			block(3, 'inbox', 7.5, 0.5),
		],
		windowHours: 8,
		trailingFreeHours: 0,
		colors,
	}}
	play={async ({ canvas }) => {
		expect(canvas.queryByText('boxing')).not.toBeInTheDocument();
		expect(canvas.queryByText('inbox')).not.toBeInTheDocument();
		await expect(canvas.getByTitle(/inbox/)).toBeInTheDocument();
		await expect(canvas.getByText('writing')).toBeVisible();
	}}
/>
