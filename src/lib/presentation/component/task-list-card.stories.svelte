<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, waitFor, within } from 'storybook/test';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import { getTaskColumns } from '$lib/presentation/utils/ledger-column';

	const { Story } = defineMeta({
		title: 'Component/Task List Card',
		component: TaskListCard,
		tags: ['autodocs'],
	});

	// Stories in a file share the document, and an open dialog leaves
	// `pointer-events: none` on the body — lifted on a timeout after the last lock goes,
	// so waiting only for the unmount still leaves the NEXT story unable to click.
	const closeDialog = async (userEvent: { keyboard: (keys: string) => Promise<void> }) => {
		await userEvent.keyboard('{Escape}');

		await waitFor(() =>
			expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument(),
		);

		await waitFor(() => expect(document.body.style.pointerEvents).toBe(''));
	};
</script>

<Story
	name="Default"
	play={async ({ canvas, userEvent }) => {
		// The frame both screens mount. What the play covers is what the card decides for them: the
		// reading order — title, strip, ledger — that the screen's own heading content shares the
		// heading's row rather than costing one of its own, and that the form is off the card entirely
		// until the `+` asks for it.
		const title = canvas.getByRole('heading', {
			name: 'Tasks',
		});

		const strip = canvas.getByText('the day');
		const table = canvas.getByRole('table');

		expect(title.compareDocumentPosition(strip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(strip.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(table.querySelectorAll('tbody tr')).toHaveLength(2);

		// Inside the heading's row, not merely before the form: a sibling of the card's
		// sections would be the block that pushed the list out of line with the metrics
		// beside it, which is what moving it here undid.
		expect(title.parentElement?.contains(canvas.getByText('beside the title'))).toBe(true);

		// The card costs the ledger no height for a form nobody asked for.
		expect(canvas.queryByText('add a task')).not.toBeInTheDocument();

		// `body`, not `canvas`: the dialog is portalled out of the card.
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Add task',
			}),
		);

		const dialog = await within(document.body).findByRole('dialog');
		// `toBeInTheDocument`, not `toBeVisible`: the panel enters on a `fade-in-0`, so a
		// visibility check can race the opacity it starts at.
		expect(within(dialog).getByText('add a task')).toBeInTheDocument();

		await closeDialog(userEvent);
	}}
>
	{#snippet template()}
		<div class="max-w-2xl">
			<TaskListCard columns={getTaskColumns()} {rows} {form} {strip} {heading} />
		</div>
	{/snippet}
</Story>

<Story
	name="Empty"
	play={async ({ canvas, userEvent }) => {
		// No rows: the empty state, and no <table> at all — a header row over nothing is a grid of
		// nothing, the same mistake an empty <ul> was
		await expect(canvas.getByText('No tasks deployed yet')).toBeVisible();
		await expect(canvas.getByText('Add a task to begin tracking')).toBeVisible();
		expect(canvas.queryByRole('table')).not.toBeInTheDocument();

		// No `heading` passed: the row is the title alone, which is what the Lab
		// mounts and what `/` shows before the day's first 🪫 log.
		expect(canvas.queryByText('beside the title')).not.toBeInTheDocument();

		// No `strip` passed: the Lab mounts the card without one.
		expect(canvas.queryByText('the day')).not.toBeInTheDocument();

		// The empty day is where the first task gets typed, so this screen carries its
		// own way in rather than leaving the corner glyph as the only one.
		await userEvent.click(
			canvas.getByRole('button', {
				name: '+ Add Task',
			}),
		);

		const dialog = await within(document.body).findByRole('dialog');
		expect(within(dialog).getByText('add a task')).toBeInTheDocument();

		await closeDialog(userEvent);
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
