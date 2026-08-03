<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
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
<Story
	name="Week"
	play={async ({ args, canvas, canvasElement }) => {
		// The aria-label is the plot's only accessible name
		await expect(
			canvas.getByRole('img', {
				name: args.ariaLabel,
			}),
		).toBeInTheDocument();

		// 7 slots, 6 bars: Tuesday (no data) draws nothing, Sunday (0%) keeps a
		// 2px stub sitting on the baseline at 12 + 202 = 214
		const bars = canvasElement.querySelectorAll('path.fill-brand');
		await expect(bars).toHaveLength(6);
		const baseline = bars[1].getAttribute('d')?.match(/^M[\d.]+,([\d.]+)/)?.[1];
		await expect(Number(baseline)).toBeCloseTo(214, 0);

		// Every slot is a full-height hover target, data or not
		const slots = canvasElement.querySelectorAll('rect');
		await expect(slots).toHaveLength(7);
		await expect(slots[0].getAttribute('height')).toBe('202');

		// The tooltip carries the rate where there is one and "no data" where not
		await expect(slots[0].querySelector('title')?.textContent).toBe(
			'Sat, Jul 25 — 80% · 3/4 tasks done',
		);

		await expect(slots[3].querySelector('title')?.textContent).toBe('Tue, Jul 28 — no data');
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
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
	play={async ({ canvasElement }) => {
		// Only the labels the axis asked for are printed
		const labels = [...canvasElement.querySelectorAll('text')].map((node) =>
			node.textContent?.trim(),
		);

		await expect(labels).toContain('Jul 1');
		await expect(labels).toContain('Jul 6');
		await expect(labels).not.toContain('Jul 2');
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
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
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
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
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
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
	play={async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll('path.fill-brand')).toHaveLength(0);
		await expect(canvasElement.querySelectorAll('rect')).toHaveLength(0);

		// The percentage axis stays, so the plot reads as empty rather than broken
		const ticks = [...canvasElement.querySelectorAll('text')].map((node) =>
			node.textContent?.trim(),
		);

		await expect(ticks).toEqual(['0', '25', '50', '75', '100']);
	}}
>
	{#snippet template(args)}
		<div class="card-shell max-w-3xl rounded-xl p-box-lg">
			<CompletionBarChart {...args} />
		</div>
	{/snippet}
</Story>
