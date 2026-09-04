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
				importance: 'normal',
				tags: [],
			},
			onsave: fn(),
			oncancel: fn(),
		},
	});
</script>

<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		// Opened on a task: seeded with what is stored, and Save reports every field at once — the two
		// screens that mount this both hand the result to `updateTask`.
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
			importance: 'normal',
			tags: [],
		});
	}}
/>

<Story
	name="Title cleared"
	play={async ({ args, canvas, userEvent }) => {
		// A blank title is not an edit: Save is out of reach until there is one back
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

<Story
	name="Must-do task"
	args={{
		seed: {
			title: 'file the tax return',
			physicalDifficulty: 1,
			mentalDifficulty: 6,
			enjoyment: 2,
			mustDoToday: true,
			importance: 'normal',
			tags: [],
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// The flag round-trips: an edit that never touches it must not clear it
		await expect(canvas.getByRole('checkbox')).toBeChecked();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith(args.seed);
	}}
/>

<Story
	name="Without the must-do flag"
	args={{
		seed: {
			title: 'file the tax return',
			physicalDifficulty: 1,
			mentalDifficulty: 6,
			enjoyment: 2,
			mustDoToday: true,
			importance: 'normal',
			tags: [],
		},
		withMustDoToday: false,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// In the Energy Lab: no must-do checkbox, because the plan advisor that reads the flag is the
		// main page's. The seeded value still has to reach `onsave` — a hidden control is not the user
		// answering "no".
		await expect(canvas.queryByRole('checkbox')).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith(args.seed);
	}}
/>

<Story
	name="Retagging a task"
	args={{
		seed: {
			title: 'Morning run',
			physicalDifficulty: 7,
			mentalDifficulty: 1,
			enjoyment: 6,
			mustDoToday: false,
			importance: 'normal',
			tags: ['school'],
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Tags are editable after the fact — the label is a label, so fixing one has to fix
		// the past hours it names, not only the next task
		await expect(canvas.getByText('school')).toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Remove tag school',
			}),
		);

		await userEvent.type(canvas.getByLabelText('Tags'), 'exercise{Enter}');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith({
			...args.seed,
			tags: ['exercise'],
		});
	}}
/>

<Story
	name="Offering the tags the user has used before"
	args={{
		tagVocabulary: ['deep-work', 'errand', 'writing'],
	}}
	play={async ({ canvasElement, canvas }) => {
		// The editor's tag field offers the same vocabulary the add form's does: a
		// pick here rewrites nothing (which is why the TITLE offers no suggestions),
		// so withholding it only invited a second spelling of a tag the user has.
		const offered = [...canvasElement.querySelectorAll('datalist option')].map(
			(option) => (option as HTMLOptionElement).value,
		);

		await expect(offered).toEqual(['deep-work', 'errand', 'writing']);

		// Still one input over the list, not a select: a tag that is not in it yet is
		// the commonest one to type.
		await expect(canvas.getByPlaceholderText('e.g., exercise')).toHaveValue('');
	}}
/>
