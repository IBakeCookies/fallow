<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import DrainLogForm from '$lib/presentation/component/drain-log-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Drain Log Form',
		component: DrainLogForm,
		tags: ['autodocs'],
	});
</script>

<!-- The 🪫 editor as it hangs under a task row: how long the session ran, and how
     spent each capacity feels now. Blank, as it opens on an unrated task. The play
     walks the save policy: an editor that opened itself leaves the caret alone, ✕
     discards without reporting, no length and blank ratings both refuse (an empty
     rating is not a rating of 0), minutes report as hours, and 0 is legitimate. -->
<Story
	name="Blank"
	args={{
		onsave: fn(),
		oncancel: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		const minutes = canvas.getByPlaceholderText('min');
		const mind = canvas.getByLabelText('Mind');
		const body = canvas.getByLabelText('Body');

		const save = canvas.getByRole('button', {
			name: '✓',
		});

		// Opened itself on completion, so it must not yank the caret out of the list
		await expect(minutes).not.toHaveFocus();

		// 🗑 is the caller's, and this caller passed none
		await expect(
			canvas.queryByRole('button', {
				name: 'Delete this drain rating',
			}),
		).not.toBeInTheDocument();

		// ✕ discards the draft without reporting it
		await userEvent.type(minutes, '90');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✕',
			}),
		);

		await expect(args.oncancel).toHaveBeenCalledOnce();
		await expect(args.onsave).not.toHaveBeenCalled();

		// No session length: nothing to report
		await userEvent.clear(minutes);
		await userEvent.type(mind, '7');
		await userEvent.type(body, '3');
		await userEvent.click(save);
		await expect(args.onsave).not.toHaveBeenCalled();

		// Blank ratings refuse — ✓ with only the minutes would bias α toward no drain
		await userEvent.type(minutes, '90');
		await userEvent.clear(mind);
		await userEvent.clear(body);
		await userEvent.click(save);
		await expect(args.onsave).not.toHaveBeenCalled();

		// Minutes in, hours out: the store and the §8.8 α fit both work in hours
		await userEvent.type(mind, '7');
		await userEvent.type(body, '3');
		await userEvent.click(save);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith({
			hours: 1.5,
			mind: 7,
			body: 3,
		});

		// 0 is a legitimate rating — the refusal keys on emptiness, not falsiness
		await userEvent.clear(minutes);
		await userEvent.type(minutes, '30');
		await userEvent.clear(mind);
		await userEvent.type(mind, '0');
		await userEvent.clear(body);
		await userEvent.type(body, '0');
		await userEvent.click(save);
		await expect(args.onsave).toHaveBeenCalledTimes(2);

		await expect(args.onsave).toHaveBeenLastCalledWith({
			hours: 0.5,
			mind: 0,
			body: 0,
		});
	}}
/>

<!-- Re-opened from the ✎ on a stored rating: correcting THAT session, not
     starting a new one — the row 🪫 button opens the empty form instead -->
<Story
	name="Amending today's rating"
	args={{
		seed: {
			minutes: 45,
			mind: 6,
			body: 2,
		},
		onsave: fn(),
		oncancel: fn(),
		ondelete: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(45);
		await expect(canvas.getByLabelText('Mind')).toHaveValue(6);
		await expect(canvas.getByLabelText('Body')).toHaveValue(2);

		// Whether 🗑 is offered is the caller's call, not re-derived from `seed` here,
		// and it is named — the emoji alone tells a screen reader nothing
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete this drain rating',
			}),
		);

		await expect(args.ondelete).toHaveBeenCalledOnce();
	}}
/>

<!-- Opened by the row's own 🪫 button: the only opening that takes the caret -->
<Story
	name="Opened by the row"
	args={{
		focusMinutes: true,
		onsave: fn(),
		oncancel: fn(),
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByPlaceholderText('min')).toHaveFocus();
	}}
/>
