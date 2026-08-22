<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { Metric } from '$lib/presentation/type';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';

	/* The band is the banding policy's output (utils/band.ts) — the component owns
	   the colour and the screen-reader wording it renders from it. */
	const metrics: Metric[] = [
		// The four headline readings, rendered as a 2×2 tile grid — two banded, two
		// not, so the grid is exercised with both.
		{
			headline: true,
			label: 'Completion Rate',
			value: '45%',
			description: 'Priority-weighted progress through the plan.',
			band: 'neutral',
		},
		{
			headline: true,
			label: 'Flow Coverage',
			value: '3/4',
			description: 'Tasks funded past their time-to-flow.',
			band: 'neutral',
		},
		{
			headline: true,
			label: 'Human Capacity',
			value: '104%',
			description: 'Planned load against the capacity pools — may read over 100%.',
			band: 'warning',
		},
		{
			headline: true,
			label: 'Burnout Risk',
			value: 'Critical',
			description: 'Sustained load against recovery over the trailing window.',
			band: 'critical',
		},
		{
			label: 'Fallow Gain',
			value: '+18%',
			description: 'Improvement over a naive equal split of the same hours.',
			band: 'success',
		},
		{
			label: 'Yield Index',
			value: '82%',
			description: 'Share of the achievable output this allocation reaches.',
			band: 'success',
		},
		{
			label: 'Time Scarcity',
			value: '62%',
			description: 'How stretched the time budget is against demand.',
			band: 'warning',
		},
		{
			label: 'Primary Bottleneck',
			// A task title, so this is the row that stress-tests a long value against
			// its label. Neutral on purpose: naming a task is not a verdict on it
			// (MATH.md §23.1).
			value: 'Write the quarterly report',
			description: 'Largest draw on the capacity pool that binds the day.',
			band: 'neutral',
		},
	];

	const { Story } = defineMeta({
		title: 'Component/Metrics Dashboard',
		component: MetricsDashboard,
		tags: ['autodocs'],
		args: {
			metrics,
			momentum: 0.4,
		},
	});
</script>

<!-- Headline readings are tiles; the reference rows are a dense ruled grid one
     click away, behind the disclosure -->
<Story
	name="Upward momentum"
	play={async ({ canvas, canvasElement, userEvent }) => {
		await expect(canvas.getByText('Burnout Risk')).toBeVisible();
		await expect(canvas.getByText('104%')).toBeVisible();
		await expect(canvas.getByText('Upward')).toBeVisible();

		// Each judged band carries text a screen reader hears; the three neutral
		// readings (Completion Rate, Flow Coverage, and Primary Bottleneck — which
		// names a task rather than judging one, MATH.md §23.1) are the default value
		// colour, make no claim, and stay silent.
		await expect(canvas.getByText('(Critical)')).toBeInTheDocument();
		expect(canvasElement.querySelectorAll('.sr-only')).toHaveLength(5);

		// Closed on first render: a returning user sees the four tiles, not twenty
		// readings at equal weight.
		expect(canvasElement.querySelector('details')!.open).toBe(false);
		await expect(canvas.getByText('82%')).not.toBeVisible();

		// The reference grid holds only the readings that are not already tiles
		// above it, and opens on the disclosure.
		await userEvent.click(canvas.getByText('4 more metrics'));
		await expect(canvas.getByText('Yield Index')).toBeVisible();
		await expect(canvas.getByText('82%')).toBeVisible();
		await expect(canvas.getByText('Fallow Gain')).toBeVisible();
	}}
/>

<Story
	name="Reset required"
	args={{
		momentum: -0.4,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Reset Reqd')).toBeVisible();
	}}
/>

<Story
	name="Stable"
	args={{
		momentum: 0,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Stable')).toBeVisible();
	}}
/>

<!-- No history yet: the badge reads N/A -->
<Story
	name="No momentum"
	args={{
		momentum: null,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('N/A')).toBeVisible();
	}}
/>

<Story
	name="No metrics"
	args={{
		metrics: [],
		momentum: null,
	}}
/>

<!-- Every reading is a headline: nothing left over, so no disclosure at all -->
<Story
	name="Headlines only"
	args={{
		metrics: metrics.filter((metric) => metric.headline),
	}}
	play={async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText('104%')).toBeVisible();
		// The disclosure itself is absent, not merely empty: an empty `<details>`
		// draws a summary that opens onto nothing.
		expect(canvasElement.querySelector('details')).toBeNull();
	}}
/>
