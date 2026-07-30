<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import TaskForm from '$lib/presentation/component/task-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Task Form',
		component: TaskForm,
		tags: ['autodocs'],
		args: {
			onsubmit: fn(),
			isOpen: true,
		},
	});
</script>

<Story name="Open" />

<!-- Collapsed it is a single "+ Add Task" row, so the task list stays above the fold -->
<Story
	name="Collapsed"
	args={{
		isOpen: false,
	}}
/>
