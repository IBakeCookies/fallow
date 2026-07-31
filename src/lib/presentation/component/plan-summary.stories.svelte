<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PlanSummary from '$lib/presentation/component/plan-summary.svelte';

	const { Story } = defineMeta({
		title: 'Component/Plan Summary',
		component: PlanSummary,
		tags: ['autodocs'],
		args: {
			totalOutput: '12.4',
			endCog: 0.42,
			endPhys: 0.71,
			workHours: 5.25,
			outputVsClassic: 8,
		},
	});
</script>

<!-- The readout under the chart: what the plan is worth, and what it cost -->
<Story name="Ahead of the classic plan" />

<Story
	name="Behind the classic plan"
	args={{
		outputVsClassic: -6,
	}}
/>

<!-- The classic allocator has no plan today, so there is nothing to compare -->
<Story
	name="No comparison"
	args={{
		outputVsClassic: null,
	}}
/>
