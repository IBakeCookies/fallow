<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import DrainCalibrationCard from '$lib/presentation/component/drain-calibration-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Drain Calibration Card',
		component: DrainCalibrationCard,
		tags: ['autodocs'],
		args: {
			logCount: 3,
			ratesFitted: true,
		},
	});
</script>

<Story
	name="Rated"
	play={async ({ canvas }) => {
		// The ⚡ card's shape on 🪫's numbers: what the fit was made from, and nothing to do
		// about it — the list this card stands on holds both verbs at its foot.
		await expect(canvas.getByText('3')).toBeVisible();
		await expect(canvas.getByText('drain ratings')).toBeVisible();
		await expect(canvas.getByText(/Drain rates personalized from 3 ratings/)).toBeVisible();

		// The prompt is the empty state's alone: a user who has rated sessions already
		// knows how, so the card is the count and nothing else.
		await expect(canvas.queryByText(/No ratings yet/)).not.toBeInTheDocument();
		await expect(canvas.queryByText(/After a session on a task/)).not.toBeInTheDocument();

		await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}}
/>

<Story
	name="A single rating"
	args={{
		logCount: 1,
	}}
	play={async ({ canvas }) => {
		// The headline's label has a singular form, and so does the status.
		await expect(canvas.getByText('drain rating')).toBeVisible();
		await expect(canvas.getByText(/Drain rates personalized from 1 rating/)).toBeVisible();
	}}
/>

<Story
	name="Nothing rated"
	args={{
		logCount: 0,
	}}
	play={async ({ canvas }) => {
		// The same headline as every other state, reading zero — the ⚡ card's shape, so the
		// pair does not read as two different kinds of card. Only the sentence changes, and
		// this one is the only place in the app that explains 🪫: it has to be legible at
		// `text-ty-silent` in every theme, which is what the a11y addon checks here.
		await expect(canvas.getByText('0')).toBeVisible();
		await expect(canvas.getByText(/No ratings yet/)).toHaveClass('text-ty-silent');

		// A fit with no rating to read has nothing to say about them.
		await expect(canvas.queryByText(/Drain rates personalized/)).not.toBeInTheDocument();
	}}
/>

<Story
	name="Ratings the fit could not read"
	args={{
		logCount: 2,
		ratesFitted: false,
	}}
	play={async ({ canvas }) => {
		// Two ratings on record and both α still at their defaults — the ⚡ card's rejected-fit
		// shape: the card says so and where to look, rather than printing a count and no verdict.
		await expect(canvas.getByText(/Your 2 ratings gave the fit nothing to read/)).toBeVisible();
	}}
/>

<Story
	name="Before the fit answers"
	args={{
		logCount: 2,
		ratesFitted: null,
	}}
	play={async ({ canvas }) => {
		// The count's store has answered and the fit's has not: a status now would call a
		// personalized model default. The card is the count until the fit lands.
		await expect(canvas.getByText('2')).toBeVisible();
		await expect(canvas.queryByText(/Drain rates personalized/)).not.toBeInTheDocument();
		await expect(canvas.queryByText(/gave the fit nothing to read/)).not.toBeInTheDocument();
	}}
/>

<Story
	name="A rating the fit defers"
	args={{
		logCount: 4,
		pendingLogs: 1,
	}}
	play={async ({ canvas }) => {
		// α is identity, so a rating made today is counted by the headline and named by the
		// sentence — never folded in. The two numbers legitimately differ, and the status
		// counts only the ratings the fit read.
		await expect(canvas.getByText('4')).toBeVisible();
		await expect(canvas.getByText(/Drain rates personalized from 3 ratings/)).toBeVisible();
		await expect(canvas.getByText('1 🪫 logged today, counted from tomorrow')).toBeVisible();
	}}
/>

<Story
	name="Two ratings the fit defers"
	args={{
		logCount: 4,
		pendingLogs: 2,
	}}
	play={async ({ canvas }) => {
		// The plural form, which had no assertion anywhere once the Lab's own count went.
		await expect(canvas.getByText('2 🪫 logged today, counted from tomorrow')).toBeVisible();
	}}
/>
