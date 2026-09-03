<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { DraftImpact } from '$lib/business/model/metric/draft-impact';
	import type { NextTaskSuggestion } from '$lib/business/model/metric/next-task-suggestion';
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
		displaced: {
			hoursTaken: 0.67,
			taskCount: 3,
			unfunded: [],
		},
		burnoutRisk: {
			before: 22.4,
			after: 31.1,
		},
	};

	/* Ranked, as `suggestNextTasks` returns them: best first, each with the hours
	   today's plan would give it. */
	const nextTasks: NextTaskSuggestion[] = [
		['Boxing training', 9, 1, 1.5],
		['Deep write', 1, 9, 1],
		['Guitar', 4, 3, 0.5],
	].map(([title, physical, mental, hours]) => ({
		rating: {
			title: title as string,
			physicalDifficulty: physical as number,
			mentalDifficulty: mental as number,
			enjoyment: 5,
			lastUsedDate: '2026-09-01',
		},
		suggestedHours: hours as number,
	}));

	const { Story } = defineMeta({
		title: 'Component/Task Form Preview',
		component: TaskFormPreview,
		tags: ['autodocs'],
		args: {
			impact,
			nextTasks: null,
			hasNextTaskRoom: true,
			onnexttasks: () => {},
			onpicknexttask: () => {},
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

		// What the draft costs the rest of the day, which no other row on the panel
		// says: the hours it thins them by, and how many of them lost any.
		await expect(canvas.getByText('40m from 3 tasks')).toBeInTheDocument();
		await expect(canvas.getByText('22% → 31%')).toBeInTheDocument();

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

		// The search runs on mount, so the panel is already working — there is no
		// control to press and nothing for the user to opt into.
		await expect(canvas.getByText(/Ranking/)).toBeInTheDocument();
		await expect(canvas.queryAllByRole('button')).toHaveLength(0);
	}}
/>

<Story
	name="Three titles the day would fund"
	args={{
		impact: null,
		nextTasks,
	}}
	play={async ({ canvas }) => {
		// Best first, in the order the ranking handed them over — the panel sorts
		// nothing — each row numbered with its rank and carrying the hours today's
		// plan would give it.
		const rows = canvas.getAllByRole('listitem').map((row) => row.textContent!);

		await expect(rows).toHaveLength(3);
		await expect(rows[0]).toMatch(/1.*Boxing training/);
		await expect(rows[1]).toMatch(/2.*Deep write/);
		await expect(rows[2]).toMatch(/3.*Guitar/);
		await expect(rows[0]).toMatch('1h 30m');

		// What they are and where they came from, said rather than left to be
		// inferred: a title the cap left out is otherwise silently missing.
		await expect(canvas.getByText(/Best next tasks/)).toBeInTheDocument();
		await expect(canvas.getByText(/recently/)).toBeInTheDocument();
	}}
/>

<Story
	name="A day with no room for another task"
	args={{
		impact: null,
		hasNextTaskRoom: false,
	}}
	play={async ({ canvas }) => {
		// Under one block unspent: nothing is ranked at all, and an empty list would
		// read as a profile with no history rather than as a full day.
		await expect(canvas.getByText(/no room/)).toBeInTheDocument();
		await expect(canvas.queryByText(/Ranking/)).toBeNull();
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
			displaced: {
				hoursTaken: 0,
				taskCount: 0,
				unfunded: [],
			},
			burnoutRisk: {
				before: 22.4,
				after: 22.4,
			},
		},
	}}
	play={async ({ canvas }) => {
		// A funded slot is the one thing the reading cannot invent, so the hours are
		// said quietly and the note says why there is no position.
		await expect(canvas.getByText('0m')).toHaveClass('text-ty-silent');
		await expect(canvas.getByText('today funds no hours for it')).toBeInTheDocument();

		// A draft the day funds nothing for takes nothing, and a cost row saying so
		// is a line about a task that is not in the plan.
		await expect(canvas.queryByText('Cost to today')).toBeNull();
	}}
/>

<Story
	name="A draft that unfunds a task"
	args={{
		impact: {
			...impact,
			displaced: {
				hoursTaken: 0.5,
				taskCount: 2,
				unfunded: ['Write report'],
			},
		},
	}}
	play={async ({ canvas }) => {
		// Unfunding a task is the outcome that would change the user's mind, so it
		// takes the line and the hours total steps aside rather than sharing it.
		await expect(canvas.getByText('unfunds Write report')).toBeInTheDocument();
		await expect(canvas.queryByText(/from 2 tasks/)).toBeNull();
	}}
/>

<Story
	name="A draft that thins one task"
	args={{
		impact: {
			...impact,
			displaced: {
				hoursTaken: 0.25,
				taskCount: 1,
				unfunded: [],
			},
		},
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('15m from 1 task')).toBeInTheDocument();
	}}
/>

<Story
	name="A day that had room for it"
	args={{
		impact: {
			...impact,
			displaced: {
				hoursTaken: 0,
				taskCount: 0,
				unfunded: [],
			},
		},
	}}
	play={async ({ canvas }) => {
		// Said rather than dropped: absence is ambiguous, and this is the answer the
		// panel exists to give on a day with slack.
		await expect(canvas.getByText('takes nothing from the day')).toBeInTheDocument();
	}}
/>

<Story
	name="Burnout Risk before and after"
	args={{
		impact: {
			...impact,
			burnoutRisk: {
				before: 31.2,
				after: 58.4,
			},
		},
	}}
	play={async ({ canvas }) => {
		// The day's own reading, banded on its own axis — smaller is better here,
		// where the pool rows above read on human capacity.
		const risk = canvas.getByText('31% → 58%').closest('div')!;

		await expect(risk.querySelector('.h-1')!.firstElementChild).toHaveClass(BAND_BAR_CLASS.warning);

		await expect(canvas.getByText('Caution')).toHaveClass('sr-only');
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
