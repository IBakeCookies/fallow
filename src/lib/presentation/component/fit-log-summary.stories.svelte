<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import FitLogSummary from '$lib/presentation/component/fit-log-summary.svelte';

	const onreset = fn();

	const { Story } = defineMeta({
		title: 'Component/Fit Log Summary',
		component: FitLogSummary,
		tags: ['autodocs'],
		args: {
			label: 'Personalized from 3 flow logs',
			title: 'Time-to-flow measurements feeding the ϕ fit',
			count: 3,
			confirmLabel: 'Delete all 3 logs?',
			resetLabel: 'Reset personalization',
			resetTitle: 'Drop every logged data point',
			onreset,
		},
	});
</script>

<Story
	name="With logs"
	play={async ({ canvas }) => {
		// The two verbs a FIT has: read what it was fitted from (on /analytics, which prints every kind
		// of log dated), and un-personalize it. The logs themselves are not here — three cards listing
		// their own kind was three partial answers to one question.
		await expect(canvas.getByText('Personalized from 3 flow logs')).toBeVisible();

		const link = canvas.getByRole('link');
		await expect(link).toHaveAttribute('href', '/analytics#log-history');

		// No count on the link: the card's own label carries it, and the page it opens
		// shows a range the user picks rather than all of them.
		await expect(link).not.toHaveTextContent('3');
	}}
/>

<Story
	name="Empty"
	args={{
		label: 'Model uses default constants',
		count: 0,
	}}
	play={async ({ canvas }) => {
		// Nothing logged: the label is the whole card. No link, because there is nothing to look at,
		// and no reset, because there is nothing to un-personalize.
		await expect(canvas.getByText('Model uses default constants')).toBeVisible();
		await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}}
/>

<Story
	name="Resetting"
	play={async ({ args, canvas, userEvent }) => {
		// The reset is two steps, and the second one is what calls back. Cancel takes focus on the way
		// in, so a stray Enter after the first click lands on the safe half.
		onreset.mockClear();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Reset personalization',
			}),
		);

		await expect(canvas.getByText('Delete all 3 logs?')).toBeVisible();
		await expect(args.onreset).not.toHaveBeenCalled();

		const cancel = canvas.getByRole('button', {
			name: 'Cancel',
		});

		await expect(cancel).toHaveFocus();
		await userEvent.click(cancel);

		// Back to one step, and the trigger has the caret again.
		const trigger = canvas.getByRole('button', {
			name: 'Reset personalization',
		});

		await expect(trigger).toHaveFocus();

		await userEvent.click(trigger);

		// `getByText`, not `getByRole`: "Reset personalization" also matches the name
		// "Reset", and only one of the two is the confirm.
		await userEvent.click(
			canvas.getByText('Reset', {
				exact: true,
			}),
		);

		await expect(args.onreset).toHaveBeenCalledOnce();
	}}
/>

<Story
	name="Without reset"
	args={{
		onreset: undefined,
	}}
	play={async ({ canvas }) => {
		// Omitting onreset leaves the reading and nothing else: the Lab's cards pass one, a card with
		// no fit of its own would not.
		await expect(canvas.getByRole('link')).toBeVisible();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}}
/>

<Story
	name="Without link"
	args={{
		withHistoryLink: false,
	}}
	play={async ({ canvas }) => {
		// On `/analytics` the link points at the card the row is drawn in, so those three rows turn it
		// off; the three fit cards that keep it pass nothing.
		await expect(canvas.queryByRole('link')).not.toBeInTheDocument();

		// The rest of the row still renders — otherwise the assertion above passes on
		// a component that drew nothing.
		await expect(
			canvas.getByRole('button', {
				name: 'Reset personalization',
			}),
		).toBeVisible();
	}}
/>
