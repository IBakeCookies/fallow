<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import type { EnergyDraftImpact } from '$lib/business/model/metric/energy-draft-impact';
	import TaskFormEnergyPreview from '$lib/presentation/component/task-form-energy-preview.svelte';

	/* Shaped as `calculateEnergyDraftImpact` returns it: a draft the optimizer
	   funds a block and a half of, three hours into the window. */
	const impact: EnergyDraftImpact = {
		suggestedHours: 1.5,
		startHour: 2,
		totalOutput: {
			before: 12.4,
			after: 14.1,
		},
		endCog: {
			before: 0.84,
			after: 0.71,
		},
		endPhys: {
			before: 0.62,
			after: 0.55,
		},
		displaced: {
			hoursTaken: 0.67,
			taskCount: 3,
			unfunded: [],
		},
	};

	const { Story } = defineMeta({
		title: 'Component/Task Form Energy Preview',
		component: TaskFormEnergyPreview,
		tags: ['autodocs'],
		args: {
			impact,
			isBusy: false,
			hasDraft: true,
			hasWindow: true,
		},
	});
</script>

<Story
	name="What the draft costs the optimized day"
	play={async ({ canvas }) => {
		// The hours the optimizer would give it, and where in the window they run —
		// an offset and not a clock time, like the schedule list above the form.
		await expect(canvas.getByText('1h 30m')).toBeInTheDocument();
		await expect(canvas.getByText('starts at 2h')).toBeInTheDocument();

		// The three figures `PlanSummary` prints, each as the draft moves it: a
		// single level would not say what the draft did.
		await expect(canvas.getByText('12.4 → 14.1')).toBeInTheDocument();
		await expect(canvas.getByText('84% → 71%')).toBeInTheDocument();
		await expect(canvas.getByText('62% → 55%')).toBeInTheDocument();

		// What the draft costs the rest of the day, which no other row says.
		await expect(canvas.getByText('40m from 3 tasks')).toBeInTheDocument();
	}}
/>

<Story
	name="Nothing typed yet"
	args={{
		impact: null,
		hasDraft: false,
	}}
	play={async ({ canvas }) => {
		// The prompt line stands where the reading will go: a panel with a heading
		// and nothing under it reads as a rendering failure.
		await expect(canvas.getByText(/Name the task/)).toBeInTheDocument();
		await expect(canvas.queryByText('Suggested hours')).toBeNull();
		await expect(canvas.queryByText(/12.4/)).toBeNull();
	}}
/>

<Story
	name="A named draft nobody has priced"
	args={{
		impact: null,
	}}
	play={async ({ canvas }) => {
		// The state every rating drag returns the panel to, and the commoner of the
		// two unpriced ones. Asking for a name that is already in the field above
		// reads as a form that is not listening.
		await expect(canvas.getByText(/Price this day to read/)).toBeInTheDocument();
		await expect(canvas.queryByText(/Name the task/)).toBeNull();
	}}
/>

<Story
	name="Pricing the draft"
	args={{
		impact: null,
		isBusy: true,
	}}
	play={async ({ canvas }) => {
		// One solve behind a button, so the panel has to say it is running — the
		// press is otherwise indistinguishable from a press that did nothing.
		await expect(canvas.getByText(/Pricing this task/)).toBeInTheDocument();
		await expect(canvas.queryByText(/Price this day to read/)).toBeNull();
	}}
/>

<Story
	name="A draft the day funds no hours for"
	args={{
		impact: {
			...impact,
			suggestedHours: 0,
			startHour: null,
			displaced: {
				hoursTaken: 0,
				taskCount: 0,
				unfunded: [],
			},
		},
	}}
	play={async ({ canvas }) => {
		// Not "0h at 0h": the tile says the optimizer gave it nothing, and the
		// position note has no slot to name.
		await expect(canvas.getByText(/funds no hours for it/)).toBeInTheDocument();
		await expect(canvas.queryByText(/starts at/)).toBeNull();
	}}
/>

<Story
	name="A draft that drops a task"
	args={{
		impact: {
			...impact,
			displaced: {
				hoursTaken: 1.5,
				taskCount: 1,
				unfunded: ['Write report'],
			},
		},
	}}
	play={async ({ canvas }) => {
		// A name beats a total: the task the day stops funding is the cost the user
		// can actually act on.
		await expect(canvas.getByText('unfunds Write report')).toBeInTheDocument();
	}}
/>

<Story
	name="A draft the day gives up for free"
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
		// Said rather than dropped: a missing cost row reads as a panel that failed
		// to render one.
		await expect(canvas.getByText(/takes nothing from the day/)).toBeInTheDocument();
	}}
/>

<Story
	name="A day with no window"
	args={{
		impact: null,
		hasWindow: false,
	}}
	play={async ({ canvas }) => {
		// The page refuses to draw a plan without a window; the panel agrees with it
		// rather than prompting for a task it could not price.
		await expect(canvas.getByText(/Set a day window/)).toBeInTheDocument();
		await expect(canvas.queryByText(/Price this day to read/)).toBeNull();
	}}
/>
