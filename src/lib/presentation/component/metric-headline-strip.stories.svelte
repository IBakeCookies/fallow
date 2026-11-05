<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { Metric } from '$lib/presentation/type';
	import MetricHeadlineStrip from '$lib/presentation/component/metric-headline-strip.svelte';
	import { BAND_BAR_CLASS } from '$lib/presentation/utils/band';

	/* The tile is the div holding the value `<p>` — the same shape `time-budget.e2e.ts`
	   picks a tile by. `.band-track` is a bar, `span.band-fill` a pip. */
	const tile = (canvas: { getByText: (text: string) => HTMLElement }, value: string) =>
		canvas.getByText(value).closest('div')!;

	/* The band is the banding policy's output (utils/band.ts) — the component owns
	   the colour and the screen-reader wording it renders from it. */
	const metrics: Metric[] = [
		// The four headline readings, drawn as tiles — two banded, two not, so the
		// grid is exercised with both. The rest are here to prove they are NOT.
		{
			headline: true,
			group: 'worth',
			label: 'Completion Rate',
			value: '45%',
			description: 'Priority-weighted progress through the plan.',
			band: 'neutral',
			track: {
				kind: 'bar',
				filled: 45,
				total: 100,
			},
		},
		{
			headline: true,
			group: 'worth',
			label: 'Flow Coverage',
			value: '3/4',
			description: 'Tasks funded past their time-to-flow.',
			band: 'neutral',
			track: {
				kind: 'pips',
				filled: 3,
				total: 4,
			},
		},
		{
			headline: true,
			group: 'fit',
			label: 'Human Capacity',
			value: '104%',
			description: 'Planned load against the capacity pools — may read over 100%.',
			band: 'warning',
			track: {
				kind: 'bar',
				filled: 104,
				total: 100,
			},
		},
		{
			headline: true,
			group: 'endurance',
			label: 'Burnout Risk',
			value: 'Critical',
			description: 'Sustained load against recovery over the trailing window.',
			band: 'critical',
			track: {
				kind: 'bar',
				filled: 88,
				total: 100,
			},
		},
		{
			group: 'worth',
			label: 'Fallow Gain',
			value: '+18%',
			description: 'Improvement over a naive equal split of the same hours.',
			band: 'success',
		},
		{
			group: 'worth',
			label: 'Yield Index',
			value: '82%',
			description: 'Share of the achievable output this allocation reaches.',
			band: 'success',
		},
		{
			group: 'fit',
			label: 'Time Scarcity',
			value: '62%',
			description: 'How stretched the time budget is against demand.',
			band: 'warning',
		},
		{
			group: 'fit',
			label: 'Primary Bottleneck',
			// A task title, so this is the row that stress-tests a long value against
			// its label. Neutral on purpose: naming a task is not a verdict on it.
			value: 'Write the quarterly report',
			description: 'Largest draw on the capacity pool that binds the day.',
			band: 'neutral',
		},
	];

	const { Story } = defineMeta({
		title: 'Component/Metric Headline Strip',
		component: MetricHeadlineStrip,
		tags: ['autodocs'],
		args: {
			metrics,
			momentum: 0.4,
		},
	});
</script>

<Story
	name="Upward momentum"
	play={async ({ canvas, canvasElement }) => {
		// The verdict on the day, before the setup that produces it: four tiles and
		// nothing else. The reference readings are a separate card under the plan.
		await expect(canvas.getByText('Burnout Risk')).toBeVisible();
		await expect(canvas.getByText('104%')).toBeVisible();
		expect(canvas.queryByText('Yield Index')).toBeNull();

		// Momentum is one badge carrying its own tooltip: the state alone named
		// nothing once the label it sat beside was gone.
		await expect(canvas.getByText('Momentum: Upward')).toBeVisible();

		await expect(canvas.getByText('Momentum: Upward')).toHaveClass(
			'bg-success-tint text-success-strong',
		);

		// Each judged band carries text a screen reader hears; the two neutral tiles
		// (Completion Rate and Flow Coverage) are the default value colour, make no
		// claim, and stay silent.
		await expect(canvas.getByText('(Critical)')).toBeInTheDocument();
		expect(canvasElement.querySelectorAll('.sr-only')).toHaveLength(2);

		// Each reading shows where it sits on its own scale, in the band it reads in.
		const capacity = tile(canvas, '104%');

		await expect(capacity.querySelector('.band-track > div')).toHaveClass(BAND_BAR_CLASS.warning);

		// The fill clamps; the value does not. Over 100% is how the strip says the
		// plan is overloaded, and a bar wider than its track says nothing.
		expect(capacity.querySelector<HTMLElement>('.band-track > div')!.style.width).toBe('100%');
		await expect(canvas.getByText('104%')).toBeVisible();

		// Flow Coverage's denominator IS the reading, so it is drawn: one pip per
		// funded task, the reached ones filled in the band.
		const flow = tile(canvas, '3/4');
		const pips = flow.querySelectorAll('span.band-fill');

		expect(pips).toHaveLength(4);

		expect([...pips].filter((pip) => pip.classList.contains(BAND_BAR_CLASS.neutral))).toHaveLength(
			3,
		);

		// Momentum reads beside the four tiles, not on a row of its own above them.
		expect(capacity.closest('div')!.parentElement!).toContainElement(
			canvas.getByText('Momentum: Upward'),
		);
	}}
/>

<Story
	name="More tasks than pips fit"
	args={{
		metrics: metrics.map((item) =>
			item.label === 'Flow Coverage'
				? {
						...item,
						value: '9/12',
						track: {
							kind: 'bar' as const,
							filled: 9,
							total: 12,
						},
					}
				: item,
		),
	}}
	play={async ({ canvas }) => {
		// Above eight funded tasks a pip is thinner than the gap beside it, so the
		// same reading falls back to the bar every other tile draws.
		const flow = tile(canvas, '9/12');

		expect(flow.querySelectorAll('.band-track > div')).toHaveLength(1);
		expect(flow.querySelectorAll('span.band-fill')).toHaveLength(0);
	}}
/>

<Story
	name="A reading the day cannot answer"
	args={{
		metrics: metrics.map((item) =>
			item.label === 'Human Capacity'
				? {
						...item,
						value: 'N/A',
						band: 'neutral' as const,
						track: undefined,
					}
				: item,
		),
	}}
	play={async ({ canvas }) => {
		// An N/A has no scale to sit on; an empty track would draw one as though the
		// reading were 0.
		expect(tile(canvas, 'N/A').querySelector('.band-track')).toBeNull();
	}}
/>

<Story
	name="Reset required"
	args={{
		momentum: -0.4,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Momentum: Reset Reqd')).toBeVisible();

		await expect(canvas.getByText('Momentum: Reset Reqd')).toHaveClass(
			'bg-warning-tint text-warning-strong',
		);
	}}
/>

<Story
	name="Stable"
	args={{
		// What `Math.round` makes of a small loss: a tie, not a loss.
		momentum: -0,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Momentum: Stable')).toBeVisible();
		await expect(canvas.getByText('Momentum: Stable')).toHaveClass('border-border');
		await expect(canvas.getByText('Momentum: Stable')).not.toHaveClass('bg-warning-tint');
	}}
/>

<Story
	name="No momentum"
	args={{
		momentum: null,
	}}
	play={async ({ canvas }) => {
		// No history yet: the badge names the reading and reads N/A
		await expect(canvas.getByText('Momentum: N/A')).toBeVisible();
		await expect(canvas.getByText('Momentum: N/A')).toHaveClass('border-border');
		await expect(canvas.getByText('Momentum: N/A')).not.toHaveClass('bg-success-tint');
	}}
/>
