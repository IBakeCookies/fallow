<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import MustDoToggle from '$lib/presentation/component/must-do-toggle.svelte';

	const { Story } = defineMeta({
		title: 'Component/Must Do Toggle',
		component: MustDoToggle,
		tags: ['autodocs'],
		args: {
			mustDoToday: false,
		},
	});
</script>

<Story
	name="A button that is still a checkbox"
	play={async ({ canvas, userEvent }) => {
		// A button to look at and a checkbox to operate: the whole point of the component is that
		// dressing it as a button costs neither the role nor the keyboard.
		const toggle = canvas.getByRole('checkbox', {
			name: 'Keep on today',
		});

		await expect(toggle).not.toBeChecked();

		// The label is the hit target, and it is the label that carries the button look
		await userEvent.click(canvas.getByLabelText('Keep on today'));
		await expect(toggle).toBeChecked();

		// Space, not Enter: a real checkbox is what makes the form's own submit key safe here
		toggle.focus();
		await userEvent.keyboard(' ');
		await expect(toggle).not.toBeChecked();
	}}
/>

<Story
	name="Set"
	args={{
		mustDoToday: true,
	}}
	play={async ({ canvas }) => {
		// The set state is the `secondary` rung of STYLE.md's emphasis ladder, so it reads as accent
		// without becoming a second solid button beside the form's submit.
		await expect(
			canvas.getByRole('checkbox', {
				name: 'Keep on today',
			}),
		).toBeChecked();
	}}
/>
