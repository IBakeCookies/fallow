<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, within } from 'storybook/test';
	import { getTaskNature, type SuggestedTask } from '$lib/business/model/metric/calculation';
	import TaskList from '$lib/presentation/component/task-list.svelte';
	import { buildDayTimeline } from '$lib/presentation/utils/day-timeline';
	import type { RowMeasurements } from '$lib/presentation/utils/measurement-editor.svelte';

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
		// gone — the run order is a next-up reading
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

	const measurements = {
		flowDraft: null,
		drainLogs: [],
		drainDraft: null,
		openFlowLog: fn(),
		editFlowLog: fn(),
		closeFlowLog: fn(),
		saveFlowLog: fn(),
		clearFlowLog: fn(),
		closeDrainLog: fn(),
		saveDrainLog: fn(),
		editDrainLog: fn(),
		deleteDrainLog: fn(),
	} satisfies RowMeasurements;

	const { Story } = defineMeta({
		title: 'Component/Task List',
		component: TaskList,
		tags: ['autodocs'],
		args: {
			locale: 'en-US',
			suggestedTasks: tasks,
			// The fixture's own day, so the default list carries no slide badge: every
			// task in it was added on the day being viewed.
			viewedDate: '2026-07-20',
			constantsFitted: false,
			// Run order is not priority order — the alternation is a heuristic over the
			// funded set — so boxing leads a sequence it ranks second in.
			// Every funded task holds a position, the completed one included.
			runOrder: new Map([
				[2, 1],
				[3, 2],
				[1, 3],
			]),
			ontoggle: fn(),
			onremove: fn(),
			measurementsOf: () => measurements,
			onupdate: fn(),
		},
	});

	/** Two the plan funded, two it dropped. */
	const twoGroups: SuggestedTask[] = [
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
	];

	const twoGroupsOrder = new Map([
		[1, 1],
		[2, 2],
	]);

	/** Five funded tasks, so the list is read at its full length. */
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

<Story
	name="One list, one row per task"
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
		// One list of five rows and no table at all: every reading is the row's own, so
		// nothing on this screen has a column to line up in.
		expect(canvas.queryByRole('table')).not.toBeInTheDocument();
		expect(canvas.getAllByRole('list')).toHaveLength(1);
		expect(canvas.getAllByRole('listitem')).toHaveLength(5);

		// The row holds the task's own editors, so the plan's hours and what a phone reads
		// stay together in one box per task.
		const [first] = canvas.getAllByRole('listitem');

		await expect(first).toContainElement(canvas.getByText('#1'));
		await expect(first).toContainElement(canvas.getByText('prio 25.3'));
	}}
/>

<Story
	name="Default"
	play={async ({ canvas }) => {
		// The day the plan drops a task: two headed groups, the funded one in `#N` order. A completed
		// task holds its slot in that sequence — the order is the plan's, not the remainder's — so
		// ticking a row off never moves it out from under the 🪫 about to be logged on it.
		//
		// PIN: read through the row titles and the badges rather than the markup around them, so it
		// holds across the row's own shape changing.
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
		).toEqual(['Plan', 'boxing', 'stretching', 'write the calibration section', 'inbox']);

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

<Story
	name="Next rides the row it names"
	args={{
		nextTaskId: 1,
	}}
	play={async ({ canvas }) => {
		// The re-plan's position 1 marks its own row rather than naming the task on the
		// card's heading, so the answer to "what now" is on the thing to act on and the
		// title is printed once.
		const next = canvas.getByRole('button', {
			name: 'Next',
		});

		const row = canvas
			.getByRole('heading', {
				name: 'write the calibration section',
			})
			.closest('li');

		expect(row).toContainElement(next);

		// The row it lands on is `#3` in the morning plan: the two orders are read from
		// different bases and a badge is not moved to make them agree.
		expect(row).toContainElement(canvas.getByText('#3'));
	}}
/>

<Story
	name="Two headed groups"
	args={{
		suggestedTasks: twoGroups,
		runOrder: twoGroupsOrder,
		timeline: buildDayTimeline({
			suggestedTasks: twoGroups,
			runOrder: twoGroupsOrder,
			switchCost: 0.25,
			availableHours: 8,
		}),
	}}
	play={async ({ canvas }) => {
		// The plan's two answers about a task read as two headed lists, so a row is never
		// under a heading that says the opposite of what the plan did with it.
		const sequence = canvas.getByText("Today's sequence");
		const dropped = canvas.getByText('No time today');

		await expect(sequence).toBeVisible();
		await expect(dropped).toBeVisible();

		// The label names its list rather than heading it: every row title is an `<h3>`, so
		// an `<h4>` here would be closed by the first row under it and the second group
		// would read as part of the last task. `aria-label` carries the name instead.
		for (const label of [sequence, dropped]) expect(label.tagName).toBe('P');

		const lists = canvas.getAllByRole('list');

		expect(lists).toHaveLength(2);

		// And the split is the plan's: the two funded rows above, the two it dropped below
		await expect(lists[0]).toHaveAccessibleName("Today's sequence");
		await expect(lists[1]).toHaveAccessibleName('No time today');

		expect([...lists[0].querySelectorAll('h3')].map((row) => row.textContent)).toEqual([
			'design the error boundary',
			'write the PDF solution',
		]);

		expect([...lists[1].querySelectorAll('h3')].map((row) => row.textContent)).toEqual([
			'reorganize the garage',
			'inbox',
		]);

		// And the two are ruled apart — the break the table drew with a second `<thead>`.
		// On the second group only: a rule above the first would divide it from the day
		// strip, which is not a claim the plan makes.
		expect(dropped.parentElement).toHaveClass('border-t');
		expect(sequence.parentElement).not.toHaveClass('border-t');

		// A rail under every funded row and under no unfunded one: the plan gave the
		// second group no hours to draw.
		expect(within(lists[0]).getAllByText('warming up')).toHaveLength(2);
		expect(within(lists[1]).queryByText('warming up')).toBeNull();
		// No rail means no line for one either: the unfunded row is its two columns alone.
		expect(lists[1].querySelector('li')!.childElementCount).toBe(1);
	}}
/>

<Story
	name="Nothing dropped"
	args={{
		suggestedTasks: tasks.filter((task) => task.suggestedHours > 0),
	}}
	play={async ({ canvas }) => {
		// Nothing dropped is the common day: one plain group, and a heading over every row saying the
		// same thing about all of them would say nothing
		const heading = canvas.getByRole('heading', {
			name: 'Plan',
		});

		const list = canvas.getByRole('list');

		expect(canvas.getAllByRole('listitem')).toHaveLength(3);

		expect(
			canvas.queryByRole('heading', {
				name: "Today's sequence",
			}),
		).not.toBeInTheDocument();

		// No form supplied, so nothing sits between the heading's row and the list. Read
		// from the row, not the heading: the heading shares it with the day's actions.
		expect(heading.parentElement?.nextElementSibling?.contains(list)).toBe(true);
	}}
/>

<Story
	name="Empty"
	args={{
		suggestedTasks: [],
		runOrder: new Map(),
	}}
	play={async ({ canvas }) => {
		// An empty <ul> announces "list, 0 items" over the copy that explains the day is empty
		await expect(canvas.getByText('No tasks deployed yet')).toBeVisible();
		await expect(canvas.getByText('Add a task to begin tracking')).toBeVisible();
		expect(canvas.queryByRole('list')).not.toBeInTheDocument();
	}}
/>

<Story
	name="With form"
	play={async ({ canvas }) => {
		// The form this list is handed goes into the card's dialog, so passing one adds a way IN beside
		// the heading and costs the ledger no height
		const heading = canvas.getByRole('heading', {
			name: 'Plan',
		});

		// The default day splits, so the funded group's list is the first of the two.
		const [list] = canvas.getAllByRole('list');

		expect(heading.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(canvas.queryByText('add a task')).not.toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'Add task',
			}),
		).toBeVisible();
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
		// Day 1 is the day the task was added, so three carried days reads DAY 4. The gate keeps an
		// ordinary deferral off the row, which already carries up to three badges.
		const row = (title: string) =>
			within(
				canvas
					.getByRole('heading', {
						name: title,
					})
					.closest('li')!,
			);

		await expect(row('tax return').getByText('day 4')).toBeVisible();
		expect(row('inbox').queryByText(/^day /)).not.toBeInTheDocument();
		expect(row('call the dentist').queryByText(/^day /)).not.toBeInTheDocument();

		// A fact about the task and not about the plan, so ticking the row off — which
		// retires its `#N` — leaves the badge where it is.
		await expect(row('the shed').getByText('day 4')).toBeVisible();
	}}
/>
