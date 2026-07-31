<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { EvaluatedBlock } from '$lib/business/model/zenith-energy';
	import PlanScheduleList from '$lib/presentation/component/plan-schedule-list.svelte';
	import { seriesColors } from '$lib/presentation/utils/series-color';

	const block = (
		taskId: number | null,
		title: string,
		start: number,
		hours: number,
		output = 0,
	): EvaluatedBlock => ({
		taskId,
		title,
		start,
		hours,
		output,
		cogAfter: 0.6,
		physAfter: 0.7,
	});

	const colors = seriesColors([1, 2, 3]);

	const { Story } = defineMeta({
		title: 'Component/Plan Schedule List',
		component: PlanScheduleList,
		tags: ['autodocs'],
		args: {
			windowHours: 8,
			trailingFreeHours: 0,
			plannedHours: 8,
			colors,
			locale: 'en-US',
		},
	});
</script>

<!-- The schedule behind the timeline bar: what to run, when, and what it is worth -->
<Story
	name="A planned day"
	args={{
		blocks: [
			block(1, 'boxing', 0, 2.25, 3.4),
			block(null, 'rest', 2.25, 0.75),
			block(2, 'writing', 3, 3, 5.1),
			block(3, 'inbox', 6, 2, 1.2),
		],
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>

<!-- The optimizer stopped early: the tail is free time, from where the plan ended -->
<Story
	name="Stopping early"
	args={{
		blocks: [
			block(1, 'boxing', 0, 2, 3.4),
			block(null, 'rest', 2, 0.5),
			block(2, 'writing', 2.5, 2.5, 4),
		],
		plannedHours: 5,
		trailingFreeHours: 3,
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>

<!-- Free time is worth more than any task's output, so the optimizer planned nothing -->
<Story
	name="Nothing scheduled"
	args={{
		blocks: [],
		plannedHours: 0,
		trailingFreeHours: 0,
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>
