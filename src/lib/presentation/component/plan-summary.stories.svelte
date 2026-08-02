<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
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
<Story
	name="Ahead of the classic plan"
	play={async ({ canvas }) => {
		// The objective the plan was optimized for: output, end energy, work time
		await expect(canvas.getByText('12.4')).toBeInTheDocument();
		await expect(canvas.getByText('42% / 71%')).toBeInTheDocument();
		await expect(canvas.getByText('5h 15m')).toBeInTheDocument();

		// Beating the classic plan signs itself green, with an explicit '+'
		await expect(canvas.getByText('+8%')).toHaveClass('text-success');

		// The e2e reads this tile by preceding sibling, so the value must stay the
		// label's previous element — a wrapper around either one breaks it silently
		const label = canvas.getByText('Output vs the classic plan, judged by this model');
		await expect(label.previousElementSibling?.textContent?.trim()).toBe('+8%');
	}}
/>

<Story
	name="Behind the classic plan"
	args={{
		outputVsClassic: -6,
	}}
	play={async ({ canvas }) => {
		// Losing to the classic plan is the other reading: warning ink, minus sign
		await expect(canvas.getByText('-6%')).toHaveClass('text-warning');
	}}
/>

<!-- The classic allocator has no plan today, so there is nothing to compare -->
<Story
	name="No comparison"
	args={{
		outputVsClassic: null,
	}}
	play={async ({ canvas }) => {
		// No rival plan is not "0% better"
		await expect(canvas.getByText('—')).toBeInTheDocument();
		await expect(canvas.getByText('No classic plan to compare')).toBeInTheDocument();
	}}
/>
