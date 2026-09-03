<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import FlowCalibrationCard from '$lib/presentation/component/flow-calibration-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Flow Calibration Card',
		component: FlowCalibrationCard,
		tags: ['autodocs'],
		args: {
			constantsFitted: true,
			logCount: 3,
		},
	});
</script>

<Story
	name="Personalized"
	play={async ({ canvas }) => {
		// A healthy fit: the count it was made from, and what it made of them. Neither verb a
		// fit has is offered here — the card stands on the page that lists the logs, so the
		// link would point at itself and the reset would be that page's second.
		await expect(canvas.getByText('3')).toBeVisible();
		await expect(canvas.getByText(/Model personalized from 3 time-to-flow logs/)).toBeVisible();

		await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}}
/>

<Story
	name="A single log"
	args={{
		logCount: 1,
	}}
	play={async ({ canvas }) => {
		// The healthy-fit status has a singular form, and so does the headline's label.
		await expect(canvas.getByText('time-to-flow log')).toBeVisible();
		await expect(canvas.getByText(/Model personalized from 1 time-to-flow log/)).toBeVisible();
	}}
/>

<Story
	name="A rejected fit"
	args={{
		constantsFitted: false,
	}}
	play={async ({ canvas }) => {
		// Logs present but the fit was rejected: the loud state.
		await expect(canvas.getByText(/Your 3 flow logs produced an implausible fit/)).toBeVisible();
	}}
/>

<Story
	name="Nothing logged"
	args={{
		constantsFitted: false,
		logCount: 0,
	}}
	play={async ({ canvas }) => {
		// Nothing is wrong, there is just nothing logged. This line is the only place in the app that
		// says ⚡ exists, so it has to be legible at `text-ty-silent` on a card in every theme — which
		// is what the a11y addon checks here.
		await expect(canvas.getByText(/Model uses default constants/)).toHaveClass('text-ty-silent');
	}}
/>

<Story
	name="A log the plan defers"
	args={{
		logCount: 4,
		pendingLogs: 1,
	}}
	play={async ({ canvas }) => {
		// A log made today is on the page but not in the plan, so the headline count and the fit's
		// count differ — the sentence has to print the one the fit used, and name the other.
		// Three, not the four the headline counts.
		await expect(canvas.getByText(/Model personalized from 3 time-to-flow logs/)).toBeVisible();
		await expect(canvas.getByText(/1 ⚡ logged today/)).toBeVisible();
		await expect(canvas.getByText(/today's plan holds/)).toBeVisible();
	}}
/>

<Story
	name="Every log deferred"
	args={{
		constantsFitted: false,
		logCount: 1,
		pendingLogs: 1,
	}}
	play={async ({ canvas }) => {
		// Day one: every log is deferred, so there is no fit to describe. The deferral line REPLACES
		// the "log ⚡ to start personalizing" prompt, which would otherwise ask the user to do the thing
		// they have just done.
		await expect(canvas.getByText(/1 ⚡ logged today/)).toBeVisible();
		await expect(canvas.queryByText(/to start personalizing/)).not.toBeInTheDocument();
	}}
/>
