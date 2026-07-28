<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { Metric } from '$lib/presentation/type';
	import { STATUS } from '$lib/presentation/utils/status';
	import MetricsDashboard from '$lib/presentation/component/metrics-dashboard.svelte';

	/* valStyle is the banding policy's output (utils/status.ts), so stories use
	   the same classes the app would hand in. */
	const metrics: Metric[] = [
		// The four headline readings, rendered as a 2×2 tile grid. "Primary
		// Bottleneck" is a task title, so it is the one that stress-tests wrapping.
		{
			headline: true,
			label: 'Fallow Gain',
			value: '+18%',
			description: 'Improvement over a naive equal split of the same hours.',
			valStyle: STATUS.SUCCESS.color,
		},
		{
			headline: true,
			label: 'Human Capacity',
			value: '104%',
			description: 'Planned load against the capacity pools — may read over 100%.',
			valStyle: STATUS.WARNING.color,
		},
		{
			headline: true,
			label: 'Time Scarcity',
			value: '62%',
			description: 'How stretched the time budget is against demand.',
			valStyle: STATUS.WARNING.color,
		},
		{
			headline: true,
			label: 'Primary Bottleneck',
			value: 'Write the quarterly report',
			description: 'Highest effort-to-enjoyability ratio among remaining tasks.',
			valStyle: STATUS.WARNING.color,
		},
		{
			label: 'Yield Index',
			value: '82%',
			description: 'Share of the achievable output this allocation reaches.',
			valStyle: STATUS.SUCCESS.color,
		},
		{
			label: 'Flow Coverage',
			value: '3/4',
			description: 'Tasks funded past their time-to-flow.',
			valStyle: STATUS.NEUTRAL.color,
		},
		{
			section: true,
			label: 'Burnout Risk',
			value: 'Critical',
			description: 'Sustained load against recovery over the trailing window.',
			valStyle: STATUS.CRITICAL.color,
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
