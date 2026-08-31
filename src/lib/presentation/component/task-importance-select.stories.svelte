<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import TaskImportanceSelect from '$lib/presentation/component/task-importance-select.svelte';

	const { Story } = defineMeta({
		title: 'Component/Task Importance Select',
		component: TaskImportanceSelect,
		tags: ['autodocs'],
		args: {
			importance: 'normal',
		},
	});
</script>

<Story
	name="Default"
	play={async ({ canvas, userEvent }) => {
		// A real radio group, not three buttons: the whole point of the STYLE.md
		// carve-out `must-do-toggle.svelte` takes is that the native control keeps its
		// roving-tabindex keyboard for free. One Tab reaches the group, then arrows
		// move within it — which is what a three-option field is supposed to do.
		const group = canvas.getByRole('group', {
			name: 'Importance',
		});

		const normal = canvas.getByRole('radio', {
			name: 'Normal',
		});

		await expect(normal).toBeChecked();
		await expect(group).toBeInTheDocument();

		normal.focus();
		await userEvent.keyboard('{ArrowRight}');

		await expect(
			canvas.getByRole('radio', {
				name: 'High',
			}),
		).toBeChecked();

		await expect(normal).not.toBeChecked();
	}}
/>

<Story
	name="High"
	args={{
		importance: 'high',
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByRole('radio', {
				name: 'High',
			}),
		).toBeChecked();
	}}
/>
