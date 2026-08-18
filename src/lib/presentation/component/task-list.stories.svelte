<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
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
</script>

<!-- The day the plan drops a task: two headed groups, the funded one in `#N` order.
     A completed task holds its slot in that sequence — the order is the plan's, not the
     remainder's (MATH.md §11.8) — so ticking a row off never moves it out from under the
     🪫 about to be logged on it. -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		const [sequence, dropped] = canvas.getAllByRole('list');

		await expect(
			canvas.getByRole('heading', {
				name: "Today's sequence",
			}),
		).toBeVisible();

		await expect(
			canvas.getByRole('heading', {
				name: 'No time today',
			}),
		).toBeVisible();

		// The sequence counts down the page, and the completed task holds position 2
		// between the two active rows instead of sinking below them
		expect([...sequence.querySelectorAll('li')].map((row) => row.textContent)).toEqual([
			expect.stringContaining('boxing'),
			expect.stringContaining('stretching'),
			expect.stringContaining('write the calibration section'),
		]);

		await expect(canvas.getByText('#1')).toBeVisible();
		await expect(canvas.getByText('#3')).toBeVisible();

		// Its number is spent, not re-used: a done task is not something to run next
		expect(canvas.queryByText('#2')).not.toBeInTheDocument();

		// The plan funded it nothing, so it reads under the second heading and carries
		// no position
		expect([...dropped.querySelectorAll('li')].map((row) => row.textContent)).toEqual([
			expect.stringContaining('inbox'),
		]);
	}}
/>

<!-- Nothing dropped is the common day: one plain list, and a heading over every row
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

		// A list, so a screen reader announces how many tasks the day holds
		expect(canvas.getAllByRole('list')).toHaveLength(1);
		expect(canvas.getAllByRole('listitem')).toHaveLength(3);

		expect(
			canvas.queryByRole('heading', {
				name: "Today's sequence",
			}),
		).not.toBeInTheDocument();

		// No form supplied, so nothing sits between the heading's row and the list.
		// Read from the row, not the heading: the heading shares it with "Next", and
		// with no next task the heading is that row's only child.
		expect(heading.parentElement?.nextElementSibling).toBe(canvas.getByRole('list'));
	}}
/>

<!-- An empty <ul> would announce "list, 0 items" over the empty-state copy -->
<Story
	name="Empty"
	args={{
		suggestedTasks: [],
		runOrder: new Map(),
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('No tasks deployed yet')).toBeVisible();
		await expect(canvas.getByText('Add a task above to begin tracking')).toBeVisible();
		expect(canvas.queryByRole('list')).not.toBeInTheDocument();
	}}
/>

<!-- The add-task form lives in this card, between the heading and the list:
     adding and reading the plan are one place -->
<Story
	name="With form"
	play={async ({ canvas }) => {
		const heading = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const form = canvas.getByText('add a task');

		expect(heading.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

		expect(form.compareDocumentPosition(canvas.getAllByRole('list')[0])).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
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
