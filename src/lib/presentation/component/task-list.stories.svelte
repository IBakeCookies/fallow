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

	const tasks: SuggestedTask[] = [
		task(1, 'write the calibration section', {
			suggestedHours: 1.75,
			priorityScore: 12.4,
		}),
		task(2, 'boxing', {
			physicalDifficulty: 8,
			mentalDifficulty: 2,
			enjoyment: 9,
		}),
		task(3, 'inbox', {
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
			runOrder: new Map([
				[1, 1],
				[2, 2],
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

<!-- One item per task, each carrying its run order; no form supplied, so the
     list follows the heading row immediately — not even an empty wrapper between them -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		const heading = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		// A list, so a screen reader announces how many tasks the day holds
		await expect(canvas.getByRole('list')).toBeInTheDocument();
		expect(canvas.getAllByRole('listitem')).toHaveLength(3);

		await expect(canvas.getByText('write the calibration section')).toBeVisible();
		await expect(canvas.getByText('boxing')).toBeVisible();
		await expect(canvas.getByText('#1')).toBeVisible();
		await expect(canvas.getByText('#2')).toBeVisible();

		// No form supplied, so nothing sits between the heading and the list
		expect(heading.nextElementSibling).toBe(canvas.getByRole('list'));
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

		expect(form.compareDocumentPosition(canvas.getByRole('list'))).toBe(
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
