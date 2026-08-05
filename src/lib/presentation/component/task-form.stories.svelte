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
			// A profile with no history: nothing to suggest, so every task is rated by
			// hand on the form's own defaults.
			suggest: fn(() => []),
			isOpen: true,
		},
	});

	// Two rated titles that share a word, through the real matcher rather than a
	// hand-written stub, so the stories exercise the two-character floor and the
	// ordering the store would actually answer with (ROADMAP item 24).
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

	// More matches than the list can show at once: `max-h-56` is about seven rows
	// and `suggestTitles` caps nothing, so twelve is enough to arrow past the fold.
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

		const physical = canvas.getByRole('slider', {
			name: /Physical Diff/,
		});

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

		// A rating the user set by hand is theirs: emptying the field undoes a pick,
		// and this profile has nothing to pick from, so retyping a title they got
		// wrong must not put the sliders back to the defaults.
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

<!-- The suggestion list is the whole recall path: two characters open it, a
     pick fills the title and all three sliders, and the sliders stay the user's
     afterwards (ROADMAP item 24). -->
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

		// Both matches, alphabetically, and the stored spelling of each
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

		// What the user came for: the recalled rating is a starting point they can
		// still move, and nothing speaks over the drag
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

		// The next task starts from the defaults again, not from the last pick
		await expect(physical).toHaveValue('5');
		await expect(mental).toHaveValue('5');
		await expect(enjoyment).toHaveValue('5');

		// ...and it is not the last pick's rating any more either: a slider set by
		// hand now survives the next cleared title, which a pick's would not
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

<!-- Suggestions are reachable without a mouse, and Enter still deploys the task
     when the user is typing a title the list does not have. -->
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

		// Down through both options and round again, with the input naming the
		// highlighted one for a screen reader
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

		// The pick closes the list, so it takes the highlight with it
		await expect(title).not.toHaveAttribute('aria-activedescendant');

		// An emptied field starts over: a pick's rating goes with the title it was
		// picked for, or the next, unrelated task is deployed wearing it
		await userEvent.clear(title);
		await expect(physical).toHaveValue('5');

		// A field holding nothing but spaces is an empty field — the guard trims —
		// so typing a space over a picked title drops its rating too, without the
		// value ever being ''
		await userEvent.type(title, 'gy');
		await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
		await expect(physical).toHaveValue('8');

		await userEvent.keyboard('{Control>}a{/Control} ');

		await expect(title).toHaveValue(' ');
		await expect(physical).toHaveValue('5');

		// Escape closes the list without touching what was typed or rated
		await userEvent.clear(title);
		await userEvent.type(title, 'gym');
		await userEvent.keyboard('{Escape}');

		await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
		await expect(title).toHaveValue('gym');

		// ...and an arrow key brings it back. The query still matches, so without this
		// the only way to reopen what a keystroke closed is to edit the field — and it
		// highlights the end it was opened from, so a suggestion is one keystroke away
		// rather than two.
		await userEvent.keyboard('{ArrowDown}');

		await expect(canvas.getByRole('listbox')).toBeInTheDocument();

		await expect(title).toHaveAttribute(
			'aria-activedescendant',
			canvas.getByRole('option', {
				name: 'Gym admin',
			}).id,
		);

		// Escape drops the highlight along with the list that named it
		await userEvent.keyboard('{Escape}');
		await expect(title).not.toHaveAttribute('aria-activedescendant');

		// ArrowUp reopens it too, from the other end
		await userEvent.keyboard('{ArrowUp}');

		await expect(title).toHaveAttribute(
			'aria-activedescendant',
			canvas.getByRole('option', {
				name: 'Gym session',
			}).id,
		);

		// Tabbing away takes the highlight with the list: aria-activedescendant may
		// not outlive the element it names
		await userEvent.tab();

		await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
		await expect(title).not.toHaveAttribute('aria-activedescendant');

		// Enter with nothing highlighted is the form's own submit, or the list would
		// take the only keyboard way to deploy a task
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

<!-- The list is uncapped, so it can be taller than the box that shows it: the
     highlight has to bring its row into view or it is a highlight nobody sees. -->
<Story
	name="Arrowing past the fold scrolls the list"
	args={{
		suggest: fn(suggestRuns),
	}}
	play={async ({ canvas, userEvent }) => {
		const title = canvas.getByLabelText('Task Definition');

		await userEvent.type(title, 'run');

		const list = canvas.getByRole('listbox');

		// The premise: twelve matches in a box that shows about seven
		await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
		await expect(list.scrollTop).toBe(0);

		for (let step = 0; step < 10; step++) await userEvent.keyboard('{ArrowDown}');

		await expect(
			canvas.getByRole('option', {
				selected: true,
			}),
		).toBeInTheDocument();

		await expect(list.scrollTop).toBeGreaterThan(0);

		// Reopening from the other end highlights the last row — whose `<li>` does not
		// exist yet at the moment the key is handled, so the scroll can only work if it
		// waits for the patched DOM
		await userEvent.keyboard('{Escape}');
		await userEvent.keyboard('{ArrowUp}');

		await expect(canvas.getByRole('listbox').scrollTop).toBeGreaterThan(0);
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
