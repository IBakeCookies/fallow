<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fireEvent } from 'storybook/test';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

	const { Story } = defineMeta({
		title: 'Component/Day Constraints Bar',
		component: DayConstraintsBar,
		tags: ['autodocs'],
		args: {
			availableHours: 6,
			switchCost: 0.25,
			cognitivePool: 8,
			physicalPool: 4,
			remainingSuggestedHours: '5.25',
			planSlackHours: 0,
			isOpen: true,
		},
	});
</script>

<Story
	name="Open"
	play={async ({ canvas, userEvent }) => {
		// Expanded: all four inputs with switch cost in minutes.
		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(6);
		await expect(canvas.getByLabelText('Switch Cost (per task change)')).toHaveValue(15);
		await expect(canvas.getByLabelText('Cognitive Capacity')).toHaveValue(8);
		await expect(canvas.getByLabelText('Physical Capacity')).toHaveValue(4);
		await expect(canvas.getByText('Allocated: 5.25h')).toBeVisible();

		// The slider and the field are two views of one budget, so dragging the
		// slider is what the field then shows. Dragging re-solves the plan live —
		// the reason the budget got a slider at all (ROADMAP phase 1).
		await fireEvent.input(canvas.getByRole('slider'), {
			target: {
				value: '7.5',
			},
		});

		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(7.5);

		// And the other direction: the thumb follows the field's own stepper.
		await userEvent.click(
			canvas.getAllByRole('button', {
				name: 'Increase',
			})[0],
		);

		await expect(canvas.getByRole('slider')).toHaveValue('7.75');

		// Stepping switch cost converts minutes back to hours: 15 min → 20 min.
		await userEvent.click(
			canvas.getAllByRole('button', {
				name: 'Increase',
			})[1],
		);

		await expect(canvas.getByLabelText('Switch Cost (per task change)')).toHaveValue(20);
	}}
/>

<Story
	name="Off-quarter budget"
	args={{
		availableHours: 6.4,
	}}
	play={async ({ canvas }) => {
		// A budget the quarter step does not land on. Legitimate: typed in the field, and what a plan-
		// advice `set-budget` lever applies. A range sanitizes its DOM value to its own step, so with
		// `step="0.25"` the thumb read 6.5 beside a field reading 6.4 — two controls over one value
		// disagreeing.
		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(6.4);
		await expect(canvas.getByRole('slider')).toHaveValue('6.4');

		// A drag still lands on a quarter — that is what `step` was there for, and it
		// now happens on the way in rather than by the input sanitizing what it shows.
		await fireEvent.input(canvas.getByRole('slider'), {
			target: {
				value: '6.43',
			},
		});

		await expect(canvas.getByLabelText('Available Hours')).toHaveValue(6.5);
		await expect(canvas.getByRole('slider')).toHaveValue('6.5');
	}}
/>

<Story
	name="With unplanned time"
	args={{
		// Slack above 0.05 h adds the unplanned-time warning line
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>

<Story
	name="Collapsed"
	args={{
		isOpen: false,
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
	play={async ({ canvas }) => {
		// Collapsed it is one line: budget · planned · slack · pools · switch
		await expect(
			canvas.getByText('6h budget · 4.00h planned · 2.00h free · 8h mind · 4h body · 15m switch'),
		).toBeVisible();

		await expect(
			canvas.getByRole('button', {
				name: /Time Budget/,
			}),
		).toHaveAttribute('aria-expanded', 'false');
	}}
/>
