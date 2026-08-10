<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, waitFor, within } from 'storybook/test';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import TaskItem from '$lib/presentation/component/task-item.svelte';

	const { Story } = defineMeta({
		title: 'Component/Task Item',
		component: TaskItem,
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

<!-- The cognitive badge, a checkbox named after the task, and the two callbacks
     wired to their controls -->
<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText('COG')).toBeVisible();

		const checkbox = canvas.getByRole('checkbox', {
			name: 'Mark write the calibration section complete',
		});

		await userEvent.click(checkbox);
		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete task',
			}),
		);

		await expect(args.onremove).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<!-- #1 in the suggested sequence — and the full row: inputs, allocation, derived values -->
<Story
	name="First in run order"
	args={{
		runOrder: 1,
	}}
	play={async ({ args, canvas }) => {
		await expect(
			canvas.getByRole('heading', {
				name: args.title,
			}),
		).toBeVisible();

		await expect(canvas.getByText('#1')).toBeVisible();
		await expect(canvas.getByText('P 2')).toBeVisible();
		await expect(canvas.getByText('M 8')).toBeVisible();
		await expect(canvas.getByText('E 7')).toBeVisible();
		await expect(canvas.getByText('1h 45m')).toBeVisible();
		await expect(canvas.getByText('prio 12.4')).toBeVisible();
		await expect(canvas.getByText('effort 4.2 · flow @ 36m · stop by 2h 15m')).toBeVisible();
	}}
/>

<!-- Mid-day (MATH.md §35): the re-plan reads WITH the plan, never over it. The
     morning's 1h 45m is still there, stacked under the delta; the new figure is
     what the hours still left are worth on this task now. -->
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
		// The delta leads, in the primary weight...
		const delta = canvas.getByText('spend 45m');
		await expect(delta).toBeVisible();
		await expect(delta).toHaveClass(/text-ty-primary/);

		// ...and the plan is still there, unchanged and muted beneath it. That the
		// plan number survives mid-day IS the §11.8 scope split, on screen.
		const plan = canvas.getByText('plan 1h 45m · prio 12.4');
		await expect(plan).toBeVisible();
		await expect(plan).toHaveClass(/text-ty-silent/);
	}}
/>

<!-- A re-plan that agrees with the plan is not shown at all: the row keeps the exact
     shape it had all morning. Logging hours against ONE task re-plans every other
     row, and on a day you spent them as asked the answer for those rows is the plan
     again — so announcing the re-plan there would grow a line to repeat a number,
     which reads as news where there is none. -->
<Story
	name="Re-plan lands on the planned hours"
	args={{
		remaining: {
			taskHours: 1.75,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas, canvasElement, userEvent }) => {
		const plan = canvas.getByText('1h 45m');

		await expect(plan).toHaveClass(/text-ty-primary/);
		await expect(canvas.getByText('prio 12.4')).toBeVisible();

		// Not merely unlabelled — there is no second reading on the row.
		await expect(canvas.queryByText(/spend/)).not.toBeInTheDocument();
		await expect(canvas.queryByText(/plan 1h 45m/)).not.toBeInTheDocument();

		await userEvent.hover(plan);
		const body = within(canvasElement.ownerDocument.body);

		await waitFor(() => expect(body.getByText(/^Suggested time allocation/)).toBeVisible());
	}}
/>

<!-- The guard is the PRINTED figure, not the raw hours: 1.7499h and 1.75h both render
     "1h 45m", and comparing the numbers would put that duplicate back on screen. -->
<Story
	name="Re-plan differs below the printed minute"
	args={{
		remaining: {
			taskHours: 1.7499,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		await expect(canvas.queryByText(/spend/)).not.toBeInTheDocument();
	}}
/>

<!-- A task the rest of the day is worth nothing on says so, rather than vanishing:
     an absent row would read as "no answer" where the model has a definite one. -->
<Story
	name="Nothing more worth doing"
	args={{
		remaining: {
			taskHours: 0,
			dayHours: 2.5,
		},
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('spend 0m')).toBeVisible();
	}}
/>

<!-- The ⚡ badge shows the measurement, so completing does not ask for it again — and it
     re-opens the editor on it, exactly as a 🪫 chip re-opens its rating. There is only
     one ⚡ per day, so this is the same editor the ⚡ button opens rather than a choice
     between sessions; a reading you cannot click is the inconsistency, not the
     duplication. -->
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

		await userEvent.click(badge);
		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'button');

		await userEvent.click(canvas.getByRole('checkbox'));
		await expect(args.onflowopen).toHaveBeenCalledOnce();
	}}
/>

<!-- Struck through, allocation and run order hidden — and un-completing ends no
     session, so it asks for no measurement -->
<Story
	name="Completed"
	args={{
		completed: true,
		runOrder: 1,
	}}
	play={async ({ args, canvas, userEvent }) => {
		const checkbox = canvas.getByRole('checkbox');
		await expect(checkbox).toBeChecked();

		await expect(
			canvas.getByRole('heading', {
				name: args.title,
			}),
		).toHaveClass('line-through');

		await expect(canvas.queryByText('#1')).not.toBeInTheDocument();
		await expect(canvas.queryByText('prio 12.4')).not.toBeInTheDocument();

		await userEvent.click(checkbox);
		await expect(args.onflowopen).not.toHaveBeenCalled();
		await expect(args.ondrainopen).not.toHaveBeenCalled();
	}}
/>

<!-- A past day: correct, never append. ✎ and the inert ✕ are withheld with both
     LOGGING buttons — a new observation stamps the LIVE clock's today, so one logged
     here would misdate itself onto a day the user is only reading — while the ratings
     the day already holds stay correctable, because a correction carries no date and
     re-describes the session where it happened.

     ⚡ has no correction affordance here at all, and that asymmetry is the data model's:
     a time-to-flow is half a session field (`flowMinutes`, persisted with the day) and
     the session store deliberately never rewrites a past day, so an amended one would
     read right until the next reload and then revert. 🪫 ratings are whole records of
     their own and have no such half. -->
<Story
	name="Past day"
	args={{
		flowMinutes: 40,
		drainLogs: [drainLog()],
		onflowopen: undefined,
		onlogflow: undefined,
		onflowdelete: undefined,
		ondrainopen: undefined,
		onupdate: undefined,
		onremove: undefined,
	}}
	play={async ({ args, canvas, userEvent }) => {
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

		// ⚡ still READS — a day's measurement is never hidden — but it opens nothing,
		// because there is no editor to open: the same reason the ⚡ button is gone.
		await expect(canvas.getByText('⚡ 40m')).toBeVisible();

		await expect(
			canvas.queryByRole('button', {
				name: 'Correct this time to flow',
			}),
		).not.toBeInTheDocument();

		// 🪫, by contrast, still reads AND still corrects
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

<!-- A balanced nature gets the hybrid badge -->
<Story
	name="Balanced"
	args={{
		nature: 'balanced',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('HYB')).toBeVisible();
	}}
/>

<!-- The ⚡ button is one way in and says so: the caret follows a press but not a
     prompt, which is what the source tells the page. The editor itself is the page's
     answer to that call, so nothing opens under this story's mock. -->
<Story
	name="Logging time to flow"
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log time to flow',
			}),
		);

		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'button');
		await expect(canvas.queryByPlaceholderText('min')).not.toBeInTheDocument();
	}}
/>

<!-- The draft answered: the editor hangs under the row, ✓ reports the minutes keyed
     by the task the row is, and the lit ⚡ closes what it opened -->
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

<!-- Completing is the one moment the user still knows the ramp-up, so the tick asks
     for it — and says the question was its own, which is what lets an un-tick take it
     back. The caret stays on the checkbox: ticking tasks off with the keyboard must
     not land it in a number field. -->
<Story
	name="Asks on completion"
	play={async ({ args, canvas, userEvent }) => {
		const checkbox = canvas.getByRole('checkbox');
		await userEvent.click(checkbox);

		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(checkbox).toHaveFocus();
	}}
/>

<!-- `completed` is a prop, so a mis-click is undone by the parent: un-completing
     withdraws the question completion asked -->
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
		await userEvent.click(canvas.getByRole('checkbox'));
		await expect(args.onflowclose).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<!-- ...but never an editor the user opened by hand, which is theirs to keep -->
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
		await userEvent.click(canvas.getByRole('checkbox'));

		await expect(args.ontoggle).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.onflowclose).not.toHaveBeenCalled();
	}}
/>

<!-- ✎ opens the inline editor: named sliders, editable title — and the completion
     prompt opens BESIDE its unsaved draft rather than closing it. The two forms
     answer different questions, so the row shows both, as the Lab's row does. -->
<Story
	name="Inline editor"
	play={async ({ args, canvas, userEvent }) => {
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

<!-- Flagged unmovable: badged on the row, and the editor can clear the flag -->
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

		const flag = canvas.getByLabelText("Don't move off today");
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

<!-- 🪫 is on this row too, not only in the Lab. It is the app's ONLY source of worked
     hours, and λ₀ (MATH.md §8.10), the §12 adherence audit and overnight carry-over
     (§11.9) all read finished days off it — so while the button lived on `/energy`
     alone, a user who never opened the Lab calibrated none of the three. -->
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

<!-- Every rating the day holds for this task reads on the row, one chip each — which is
     what a per-SESSION measurement needs and a badge cannot give it: two sessions are
     two ratings (MATH.md §8.7), and correcting one has to say WHICH. The chip is that
     answer, so it carries the whole session and reports the record it stands for. -->
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
		const chips = canvas.getAllByRole('button', {
			name: 'Correct this drain rating',
		});

		await expect(chips).toHaveLength(2);
		await expect(chips[0]).toHaveTextContent('45m');
		await expect(chips[0]).toHaveTextContent('M6');
		await expect(chips[0]).toHaveTextContent('B2');
		await expect(chips[1]).toHaveTextContent('2h');

		// The row's own tooltip, like every other explained reading on it
		await userEvent.hover(chips[0]);
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() => expect(body.getByText(/^Re-open this session/)).toBeVisible());

		// The second session, not the first: a page that could not tell them apart is
		// the reason this had to leave the Lab's flat list.
		await userEvent.click(chips[1]);
		await expect(args.ondrainedit).toHaveBeenCalledExactlyOnceWith(1, args.drainLogs?.[1]);
	}}
/>

<!-- A rating re-opened from its chip is a correction, so the editor offers to remove
     the session outright — the verb that used to live only on the Lab's card, next to
     the fields that describe the same row.

     And one rule governs every reading on the row: clicking the one the editor is
     already open on closes it, clicking another switches to it. ⚡ is that rule with a
     single reading, which is why its badge looked like a plain toggle. -->
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

		// The chip the editor is on: closes it, rather than re-seeding the fields under
		// the caret with the values they already hold.
		await userEvent.click(chips[0]);
		await expect(args.ondrainclose).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.ondrainedit).not.toHaveBeenCalled();

		// Another session's chip: switches to it, which is the thing only a per-rating
		// control can do and the reason these are not one toggle.
		await userEvent.click(chips[1]);
		await expect(args.ondrainedit).toHaveBeenCalledExactlyOnceWith(1, args.drainLogs?.[1]);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete this drain rating',
			}),
		);

		await expect(args.ondraindelete).toHaveBeenCalledExactlyOnceWith(1, 11);

		// 🪫 means "one more session", so over an open CORRECTION it switches to a blank
		// editor rather than closing one it never opened. It closes only its own — see
		// the story below.
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'button');
	}}
/>

<!-- ...and over the editor it DID open, 🪫 closes it: an append editor is the one with
     no `recordId`, which is exactly "the editor this button owns". -->
<Story
	name="Closing a new session"
	args={{
		drainDraft: {
			minutes: null,
			mind: null,
			body: null,
			focusMinutes: true,
			promptedByCompletion: false,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainclose).toHaveBeenCalledExactlyOnceWith(1);
		await expect(args.ondrainopen).not.toHaveBeenCalled();
	}}
/>

<!-- A new session is not a correction: nothing is stored yet, so there is nothing to
     delete and the editor says so by offering no such button. -->
<Story
	name="Rating a new session offers no delete"
	args={{
		drainDraft: {
			minutes: null,
			mind: null,
			body: null,
			focusMinutes: true,
			promptedByCompletion: false,
		},
	}}
	play={async ({ canvas }) => {
		await expect(
			canvas.queryByRole('button', {
				name: 'Delete this drain rating',
			}),
		).not.toBeInTheDocument();
	}}
/>

<!-- ⚡ is one number per day, so its editor amends rather than appends — and the same
     editor is where the measurement is dropped, which was reachable only from the
     budget panel's list before. -->
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
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(40);

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete this flow log',
			}),
		);

		await expect(args.onflowdelete).toHaveBeenCalledExactlyOnceWith(1);
	}}
/>

<!-- Nothing measured yet: the ⚡ editor has no measurement to drop -->
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

<!-- Completing a task is the moment both measurements are knowable, so the tick asks
     both, through one predicate and one shape of draft. They keep their own policies:
     ⚡ is one number per day and goes quiet once measured, 🪫 is one per session
     (MATH.md §18) and never does. Both drafts are the page's, so the row reports two
     prompts and this story's mocks leave them unanswered. -->
<Story
	name="Completion asks both"
	args={{
		drainLogs: [drainLog()],
	}}
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: 'Mark write the calibration section complete',
			}),
		);

		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith(1, 'completion');
	}}
/>
