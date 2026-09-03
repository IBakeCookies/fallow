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
		// The headline's label has a singular form.
		await expect(canvas.getByText('drain rating')).toBeVisible();
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
		// sentence — never folded in. The two numbers legitimately differ.
		await expect(canvas.getByText('4')).toBeVisible();
		await expect(canvas.getByText('1 rating logged today, counted from tomorrow')).toBeVisible();
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
		await expect(canvas.getByText('2 ratings logged today, counted from tomorrow')).toBeVisible();
	}}
/>
