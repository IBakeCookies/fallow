<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ChartPoint } from '$lib/presentation/utils/completion-chart-points';
	import CompletionBarChart from '$lib/presentation/component/completion-bar-chart.svelte';

	const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	/** `null` is an unrecorded slot; 0 is a day that was planned and went nowhere. */
	const week = (rates: (number | null)[]): ChartPoint[] =>
		rates.map((value, i) => ({
			label: WEEKDAYS[i],
			full: `${WEEKDAYS[i]}, Jul ${25 + i}`,
			value,
			sub: value === null ? 'no data' : `${Math.round(value / 25)}/4 tasks done`,
			showLabel: true,
		}));

	const days = (count: number): ChartPoint[] =>
		Array.from(
			{
				length: count,
			},
			(_, i) => ({
				label: `Jul ${i + 1}`,
				full: `Jul ${i + 1}`,
				value: 30 + ((i * 17) % 70),
				sub: '2/4 tasks done',
				showLabel: i % 5 === 0,
			}),
		);

	const { Story } = defineMeta({
		title: 'Component/Completion Bar Chart',
		component: CompletionBarChart,
		tags: ['autodocs'],
		args: {
			points: week([80, 0, 55, null, 100, 40, 65]),
			ariaLabel: 'Completion rate over the last 7 days',
		},
	});
</script>

<!-- The week view, with both of the cases that read alike if the geometry is wrong:
     Sunday is a real 0% (a 2px stub) and Tuesday is unrecorded (nothing at all) -->
<Story name="Week">
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<CompletionBarChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- 30 slots: the bars narrow to the 65%-of-slot rule and only every fifth label
     is drawn, which is the width this axis was tuned for -->
<Story
	name="Month"
	args={{
		points: days(30),
		ariaLabel: 'Completion rate over the last 30 days',
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<CompletionBarChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- Wide slots cap the bar at 24px rather than letting it become a block -->
<Story
	name="Two slots"
	args={{
		points: week([80, 45]).slice(0, 2),
		ariaLabel: 'Completion rate',
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<CompletionBarChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- Nothing recorded anywhere: the axis stays, so the plot reads as empty rather
     than broken -->
<Story
	name="No data in any slot"
	args={{
		points: week([null, null, null, null, null, null, null]),
		ariaLabel: 'Completion rate over the last 7 days',
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<CompletionBarChart {...args} />
		</div>
	{/snippet}
</Story>

<!-- No slots at all — the range has not resolved yet -->
<Story
	name="Empty"
	args={{
		points: [],
		ariaLabel: 'Completion rate',
	}}
>
	{#snippet template(args)}
		<div class="max-w-3xl rounded-xl border bg-surface-card p-box-lg backdrop-blur shadow-card">
			<CompletionBarChart {...args} />
		</div>
	{/snippet}
</Story>
