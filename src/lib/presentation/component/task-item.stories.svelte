<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, waitFor, within } from 'storybook/test';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import TaskItem from '$lib/presentation/component/task-item.svelte';
	import { BAND_TEXT_CLASS } from '$lib/presentation/utils/band';
	import type { DayBlock } from '$lib/presentation/utils/day-timeline';
	import { newDrainDraft } from '$lib/presentation/utils/measurement-prompt';

	const { Story } = defineMeta({
		title: 'Component/Task Item',
		component: TaskItem,
		render: template,
		tags: ['autodocs'],
		args: {
			locale: 'en-US',
			id: 1,
			title: 'write the calibration section',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			nature: 'cognitive',
			completed: false,
			priorityScore: 12.4,
			suggestedHours: 1.75,
			trueEffort: 4.2,
			flowStateTime: 0.6,
			optimalStopHours: 2.25,
			ontoggle: fn(),
			onremove: fn(),
			flowDraft: null,
			onflowopen: fn(),
			onflowedit: fn(),
			onflowclose: fn(),
			onlogflow: fn(),
			drainDraft: null,
			drainLogs: [],
			ondrainopen: fn(),
			ondrainclose: fn(),
			ondrainsave: fn(),
			ondrainedit: fn(),
			ondraindelete: fn(),
			onflowdelete: fn(),
			onupdate: fn(),
		},
	});

	const shortOfFlow: DayBlock = {
		id: 1,
		hours: 1,
		startOffset: 0,
		warmupHours: 1,
		inFlowHours: 0,
		ghostHours: 0.1,
		switchHours: 0.25,
		band: 'warning',
		isCompleted: false,
	};

	const drainLog = (over: Partial<Persisted<DrainObservationRecord>> = {}) => ({
		id: 11,
		date: '2026-08-10',
		taskId: 1,
		taskTitle: 'write the calibration section',
		hours: 0.75,
		cognitiveDemand: 0.8,
		physicalDemand: 0.2,
		mindDrain: 6,
		bodyDrain: 2,
		createdAt: 0,
		...over,
	});
</script>

{#snippet template(args: ComponentProps<typeof TaskItem>)}
	<ul><TaskItem {...args} /></ul>
{/snippet}

<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText('COG')).toBeVisible();

		const checkbox = canvas.getByRole('checkbox', {
			name: 'Mark write the calibration section complete',
		});

		await userEvent.click(checkbox);
		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		// ✎ and ✕ are no tooltip's trigger. Asserted on `data-slot` rather than by hovering
		// and waiting for nothing: a tooltip that never opens and one delayed look alike.
		for (const name of ['Edit task', 'Delete task']) {
			await expect(
				canvas.getByRole('button', {
					name,
				}),
			).not.toHaveAttribute('data-slot', 'tooltip-trigger');
		}

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete task',
			}),
		);

		await expect(args.onremove).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<Story
	name="First in run order"
	args={{
		runOrder: 1,
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(
			canvas.getByRole('heading', {
				name: args.title,
			}),
		).toBeVisible();

		await expect(canvas.getByText('#1')).toBeVisible();

		// The plan's own hours hold the row's right edge; everything the model derived —
		// the priority with it — reads on the line under the title.
		await expect(canvas.getByText('1h 45m')).toBeVisible();

		const derived = canvas.getByText('effort 4.2 · flow @ 36m · stop by 2h 15m');

		expect(derived.parentElement).toContainElement(canvas.getByText('prio 12.4'));

		// A derived reading keeps its tooltip: nothing on the line says what ϕ is.
		await userEvent.hover(derived);

		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^What the Fallow model derived/)).toBeVisible());
	}}
/>

<Story
	name="With a decimal comma"
	args={{
		locale: 'de-DE',
	}}
	play={async ({ canvas }) => {
		// A German reader reads the row's decimals with a comma, as the dates beside them.
		await expect(canvas.getByText('effort 4,2 · flow @ 36m · stop by 2h 15m')).toBeVisible();
		await expect(canvas.getByText('prio 12,4')).toBeVisible();
	}}
/>

<Story
	name="Short of flow"
	args={{
		suggestedHours: 1,
		flowStateTime: 1.1,
		runOrder: 1,
		block: shortOfFlow,
		totalHours: 8,
	}}
	play={async ({ canvas }) => {
		const verdict = canvas.getByText('short of flow by 6m');

		await expect(verdict).toHaveClass(...BAND_TEXT_CLASS.warning.split(' '));
		expect(verdict.parentElement).toContainElement(canvas.getByText('prio 12.4'));

		const columns = canvas.getByRole('listitem').firstElementChild!.getBoundingClientRect();

		const rail = canvas
			.getByText('warming up')
			.parentElement!.parentElement!.getBoundingClientRect();

		expect(rail.top).toBeGreaterThanOrEqual(columns.bottom);
		expect(rail.left).toBeCloseTo(columns.left, 0);
		expect(rail.right).toBeCloseTo(columns.right, 0);
	}}
/>

<Story
	name="Reaches flow"
	args={{
		suggestedHours: 1.5,
		flowStateTime: 1,
		runOrder: 1,
		block: {
			...shortOfFlow,
			hours: 1.5,
			inFlowHours: 0.5,
			ghostHours: 0,
			band: 'success',
		},
		totalHours: 8,
	}}
	play={async ({ canvas }) => {
		expect(canvas.queryByText(/short of flow/)).toBeNull();
		await expect(canvas.getByText('in flow')).toBeInTheDocument();
	}}
/>

<Story
	name="Next in the mid-day re-plan"
	args={{
		runOrder: 4,
		isNext: true,
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		const next = canvas.getByRole('button', {
			name: 'Next',
		});

		// Beside `#N`, not among the title's badges — and the two disagree by design.
		expect(canvas.getByText('#4').nextElementSibling).toBe(next);

		expect(
			next.compareDocumentPosition(
				canvas.getByRole('checkbox', {
					name: /^Mark/,
				}),
			),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

		await userEvent.hover(next);

		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^Where to pick up now/)).toBeVisible());
	}}
/>

<Story
	name="Flow band"
	args={{
		flowStateTime: 1.4,
		flowStateTimeStd: 0.4,
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		const trigger = canvas.getByText('effort 4.2 · flow @ 1h 24m ± 24m · stop by 2h 15m');

		await userEvent.hover(trigger);

		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^What the Fallow model derived/)).toBeVisible());
		await waitFor(() => expect(body.getByText(/^± is one standard deviation/)).toBeVisible());

		// Below it on screen, not merely after it in the DOM: the tooltip shell is
		// an `inline-flex` row, and document order alone reads the same in a column.
		const derived = body.getByText(/^What the Fallow model derived/).getBoundingClientRect();
		const band = body.getByText(/^± is one standard deviation/).getBoundingClientRect();

		expect(band.top).toBeGreaterThanOrEqual(derived.bottom);
	}}
/>

<Story
	name="Flow band absent before a fit"
	args={{
		flowStateTime: 1.4,
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		const trigger = canvas.getByText('effort 4.2 · flow @ 1h 24m · stop by 2h 15m');

		await userEvent.hover(trigger);

		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^What the Fallow model derived/)).toBeVisible());

		expect(body.queryByText(/^± is one standard deviation/)).toBeNull();
	}}
/>

<Story
	name="Mid-day re-plan"
	args={{
		runOrder: 1,
		remaining: {
			taskHours: 0.75,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		// The re-plan reads WITH the plan, never over it
		const delta = canvas.getByText('spend 45m');
		await expect(delta).toBeVisible();
		await expect(delta).toHaveClass(/text-ty-primary/);

		// The plan number surviving mid-day IS the scope split, on screen.
		const plan = canvas.getByText('plan 1h 45m');
		await expect(plan).toBeVisible();
		await expect(plan).toHaveClass(/text-ty-silent/);

		// Both readings in one stack at the row's right edge, the plan under the re-plan
		expect(plan.parentElement).toContainElement(delta);
	}}
/>

<Story
	name="Re-plan lands on the planned hours"
	args={{
		remaining: {
			taskHours: 1.75,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		// A re-plan that agrees with the plan is not shown at all: a line grown to repeat a number
		// reads as news where there is none.
		const plan = canvas.getByText('1h 45m');

		await expect(plan).toHaveClass(/text-ty-primary/);
		await expect(canvas.getByText('prio 12.4')).toBeVisible();

		// The same two elements the re-plan reading uses, and each still its own trigger:
		// the two modes were two structures, and the small line had to be edited twice.
		for (const reading of [plan, canvas.getByText('prio 12.4')]) {
			await expect(reading).toHaveAttribute('data-slot', 'tooltip-trigger');
		}

		// Not merely unlabelled — there is no second reading on the row.
		await expect(canvas.queryByText(/spend/)).not.toBeInTheDocument();
		await expect(canvas.queryByText(/plan 1h 45m/)).not.toBeInTheDocument();

		await userEvent.hover(plan);
		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^Suggested time allocation/)).toBeVisible());
	}}
/>

<Story
	name="Re-plan differs below the printed minute"
	args={{
		remaining: {
			taskHours: 1.7499,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		// The guard is the PRINTED figure, not the raw hours: 1.7499h and 1.75h both render "1h 45m",
		// and comparing the numbers would put that duplicate back on screen.
		await expect(canvas.queryByText(/spend/)).not.toBeInTheDocument();
	}}
/>

<Story
	name="Nothing more worth doing"
	args={{
		remaining: {
			taskHours: 0,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		// A task the rest of the day is worth nothing on says so, rather than vanishing: an absent row
		// would read as "no answer" where the model has a definite one.
		await expect(canvas.getByText('spend 0m')).toBeVisible();
	}}
/>

<Story
	name="With a logged time-to-flow"
	args={{
		runOrder: 2,
		flowMinutes: 40,
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		const badge = canvas.getByRole('button', {
			name: 'Correct this time to flow',
		});

		await expect(badge).toHaveTextContent('⚡ 40m');

		// Explained by the same tooltip the whole row uses, not a native title
		await userEvent.hover(badge);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByText(/^Measured minutes-to-flow/)).toBeVisible());

		// The badge corrects the reading; it is not the logging verb a past day withholds.
		await userEvent.click(badge);
		await expect(args.onflowedit).toHaveBeenCalledExactlyOnceWith(1, 'button');
		await expect(args.onflowopen).not.toHaveBeenCalled();

		// ⚡ is one number per day, so an earlier one silences the completion prompt.
		await userEvent.click(canvas.getByRole('checkbox'));
		await expect(args.onflowopen).not.toHaveBeenCalled();
	}}
/>

<Story
	name="Completed"
	args={{
		completed: true,
		runOrder: 1,
		suggestedHours: 1,
		flowStateTime: 1.1,
		block: {
			...shortOfFlow,
			isCompleted: true,
		},
		totalHours: 8,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Un-completing ends no session, so it asks for no measurement
		const checkbox = canvas.getByRole('checkbox');
		await expect(checkbox).toBeChecked();

		await expect(
			canvas.getByRole('heading', {
				name: args.title,
			}),
		).toHaveClass('line-through');

		await expect(canvas.queryByText('#1')).not.toBeInTheDocument();
		await expect(canvas.queryByText('12.4')).not.toBeInTheDocument();

		await expect(canvas.getByText('warming up').parentElement!.parentElement!).toBeVisible();
		expect(canvas.queryByText(/short of flow/)).toBeNull();

		await userEvent.click(checkbox);
		await expect(args.onflowopen).not.toHaveBeenCalled();
		await expect(args.ondrainopen).not.toHaveBeenCalled();
	}}
/>

<Story
	name="Past day"
	args={{
		flowMinutes: 40,
		drainLogs: [drainLog()],
		onupdate: undefined,
		onremove: undefined,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// A past day: the plan is frozen, the measurements are not. Both LOGGING buttons
		// and both corrections stay offered; only the plan's edit and delete are withheld.
		await expect(canvas.getByRole('checkbox')).toBeVisible();

		await expect(
			canvas.queryByRole('button', {
				name: 'Delete task',
			}),
		).not.toBeInTheDocument();

		await expect(
			canvas.queryByRole('button', {
				name: 'Edit task',
			}),
		).not.toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		).toBeVisible();

		await expect(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		).toBeVisible();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Correct this time to flow',
			}),
		);

		await expect(args.onflowedit).toHaveBeenCalledOnce();

		// 🪫 the same, which is the point — one rule for both readings
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Correct this drain rating',
			}),
		);

		await expect(args.ondrainedit).toHaveBeenCalledExactlyOnceWith(1, args.drainLogs?.[0]);
	}}
/>

<Story
	name="Unallocated"
	args={{
		title: 'reorganize the garage',
		physicalDifficulty: 9,
		mentalDifficulty: 1,
		enjoyment: 2,
		nature: 'physical',
		priorityScore: 0.8,
		suggestedHours: 0,
		trueEffort: 4.5,
		flowStateTime: 1.1,
		optimalStopHours: 1.9,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('PHY')).toBeVisible();
	}}
/>

<Story
	name="Balanced"
	args={{
		nature: 'balanced',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('HYB')).toBeVisible();
	}}
/>

<Story
	name="Logging time to flow"
	play={async ({ args, canvas, userEvent }) => {
		// The editor is the page's answer to the call, so nothing opens under this story's mock
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		);

		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'button');
		await expect(canvas.queryByPlaceholderText('min')).not.toBeInTheDocument();
	}}
/>

<Story
	name="Flow editor open"
	args={{
		flowDraft: {
			focusMinutes: false,
			promptedByCompletion: false,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.type(canvas.getByPlaceholderText('min'), '25');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onlogflow).toHaveBeenCalledExactlyOnceWith(1, 25);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		);

		await expect(args.onflowclose).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<Story
	name="Asks on completion"
	play={async ({ args, canvas, userEvent }) => {
		// The caret stays on the checkbox: ticking tasks off with the keyboard must not land it in a
		// number field
		const checkbox = canvas.getByRole('checkbox');
		await userEvent.click(checkbox);

		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(checkbox).toHaveFocus();
	}}
/>

<Story
	name="Withdrawn prompt"
	args={{
		completed: true,
		flowDraft: {
			focusMinutes: false,
			promptedByCompletion: true,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// `completed` is a prop: un-completing withdraws the question completion asked
		await userEvent.click(canvas.getByRole('checkbox'));
		await expect(args.onflowclose).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<Story
	name="Keeps a hand-opened editor"
	args={{
		completed: true,
		flowDraft: {
			focusMinutes: true,
			promptedByCompletion: false,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// ...but never an editor the user opened by hand, which is theirs to keep
		await userEvent.click(canvas.getByRole('checkbox'));

		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.onflowclose).not.toHaveBeenCalled();
	}}
/>

<Story
	name="Inline editor"
	play={async ({ args, canvas, userEvent }) => {
		// The completion prompt opens BESIDE the ✎ editor's unsaved draft rather than closing it: the
		// two forms answer different questions
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		await expect(
			canvas.getByRole('slider', {
				name: /Physical Diff/,
			}),
		).toBeInTheDocument();

		await expect(
			canvas.getByRole('slider', {
				name: /Mental Diff/,
			}),
		).toBeInTheDocument();

		await expect(
			canvas.getByRole('slider', {
				name: /Enjoyment/,
			}),
		).toBeInTheDocument();

		const title = canvas.getByLabelText('Title');
		await expect(title).toHaveValue('write the calibration section');
		await userEvent.clear(title);
		await userEvent.type(title, 'sparring');

		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: 'Mark write the calibration section complete',
			}),
		);

		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(title).toHaveValue('sparring');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'sparring',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: false,
			importance: 'normal',
			tags: [],
		});
	}}
/>

<Story
	name="Must do today"
	args={{
		mustDoToday: true,
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText('Stays today')).toBeVisible();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		const flag = canvas.getByLabelText('Keep on today');
		await expect(flag).toBeChecked();
		await userEvent.click(flag);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'write the calibration section',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: false,
			importance: 'normal',
			tags: [],
		});
	}}
/>

<Story
	name="Carried for days"
	args={{
		slideDay: 6,
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		// A statement about the task, not an alarm about the plan: the row names the day it is on and
		// the tooltip says where the count comes from.
		const badge = canvas.getByRole('button', {
			name: 'day 6',
		});

		await expect(badge).toHaveAttribute('data-slot', 'tooltip-trigger');

		await userEvent.hover(badge);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByText(/^How many days/)).toBeVisible());
	}}
/>

<Story
	name="Rating a session"
	args={{
		drainLogs: [],
		drainDraft: {
			minutes: 45,
			mind: 6,
			body: 2,
			focusMinutes: false,
			promptedByCompletion: false,
		},
		ondrainopen: fn(),
		ondrainclose: fn(),
		ondrainsave: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		// ✓ reports the session in hours, keyed by the task the row is
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		await expect(args.ondrainsave).toHaveBeenCalledExactlyOnceWith(1, {
			hours: 0.75,
			mind: 6,
			body: 2,
		});

		// The button closes what it opened — the page owns the draft, so the row asks
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainclose).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<Story
	name="Rated sessions read on the row"
	args={{
		drainLogs: [
			drainLog({
				id: 11,
				hours: 0.75,
				mindDrain: 6,
				bodyDrain: 2,
			}),
			drainLog({
				id: 12,
				hours: 2,
				mindDrain: 9,
				bodyDrain: 4,
			}),
		],
	}}
	play={async ({ args, canvas, canvasElement, userEvent }) => {
		// Two sessions are two ratings (MATH.md §8.7), and correcting one has to say WHICH
		const chips = canvas.getAllByRole('button', {
			name: 'Correct this drain rating',
		});

		await expect(chips).toHaveLength(2);
		await expect(chips[0]).toHaveTextContent('45m');
		await expect(chips[0]).toHaveTextContent('Mind 6');
		await expect(chips[0]).toHaveTextContent('Body 2');
		await expect(chips[1]).toHaveTextContent('2h');

		await userEvent.hover(chips[0]);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByText(/^Re-open this session/)).toBeVisible());

		await userEvent.click(chips[1]);
		await expect(args.ondrainedit).toHaveBeenCalledExactlyOnceWith(1, args.drainLogs?.[1]);
	}}
/>

<Story
	name="Correcting a rating"
	args={{
		drainLogs: [
			drainLog({
				id: 11,
			}),
			drainLog({
				id: 12,
				hours: 2,
				mindDrain: 9,
				bodyDrain: 4,
			}),
		],
		drainDraft: {
			recordId: 11,
			minutes: 45,
			mind: 6,
			body: 2,
			focusMinutes: true,
			promptedByCompletion: false,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(45);

		const chips = canvas.getAllByRole('button', {
			name: 'Correct this drain rating',
		});

		// The chip the editor is on closes it, rather than re-seeding fields under the caret.
		await userEvent.click(chips[0]);
		await expect(args.ondrainclose).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.ondrainedit).not.toHaveBeenCalled();

		// Another session's chip switches to it — what only a per-rating control can do.
		await userEvent.click(chips[1]);
		await expect(args.ondrainedit).toHaveBeenCalledExactlyOnceWith(1, args.drainLogs?.[1]);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete this drain rating',
			}),
		);

		await expect(args.ondraindelete).toHaveBeenCalledExactlyOnceWith(1, 11);

		// 🪫 means "one more session", so over an open CORRECTION it opens a blank editor
		// rather than closing one it never opened. It closes only its own — story below.
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'button');
	}}
/>

<Story
	name="Closing a new session"
	args={{
		drainDraft: newDrainDraft('button'),
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Over the editor it DID open, 🪫 closes it: an append editor is the one with no `recordId`,
		// which is exactly "the editor this button owns"
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainclose).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.ondrainopen).not.toHaveBeenCalled();
	}}
/>

<Story
	name="Rating a new session offers no delete"
	args={{
		drainDraft: newDrainDraft('button'),
	}}
	play={async ({ canvas }) => {
		// Nothing is stored yet, so there is nothing to delete and the editor offers no 🗑
		await expect(
			canvas.queryByRole('button', {
				name: 'Delete this drain rating',
			}),
		).not.toBeInTheDocument();
	}}
/>

<Story
	name="Clearing a time-to-flow"
	args={{
		flowMinutes: 40,
		flowDraft: {
			focusMinutes: true,
			promptedByCompletion: false,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// ⚡ is one number per day, so its editor amends rather than appends — and drops
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(40);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete this flow log',
			}),
		);

		await expect(args.onflowdelete).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<Story
	name="Logging a first time-to-flow offers no delete"
	args={{
		flowDraft: {
			focusMinutes: true,
			promptedByCompletion: false,
		},
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.queryByRole('button', {
				name: 'Delete this flow log',
			}),
		).not.toBeInTheDocument();
	}}
/>

<Story
	name="Completion holds the drain prompt back on a rated task"
	args={{
		drainLogs: [drainLog()],
	}}
	play={async ({ args, canvas, userEvent }) => {
		// A rated task was rated from the stopped timer, so a second editor would open empty.
		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: 'Mark write the calibration section complete',
			}),
		);

		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(args.ondrainopen).not.toHaveBeenCalled();

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'button');
	}}
/>

<Story
	name="The sliders and what they derive, under the title"
	args={{
		physicalDifficulty: 0,
		mentalDifficulty: 8,
		enjoyment: 9,
		trueEffort: 4.1,
		suggestedHours: 1.75,
		priorityScore: 25.3,
		flowStateTime: 2.23,
		optimalStopHours: 3.92,
	}}
	play={async ({ canvas }) => {
		// Everything the row says about the TASK is one line under the title, priority
		// included — the plan's own hours are all that reads beside the name.
		const meta = canvas.getByText('effort 4.1 · flow @ 2h 14m · stop by 3h 55m').parentElement;

		for (const reading of ['P 0', 'M 8', 'E 9', 'prio 25.3']) {
			expect(meta).toContainElement(canvas.getByText(reading));
		}

		expect(meta).not.toContainElement(
			canvas.getByRole('heading', {
				level: 3,
			}),
		);

		expect(canvas.queryByRole('table')).not.toBeInTheDocument();
	}}
/>

<Story
	name="Logged readings read apart from their triggers"
	args={{
		flowMinutes: 95,
		drainLogs: [
			drainLog({
				id: 11,
			}),
			drainLog({
				id: 12,
				hours: 2,
				mindDrain: 9,
				bodyDrain: 4,
			}),
		],
	}}
	play={async ({ canvas }) => {
		// 🪫 is one rating per session (MATH.md §8.7), so the chips are unbounded: they wrap
		// on the meta line, and the two bare triggers keep the row's right edge.
		const badge = canvas.getByRole('button', {
			name: 'Correct this time to flow',
		});

		await expect(badge).toHaveTextContent('⚡ 95m');

		const chips = canvas.getAllByRole('button', {
			name: 'Correct this drain rating',
		});

		expect(chips).toHaveLength(2);

		for (const chip of chips) expect(badge.parentElement).toContainElement(chip);

		const append = canvas.getByRole('button', {
			name: 'Log end-of-session drain',
		});

		expect(badge.parentElement).not.toContainElement(append);

		expect(append.parentElement).toContainElement(
			canvas.getByRole('button', {
				name: 'Delete task',
			}),
		);

		// `toBeVisible` walks the ancestors' opacity — what the old strip could never pass.
		for (const reading of [badge, ...chips, append]) await expect(reading).toBeVisible();
	}}
/>

<Story
	name="Both instruments offered with nothing logged"
	play={async ({ canvas }) => {
		// Nothing logged is the state both instruments exist for, so both are offered —
		// in the action group, beside ✎ and ✕.
		const actions = canvas.getByRole('button', {
			name: 'Delete task',
		}).parentElement;

		for (const name of ['Log time to flow', 'Log end-of-session drain']) {
			expect(actions).toContainElement(
				canvas.getByRole('button', {
					name,
				}),
			);
		}
	}}
/>

<Story
	name="Actions reachable without hovering"
	play={async ({ canvas }) => {
		// 114px reserved to show nothing is only redeemed by a narrower always-visible one
		for (const name of ['Edit task', 'Delete task']) {
			await expect(
				canvas.getByRole('button', {
					name,
				}),
			).toBeVisible();
		}
	}}
/>

<Story
	name="Both measurement forms open under the row"
	args={{
		flowDraft: {
			focusMinutes: false,
			promptedByCompletion: true,
		},
		drainDraft: newDrainDraft('completion'),
	}}
	play={async ({ canvas }) => {
		// Completion opens both editors ("Completion asks both" pins that half), and both stack
		// INSIDE the task's own row — the row is the unit, so nothing spans anything.
		const row = canvas.getByRole('listitem');

		expect(row).toContainElement(canvas.getByText('⚡ Minutes to reach flow:'));
		expect(row).toContainElement(canvas.getByText('🪫 After the session:'));
		expect(canvas.queryByRole('table')).not.toBeInTheDocument();
	}}
/>

<Story
	name="The editor joins the two measurement forms"
	args={{
		flowDraft: {
			focusMinutes: false,
			promptedByCompletion: true,
		},
		drainDraft: newDrainDraft('completion'),
	}}
	play={async ({ canvas, userEvent }) => {
		// ✎ stacks with the other two, in the one row the task has
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		expect(canvas.getAllByRole('listitem')).toHaveLength(1);
		expect(canvas.getByRole('listitem')).toContainElement(canvas.getByLabelText('Title'));
	}}
/>
