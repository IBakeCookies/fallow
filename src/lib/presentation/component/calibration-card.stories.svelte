<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, waitFor, within } from 'storybook/test';
	import CalibrationCard from '$lib/presentation/component/calibration-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Calibration Card',
		component: CalibrationCard,
		tags: ['autodocs'],
	});
</script>

<Story
	name="With a log count"
	args={{
		title: 'Drain Calibration',
		hint: 'Fits the two drain rates to your 🪫 end-of-session ratings, anchored to the defaults.',
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		// The drain card's shape: what has been logged, and what is not counted yet, under an explained
		// heading. The play function covers what the spec can't see rendered statically: hovering the
		// heading actually opens the hint tooltip (portalled to <body>).
		const heading = canvas.getByRole('heading', {
			name: args.title,
		});

		await expect(heading).toHaveClass('hint-underline');

		await userEvent.hover(heading);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByText(args.hint)).toBeVisible());
	}}
>
	{#snippet template(args)}
		<div class="max-w-sm">
			<CalibrationCard title={args.title} hint={args.hint}>
				<div class="mt-text-sm space-y-text-xs text-xs text-ty-silent">
					<p>1 rating logged today, counted from tomorrow</p>
					<p>Drain ratings · 7</p>
				</div>
			</CalibrationCard>
		</div>
	{/snippet}
</Story>

<Story
	name="Empty"
	args={{
		title: 'Stopping Calibration',
		hint: 'Fits the value of free time to the days you chose to stop.',
	}}
	play={async ({ canvas }) => {
		// Nothing logged: the card says so and offers nothing to apply
		await expect(canvas.getByText(/No finished days yet/)).toBeVisible();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<div class="max-w-sm">
			<CalibrationCard title={args.title} hint={args.hint}>
				<p class="mt-text-sm text-xs text-ty-silent">
					No finished days yet — the fit needs a day you stopped on purpose.
				</p>
			</CalibrationCard>
		</div>
	{/snippet}
</Story>

<Story
	name="With an action"
	args={{
		title: 'Recovery Calibration',
		hint: 'Fits the recovery rate to your ☕ pre/post-rest rating pairs.',
	}}
	play={async ({ canvas }) => {
		// The recovery card is the only one with an action: ☕ opens the rest editor
		await expect(
			canvas.getByRole('button', {
				name: /log a rest/i,
			}),
		).toBeVisible();
	}}
>
	{#snippet template(args)}
		<div class="max-w-sm">
			<CalibrationCard title={args.title} hint={args.hint}>
				{#snippet action()}
					<button type="button" class="shrink-0 text-xs text-info/90 hover:text-info-strong">
						☕ Log a rest
					</button>
				{/snippet}
				<p class="mt-text-sm text-xs text-ty-silent">Rest pairs · 4</p>
			</CalibrationCard>
		</div>
	{/snippet}
</Story>
