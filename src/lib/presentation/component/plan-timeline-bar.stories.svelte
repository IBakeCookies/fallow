<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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

<!-- A worked day: two sessions around a break, planned to the end of the window -->
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
		trailingFreeHours: 0,
		colors,
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
/>
