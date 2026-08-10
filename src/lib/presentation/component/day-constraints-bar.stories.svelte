<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fireEvent, fn } from 'storybook/test';
	import type { Persisted, FlowObservationRecord } from '$lib/business/type';
	import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

	const log = (id: number, date: string, taskTitle: string, phiHours: number) =>
		({
			id,
			date,
			taskId: id,
			taskTitle,
			difficulty: 7,
			enjoyment: 6,
			E: 4,
			beta: 1.5,
			phiHours,
			createdAt: id,
		}) satisfies Persisted<FlowObservationRecord>;

	const flowLogs: Persisted<FlowObservationRecord>[] = [
		log(1, '2026-07-18', 'boxing', 0.5),
		log(2, '2026-07-19', 'writing', 0.75),
		log(3, '2026-07-20', 'inbox', 0.25),
	];

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
			constantsFitted: true,
			flowLogs,
			onresetlogs: fn(),
			isOpen: true,
		},
	});
</script>

<!-- Expanded: all four inputs with switch cost in minutes, and the ϕ fit's own summary
     line — what it read, a link to the logs on /analytics, and a two-step reset. -->
<Story
	name="Open"
	play={async ({ args, canvas, userEvent }) => {
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

		// A healthy fit is stated inside, beside the two verbs a fit has: read the logs
		// it used (on /analytics, which prints every kind of log dated — this card lists
		// none of them since 2026-08-10) and un-personalize it.
		await expect(canvas.getByText(/Model personalized from 3 time-to-flow logs/)).toBeVisible();

		await expect(canvas.getByRole('link')).toHaveAttribute('href', '/analytics');
		await expect(canvas.queryByRole('listitem')).not.toBeInTheDocument();

		// All logs reset only after confirmation.
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Reset personalization',
			}),
		);

		await expect(args.onresetlogs).not.toHaveBeenCalled();
		await expect(canvas.getByText('Delete all 3 logs and revert to defaults?')).toBeVisible();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Reset',
			}),
		);

		await expect(args.onresetlogs).toHaveBeenCalledOnce();
	}}
/>

<!-- Slack above 0.05 h adds the unplanned-time warning line -->
<Story
	name="With unplanned time"
	args={{
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
/>

<!-- Collapsed it is one line: budget · planned · slack · pools · switch -->
<Story
	name="Collapsed"
	args={{
		isOpen: false,
		remainingSuggestedHours: '4.00',
		planSlackHours: 2,
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByText('6h budget · 4.00h planned · 2.00h free · 8h mind · 4h body · 15m switch'),
		).toBeVisible();

		await expect(
			canvas.getByRole('button', {
				name: /Time Budget/,
			}),
		).toHaveAttribute('aria-expanded', 'false');

		// A healthy fit is reassurance and stays inside — no model line out here.
		await expect(canvas.queryByText(/Model personalized/)).not.toBeInTheDocument();
	}}
/>

<!-- Logs present but the fit was rejected: one of the two model states that
     surface while collapsed, and the loud one -->
<Story
	name="Collapsed with a rejected fit"
	args={{
		isOpen: false,
		constantsFitted: false,
	}}
	play={async ({ canvas }) => {
		// The plan fills the budget, so the summary omits the free segment.
		await expect(
			canvas.getByText('6h budget · 5.25h planned · 8h mind · 4h body · 15m switch'),
		).toBeVisible();

		await expect(canvas.getByText(/Your 3 flow logs produced an implausible fit/)).toBeVisible();
	}}
/>

<!-- The other one, and the quiet one: nothing is wrong, there is just nothing
     logged. This line is the only place in the app that says ⚡ exists, so it has
     to be legible at `text-ty-silent` on a card in every theme — which is what the
     a11y addon checks here and cannot check while it is collapsed out of view. -->
<Story
	name="Collapsed, nothing logged"
	args={{
		isOpen: false,
		constantsFitted: false,
		flowLogs: [],
		onresetlogs: undefined,
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.getByRole('button', {
				name: /Time Budget/,
			}),
		).toHaveAttribute('aria-expanded', 'false');

		// Not the warning colour — nothing is wrong, there is just nothing logged yet.
		await expect(canvas.getByText(/Model uses default constants/)).toHaveClass('text-ty-silent');
	}}
/>

<!-- The bar renders on a future day, but no task there offers a ⚡ button, so
     the first-log prompt would point at nothing and is withheld. -->
<Story
	name="Future day"
	args={{
		isOpen: false,
		canLog: false,
		constantsFitted: false,
		flowLogs: [],
	}}
	play={async ({ canvas }) => {
		// The summary proves the bar rendered — otherwise the absence below is
		// satisfied by nothing having rendered at all.
		await expect(
			canvas.getByText('6h budget · 5.25h planned · 8h mind · 4h body · 15m switch'),
		).toBeVisible();

		await expect(canvas.queryByText(/Model uses default constants/)).not.toBeInTheDocument();
	}}
/>

<!-- The healthy-fit status has a singular form; it too stays quiet while
     collapsed and is stated inside, on the fit's own summary line. -->
<Story
	name="A single log"
	args={{
		isOpen: false,
		flowLogs: [flowLogs[0]],
	}}
	play={async ({ canvas, userEvent }) => {
		await expect(
			canvas.queryByText(/Model personalized from 1 time-to-flow log/),
		).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole('button', {
				name: /Time Budget/,
			}),
		);

		await expect(canvas.getByText(/Model personalized from 1 time-to-flow log/)).toBeVisible();
	}}
/>

<Story
	name="No logs yet"
	args={{
		constantsFitted: false,
		flowLogs: [],
		onresetlogs: undefined,
	}}
/>

<!-- MATH.md §33: a log made today is on the page but not in the plan, so the row
     count and the fit's count differ — the line has to print the one the fit
     used, and name the other. This is the state that answers "I logged that, why
     did nothing move?", so unlike a healthy fit it earns the collapsed line. -->
<Story
	name="A log the plan defers"
	args={{
		isOpen: false,
		flowLogs: [...flowLogs, log(4, '2026-07-21', 'deep work', 1)],
		pendingFlowLogs: 1,
	}}
	play={async ({ canvas }) => {
		// Three, not the four rows the list below holds.
		await expect(canvas.getByText(/Model personalized from 3 time-to-flow logs/)).toBeVisible();
		await expect(canvas.getByText(/1 ⚡ logged today/)).toBeVisible();
		await expect(canvas.getByText(/today's plan holds/)).toBeVisible();
	}}
/>

<!-- Day one: every log is deferred, so there is no fit to describe. The deferral
     line REPLACES the "log ⚡ to start personalizing" prompt, which would
     otherwise ask the user to do the thing they have just done. -->
<Story
	name="Every log deferred"
	args={{
		isOpen: false,
		constantsFitted: false,
		flowLogs: [flowLogs[0]],
		pendingFlowLogs: 1,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText(/1 ⚡ logged today/)).toBeVisible();
		await expect(canvas.queryByText(/to start personalizing/)).not.toBeInTheDocument();
	}}
/>
