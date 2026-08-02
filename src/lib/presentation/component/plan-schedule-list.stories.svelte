<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
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

<!-- The schedule behind the timeline bar: what to run, when, and what it is worth.
     The 1e-9 tail is the optimizer's floating-point dust, not a free-time row. -->
<Story
	name="A planned day"
	args={{
		blocks: [
			block(1, 'boxing', 0, 2.25, 3.4),
			block(null, 'rest', 2.25, 0.75),
			block(2, 'writing', 3, 3, 5.1),
			block(3, 'inbox', 6, 2, 1.2),
		],
		trailingFreeHours: 1e-9,
	}}
	play={async ({ canvas }) => {
		// Offsets and a spelled-out length, not wall-clock times
		await expect(canvas.getByText('0h–2h 15m')).toBeVisible();
		await expect(canvas.getByText('3h–6h')).toBeVisible();
		await expect(canvas.getByText('3h')).toBeVisible();

		// Each task block's output, to two places
		await expect(canvas.getByText('3.40 out')).toBeVisible();
		await expect(canvas.getByText('5.10 out')).toBeVisible();

		// Rest earns no output: it is named instead
		await expect(canvas.getByText('recovery')).toBeVisible();

		// The dust tail renders no free-time row of zeroes
		expect(canvas.queryByText('Free time')).not.toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>

<!-- The optimizer stopped early: the tail is free time, from where the plan ended
     — not from the last block, which differ when the plan leaves an unscheduled gap -->
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
	play={async ({ canvas }) => {
		await expect(canvas.getByText('5h–8h')).toBeVisible();
		await expect(canvas.getByText('Free time')).toBeVisible();
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>

<!-- Free time is worth more than any task's output, so the optimizer planned
     nothing — explained, rather than rendered as an empty list -->
<Story
	name="Nothing scheduled"
	args={{
		blocks: [],
		plannedHours: 0,
		trailingFreeHours: 0,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText(/Nothing scheduled/)).toBeVisible();
		expect(canvas.queryByRole('listitem')).not.toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>

<!-- The decimal separator follows the reader, like every date beside it -->
<Story
	name="German locale"
	args={{
		blocks: [
			block(1, 'boxing', 0, 2.25, 3.4),
			block(null, 'rest', 2.25, 0.75),
			block(2, 'writing', 3, 3, 5.1),
			block(3, 'inbox', 6, 2, 1.2),
		],
		locale: 'de-DE',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('3,40 out')).toBeVisible();
	}}
>
	{#snippet template(args)}
		<div class="max-w-2xl"><PlanScheduleList {...args} /></div>
	{/snippet}
</Story>
