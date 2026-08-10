<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, waitFor, within } from 'storybook/test';
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
			drainDraft: null,
			isDrainMeasured: false,
			ondrainopen: fn(),
			ondrainclose: fn(),
			ondrainsave: fn(),
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

<!-- Mid-day (MATH.md §35): the re-plan reads WITH the plan, never over it. The
     morning's 1h 45m is still there, stacked under the delta; the new figure is
     what the hours still left are worth on this task now. -->
<Story
	name="Mid-day re-plan"
	args={{
		runOrder: 1,
		remaining: {
			taskHours: 0.75,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		// The delta leads, in the primary weight...
		const delta = canvas.getByText('45m more');
		await expect(delta).toBeVisible();
		await expect(delta).toHaveClass(/text-ty-primary/);

		// ...and the plan is still there, unchanged and muted beneath it. That the
		// plan number survives mid-day IS the §11.8 scope split, on screen.
		const plan = canvas.getByText('1h 45m · prio 12.4');
		await expect(plan).toBeVisible();
		await expect(plan).toHaveClass(/text-ty-silent/);
	}}
/>

<!-- The delta landing on the planned figure prints it once, not twice — a row
     reading "1h 45m more / 1h 45m · prio" looks like a bug. Not a claim that
     nothing moved: the same coincidence happens on a task worked 30m whose day
     just grew, which this row is given no way to distinguish. -->
<Story
	name="Re-plan lands on the planned hours"
	args={{
		remaining: {
			taskHours: 1.75,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		await expect(canvas.getByText('1h 45m more')).toBeVisible();

		const line = canvas.getByText('prio 12.4');

		await expect(line).toBeVisible();
		// The duplicate is gone; the survivor is the delta, which is the actionable one.
		await expect(canvas.queryByText('1h 45m · prio 12.4')).not.toBeInTheDocument();

		// And the tooltip follows the line: with no allocation left on screen, the
		// allocation tooltip would be describing a figure that is not there.
		await userEvent.hover(line);
		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/priority score/)).toBeVisible());
		await expect(body.queryByText(/^Suggested time allocation/)).not.toBeInTheDocument();
	}}
/>

<!-- A task the rest of the day is worth nothing on says so, rather than vanishing:
     an absent row would read as "no answer" where the model has a definite one. -->
<Story
	name="Nothing more worth doing"
	args={{
		remaining: {
			taskHours: 0,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('0m more')).toBeVisible();
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

<!-- A past day passes no callbacks: both measurement editors, ✎ and the inert ✕ are all
     withheld. 🪫 is gated by the same `canLog` as ⚡, and for the same reason — the store
     stamps an observation with the LIVE clock's today, so one logged here would misdate
     itself onto a day the user is only reading. -->
<Story
	name="Read only"
	args={{
		onlogflow: undefined,
		ondrainopen: undefined,
		ondrainsave: undefined,
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

		await expect(
			canvas.queryByRole('button', {
				name: 'Log end-of-session drain',
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

<!-- 🪫 is on this row too, not only in the Lab. It is the app's ONLY source of worked
     hours, and λ₀ (MATH.md §8.10), the §12 adherence audit and overnight carry-over
     (§11.9) all read finished days off it — so while the button lived on `/energy`
     alone, a user who never opened the Lab calibrated none of the three. -->
<Story
	name="Rating a session"
	args={{
		isDrainMeasured: false,
		drainDraft: {
			minutes: 45,
			mind: 6,
			body: 2,
			focusMinutes: false,
			promptedByCompletion: false,
		},
		ondrainopen: fn(),
		ondrainclose: fn(),
		ondrainsave: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		// ✓ reports the session in hours, keyed by the task the row is
		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.ondrainsave).toHaveBeenCalledExactlyOnceWith(1, {
			hours: 0.75,
			mind: 6,
			body: 2,
		});

		// The button closes what it opened — the page owns the draft, so the row asks
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainclose).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<!-- Completing a task is the moment both measurements are knowable, so the tick asks
     both and the two editors stack. They keep their own policies: ⚡ is one number per
     day and goes quiet once measured, 🪫 is one per session (MATH.md §18) and never
     does. Neither takes the caret — ticking tasks off with the keyboard must not land
     it in a number field. -->
<Story
	name="Completion asks both"
	args={{
		ondrainopen: fn(),
		ondrainclose: fn(),
		ondrainsave: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: 'Mark write the calibration section complete',
			}),
		);

		// ⚡'s editor is the row's own, so it is on screen; 🪫's draft is the page's, so
		// the row reports the prompt and this story's mock leaves it unanswered
		await expect(canvas.getByText('⚡ Minutes to reach flow:')).toBeInTheDocument();
		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');

		await expect(canvas.getByPlaceholderText('min')).not.toHaveFocus();
	}}
/>
