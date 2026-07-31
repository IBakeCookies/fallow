<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';

	const { Story } = defineMeta({
		title: 'Component/Energy Task Row',
		component: EnergyTaskRow,
		tags: ['autodocs'],
		args: {
			title: 'write the calibration section',
			completed: false,
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			color: 'var(--series-1)',
			plannedHours: 1.75,
			measured: false,
			drainDraft: null,
			focusDrainMinutes: false,
			ontoggle: fn(),
			onremove: fn(),
			ondrainclick: fn(),
			onchange: fn(),
			ondrainsave: fn(),
			ondraincancel: fn(),
		},
	});
</script>

<!-- The row is an <li>: the list is what makes it one -->
<Story name="Default">
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- Funded nothing this plan: said out loud, because the timeline cannot say it -->
<Story
	name="Unfunded"
	args={{
		title: 'reorganize the garage',
		physicalDifficulty: 9,
		mentalDifficulty: 1,
		enjoyment: 2,
		plannedHours: 0,
		color: 'var(--series-3)',
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- Finished, and rated: the sliders are gone, the 🪫 stays lit -->
<Story
	name="Completed and rated"
	args={{
		completed: true,
		measured: true,
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>

<!-- The 🪫 editor open under the row, seeded with today's rating -->
<Story
	name="Rating the session"
	args={{
		measured: true,
		drainDraft: {
			minutes: 45,
			mind: 6,
			body: 2,
		},
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl space-y-text-2xs"><EnergyTaskRow {...args} /></ul>
	{/snippet}
</Story>
