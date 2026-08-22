<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import type { Persisted, DrainObservationRecord } from '$lib/business/type';
	import EnergyTaskRow from '$lib/presentation/component/energy-task-row.svelte';
	import TaskListCard from '$lib/presentation/component/task-list-card.svelte';
	import { getEnergyTaskColumns } from '$lib/presentation/utils/ledger-column';

	const { Story } = defineMeta({
		title: 'Component/Energy Task Row',
		component: EnergyTaskRow,
		render: template,
		tags: ['autodocs'],
		args: {
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

	/* The Lab's column order — a peer model, so it heads only what it computes. */
	const CELL = {
		hue: 0,
		task: 1,
		physical: 2,
		mental: 3,
		enjoyment: 4,
		effort: 5,
		logged: 6,
		planned: 7,
		actions: 8,
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

<!-- In the card the Lab mounts, with the Lab's own columns: the row is a `<tbody>`, so
     it has to be read inside the table whose header names its cells. -->
{#snippet template(args: ComponentProps<typeof EnergyTaskRow>)}
	{#snippet rows()}
		<EnergyTaskRow {...args} />
	{/snippet}
	<div class="max-w-4xl">
		<TaskListCard columns={getEnergyTaskColumns()} {rows} />
	</div>
{/snippet}

<!-- The row fills the shared shell with the Lab's reading: the plan's hue, the three
     model inputs, the true effort they come to, and the hours the schedule gave it. -->
<Story
	name="Default"
	args={{
		plannedHours: 2.5,
	}}
	play={async ({ args, canvas, userEvent }) => {
		const headers = [...canvas.getByRole('table').querySelectorAll('thead th')];

		// The hue swatch and the ✎/✕ strip show no heading and still carry an `sr-only`
		// one, so nothing in the row reads as an unnamed column.
		expect(headers.map((header) => header.textContent?.trim())).toEqual([
			'Color',
			'Task',
			'Phys',
			'Ment',
			'Enjoy',
			'Effort',
			'Logged',
			'Planned',
			'Actions',
		]);

		const cells = canvas.getAllByRole('cell');

		// One hue per task across the timeline, the schedule list and this row — it takes
		// the narrow leading cell `#N` takes on `/`, so both screens share the grammar
		await expect(cells[CELL.hue].firstElementChild).toHaveAttribute(
			'style',
			expect.stringContaining('var(--series-1)'),
		);

		// The three inputs read as text, and the number the three of them come to reads
		// beside them: no sliders — they are a definition, and ✎ is what re-tunes them.
		expect(cells[CELL.physical].textContent?.trim()).toBe('2');
		expect(cells[CELL.mental].textContent?.trim()).toBe('8');
		expect(cells[CELL.enjoyment].textContent?.trim()).toBe('7');
		expect(cells[CELL.effort].textContent?.trim()).toBe('4.1');
		await expect(canvas.queryByRole('slider')).not.toBeInTheDocument();

		// What the plan gave the task, in the app's one duration spelling
		expect(cells[CELL.planned].textContent?.trim()).toBe('2h 30m');

		// `Planned` is reached by scrolling the ledger on a phone, so the identity pair —
		// the hue and the title, the Lab's own leading columns — is pinned in the header
		// and in the row alike, or the hours arrive with no task attached to them.
		const isPinned = (cell: Element) => cell.classList.contains('ledger-pin');

		expect(headers.filter(isPinned)).toEqual(headers.slice(0, CELL.physical));
		expect(cells.filter(isPinned)).toEqual(cells.slice(0, CELL.physical));

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

<!-- Funded nothing this plan: said out loud in the cell that would otherwise be blank,
     because a blank cell reads as a reading the optimizer never took -->
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
		expect(canvas.getAllByRole('cell')[CELL.planned].textContent?.trim()).toBe('no hours');
	}}
/>

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
/>

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
/>

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
/>

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

		// The editor is one cell as wide as the Lab's ledger, and unpinned: it holds no
		// column, so a sticky offset would only slide it out of its own row.
		const spanning = [...canvas.getByRole('table').querySelectorAll('td[colspan]')];

		expect(spanning).toHaveLength(1);
		await expect(spanning[0]).toHaveAttribute('colspan', '9');
		expect(spanning[0]).not.toHaveClass('ledger-pin');

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
/>
