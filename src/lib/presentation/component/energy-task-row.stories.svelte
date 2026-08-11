<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';

	const { Story } = defineMeta({
		title: 'Component/Energy Task Row',
		component: EnergyTaskRow,
		tags: ['autodocs'],
		args: {
			title: 'write the calibration section',
			completed: false,
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: false,
			color: 'var(--series-1)',
			plannedHours: 1.75,
			drainLogs: [],
			flowDraft: null,
			drainDraft: null,
			ontoggle: fn(),
			onremove: fn(),
			onflowopen: fn(),
			onflowclose: fn(),
			onlogflow: fn(),
			onflowdelete: fn(),
			ondrainopen: fn(),
			ondrainclose: fn(),
			ondrainsave: fn(),
			ondrainedit: fn(),
			ondraindelete: fn(),
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

<!-- The row fills the shared shell with the Lab's reading: the plan's hue, the three
     model inputs as text, the hours the schedule gave it, and three actions. -->
<Story
	name="Default"
	play={async ({ args, canvas, userEvent }) => {
		// The three inputs read the same way the main page spells them — no sliders:
		// they are a definition, and ✎ is what re-tunes them. Asserted span by span:
		// `getByText` reads an element's own text nodes, and this line is five of them.
		await expect(canvas.getByText('P 2')).toBeInTheDocument();
		await expect(canvas.getByText('M 8')).toBeInTheDocument();
		await expect(canvas.getByText('E 7')).toBeInTheDocument();
		await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();

		// What the plan gave the task, in the app's one duration spelling
		await expect(canvas.getByText('1h 45m')).toBeInTheDocument();

		// One hue per task across the timeline, the schedule list and this row — the dot
		// is the title's preceding sibling, with no text of its own to find
		const dot = canvas.getByText(args.title).previousElementSibling;
		await expect(dot).toHaveAttribute('style', expect.stringContaining('var(--series-1)'));

		// Both measurements are on this row now, not just the Lab's own 🪫: the energy
		// model reads the ϕ constants ⚡ calibrates, so a Lab-only user could not feed
		// the fit their own plans are built from.
		await userEvent.click(
			canvas.getByRole('checkbox', {
				name: `Mark ${args.title} complete`,
			}),
		);

		await expect(args.ontoggle).toHaveBeenCalledOnce();

		// Ticking a task off ends the session both measurements describe, so it asks
		// both. Both drafts belong to the page, so the row reports the two prompts and
		// this story's mocks never answer them — which is why no editor appears below.
		await expect(args.onflowopen).toHaveBeenCalledExactlyOnceWith('completion');
		await expect(args.ondrainopen).toHaveBeenCalledExactlyOnceWith('completion');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete task',
			}),
		);

		await expect(args.onremove).toHaveBeenCalledOnce();

		// The button is a second way in, and says so: the caret follows a press but not
		// a prompt, which is what the source tells the page.
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		);

		await expect(args.ondrainopen).toHaveBeenNthCalledWith(2, 'button');
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl"><li><EnergyTaskRow {...args} /></li></ul>
	{/snippet}
</Story>

<!-- Funded nothing this plan: said out loud, because the timeline cannot say it -->
<Story
	name="Unfunded"
	args={{
		title: 'reorganize the garage',
		physicalDifficulty: 9,
		mentalDifficulty: 1,
		enjoyment: 2,
		plannedHours: 0,
		color: 'var(--series-3)',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('no hours')).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl"><li><EnergyTaskRow {...args} /></li></ul>
	{/snippet}
</Story>

<!-- No plan at all is not "no hours for this task" — that would be a claim the
     optimizer never made, on every row at once -->
<Story
	name="No plan"
	args={{
		plannedHours: null,
	}}
	play={async ({ args, canvas }) => {
		await expect(canvas.queryByText('no hours')).not.toBeInTheDocument();
		await expect(canvas.getByText(args.title)).toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl"><li><EnergyTaskRow {...args} /></li></ul>
	{/snippet}
</Story>

<!-- Finished, and rated: the optimizer no longer plans it, so its hours go rather
     than read "no hours" as a verdict — and the rating reads on the row, in the Lab
     exactly as on the main page, so a session is never rated invisibly. -->
<Story
	name="Completed and rated"
	args={{
		completed: true,
		drainLogs: [drainLog()],
	}}
	play={async ({ args, canvas, userEvent }) => {
		await expect(canvas.queryByText('1h 45m')).not.toBeInTheDocument();
		await expect(canvas.queryByText('no hours')).not.toBeInTheDocument();

		await expect(
			canvas.getByRole('button', {
				name: 'Log end-of-session drain',
			}),
		).toBeInTheDocument();

		// The chip corrects that session — the verb this row had to leave for the
		// calibration card below it until 2026-08-10.
		const chip = canvas.getByRole('button', {
			name: 'Correct this drain rating',
		});

		// And it is not inside the completed dim: a rating only EXISTS for a finished
		// session, so the one state that always shows it must not grey it out.
		await expect(chip.closest('.opacity-60')).toBeNull();

		await userEvent.click(chip);

		await expect(args.ondrainedit).toHaveBeenCalledExactlyOnceWith(drainLog());
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl"><li><EnergyTaskRow {...args} /></li></ul>
	{/snippet}
</Story>

<!-- ✎ opens the same editor the main page's rows open, minus the must-do flag: the
     plan advisor is the main page's, so the checkbox would change nothing on screen
     here. The flag still has to survive the round trip. -->
<Story
	name="Editing"
	args={{
		mustDoToday: true,
	}}
	play={async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		const title = canvas.getByLabelText('Title');
		await expect(title).toHaveValue(args.title);

		// The editor is where the three inputs are set, and where this mode stops
		await expect(canvas.getAllByRole('slider')).toHaveLength(3);
		await expect(canvas.queryByLabelText("Don't move off today")).not.toBeInTheDocument();

		await userEvent.clear(title);
		await userEvent.type(title, 'write §8.11');

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
			}),
		);

		// The whole edit in one patch the page hands to the session store — with the
		// flag it was seeded with, not the false a hidden checkbox would have reported
		await expect(args.onupdate).toHaveBeenCalledExactlyOnceWith({
			title: 'write §8.11',
			physicalDifficulty: args.physicalDifficulty,
			mentalDifficulty: args.mentalDifficulty,
			enjoyment: args.enjoyment,
			mustDoToday: true,
		});

		// Saving closes it
		await expect(canvas.queryByLabelText('Title')).not.toBeInTheDocument();
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl"><li><EnergyTaskRow {...args} /></li></ul>
	{/snippet}
</Story>

<!-- The 🪫 editor open under the row, on a stored rating: `recordId` is what makes ✓ a
     correction, and it is also what puts 🗑 in the editor — the two verbs a rating needs
     are both here now, on the row the session belongs to. -->
<Story
	name="Rating the session"
	args={{
		drainLogs: [drainLog()],
		drainDraft: {
			recordId: 11,
			minutes: 45,
			mind: 6,
			body: 2,
			focusMinutes: false,
			promptedByCompletion: false,
		},
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Seeded with what was already logged, not blank
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(45);

		// ✓ reports the amended session through the row, in hours
		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.ondrainsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.75,
			mind: 6,
			body: 2,
		});

		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Delete this drain rating',
			}),
		);

		await expect(args.ondraindelete).toHaveBeenCalledExactlyOnceWith(11);
	}}
>
	{#snippet template(args)}
		<ul class="max-w-2xl"><li><EnergyTaskRow {...args} /></li></ul>
	{/snippet}
</Story>
