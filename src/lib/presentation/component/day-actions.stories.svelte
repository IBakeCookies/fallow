<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, waitFor, within } from 'storybook/test';
	import type { DailySession, SavedRoutine, Task } from '$lib/business/type';
	import DayActions from '$lib/presentation/component/day-actions.svelte';

	const task = (id: number, title: string): Task => ({
		id,
		title,
		physicalDifficulty: 3,
		mentalDifficulty: 7,
		enjoyment: 6,
		createdAt: '2026-07-19',
		completed: false,
	});

	const yesterdaySession: DailySession = {
		date: '2026-07-19',
		tasks: [
			{
				...task(1, 'boxing'),
				importance: 'high',
				tags: ['exercise'],
			},
			task(2, 'writing'),
		],
		availableHours: 6,
		switchCost: 0.25,
		updatedAt: 1,
	};

	const routines: SavedRoutine[] = [
		{
			id: 'r1',
			name: 'Morning',
			tasks: [
				{
					title: 'stretch',
					physicalDifficulty: 4,
					mentalDifficulty: 1,
					enjoyment: 8,
				},
			],
			createdAt: 1,
		},
	];

	// bits-ui's modal menu locks pointer-events on <body> while open and lifts
	// it only after the exit transition, so every (re)open first waits the lock
	// out. Plays also close their menus before returning: the a11y afterEach
	// runs axe on whatever is left mounted, and an open load menu trips
	// aria-required-children (the date input inside role="menu").
	const whenClickable = (el: Element) =>
		waitFor(() => expect(getComputedStyle(el).pointerEvents).not.toBe('none'));

	const { Story } = defineMeta({
		title: 'Component/Day Actions',
		component: DayActions,
		tags: ['autodocs'],
		args: {
			selectedDate: '2026-07-20',
			today: '2026-07-20',
			yesterdaySession: null,
			routines: [],
			currentTasks: [],
			timer: null,
			getSuggestedMinutes: () => 45,
			onimport: fn(),
			onimportdate: fn(() => Promise.resolve(0)),
			onsaveroutine: fn(),
			ondeleteroutine: fn(),
		},
	});
</script>

<Story
	name="Today, empty"
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		// Nothing to save yet; Load still offers "from a date" — and a picked day with no tasks shows a
		// hint the reopened menu has forgotten
		// Load stays available even with nothing saved — any past day can be
		// imported by date. Save has nothing to offer.
		const load = canvas.getByRole('button', {
			name: 'Load',
		});

		await expect(
			canvas.queryByRole('button', {
				name: 'Save',
			}),
		).not.toBeInTheDocument();

		await whenClickable(load);
		await userEvent.click(load);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByLabelText('Load from a day')).toBeVisible());
		await userEvent.type(body.getByLabelText('Load from a day'), '2026-07-15');

		await waitFor(() => expect(args.onimportdate).toHaveBeenCalledWith('2026-07-15'));
		await waitFor(() => expect(body.getByText('No tasks on that day')).toBeVisible());

		// A closed menu holds no draft: the next open starts from an empty picker,
		// not from last time's failed lookup.
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
		await whenClickable(load);
		await userEvent.click(load);
		await waitFor(() => expect(body.getByLabelText('Load from a day')).toHaveValue(''));
		await expect(body.queryByText('No tasks on that day')).not.toBeInTheDocument();

		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
	}}
/>

<Story
	name="Today with routines and yesterday"
	args={{
		yesterdaySession,
		routines,
		currentTasks: [task(1, 'boxing'), task(2, 'writing')],
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		// The full load menu: yesterday's tasks import whole, routines import by
		// click or Enter, and deleting takes two presses
		const body = within(canvasElement.ownerDocument.body);

		const load = canvas.getByRole('button', {
			name: 'Load',
		});

		await whenClickable(load);
		await userEvent.click(load);

		await waitFor(() =>
			expect(
				body.getByRole('menuitem', {
					name: 'Yesterday (2 tasks)',
				}),
			).toBeVisible(),
		);

		await userEvent.click(
			body.getByRole('menuitem', {
				name: 'Yesterday (2 tasks)',
			}),
		);

		// The day's tasks whole, not a projection of them: `importTasks` is where a
		// task is stripped to its definition, so no field can go missing on this
		// path alone — `tags` already did, and `importance` did after it.
		await expect(args.onimport).toHaveBeenNthCalledWith(1, yesterdaySession.tasks);

		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());

		// A routine imports its tasks as-is.
		await whenClickable(load);
		await userEvent.click(load);
		await waitFor(() => expect(body.getByText('Saved Routines')).toBeVisible());

		await userEvent.click(
			body.getByRole('menuitem', {
				name: 'Morning (1)',
			}),
		);

		await expect(args.onimport).toHaveBeenNthCalledWith(2, routines[0].tasks);
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());

		// Deleting takes two presses — the first only arms it, and Cancel backs
		// out without closing the menu.
		await whenClickable(load);
		await userEvent.click(load);

		await waitFor(() =>
			expect(
				body.getByRole('menuitem', {
					name: 'Delete routine Morning',
				}),
			).toBeInTheDocument(),
		);

		await userEvent.click(
			body.getByRole('menuitem', {
				name: 'Delete routine Morning',
			}),
		);

		await userEvent.click(
			body.getByRole('menuitem', {
				name: 'Cancel',
			}),
		);

		await expect(args.ondeleteroutine).not.toHaveBeenCalled();

		await expect(
			body.getByRole('menuitem', {
				name: 'Delete routine Morning',
			}),
		).toBeInTheDocument();

		await expect(
			body.queryByRole('menuitem', {
				name: 'Cancel',
			}),
		).not.toBeInTheDocument();

		// The second press deletes.
		await userEvent.click(
			body.getByRole('menuitem', {
				name: 'Delete routine Morning',
			}),
		);

		await userEvent.click(
			body.getByRole('menuitem', {
				name: 'Delete Morning?',
			}),
		);

		await expect(args.ondeleteroutine).toHaveBeenCalledTimes(1);
		await expect(args.ondeleteroutine).toHaveBeenCalledWith('r1');

		// Enter on the focused row imports too — the row is the menu item itself,
		// not a button nested inside one, so bits-ui's selection key reaches it.
		body
			.getByRole('menuitem', {
				name: 'Morning (1)',
			})
			.focus();

		await userEvent.keyboard('{Enter}');
		await expect(args.onimport).toHaveBeenNthCalledWith(3, routines[0].tasks);
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());

		// Typing owns the date field: unguarded, the menu would read 'm' as
		// typeahead and pull focus onto "Morning" mid-entry.
		await whenClickable(load);
		await userEvent.click(load);
		const dateField = await waitFor(() => body.getByLabelText('Load from a day'));
		dateField.focus();
		await userEvent.keyboard('m');
		await expect(canvasElement.ownerDocument.activeElement).toBe(dateField);

		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
	}}
/>

<Story
	name="Viewing a past day"
	args={{
		selectedDate: '2026-07-14',
		yesterdaySession,
		routines,
		currentTasks: [task(3, 'now')],
	}}
	play={async ({ canvas }) => {
		// A past day is corrected like today, so both menus stay: Load is how tasks get
		// into a day being corrected, and Save reads the day rather than rewriting it.
		await expect(
			canvas.getByRole('button', {
				name: 'Load',
			}),
		).toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		).toBeInTheDocument();
	}}
/>

<Story
	name="Viewing tomorrow"
	args={{
		selectedDate: '2026-07-21',
		yesterdaySession,
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		// "Yesterday" is relative to today, so any other day drops the shortcut; loading by date
		// remains
		const load = canvas.getByRole('button', {
			name: 'Load',
		});

		await whenClickable(load);
		await userEvent.click(load);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByLabelText('Load from a day')).toBeVisible());
		await expect(body.queryByText(/Yesterday/)).not.toBeInTheDocument();

		// Load and Save read on a day being planned; a 🪫 measurement is today's alone,
		// so the timer that fills one is too.
		await expect(
			canvas.queryByRole('button', {
				name: 'Start timer',
			}),
		).not.toBeInTheDocument();

		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
	}}
/>

<Story
	name="Picked day has tasks"
	args={{
		onimportdate: fn(() => Promise.resolve(2)),
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		// Picking a day that has tasks imports them and closes the menu
		const load = canvas.getByRole('button', {
			name: 'Load',
		});

		await whenClickable(load);
		await userEvent.click(load);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByLabelText('Load from a day')).toBeVisible());
		await userEvent.type(body.getByLabelText('Load from a day'), '2026-07-15');

		await waitFor(() => expect(args.onimportdate).toHaveBeenCalledWith('2026-07-15'));
		await expect(args.onimportdate).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(body.queryByLabelText('Load from a day')).not.toBeInTheDocument());
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
	}}
/>

<Story
	name="With tasks to save"
	args={{
		currentTasks: [task(3, 'now')],
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		// With tasks on the day, Save appears: a blank routine name is ignored, a padded one is trimmed
		const save = canvas.getByRole('button', {
			name: 'Save',
		});

		await whenClickable(save);
		await userEvent.click(save);
		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() =>
			expect(
				body.getByRole('button', {
					name: 'Save routine',
				}),
			).toBeVisible(),
		);

		await userEvent.click(
			body.getByRole('button', {
				name: 'Save routine',
			}),
		);

		await expect(args.onsaveroutine).not.toHaveBeenCalled();

		await userEvent.type(body.getByPlaceholderText('Routine name...'), '  Deep work  ');

		await userEvent.click(
			body.getByRole('button', {
				name: 'Save routine',
			}),
		);

		await expect(args.onsaveroutine).toHaveBeenCalledTimes(1);
		await expect(args.onsaveroutine).toHaveBeenCalledWith('Deep work');
		await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
	}}
/>

<Story
	name="Nothing to carry"
	args={{
		carryCount: 0,
		oncarry: fn(),
		currentTasks: [
			{
				...task(1, 'boxing'),
				completed: true,
			},
			{
				...task(2, 'writing'),
				completed: true,
			},
		],
	}}
	play={async ({ canvas }) => {
		// Every task done: a completed task is history, so there is nothing to send on and
		// the control is not drawn — Save still reads the day.
		await expect(
			canvas.queryByRole('button', {
				name: /Carry \d+ to tomorrow/,
			}),
		).not.toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		).toBeInTheDocument();
	}}
/>
