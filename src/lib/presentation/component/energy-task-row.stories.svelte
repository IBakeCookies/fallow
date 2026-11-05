<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';

	const { Story } = defineMeta({
		title: 'Component/Energy Task Row',
		component: EnergyTaskRow,
		render: template,
		tags: ['autodocs'],
		args: {
			locale: 'en-US',
			title: 'write the calibration section',
			completed: false,
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 7,
			mustDoToday: false,
			color: 'var(--series-1)',
			trueEffort: 4.1,
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

	// Mounted in the card the Lab uses: the row is an `<li>`, so it is only a row inside
	// the list that card draws.
</script>

{#snippet template(args: ComponentProps<typeof EnergyTaskRow>)}
	{#snippet rows()}
		<EnergyTaskRow {...args} />
	{/snippet}
	<div class="max-w-4xl">
		<TaskListCard {rows} />
	</div>
{/snippet}

<Story
	name="Default"
	args={{
		plannedHours: 2.5,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// The row fills the shared shell with the Lab's reading: the plan's hue, the three model
		// inputs and the true effort they come to on the line under the title, and the hours
		// the schedule gave it beside the name.
		const row = canvas.getByRole('listitem');

		// One hue per task across the timeline, the schedule list and this row — it leads
		// the row where `#N` leads `/`'s, so both screens share the grammar. The swatch is
		// the row's only inline style, since a hue cannot be a class (STYLE.md).
		await expect(row.querySelector('span[style]')).toHaveAttribute(
			'style',
			expect.stringContaining('var(--series-1)'),
		);

		// The three inputs read as text under the title, and the number the three of them
		// come to reads beside them: no sliders — they are a definition, and ✎ re-tunes them.
		// `getByText` on the bare reading matches the meta line itself — its only direct
		// text — so this is the three sliders and what they come to, on one line.
		const meta = canvas.getByText('effort 4.1');

		for (const reading of ['P 2', 'M 8', 'E 7']) {
			expect(meta).toContainElement(canvas.getByText(reading));
		}

		await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();

		// What the plan gave the task, in the app's one duration spelling
		await expect(canvas.getByText('2h 30m')).toBeVisible();

		// A peer model heads nothing it does not compute, and it computes no table.
		expect(canvas.queryByRole('table')).not.toBeInTheDocument();

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
/>

<Story
	name="With a decimal comma"
	args={{
		locale: 'de-DE',
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('effort 4,1')).toBeVisible();
	}}
/>

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
		// Funded nothing this plan: said out loud where the hours would read, because a row
		// silent about them reads as a reading the optimizer never took
		await expect(canvas.getByText('no hours')).toBeVisible();
	}}
/>

<Story
	name="No plan"
	args={{
		plannedHours: null,
	}}
	play={async ({ args, canvas }) => {
		// No plan at all is not "no hours for this task" — that would be a claim the optimizer never
		// made, on every row at once
		await expect(canvas.queryByText('no hours')).not.toBeInTheDocument();
		await expect(canvas.getByText(args.title)).toBeInTheDocument();
	}}
/>

<Story
	name="Completed and rated"
	args={{
		completed: true,
		drainLogs: [drainLog()],
	}}
	play={async ({ args, canvas, userEvent }) => {
		// Finished, and rated: the optimizer no longer plans it, so its hours go rather than read "no
		// hours" as a verdict — and the rating reads on the row, in the Lab exactly as on the main
		// page, so a session is never rated invisibly.
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
/>

<Story
	name="Editing"
	args={{
		mustDoToday: true,
	}}
	play={async ({ args, canvas, userEvent }) => {
		// ✎ opens the same editor the main page's rows open, minus the must-do flag: the plan advisor
		// is the main page's, so the checkbox would change nothing on screen here. The flag still has
		// to survive the round trip.
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Edit task',
			}),
		);

		const title = canvas.getByLabelText('Title');
		await expect(title).toHaveValue(args.title);

		// The editor is where the three inputs are set, and where this mode stops
		await expect(canvas.getAllByRole('slider')).toHaveLength(3);
		await expect(canvas.queryByLabelText('Keep on today')).not.toBeInTheDocument();

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
			importance: 'normal',
			tags: [],
		});

		// Saving closes it
		await expect(canvas.queryByLabelText('Title')).not.toBeInTheDocument();
	}}
/>

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
		// The 🪫 editor open under the row, on a stored rating: `recordId` is what makes ✓ a correction,
		// and it is also what puts 🗑 in the editor — the two verbs a rating needs are both here now, on
		// the row the session belongs to.
		// Seeded with what was already logged, not blank
		await expect(canvas.getByPlaceholderText('min')).toHaveValue(45);

		// The editor opens INSIDE the row it corrects, which is what keeps a correction
		// attached to the session it is about.
		expect(canvas.getByRole('listitem')).toContainElement(canvas.getByPlaceholderText('min'));

		// ✓ reports the amended session through the row, in hours
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Save',
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
/>
