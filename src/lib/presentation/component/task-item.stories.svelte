<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import TaskItem from '$lib/presentation/component/task-item.svelte';

	const { Story } = defineMeta({
		title: 'Component/Task Item',
		component: TaskItem,
		tags: ['autodocs'],
		args: {
			id: 1,
			title: 'write the calibration section',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			nature: 'cognitive',
			completed: false,
			priorityScore: 12.4,
			suggestedHours: 1.75,
			trueEffort: 4.2,
			flowStateTime: 0.6,
			optimalStopHours: 2.25,
			ontoggle: fn(),
			onremove: fn(),
			onlogflow: fn(),
			onupdate: fn(),
		},
	});
</script>

<Story name="Default" />

<!-- #1 in the suggested sequence -->
<Story
	name="First in run order"
	args={{
		runOrder: 1,
	}}
/>

<Story
	name="With a logged time-to-flow"
	args={{
		runOrder: 2,
		flowMinutes: 40,
	}}
/>

<Story
	name="Completed"
	args={{
		completed: true,
	}}
/>

<!-- No onlogflow/onupdate: the ⚡ and ✎ editors are hidden -->
<Story
	name="Read only"
	args={{
		onlogflow: undefined,
		onupdate: undefined,
	}}
/>

<Story
	name="Unallocated"
	args={{
		title: 'reorganize the garage',
		physicalDifficulty: 9,
		mentalDifficulty: 1,
		enjoyment: 2,
		nature: 'physical',
		priorityScore: 0.8,
		suggestedHours: 0,
		trueEffort: 4.5,
		flowStateTime: 1.1,
		optimalStopHours: 1.9,
	}}
/>
