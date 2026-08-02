<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { Metric } from '$lib/presentation/type';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';

	/* The band is the banding policy's output (utils/band.ts) — the component owns
	   the colour and the screen-reader wording it renders from it. */
	const metrics: Metric[] = [
		// The four headline readings, rendered as a 2×2 tile grid. "Primary
		// Bottleneck" is a task title, so it is the one that stress-tests wrapping.
		{
			headline: true,
			label: 'Fallow Gain',
			value: '+18%',
			description: 'Improvement over a naive equal split of the same hours.',
			band: 'success',
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
			label: 'Time Scarcity',
			value: '62%',
			description: 'How stretched the time budget is against demand.',
			band: 'warning',
		},
		{
			headline: true,
			label: 'Primary Bottleneck',
			value: 'Write the quarterly report',
			description: 'Highest effort-to-enjoyability ratio among remaining tasks.',
			band: 'warning',
		},
		{
			label: 'Yield Index',
			value: '82%',
			description: 'Share of the achievable output this allocation reaches.',
			band: 'success',
		},
		{
			label: 'Flow Coverage',
			value: '3/4',
			description: 'Tasks funded past their time-to-flow.',
			band: 'neutral',
		},
		{
			section: true,
			label: 'Burnout Risk',
			value: 'Critical',
			description: 'Sustained load against recovery over the trailing window.',
			band: 'critical',
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

<!-- Headline readings are tiles, immediately visible; the reference rows sit
     behind the disclosure, served but not shown until it is opened -->
<Story
	name="Upward momentum"
	play={async ({ canvas, canvasElement, userEvent }) => {
		await expect(canvas.getByText('Fallow Gain')).toBeVisible();
		await expect(canvas.getByText('+18%')).toBeVisible();
		await expect(canvas.getByText('Upward')).toBeVisible();

		// Each judged band carries text a screen reader hears; neutral (Flow
		// Coverage) is the default value colour, makes no claim, and stays silent.
		await expect(canvas.getByText('(Critical)')).toBeInTheDocument();
		expect(canvasElement.querySelectorAll('.sr-only')).toHaveLength(6);

		// Closed: the reference rows are served (crawlable, findable) but not shown.
		// "3 more metrics", not "All 3": the disclosure holds only the readings that
		// are not already tiles above it.
		expect(canvasElement.querySelector('details')!.open).toBe(false);
		await expect(canvas.getByText('82%')).not.toBeVisible();

		await userEvent.click(canvas.getByText('3 more metrics'));
		await expect(canvas.getByText('Yield Index')).toBeVisible();
		await expect(canvas.getByText('82%')).toBeVisible();
		await expect(canvas.getByText('Flow Coverage')).toBeVisible();
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
		await expect(canvas.getByText('+18%')).toBeVisible();
		expect(canvasElement.querySelector('details')).toBeNull();
	}}
/>
