<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Drain Log Form',
		component: DrainLogForm,
		tags: ['autodocs'],
	});
</script>

<!-- The 🪫 editor as it hangs under a task row: how long the session ran, and how
     spent each capacity feels now. Blank, as it opens on an unrated task. -->
<Story
	name="Blank"
	args={{
		onsave: fn(),
		oncancel: fn(),
	}}
/>

<!-- Re-opened on a task already rated today: amending, not starting over -->
<Story
	name="Amending today's rating"
	args={{
		seed: {
			minutes: 45,
			mind: 6,
			body: 2,
		},
		onsave: fn(),
		oncancel: fn(),
	}}
/>
