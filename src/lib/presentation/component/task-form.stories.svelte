<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fireEvent, fn } from 'storybook/test';
	import TaskForm from '$lib/presentation/component/task-form.svelte';
	import { latestRatingsByTitle, suggestTitles } from '$lib/business/model/title-memory';

	const { Story } = defineMeta({
		title: 'Component/Task Form',
		component: TaskForm,
		tags: ['autodocs'],
		args: {
			onsubmit: fn(),
			// A profile with no history: every task is rated by hand on the defaults.
			suggest: fn(() => []),
		},
	});

	// Two rated titles sharing a word, through the real matcher rather than a stub,
	// so the stories exercise the two-character floor and the store's own ordering.
	const rated = latestRatingsByTitle([
		{
			date: '2026-08-01',
			tasks: [
				{
					id: 1,
					title: 'Gym session',
					physicalDifficulty: 8,
					mentalDifficulty: 2,
					enjoyment: 3,
					createdAt: '2026-08-01',
					completed: false,
				},
				{
					id: 2,
					title: 'Gym admin',
					physicalDifficulty: 0,
					mentalDifficulty: 6,
					enjoyment: 1,
					createdAt: '2026-08-01',
					completed: false,
				},
			],
			availableHours: 4,
			switchCost: 0.25,
			updatedAt: 0,
		},
	]);

	const suggestGym = (query: string) => suggestTitles(rated, query);

	// `max-h-56` is about five rows and `suggestTitles` caps nothing, so twelve matches arrow past the fold.
	const manyRuns = latestRatingsByTitle([
		{
			date: '2026-08-01',
			tasks: [...Array(12).keys()].map((index) => ({
				id: index + 1,
				title: `Run ${index + 1}`,
				physicalDifficulty: 6,
				mentalDifficulty: 1,
				enjoyment: 7,
				createdAt: '2026-08-01',
				completed: false,
			})),
			availableHours: 4,
			switchCost: 0.25,
			updatedAt: 0,
		},
	]);

	const suggestRuns = (query: string) => suggestTitles(manyRuns, query);

	// Two titles that differ only after the width of the field, plus a short one as
	// the single-line yardstick: a clipped row renders the pair identically.
	const sharedPrefix = [
		'Gym',
		'Morning gym session at the riverside club before the first meeting',
		'Morning gym session at the riverside club before the second meeting',
	];

	const longRated = latestRatingsByTitle([
		{
			date: '2026-08-01',
			tasks: sharedPrefix.map((title, index) => ({
				id: index + 1,
				title,
				physicalDifficulty: 7,
				mentalDifficulty: 3,
				enjoyment: 5,
				createdAt: '2026-08-01',
				completed: false,
			})),
			availableHours: 4,
			switchCost: 0.25,
			updatedAt: 0,
		},
	]);

	const suggestLong = (query: string) => suggestTitles(longRated, query);
</script>

<Story
	name="Default"
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

		const physical = canvas.getByRole('slider', {
			name: /Physical Diff/,
		});

		const deploy = canvas.getByRole('button', {
			name: 'Deploy Task',
		});

		await userEvent.click(deploy);
		await expect(args.onsubmit).not.toHaveBeenCalled();

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

		// The dialog around this form stays open on deploy, so the caret goes back to
		// where the next task starts — a click on Deploy left it on the button.
		await expect(title).toHaveFocus();

		// The flag stops the advisor moving a task that cannot move, so it must survive the submit
		const mustDo = canvas.getByLabelText('Keep on today');
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

		// A rating set by hand is the user's: clearing the field undoes a pick, and
		// this profile has none, so a retyped title must not reset the sliders.
		await fireEvent.input(physical, {
			target: {
				value: '9',
			},
		});

		await userEvent.type(title, 'Cold punge');
		await userEvent.clear(title);

		await expect(physical).toHaveValue('9');
	}}
/>

<Story
	name="Picking a suggestion fills the sliders"
	args={{
		suggest: fn(suggestGym),
	}}
	play={async ({ args, canvas, userEvent }) => {
		const title = canvas.getByLabelText('Task Definition');

		const physical = canvas.getByRole('slider', {
			name: /Physical Diff/,
		});

		const mental = canvas.getByRole('slider', {
			name: /Mental Diff/,
		});

		const enjoyment = canvas.getByRole('slider', {
			name: /Enjoyment/,
		});

		// One character is not a query yet: no popup over a form being typed in
		await userEvent.type(title, 'g');
		await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
		await expect(title).toHaveAttribute('aria-expanded', 'false');

		// The second opens it, on the words rather than the spelling
		await userEvent.type(title, 'Y');
		await expect(canvas.getByRole('listbox')).toBeInTheDocument();
		await expect(title).toHaveAttribute('aria-expanded', 'true');

		await expect(canvas.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual([
			'Gym admin',
			'Gym session',
		]);

		// Nothing has moved yet — the sliders answer to a pick, not to typing
		await expect(physical).toHaveValue('5');

		await userEvent.click(
			canvas.getByRole('option', {
				name: 'Gym session',
			}),
		);

		await expect(title).toHaveValue('Gym session');
		await expect(physical).toHaveValue('8');
		await expect(mental).toHaveValue('2');
		await expect(enjoyment).toHaveValue('3');

		// The list closes on the pick, though the chosen title still matches itself
		await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();

		// What the user came for: the recalled rating is a starting point they can still move
		await fireEvent.input(mental, {
			target: {
				value: '6',
			},
		});

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Deploy Task',
			}),
		);

		await expect(args.onsubmit).toHaveBeenCalledExactlyOnceWith({
			title: 'Gym session',
			physicalDifficulty: 8,
			mentalDifficulty: 6,
			enjoyment: 3,
			mustDoToday: false,
		});

		await expect(physical).toHaveValue('5');
		await expect(mental).toHaveValue('5');
		await expect(enjoyment).toHaveValue('5');

		// ...and not the last pick's either: a hand-set slider survives the next cleared title
		await fireEvent.input(physical, {
			target: {
				value: '9',
			},
		});

		await userEvent.type(title, 'Tax return');
		await userEvent.clear(title);

		await expect(physical).toHaveValue('9');
	}}
/>

<Story
	name="Clearing a picked title resets every rating"
	args={{
		suggest: fn(suggestGym),
	}}
	play={async ({ canvas, userEvent }) => {
		const title = canvas.getByLabelText('Task Definition');
		const mustDo = canvas.getByLabelText('Keep on today');

		const physical = canvas.getByRole('slider', {
			name: /Physical Diff/,
		});

		const mental = canvas.getByRole('slider', {
			name: /Mental Diff/,
		});

		const enjoyment = canvas.getByRole('slider', {
			name: /Enjoyment/,
		});

		await userEvent.type(title, 'gym');

		await userEvent.click(
			canvas.getByRole('option', {
				name: 'Gym session',
			}),
		);

		await userEvent.click(mustDo);

		await expect(physical).toHaveValue('8');
		await expect(mental).toHaveValue('2');
		await expect(enjoyment).toHaveValue('3');

		await userEvent.clear(title);

		await expect(physical).toHaveValue('5');
		await expect(mental).toHaveValue('5');
		await expect(enjoyment).toHaveValue('5');

		await expect(title).toHaveValue('');
		await expect(mustDo).toBeChecked();
	}}
/>

<Story
	name="Keyboard"
	args={{
		suggest: fn(suggestGym),
	}}
	play={async ({ args, canvas, userEvent }) => {
		const title = canvas.getByLabelText('Task Definition');

		const physical = canvas.getByRole('slider', {
			name: /Physical Diff/,
		});

		await userEvent.type(title, 'gym');

		// Down through both options and round again — the wrap is why two more land back on the first
		await userEvent.keyboard('{ArrowDown}');

		await expect(title).toHaveAttribute(
			'aria-activedescendant',
			canvas.getByRole('option', {
				name: 'Gym admin',
			}).id,
		);

		await userEvent.keyboard('{ArrowDown}{ArrowDown}');

		await expect(title).toHaveAttribute(
			'aria-activedescendant',
			canvas.getByRole('option', {
				name: 'Gym admin',
			}).id,
		);

		// ...and up, wrapping to the last
		await userEvent.keyboard('{ArrowUp}');
		await userEvent.keyboard('{Enter}');

		await expect(title).toHaveValue('Gym session');
		await expect(physical).toHaveValue('8');
		await expect(args.onsubmit).not.toHaveBeenCalled();

		await expect(title).not.toHaveAttribute('aria-activedescendant');

		// An emptied field starts over, or the next unrelated task deploys wearing the pick's rating
		await userEvent.clear(title);
		await expect(physical).toHaveValue('5');

		// A field of nothing but spaces is empty — the guard trims — so a space over a
		// picked title drops its rating without the value ever being ''
		await userEvent.type(title, 'gy');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
		await expect(physical).toHaveValue('8');

		await userEvent.keyboard('{Control>}a{/Control} ');

		await expect(title).toHaveValue(' ');
		await expect(physical).toHaveValue('5');

		await userEvent.clear(title);
		await userEvent.type(title, 'gym');
		await userEvent.keyboard('{Escape}');

		await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
		await expect(title).toHaveValue('gym');

		// ...and an arrow brings it back, from the end it was opened from: otherwise the
		// only way to reopen what a keystroke closed is to edit the field
		await userEvent.keyboard('{ArrowDown}');

		await expect(canvas.getByRole('listbox')).toBeInTheDocument();

		await expect(title).toHaveAttribute(
			'aria-activedescendant',
			canvas.getByRole('option', {
				name: 'Gym admin',
			}).id,
		);

		await userEvent.keyboard('{Escape}');
		await expect(title).not.toHaveAttribute('aria-activedescendant');

		await userEvent.keyboard('{ArrowUp}');

		await expect(title).toHaveAttribute(
			'aria-activedescendant',
			canvas.getByRole('option', {
				name: 'Gym session',
			}).id,
		);

		// aria-activedescendant may not outlive the list it names, so tabbing drops both
		await userEvent.tab();

		await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
		await expect(title).not.toHaveAttribute('aria-activedescendant');

		// Enter with nothing highlighted is the form's own submit, or the list takes the only keyboard deploy
		await userEvent.clear(title);
		await userEvent.type(title, 'gym{Enter}');

		await expect(args.onsubmit).toHaveBeenCalledExactlyOnceWith({
			title: 'gym',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 5,
			mustDoToday: false,
		});
	}}
/>

<Story
	name="Arrowing past the fold scrolls the list"
	args={{
		suggest: fn(suggestRuns),
	}}
	play={async ({ canvas, userEvent }) => {
		const title = canvas.getByLabelText('Task Definition');

		await userEvent.type(title, 'run');

		const list = canvas.getByRole('listbox');

		await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
		await expect(list.scrollTop).toBe(0);

		for (let step = 0; step < 10; step++) await userEvent.keyboard('{ArrowDown}');

		await expect(
			canvas.getByRole('option', {
				selected: true,
			}),
		).toBeInTheDocument();

		await expect(list.scrollTop).toBeGreaterThan(0);

		// The last row's `<li>` does not exist yet when the key is handled, so the
		// scroll works only if it waits for the patched DOM
		await userEvent.keyboard('{Escape}');
		await userEvent.keyboard('{ArrowUp}');

		await expect(canvas.getByRole('listbox').scrollTop).toBeGreaterThan(0);
	}}
/>

<Story
	name="A long title is shown whole"
	args={{
		suggest: fn(suggestLong),
	}}
	play={async ({ canvas, userEvent }) => {
		// The default canvas is wide enough to fit these titles whole and would prove nothing
		const title = canvas.getByLabelText('Task Definition');

		await userEvent.type(title, 'gym');

		const [short, ...long] = canvas.getAllByRole('option');

		await expect([short, ...long].map((o) => o.textContent?.trim())).toEqual(sharedPrefix);

		// scrollWidth is what the text needs and clientWidth what it got, so equal means
		// nothing is clipped; the height says these really are too long for one line
		for (const option of long) {
			await expect(option.scrollWidth).toBe(option.clientWidth);
			await expect(option.clientHeight).toBeGreaterThan(short.clientHeight);
		}
	}}
>
	{#snippet template(args)}
		<div class="max-w-sm">
			<TaskForm {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Without the must-do flag"
	args={{
		withMustDoToday: false,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// The Lab's copy: same fields, no must-do flag, and deploying still reports unflagged
		await expect(canvas.queryByLabelText('Keep on today')).not.toBeInTheDocument();

		await userEvent.type(canvas.getByLabelText('Task Definition'), 'Deep work');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Deploy Task',
			}),
		);

		await expect(args.onsubmit).toHaveBeenCalledExactlyOnceWith({
			title: 'Deep work',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 5,
			mustDoToday: false,
		});
	}}
/>

<Story
	name="The controls are tabbed in reading order"
	play={async ({ canvas, userEvent }) => {
		// Reading order and tab order are now the same list, top to bottom, because the dialog gave the
		// form the room to be a plain stack — the `order-*` that used to hoist Deploy onto the title's
		// line is gone, and this is what says so.
		const expected = [
			canvas.getByRole('slider', {
				name: /Physical Diff/,
			}),
			canvas.getByRole('slider', {
				name: /Mental Diff/,
			}),
			canvas.getByRole('slider', {
				name: /Enjoyment/,
			}),
			canvas.getByLabelText('Keep on today'),
			canvas.getByRole('button', {
				name: 'Deploy Task',
			}),
		];

		canvas.getByLabelText('Task Definition').focus();

		for (const control of expected) {
			await userEvent.tab();
			await expect(control).toHaveFocus();
		}
	}}
/>
