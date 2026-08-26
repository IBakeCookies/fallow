<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import NextUpLine from '$lib/presentation/component/next-up-line.svelte';

	const { Story } = defineMeta({
		title: 'Component/Next Up Line',
		component: NextUpLine,
		tags: ['autodocs'],
		args: {
			title: 'write the calibration section',
		},
	});
</script>

<Story
	name="Default"
	play={async ({ canvas }) => {
		await expect(canvas.getByText('write the calibration section')).toBeVisible();
	}}
/>

<Story
	name="Long title"
	args={{
		// The card's header row bounds this line's width, so a long title truncates rather than
		// wrapping the badge onto its own row. Standalone here, there is nothing to truncate against —
		// what the story pins is that the badge stays put.
		title:
			're-derive the stopping-inversion margin from the measured distributions and write it up',
	}}
/>
