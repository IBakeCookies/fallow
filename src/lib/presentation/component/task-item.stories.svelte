<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, waitFor } from 'storybook/test';
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

<script lang="ts">
	// Only the "Withdrawn prompt" story: its parent must actually flip `completed`
	let flippedCompleted = $state(false);
</script>

<!-- The cognitive badge, a checkbox named after the task, and the two callbacks
     wired to their controls -->
<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText('COG')).toBeVisible();

		const checkbox = canvas.getByRole('checkbox', {
			name: 'Mark write the calibration section complete',
		});

		await userEvent.click(checkbox);
		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete task',
			}),
		);

		await expect(args.onremove).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<!-- #1 in the suggested sequence — and the full row: inputs, allocation, derived values -->
<Story
	name="First in run order"
	args={{
		runOrder: 1,
	}}
	play={async ({ args, canvas }) => {
		await expect(
			canvas.getByRole('heading', {
				name: args.title,
			}),
		).toBeVisible();

		await expect(canvas.getByText('#1')).toBeVisible();
		await expect(canvas.getByText('P 2')).toBeVisible();
		await expect(canvas.getByText('M 8')).toBeVisible();
		await expect(canvas.getByText('E 7')).toBeVisible();
		await expect(canvas.getByText('1h 45m')).toBeVisible();
		await expect(canvas.getByText('prio 12.4')).toBeVisible();
		await expect(canvas.getByText('effort 4.2 · flow @ 36m · stop by 2h 15m')).toBeVisible();
	}}
/>

<!-- The ⚡ badge shows the measurement, so completing does not ask for it again -->
<Story
	name="With a logged time-to-flow"
	args={{
		runOrder: 2,
		flowMinutes: 40,
	}}
	play={async ({ canvas, userEvent }) => {
		await expect(canvas.getByText('⚡ 40m')).toBeVisible();

		await userEvent.click(canvas.getByRole('checkbox'));
		await expect(canvas.queryByPlaceholderText('min')).not.toBeInTheDocument();
	}}
/>

<!-- Struck through, allocation and run order hidden — and un-completing ends no
     session, so it asks for no measurement -->
<Story
	name="Completed"
	args={{
		completed: true,
		runOrder: 1,
	}}
	play={async ({ args, canvas, userEvent }) => {
		const checkbox = canvas.getByRole('checkbox');
		await expect(checkbox).toBeChecked();

		await expect(
			canvas.getByRole('heading', {
				name: args.title,
			}),
		).toHaveClass('line-through');

		await expect(canvas.queryByText('#1')).not.toBeInTheDocument();
		await expect(canvas.queryByText('prio 12.4')).not.toBeInTheDocument();

		await userEvent.click(checkbox);
		await expect(canvas.queryByPlaceholderText('min')).not.toBeInTheDocument();
	}}
/>

<!-- A past day passes no callbacks: the ⚡ and ✎ editors and the inert ✕ are all withheld -->
<Story
	name="Read only"
	args={{
		onlogflow: undefined,
		onupdate: undefined,
		onremove: undefined,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByRole('checkbox')).toBeVisible();

		await expect(
			canvas.queryByRole('button', {
				name: 'Delete task',
			}),
		).not.toBeInTheDocument();

		await expect(
			canvas.queryByRole('button', {
				name: 'Edit task',
			}),
		).not.toBeInTheDocument();

		await expect(
			canvas.queryByRole('button', {
				name: 'Log time to flow',
			}),
		).not.toBeInTheDocument();
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
	play={async ({ canvas }) => {
		await expect(canvas.getByText('PHY')).toBeVisible();
	}}
/>

<!-- A balanced nature gets the hybrid badge -->
<Story
	name="Balanced"
	args={{
		nature: 'balanced',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('HYB')).toBeVisible();
	}}
/>

<!-- ⚡ asked for the editor, so the caret lands in the minutes field; an empty
     save is refused, a filled one logs minutes -->
<Story
	name="Logging time to flow"
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		);

		const minutes = canvas.getByPlaceholderText('min');
		await waitFor(() => expect(minutes).toHaveFocus());

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.onlogflow).not.toHaveBeenCalled();

		await userEvent.type(minutes, '25');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.onlogflow).toHaveBeenCalledExactlyOnceWith(1, 25);
	}}
/>

<!-- Completing is the one moment the user still knows the ramp-up: the prompt
     opens itself, but must not pull the caret out of the task list -->
<Story
	name="Asks on completion"
	play={async ({ args, canvas, userEvent }) => {
		const checkbox = canvas.getByRole('checkbox');
		await userEvent.click(checkbox);
		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		const minutes = await canvas.findByPlaceholderText('min');
		await expect(checkbox).toHaveFocus();

		await userEvent.type(minutes, '25');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.onlogflow).toHaveBeenCalledExactlyOnceWith(1, 25);
	}}
/>

<!-- `completed` is a prop, so a mis-click is undone by the parent: the prompt
     withdraws its own question, but never an editor the user opened by hand -->
<Story
	name="Withdrawn prompt"
	play={async ({ canvas, userEvent }) => {
		const checkbox = canvas.getByRole('checkbox');

		await userEvent.click(checkbox);
		await expect(canvas.getByPlaceholderText('min')).toBeInTheDocument();

		await userEvent.click(checkbox);
		await expect(canvas.queryByPlaceholderText('min')).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		);

		await userEvent.type(canvas.getByPlaceholderText('min'), '25');

		await userEvent.click(checkbox);
		await userEvent.click(checkbox);
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(25);
	}}
>
	{#snippet template(args)}
		<TaskItem
			{...args}
			completed={flippedCompleted}
			ontoggle={() => (flippedCompleted = !flippedCompleted)}
		/>
	{/snippet}
</Story>

<!-- ✎ opens the inline editor: named sliders, editable title — and the completion
     prompt opens BESIDE its unsaved draft rather than closing it. The two forms
     answer different questions, so the row shows both, as the Lab's row does. -->
<Story
	name="Inline editor"
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

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

		const title = canvas.getByLabelText('Title');
		await expect(title).toHaveValue('write the calibration section');
		await userEvent.clear(title);
		await userEvent.type(title, 'sparring');

		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: 'Mark write the calibration section complete',
			}),
		);

		await expect(canvas.getByPlaceholderText('min')).toBeInTheDocument();
		await expect(title).toHaveValue('sparring');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'sparring',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: false,
		});
	}}
/>

<!-- Flagged unmovable: badged on the row, and the editor can clear the flag -->
<Story
	name="Must do today"
	args={{
		mustDoToday: true,
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText('Stays today')).toBeVisible();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		const flag = canvas.getByLabelText("Don't move off today");
		await expect(flag).toBeChecked();
		await userEvent.click(flag);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'write the calibration section',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: false,
		});
	}}
/>
