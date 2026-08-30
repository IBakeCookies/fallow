<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, waitFor, within } from 'storybook/test';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import TaskItem from '$lib/presentation/component/task-item.svelte';
	import { newDrainDraft } from '$lib/presentation/utils/measurement-prompt';

	const { Story } = defineMeta({
		title: 'Component/Task Item',
		component: TaskItem,
		render: template,
		tags: ['autodocs'],
		args: {
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

	/* `/`'s column order (task-list.stories.svelte pins the header). A row story renders
	   no `<thead>`, so a cell's position is what says which column it is. */
	const CELL = {
		order: 0,
		task: 1,
		physical: 2,
		mental: 3,
		enjoyment: 4,
		effort: 5,
		priority: 6,
		flow: 7,
		stop: 8,
		logged: 9,
		planned: 10,
		actions: 11,
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
	<table class="w-full"><TaskItem {...args} /></table>
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

		// The plan's three readings, each in the column that names it — no `prio`,
		// `flow @` or `stop by` prefix left to spell out what the header says.
		const cells = canvas.getAllByRole('cell');

		expect(cells[CELL.planned].textContent?.trim()).toBe('1h 45m');
		expect(cells[CELL.priority].textContent?.trim()).toBe('12.4');
		expect(cells[CELL.flow].textContent?.trim()).toBe('36m');
		expect(cells[CELL.stop].textContent?.trim()).toBe('2h 15m');

		// A derived reading keeps its tooltip: no column word says what ϕ is.
		await userEvent.hover(canvas.getByText('36m'));

		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^What the Fallow model derived/)).toBeVisible());
	}}
/>

<Story
	name="Flow band"
	args={{
		flowStateTime: 1.4,
		flowStateTimeStd: 0.4,
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		const cells = canvas.getAllByRole('cell');

		expect(cells[CELL.flow].textContent?.replace(/\s+/g, ' ').trim()).toBe('1h 24m ± 24m');

		const trigger = cells[CELL.flow].querySelector('[data-slot="tooltip-trigger"]') as HTMLElement;

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
		const cells = canvas.getAllByRole('cell');

		expect(cells[CELL.flow].textContent?.replace(/\s+/g, ' ').trim()).toBe('1h 24m');

		const trigger = cells[CELL.flow].querySelector('[data-slot="tooltip-trigger"]') as HTMLElement;

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

		// Both readings in the one cell the question is about, priority beside it
		expect(canvas.getAllByRole('cell')[CELL.planned]).toContainElement(delta);
		expect(canvas.getAllByRole('cell')[CELL.planned]).toContainElement(plan);
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
		await expect(canvas.getByText('12.4')).toBeVisible();

		// The same two elements the re-plan reading uses, and each still its own trigger:
		// the two modes were two structures, and the small line had to be edited twice.
		for (const reading of [plan, canvas.getByText('12.4')]) {
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
		onflowopen: undefined,
		ondrainopen: undefined,
		onupdate: undefined,
		onremove: undefined,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// A past day: correct, never append. A new observation stamps the LIVE clock's today, so both
		// LOGGING buttons are withheld while both corrections stay offered.
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
			canvas.queryByRole('button', {
				name: 'Log time to flow',
			}),
		).not.toBeInTheDocument();

		await expect(
			canvas.queryByRole('button', {
				name: 'Log end-of-session drain',
			}),
		).not.toBeInTheDocument();

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
				name: '✓',
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
				name: '✓',
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
	name="Completion asks both"
	args={{
		drainLogs: [drainLog()],
	}}
	play={async ({ args, canvas, userEvent }) => {
		// The tick asks for both: 🪫 is one per session, so a rating the day already holds does not
		// silence its prompt the way ⚡ silences its own
		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: 'Mark write the calibration section complete',
			}),
		);

		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
	}}
/>

<Story
	name="Every reading in its own cell"
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
		// One reading, one cell, so a column can be compared between tasks.
		const cells = canvas.getAllByRole('cell');

		expect(cells[CELL.physical].textContent?.trim()).toBe('0');
		expect(cells[CELL.mental].textContent?.trim()).toBe('8');
		expect(cells[CELL.enjoyment].textContent?.trim()).toBe('9');
		expect(cells[CELL.effort].textContent?.trim()).toBe('4.1');
		expect(cells[CELL.priority].textContent?.trim()).toBe('25.3');

		// Right-aligned with `tabular-nums` is the whole point of the column.
		for (const column of [
			CELL.physical,
			CELL.mental,
			CELL.enjoyment,
			CELL.effort,
			CELL.priority,
			CELL.flow,
			CELL.stop,
			CELL.planned,
		]) {
			expect(getComputedStyle(cells[column]).textAlign).toBe('right');
		}
	}}
/>

<Story
	name="Readings and triggers in the Logged cell"
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
		// 🪫 is one rating per session (MATH.md §8.7), so its chip count is unbounded and only a
		// flexible cell holds it — with the triggers, or the one-click rule breaks.
		const badge = canvas.getByRole('button', {
			name: 'Correct this time to flow',
		});

		await expect(badge).toHaveTextContent('⚡ 95m');

		const logged = canvas.getAllByRole('cell')[CELL.logged];

		expect(logged).toContainElement(badge);

		const chips = canvas.getAllByRole('button', {
			name: 'Correct this drain rating',
		});

		expect(chips).toHaveLength(2);

		for (const chip of chips) expect(logged).toContainElement(chip);

		const append = canvas.getByRole('button', {
			name: 'Log end-of-session drain',
		});

		expect(logged).toContainElement(append);

		// `toBeVisible` walks the ancestors' opacity — what the old strip could never pass.
		for (const reading of [badge, ...chips, append]) await expect(reading).toBeVisible();
	}}
/>

<Story
	name="Both instruments offered with nothing logged"
	play={async ({ canvas }) => {
		// Nothing logged is the state both instruments exist for, so both are offered
		const logged = canvas.getAllByRole('cell')[CELL.logged];

		expect(logged).toContainElement(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		);

		expect(logged).toContainElement(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);
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
	name="Both measurement forms in one spanning row"
	args={{
		flowDraft: {
			focusMinutes: false,
			promptedByCompletion: true,
		},
		drainDraft: newDrainDraft('completion'),
	}}
	play={async ({ canvas }) => {
		// Completion opens both editors ("Completion asks both" pins that half); both land in one
		// spanning row under the task's own, which is why the shell is a `<tbody>`.
		const rows = canvas.getAllByRole('row');

		expect(rows).toHaveLength(2);

		const editors = rows[1].querySelectorAll('td');

		expect(editors).toHaveLength(1);
		await expect(editors[0]).toHaveAttribute('colspan', '12');
		expect(editors[0]).toContainElement(canvas.getByText('⚡ Minutes to reach flow:'));
		expect(editors[0]).toContainElement(canvas.getByText('🪫 After the session:'));
	}}
/>

<Story
	name="The editor joins the spanning row"
	args={{
		flowDraft: {
			focusMinutes: false,
			promptedByCompletion: true,
		},
		drainDraft: newDrainDraft('completion'),
	}}
	play={async ({ canvas, userEvent }) => {
		// ✎ stacks in the same spanning row, and the row keeps one line of cells
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		const rows = canvas.getAllByRole('row');

		expect(rows).toHaveLength(2);
		expect(rows[1].querySelector('td')).toContainElement(canvas.getByLabelText('Title'));
	}}
/>
