<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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

<Story name="Upward momentum" />

<Story
	name="Reset required"
	args={{
		momentum: -0.4,
	}}
/>

<Story
	name="Stable"
	args={{
		momentum: 0,
	}}
/>

<!-- No history yet: the badge reads N/A -->
<Story
	name="No momentum"
	args={{
		momentum: null,
	}}
/>

<Story
	name="No metrics"
	args={{
		metrics: [],
		momentum: null,
	}}
/>
