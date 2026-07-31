<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Rest Log Form',
		component: RestLogForm,
		tags: ['autodocs'],
	});
</script>

<!-- The ☕ editor, as it appears inside the recovery calibration card: minutes rested
     and both capacities rated before and after. Every field is required — a blank
     "after" would enter the §8.9 fit as a break that left you at zero. -->
<Story
	name="Open"
	args={{
		onsave: fn(),
		oncancel: fn(),
	}}
/>
