<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Task List Card',
		component: TaskListCard,
		tags: ['autodocs'],
	});
</script>

<!-- The frame both screens mount. What the play covers is the one thing the card
     decides for them: the form is above the list, never below it. -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		const heading = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const form = canvas.getByText('add a task');
		const list = canvas.getByRole('list');

		expect(heading.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(form.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(canvas.getAllByRole('listitem')).toHaveLength(2);
	}}
>
	{#snippet template()}
		<div class="max-w-2xl">
			<TaskListCard {rows} {form} />
		</div>
	{/snippet}
</Story>

<!-- No rows: the empty state, and no <ul> at all — an empty one would announce
     "list, 0 items" over the copy that explains the day is empty -->
<Story
	name="Empty"
	play={async ({ canvas }) => {
		await expect(canvas.getByText('No tasks deployed yet')).toBeVisible();
		await expect(canvas.getByText('Add a task above to begin tracking')).toBeVisible();
		expect(canvas.queryByRole('list')).not.toBeInTheDocument();

		// The form stays: the empty day is where the first task gets typed
		await expect(canvas.getByText('add a task')).toBeVisible();
	}}
>
	{#snippet template()}
		<div class="max-w-2xl">
			<TaskListCard rows={null} {form} />
		</div>
	{/snippet}
</Story>

{#snippet form()}
	<p>add a task</p>
{/snippet}

{#snippet rows()}
	<li>write the calibration section</li>
	<li>boxing</li>
{/snippet}
