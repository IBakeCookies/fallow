<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, userEvent } from 'storybook/test';
	import BudgetCurveButton from '$lib/presentation/component/budget-curve-button.svelte';

	const { Story } = defineMeta({
		title: 'Component/Budget Curve Button',
		component: BudgetCurveButton,
		tags: ['autodocs'],
		args: {
			isBusy: false,
			hasError: false,
			oncheck: fn(),
		},
	});
</script>

<!-- Before the user asks: one button, no card. The sweep costs a solve per step. -->
<Story
	name="Unasked"
	play={async ({ canvas, args }) => {
		const button = canvas.getByRole('button', {
			name: 'How long should today be?',
		});

		await userEvent.click(button);
		await expect(args.oncheck).toHaveBeenCalledOnce();
	}}
/>

<Story
	name="Solving"
	args={{
		isBusy: true,
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByRole('button', {
				name: 'Solving…',
			}),
		).toBeDisabled();
	}}
/>

<!-- A failed first sweep has no card to carry the banner, so the button says it. -->
<Story
	name="Failed"
	args={{
		hasError: true,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('The sweep failed. Try again.')).toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'How long should today be?',
			}),
		).toBeEnabled();
	}}
/>
