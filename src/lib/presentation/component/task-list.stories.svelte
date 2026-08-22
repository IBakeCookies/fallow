<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, within } from 'storybook/test';
	import { getTaskNature, type SuggestedTask } from '$lib/business/model/metric/calculation';
	import TaskList from '$lib/presentation/component/task-list.svelte';

	const task = (id: number, title: string, overrides: Partial<SuggestedTask> = {}) => {
		const base = {
			id,
			title,
			physicalDifficulty: 3,
			mentalDifficulty: 7,
			enjoyment: 6,
			createdAt: '2026-07-20',
			completed: false,
			suggestedHours: 1.5,
			priorityScore: 10,
			flowStateTime: 0.5,
			trueEffort: 4,
			trueEnjoyability: 1.5,
			peakProductivity: 1,
			avgProductivity: 0.8,
			optimalHours: 2,
			...overrides,
		};

		// Badge follows the story's difficulties instead of a hardcoded default
		return {
			nature: getTaskNature(base),
			...base,
		} satisfies SuggestedTask;
	};

	// Priority order, like `calculateTaskPlan`'s own output — the list is handed a
	// ranked plan and never re-ranks it
	const tasks: SuggestedTask[] = [
		task(1, 'write the calibration section', {
			suggestedHours: 1.75,
			priorityScore: 12.4,
		}),
		// Funded and already done: it keeps the hours the plan gave it, and its `#N` is
		// gone — the run order is a next-up reading (MATH.md §11.8)
		task(3, 'stretching', {
			physicalDifficulty: 6,
			mentalDifficulty: 1,
			suggestedHours: 0.5,
			priorityScore: 11,
			completed: true,
		}),
		task(2, 'boxing', {
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 9,
		}),
		task(4, 'inbox', {
			suggestedHours: 0,
			priorityScore: 1.2,
			completed: true,
		}),
	];

	const { Story } = defineMeta({
		title: 'Component/Task List',
		component: TaskList,
		tags: ['autodocs'],
		args: {
			suggestedTasks: tasks,
			// The fixture's own day, so the default list carries no slide badge: every
			// task in it was added on the day being viewed.
			viewedDate: '2026-07-20',
			// Run order is not priority order — the alternation is a heuristic over the
			// funded set (MATH.md §16) — so boxing leads a sequence it ranks second in.
			// Every funded task holds a position, the completed one included (§11.8).
			runOrder: new Map([
				[2, 1],
				[3, 2],
				[1, 3],
			]),
			ontoggle: fn(),
			onremove: fn(),
			onflowopen: fn(),
			onflowclose: fn(),
			onlogflow: fn(),
			onupdate: fn(),
		},
	});

	/** Five funded tasks, so the header is read over a full ledger. */
	const fundedFive: SuggestedTask[] = [
		task(1, 'design the error boundary', {
			physicalDifficulty: 0,
			mentalDifficulty: 8,
			enjoyment: 9,
			suggestedHours: 2.5,
			priorityScore: 25.3,
		}),
		task(2, 'write the PDF solution', {
			suggestedHours: 1.75,
			priorityScore: 18.5,
		}),
		task(3, 'review 1 PR API', {
			suggestedHours: 1.5,
			priorityScore: 13.4,
		}),
		task(4, 'review 1 PR APP', {
			suggestedHours: 1.25,
			priorityScore: 12.3,
		}),
		task(5, 'daily', {
			suggestedHours: 0.25,
			priorityScore: 9.1,
		}),
	];
</script>

<!-- Every reading gets a headed column, so the numbers line up down the page and can
     be compared between tasks. The trailing column heads the ✎/✕ strip: its name is
     `sr-only`, so the column shows nothing and still announces as itself. -->
<Story
	name="Headed columns"
	args={{
		suggestedTasks: fundedFive,
		runOrder: new Map([
			[1, 1],
			[2, 2],
			[3, 3],
			[4, 4],
			[5, 5],
		]),
	}}
	play={async ({ canvas }) => {
		expect(canvas.getAllByRole('table')).toHaveLength(1);

		const table = canvas.getByRole('table');

		// One row group per task: the shell is a `<tbody>`, so its spanning editor row
		// can sit under the task's own row without leaving the table.
		expect(table.querySelectorAll('tbody')).toHaveLength(5);

		const headers = [...table.querySelectorAll('thead th')];

		expect(headers.map((header) => header.textContent?.trim())).toEqual([
			'#',
			'Task',
			'Phys',
			'Ment',
			'Enjoy',
			'Effort',
			'Prio',
			'Flow at',
			'Stop by',
			'Logged',
			'Planned',
			'Actions',
		]);

		for (const header of headers) {
			await expect(header).toHaveAttribute('scope', 'col');
		}

		// `Planned` is the second-to-last column, so on a phone it is only reachable by
		// scrolling the ledger — and the identity pair `#`/`Task` is pinned in both the
		// header and the row, or the hours arrive with no task attached to them.
		const isPinned = (cell: Element) => cell.classList.contains('ledger-pin');

		expect(headers.filter(isPinned)).toEqual(headers.slice(0, 2));

		const cells = [...table.querySelectorAll('tbody:first-of-type td')];

		expect(cells.filter(isPinned)).toEqual(cells.slice(0, 2));
	}}
/>

<!-- The day the plan drops a task: two headed groups, the funded one in `#N` order.
     A completed task holds its slot in that sequence — the order is the plan's, not the
     remainder's (MATH.md §11.8) — so ticking a row off never moves it out from under the
     🪫 about to be logged on it.

     PIN: read through the row titles and the badges rather than the markup around them,
     so it holds across the row becoming a table row. -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		// The sequence counts down the page, and the completed task holds position 2
		// between the two active rows instead of sinking below them. The task the plan
		// funded nothing comes last, having no position at all. The card's own title
		// leads the list of `h3`s and is read with them rather than sliced off.
		expect(
			canvas
				.getAllByRole('heading', {
					level: 3,
				})
				.map((row) => row.textContent),
		).toEqual(['Tasks', 'boxing', 'stretching', 'write the calibration section', 'inbox']);

		await expect(canvas.getByText('#1')).toBeVisible();
		await expect(canvas.getByText('#3')).toBeVisible();

		// Its number is spent, not re-used: a done task is not something to run next
		expect(canvas.queryByText('#2')).not.toBeInTheDocument();

		// And it reads under the second group's heading
		expect(
			canvas.getByText('No time today').compareDocumentPosition(
				canvas.getByRole('heading', {
					name: 'inbox',
				}),
			),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	}}
/>

<!-- The plan's two answers about a task read as two row groups of one table, so the
     columns stay aligned across the split instead of becoming two tables' worth of
     independently-sized ones. -->
<Story
	name="Two headed groups"
	args={{
		suggestedTasks: [
			task(1, 'design the error boundary', {
				suggestedHours: 2.5,
			}),
			task(2, 'write the PDF solution', {
				suggestedHours: 1.75,
			}),
			task(3, 'reorganize the garage', {
				suggestedHours: 0,
			}),
			task(4, 'inbox', {
				suggestedHours: 0,
			}),
		],
		runOrder: new Map([
			[1, 1],
			[2, 2],
		]),
	}}
	play={async ({ canvas }) => {
		const sequence = canvas.getByText("Today's sequence");
		const dropped = canvas.getByText('No time today');

		await expect(sequence).toBeVisible();
		await expect(dropped).toBeVisible();

		// A spanning header row, and deliberately no `scope`: every task row is its own
		// `<tbody>`, so `rowgroup` would have headed a group holding no data cells at all.
		// It has to span every column, or the rows below it shift out of their headings.
		const columnCount = canvas.getByRole('table').querySelectorAll('thead th').length;

		for (const heading of [sequence, dropped]) {
			expect(heading.tagName).toBe('TH');
			expect(heading).not.toHaveAttribute('scope');
			expect(heading.getAttribute('colspan')).toBe(String(columnCount));

			// And it is not pinned: a cell as wide as the table has no column to hold
			// still, so a sticky offset would only slide it out of its own row.
			expect(heading).not.toHaveClass('ledger-pin');
		}

		const table = canvas.getByRole('table');

		expect(canvas.getAllByRole('table')).toHaveLength(1);
		expect(table.querySelectorAll('thead')).toHaveLength(1);
		expect(table).toContainElement(sequence);
		expect(table).toContainElement(dropped);
	}}
/>

<!-- Nothing dropped is the common day: one plain group, and a heading over every row
     saying the same thing about all of them would say nothing -->
<Story
	name="Nothing dropped"
	args={{
		suggestedTasks: tasks.filter((task) => task.suggestedHours > 0),
	}}
	play={async ({ canvas }) => {
		const heading = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const table = canvas.getByRole('table');

		expect(table.querySelectorAll('tbody')).toHaveLength(3);

		expect(
			canvas.queryByRole('heading', {
				name: "Today's sequence",
			}),
		).not.toBeInTheDocument();

		// No form supplied, so nothing sits between the heading's row and the table.
		// Read from the row, not the heading: the heading shares it with "Next", and
		// with no next task the heading is that row's only child.
		expect(heading.parentElement?.nextElementSibling?.contains(table)).toBe(true);
	}}
/>

<!-- An empty <table> is the same mistake an empty <ul> was: a grid of nothing,
     announced over the copy that explains the day is empty -->
<Story
	name="Empty"
	args={{
		suggestedTasks: [],
		runOrder: new Map(),
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('No tasks deployed yet')).toBeVisible();
		await expect(canvas.getByText('Add a task below to begin tracking')).toBeVisible();
		expect(canvas.queryByRole('table')).not.toBeInTheDocument();
	}}
/>

<!-- The add-task form lives in this card, at its foot below the ledger: adding and
     reading the plan are one place, and the plan is what the card is read for -->
<Story
	name="With form"
	play={async ({ canvas }) => {
		const heading = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const table = canvas.getByRole('table');
		const form = canvas.getByText('add a task');

		expect(heading.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

		expect(table.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	}}
>
	{#snippet template(args)}
		<TaskList {...args}>
			{#snippet form()}
				<p>add a task</p>
			{/snippet}
		</TaskList>
	{/snippet}
</Story>

<!-- Day 1 is the day the task was added, so three carried days reads DAY 4. The gate
     keeps an ordinary deferral off the row, which already carries up to three badges. -->
<Story
	name="Chronic slides"
	args={{
		viewedDate: '2026-07-23',
		suggestedTasks: [
			task(1, 'tax return', {
				createdAt: '2026-07-20',
			}),
			task(2, 'inbox', {
				createdAt: '2026-07-23',
			}),
			task(3, 'call the dentist', {
				createdAt: '2026-07-21',
			}),
			task(4, 'the shed', {
				createdAt: '2026-07-20',
				completed: true,
			}),
		],
		runOrder: new Map([
			[1, 1],
			[2, 2],
			[3, 3],
			[4, 4],
		]),
	}}
	play={async ({ canvas }) => {
		const row = (title: string) =>
			within(
				canvas
					.getByRole('heading', {
						name: title,
					})
					.closest('tbody')!,
			);

		await expect(row('tax return').getByText('day 4')).toBeVisible();
		expect(row('inbox').queryByText(/^day /)).not.toBeInTheDocument();
		expect(row('call the dentist').queryByText(/^day /)).not.toBeInTheDocument();

		// A fact about the task and not about the plan, so ticking the row off — which
		// retires its `#N` — leaves the badge where it is.
		await expect(row('the shed').getByText('day 4')).toBeVisible();
	}}
/>
