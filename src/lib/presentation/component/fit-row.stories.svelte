<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import FitRow from '$lib/presentation/component/fit-row.svelte';

	const { Story } = defineMeta({
		title: 'Component/Fit Row',
		component: FitRow,
		tags: ['autodocs'],
	});
</script>

<!-- The two α rows of the drain card, each in its capacity's ink -->
<Story
	name="Cognitive drain"
	args={{
		label: 'Cognitive Drain',
		value: '0.42 ± 0.08 (n=7)',
		tone: 'mind',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Cognitive Drain')).toBeInTheDocument();
		await expect(canvas.getByText('0.42 ± 0.08 (n=7)')).toHaveClass('text-mind-strong');
	}}
/>

<Story
	name="Physical drain"
	args={{
		label: 'Physical Drain',
		value: '0.61 ± 0.11 (n=7)',
		tone: 'body',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('0.61 ± 0.11 (n=7)')).toHaveClass('text-body/90');
	}}
/>

<!-- The neutral capacity's ink, for the constants that belong to neither mind nor body -->
<Story
	name="Recovery rate"
	args={{
		label: 'Recovery Rate',
		value: '1.20 ± 0.30 (n=4)',
		tone: 'info',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('1.20 ± 0.30 (n=4)')).toHaveClass('text-info-strong');
	}}
/>

<!-- Logged, but nothing in them separates this constant from the default: a fit that
     failed is not a fit of zero, so no number is printed to invite applying it -->
<Story
	name="No signal"
	args={{
		label: 'Recovery Rate',
		value: null,
		tone: 'info',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('no informative ratings')).toHaveClass('text-ty-silent');
	}}
/>
