<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import { getTaskColumns } from '$lib/presentation/utils/ledger-column';

	const { Story } = defineMeta({
		title: 'Component/Task List Card',
		component: TaskListCard,
		tags: ['autodocs'],
	});
</script>

<!-- The frame both screens mount. What the play covers is what the card decides for
     them: the reading order — title, strip, ledger, form at the foot — and that the
     screen's own heading content shares the heading's row rather than costing one of
     its own. -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		const title = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const strip = canvas.getByText('the day');
		const table = canvas.getByRole('table');
		const form = canvas.getByText('add a task');

		expect(title.compareDocumentPosition(strip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(strip.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(table.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(table.querySelectorAll('tbody tr')).toHaveLength(2);

		// Inside the heading's row, not merely before the form: a sibling of the card's
		// sections would be the block that pushed the list out of line with the metrics
		// beside it, which is what moving it here undid.
		expect(title.parentElement?.contains(canvas.getByText('beside the title'))).toBe(true);
	}}
>
	{#snippet template()}
		<div class="max-w-2xl">
			<TaskListCard columns={getTaskColumns()} {rows} {form} {strip} {heading} />
		</div>
	{/snippet}
</Story>

<!-- No rows: the empty state, and no <table> at all — a header row over nothing is a
     grid of nothing, the same mistake an empty <ul> was -->
<Story
	name="Empty"
	play={async ({ canvas }) => {
		await expect(canvas.getByText('No tasks deployed yet')).toBeVisible();
		await expect(canvas.getByText('Add a task below to begin tracking')).toBeVisible();
		expect(canvas.queryByRole('table')).not.toBeInTheDocument();

		// No `heading` passed: the row is the title alone, which is what the Lab
		// mounts and what `/` shows before the day's first 🪫 log.
		expect(canvas.queryByText('beside the title')).not.toBeInTheDocument();

		// The form stays: the empty day is where the first task gets typed
		await expect(canvas.getByText('add a task')).toBeVisible();

		// No `strip` passed: the Lab mounts the card without one.
		expect(canvas.queryByText('the day')).not.toBeInTheDocument();
	}}
>
	{#snippet template()}
		<div class="max-w-2xl">
			<TaskListCard columns={getTaskColumns()} rows={null} {form} />
		</div>
	{/snippet}
</Story>

{#snippet form()}
	<p>add a task</p>
{/snippet}

{#snippet strip()}
	<p>the day</p>
{/snippet}

{#snippet heading()}
	<p>beside the title</p>
{/snippet}

{#snippet rows()}
	<tbody>
		<tr><td>write the calibration section</td></tr>
	</tbody>
	<tbody>
		<tr><td>boxing</td></tr>
	</tbody>
{/snippet}
