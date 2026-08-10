<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import FlowLogForm from '$lib/presentation/component/flow-log-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Flow Log Form',
		component: FlowLogForm,
		tags: ['autodocs'],
	});
</script>

<!-- The ⚡ editor as it hangs under a task row: how long the ramp-up to flow took,
     which is what personalizes ϕ. Blank, as it opens on a task with no measurement
     today. The play walks the save policy: an editor that opened itself leaves the
     caret alone, ✕ discards without reporting, and an empty length refuses. -->
<Story
	name="Blank"
	args={{
		onsave: fn(),
		oncancel: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		const minutes = canvas.getByPlaceholderText('min');

		const save = canvas.getByRole('button', {
			name: '✓',
		});

		// Opened itself on completion, so it must not yank the caret out of the list
		await expect(minutes).not.toHaveFocus();

		// Nothing measured: nothing to report
		await userEvent.click(save);
		await expect(args.onsave).not.toHaveBeenCalled();

		// ✕ discards the draft without reporting it
		await userEvent.type(minutes, '25');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✕',
			}),
		);

		await expect(args.oncancel).toHaveBeenCalledOnce();
		await expect(args.onsave).not.toHaveBeenCalled();

		// Minutes in, minutes out — the store converts, since ⚡ is stored per day
		await userEvent.click(save);
		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith(25);
	}}
/>

<!-- Re-opened on a task already measured today: ⚡ is one number per day (MATH.md
     §18), so the editor amends that number rather than adding a second one -->
<Story
	name="Amending today's measurement"
	args={{
		seed: 40,
		focusMinutes: true,
		onsave: fn(),
		oncancel: fn(),
	}}
	play={async ({ canvas }) => {
		const minutes = canvas.getByPlaceholderText('min');

		await expect(minutes).toHaveValue(40);

		// Opened by the row's own ⚡ button: the only opening that takes the caret
		await expect(minutes).toHaveFocus();
	}}
/>
