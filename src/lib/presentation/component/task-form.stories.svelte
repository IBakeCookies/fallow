<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
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

<!-- The full form. The play walks the submit policy: every slider named by its
     label, an empty title refused, the title trimmed and the draft reset, and the
     must-do-today flag surviving the submit before resetting with the rest. -->
<Story
	name="Open"
	play={async ({ args, canvas, userEvent }) => {
		// The wrapping label is what names each range input
		await expect(
			canvas.getByRole('slider', {
				name: /Physical Diff/,
			}),
		).toBeInTheDocument();

		await expect(
			canvas.getByRole('slider', {
				name: /Mental Diff/,
			}),
		).toBeInTheDocument();

		await expect(
			canvas.getByRole('slider', {
				name: /Enjoyment/,
			}),
		).toBeInTheDocument();

		const title = canvas.getByLabelText('Task Definition');

		const deploy = canvas.getByRole('button', {
			name: 'Deploy Task',
		});

		// An empty title is not a task
		await userEvent.click(deploy);
		await expect(args.onsubmit).not.toHaveBeenCalled();

		// Trimmed title with the slider defaults, and the draft resets
		await userEvent.type(title, '  Boxing training  ');
		await userEvent.click(deploy);

		await expect(args.onsubmit).toHaveBeenCalledExactlyOnceWith({
			title: 'Boxing training',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 5,
			mustDoToday: false,
		});

		await expect(title).toHaveValue('');

		// The flag stops the plan advisor offering to move a task that cannot move,
		// so it has to survive the submit — and reset with the rest of the draft
		const mustDo = canvas.getByLabelText("Don't move off today");
		await userEvent.type(title, 'Tax return');
		await userEvent.click(mustDo);
		await userEvent.click(deploy);

		await expect(args.onsubmit).toHaveBeenLastCalledWith({
			title: 'Tax return',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 5,
			mustDoToday: true,
		});

		await expect(mustDo).not.toBeChecked();
	}}
/>

<!-- Collapsed it is a single "+ Add Task" row, so the task list stays above the fold -->
<Story
	name="Collapsed"
	args={{
		isOpen: false,
	}}
	play={async ({ canvas, userEvent }) => {
		// The row expands into the form on click...
		await userEvent.click(
			canvas.getByRole('button', {
				name: '+ Add Task',
			}),
		);

		await expect(canvas.getByLabelText('Task Definition')).toBeInTheDocument();

		// ...and ▴ collapses it back to the add row
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Collapse task form',
			}),
		);

		await expect(
			canvas.getByRole('button', {
				name: '+ Add Task',
			}),
		).toBeInTheDocument();
	}}
/>
