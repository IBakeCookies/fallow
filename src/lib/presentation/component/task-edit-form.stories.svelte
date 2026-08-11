<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fireEvent, fn } from 'storybook/test';
	import TaskEditForm from '$lib/presentation/component/task-edit-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Task Edit Form',
		component: TaskEditForm,
		tags: ['autodocs'],
		args: {
			seed: {
				title: 'write the calibration section',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 7,
				mustDoToday: false,
			},
			onsave: fn(),
			oncancel: fn(),
		},
	});
</script>

<!-- Opened on a task: seeded with what is stored, and Save reports every field at
     once — the two screens that mount this both hand the result to `updateTask`. -->
<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		const title = canvas.getByRole('textbox');
		await expect(title).toHaveValue(args.seed.title);

		const sliders = canvas.getAllByRole('slider');
		await expect(sliders[0]).toHaveValue('2');
		await expect(sliders[1]).toHaveValue('8');
		await expect(sliders[2]).toHaveValue('7');

		await userEvent.clear(title);
		await userEvent.type(title, 'rewrite §8.11');

		await fireEvent.input(sliders[0], {
			target: {
				value: '5',
			},
		});

		await userEvent.click(canvas.getByRole('checkbox'));

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith({
			title: 'rewrite §8.11',
			physicalDifficulty: 5,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: true,
		});
	}}
/>

<!-- A blank title is not an edit: Save is out of reach until there is one back -->
<Story
	name="Title cleared"
	play={async ({ args, canvas, userEvent }) => {
		const title = canvas.getByRole('textbox');

		await userEvent.clear(title);
		await userEvent.type(title, '   ');

		const save = canvas.getByRole('button', {
			name: 'Save',
		});

		await expect(save).toBeDisabled();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Cancel',
			}),
		);

		await expect(args.oncancel).toHaveBeenCalledOnce();
		await expect(args.onsave).not.toHaveBeenCalled();
	}}
/>

<!-- The flag round-trips: an edit that never touches it must not clear it -->
<Story
	name="Must-do task"
	args={{
		seed: {
			title: 'file the tax return',
			physicalDifficulty: 1,
			mentalDifficulty: 6,
			enjoyment: 2,
			mustDoToday: true,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByRole('checkbox')).toBeChecked();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith(args.seed);
	}}
/>

<!-- In the Energy Lab: no must-do checkbox, because the plan advisor that reads the
     flag is the main page's. The seeded value still has to reach `onsave` — a hidden
     control is not the user answering "no". -->
<Story
	name="Without the must-do flag"
	args={{
		seed: {
			title: 'file the tax return',
			physicalDifficulty: 1,
			mentalDifficulty: 6,
			enjoyment: 2,
			mustDoToday: true,
		},
		withMustDoToday: false,
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.queryByRole('checkbox')).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith(args.seed);
	}}
/>
