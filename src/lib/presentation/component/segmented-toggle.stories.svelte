<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import SegmentedToggle from '$lib/presentation/component/segmented-toggle.svelte';

	const { Story } = defineMeta({
		title: 'Component/Segmented Toggle',
		component: SegmentedToggle,
		tags: ['autodocs'],
		args: {
			items: [
				{
					value: 'week',
					label: 'Last 7 days',
				},
				{
					value: 'month',
					label: 'Last 30 days',
				},
				{
					value: 'year',
					label: 'Last 12 months',
				},
			],
			value: 'week',
			label: 'Time range',
			onchange: fn(),
		},
	});
</script>

<Story
	name="Segment tone"
	play={async ({ args, canvas, userEvent }) => {
		// The analytics range picker: on the page, so its own backdrop-blur
		// A named group, so the buttons are not three unrelated switches
		await expect(
			canvas.getByRole('group', {
				name: 'Time range',
			}),
		).toBeInTheDocument();

		// The pressed state is the only thing telling a screen reader which option
		// is live — the active pill is otherwise a fill
		await expect(
			canvas.getByRole('button', {
				name: 'Last 7 days',
			}),
		).toHaveAttribute('aria-pressed', 'true');

		await expect(
			canvas.getByRole('button', {
				name: 'Last 30 days',
			}),
		).toHaveAttribute('aria-pressed', 'false');

		// Reports the chosen value and leaves the writing to its caller: a page
		// that ignores `onchange` must not appear to have switched
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Last 30 days',
			}),
		);

		await expect(args.onchange).toHaveBeenCalledTimes(1);
		await expect(args.onchange).toHaveBeenCalledWith('month');

		await expect(
			canvas.getByRole('button', {
				name: 'Last 7 days',
			}),
		).toHaveAttribute('aria-pressed', 'true');
	}}
/>

<Story
	name="Segment tone, middle selected"
	args={{
		// axe only ever sees a story's REST state, so the middle option being selected is not cosmetic:
		// it puts an inactive pill on either side of an active one, which is the pairing whose contrast
		// the addon then checks on every theme.
		value: 'month',
	}}
/>

<Story
	name="Plan tone"
	args={{
		// The Energy Lab's chart/schedule switch: nested inside an already-blurred card, so a step off
		// the card fill rather than a second blur
		tone: 'plan',
		label: 'Plan view',
		value: 'chart',
		items: [
			{
				value: 'chart',
				label: 'Chart',
			},
			{
				value: 'schedule',
				label: 'Schedule',
			},
		],
	}}
/>

<Story
	name="Two options, capitalized"
	args={{
		label: 'Calendar view',
		itemClass: 'capitalize',
		value: 'month',
		items: [
			{
				value: 'month',
				label: 'month',
			},
			{
				value: 'week',
				label: 'week',
			},
		],
	}}
	play={async ({ canvas }) => {
		// The calendar's view names are lowercase copy, capitalized in the markup: `itemClass` reaches
		// every option's button
		for (const name of [/^month$/i, /^week$/i]) {
			await expect(
				canvas.getByRole('button', {
					name,
				}),
			).toHaveClass('capitalize');
		}
	}}
/>
