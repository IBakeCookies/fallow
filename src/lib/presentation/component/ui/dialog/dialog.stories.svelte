<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, waitFor, within } from 'storybook/test';
	import * as Dialog from '$lib/presentation/component/ui/dialog';
	import DialogRoot from './dialog.svelte';

	const { Story } = defineMeta({
		title: 'UI/Dialog',
		component: DialogRoot,
		tags: ['autodocs'],
	});
</script>

<Story
	name="Default"
	play={async ({ canvas, userEvent }) => {
		// Content is portalled to `document.body`, so every query for it goes through
		// `within(document.body)` and not the story's own canvas — and every play that opens one CLOSES
		// it and waits for the body lock to lift: stories in a file share the document, and an open
		// dialog leaves `pointer-events: none` on the body behind it.
		const body = within(document.body);

		// The body's `pointer-events: none` is lifted on a TIMEOUT after the last lock
		// goes (bits-ui's body scroll lock), so a play that only waits for the dialog to
		// unmount leaves the next click un-clickable.
		const gone = async () => {
			await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
			await waitFor(() => expect(document.body.style.pointerEvents).toBe(''));
		};

		expect(body.queryByRole('dialog')).not.toBeInTheDocument();

		const trigger = canvas.getByRole('button', {
			name: 'Add task',
		});

		await userEvent.click(trigger);

		const dialog = await body.findByRole('dialog');

		// The Title names it: without one a screen reader announces an anonymous dialog.
		await expect(dialog).toHaveAccessibleName('Add task');

		// Content hands focus to its first tabbable, which is what puts the caret in the
		// field with no `autofocus` anywhere — the attribute is inert on a late insert. The
		// handover lands a tick after the dialog mounts, so it needs waiting for: assert it
		// on mount and focus is still on the trigger.
		await waitFor(() => expect(within(dialog).getByLabelText('Title')).toHaveFocus());

		await userEvent.click(
			within(dialog).getByRole('button', {
				name: 'Close',
			}),
		);

		await gone();

		// Escape is the other way out, and the one a form's own Escape handler has to
		// leave alone once its suggestion list is closed.
		await userEvent.click(trigger);
		await body.findByRole('dialog');
		await userEvent.keyboard('{Escape}');
		await gone();
	}}
	asChild
>
	<Dialog.Root>
		<Dialog.Trigger>Add task</Dialog.Trigger>
		<Dialog.Content>
			<Dialog.Title class="mb-text-md">Add task</Dialog.Title>
			<label class="block text-xs font-medium text-ty-secondary">
				Title
				<input
					type="text"
					class="mt-text-xs w-full rounded-lg border border-line-strong bg-input px-box-md py-box-xs text-sm"
				/>
			</label>
		</Dialog.Content>
	</Dialog.Root>
</Story>
