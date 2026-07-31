<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
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
/>

<Story
	name="Physical drain"
	args={{
		label: 'Physical Drain',
		value: '0.61 ± 0.11 (n=7)',
		tone: 'body',
	}}
/>

<!-- Logged, but nothing in them separates this constant from the default -->
<Story
	name="No signal"
	args={{
		label: 'Recovery Rate',
		value: null,
		tone: 'info',
	}}
/>
