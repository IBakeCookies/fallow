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
			valueVsClassic: 8,
		},
	});
</script>

<Story
	name="Ahead of the classic plan"
	play={async ({ canvas }) => {
		// The readout under the chart: what the plan is worth, and what it cost
		// The objective the plan was optimized for: output, end energy, work time
		await expect(canvas.getByText('12.4')).toBeInTheDocument();
		await expect(canvas.getByText('42% / 71%')).toBeInTheDocument();
		await expect(canvas.getByText('5h 15m')).toBeInTheDocument();

		// Beating the classic plan signs itself green, with an explicit '+'
		await expect(canvas.getByText('+8%')).toHaveClass('text-success');

		// The e2e reads this tile by preceding sibling, so the value must stay the
		// label's previous element — a wrapper around either one breaks it silently
		const label = canvas.getByText('Day value vs the classic plan, judged by this model');
		await expect(label.previousElementSibling?.textContent?.trim()).toBe('+8%');
	}}
/>

<Story
	name="Behind the classic plan"
	args={{
		valueVsClassic: -6,
	}}
	play={async ({ canvas }) => {
		// Losing to the classic plan is the other reading: warning ink, minus sign
		await expect(canvas.getByText('-6%')).toHaveClass('text-warning');
	}}
/>

<Story
	name="Level with the classic plan"
	args={{
		valueVsClassic: -0,
	}}
	play={async ({ canvas }) => {
		// A gap under half a point. `Math.round` hands the tile -0 for a small LOSS, and -0 >= 0, so
		// the old two-way sign painted a beaten plan green with a '+'.
		const tie = canvas.getByText('0%');
		await expect(tie).toHaveClass('text-ty-primary');
		// No '+': a tie is not a win
		await expect(tie.textContent?.trim()).toBe('0%');
	}}
/>

<Story
	name="No comparison"
	args={{
		valueVsClassic: null,
	}}
	play={async ({ canvas }) => {
		// The classic allocator has no plan today, so there is nothing to compare
		// No rival plan is not "0% better"
		await expect(canvas.getByText('—')).toBeInTheDocument();
		await expect(canvas.getByText('No classic plan to compare')).toBeInTheDocument();
	}}
/>

<Story
	name="Nearly, but not quite, untouched"
	args={{
		endCog: 0.9995,
		endPhys: 1,
	}}
	play={async ({ canvas }) => {
		// The energy reading floors rather than rounds: on a depletion number, 100% has to mean
		// untouched, and `Math.round` printed it from 0.995 up.
		await expect(canvas.getByText('99% / 100%')).toBeInTheDocument();
	}}
/>
