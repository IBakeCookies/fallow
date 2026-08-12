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

<!-- The frame both screens mount. What the play covers is the two things the card
     decides for them: the form is above the list, never below it, and the screen's
     own heading content shares the heading's row rather than costing one of its own. -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		const title = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const form = canvas.getByText('add a task');
		const list = canvas.getByRole('list');

		expect(title.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(form.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(canvas.getAllByRole('listitem')).toHaveLength(2);

		// Inside the heading's row, not merely before the form: a sibling of the card's
		// sections would be the block that pushed the list out of line with the metrics
		// beside it, which is what moving it here undid.
		expect(title.parentElement?.contains(canvas.getByText('beside the title'))).toBe(true);
	}}
>
	{#snippet template()}
		<div class="max-w-2xl">
			<TaskListCard {rows} {form} {heading} />
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

		// No `heading` passed: the row is the title alone, which is what the Lab
		// mounts and what `/` shows before the day's first 🪫 log.
		expect(canvas.queryByText('beside the title')).not.toBeInTheDocument();

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

{#snippet heading()}
	<p>beside the title</p>
{/snippet}

{#snippet rows()}
	<li>write the calibration section</li>
	<li>boxing</li>
{/snippet}
