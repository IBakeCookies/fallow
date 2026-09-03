<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { DraftImpact } from '$lib/business/model/metric/draft-impact';
	import { BAND_BAR_CLASS } from '$lib/presentation/utils/band';
	import TaskFormPreview from '$lib/presentation/component/task-form-preview.svelte';

	/* Shaped as `calculateDraftImpact` returns it: a physical draft joining a day
	   that already leans on its cognitive pool. */
	const impact: DraftImpact = {
		suggestedHours: 1.25,
		priorityScore: 63.4,
		position: 4,
		fundedCount: 6,
		physicalPercent: {
			before: 41.2,
			after: 62.4,
		},
		cognitivePercent: {
			before: 86.1,
			after: 88.7,
		},
		slackHours: {
			before: 3.9,
			after: 2.65,
		},
	};

	const { Story } = defineMeta({
		title: 'Component/Task Form Preview',
		component: TaskFormPreview,
		tags: ['autodocs'],
		args: {
			impact,
		},
	});
</script>

<Story
	name="What the draft does to today"
	play={async ({ canvas }) => {
		await expect(canvas.getByText('1h 15m')).toBeInTheDocument();
		await expect(canvas.getByText('runs 4 of 6')).toBeInTheDocument();
		await expect(canvas.getByText('63.4')).toBeInTheDocument();

		// Both pools read, and each as the day moves rather than as a level: a
		// single number would not say what the draft did.
		await expect(canvas.getByText('41% → 62%')).toBeInTheDocument();
		await expect(canvas.getByText('86% → 89%')).toBeInTheDocument();
		await expect(canvas.getByText('3h 54m → 2h 39m')).toBeInTheDocument();

		// The band is the fill, and a word beside it wherever colour would otherwise
		// be the only carrier — a plan still inside its pools is Optimal, and the
		// cognitive row, at 89%, is the ordinary reading that says nothing.
		const physical = canvas.getByText('41% → 62%').closest('div')!;

		await expect(physical.querySelector('.h-1')!.firstElementChild).toHaveClass(
			BAND_BAR_CLASS.success,
		);

		await expect(canvas.getByText('Optimal')).toHaveClass('sr-only');
		await expect(canvas.queryByText('Caution')).toBeNull();
	}}
/>

<Story
	name="Nothing typed yet"
	args={{
		impact: null,
	}}
	play={async ({ canvas }) => {
		// The prompt line stands where the reading will go: a panel with a heading
		// and nothing under it reads as a rendering failure.
		await expect(canvas.getByText(/Name the task/)).toBeInTheDocument();
		await expect(canvas.queryByText('Suggested hours')).toBeNull();
	}}
/>

<Story
	name="A draft today has no hours for"
	args={{
		impact: {
			...impact,
			suggestedHours: 0,
			position: null,
			physicalPercent: {
				before: 41.2,
				after: 41.2,
			},
			cognitivePercent: {
				before: 86.1,
				after: 86.1,
			},
			slackHours: {
				before: 0,
				after: 0,
			},
		},
	}}
	play={async ({ canvas }) => {
		// A funded slot is the one thing the reading cannot invent, so the hours are
		// said quietly and the note says why there is no position.
		await expect(canvas.getByText('0m')).toHaveClass('text-ty-silent');
		await expect(canvas.getByText('today funds no hours for it')).toBeInTheDocument();
	}}
/>

<Story
	name="A pool with no hours in it"
	args={{
		impact: {
			...impact,
			physicalPercent: {
				before: Infinity,
				after: Infinity,
			},
		},
	}}
	play={async ({ canvas }) => {
		// Injured → a pool of 0 hours, whose saturation is Infinity. The row goes
		// rather than printing "Infinity%".
		await expect(canvas.queryByText('Physical pool')).toBeNull();
		await expect(canvas.getByText('Cognitive pool')).toBeInTheDocument();
	}}
/>
